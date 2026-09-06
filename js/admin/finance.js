'use strict';
const csrf = document.querySelector('meta[name="csrf-token"]').content;
const exponents = {USD:2,CAD:2,EUR:2,GBP:2,AUD:2,JPY:0,KWD:3};
const today = new Date();
const localDate = new Date(today.getTime()-today.getTimezoneOffset()*60000).toISOString().slice(0,10);
const filters = document.getElementById('filters');
filters.elements.from.value = localDate.slice(0,7)+'-01';filters.elements.to.value = localDate;
for(const input of document.querySelectorAll('input[type="date"]')) if(!input.value) input.value=localDate;
function minor(value,currency) {
 const exponent=exponents[currency];
 if(!new RegExp('^\\d+(?:\\.\\d{1,'+Math.max(exponent,1)+'})?$').test(value) || (exponent===0 && value.includes('.'))) throw Error('Enter an amount with the correct decimal places for '+currency);
 const [whole,fraction='']=value.split('.');const result=BigInt(whole)*10n**BigInt(exponent)+BigInt(fraction.padEnd(exponent,'0') || '0');
 if(result>100000000000n) throw Error('Amount is too large');return Number(result);
}
function money(value,currency) {
 const n=BigInt(value),scale=10n**BigInt(exponents[currency]);const abs=n<0n?-n:n;
 return `${currency} ${n<0n?'-':''}${(abs/scale).toLocaleString()}${exponents[currency]?'.'+String(abs%scale).padStart(exponents[currency],'0'):''}`;
}
async function api(path,options={}) {
 const res=await fetch(path,{...options,credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf,...options.headers}});
 if(res.status===401){location.assign('/admin/finance/');throw Error('Session expired');}
 const data=await res.json();if(!res.ok) throw Error(data.error || 'Request failed');return data;
}
function rows(id,records,columns) {
 const body=document.getElementById(id);body.replaceChildren();
 if(!records.length){const tr=body.insertRow(),cell=tr.insertCell();cell.colSpan=columns.length;cell.textContent='No records in this period.';return;}
 for(const record of records){const tr=body.insertRow();for(const column of columns) tr.insertCell().textContent=column(record) || '—';}
}
async function refresh() {
 const status=document.getElementById('status');status.textContent='Loading…';
 try {
  const query=new URLSearchParams(new FormData(filters));
  const [summary,sales,expenses]=await Promise.all(['summary','orders','expenses'].map(route=>api('/api/admin/finance/'+route+'?'+query)));
  for(const key of ['revenue','collected','refunds','expenses','estimatedProfit']) document.getElementById(key).textContent=money(summary[key],summary.currency);
  document.getElementById('cost-warning').textContent=summary.missingCostItems ? `${summary.missingCostItems} sale item(s) have unknown costs. Estimated profit is incomplete.` : 'Profit uses recorded costs and expenses. Check that all costs and fees have been entered.';
  rows('sales',sales.records,[r=>r.sale_date.slice(0,10),r=>r.customer,r=>r.item,r=>money(r.total,r.currency),r=>r.payment_status,r=>r.source]);
  rows('expense-rows',expenses.records,[r=>r.expense_date.slice(0,10),r=>r.category,r=>r.description,r=>money(r.amount,r.currency)]);
  status.textContent=`${summary.currency} · ${summary.from} through ${summary.to}`;
 }catch(error){status.textContent=error.message;}
}
filters.addEventListener('submit',event=>{event.preventDefault();refresh();});
for(const [id,resource] of [['sale-form','orders'],['expense-form','expenses']]) {
 const form=document.getElementById(id);let requestKey=crypto.randomUUID();
 form.addEventListener('submit',async event=>{
  event.preventDefault();const button=form.querySelector('button'),message=form.querySelector('.form-message');button.disabled=true;message.textContent='Saving…';
  try {
   const body=Object.fromEntries(new FormData(form));
   if(resource==='orders'){body.unit_price=minor(body.unit_price,body.currency);body.unit_cost=body.unit_cost.trim()===''?null:minor(body.unit_cost,body.currency);body.quantity=Number(body.quantity);}
   else body.amount=minor(body.amount,body.currency);
   await api('/api/admin/finance/'+resource,{method:'POST',body:JSON.stringify(body),headers:{'Idempotency-Key':requestKey}});
   requestKey=crypto.randomUUID();form.reset();for(const input of form.querySelectorAll('input[type="date"]'))input.value=localDate;
   message.textContent='Saved. Records outside the selected dates or currency will not appear above.';await refresh();
  }catch(error){message.textContent=error.message+' If the connection was interrupted, refresh and check recent records before submitting again.';}finally{button.disabled=false;}
 });
}
document.getElementById('logout').addEventListener('click',async()=>{try{await api('/api/auth/logout',{method:'POST',body:'{}'});location.assign('/admin/finance/');}catch(error){document.getElementById('status').textContent=error.message;}});
refresh();
