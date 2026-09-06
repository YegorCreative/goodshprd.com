'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { requireFinanceOwner, requireCsrf, authRoute } = require('./auth');
const { HttpError, response, headers, json } = require('./http');
const finance = require('./finance');
const { filters } = require('./validation');
function createApp(db, options = {}) {
 return async req => {
  try {
   const pathname = new URL(req.url,'https://finance.invalid').pathname;
   if (pathname.startsWith('/api/auth/')) return await authRoute(req,db,pathname.slice('/api/auth/'.length));
   // The direct function URLs also reach this code: there is no unguarded HTML handler.
   if (pathname === '/admin/finance' || pathname === '/admin/finance/' || pathname === '/admin/finance/index.html' || pathname === '/api/finance-page' || pathname === '/.netlify/functions/finance-page') {
    const owner = await requireFinanceOwner(req,db);
    if (req.method !== 'GET') throw new HttpError(405,'Method not allowed');
    const html = (options.page || fs.readFileSync(path.join(process.cwd(),'admin/finance/index.html'),'utf8')).replace('{{CSRF_TOKEN}}',require('./auth').csrfToken(owner));
    return {status:200,headers:{...headers,'Content-Type':'text/html; charset=utf-8'},body:html};
   }
   const match = /^\/api\/admin\/finance\/(summary|orders|payments|expenses|reports)$/.exec(pathname);
   if (!match) throw new HttpError(404,'Not found');
   // Central guard is mandatory for every finance endpoint, before parsing/querying data.
   const owner = await requireFinanceOwner(req,db);
   const kind = match[1];
   if (req.method === 'GET') {
    const f = filters(req.url);
    return response(200,['summary','reports'].includes(kind) ? await finance.summary(db,f) : {records:await finance.list(db,kind,f),limit:100,offset:f.offset});
   }
   if (req.method === 'POST' && ['orders','expenses'].includes(kind)) {
    requireCsrf(req,owner);
    const key = req.headers['idempotency-key'];
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key || '')) throw new HttpError(400,'A UUID v4 Idempotency-Key is required');
    const record = await (kind === 'orders' ? finance.createSale : finance.createExpense)(db,owner.id,json(req),key);
    return response(201,record);
   }
   throw new HttpError(405,'Method not allowed');
  } catch (error) {
   const status = error instanceof HttpError ? error.status : 500;
   // Never send database/provider exceptions or financial payloads to the browser/logs.
   const result = response(status,{error:status === 500 ? 'Finance service unavailable' : error.message});
   if (status === 401 && ['/admin/finance','/admin/finance/','/admin/finance/index.html','/api/finance-page','/.netlify/functions/finance-page'].includes(new URL(req.url,'https://finance.invalid').pathname)) {
    result.headers['Content-Type'] = 'text/html; charset=utf-8';
    result.body = '<!doctype html><html lang="en"><meta charset="utf-8"><title>Finance sign in</title><h1>Good Shepherd Finance</h1><p>Owner sign-in required.</p><a href="/api/auth/login">Sign in with GitHub</a></html>';
   }
   return result;
  }
 };
}
module.exports = {createApp};
