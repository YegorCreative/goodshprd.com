# Stripe Checkout Architecture

## System Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                         CLIENT BROWSER                                 │
│                                                                        │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  HTML/CSS/JavaScript (js/stripe-checkout.js)                    │ │
│  │                                                                 │ │
│  │  <button class="stripe-checkout-btn"                           │ │
│  │    data-price-id="price_1A2B3C4D">                            │ │
│  │    Buy Now                                                      │ │
│  │  </button>                                                      │ │
│  │                                                                 │ │
│  │  NO SENSITIVE DATA (priceId only)                              │ │
│  └─────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
                                  │
                   ┌──────────────┴──────────────┐
                   │                             │
                   ▼                             ▼
         (1) POST /api/              (3) User Redirects to
         create-checkout-session     Stripe Hosted Checkout
                   │                             │
                   │                             │
┌──────────────────▼─────────────────────────────┼─────────────────────┐
│              YOUR BACKEND (Vercel/Netlify)     │                    │
│                                                │                    │
│  ┌───────────────────────────────────────┐    │                    │
│  │ api/create-checkout-session.js        │    │                    │
│  │                                       │    │                    │
│  │ - Read STRIPE_SECRET_KEY from env    │    │                    │
│  │ - Validate priceId                   │    │                    │
│  │ - Call stripe.checkout.sessions      │    │                    │
│  │   .create(...)                        │    │                    │
│  │ - Return { url: "..." }              │    │                    │
│  │                                       │    │                    │
│  │ (2) Returns Checkout URL              │    │                    │
│  └───────────────────────────────────────┘    │                    │
│                                                │                    │
└────────────────────────────────────────────────┼────────────────────┘
                                                  │
                                                  ▼
                    ┌─────────────────────────────────────┐
                    │   STRIPE CHECKOUT (Hosted)          │
                    │                                     │
                    │ - Secure payment form              │
                    │ - Card data collection             │
                    │ - PCI DSS Compliant                │
                    │ - Processes payment                │
                    │                                     │
                    │ (4) Redirects on success:          │
                    │ /success.html?session_id=...       │
                    └──────────────┬──────────────────────┘
                                   │
                   ┌───────────────┴────────────────┐
                   │                                │
                   ▼                                ▼
              SUCCESS PAGE                   WEBHOOK EVENT
              (5) User sees                  (6) Stripe sends
              confirmation                   POST /api/webhook
                                            with session details
                   │                                │
                   │                                │
                   │            ┌───────────────────▼────────┐
                   │            │ api/webhook.js             │
                   │            │                            │
                   │            │ - Verify signature         │
                   │            │ - Parse event              │
                   │            │ - Handle session.completed │
                   │            │ - Mark order as paid       │
                   │            │ - Send confirmation email  │
                   │            │ - Grant access             │
                   │            │ - Log fulfillment          │
                   │            └────────────────────────────┘
                   │
        (7) User has access
            to purchased item
```

---

## Data Flow

### Checkout Initiation
```
[User Click]
    ↓
[js/stripe-checkout.js listens to .stripe-checkout-btn]
    ↓
[POST /api/create-checkout-session { priceId }]
    ↓
[Backend creates Stripe Session with:
  - mode: 'payment'
  - line_items: [{ price: priceId, quantity: 1 }]
  - success_url, cancel_url
]
    ↓
[Stripe returns Session with unique URL]
    ↓
[Frontend redirects: window.location.href = sessionUrl]
    ↓
[User on Stripe Checkout (hosted)]
```

### Payment Processing
```
[User enters card details]
    ↓
[User clicks "Pay"]
    ↓
[Stripe processes payment]
    ↓
[If successful:
  - Charge created
  - Checkout session marked as paid
  - Redirect to success_url
]
    ↓
[If canceled:
  - Redirect to cancel_url
]
```

### Webhook Fulfillment
```
[Stripe detects successful payment]
    ↓
[Stripe sends webhook POST to /api/webhook with:]
    - event.type: "checkout.session.completed"
    - event.data.object (session details)
    - stripe-signature header
    ↓
[Backend verifies signature with STRIPE_WEBHOOK_SECRET]
    ↓
[If valid:
  - Extract session details
  - Update database (mark paid)
  - Send confirmation email
  - Grant access to product
  - Log success
]
    ↓
[Return 200 OK to Stripe]
    ↓
