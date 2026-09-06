# Finance staging smoke test

Run these checks against the staging Vercel URL only.

## Authentication

1. Open `/admin/finance/` while logged out. Expect denial or sign-in, with no Finance document/data.
2. Sign in with the owner GitHub account. Expect the dashboard to load.
3. Try an authenticated non-owner account. Expect HTTP 403 from Finance APIs.

## Manual sale and payments

Create a $100 sale with $40 cost. Confirm Revenue is $100 and COGS is $40. For an unpaid sale, Collected is $0 and Outstanding is $100. Record $60, then $40, confirming Collected $60/$100, Outstanding $40/$0, and status Paid.

## Expense and refund

Add a $20 expense and confirm estimated profit changes accordingly. Refund $20 and confirm Refunds increase, net collected decreases, and an over-refund is rejected.

## Stripe test mode

Complete one Stripe test checkout. Confirm the webhook creates/reconciles the payment and repeated delivery does not duplicate it. Perform a Stripe test refund and confirm reconciliation; resend the event and confirm idempotency.

## Export and security

Download the sales CSV as owner and verify stable IDs, ISO dates, and currency. Confirm a non-owner cannot download it. While logged out, request `/api/admin/finance/*` and `/api/finance`; expect 401/403 according to route semantics.
