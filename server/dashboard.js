'use strict';
const v=require('./validation');
const {HttpError}=require('./http');
const {summary,calculateTotals,mutation,audit}=require('./finance');
const DAY=86400000;
function parseFilters(input={}) {
 if(!input || typeof input!=='object' || Array.isArray(input)) v.bad('Invalid filters');
 const f=v.filters('https://finance.invalid/?'+new URLSearchParams({currency:input.currency || 'USD',from:input.from || '1900-01-01',to:input.to || '9999-12-31',offset:input.offset || 0}));
 const pick=(field,allowed,fallback)=>{const value=input[field] || fallback;if(!allowed.includes(value))v.bad('Invalid '+field);return value;};
 return {...f,limit:50,sort:pick('sort',['date_desc','date_asc','amount_desc','amount_asc'],'date_desc'),payment_status:pick('payment_status',['all','paid','pending','partial','refunded','partially_refunded'],'all'),source:pick('source',['all','manual','stripe'],'all'),customer_id:input.customer_id?v.uuid(input.customer_id):null,customer:v.text(input.customer,'customer',200,true),category:v.text(input.category,'category',100,true),archived:input.archived===true,group:pick('group',['day','month'],'day')};
}
// Each order occurs once, regardless of item/payment/refund count.
const orderView=`SELECT o.*,to_char(o.sale_date,'YYYY-MM-DD') date,c.name customer,
 COALESCE(i.item,'Item details pending') item,COALESCE(i.quantity,0)::text quantity,
 COALESCE(i.cost,0)::text cost,COALESCE(i.missing_costs,0)::int missing_costs,
 COALESCE(p.collected,0)::text collected,COALESCE(r.refunded,0)::text refunded,
 CASE WHEN COALESCE(r.refunded,0)>0 AND r.refunded>=p.collected THEN 'refunded'
 WHEN COALESCE(r.refunded,0)>0 THEN 'partially_refunded'
 WHEN COALESCE(p.collected,0)>=o.total AND (o.total>0 OR o.status='paid') THEN 'paid'
 WHEN COALESCE(p.collected,0)>0 THEN 'partial' ELSE 'pending' END payment_status
 FROM orders o LEFT JOIN customers c ON c.id=o.customer_id
 LEFT JOIN (SELECT order_id,string_agg(product_name_snapshot,', ' ORDER BY created_at,id) item,sum(quantity) quantity,sum(unit_cost*quantity) cost,count(*) FILTER(WHERE unit_cost IS NULL) missing_costs FROM order_items GROUP BY order_id) i ON i.order_id=o.id
 LEFT JOIN (SELECT order_id,sum(amount) collected FROM payments WHERE status='succeeded' GROUP BY order_id) p ON p.order_id=o.id
 LEFT JOIN (SELECT p.order_id,sum(r.amount) refunded FROM refunds r JOIN payments p ON p.id=r.payment_id GROUP BY p.order_id) r ON r.order_id=o.id`;
