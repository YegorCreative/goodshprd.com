# Good Shepherd Finance foundation

This implementation adds an owner-only `/admin/finance/` page and relational financial records. It does not replace Decap or redesign the storefront. It has been tested locally; production OAuth, PostgreSQL connectivity/TLS, platform rewrites, and real Stripe delivery still require staging verification.

## Architecture and files

- `server/auth.js`: GitHub OAuth authorization-code flow with PKCE and single-use state, opaque database sessions, `requireFinanceOwner()`, CSRF and logout.
- `server/app.js`: guarded page and finance API router. Every finance endpoint passes through `requireFinanceOwner()` before data access.
- `server/db.js`: PostgreSQL pool and transaction wrapper using `pg`.
- `server/finance.js`: validated transactional sale/expense mutations, idempotency, audit records, reports and exact integer calculations.
- `server/validation.js`: bounded input, dates, currencies and integer minor units.
- `server/stripe-events.js`: verified-event reconciliation, provider IDs, transactional deduplication and payment locking.
- `server/adapters.js`: Vercel/Netlify adapters, raw-body signature verification, no private caching.
- `admin/finance/index.html`, `css/admin.css`, `js/admin/finance.js`: protected dashboard template and public code/style assets. No financial records or secrets live in those assets.
- `db/migrations/001_finance.sql`: initial PostgreSQL schema.
- `scripts/migrate.js`: explicitly invoked, transactionally tracked migrations with an advisory lock.
- `scripts/build.js`: allowlisted public build. The Finance HTML is **not** copied into `dist`.
- `api/finance.js`, `api/finance-page.js`, `api/webhook.js`: Vercel adapters.
- `netlify/functions/finance.js`, `finance-page.js`, `webhook.js`: Netlify adapters.
- `tests/finance.test.js`, `tests/build.test.js`: Node test runner with PGlite (isolated PostgreSQL engine, no external database required).

PostgreSQL is selected because the project already has Node serverless functions, financial mutations require relational constraints/transactions, and `pg` works with managed PostgreSQL without committing to a provider-specific browser SDK. Use a managed service's pooled PostgreSQL endpoint and certificate-verifying TLS; no database credentials belong in browser code. Production and preview deployments must have separate databases and Stripe test/live credentials.

## Before deploying

1. Choose **one** production serverless host: Netlify or Vercel. Connect the repository and configure Node 22, `npm run build`, and `dist` as the public output. Keep the function directory outside `dist`.
2. The old GitHub Pages workflows are retained but now require repository variable `ENABLE_LEGACY_PAGES=true` to run. Do **not** enable both or enable them for the production Finance host. Pages alone cannot serve protected Finance; the allowlisted Pages artifact deliberately omits the Finance page. Coordinate the hosting/DNS cutover with Yegor before publishing these changes. Do not serve the repository root through a production static server.
3. Provision a private managed PostgreSQL database. Enable backups, restrict administrative access, and use a least-privileged runtime user. If your provider has an automatic public REST API, do not grant browser/anonymous roles access to Finance tables. Use an administrative connection only when applying schema changes.
4. Create a **dedicated Finance GitHub OAuth application**, separate from Decap's repository-writing OAuth app. Callback: `https://YOUR_HOST/api/auth/callback`. The implementation requests only `read:user`, exchanges the code on the server, reads `/user`, then discards the access token. It never requests repository access.
5. Set the environment variables below. Obtain the owner's numeric GitHub `id` from GitHub's user API/account information; do not use a login, display name, repository role, or email as the identity.
6. With the target `DATABASE_URL` securely loaded into your shell, run `npm ci`, then `npm run migrate`. Migrations are never run by the build or a public endpoint. They run inside a transaction and record applied filenames in `schema_migrations`.
7. Deploy to staging first. Visit `/admin/finance/`, sign in, and verify the owner dashboard. Test a different GitHub account and a repository collaborator: both must get 403. Logged-out API requests must get 401. Check the explicit `/admin/finance/index.html` and direct function URLs as well.
8. In Stripe, configure `POST https://YOUR_HOST/api/webhook` for `checkout.session.completed`, `checkout.session.expired`, `payment_intent.succeeded`, `charge.refunded`, and `refund.updated`. Set that endpoint's signing secret. Test signatures, retries, refunds, and out-of-order delivery with test-mode events before using live payments.
9. On the deployed host, confirm private/no-store headers, HTTPS Secure/HttpOnly cookies, rejection of cross-origin POSTs, logout revocation, and the absence of Finance HTML/backend/env files in the public artifact. Verify the storefront and Decap still load.

No cloud database has been provisioned, no production migration has been run, and no site has been deployed by this implementation task.

## Environment variables

