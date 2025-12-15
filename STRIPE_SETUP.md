# Stripe Checkout Integration Guide

## Overview

This integration provides a secure, server-side payment processing solution using Stripe Checkout. It follows industry best practices for handling sensitive payment data.

## Architecture

```
Frontend (Browser)
├── stripe-checkout.js (PUBLIC, no secrets)
└── HTML with <button class="stripe-checkout-btn" data-price-id="...">

        ↓ POST /api/create-checkout-session
        
Backend (Vercel/Netlify)
├── api/create-checkout-session.js (PRIVATE, uses STRIPE_SECRET_KEY)
│   └── Creates Stripe Checkout Session
│       └── Returns: { url: "https://checkout.stripe.com/pay/..." }
│
└── api/webhook.js (PRIVATE, uses STRIPE_WEBHOOK_SECRET)
    └── Listens for: checkout.session.completed
        └── Fulfills order (email, account activation, etc.)

Stripe Servers
└── Hosted Checkout (PCI DSS Compliant)
```

## Files Created

### Backend Serverless Functions

1. **`api/create-checkout-session.js`**
   - Creates a Stripe Checkout Session
   - Called from frontend JavaScript
   - Returns redirect URL to Stripe Checkout

2. **`api/webhook.js`**
   - Receives webhook events from Stripe
   - Verifies signature for authenticity
   - Processes `checkout.session.completed` events
   - Handles order fulfillment

### Frontend

3. **`js/stripe-checkout.js`**
   - Exposes `StripeCheckout` object with utility methods
   - Auto-attaches click handlers to `.stripe-checkout-btn` buttons
   - Manages loading states and error messages
   - No sensitive data (priceId only)

4. **`success.html`**
   - Shown after successful payment
   - Displays session ID from URL parameter
   - Links to home and shop

5. **`canceled.html`**
   - Shown if checkout is canceled
   - Explains why and offers next steps

## Setup Instructions

### Step 1: Install Dependencies

Add Stripe SDK to your `package.json`:

```bash
npm install stripe
```

### Step 2: Configure Environment Variables

Create a `.env.local` (Vercel) or `.env` (Netlify) file in your project root:

```
STRIPE_SECRET_KEY=sk_live_YOUR_SECRET_KEY_HERE
STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET_HERE
```

**DO NOT commit these to git.** Add `.env.local` to `.gitignore`:

```
.env.local
.env
```

### Step 3: Set Environment Variables in Your Deployment Platform

#### For Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Add:
   - `STRIPE_SECRET_KEY`: `sk_live_...`
   - `STRIPE_WEBHOOK_SECRET`: `whsec_...`
5. Apply to Production, Preview, and Development

#### For Netlify

