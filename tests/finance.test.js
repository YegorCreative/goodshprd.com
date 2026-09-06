'use strict';
const {test,before,after,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
const {createApp}=require('../server/app');
const {digest,csrfToken,cookie}=require('../server/auth');
const {createSale,createExpense,summary,calculateTotals}=require('../server/finance');
const {processStripeEvent}=require('../server/stripe-events');
process.env.APP_ORIGIN='http://localhost:3000';process.env.SESSION_SECRET='test-only-secret-32-characters-minimum';process.env.FINANCE_OWNER_GITHUB_ID='12345';
let pg,db,app,owner,ownerToken,otherToken,csrf;
const filter={currency:'USD',from:'2026-01-01',to:'2026-12-31',offset:0};
const manual={customer:'A customer',product_name_snapshot:'Wool coat',quantity:2,unit_price:1050,unit_cost:400,currency:'USD',sale_date:'2026-09-06',payment_status:'paid',payment_method:'cash'};
const expense={category:'Supplies',description:'Thread',amount:125,currency:'USD',expense_date:'2026-09-06'};
function request(path,token,method='GET',body,extra={}){return app({url:path,method,body:Buffer.from(body===undefined?'':JSON.stringify(body)),headers:{cookie:token?cookie('session',token,28800).split(';')[0]:'','content-type':'application/json',origin:process.env.APP_ORIGIN,'x-csrf-token':csrf,'idempotency-key':require('node:crypto').randomUUID(),...extra}});}
before(async()=>{pg=new PGlite();await pg.exec(fs.readFileSync('db/migrations/001_finance.sql','utf8'));db={query:(s,p)=>pg.query(s,p),transaction:work=>pg.transaction(work)};app=createApp(db);});
after(async()=>{await pg.close();});
beforeEach(async()=>{
 await pg.exec('TRUNCATE audit_log,webhook_events,refunds,payments,order_items,orders,customers,expenses,sessions,users,oauth_states CASCADE');
 owner=(await db.query("INSERT INTO users(provider,provider_user_id) VALUES('github','12345') RETURNING *")).rows[0];
 const other=(await db.query("INSERT INTO users(provider,provider_user_id) VALUES('github','999') RETURNING *")).rows[0];
 ownerToken='a'.repeat(43);otherToken='b'.repeat(43);
 for(const [u,t] of [[owner,ownerToken],[other,otherToken]])await db.query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '1 hour')",[digest(t),u.id]);
 csrf=csrfToken({...owner,token_hash:digest(ownerToken)});
});
test('every finance GET and POST rejects logged-out and authenticated non-owner users',async()=>{
 for(const route of ['summary','orders','payments','expenses','reports'])for(const [token,status]of [[null,401],[otherToken,403]]){
  const r=await request('/api/admin/finance/'+route,token);assert.equal(r.status,status,route);assert.match(r.headers['Cache-Control'],/no-store/);assert.equal(JSON.parse(r.body).records,undefined);
 }
 for(const route of ['orders','expenses'])for(const [token,status]of [[null,401],[otherToken,403]])assert.equal((await request('/api/admin/finance/'+route,token,'POST',{})).status,status);
});
test('owner can access every finance GET endpoint',async()=>{for(const route of ['summary','orders','payments','expenses','reports'])assert.equal((await request('/api/admin/finance/'+route,ownerToken)).status,200);});
test('page and direct function paths require owner session',async()=>{
 for(const path of ['/admin/finance/','/admin/finance/index.html','/api/finance-page','/.netlify/functions/finance-page']){
  assert.equal((await request(path,null)).status,401);assert.equal((await request(path,otherToken)).status,403);
  const r=await request(path,ownerToken);assert.equal(r.status,200);assert.match(r.body,/Add manual sale/);assert.ok(!r.body.includes('{{CSRF_TOKEN}}'));
 }
});
test('expired and tampered sessions are rejected; owner allowlist changes take effect',async()=>{
 await db.query('UPDATE sessions SET expires_at=now()-interval \'1 second\' WHERE user_id=$1',[owner.id]);assert.equal((await request('/api/admin/finance/summary',ownerToken)).status,401);
 assert.equal((await request('/api/admin/finance/summary','c'.repeat(43))).status,401);
 process.env.FINANCE_OWNER_GITHUB_ID='777';assert.equal((await request('/api/admin/finance/summary',otherToken)).status,403);process.env.FINANCE_OWNER_GITHUB_ID='12345';
});
test('CSRF and foreign origins fail before mutations',async()=>{
 for(const headers of [{'x-csrf-token':''},{origin:'https://evil.example'},{'content-type':'text/plain'}])assert.ok([403,415].includes((await request('/api/admin/finance/orders',ownerToken,'POST',manual,headers)).status));
 assert.equal((await db.query('SELECT count(*) FROM orders')).rows[0].count,0);
});
test('manual sale creates customer, order, item, payment and audit atomically',async()=>{
 const res=await request('/api/admin/finance/orders',ownerToken,'POST',manual);assert.equal(res.status,201,res.body);
 const order=JSON.parse(res.body);assert.equal(order.total,2100);
 const items=(await db.query('SELECT * FROM order_items')).rows;assert.equal(items.length,1);assert.equal(items[0].unit_price,1050);assert.equal(items[0].unit_cost,400);assert.equal(items[0].quantity,2);
 assert.equal((await db.query('SELECT * FROM payments')).rows[0].amount,2100);assert.equal((await db.query('SELECT * FROM audit_log')).rows[0].actor_user_id,owner.id);
});
test('invalid sale creates nothing; audit failure rolls back all sale records',async()=>{
 for(const bad of [{unit_price:10.5},{quantity:0},{currency:'ZZZ'},{sale_date:'2026-02-30'},{unit_cost:-1}])assert.equal((await request('/api/admin/finance/orders',ownerToken,'POST',{...manual,...bad})).status,400);
 await assert.rejects(()=>createSale(db,'00000000-0000-0000-0000-000000000000',manual));
 assert.equal((await db.query('SELECT count(*) FROM orders')).rows[0].count,0);assert.equal((await db.query('SELECT count(*) FROM customers')).rows[0].count,0);
});
test('expense endpoint persists and audits; invalid amount rejected',async()=>{
 assert.equal((await request('/api/admin/finance/expenses',ownerToken,'POST',expense)).status,201);
 assert.equal((await db.query('SELECT * FROM expenses')).rows[0].amount,125);
 assert.equal((await db.query('SELECT * FROM audit_log')).rows[0].action,'expense.created');
 assert.equal((await request('/api/admin/finance/expenses',ownerToken,'POST',{...expense,amount:1.25})).status,400);
});
test('refunds reduce profit, not original revenue or gross collected payments',async()=>{
 await createSale(db,owner.id,manual);await createExpense(db,owner.id,expense);
 const p=(await db.query('SELECT * FROM payments')).rows[0];await db.query("INSERT INTO refunds(payment_id,amount,currency,refund_date) VALUES($1,300,'USD','2026-09-06')",[p.id]);
 const totals=await summary(db,filter);assert.equal(totals.revenue,'2100');assert.equal(totals.collected,'2100');assert.equal(totals.refunds,'300');assert.equal(totals.grossProfit,'1000');assert.equal(totals.estimatedProfit,'875');
 await assert.rejects(()=>db.query("INSERT INTO refunds(payment_id,amount,currency,refund_date) VALUES($1,1,'EUR','2026-09-06')",[p.id]));
});
test('missing costs are explicit; currencies and reporting dates stay separate',async()=>{
 await createSale(db,owner.id,{...manual,unit_cost:null,payment_status:'unpaid'});await createExpense(db,owner.id,{...expense,currency:'EUR'});
 const s=await summary(db,filter);assert.equal(s.missingCostItems,1);assert.equal(s.collected,'0');assert.equal(s.expenses,'0');assert.equal(s.revenue,'2100');
 assert.equal((await summary(db,{...filter,to:'2026-01-31'})).revenue,'0');
});
test('integer calculations preserve values beyond JavaScript safe integer range',()=>{
 const s=calculateTotals({revenue:'9007199254740993',collected:'17',refunds:'3',costs:'5',expenses:'7'});assert.equal(s.estimatedProfit,'9007199254740978');
 assert.equal(calculateTotals({revenue:30,costs:10,refunds:1,expenses:2}).estimatedProfit,'17');
});
function stripeFixture(){
 const created=Date.parse('2026-09-06T12:00:00Z')/1000;
 const intent={id:'pi_test',currency:'usd',status:'succeeded',amount:2100,amount_received:2100,created,latest_charge:'ch_test',customer:'cus_test'};
 const session={id:'cs_test',mode:'payment',status:'complete',currency:'usd',amount_total:2100,payment_intent:'pi_test',created,total_details:{amount_tax:0,amount_discount:0}};
 const refunds=[];let calls=0;
 const stripe={paymentIntents:{retrieve:async()=>{calls++;return intent;}},charges:{retrieve:async()=>({id:'ch_test',payment_intent:'pi_test',created})},refunds:{list:async function*(){yield* refunds;}},checkout:{sessions:{retrieve:async()=>session,listLineItems:async function*(){yield {quantity:2,amount_subtotal:2100,description:'Wool coat',price:{product:'prod_test'}};}}}};
 const event=(id,type='checkout.session.completed')=>({id,type,created,data:{object:{id:type.startsWith('checkout')?'cs_test':type==='charge.refunded'?'ch_test':'pi_test'}}});
 return {stripe,event,intent,session,refunds,created,calls:()=>calls};
}
test('duplicate Stripe webhook is processed once with one order/payment/audit',async()=>{
 const f=stripeFixture();await processStripeEvent(db,f.stripe,f.event('evt_1'));const duplicate=await processStripeEvent(db,f.stripe,f.event('evt_1'));
 assert.equal(duplicate.duplicate,true);assert.equal(f.calls(),1);
 for(const table of ['orders','payments','webhook_events','audit_log'])assert.equal((await db.query('SELECT count(*) FROM '+table)).rows[0].count,1,table);
});
test('payment-intent first, checkout later, and repeated refund events remain idempotent',async()=>{
 const f=stripeFixture();await processStripeEvent(db,f.stripe,f.event('evt_pi','payment_intent.succeeded'));await processStripeEvent(db,f.stripe,f.event('evt_cs'));
 assert.equal((await db.query('SELECT count(*) FROM orders')).rows[0].count,1);assert.equal((await db.query('SELECT count(*) FROM payments')).rows[0].count,1);
 const item=(await db.query('SELECT * FROM order_items')).rows[0];assert.equal(item.product_name_snapshot,'Wool coat');assert.equal(item.unit_cost,null);
 f.refunds.push({id:'re_1',status:'succeeded',amount:300,currency:'usd',created:f.created});
 await processStripeEvent(db,f.stripe,f.event('evt_refund','charge.refunded'));await processStripeEvent(db,f.stripe,f.event('evt_refund_2','charge.refunded'));
 assert.equal((await db.query('SELECT count(*) FROM refunds')).rows[0].count,1);assert.equal((await summary(db,filter)).estimatedProfit,'1800');
});
test('unpaid completed checkout is not revenue; expired event cannot regress paid order',async()=>{
 const f=stripeFixture();f.intent.status='requires_payment_method';f.intent.amount_received=0;
 await processStripeEvent(db,f.stripe,f.event('evt_pending'));assert.equal((await summary(db,filter)).revenue,'0');
 f.intent.status='succeeded';f.intent.amount_received=2100;
 await processStripeEvent(db,f.stripe,f.event('evt_paid','payment_intent.succeeded'));
 await processStripeEvent(db,f.stripe,f.event('evt_late','checkout.session.expired'));assert.equal((await db.query('SELECT status FROM orders')).rows[0].status,'paid');
});
test('failed webhook transaction rolls back event ID so retry can succeed',async()=>{
 const f=stripeFixture();const original=f.stripe.paymentIntents.retrieve;f.stripe.paymentIntents.retrieve=async()=>{throw Error('network failure');};
 await assert.rejects(()=>processStripeEvent(db,f.stripe,f.event('evt_retry')));assert.equal((await db.query('SELECT count(*) FROM webhook_events')).rows[0].count,0);
 f.stripe.paymentIntents.retrieve=original;await processStripeEvent(db,f.stripe,f.event('evt_retry'));assert.equal((await db.query('SELECT processed FROM webhook_events')).rows[0].processed,true);
});
test('logout revokes database session and clears cookie',async()=>{
 const res=await request('/api/auth/logout',ownerToken,'POST',{});assert.equal(res.status,200);assert.match(res.headers['Set-Cookie'][0],/Max-Age=0/);assert.equal((await request('/api/admin/finance/summary',ownerToken)).status,401);
});
test('production cookies are secure, HttpOnly, same-site and host-only',()=>{
 const old=process.env.APP_ORIGIN;process.env.APP_ORIGIN='https://example.com';const value=cookie('session','abc',28800);assert.match(value,/^__Host-finance_session=/);assert.match(value,/HttpOnly/);assert.match(value,/Secure/);assert.match(value,/SameSite=Lax/);assert.ok(!value.includes('Domain='));process.env.APP_ORIGIN=old;
});
test('OAuth rejects missing state and replay before external requests',async()=>{
 assert.equal((await request('/api/auth/callback?code=fake',null)).status,400);
 assert.equal((await request('/api/auth/callback?code=fake&state='+'a'.repeat(43),null,'GET',undefined,{cookie:'finance_oauth='+'a'.repeat(43)})).status,400);
});
test('manual mutation retries do not duplicate records and cannot change payload',async()=>{
 const key=require('node:crypto').randomUUID();const headers={'idempotency-key':key};
 const a=await request('/api/admin/finance/orders',ownerToken,'POST',manual,headers);
 const b=await request('/api/admin/finance/orders',ownerToken,'POST',manual,headers);
 assert.equal(a.status,201);assert.equal(JSON.parse(a.body).id,JSON.parse(b.body).id);
 assert.equal((await db.query('SELECT count(*) FROM orders')).rows[0].count,1);
 assert.equal((await request('/api/admin/finance/orders',ownerToken,'POST',{...manual,quantity:3},headers)).status,409);
});
test('OAuth code exchange validates immutable identity, rotates session and consumes state',async()=>{
 process.env.GITHUB_OAUTH_CLIENT_ID='test-client';process.env.GITHUB_OAUTH_CLIENT_SECRET='test-secret';
 const login=await request('/api/auth/login',null);assert.equal(login.status,302);
 const authUrl=new URL(login.headers.Location);assert.equal(authUrl.searchParams.get('scope'),'read:user');assert.equal(authUrl.searchParams.get('code_challenge_method'),'S256');
 const state=authUrl.searchParams.get('state'),oauthCookie=login.headers['Set-Cookie'][0].split(';')[0];
 const previous=global.fetch;let exchange;
 global.fetch=async(url,options)=>{
  if(url.includes('access_token')){exchange=JSON.parse(options.body);return {ok:true,json:async()=>({access_token:'never-send-to-browser'})};}
  return {ok:true,json:async()=>({id:12345,email:null})};
 };
 try {
  const callback='/api/auth/callback?code=test-code&state='+state;
  const r=await request(callback,ownerToken,'GET',undefined,{cookie:oauthCookie+'; '+cookie('session',ownerToken,60).split(';')[0]});
  assert.equal(r.status,302,r.body);assert.equal(r.headers.Location,'/admin/finance/');assert.equal(exchange.redirect_uri,'http://localhost:3000/api/auth/callback');
  assert.equal(require('node:crypto').createHash('sha256').update(exchange.code_verifier).digest('base64url'),authUrl.searchParams.get('code_challenge'));
  assert.ok(!JSON.stringify(r).includes('never-send-to-browser'));assert.equal((await request('/api/admin/finance/summary',ownerToken)).status,401);
  const newToken=r.headers['Set-Cookie'][0].split(';')[0].split('=')[1];assert.equal((await request('/api/admin/finance/summary',newToken)).status,200);
  assert.equal((await request(callback,null,'GET',undefined,{cookie:oauthCookie})).status,400);
 }finally{global.fetch=previous;}
});
test('webhook verifies exact raw bytes before any database access',async()=>{
 const {webhook}=require('../server/adapters');const sdk=require('stripe')('sk_test_placeholder');
 process.env.STRIPE_SECRET_KEY='sk_test_placeholder';process.env.STRIPE_WEBHOOK_SECRET='whsec_test_placeholder';
 const f=stripeFixture();f.stripe.webhooks=sdk.webhooks;
 const payload=JSON.stringify(f.event('evt_signed'));
 const sig=sdk.webhooks.generateTestHeaderString({payload,secret:process.env.STRIPE_WEBHOOK_SECRET});
 const req={method:'POST',headers:{'stripe-signature':sig},body:Buffer.from(payload)};
 assert.equal((await webhook({...req,body:Buffer.from(payload+' ')},{db,stripe:f.stripe})).status,400);
 assert.equal((await db.query('SELECT count(*) FROM webhook_events')).rows[0].count,0);
 assert.equal((await webhook(req,{db,stripe:f.stripe})).status,200);
});
test('Vercel and Netlify adapters preserve finance routing, auth, raw JSON and cookies',async()=>{
 const {vercel,netlify}=require('../server/adapters');const {Readable}=require('node:stream');
 const req=Readable.from([Buffer.from(JSON.stringify(expense))]);req.method='POST';req.url='/api/finance?finance_route=/api/admin/finance/expenses';req.headers={cookie:cookie('session',ownerToken,60).split(';')[0],'content-type':'application/json',origin:process.env.APP_ORIGIN,'x-csrf-token':csrf,'idempotency-key':require('node:crypto').randomUUID()};
 const res={headers:{},setHeader(k,v){this.headers[k]=v;},end(body){this.body=body;}};
 await vercel(false,{db})(req,res);assert.equal(res.statusCode,201,res.body);
 const get={httpMethod:'GET',path:'/.netlify/functions/finance',rawUrl:'http://localhost:3000/api/admin/finance/expenses',headers:{cookie:req.headers.cookie},body:null};
 const result=await netlify(false,{db})(get);assert.equal(result.statusCode,200);assert.equal(JSON.parse(result.body).records.length,1);
 assert.equal((await netlify(false,{db})({...get,headers:{}})).statusCode,401);
 const page=await netlify(false,{db})({...get,path:'/.netlify/functions/finance-page',rawUrl:undefined});assert.equal(page.statusCode,200);assert.match(page.body,/Add manual sale/);
});
