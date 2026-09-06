'use strict';
class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
const headers = {
 'Cache-Control': 'private, no-store, max-age=0', 'CDN-Cache-Control': 'no-store', 'Vercel-CDN-Cache-Control': 'no-store',
 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY',
 'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; font-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"
};
function response(status, data, extra = {}) { return { status, headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8', ...extra }, body: JSON.stringify(data) }; }
function redirect(location, cookies) { return { status: 302, headers: { ...headers, Location: location, ...(cookies ? { 'Set-Cookie': cookies } : {}) }, body: '' }; }
function json(req) {
 if (!(req.headers['content-type'] || '').startsWith('application/json')) throw new HttpError(415, 'Use application/json');
 if (req.body.length > 16384) throw new HttpError(413, 'Request too large');
 try { const value = JSON.parse(req.body.toString()); if (!value || Array.isArray(value) || typeof value !== 'object') throw Error(); return value; }
 catch { throw new HttpError(400, 'Invalid JSON object'); }
}
module.exports = { HttpError, headers, response, redirect, json };