[Stripe marks webhook as delivered]
```

---

## Environment Variables

### Development (.env.local)
```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Production (Vercel/Netlify Dashboard)
```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

---

## File Structure

```
goodshprd.com/
│
├── api/                           # Vercel endpoints
│   ├── create-checkout-session.js  # Create Stripe session
│   └── webhook.js                  # Handle webhook events
│
├── netlify/functions/              # Netlify endpoints
│   ├── create-checkout-session.js  # Create Stripe session (Netlify)
│   └── webhook.js                  # Handle webhook events (Netlify)
│
├── js/
│   ├── stripe-checkout.js          # Main frontend library (PUBLIC)
│   └── stripe-checkout-examples.js # Code examples
│
├── success.html                    # Success page
├── canceled.html                   # Cancellation page
│
├── vercel.json                     # Vercel config
├── netlify.toml                    # Netlify config
├── package.json                    # Dependencies
├── .env.example                    # Env template
├── .env.local                      # Env (development only)
│
├── STRIPE_README.md                # Complete README
├── STRIPE_QUICK_START.md           # Quick start guide
├── STRIPE_SETUP.md                 # Comprehensive guide
└── INTEGRATION_SUMMARY.md          # This summary
```

---

## Security Layers

```
Layer 1: Frontend
├─ No secret keys exposed
├─ No direct payment processing
└─ Public price IDs only

       │
       ▼

Layer 2: Backend
├─ Secret keys in environment variables (not in code)
├─ No secret keys logged or returned to frontend
└─ All API calls to Stripe happen here

       │
       ▼

Layer 3: Stripe
├─ Hosted Checkout (PCI DSS compliant)
├─ Stripe handles card data encryption
└─ No card data ever touches your servers

       │
       ▼

Layer 4: Webhooks
├─ Signature verification with STRIPE_WEBHOOK_SECRET
├─ Validate payment_status before fulfillment
└─ Idempotent processing (safe to retry)
```

---

## Error Handling

```
User Action
    │
    ├─ Button Click
    │   └─ js/stripe-checkout.js validates
    │
    ├─ POST to Backend
    │   ├─ Timeout? → Show error message
    │   ├─ Invalid priceId? → 400 error
    │   └─ Server error? → 500 error
    │
    ├─ Checkout Session Creation
    │   ├─ Success → Return URL
    │   └─ Stripe error → Return error message
    │
    ├─ Redirect to Stripe
    │   └─ Stripe handles payment processing
    │
    ├─ Success/Cancel Page
    │   └─ User sees confirmation
    │
    └─ Webhook Processing
        ├─ Bad signature? → Reject (400)
        ├─ Unknown event? → Log and ignore (200)
        └─ Process valid event → Fulfill (200)
```

---

## Test vs Live Mode

```
DEVELOPMENT (Test Mode)
├─ Use: sk_test_* keys
├─ Test Cards: 4242 4242 4242 4242, etc.
├─ No real charges
└─ Perfect for testing

       │
       ▼ (Verified working)

PRODUCTION (Live Mode)
├─ Use: sk_live_* keys
├─ Real Cards: Customer cards
├─ Real charges
└─ Monitor carefully
```

---

## Deployment Platforms

### Vercel
```
Routes:
  POST /api/create-checkout-session
  POST /api/webhook

Config: vercel.json
Env Vars: Dashboard → Settings → Environment Variables
Deploy: vercel push
```

### Netlify
```
Routes:
  POST /.netlify/functions/create-checkout-session
  POST /.netlify/functions/webhook

Config: netlify.toml
Env Vars: Site Settings → Environment
Deploy: Git push or netlify deploy
```

---

## Monitoring & Alerts

### Stripe Dashboard
- Payments section: View all transactions
- Webhooks section: Check delivery status
- Logs: View API requests

### Your Backend
- Log every webhook event
- Log fulfillment actions
- Alert on failures

### Recommendations
- Set up Slack/email alerts for failed webhooks
- Monitor error rates
- Track fulfillment success rate
- Test webhook resilience

---

## Disaster Recovery

```
If Webhook Fails:
  ├─ Stripe retries automatically (24 hours)
  ├─ Check Stripe Dashboard → Webhooks → Recent Deliveries
  ├─ Manually trigger fulfillment if needed
  └─ Implement idempotent processing (safe retries)

If Backend Down:
  ├─ Stripe queues webhook events
  ├─ Retry when backend comes back online
  └─ Process all pending events

If Customer Doesn't Get Fulfillment:
  ├─ Check webhook delivery logs
  ├─ Verify signature validation passed
  ├─ Check fulfillment logic for errors
  └─ Manually fulfill if needed
```

---

## Performance

### Response Times (Typical)
- Create session: 200-500ms
- Checkout page load: 1-2s
- Payment processing: 2-5s
- Webhook delivery: <5 minutes

### Scaling
- Serverless functions auto-scale
- No database load (if using external fulfillment service)
- Stripe handles payment scaling
- Consider webhook queue if high volume

---

## Compliance

### PCI DSS
✅ Handled by Stripe (hosted checkout)
✅ No card data on your servers
✅ TLS 1.2+ for all connections

### GDPR
✅ Get customer consent before checkout
✅ Store data per regulations
✅ Allow customers to delete data

### Payment Card Network Rules
✅ Stripe Checkout compliant
✅ Signature verification included
✅ Webhook timeout handling built-in

---

**For more details, see STRIPE_SETUP.md or STRIPE_QUICK_START.md**
