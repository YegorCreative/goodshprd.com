# Finance staging setup

Vercel is the canonical host for staging and production. Netlify configuration remains in the repository as an alternative adapter; GitHub Pages is static-only and cannot host Finance.

## Environment matrix

| Variable | Local | Preview/staging | Production |
|---|---|---|---|
| `DATABASE_URL` | local or test PostgreSQL | dedicated staging PostgreSQL | dedicated production PostgreSQL |
| `APP_ORIGIN` | `http://localhost:3000` | `https://STAGING-DOMAIN` | production HTTPS origin |
| `SESSION_SECRET` | unique test secret | unique random secret | different unique random secret |
| `FINANCE_OWNER_GITHUB_ID` | owner numeric ID | owner numeric ID | owner numeric ID |
| `GITHUB_OAUTH_CLIENT_ID` | development OAuth app | dedicated staging OAuth app | dedicated production OAuth app |
| `GITHUB_OAUTH_CLIENT_SECRET` | development secret | staging secret | production secret |
| `STRIPE_SECRET_KEY` | Stripe test key | Stripe test key | Stripe live key |
| `STRIPE_WEBHOOK_SECRET` | local/test webhook secret | staging test webhook secret | production webhook secret |

Set these in Vercel Environment Settings with separate **Preview** and **Production** scopes. Never use defaults that allow Preview to inherit the production database. Keep `DATABASE_URL`, OAuth secrets, Stripe keys, and session secrets out of source control.

## GitHub OAuth staging app

Create a separate GitHub OAuth App for staging. Set:

- Homepage URL: `https://STAGING-DOMAIN`
- Authorization callback URL: `https://STAGING-DOMAIN/api/auth/callback`

Copy its client ID and secret into the staging Vercel environment. The application constructs callback URLs from `APP_ORIGIN`; no staging or production URL is hardcoded in application code.

To find the owner’s numeric GitHub ID, use the authenticated GitHub profile API or the public GitHub profile endpoint and copy the `id` field. Store it only as `FINANCE_OWNER_GITHUB_ID`; never use a display name or publish the value in frontend code.

## PostgreSQL staging

Provision a dedicated managed PostgreSQL database with TLS, backups, restricted credentials, and no network or credential sharing with production. Store the connection string only in Vercel’s staging environment variables.

With the staging `DATABASE_URL` loaded locally (and after confirming it is staging), initialize it with:

```sh
npm run migrate
```

The expected order is `001_finance.sql`, `002_finance_dashboard.sql`, then `003_finance_workflows.sql`. The runner uses `schema_migrations`, a transaction, and an advisory lock; running it again is safe and skips applied files. The application has no automatic rollback mechanism. Treat financial records as durable data and use forward migrations plus backups for corrections.

Enable the provider's automated PostgreSQL backups before staging tests. Restore only into a separate staging database, verify `schema_migrations` and audit records, and point a temporary Vercel Preview environment at that restored database. Do not restore over production. Schema changes are forward-only: back up first, apply a new migration, and use corrective migrations rather than deleting historical financial rows.

## Stripe test mode

Configure a test-mode Stripe webhook at:

`https://STAGING-DOMAIN/api/webhook`

Subscribe to `checkout.session.completed`, `checkout.session.expired`, `payment_intent.succeeded`, `charge.refunded`, and `refund.updated`. `STRIPE_SECRET_KEY` comes from Stripe Developers → API keys with Test mode enabled. `STRIPE_WEBHOOK_SECRET` comes from the endpoint’s signing-secret panel. Never paste either into this repository or a browser variable.

## Vercel route trace

- `/admin/finance/` → rewrite → `/api/finance-page` → `api/finance-page.js` → `server/adapters.vercel()` → `server/app.createApp()` → `requireFinanceOwner()` before HTML is read.
- `/api/auth/*` → rewrite with `finance_route` → `api/finance.js` → adapter dispatch → `authRoute()`.
- `/api/admin/finance/*` → rewrite with `finance_route` → `api/finance.js` → adapter dispatch → owner-guarded Finance router.
- `/api/finance` → direct Vercel function entrypoint `api/finance.js`.
- `/api/finance-page` → direct function entrypoint `api/finance-page.js`.
- `/api/webhook` → `api/webhook.js` → raw-body adapter → Stripe signature verification → idempotent event processor.
- `/api/create-checkout-session` → `api/create-checkout-session.js`; success/cancel URLs use `APP_ORIGIN` when configured.

The public build allowlist copies the storefront and selected public admin files only. It does not copy `admin/finance/index.html`, migrations, server source, or environment files.
