# Stripe Checkout Integration - Reference Guide

Quick reference for common tasks and troubleshooting.

---

## 🚀 Getting Started (TL;DR)

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env.local
# Edit .env.local with your Stripe keys

# 3. Add to HTML
<script src="/js/stripe-checkout.js"></script>
<button class="stripe-checkout-btn" data-price-id="price_YOUR_PRICE_ID">
  Buy Now
</button>

# 4. Deploy (Vercel)
npm install -g vercel
vercel

# 5. Add env vars in Vercel Dashboard
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...

# 6. Configure webhook in Stripe Dashboard
# https://yourdomain.com/api/webhook
```

---

## 📋 File Reference

### Endpoints

| File | Method | URL | Purpose |
|------|--------|-----|---------|
| `api/create-checkout-session.js` | POST | `/api/create-checkout-session` | Create session |
| `api/webhook.js` | POST | `/api/webhook` | Handle webhooks |

### Frontend

| File | Purpose |
|------|---------|
| `js/stripe-checkout.js` | Main library (auto-loads) |
| `js/stripe-checkout-examples.js` | Code examples |
| `success.html` | Success page |
| `canceled.html` | Cancel page |

### Config

| File | Deployment |
|------|-----------|
| `vercel.json` | Vercel |
| `netlify.toml` | Netlify |
| `package.json` | Dependencies |
| `.env.local` | Development |
| `.env.example` | Template |

---

## 🔑 Environment Variables

### What They Do

| Variable | Usage | Where to Find |
|----------|-------|---------------|
| `STRIPE_SECRET_KEY` | Backend API calls | Stripe Dashboard → Developers → API Keys |
| `STRIPE_WEBHOOK_SECRET` | Webhook validation | Stripe Dashboard → Developers → Webhooks |

### Where to Set Them

**Development:**
- File: `.env.local`
- Keep local only (never commit)

**Vercel:**
- Settings → Environment Variables
- Add for Production, Preview, Development

**Netlify:**
- Site Settings → Environment
- Add variables

---

## 🧪 Testing

### Test Cards

Copy-paste these card numbers:

**Successful Payment:**
```
4242 4242 4242 4242
```

**Declined Card:**
```
4000 0000 0000 9995
```

**For Any Test Card:**
- CVC: Any 3 digits (e.g., 123)
- Expiry: Any future date (e.g., 12/99)
- Name: Any text

### Local Testing

```bash
# Install Stripe CLI
npm install -g @stripe/cli

# Terminal 1: Listen for webhooks
stripe listen --forward-to localhost:3000/api/webhook

# Terminal 2: Trigger test event
stripe trigger checkout.session.completed

# Terminal 3: Run your app
npm run dev
```

### cURL Testing

```bash
# Create checkout session
curl -X POST http://localhost:3000/api/create-checkout-session \
  -H "Content-Type: application/json" \
  -d '{"priceId":"price_1A2B3C4D"}'

# Response:
# {"url":"https://checkout.stripe.com/pay/..."}
```

---

## 🎯 Common Tasks

### Add a New Product Button

1. Create product in Stripe Dashboard
2. Copy Price ID (starts with `price_`)
3. Add to HTML:

```html
<button class="stripe-checkout-btn" data-price-id="price_ABC123">
  Buy Product
</button>
```

### Customize Success Page

Edit `success.html`:
```html
<!-- Show order details -->
<div>Thank you! Your order ID: <span id="order-id"></span></div>

<script>
  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get('session_id');
  document.getElementById('order-id').textContent = sessionId;
