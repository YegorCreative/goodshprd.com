# Stripe Checkout Integration - Quick Start

## Files Provided

### Backend Endpoints
- **`api/create-checkout-session.js`** - Vercel endpoint
- **`api/webhook.js`** - Vercel webhook endpoint
- **`netlify/functions/create-checkout-session.js`** - Netlify endpoint
- **`netlify/functions/webhook.js`** - Netlify webhook endpoint

### Frontend
- **`js/stripe-checkout.js`** - Browser utility library (public, no secrets)
- **`success.html`** - Success page after payment
- **`canceled.html`** - Cancellation page

### Configuration
- **`vercel.json`** - Vercel configuration
- **`netlify.toml`** - Netlify configuration
- **`.env.example`** - Environment variables template
- **`STRIPE_SETUP.md`** - Comprehensive setup guide

---

## Quick Start (5 minutes)

### 1. Get Stripe Keys

1. Go to https://dashboard.stripe.com/
2. Click **Developers** → **API Keys**
3. Copy:
   - `Secret key` (starts with `sk_test_` or `sk_live_`)
   - Go to **Webhooks**, copy the webhook signing secret (starts with `whsec_`)

### 2. Set Environment Variables

Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

Edit `.env.local` and paste your keys:
```
STRIPE_SECRET_KEY=sk_test_YOUR_KEY_HERE
STRIPE_WEBHOOK_SECRET=whsec_YOUR_SECRET_HERE
```

### 3. Add Button to Your HTML

In `shop.html` (or any page), add:

```html
<!-- At the top of the page -->
<script src="/js/stripe-checkout.js"></script>

<!-- Your purchase button -->
<button class="stripe-checkout-btn" data-price-id="price_1A2B3C4D">
  Buy Now - $19.99
</button>
```

Replace `price_1A2B3C4D` with your actual Stripe Price ID.

### 4. Create a Product in Stripe

1. Go to https://dashboard.stripe.com/products
2. Click **+ Add product**
3. Name it (e.g., "Subscription")
4. Set price and currency
5. Copy the **Price ID** (starts with `price_`)
6. Use this ID in your HTML buttons

### 5. Configure Webhook

1. Go to https://dashboard.stripe.com/webhooks
2. Click **+ Add endpoint**
3. Enter endpoint URL: `https://yourdomain.com/api/webhook`
   - For local testing: Use ngrok or Stripe CLI
4. Select events: `checkout.session.completed`
5. Copy the signing secret → paste into `.env.local` as `STRIPE_WEBHOOK_SECRET`

### 6. Test Payment Flow

Use **test card**: `4242 4242 4242 4242`
- CVC: Any 3 digits
- Expiry: Any future date
- Cardholder name: Any name

1. Click "Buy Now"
2. You'll be redirected to Stripe Checkout
3. Enter test card details
4. Complete checkout
5. Redirect to success page

---

## HTML Examples

### Simple Button
```html
<button class="stripe-checkout-btn" data-price-id="price_1A2B3C4D">
  Buy Now
</button>
```

### With Loading State
```html
<div id="checkout-error" style="display: none; color: red; margin: 10px 0;"></div>

<button class="stripe-checkout-btn" data-price-id="price_1A2B3C4D">
  Buy Now
</button>

<div id="checkout-spinner" style="display: none; margin-top: 10px;">
  <p>Processing payment...</p>
</div>

<script src="/js/stripe-checkout.js"></script>
```

### Custom Styling
```html
<style>
  .stripe-checkout-btn {
    background: #667eea;
    color: white;
    padding: 12px 24px;
    border: none;
    border-radius: 6px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
  }

  .stripe-checkout-btn:hover {
    background: #5568d3;
    transform: translateY(-2px);
    box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3);
  }

  .stripe-checkout-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }
</style>

<button class="stripe-checkout-btn" data-price-id="price_1A2B3C4D">
  Buy Now
</button>

<script src="/js/stripe-checkout.js"></script>
```

---

## Deployment

### For Vercel

