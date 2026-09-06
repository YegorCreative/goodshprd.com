# Good Shepherd Finance staging checklist

## Hosting

- [ ] Canonical host selected: Vercel (recommended)
- [ ] Staging domain configured and `APP_ORIGIN` set exactly
- [ ] Vercel function routes `/api/finance`, `/api/auth/*`, `/api/admin/finance/*`, and `/api/webhook`
- [ ] SSL enabled
- [ ] Rewrites verified for page and API routes
- [ ] Finance/API responses retain `private, no-store` headers

## Authentication

- [ ] Dedicated GitHub OAuth app created for staging
- [ ] Callback URL is `<staging-origin>/api/auth/callback`
- [ ] Numeric `FINANCE_OWNER_GITHUB_ID` configured
- [ ] Secure HttpOnly session cookie verified
- [ ] Logout/revocation verified
- [ ] Logged-out and non-owner requests rejected

## Database

- [ ] Managed PostgreSQL provisioned with TLS
- [ ] Restricted network/database user configured
- [ ] Backups and retention configured
- [ ] `npm run migrate` run against staging only
- [ ] Migration records verified in `schema_migrations`
- [ ] Connection string stored only in host environment variables

## Stripe test mode

- [ ] Test-mode secret key configured
- [ ] Test webhook endpoint configured
- [ ] Test webhook signing secret configured
- [ ] Test checkout completed
- [ ] Test refund completed
- [ ] Duplicate event tested
- [ ] Out-of-order payment/checkout events tested

## Finance workflows

- [ ] Manual sale
- [ ] Payment settlement
- [ ] Expense creation
- [ ] Expense correction
- [ ] Expense deletion/correction audit
- [ ] Manual refund
- [ ] Reports and date filters
- [ ] CSV exports
- [ ] Customer history
- [ ] Product cost maintenance

## Security

- [ ] 401 unauthenticated behavior
- [ ] 403 non-owner behavior
- [ ] IDOR attempts rejected or return no record
- [ ] CSRF rejection verified
- [ ] Duplicate mutation behavior verified
- [ ] Private cache headers verified
- [ ] Public build contains no Finance files or records