</script>
```

### Add Fulfillment Logic

Edit `api/webhook.js`:
```javascript
if (webhookEvent.type === 'checkout.session.completed') {
  const session = webhookEvent.data.object;
  
  // TODO: Add your logic here
  await db.markOrderAsPaid(session.id);
  await sendConfirmationEmail(session.customer_email);
  await grantAccess(session.customer_email);
}
```

### Change Error Message

Edit `js/stripe-checkout.js`:
```javascript
showError: function(message) {
  // Customize how errors are displayed
  const errorEl = document.getElementById('checkout-error');
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.style.display = 'block';
  }
}
```

### Track Checkout Events

```javascript
// Add to your analytics
StripeCheckout.redirectToCheckout = async (priceId) => {
  // Track start
  gtag('event', 'begin_checkout', { price_id: priceId });
  // ... rest of checkout
};
```

---

## 🐛 Troubleshooting

### Button doesn't work

**Check:**
```
1. Is script loaded? <script src="/js/stripe-checkout.js"></script>
2. Does button have class? class="stripe-checkout-btn"
3. Does button have price ID? data-price-id="price_..."
4. Check browser console for errors (F12)
5. Test API: curl -X POST /api/create-checkout-session
```

### "Invalid signature" webhook errors

**Check:**
```
1. Is STRIPE_WEBHOOK_SECRET correct?
2. Does it match webhook endpoint in Stripe Dashboard?
3. For Netlify: Is raw body being passed?
4. Check Stripe Dashboard → Webhooks → Recent Deliveries
```

### Webhook never fires

**Check:**
```
1. Is endpoint URL public? (not localhost)
2. Does URL match Stripe Dashboard? (https://yourdomain.com/api/webhook)
3. Did you save webhook in Stripe Dashboard?
4. Check Stripe Dashboard → Webhooks → Recent Deliveries
5. Look for error messages in Vercel/Netlify logs
```

### Payment appears in Stripe but webhook didn't trigger

**Solution:**
```javascript
// Stripe retries automatically for 24 hours
// Manual retry in Stripe Dashboard:
// Developers → Webhooks → Recent Deliveries → Click event → Retry

// Or process manually by fetching session
fetch(`/api/get-session?sessionId=${sessionId}`)
  .then(r => r.json())
  .then(session => fulfillOrder(session))
```

### Environment variables not working

**Check:**
```
1. Vercel: Settings → Environment Variables → Verify saved
2. Netlify: Site Settings → Environment → Verify saved
3. Redeploy after adding variables
4. Local: Is .env.local in project root?
5. Local: Is process.env being used in backend only?
```

### CORS errors

**Solution:**
Add headers to your function:
```javascript
res.setHeader('Access-Control-Allow-Origin', '*');
res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
```

### "priceId is required" error

**Check:**
```
1. HTML: <button data-price-id="price_...">
2. Price ID: Starts with "price_"?
3. Price ID: Exists in Stripe Dashboard?
4. Price ID: Is it active (not archived)?
```

---

## 📚 Documentation Map

**New to Stripe?**
→ Start with `STRIPE_QUICK_START.md`

**Setting up integration?**
→ Follow `STRIPE_SETUP.md`

**Need code examples?**
→ See `js/stripe-checkout-examples.js`

**Want to understand architecture?**
→ Read `ARCHITECTURE.md`

**Deploying?**
→ Check `INTEGRATION_SUMMARY.md`

**Have questions?**
→ Search this file or `STRIPE_SETUP.md`

---

## 🔄 Request/Response Examples

### POST /api/create-checkout-session

**Request:**
```json
{
  "priceId": "price_1A2B3C4D"
}
```

**Success Response (200):**
```json
{
  "url": "https://checkout.stripe.com/pay/cs_live_abc123..."
}
```

**Error Response (400):**
```json
{
  "error": "Invalid priceId format"
}
```

---

## 🔐 Security Checklist

- [ ] Secret keys in environment variables only
- [ ] `.env.local` in `.gitignore`
- [ ] No secrets in code/comments
- [ ] Webhook signature verified
- [ ] HTTPS enabled in production
- [ ] Using hosted Checkout (not custom form)
- [ ] Fulfillment logic in webhook (not success page)
- [ ] Test mode during development
- [ ] Live keys only in production

---

## 📊 Monitoring Checklist

- [ ] Watch Stripe Dashboard for payments
- [ ] Monitor webhook delivery logs
- [ ] Alert on failed webhooks
- [ ] Track fulfillment success rate
- [ ] Log all transactions
- [ ] Monitor error rates
- [ ] Test webhook resilience
- [ ] Keep test data separate

---

## 🚨 Emergency Response

### Payment processed but customer didn't receive fulfillment

```
1. Check Stripe Dashboard → Payments → Find transaction
2. Go to "Metadata" or "Details" → Find session ID
3. Check webhook logs: Did webhook fire?
4. If webhook failed: Manually trigger fulfillment
5. If webhook succeeded: Check fulfillment logic
6. If order is stuck: Contact Stripe support with session ID
```

### Webhook endpoint down

```
1. Stripe automatically retries for 24 hours
2. Fix your endpoint
3. Restart server
4. Manually replay failed webhooks from Stripe Dashboard
5. Or process pending orders manually
```

### Suspicious activity detected

```
1. Check Stripe Dashboard → Radar rules
2. Review recent transactions
3. Check for fraud patterns
4. Consider enabling Radar (fraud protection)
5. Contact Stripe support if needed
```

---

## 🎓 Learning Resources

**Official Stripe Docs:**
- [Checkout Quick Start](https://stripe.com/docs/payments/checkout/quickstart)
- [Webhooks Guide](https://stripe.com/docs/webhooks)
- [API Reference](https://stripe.com/docs/api)
- [Test Cards](https://stripe.com/docs/testing)

**This Project:**
- `STRIPE_QUICK_START.md` - 5-minute setup
- `STRIPE_SETUP.md` - Comprehensive guide
- `ARCHITECTURE.md` - System design
- `js/stripe-checkout-examples.js` - Code patterns

---

## 💡 Tips & Tricks

### Tip 1: Test Webhook Locally
Use Stripe CLI instead of ngrok - it's simpler and faster.

### Tip 2: Check Recent Deliveries
Stripe Dashboard → Webhooks → Recent Deliveries shows retry history.

### Tip 3: Use Session IDs
Always log session IDs - they're your link between Stripe and your database.

### Tip 4: Idempotent Fulfillment
Check if order already processed before processing again (safe retries).

### Tip 5: Metadata Fields
Add custom metadata to sessions for order tracking:
```javascript
stripe.checkout.sessions.create({
  // ... other fields
  metadata: {
    order_id: "12345",
    customer_id: "cust_abc",
  }
})
```

### Tip 6: Test Mode Isolation
Always use test keys during development - they're separate from live.

### Tip 7: Monitor Success Rate
Track % of payments that successfully trigger webhooks.

---

## 📞 Quick Contact Info

**Stripe Support:**
- https://support.stripe.com
- Email: support@stripe.com

**Your Platform Support:**
- Vercel: vercel.com/support
- Netlify: support.netlify.com

**Documentation:**
- See any of the STRIPE_*.md files in this directory

---

**Last Updated:** December 2025  
**Stripe SDK Version:** 14.11.0  
**Node Version:** 18.x
