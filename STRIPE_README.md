# Stripe Checkout Integration

A production-ready, secure Stripe Checkout integration for the Good Shepherd website. This implementation follows Stripe's best practices and security guidelines.

## 🎯 Features

- ✅ **Server-side payment processing** - Never expose secret keys
- ✅ **Hosted Checkout** - PCI DSS compliant (handled by Stripe)
- ✅ **Webhook verification** - Signed webhook validation
- ✅ **Deterministic payment flow** - Redirects to Stripe Checkout
- ✅ **Multiple deployment targets** - Vercel and Netlify ready
- ✅ **Mobile responsive** - Works on desktop and mobile
- ✅ **Error handling** - User-friendly error messages
- ✅ **Test mode support** - Easy testing with test cards
- ✅ **Environment-based configuration** - Test/live key switching

---

## 📁 Files Overview

### Backend (Serverless Functions)

| File | Platform | Purpose |
|------|----------|---------|
| `api/create-checkout-session.js` | Vercel | Creates Stripe Checkout Session |
| `api/webhook.js` | Vercel | Handles Stripe webhook events |
| `netlify/functions/create-checkout-session.js` | Netlify | Creates Checkout Session (Netlify) |
| `netlify/functions/webhook.js` | Netlify | Webhooks handler (Netlify) |

### Frontend

| File | Purpose |
|------|---------|
| `js/stripe-checkout.js` | Main integration library (public, no secrets) |
| `js/stripe-checkout-examples.js` | Code examples and patterns |
| `success.html` | Success page (shown after payment) |
| `canceled.html` | Cancellation page |

### Configuration

| File | Purpose |
|------|---------|
| `vercel.json` | Vercel deployment config |
| `netlify.toml` | Netlify deployment config |
| `package.json` | Dependencies (Stripe SDK) |
| `.env.example` | Environment variables template |
| `STRIPE_SETUP.md` | Comprehensive setup guide |
| `STRIPE_QUICK_START.md` | 5-minute quick start |

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Environment Variables
```bash
cp .env.example .env.local
# Edit .env.local with your Stripe keys
```

### 3. Add Button to HTML
```html
<script src="/js/stripe-checkout.js"></script>
<button class="stripe-checkout-btn" data-price-id="price_1A2B3C4D">
  Buy Now
</button>
```

### 4. Deploy to Vercel/Netlify
- Push to GitHub
- Connect to Vercel/Netlify
- Add environment variables in dashboard
- Deploy

### 5. Configure Webhook
1. Go to Stripe Dashboard → Webhooks
2. Add endpoint: `https://yourdomain.com/api/webhook`
3. Listen for: `checkout.session.completed`
4. Copy signing secret → add to environment variables

See [STRIPE_QUICK_START.md](./STRIPE_QUICK_START.md) for detailed steps.

---

## 📖 Documentation

- **[STRIPE_QUICK_START.md](./STRIPE_QUICK_START.md)** - 5-minute setup guide
- **[STRIPE_SETUP.md](./STRIPE_SETUP.md)** - Comprehensive documentation
- **[js/stripe-checkout-examples.js](./js/stripe-checkout-examples.js)** - Code examples and patterns

---

## 🔒 Security

### Keys & Secrets

| Key | Usage | Store |
|-----|-------|-------|
| `STRIPE_SECRET_KEY` | Server-side only | `.env.local` / Platform environment |
| `STRIPE_WEBHOOK_SECRET` | Webhook validation | `.env.local` / Platform environment |
| `priceId` | Public price identifier | HTML (safe to expose) |

### Best Practices

✅ **DO:**
- Use environment variables for all secrets
- Verify webhook signatures
- Use HTTPS in production
- Fulfill orders via webhook (not success page)
- Use hosted Checkout (no card data storage)

❌ **DON'T:**
- Expose secret keys in code or logs
- Trust success page for fulfillment
- Skip webhook signature verification
- Store card data
- Use live keys for testing

---

## 🧪 Testing

### Test Card Numbers

| Card | CVC | Exp |
|------|-----|-----|
| 4242 4242 4242 4242 | Any 3 | Any future |
| 4000 0000 0000 9995 | Any 3 | Any future (Decline) |

### Local Webhook Testing

```bash
# Install Stripe CLI
# https://stripe.com/docs/stripe-cli

# Listen for webhooks
stripe listen --forward-to localhost:3000/api/webhook

# Trigger a test event
stripe trigger checkout.session.completed
```

---

## 🔧 Configuration

### Vercel

Environment variables are automatically applied from `vercel.json` or dashboard settings.

