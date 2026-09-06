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
  let customerId = null;
  if (v.customer) customerId = (await tx.query('INSERT INTO customers(name) VALUES($1) RETURNING id',[v.customer])).rows[0].id;
  const { rows } = await tx.query("INSERT INTO orders(customer_id,source,status,currency,subtotal,total,sale_date,due_date,notes) VALUES($1,'manual',$2,$3,$4,$4,$5,$6,$7) RETURNING *", [customerId,v.payment_status === 'paid' ? 'paid' : 'completed',v.currency,v.total,v.sale_date,v.due_date,v.notes]);
  const order = rows[0];
  await tx.query('INSERT INTO order_items(order_id,product_id,product_name_snapshot,quantity,unit_price,unit_cost) VALUES($1,$2,$3,$4,$5,$6)',[order.id,v.product_id,v.product_name_snapshot,v.quantity,v.unit_price,v.unit_cost]);
  if (v.payment_status === 'paid') await tx.query("INSERT INTO payments(order_id,amount,currency,method,status,payment_date) VALUES($1,$2,$3,$4,'succeeded',$5)",[order.id,v.total,v.currency,v.payment_method,v.sale_date]);
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
function calculateTotals(values) {
 const revenue = BigInt(values.revenue || 0), collected = BigInt(values.collected || 0), refunds = BigInt(values.refunds || 0), expenses = BigInt(values.expenses || 0), costs = BigInt(values.costs || 0);
 return { revenue:String(revenue), collected:String(collected), refunds:String(refunds), expenses:String(expenses), costOfGoodsSold:String(costs), grossProfit:String(revenue-costs-refunds), estimatedProfit:String(revenue-costs-refunds-expenses), missingCostItems:Number(values.missing_cost_items || 0) };
}
async function summary(db, f) {
 // Single SQL statement provides a consistent snapshot; aggregate separately to avoid join multiplication.
 const {rows} = await db.query(`SELECT
 (SELECT COALESCE(sum(total),0)::text FROM orders WHERE status IN ('completed','paid') AND currency=$1 AND sale_date BETWEEN $2 AND $3) revenue,
 (SELECT COALESCE(sum(amount),0)::text FROM payments WHERE status='succeeded' AND currency=$1 AND payment_date BETWEEN $2 AND $3) collected,
 (SELECT COALESCE(sum(amount),0)::text FROM refunds WHERE currency=$1 AND refund_date BETWEEN $2 AND $3) refunds,
 (SELECT COALESCE(sum(amount),0)::text FROM expenses WHERE currency=$1 AND expense_date BETWEEN $2 AND $3) expenses,
 (SELECT COALESCE(sum(i.unit_cost*i.quantity),0)::text FROM order_items i JOIN orders o ON o.id=i.order_id WHERE o.status IN ('completed','paid') AND o.currency=$1 AND o.sale_date BETWEEN $2 AND $3) costs,
 (SELECT count(*)::text FROM order_items i JOIN orders o ON o.id=i.order_id WHERE i.unit_cost IS NULL AND o.status IN ('completed','paid') AND o.currency=$1 AND o.sale_date BETWEEN $2 AND $3) missing_cost_items`,[f.currency,f.from,f.to]);
 return {currency:f.currency,from:f.from,to:f.to,...calculateTotals(rows[0])};
}
async function list(db, kind, f) {
 const params = [f.currency,f.from,f.to,f.offset];
 const sql = {
 orders: `SELECT o.*,c.name customer, (SELECT string_agg(i.product_name_snapshot,', ' ORDER BY i.created_at) FROM order_items i WHERE i.order_id=o.id) item,
 CASE WHEN COALESCE((SELECT sum(p.amount) FROM payments p WHERE p.order_id=o.id AND p.status='succeeded'),0)>=o.total THEN 'paid'
 WHEN EXISTS(SELECT 1 FROM payments p WHERE p.order_id=o.id AND p.status='succeeded') THEN 'partial' ELSE 'unpaid' END payment_status
 FROM orders o LEFT JOIN customers c ON c.id=o.customer_id WHERE o.currency=$1 AND o.sale_date BETWEEN $2 AND $3 ORDER BY o.sale_date DESC,o.created_at DESC,o.id LIMIT 100 OFFSET $4`,
 payments: 'SELECT * FROM payments WHERE currency=$1 AND payment_date BETWEEN $2 AND $3 ORDER BY payment_date DESC,created_at DESC,id LIMIT 100 OFFSET $4',
 expenses: 'SELECT * FROM expenses WHERE currency=$1 AND expense_date BETWEEN $2 AND $3 ORDER BY expense_date DESC,created_at DESC,id LIMIT 100 OFFSET $4'
 };
 return (await db.query(sql[kind],params)).rows;
}
module.exports = { audit, createSale, createExpense, summary, list, calculateTotals };
