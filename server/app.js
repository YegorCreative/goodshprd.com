'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { requireFinanceOwner, requireCsrf, authRoute } = require('./auth');
const { HttpError, response, headers, json } = require('./http');
const finance = require('./finance');
const dashboard = require('./dashboard');
const {exportCsv} = require('./csv');
function createApp(db, options = {}) {
 return async req => {
  try {
   const pathname = new URL(req.url,'https://finance.invalid').pathname;
   if (pathname.startsWith('/api/auth/')) return await authRoute(req,db,pathname.slice('/api/auth/'.length));
   // The direct function URLs also reach this code: there is no unguarded HTML handler.
   if (pathname === '/admin' || pathname === '/admin/' || pathname === '/api/admin' || pathname === '/.netlify/functions/admin' || pathname === '/admin/finance' || pathname === '/admin/finance/' || pathname === '/admin/finance/index.html' || pathname === '/api/finance-page' || pathname === '/.netlify/functions/finance-page') {
    const owner = await requireFinanceOwner(req,db);
    if (req.method !== 'GET') throw new HttpError(405,'Method not allowed');
    const gateway=pathname==='/admin'||pathname==='/admin/'||pathname==='/api/admin'||pathname==='/.netlify/functions/admin';
    const html = (options.page || fs.readFileSync(path.join(process.cwd(),gateway?'admin/gateway.html':'admin/finance/index.html'),'utf8')).replace('{{CSRF_TOKEN}}',require('./auth').csrfToken(owner));
    return {status:200,headers:{...headers,'Content-Type':'text/html; charset=utf-8'},body:html};
   }
   const match = /^\/api\/admin\/finance\/(summary|orders|payments|expenses|reports|customers|customer-history|products|product-costs|order-detail|query|export|refunds)$/.exec(pathname);
   if (!match) throw new HttpError(404,'Not found');
   // Central guard is mandatory for every finance endpoint, before parsing/querying data.
   const owner = await requireFinanceOwner(req,db);
   const kind = match[1];
   async function read(resource,input={}) {
    const f=dashboard.parseFilters(input);
    if(resource==='products')return {records:await require('./products').productsWithCosts(db)};
    if(resource==='summary')return snapshot(tx=>dashboard.overview(tx,f));
    if(resource==='reports')return snapshot(tx=>dashboard.reports(tx,f));
    if(resource==='customers')return dashboard.customers(db,f);
    if(['orders','payments','expenses'].includes(resource))return dashboard.listing(db,resource,f);
    throw new HttpError(400,'Unknown query resource');
   }
   async function snapshot(work) {
    return db.transaction(async tx=>{await tx.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');return work(tx);});
   }
   if(req.method==='GET') {
    const input=Object.fromEntries(new URL(req.url,'https://finance.invalid').searchParams);
    if(kind==='reports' && !input.from && !input.to){const today=new Date().toISOString().slice(0,10);input.from=today.slice(0,7)+'-01';input.to=today;}
    return response(200,await read(kind,input));
   }
   requireCsrf(req,owner);
   const body=json(req);
   if(req.method==='POST' && kind==='query')return response(200,await read(body.resource,body.filters));
   if(req.method==='POST' && kind==='customer-history')return response(200,await snapshot(tx=>dashboard.customerHistory(tx,body.customer_id,dashboard.parseFilters(body.filters))));
   if(req.method==='POST' && kind==='order-detail')return response(200,await finance.orderDetail(db,body.order_id));
   if(req.method==='POST' && kind==='export') {
    const csv=await exportCsv(db,body.resource,dashboard.parseFilters(body.filters));
    return {status:200,headers:{...headers,'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="finance-${body.resource}.csv"`},body:csv};
   }
   if(req.method==='POST' && ['payments','refunds','product-costs'].includes(kind)) {
    const key=req.headers['idempotency-key'];
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key || '')) throw new HttpError(400,'A UUID v4 Idempotency-Key is required');
    if(kind==='payments') return response(201,await finance.recordPayment(db,owner.id,body,key));
    if(kind==='refunds') return response(201,await finance.createRefund(db,owner.id,body,key,options.stripe));
    return response(200,await finance.productCost(db,owner.id,body,key));
   }
   if ((req.method==='POST' && ['orders','expenses'].includes(kind)) || (['PATCH','DELETE'].includes(req.method) && kind==='expenses')) {
    const key = req.headers['idempotency-key'];
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key || '')) throw new HttpError(400,'A UUID v4 Idempotency-Key is required');
    if(req.method!=='POST')return response(200,await dashboard.correctExpense(db,owner.id,body,key,req.method==='DELETE'));
    const record=await (kind==='orders'?finance.createSale:finance.createExpense)(db,owner.id,body,key);
    return response(201,record);
   }
   throw new HttpError(405,'Method not allowed');
  } catch (error) {
   const status = error instanceof HttpError ? error.status : 500;
   // Never send database/provider exceptions or financial payloads to the browser/logs.
   const result = response(status,{error:status === 500 ? 'Finance service unavailable' : error.message});
   if (status === 401 && ['/admin','/admin/','/api/admin','/.netlify/functions/admin','/admin/finance','/admin/finance/','/admin/finance/index.html','/api/finance-page','/.netlify/functions/finance-page'].includes(new URL(req.url,'https://finance.invalid').pathname)) {
    result.headers['Content-Type'] = 'text/html; charset=utf-8';
    result.body = '<!doctype html><html lang="en"><meta charset="utf-8"><title>Finance sign in</title><h1>Good Shepherd Finance</h1><p>Owner sign-in required.</p><a href="/api/auth/login">Sign in with GitHub</a></html>';
   }
   return result;
  }
 };
}
module.exports = {createApp};
