# Good Shepherd project status

## Current architecture

The public site is static HTML/CSS/JavaScript built into `dist`. Vercel is the canonical serverless host. API functions use the shared Node adapter in `server/adapters.js`; Netlify adapters remain available.

## Admin structure

- `/admin/` — owner-authenticated gateway
- `/admin/finance/` — owner-only Finance dashboard
- `/admin/cms/` — existing Decap product/CMS editor

The public build excludes the owner gateway and Finance page. The CMS editor is copied to its `/admin/cms/` path for static hosting.

## Finance capabilities

Sales, manual payment settlement, manual and Stripe refunds, expenses and corrections, customer history, product cost basis, reports, charts, CSV exports, audit logging, and idempotent Stripe webhooks are implemented.

## Authentication

GitHub OAuth uses state, PKCE, a database session, secure HttpOnly cookies, expiration, logout revocation, and numeric owner-ID authorization through `FINANCE_OWNER_GITHUB_ID`.

## Database

Managed PostgreSQL is expected. Migrations are `001_finance.sql`, `002_finance_dashboard.sql`, and `003_finance_workflows.sql`; the migration runner tracks applied files transactionally.

## Stripe

Checkout and webhook handlers use server-side Stripe state. Webhook signatures and event IDs are verified, and duplicate/out-of-order events are reconciled idempotently. Live Stripe has not been used in local verification.

## Deployment

Vercel Preview is intended for staging, with a separate database, OAuth app, Stripe Test Mode keys, and session secret. GitHub Pages remains static-only.

## Verification

- 41 local tests pass.
- `npm run build` passes.
- JavaScript syntax checks pass.
- `git diff --check` passes.

## Complete locally

The owner gateway, Finance workflows, database schema, authentication, webhook handling, public build exclusions, and staging documentation are present.

## Still required for staging

Provision staging PostgreSQL, configure Vercel environment variables, create the staging GitHub OAuth app, configure Stripe Test Mode webhooks, run `npm run migrate` against staging, and complete the smoke/browser checklists.

## Explicitly not production-ready

No production deployment or managed-database migration has been performed. Live Stripe behavior, deployed Vercel routing, provider backup restoration, and registry-backed dependency audit results still require staging/production operator verification.
