'use strict';
const { audit } = require('./finance');
const supported = new Set(['checkout.session.completed','checkout.session.expired','payment_intent.succeeded','charge.refunded','refund.updated']);
const idOf = value => typeof value === 'string' ? value : value?.id;
const day = timestamp => new Date(timestamp * 1000).toISOString().slice(0,10);
function amount(value) { if (!Number.isSafeInteger(value) || value < 0) throw Error('Invalid provider amount'); return value; }
async function processStripeEvent(db, stripe, event) {
 if (!supported.has(event.type)) return {ignored:true};
 return db.transaction(async tx => {
  const inserted = await tx.query("INSERT INTO webhook_events(provider,provider_event_id,event_type) VALUES('stripe',$1,$2) ON CONFLICT(provider_event_id) DO NOTHING RETURNING id",[event.id,event.type]);
  if (!inserted.rows.length) return {duplicate:true};
  let session, intentId, charge;
  const object = event.data.object;
  if (event.type.startsWith('checkout.session.')) {
   session = await stripe.checkout.sessions.retrieve(object.id);
   if (session.mode !== 'payment') throw Error('Unsupported checkout mode');
   intentId = idOf(session.payment_intent);
   if (!intentId) {
    if (event.type === 'checkout.session.expired') {
     const expired = await tx.query("UPDATE orders SET status='expired',updated_at=now() WHERE stripe_checkout_session_id=$1 AND status='pending' RETURNING id",[session.id]);
     for (const order of expired.rows) await audit(tx,null,'stripe.expired','order',order.id,{eventId:event.id});
    }
    else throw Error('Checkout has no payment intent; reconciliation required');
   }
  } else if (event.type === 'payment_intent.succeeded') intentId = object.id;
  else {
   charge = await stripe.charges.retrieve(event.type === 'refund.updated' ? idOf(object.charge) : object.id);
   intentId = idOf(charge.payment_intent);
   if (!intentId) throw Error('Charge has no payment intent; reconciliation required');
  }
  if (intentId) {
   // Serializes different events for the same payment; unique event insert serializes redelivery.
   await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))',[intentId]);
   const intent = await stripe.paymentIntents.retrieve(intentId);
   const currency = intent.currency.toUpperCase();
   if (!/^[A-Z]{3}$/.test(currency)) throw Error('Invalid provider currency');
   const paid = intent.status === 'succeeded';
   // Re-fetch current provider state instead of letting late events regress payment status.
   if (session && session.currency?.toUpperCase() !== currency) throw Error('Provider currency mismatch');
   const total = amount(session ? session.amount_total : intent.amount);
   const discount = amount(session?.total_details?.amount_discount || 0), tax = amount(session?.total_details?.amount_tax || 0);
   const subtotal = total + discount - tax;
   if (subtotal < 0) throw Error('Invalid checkout totals');
   let customerId = null;
   const customer = idOf(intent.customer) || idOf(session?.customer);
   if (customer) {
    customerId = (await tx.query('INSERT INTO customers(name,email,stripe_customer_id) VALUES($1,$2,$3) ON CONFLICT(stripe_customer_id) DO UPDATE SET updated_at=now() RETURNING id',[session?.customer_details?.name || 'Stripe customer',session?.customer_details?.email || null,customer])).rows[0].id;
   }
   let order = (await tx.query('SELECT * FROM orders WHERE stripe_payment_intent_id=$1 FOR UPDATE',[intentId])).rows[0];
   if (!order && session) order = (await tx.query('SELECT * FROM orders WHERE stripe_checkout_session_id=$1 FOR UPDATE',[session.id])).rows[0];
   if (order && (order.source !== 'stripe' || order.currency !== currency || (order.stripe_payment_intent_id && order.stripe_payment_intent_id !== intentId))) throw Error('Order linkage conflict');
   const status = paid ? 'paid' : session?.status === 'expired' ? 'expired' : 'pending';
   if (!order) {
    order = (await tx.query("INSERT INTO orders(customer_id,source,status,currency,subtotal,discount,tax,total,sale_date,stripe_checkout_session_id,stripe_payment_intent_id) VALUES($1,'stripe',$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *",[customerId,status,currency,subtotal,discount,tax,total,day(session?.created || intent.created),session?.id || null,intentId])).rows[0];
   } else {
    // Enrich automatically captured orders once Checkout details become available.
    await tx.query("UPDATE orders SET status=CASE WHEN status='paid' THEN status ELSE $2 END, customer_id=COALESCE(customer_id,$3),stripe_checkout_session_id=COALESCE(stripe_checkout_session_id,$4),stripe_payment_intent_id=$5,updated_at=now() WHERE id=$1",[order.id,status,customerId,session?.id || null,intentId]);
    if (session) await tx.query('UPDATE orders SET subtotal=$2,discount=$3,tax=$4,total=$5 WHERE id=$1',[order.id,subtotal,discount,tax,total]);
   }
   const items = (await tx.query('SELECT * FROM order_items WHERE order_id=$1',[order.id])).rows;
   if (session && (!items.length || items.every(i => i.product_id === '__stripe_unlinked__'))) {
    const lines = [];
    for await (const line of stripe.checkout.sessions.listLineItems(session.id,{limit:100})) lines.push(line);
    if (!lines.length) throw Error('Checkout line items unavailable');
    await tx.query("DELETE FROM order_items WHERE order_id=$1 AND product_id='__stripe_unlinked__'",[order.id]);
    for (const line of lines) {
     const quantity = line.quantity;
     if (!Number.isInteger(quantity) || quantity < 1) throw Error('Invalid provider quantity');
     const unit = amount(line.amount_subtotal / quantity);
     await tx.query('INSERT INTO order_items(order_id,product_id,product_name_snapshot,quantity,unit_price,unit_cost) VALUES($1,$2,$3,$4,$5,NULL)',[order.id,idOf(line.price?.product) || null,line.description || 'Stripe item',quantity,unit]);
    }
   } else if (!items.length) {
    await tx.query("INSERT INTO order_items(order_id,product_id,product_name_snapshot,quantity,unit_price,unit_cost) VALUES($1,'__stripe_unlinked__',$2,1,$3,NULL)",[order.id,intent.description || 'Stripe payment — item linkage pending',total]);
   }
   if (paid) {
    const chargeId = idOf(intent.latest_charge);
    const latestCharge = charge && charge.id === chargeId ? charge : chargeId ? await stripe.charges.retrieve(chargeId) : null;
    const payment = (await tx.query("INSERT INTO payments(order_id,amount,currency,method,status,payment_date,stripe_payment_intent_id,stripe_charge_id) VALUES($1,$2,$3,'stripe','succeeded',$4,$5,$6) ON CONFLICT(stripe_payment_intent_id) DO UPDATE SET amount=EXCLUDED.amount,status='succeeded',stripe_charge_id=EXCLUDED.stripe_charge_id,updated_at=now() RETURNING *",[order.id,amount(intent.amount_received),currency,day(latestCharge?.created || event.created),intentId,chargeId || null])).rows[0];
    // Always reconcile refunds from current Stripe state, including events delivered out of order.
    if (latestCharge) {
     let refunded = 0;
     for await (const refund of stripe.refunds.list({charge:latestCharge.id,limit:100})) {
      if (refund.status !== 'succeeded') continue;
      refunded += amount(refund.amount);
      if (refund.currency.toUpperCase() !== currency || refunded > Number(payment.amount)) throw Error('Refund does not match payment');
      await tx.query('INSERT INTO refunds(payment_id,amount,currency,refund_date,stripe_refund_id,reason) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(stripe_refund_id) DO NOTHING',[payment.id,refund.amount,currency,day(refund.created),refund.id,refund.reason || null]);
     }
    }
   }
   await audit(tx,null,'stripe.reconciled','order',order.id,{eventId:event.id,eventType:event.type});
  }
  await tx.query('UPDATE webhook_events SET processed=true,processed_at=now() WHERE provider_event_id=$1',[event.id]);
  return {processed:true};
 });
}
module.exports = { processStripeEvent };