All values below are server configuration, supplied through host settings. `.env.example` contains placeholders only. Plain Node does not auto-load `.env`; use your host's development command or Node 22's `--env-file` option when running scripts locally.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Managed PostgreSQL connection, preferably pooled and TLS-verified. |
| `APP_ORIGIN` | Canonical origin such as `https://goodshprd.com`, with no path. Used for OAuth callback and POST Origin checks. Only localhost development permits HTTP. |
| `SESSION_SECRET` | Random secret of at least 32 bytes of entropy; minimum configured string length is 32. Generate locally, e.g. `openssl rand -hex 32`, and store securely. Rotation invalidates sessions, CSRF tokens, and pending logins. |
| `FINANCE_OWNER_GITHUB_ID` | Numeric immutable GitHub ID of the sole authorized owner. Rechecked on every request. |
| `GITHUB_OAUTH_CLIENT_ID` | Dedicated Finance OAuth app's client ID. |
| `GITHUB_OAUTH_CLIENT_SECRET` | Dedicated Finance OAuth app's client secret. |
| `STRIPE_SECRET_KEY` | Existing Stripe account's server key; use test mode in staging. |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for this deployment's webhook endpoint. |

The host normally sets `NODE_ENV=production`. Production HTTPS cookies use the `__Host-` prefix, `Path=/`, no Domain attribute, `HttpOnly`, `Secure`, `SameSite=Lax`, and an eight-hour absolute expiry. Opaque tokens are stored only in cookies; only their keyed hashes are stored in PostgreSQL. Logout removes the server session. The database also stores ten-minute, single-use OAuth states and PKCE verifiers.

Changing repository permissions does not authorize Finance. A signed-in non-owner may have a session but cannot read the page or financial endpoints. `/api/auth/me` returns only CSRF material and an owner boolean, not financial records. Production database administrators and developers able to deploy arbitrary code remain privileged; restrict those roles if privacy must exclude them.

## API contract

- `GET /api/auth/login`: begin GitHub login.
- `GET /api/auth/callback`: single-use OAuth callback.
- `GET /api/auth/me`: current session CSRF token and owner boolean.
- `POST /api/auth/logout`: revoke session, requires CSRF and same origin.
- `GET /api/admin/finance/summary`: totals.
- `GET /api/admin/finance/reports`: same authoritative period summary in this phase.
- `GET /api/admin/finance/orders`: up to 100 orders with customer/item/payment status.
- `POST /api/admin/finance/orders`: manual sale, item, optional new customer, payment if paid, and audit record in one transaction.
- `GET /api/admin/finance/payments`: up to 100 payment records.
- `GET /api/admin/finance/expenses`: up to 100 expense records.
- `POST /api/admin/finance/expenses`: expense and audit record in one transaction.

Every finance endpoint requires the owner session. GET filters: `currency` (default USD), `from` / `to` (YYYY-MM-DD, inclusive; default all dates), `offset` (list endpoints). The dashboard defaults to the current month. Manual entry/report selection initially supports USD, CAD, EUR, GBP, AUD, JPY and KWD. Stripe records retain their actual three-letter currency even outside this UI set; extend the supported UI currency list before accepting other currencies.

POSTs require `Content-Type: application/json`, exact `Origin: APP_ORIGIN`, `X-CSRF-Token` from the authenticated page or `/api/auth/me`, and a UUID v4 `Idempotency-Key`. Retrying the same key/data returns the original record; reusing it with different data returns 409. The browser keeps keys only in memory. If you reload after an ambiguous network error, inspect recent records before resubmitting because a new page gets a new key.

Money request values are **integer minor units**, for example USD 10.50 = `1050`, JPY 500 = `500`, KWD 1.250 = `1250`. The browser parses decimal input with integer arithmetic; the server validates all fields again. PostgreSQL bigint values in API records may be strings; summary money values are always decimal integer strings to avoid JSON precision loss.

Example manual sale body:

```json
{"customer":"Customer name","product_name_snapshot":"Wool coat","quantity":1,"unit_price":14500,"unit_cost":6000,"currency":"USD","sale_date":"2026-09-06","payment_status":"paid","payment_method":"cash","notes":"In-person sale"}
```

`customer`, `product_id`, `due_date`, and `notes` are optional. `unit_cost` may be null/omitted for unknown cost. `payment_status` is `paid` or `unpaid`. Unpaid manual sales are completed sales without a payment; this phase does not yet expose an endpoint to settle them later.

Example expense body:

```json
{"category":"Supplies","description":"Repair materials","vendor":"Optional vendor","amount":1250,"currency":"USD","expense_date":"2026-09-06","payment_method":"card","notes":"Optional notes"}
```

## Schema and integrity

The migration creates all requested tables: `users`, `customers`, `orders`, `order_items`, `payments`, `refunds`, `expenses`, `webhook_events`, `audit_log`. It also creates `sessions`, `oauth_states`, and `mutation_keys`; the migration runner creates `schema_migrations`.