1. Go to [Netlify Dashboard](https://app.netlify.com)
2. Select your site
3. Go to **Site Settings** → **Build & Deploy** → **Environment**
4. Add:
   - `STRIPE_SECRET_KEY`: `sk_live_...`
   - `STRIPE_WEBHOOK_SECRET`: `whsec_...`
5. Deploy

### Step 4: Configure Webhook in Stripe Dashboard

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Navigate to **Developers** → **Webhooks**
3. Click **Add an endpoint**
4. Endpoint URL: `https://yourdomain.com/api/webhook`
5. Events to listen for:
   - `checkout.session.completed`
   - (Optional) `checkout.session.expired`
   - (Optional) `charge.refunded`
6. Copy the signing secret → save as `STRIPE_WEBHOOK_SECRET`

### Step 5: Create Products and Prices in Stripe

1. Go to **Products** in Stripe Dashboard
2. Create a product (e.g., "Digital Subscription")
3. Add prices and copy the **Price ID** (starts with `price_`)
4. Use this Price ID in your HTML buttons

## HTML Usage Example

Add a button to your `shop.html`:

```html
<!-- Import the checkout script (auto-attaches handlers) -->
<script src="/js/stripe-checkout.js"></script>

<!-- Example purchase button -->
<button class="stripe-checkout-btn" data-price-id="price_1A2B3C4D">
  Buy Subscription - $19.99
</button>

<!-- Optional: show loading spinner -->
<div id="checkout-spinner" style="display: none;">
  <p>Processing payment...</p>
</div>

<!-- Optional: show errors -->
<div id="checkout-error" style="display: none; color: red;"></div>
```

## JavaScript API

### Auto-Initialization

When you load `js/stripe-checkout.js`, it automatically:
- Attaches click handlers to all `.stripe-checkout-btn` buttons
- Checks for session status on success/cancel pages

### Manual Checkout Trigger

```javascript
// Programmatically start checkout
StripeCheckout.redirectToCheckout('price_1A2B3C4D');
```

### Check Session Status

```javascript
// Check if on success/cancel page and show appropriate message
StripeCheckout.checkSessionStatus();
```

### Manual Button Attachment

```javascript
// If buttons are added dynamically, re-attach handlers
StripeCheckout.attachCheckoutButtons();
```

## Security Best Practices

### ✅ DO

- ✅ Keep secret keys in environment variables only
- ✅ Use HTTPS for all URLs
- ✅ Verify webhook signatures with `STRIPE_WEBHOOK_SECRET`
- ✅ Use the webhook for order fulfillment, not the success page
- ✅ Use Stripe's hosted Checkout (they handle PCI compliance)
- ✅ Store priceId (public) in HTML, not secret keys

### ❌ DON'T

- ❌ Never expose `STRIPE_SECRET_KEY` in frontend code
- ❌ Never expose `STRIPE_WEBHOOK_SECRET` in frontend code
- ❌ Never use test keys in production
- ❌ Never trust the success page for fulfillment (webhook is the source of truth)
- ❌ Never ignore webhook signature verification
- ❌ Never store card data (Stripe handles it)

## Testing

### Test Cards

Stripe provides test cards for development:

| Card Number       | CVC | Exp Date |
|------------------|-----|----------|
| 4242 4242 4242 4242 | Any 3 digits | Any future date |
| 4000 0000 0000 9995 | Any 3 digits | Any future date (Decline test) |

Use these with:
- Email: any email
- Name: any name

### Testing the Webhook

1. Use Stripe CLI to test locally:
   ```bash
   stripe listen --forward-to localhost:3000/api/webhook
   ```

2. In another terminal, trigger a test event:
   ```bash
   stripe trigger checkout.session.completed
   ```

3. Check your logs for webhook processing

## Deployment Checklist

- [ ] Set `STRIPE_SECRET_KEY` in environment variables
- [ ] Set `STRIPE_WEBHOOK_SECRET` in environment variables
- [ ] Configure webhook endpoint in Stripe Dashboard
- [ ] Create at least one product with a price in Stripe
- [ ] Add `data-price-id` attribute to purchase buttons
- [ ] Test checkout flow in sandbox (test mode)
- [ ] Switch to live mode and test with real card
- [ ] Monitor webhook logs in Stripe Dashboard

## Troubleshooting

### "Invalid signature" webhook errors

- Verify `STRIPE_WEBHOOK_SECRET` is correct
- Ensure raw body is passed to webhook (not parsed JSON)
- Check that webhook endpoint URL matches Stripe config

### Checkout button does not redirect

- Check browser console for errors
- Verify `data-price-id` is valid and active
- Ensure API endpoint is accessible (`/api/create-checkout-session`)

### Webhook events not received

- Verify endpoint URL is public and accessible
- Check Stripe Dashboard webhook logs for delivery attempts
- Ensure signature secret matches webhook signing secret

### Cards declining in test mode

- Use test card `4000 0000 0000 9995` for decline testing
- See [Stripe test cards documentation](https://stripe.com/docs/testing)

## Production Deployment Hints

### Vercel

1. Env vars automatically applied to `process.env`
2. Use `req.headers['x-forwarded-proto']` and `req.headers['x-forwarded-host']` for absolute URLs
3. Function timeout: 60 seconds (sufficient for Stripe)
4. Memory: 1024 MB (default, sufficient)

### Netlify

1. Functions must be in `netlify/functions/` folder (or use build plugin)
2. Alternative: Use Node.js serverless adapter
3. Env vars available via `process.env`
4. Add to `netlify.toml`:
   ```toml
   [functions]
   node_bundler = "esbuild"
   ```

## Further Reading

- [Stripe Checkout docs](https://stripe.com/docs/payments/checkout)
- [Webhooks guide](https://stripe.com/docs/webhooks)
- [Security best practices](https://stripe.com/docs/security)
- [Test mode cards](https://stripe.com/docs/testing)

---

**Need help?** Contact Stripe support or your integration partner.
