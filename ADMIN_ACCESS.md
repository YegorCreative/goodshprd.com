# Good Shepherd admin access

1. Go to **`/admin/`**.
2. If you are logged out, choose GitHub sign in.
3. Sign in with the GitHub account whose numeric ID is configured as `FINANCE_OWNER_GITHUB_ID`.
4. The Admin gateway shows links for **Finance** and **Products / CMS**.
5. Finance is at **`/admin/finance/`**. Products/CMS is at **`/admin/cms/`**.
6. Bookmark **`/admin/`** for quick access.
7. Use **Logout** in the gateway or Finance page to revoke the session.

The Finance page and every Finance API require the owner session. A logged-out visitor is shown a sign-in response. A different GitHub account receives access denied and cannot view financial data.

Products/CMS is the existing Decap editor, now published under `/admin/cms/` so `/admin/` can be the owner gateway. It manages the public product catalog; Finance manages private financial records and cost data.

Before staging use, configure the staging `APP_ORIGIN`, dedicated GitHub OAuth app and callback (`<staging-origin>/api/auth/callback`), `FINANCE_OWNER_GITHUB_ID`, session secret, and staging database. See [FINANCE_STAGING_SETUP.md](FINANCE_STAGING_SETUP.md).