IDs are UUIDs. Foreign keys connect customers → orders → items/payments → refunds; audit entries reference the authenticated actor (null for verified Stripe processing). Provider identifiers are unique. Money columns are bigint with nonnegative constraints (positive refunds/expenses). Orders enforce `total = subtotal - discount + tax`. Triggers reject payment/refund currency mismatches. Item price and cost are historical snapshots; unknown costs remain NULL, not zero. `product_id` is an optional external reference because the existing catalog is still JSON and has no database product table.

POST transactions include audit logging and request idempotency. Database errors roll the whole transaction back. There are no edit/delete endpoints or financial data in Git, Decap, static JSON, or localStorage.

## Stripe behavior and limits

The existing checkout-creation functions and storefront buttons are preserved. The webhook verifies the original request bytes and Stripe signature before data access. A unique Stripe event insert and all financial changes commit in the same transaction. Failures return 500 and roll back the event marker so Stripe can retry. Different events for the same payment intent use a transaction-level advisory lock; unique payment/refund IDs provide additional protection.

The handler retrieves current Stripe state rather than trusting the browser or letting a stale event regress a paid order. Successful payment intents create a single payment. Checkout events enrich automatically captured Stripe orders with line-item snapshots. A payment arriving before Checkout gets an explicitly unlinked item with unknown cost; later Checkout details replace only that placeholder. Refunds are fetched with pagination and recorded only when succeeded, once per refund ID. Pending refunds do not reduce totals until Stripe confirms them. Expired sessions only expire unpaid orders. Unrelated event types are acknowledged without financial changes.

The handler captures payment-mode Stripe payments from the configured account; it does not require a storefront product mapping. Use a dedicated account/appropriate event scope if the account also contains unrelated business payments. Stripe customer IDs, payment-intent IDs and session IDs are retained, but automatic matching to the two existing JSON product catalogs is deferred. No inventory or CMS files are modified by webhooks. Historical import, subscriptions, non-payment-intent charges and zero-total checkout without a payment intent are not implemented; unsupported required-event cases return a retryable failure for investigation. No arbitrary metadata is accepted as authorization or as permission to attach payments to a manual order.

The frontend success page remains presentation only. It cannot create records or mark an order paid. This phase does not add a public session-detail lookup.

## Calculation definition

Each report is scoped to one currency and date range and executes one SQL statement for a consistent snapshot:

- Revenue = totals of `completed` / `paid` orders, before refunds.
- Collected = `succeeded` payment amounts, before refunds.
- Refunds = confirmed refund records.
- Cost of goods sold = known historical unit cost × quantity for revenue-bearing orders.
- Gross profit = revenue − known cost of goods sold − refunds.
- Estimated profit = gross profit − expenses.

Sales use sale dates; collections, refunds and expenses use their respective dates. Refunds in a later reporting period reduce that period's profit. Stripe sale dates initially use Checkout/payment-intent creation dates, and payments use charge dates. Unknown costs are counted and flagged. Revenue follows order total, including tax/shipping; this is an operational estimate, not tax accounting. Processing fees must currently be entered as expenses. Inventory acquisition costs should not also be entered as operating expenses if they are already included in unit cost, or profit would count the cost twice.

## Verification and remaining work

Run `npm test` with Node 22. Tests use an in-memory PostgreSQL engine and the actual migration and SQL, plus mocked GitHub/Stripe network calls. They verify owner/non-owner/logged-out access, page/function paths, expiry, logout, CSRF, raw-body signatures, OAuth state/PKCE/session rotation, transactional sale/expense creation, audit rollback, idempotency, refunds, exact calculations, currencies/dates, missing costs, deployment adapters, and safe public artifacts. They do not prove distributed contention behavior or actual managed PostgreSQL/network/host configuration.

Local Safari checks used fictional records and a temporary fixture server outside the repository. The dashboard rendered expected totals, and an expense form submission persisted and updated totals. Production has no preview-sign-in route or authentication bypass.

Before live use: verify the chosen host's bundling/rewrites and CDN headers, actual OAuth app and GitHub identity, database TLS and backups, and Stripe delivery/retry monitoring. Configure host-level abuse/rate limits on public login and checkout routes. Existing Decap authentication remains separate and has not been repaired. Public catalog HTML interpolation was escaped because storefront XSS on the same origin could threaten an authenticated Finance session. Other same-origin scripts and deployment administrators remain part of the trust boundary. There has not been a comprehensive penetration test or dependency vulnerability assessment.

Later phases: customer selection/deduplication, product catalog consolidation, settling unpaid sales, manual refunds, editing/corrections with audit history, cost updates, pagination controls, fees automation, historical Stripe import, and richer reports. No cloud resources or production credentials are created by this code.

References: [GitHub OAuth code/state/PKCE](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps), [PostgreSQL transactions through pg](https://node-postgres.com/features/transactions), [Stripe webhook guidance](https://docs.stripe.com/webhooks), [Netlify function configuration](https://docs.netlify.com/build/functions/configuration/).
