'use strict';
const {response} = require('./http');
const {database} = require('./db');
const {createApp} = require('./app');
const {processStripeEvent} = require('./stripe-events');
async function webhook(req, dependencies = {}) {
 if (req.method !== 'POST') return response(405,{error:'Method not allowed'});
 if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) return response(503,{error:'Webhook not configured'});
 const stripe = dependencies.stripe || require('stripe')(process.env.STRIPE_SECRET_KEY);
 let event;
 try { event = stripe.webhooks.constructEvent(req.body,req.headers['stripe-signature'],process.env.STRIPE_WEBHOOK_SECRET); }
 catch { return response(400,{error:'Invalid signature'}); }
 try { return response(200,await processStripeEvent(dependencies.db || database(),stripe,event)); }
 catch { return response(500,{error:'Webhook processing failed'}); }
}
async function dispatch(req,isWebhook,dependencies = {}) {
 if (req.body.length > (isWebhook ? 1048576 : 16384)) return response(413,{error:'Request too large'});
 try {
  const url = new URL(req.url,'https://finance.invalid');
  const route = url.searchParams.get('finance_route');
  if (route && /^\/api\/(auth\/[a-z]+|admin\/finance\/[a-z]+)$/.test(route)) { url.searchParams.delete('finance_route'); req.url = route + url.search; }
  return isWebhook ? await webhook(req,dependencies) : await createApp(dependencies.db || database())(req);
 }
 catch { return response(503,{error:'Service not configured'}); }
}
function vercel(isWebhook = false, dependencies = {}) {
 return async (req,res) => {
  let body;
  try {
   body = await new Promise((resolve,reject) => {
    const chunks=[];let size=0;
    req.on('data',chunk=>{size+=Buffer.byteLength(chunk);if(size>(isWebhook ? 1048576 : 16384)) reject(Error('too large'));else chunks.push(Buffer.from(chunk));});
    req.on('end',()=>resolve(Buffer.concat(chunks)));req.on('error',reject);
   });
  } catch {
   const r=response(413,{error:'Request body unavailable or too large'});
   for(const [k,v] of Object.entries(r.headers)) res.setHeader(k,v);
   res.statusCode=r.status;res.end(r.body);return;
  }
  const result = await dispatch({method:req.method,url:req.url,headers:req.headers,body},isWebhook,dependencies);
  for (const [key,value] of Object.entries(result.headers)) res.setHeader(key,value);
  res.statusCode=result.status;res.end(result.body);
 };
}
function netlify(isWebhook = false, dependencies = {}) {
 return async event => {
  const result = await dispatch({method:event.httpMethod,url:event.rawUrl || event.path,headers:Object.fromEntries(Object.entries(event.headers || {}).map(([k,v])=>[k.toLowerCase(),v])),body:Buffer.from(event.body || '',event.isBase64Encoded ? 'base64':'utf8')},isWebhook,dependencies);
  const headers={...result.headers};const cookies=headers['Set-Cookie'];delete headers['Set-Cookie'];
  return {statusCode:result.status,headers,body:result.body,...(cookies ? {multiValueHeaders:{'Set-Cookie':cookies}} : {})};
 };
}
module.exports={vercel,netlify,webhook};
