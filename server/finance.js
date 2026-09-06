'use strict';
const validate = require('./validation');
const {createHash} = require('node:crypto');
const {HttpError} = require('./http');
async function mutation(db,actor,key,kind,value,work) {
 return db.transaction(async tx=>{
  const hash=createHash('sha256').update(JSON.stringify({kind,value})).digest('hex');
  if(key) {
   const claim=await tx.query('INSERT INTO mutation_keys(actor_user_id,request_key,payload_hash) VALUES($1,$2,$3) ON CONFLICT(actor_user_id,request_key) DO NOTHING RETURNING request_key',[actor,key,hash]);
   if(!claim.rows.length) {
    const previous=(await tx.query('SELECT payload_hash,response FROM mutation_keys WHERE actor_user_id=$1 AND request_key=$2',[actor,key])).rows[0];
    if(previous.payload_hash!==hash) throw new HttpError(409,'Idempotency key was already used for different data');
    return previous.response;
   }
  }
  const result=await work(tx);
  if(key) await tx.query('UPDATE mutation_keys SET response=$3 WHERE actor_user_id=$1 AND request_key=$2',[actor,key,JSON.stringify(result)]);
  return result;
 });
}
async function audit(tx, actor, action, type, id, metadata = {}) {
 await tx.query('INSERT INTO audit_log(actor_user_id,action,entity_type,entity_id,metadata) VALUES($1,$2,$3,$4,$5)', [actor,action,type,id,JSON.stringify(metadata)]);
}
async function createSale(db, actor, body, key) {
 const v = validate.sale(body);
 return mutation(db,actor,key,'sale',v,async tx => {
  let customerId = v.customer_id;
  if(customerId && !(await tx.query('SELECT id FROM customers WHERE id=$1',[customerId])).rows.length) throw new HttpError(400,'Customer not found');
  if(v.product_id && !require('./products').products().some(p=>p.id===v.product_id)) throw new HttpError(400,'Product not found');
  if(v.product_id && v.unit_cost == null) {
   const cost=(await tx.query('SELECT unit_cost,currency FROM product_costs WHERE product_id=$1',[v.product_id])).rows[0];
   if(cost && cost.currency===v.currency) v.unit_cost=cost.unit_cost;
  }
  if (!customerId && v.customer) customerId = (await tx.query('INSERT INTO customers(name) VALUES($1) RETURNING id',[v.customer])).rows[0].id;
  const { rows } = await tx.query("INSERT INTO orders(customer_id,source,status,currency,subtotal,total,sale_date,due_date,notes) VALUES($1,'manual',$2,$3,$4,$4,$5,$6,$7) RETURNING *", [customerId,v.payment_status === 'paid' ? 'paid' : 'completed',v.currency,v.total,v.sale_date,v.due_date,v.notes]);
  const order = rows[0];
  await tx.query('INSERT INTO order_items(order_id,product_id,product_name_snapshot,quantity,unit_price,unit_cost) VALUES($1,$2,$3,$4,$5,$6)',[order.id,v.product_id,v.product_name_snapshot,v.quantity,v.unit_price,v.unit_cost]);
  if (v.paid_amount > 0 || v.payment_status === 'paid') await tx.query("INSERT INTO payments(order_id,amount,currency,method,status,payment_date) VALUES($1,$2,$3,$4,'succeeded',$5)",[order.id,v.paid_amount,v.currency,v.payment_method,v.sale_date]);
  await audit(tx,actor,'order.created','order',order.id,{source:'manual'});
  return order;
 });
}
async function createExpense(db, actor, body, key) {
 const v = validate.expense(body);
 return mutation(db,actor,key,'expense',v,async tx => {
  const {rows} = await tx.query('INSERT INTO expenses(category,description,vendor,amount,currency,expense_date,payment_method,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',[v.category,v.description,v.vendor,v.amount,v.currency,v.expense_date,v.payment_method,v.notes]);
  await audit(tx,actor,'expense.created','expense',rows[0].id);
  return rows[0];
 });
}
async function recordPayment(db, actor, body, key) {
 const v = validate.payment(body);
 return mutation(db,actor,key,'payment',v,async tx => {
  const order=(await tx.query('SELECT * FROM orders WHERE id=$1 FOR UPDATE',[v.order_id])).rows[0];
  if(!order)throw new HttpError(404,'Order not found');
  if(order.status==='expired' || order.status==='cancelled')throw new HttpError(409,'Cancelled or expired orders cannot receive payments');
  const paid=BigInt((await tx.query("SELECT COALESCE(sum(amount),0)::text amount FROM payments WHERE order_id=$1 AND status='succeeded'",[order.id])).rows[0].amount);
  const refunded=BigInt((await tx.query("SELECT COALESCE(sum(r.amount),0)::text amount FROM refunds r JOIN payments p ON p.id=r.payment_id WHERE p.order_id=$1",[order.id])).rows[0].amount);
  if(refunded>0n)throw new HttpError(409,'A refunded order cannot receive additional payments');
  const remaining=BigInt(order.total)-paid;
  if(v.amount>remaining)throw new HttpError(400,'Payment exceeds the remaining balance');
  const payment=(await tx.query("INSERT INTO payments(order_id,amount,currency,method,status,payment_date,notes) VALUES($1,$2,$3,$4,'succeeded',$5,$6) RETURNING *",[order.id,v.amount,order.currency,v.method,v.payment_date,v.notes])).rows[0];
  const afterPaid=paid+BigInt(v.amount),status=afterPaid>=BigInt(order.total)?'paid':'completed';
  await tx.query("UPDATE orders SET status=$2,updated_at=now() WHERE id=$1",[order.id,status]);
  await audit(tx,actor,'payment.created','payment',payment.id,{before:{paid:paid.toString(),remaining:remaining.toString()},after:{paid:afterPaid.toString(),remaining:(remaining-BigInt(v.amount)).toString()}});
  return payment;
 });
}
async function orderDetail(db,id) {
 const order=(await db.query(`SELECT o.*,c.name customer_name,c.email customer_email,c.phone customer_phone FROM orders o LEFT JOIN customers c ON c.id=o.customer_id WHERE o.id=$1`,[validate.uuid(id)])).rows[0];
 if(!order)throw new HttpError(404,'Order not found');
 const items=(await db.query('SELECT * FROM order_items WHERE order_id=$1 ORDER BY created_at,id',[order.id])).rows;
 const payments=(await db.query('SELECT * FROM payments WHERE order_id=$1 ORDER BY payment_date,id',[order.id])).rows;
 const refunds=(await db.query('SELECT r.*,p.id payment_id FROM refunds r JOIN payments p ON p.id=r.payment_id WHERE p.order_id=$1 ORDER BY r.refund_date,r.id',[order.id])).rows;
 const auditRows=(await db.query("SELECT * FROM audit_log WHERE (entity_type='order' AND entity_id=$1) OR entity_id IN (SELECT id FROM payments WHERE order_id=$1) ORDER BY created_at DESC",[order.id])).rows;
 const paid=payments.filter(p=>p.status==='succeeded').reduce((n,p)=>n+BigInt(p.amount),0n), refunded=refunds.reduce((n,r)=>n+BigInt(r.amount),0n);
 const payment_status=refunded>=paid&&refunded>0n?'refunded':refunded>0n?'partially_refunded':paid>=BigInt(order.total)?'paid':paid>0n?'partial':'pending';
 return {...order,items,payments,refunds,audit:auditRows,payment_status,amount_paid:String(paid),remaining_balance:String(BigInt(order.total)-paid),refund_total:String(refunded),net_collected:String(paid-refunded)};
}
async function createRefund(db, actor, body, key, stripe) {
 const v=validate.refund(body);
 const payment=(await db.query('SELECT p.*,o.total order_total,o.currency order_currency FROM payments p JOIN orders o ON o.id=p.order_id WHERE p.id=$1',[v.payment_id])).rows[0];
 if(!payment)throw new HttpError(404,'Payment not found');
 if(payment.status!=='succeeded')throw new HttpError(409,'Only successful payments can be refunded');
 if(payment.stripe_payment_intent_id || payment.stripe_charge_id) {
  if(!stripe || !stripe.refunds || typeof stripe.refunds.create!=='function')throw new HttpError(503,'Stripe refund service unavailable');
  const claim=await mutation(db,actor,key,'refund-claim',v,async tx=>{
   const prior=(await tx.query('SELECT * FROM refund_requests WHERE request_key=$1 FOR UPDATE',[key])).rows[0];
   if(prior) return prior;
   const priorRefund=BigInt((await tx.query('SELECT COALESCE(sum(amount),0)::text amount FROM refunds WHERE payment_id=$1',[v.payment_id])).rows[0].amount);
   if(BigInt(v.amount)>BigInt(payment.amount)-priorRefund)throw new HttpError(400,'Refund exceeds refundable balance');
   return (await tx.query('INSERT INTO refund_requests(request_key,payment_id,status,amount,currency,actor_user_id) VALUES($1,$2,\'requested\',$3,$4,$5) RETURNING *',[key,v.payment_id,v.amount,payment.currency,actor])).rows[0];
  });
  if(claim.status==='confirmed')return {status:'confirmed',duplicate:true};
  let result;
  try { result=await stripe.refunds.create({amount:v.amount,...(payment.stripe_payment_intent_id?{payment_intent:payment.stripe_payment_intent_id}:{charge:payment.stripe_charge_id})},{idempotencyKey:key}); }
  catch(error){ await db.query("UPDATE refund_requests SET status='failed' WHERE request_key=$1",[key]); throw new HttpError(502,'Stripe refund could not be initiated'); }
  if(result.status!=='succeeded') { await db.query("UPDATE refund_requests SET status='pending',stripe_refund_id=$2 WHERE request_key=$1",[key,result.id]); return {status:'pending',stripe_refund_id:result.id}; }
  return db.transaction(async tx=>{ const row=(await tx.query("INSERT INTO refunds(payment_id,amount,currency,refund_date,stripe_refund_id,reason,notes) VALUES($1,$2,$3,CURRENT_DATE,$4,$5,$6) ON CONFLICT(stripe_refund_id) DO UPDATE SET stripe_refund_id=EXCLUDED.stripe_refund_id RETURNING *",[v.payment_id,v.amount,payment.currency,result.id,v.reason,v.notes])).rows[0]; await tx.query("UPDATE refund_requests SET status='confirmed',stripe_refund_id=$2 WHERE request_key=$1",[key,result.id]); await audit(tx,actor,'refund.created','refund',row.id,{payment_id:v.payment_id,amount:v.amount,confirmed:true}); return row; });
 }
 return mutation(db,actor,key,'refund',v,async tx=>{ const p=(await tx.query('SELECT * FROM payments WHERE id=$1 FOR UPDATE',[v.payment_id])).rows[0]; if(!p)throw new HttpError(404,'Payment not found'); if(p.status!=='succeeded')throw new HttpError(409,'Only successful payments can be refunded'); const prior=BigInt((await tx.query('SELECT COALESCE(sum(amount),0)::text amount FROM refunds WHERE payment_id=$1',[p.id])).rows[0].amount); if(BigInt(v.amount)>BigInt(p.amount)-prior)throw new HttpError(400,'Refund exceeds refundable balance'); const row=(await tx.query("INSERT INTO refunds(payment_id,amount,currency,refund_date,reason,notes) VALUES($1,$2,$3,$4,$5,$6) RETURNING *",[p.id,v.amount,p.currency,v.refund_date,v.reason,v.notes])).rows[0]; await audit(tx,actor,'refund.created','refund',row.id,{payment_id:p.id,amount:v.amount,confirmed:true}); return row; });
}
async function productCost(db,actor,body,key) {
 const v=validate.productCost(body);
 if(!require('./products').products().some(p=>p.id===v.product_id))throw new HttpError(400,'Product not found');
 return mutation(db,actor,key,'product-cost',v,async tx=>{
  const before=(await tx.query('SELECT * FROM product_costs WHERE product_id=$1 FOR UPDATE',[v.product_id])).rows[0];
  const after=(await tx.query("INSERT INTO product_costs(product_id,unit_cost,currency,notes,updated_by) VALUES($1,$2,$3,$4,$5) ON CONFLICT(product_id) DO UPDATE SET unit_cost=EXCLUDED.unit_cost,currency=EXCLUDED.currency,notes=EXCLUDED.notes,updated_by=EXCLUDED.updated_by,updated_at=now() RETURNING *",[v.product_id,v.unit_cost,v.currency,v.notes,actor])).rows[0];
  await audit(tx,actor,'product_cost.changed','product_cost',after.id,{before,after});return after;
 });
}
function calculateTotals(values) {
 const revenue = BigInt(values.revenue || 0), collected = BigInt(values.collected || 0), refunds = BigInt(values.refunds || 0), expenses = BigInt(values.expenses || 0), costs = BigInt(values.costs || 0);
 const outstanding=BigInt(values.outstanding || 0);
 return { revenue:String(revenue), collected:String(collected), refunds:String(refunds), expenses:String(expenses), outstanding:String(outstanding), costOfGoodsSold:String(costs), grossProfit:String(revenue-costs-refunds), estimatedProfit:String(revenue-costs-refunds-expenses), missingCostItems:Number(values.missing_cost_items || 0) };
}
async function summary(db, f) {
 // Single SQL statement provides a consistent snapshot; aggregate separately to avoid join multiplication.
 const {rows} = await db.query(`SELECT
 (SELECT COALESCE(sum(total),0)::text FROM orders WHERE status IN ('completed','paid') AND currency=$1 AND sale_date BETWEEN $2 AND $3) revenue,
 (SELECT COALESCE(sum(amount),0)::text FROM payments WHERE status='succeeded' AND currency=$1 AND payment_date BETWEEN $2 AND $3) collected,
 (SELECT COALESCE(sum(amount),0)::text FROM refunds WHERE currency=$1 AND refund_date BETWEEN $2 AND $3) refunds,
 (SELECT COALESCE(sum(amount),0)::text FROM expenses WHERE deleted_at IS NULL AND currency=$1 AND expense_date BETWEEN $2 AND $3) expenses,
 (SELECT COALESCE(sum(i.unit_cost*i.quantity),0)::text FROM order_items i JOIN orders o ON o.id=i.order_id WHERE o.status IN ('completed','paid') AND o.currency=$1 AND o.sale_date BETWEEN $2 AND $3) costs,
 (SELECT count(*)::text FROM order_items i JOIN orders o ON o.id=i.order_id WHERE i.unit_cost IS NULL AND o.status IN ('completed','paid') AND o.currency=$1 AND o.sale_date BETWEEN $2 AND $3) missing_cost_items,
 (SELECT COALESCE(sum(GREATEST(o.total-COALESCE(p.paid,0),0)),0)::text FROM orders o LEFT JOIN (SELECT order_id,sum(amount) paid FROM payments WHERE status='succeeded' GROUP BY order_id) p ON p.order_id=o.id WHERE o.status IN ('completed','paid') AND o.currency=$1 AND o.sale_date BETWEEN $2 AND $3) outstanding`,[f.currency,f.from,f.to]);
 return {currency:f.currency,from:f.from,to:f.to,...calculateTotals(rows[0])};
}
async function list(db,kind,f) { return (await require('./dashboard').listing(db,kind,f)).records; }
module.exports = { mutation, audit, createSale, createExpense, recordPayment, createRefund, productCost, orderDetail, summary, list, calculateTotals };