function listQuery(kind,f,exporting=false) {
 const args=[f.currency,f.from,f.to];let sql,where;
 const add=value=>{args.push(value);return '$'+args.length;};
 if(kind==='orders') {
  sql=`SELECT * FROM (${orderView}) q`;where='currency=$1 AND sale_date BETWEEN $2 AND $3';
  if(f.payment_status && f.payment_status!=='all')where+=' AND payment_status='+add(f.payment_status);
  if(f.source && f.source!=='all')where+=' AND source='+add(f.source);
  if(f.customer_id)where+=' AND customer_id='+add(f.customer_id);
  if(f.customer)where+=" AND position(lower("+add(f.customer)+") in lower(COALESCE(customer,'')))>0";
 }else if(kind==='expenses') {
  sql="SELECT *,to_char(expense_date,'YYYY-MM-DD') date FROM expenses";where='currency=$1 AND expense_date BETWEEN $2 AND $3 AND deleted_at IS '+(f.archived?'NOT NULL':'NULL');
  if(f.category)where+=' AND category='+add(f.category);
 }else if(kind==='payments') {
  sql="SELECT p.*,to_char(p.payment_date,'YYYY-MM-DD') date,c.name customer FROM payments p JOIN orders o ON o.id=p.order_id LEFT JOIN customers c ON c.id=o.customer_id";
  where='p.currency=$1 AND p.payment_date BETWEEN $2 AND $3';
  if(f.customer_id)where+=' AND o.customer_id='+add(f.customer_id);
 }else if(kind==='refunds') {
  sql="SELECT r.*,to_char(r.refund_date,'YYYY-MM-DD') date,p.order_id,p.currency payment_currency,c.name customer FROM refunds r JOIN payments p ON p.id=r.payment_id JOIN orders o ON o.id=p.order_id LEFT JOIN customers c ON c.id=o.customer_id";
  where='r.currency=$1 AND r.refund_date BETWEEN $2 AND $3';
  if(f.customer_id)where+=' AND o.customer_id='+add(f.customer_id);
 }else throw new HttpError(400,'Invalid listing');
 const sort=f.sort || 'date_desc',amount=kind==='orders'?'total':'amount';
 const sortColumn=sort.startsWith('amount')?amount:'date';const direction=sort.endsWith('asc')?'ASC':'DESC';
 // Sort identifiers are chosen from constants only, never interpolated from request values.
 const tie=kind==='payments'?'p.id':kind==='refunds'?'r.id':kind==='orders'?'q.id':'id';
 const order=` ORDER BY ${sortColumn} ${direction},${tie}`;
 const countSql='SELECT count(*)::int total FROM ('+sql+' WHERE '+where+') count_rows';
 const dataArgs=[...args];const limit=exporting?10001:51;dataArgs.push(limit,exporting?0:f.offset || 0);
 return {sql:sql+' WHERE '+where+order+` LIMIT $${args.length+1} OFFSET $${args.length+2}`,args:dataArgs,countSql,countArgs:args};
}
async function listing(db,kind,f) {
 const q=listQuery(kind,f);const rows=(await db.query(q.sql,q.args)).rows;
 return {records:rows.slice(0,50),hasMore:rows.length>50,offset:f.offset || 0,limit:50};
}
async function overview(db,f) {
 const current=await summary(db,f);
 const start=Date.parse(f.from),end=Date.parse(f.to),length=Math.round((end-start)/DAY)+1;
 // No artificial comparison at the default all-time lower bound.
 const previousStart=new Date(start-length*DAY).toISOString().slice(0,10);
 if(previousStart<'1900-01-01')return {...current,previous:null,comparison:null};
 const previous=await summary(db,{...f,from:previousStart,to:new Date(start-DAY).toISOString().slice(0,10)});
 const comparison={};
 for(const key of ['revenue','collected','refunds','expenses','costOfGoodsSold','estimatedProfit']){
  const old=BigInt(previous[key]),now=BigInt(current[key]);
  // Integer rounding to tenths of a percent, omitted when the baseline is zero or negative.
  comparison[key]=old>0?String(((now-old)*1000n)/old):null;
 }
 return {...current,previous,comparison};
}
async function correctExpense(db,actor,body,key,deleting=false) {
 const id=v.uuid(body.id),reason=v.text(body.reason,'correction reason',1000),version=body.version;
 if(!Number.isInteger(version)||version<1)v.bad('Expense version required');
 if(deleting && body.confirmation!=='DELETE')v.bad('Explicit DELETE confirmation required');
 const value=deleting?null:v.expense(body);
 return mutation(db,actor,key,deleting?'expense.delete':'expense.edit',{id,reason,version,value},async tx=>{
  const before=(await tx.query('SELECT * FROM expenses WHERE id=$1 FOR UPDATE',[id])).rows[0];
  if(!before)throw new HttpError(404,'Expense not found');
  if(before.deleted_at || before.version!==version)throw new HttpError(409,'This expense changed. Reload before correcting it.');
  let after;
  if(deleting) after=(await tx.query('UPDATE expenses SET deleted_at=now(),deleted_by=$2,deletion_reason=$3,version=version+1,updated_at=now() WHERE id=$1 RETURNING *',[id,actor,reason])).rows[0];
  else after=(await tx.query('UPDATE expenses SET category=$2,description=$3,vendor=$4,amount=$5,currency=$6,expense_date=$7,payment_method=$8,notes=$9,version=version+1,updated_at=now() WHERE id=$1 RETURNING *',[id,value.category,value.description,value.vendor,value.amount,value.currency,value.expense_date,value.payment_method,value.notes])).rows[0];
  await audit(tx,actor,deleting?'expense.deleted':'expense.corrected','expense',id,{reason,before,after});
  return after;
 });
}
async function customers(db,f) {
 const args=[f.currency,f.from,f.to,f.customer || '',f.offset || 0];
 const {rows}=await db.query(`SELECT c.id,c.name,c.email,count(o.id)::int order_count,
 COALESCE(sum(o.total) FILTER(WHERE o.status IN ('completed','paid')),0)::text revenue,
 to_char(max(o.sale_date) FILTER(WHERE o.status IN ('completed','paid')),'YYYY-MM-DD') last_purchase
 FROM customers c LEFT JOIN orders o ON o.customer_id=c.id AND o.currency=$1 AND o.sale_date BETWEEN $2 AND $3
 WHERE position(lower($4) in lower(c.name || ' ' || COALESCE(c.email,'')))>0
 GROUP BY c.id ORDER BY c.name,c.id LIMIT 51 OFFSET $5`,args);
 return {records:rows.slice(0,50),hasMore:rows.length>50,offset:f.offset || 0,limit:50,currency:f.currency};
}
async function customerHistory(db,id,f) {
 v.uuid(id);const customer=(await db.query('SELECT id,name,email,phone,notes FROM customers WHERE id=$1',[id])).rows[0];
 if(!customer)throw new HttpError(404,'Customer not found');
 return {customer,orders:await listing(db,'orders',{...f,customer_id:id,customer:null}),payments:await listing(db,'payments',{...f,customer_id:id})};
}
async function reports(db,f) {
 // Bounded, server-aggregated buckets. Calendar gaps are generated server-side.
 const days=(Date.parse(f.to)-Date.parse(f.from))/DAY+1;
 if(days>(f.group==='month'?36600:1100))throw new HttpError(400,'Choose a shorter reporting range or monthly grouping');
 const unit=f.group==='month'?'month':'day';
 const params=[f.currency,f.from,f.to];
 const {rows}=await db.query(`WITH
 buckets AS (SELECT generate_series(date_trunc('${unit}',$2::date::timestamp),date_trunc('${unit}',$3::date::timestamp),'1 ${unit}'::interval) bucket),
 sales AS (SELECT date_trunc('${unit}',sale_date) bucket,sum(total) revenue FROM orders WHERE currency=$1 AND sale_date BETWEEN $2 AND $3 AND status IN ('completed','paid') GROUP BY 1),
 costs AS (SELECT date_trunc('${unit}',o.sale_date) bucket,sum(i.unit_cost*i.quantity) costs,count(*) FILTER(WHERE i.unit_cost IS NULL) missing_cost_items FROM order_items i JOIN orders o ON o.id=i.order_id WHERE o.currency=$1 AND o.sale_date BETWEEN $2 AND $3 AND o.status IN ('completed','paid') GROUP BY 1),
 refunded AS (SELECT date_trunc('${unit}',refund_date) bucket,sum(amount) refunds FROM refunds WHERE currency=$1 AND refund_date BETWEEN $2 AND $3 GROUP BY 1),
 spent AS (SELECT date_trunc('${unit}',expense_date) bucket,sum(amount) expenses FROM expenses WHERE deleted_at IS NULL AND currency=$1 AND expense_date BETWEEN $2 AND $3 GROUP BY 1)
 SELECT to_char(b.bucket,'YYYY-MM-DD') date,COALESCE(s.revenue,0)::text revenue,COALESCE(c.costs,0)::text costs,COALESCE(c.missing_cost_items,0)::int missing_cost_items,COALESCE(r.refunds,0)::text refunds,COALESCE(e.expenses,0)::text expenses
 FROM buckets b LEFT JOIN sales s USING(bucket) LEFT JOIN costs c USING(bucket) LEFT JOIN refunded r USING(bucket) LEFT JOIN spent e USING(bucket) ORDER BY b.bucket`,params);
 const categories=(await db.query("SELECT category,sum(amount)::text amount FROM expenses WHERE deleted_at IS NULL AND currency=$1 AND expense_date BETWEEN $2 AND $3 GROUP BY category ORDER BY sum(amount) DESC,category",params)).rows;
 const statuses=(await db.query(`SELECT payment_status,count(*)::int count,sum(total)::text amount FROM (${orderView}) q WHERE currency=$1 AND sale_date BETWEEN $2 AND $3 GROUP BY payment_status ORDER BY payment_status`,params)).rows;
 return {currency:f.currency,from:f.from,to:f.to,group:unit,totals:await summary(db,f),series:rows.map(row=>({date:row.date,...calculateTotals(row)})),categories,statuses};
}
module.exports={parseFilters,listing,overview,correctExpense,customers,customerHistory,reports,listQuery};
