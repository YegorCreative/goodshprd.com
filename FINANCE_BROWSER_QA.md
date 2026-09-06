# Finance browser QA

- [ ] Safari desktop: owner login, logout, 401/403 behavior
- [ ] Chrome/Chromium desktop: same authentication checks
- [ ] Desktop layout: cards, charts, tables, dialogs, navigation
- [ ] Mobile width: no horizontal page overflow; tables remain scrollable
- [ ] Manual sale, payment, expense, correction, deletion, refund forms
- [ ] Keyboard focus, labels, Escape/close behavior, confirmation controls
- [ ] Loading, empty, validation, expired-session, and server-error states
- [ ] Today/week/month/custom date filters in Central Time
- [ ] Sales, customer history, reports, and product-cost views
- [ ] CSV download and private response headers
- [ ] Stripe test payment and refund reconciliation

Pay particular attention to dates around 23:00–01:00 Central Time and verify that sale, payment, refund, and expense dates remain on their entered calendar day.
