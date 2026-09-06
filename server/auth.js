'use strict';
const crypto = require('node:crypto');
const { HttpError, response, redirect } = require('./http');
const random = () => crypto.randomBytes(32).toString('base64url');
function config() {
 const origin = new URL(process.env.APP_ORIGIN || '');
 if (origin.pathname !== '/' || origin.search || origin.hash || origin.username || origin.password) throw Error('Invalid APP_ORIGIN');
 const local = ['localhost','127.0.0.1'].includes(origin.hostname) && process.env.NODE_ENV !== 'production';
 if (origin.protocol !== 'https:' && !(local && origin.protocol === 'http:')) throw Error('HTTPS required');
 if (!/^\d+$/.test(process.env.FINANCE_OWNER_GITHUB_ID || '') || (process.env.SESSION_SECRET || '').length < 32) throw Error('Auth not configured');
 return { origin: origin.origin, secure: origin.protocol === 'https:', owner: process.env.FINANCE_OWNER_GITHUB_ID };
}
function digest(value) { return crypto.createHmac('sha256', process.env.SESSION_SECRET).update(value).digest('hex'); }
function cookies(req) { return Object.fromEntries((req.headers.cookie || '').split(';').map(s => s.trim().split('=')).filter(p => p.length === 2)); }
function name(kind) { return (config().secure ? '__Host-' : '') + 'finance_' + kind; }
function cookie(kind, value, age) { return `${name(kind)}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${config().secure ? '; Secure' : ''}`; }
function token(req) { const value = cookies(req)[name('session')]; return /^[A-Za-z0-9_-]{43}$/.test(value || '') ? value : null; }
async function requireSession(req, db) {
 const value = token(req);
 if (!value) throw new HttpError(401, 'Authentication required');
 const { rows } = await db.query('SELECT u.*, s.token_hash FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at > now()', [digest(value)]);
 if (!rows[0]) throw new HttpError(401, 'Authentication required');
 return rows[0];
}
async function requireFinanceOwner(req, db) {
 const user = await requireSession(req, db);
 if (user.provider !== 'github' || user.provider_user_id !== config().owner) throw new HttpError(403, 'Owner access required');
 return user;
}
function csrfToken(user) { return digest('csrf:' + user.token_hash); }
function requireCsrf(req, user) {
 const supplied = req.headers['x-csrf-token'] || '';
 if (req.headers.origin !== config().origin || ! /^[0-9a-f]{64}$/.test(supplied) || !crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(csrfToken(user)))) throw new HttpError(403, 'Invalid CSRF token or origin');
}
async function authRoute(req, db, action) {
 const cfg = config();
 if (action === 'login' && req.method === 'GET') {
  const state = random(), verifier = random();
  await db.query('DELETE FROM oauth_states WHERE expires_at < now()');
  await db.query("INSERT INTO oauth_states(state_hash,verifier,expires_at) VALUES($1,$2,now()+interval '10 minutes')", [digest(state), verifier]);
  const url = new URL('https://github.com/login/oauth/authorize');
  url.search = new URLSearchParams({ client_id: process.env.GITHUB_OAUTH_CLIENT_ID, redirect_uri: cfg.origin + '/api/auth/callback', state, scope: 'read:user', code_challenge: crypto.createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256', allow_signup: 'false' }).toString();
  return redirect(url.href, [cookie('oauth', state, 600)]);
 }
 if (action === 'callback' && req.method === 'GET') {
  const url = new URL(req.url, cfg.origin), state = url.searchParams.get('state'), code = url.searchParams.get('code');
  if (!state || !/^[A-Za-z0-9_-]{43}$/.test(state) || state !== cookies(req)[name('oauth')] || !code || code.length > 512) throw new HttpError(400, 'Invalid OAuth callback');
  const { rows } = await db.query('DELETE FROM oauth_states WHERE state_hash=$1 AND expires_at > now() RETURNING verifier', [digest(state)]);
  if (!rows[0]) throw new HttpError(400, 'Expired OAuth login');
  const exchange = await fetch('https://github.com/login/oauth/access_token', { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify({ client_id: process.env.GITHUB_OAUTH_CLIENT_ID, client_secret: process.env.GITHUB_OAUTH_CLIENT_SECRET, code, redirect_uri: cfg.origin + '/api/auth/callback', code_verifier: rows[0].verifier }), signal: AbortSignal.timeout(10000) });
  const credentials = await exchange.json();
  if (!exchange.ok || !credentials.access_token) throw new HttpError(400, 'GitHub login failed');
  const profileResponse = await fetch('https://api.github.com/user', { headers: { Authorization: `Bearer ${credentials.access_token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'GoodShepherdFinance' }, signal: AbortSignal.timeout(10000) });
  const profile = await profileResponse.json();
  if (!profileResponse.ok || !Number.isSafeInteger(profile.id)) throw new HttpError(400, 'GitHub identity unavailable');
  const session = random();
  await db.transaction(async tx => {
   const result = await tx.query("INSERT INTO users(provider,provider_user_id,email) VALUES('github',$1,$2) ON CONFLICT(provider,provider_user_id) DO UPDATE SET email=EXCLUDED.email,updated_at=now() RETURNING id", [String(profile.id), typeof profile.email === 'string' ? profile.email : null]);
   const old = token(req);
   if (old) await tx.query('DELETE FROM sessions WHERE token_hash=$1', [digest(old)]);
   await tx.query('DELETE FROM sessions WHERE expires_at < now()');
   await tx.query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '8 hours')", [digest(session), result.rows[0].id]);
  });
  return redirect('/admin/finance/', [cookie('session', session, 28800), cookie('oauth', '', 0)]);
 }
 if (action === 'me' && req.method === 'GET') {
  const user = await requireSession(req, db);
  return response(200, { csrfToken: csrfToken(user), owner: user.provider === 'github' && user.provider_user_id === cfg.owner });
 }
 if (action === 'logout' && req.method === 'POST') {
  const user = await requireSession(req, db); requireCsrf(req, user);
  await db.query('DELETE FROM sessions WHERE token_hash=$1', [user.token_hash]);
  return response(200, { loggedOut: true }, { 'Set-Cookie': [cookie('session','',0)] });
 }
 throw new HttpError(405, 'Method not allowed');
}
module.exports = { requireFinanceOwner, requireCsrf, authRoute, config, digest, csrfToken, cookie };