```bash
vercel env add STRIPE_SECRET_KEY
vercel env add STRIPE_WEBHOOK_SECRET
vercel deploy
```

### Netlify

Environment variables set in Site Settings or `netlify.toml`.

```bash
# Deploy using Netlify CLI
netlify deploy

# Or connect GitHub and deploy via dashboard
```

---

## 📊 Architecture

```
┌─────────────────┐
│   Frontend      │
│  (Browser)      │
│                 │
│ - HTML buttons  │
│ - JS handlers   │
│ - No secrets    │
└────────┬────────┘
         │
         │ POST /api/create-checkout-session
         │ { priceId: "price_..." }
         ▼
┌─────────────────────────────┐
│   Serverless Function       │
│   (Vercel/Netlify)          │
│                             │
│ - Read STRIPE_SECRET_KEY    │
│ - Create Checkout Session   │
│ - Return { url: "..." }     │
└────────┬────────────────────┘
         │
         │ { url: "https://checkout.stripe.com/..." }
         ▼
┌──────────────────────────────┐
│   Stripe Checkout (Hosted)   │
│                              │
│ - PCI DSS Compliant          │
│ - Collects card data         │
│ - Processes payment          │
│ - Redirects to success page  │
└────────┬─────────────────────┘
         │
         │ webhook POST /api/webhook
         │ { type: "checkout.session.completed" }
         ▼
┌─────────────────────────────┐
│   Webhook Handler           │
│   (Verify signature)        │
│                             │
│ - Mark order as paid        │
│ - Send confirmation email   │
│ - Grant access              │
│ - Log fulfillment           │
└─────────────────────────────┘
```

---

## 🎯 Common Tasks

### Add a New Product

1. In Stripe Dashboard, create product + price
2. Copy the Price ID (starts with `price_`)
3. Add to HTML:
```html
<button class="stripe-checkout-btn" data-price-id="price_NEW_ID">
  Buy New Product
</button>
```

### Customize Success Page

Edit `success.html`:
- Add your branding
- Display order confirmation
- Show download links
- Add next steps

### Add Fulfillment Logic

Edit `api/webhook.js` in the `checkout.session.completed` handler:
```javascript
// TODO: Fulfillment logic
// - Update database
// - Send emails
// - Grant access
// - etc.
```

### Monitor Payments

1. Stripe Dashboard → Payments
2. Search by session ID or customer email
3. View payment details and status

---

## 🐛 Troubleshooting

### Checkout button does nothing
- Check browser console for errors
- Verify `data-price-id` attribute is present and valid
- Test API endpoint: `POST /api/create-checkout-session`

### "Invalid signature" webhook errors
- Verify `STRIPE_WEBHOOK_SECRET` matches your endpoint
- Check webhook URL in Stripe Dashboard
- For Netlify: ensure function returns raw body

### Webhook not firing
- Check Stripe Dashboard → Webhooks → Recent Deliveries
- Verify endpoint URL is publicly accessible
- Test with: `stripe trigger checkout.session.completed`

### Session creation fails
- Verify `STRIPE_SECRET_KEY` is set correctly
- Check that Price ID is valid
- Review function logs for error details

See [STRIPE_SETUP.md](./STRIPE_SETUP.md#troubleshooting) for more solutions.

---

## 📚 Resources

- [Stripe Checkout Documentation](https://stripe.com/docs/payments/checkout)
- [Webhooks Guide](https://stripe.com/docs/webhooks)
- [API Reference](https://stripe.com/docs/api)
- [Security Best Practices](https://stripe.com/docs/security)
- [Test Mode Cards](https://stripe.com/docs/testing)
- [Stripe CLI](https://stripe.com/docs/stripe-cli)

---

## 📝 Deployment Checklist

- [ ] Environment variables set (both platforms)
- [ ] Package installed: `npm install stripe`
- [ ] Webhook endpoint created in Stripe Dashboard
- [ ] At least one product + price created in Stripe
- [ ] Purchase buttons added to HTML
- [ ] Tested with test card (4242...)
- [ ] Webhook signature verification working
- [ ] Success/cancel pages customized
- [ ] Fulfillment logic implemented
- [ ] Deployed to production

---

## 📞 Support

For issues with:
- **Stripe integration**: See [STRIPE_SETUP.md](./STRIPE_SETUP.md)
- **Deployment**: Check [Vercel docs](https://vercel.com/docs) or [Netlify docs](https://docs.netlify.com)
- **Stripe API**: Contact [Stripe support](https://support.stripe.com)

---

## 📄 License

MIT - See [LICENSE](./LICENSE)

---

**Built with** ❤️ for secure, production-ready payments.