1. Push code to GitHub
2. Connect repo to Vercel
3. Go to Project Settings → Environment Variables
4. Add:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
5. Deploy
6. Update webhook URL in Stripe Dashboard to your Vercel domain

### For Netlify

1. Push code to GitHub
2. Connect repo to Netlify
3. Go to Site Settings → Build & Deploy → Environment
4. Add:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
5. Deploy
6. Update webhook URL in Stripe Dashboard to your Netlify domain

---

## Testing Webhook Locally

### Option 1: Stripe CLI (Recommended)

```bash
# Install Stripe CLI: https://stripe.com/docs/stripe-cli

# Listen for webhook events
stripe listen --forward-to localhost:3000/api/webhook

# This outputs a webhook signing secret
# Copy it and set STRIPE_WEBHOOK_SECRET=whsec_... in .env.local

# In another terminal, trigger a test event
stripe trigger checkout.session.completed
```

### Option 2: ngrok

```bash
# Install ngrok: https://ngrok.com/

# Start ngrok
ngrok http 3000

# You'll get a URL like: https://abc123.ngrok.io
# Use this in Stripe webhook config: https://abc123.ngrok.io/api/webhook
```

---

## JavaScript API

All functions are on the `StripeCheckout` object:

```javascript
// Manually trigger checkout
StripeCheckout.redirectToCheckout('price_1A2B3C4D');

// Check if on success/cancel page
StripeCheckout.checkSessionStatus();

// Re-attach handlers to dynamically added buttons
StripeCheckout.attachCheckoutButtons();

// Show custom error
StripeCheckout.showError('Custom error message');

// Set loading state
StripeCheckout.setLoading(true);
```

---

## Security Checklist

- [ ] `STRIPE_SECRET_KEY` in environment variables (not in code)
- [ ] `STRIPE_WEBHOOK_SECRET` in environment variables (not in code)
- [ ] `.env.local` in `.gitignore`
- [ ] Using HTTPS in production
- [ ] Webhook signature verified
- [ ] Order fulfillment via webhook (not success page)
- [ ] Test mode during development
- [ ] Live mode keys only in production

---

## Troubleshooting

### "priceId is required"
- Check `data-price-id` attribute on button
- Ensure price ID starts with `price_`

### "Invalid signature" webhook errors
- Verify `STRIPE_WEBHOOK_SECRET` is correct
- Check webhook URL matches Stripe config
- For Netlify: ensure function is returning raw body

### Checkout button doesn't redirect
- Check browser console for errors
- Verify `/api/create-checkout-session` endpoint is working
- Test with curl:
  ```bash
  curl -X POST http://localhost:3000/api/create-checkout-session \
    -H "Content-Type: application/json" \
    -d '{"priceId":"price_1A2B3C4D"}'
  ```

### Webhook never fires
- Verify endpoint URL is publicly accessible
- Check Stripe Dashboard → Webhooks → Recent Deliveries
- Ensure signing secret matches your endpoint
- Try Stripe CLI: `stripe trigger checkout.session.completed`

---

## Next Steps

1. **Add fulfillment logic** in `api/webhook.js`:
   - Database updates
   - Email confirmations
   - Access grants

2. **Customize pages**:
   - Add your branding to `success.html` and `canceled.html`
   - Style checkout button to match your site

3. **Add more products**:
   - Create multiple prices in Stripe
   - Add buttons with different `data-price-id` values

4. **Monitor in production**:
   - Watch Stripe Dashboard → Webhooks → Recent Deliveries
   - Set up email alerts for failed webhooks
   - Monitor your fulfillment logs

---

## Resources

- [Stripe Checkout docs](https://stripe.com/docs/payments/checkout)
- [Webhooks guide](https://stripe.com/docs/webhooks)
- [Test cards](https://stripe.com/docs/testing)
- [API reference](https://stripe.com/docs/api)
- [Security best practices](https://stripe.com/docs/security)

---

**Questions?** See `STRIPE_SETUP.md` for comprehensive documentation.
