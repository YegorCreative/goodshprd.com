'use strict';
const {listQuery}=require('./dashboard');
const {currencies}=require('./validation');
const {HttpError}=require('./http');
function decimal(amount,currency) {
 const n=BigInt(amount),places=currencies[currency],scale=10n**BigInt(places),abs=n<0n?-n:n;
 return (n<0n?'-':'')+String(abs/scale)+(places?'.'+String(abs%scale).padStart(places,'0'):'');
}
function cell(value) {
 let text=String(value ?? '');
 // Spreadsheet formula injection protection, including whitespace/control prefixes.
 if(/^[\s]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text))text="'"+text;
 return '"'+text.replace(/"/g,'""')+'"';
}
async function exportCsv(db,kind,f) {
 if(!['orders','expenses','payments','refunds'].includes(kind))throw new HttpError(400,'Unknown export');
 const query=listQuery(kind,f,true);const records=(await db.query(query.sql,query.args)).rows;
 if(records.length>10000)throw new HttpError(413,'Export exceeds 10,000 rows. Narrow the date range or filters.');
 const fields={
 orders:[['Date',r=>r.date],['Order ID',r=>r.id],['Customer',r=>r.customer],['Item',r=>r.item],['Quantity',r=>r.quantity],['Currency',r=>r.currency],['Sale total',r=>decimal(r.total,r.currency)],['Known cost',r=>decimal(r.cost,r.currency)],['Missing cost items',r=>r.missing_costs],['Collected',r=>decimal(r.collected,r.currency)],['Refunded',r=>decimal(r.refunded,r.currency)],['Payment status',r=>r.payment_status],['Source',r=>r.source],['Notes',r=>r.notes]],
 expenses:[['Date',r=>r.date],['Expense ID',r=>r.id],['Category',r=>r.category],['Description',r=>r.description],['Vendor',r=>r.vendor],['Currency',r=>r.currency],['Amount',r=>decimal(r.amount,r.currency)],['Payment method',r=>r.payment_method],['Notes',r=>r.notes],['Revision',r=>r.version],['Archived',r=>r.deleted_at?'yes':'no'],['Deletion reason',r=>r.deletion_reason]],
 payments:[['Date',r=>r.date],['Payment ID',r=>r.id],['Order ID',r=>r.order_id],['Customer',r=>r.customer],['Currency',r=>r.currency],['Amount',r=>decimal(r.amount,r.currency)],['Method',r=>r.method],['Status',r=>r.status],['Stripe payment intent',r=>r.stripe_payment_intent_id]],
 refunds:[['Date',r=>r.date],['Refund ID',r=>r.id],['Payment ID',r=>r.payment_id],['Order ID',r=>r.order_id],['Customer',r=>r.customer],['Currency',r=>r.currency],['Amount',r=>decimal(r.amount,r.currency)],['Reason',r=>r.reason],['Stripe refund',r=>r.stripe_refund_id],['Notes',r=>r.notes]]
 }[kind];
 return '\uFEFF'+[fields.map(([title])=>cell(title)).join(','),...records.map(record=>fields.map(([,value])=>cell(value(record))).join(','))].join('\r\n')+'\r\n';
}
module.exports={exportCsv,decimal,cell};
