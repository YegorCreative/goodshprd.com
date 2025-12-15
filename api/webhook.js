/**
 * Stripe Webhook Endpoint
 * 
 * This serverless function handles Stripe webhook events.
 * It verifies the webhook signature and processes payment confirmations.
 * 
 * Deployment: Vercel / Netlify
 * Environment Variables Required:
 *   - STRIPE_SECRET_KEY: Your Stripe secret API key
 *   - STRIPE_WEBHOOK_SECRET: Your Stripe webhook signing secret
 */

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

/**
 * POST /api/webhook
 * 
 * This endpoint receives Stripe webhook events.
 * It verifies the signature and processes checkout.session.completed events.
 */
module.exports = async (req, res) => {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get the raw body and signature from headers
    const sig = req.headers['stripe-signature'];
    const rawBody = req.rawBody || req.body;

    if (!sig) {
      return res.status(400).json({ error: 'Missing stripe-signature header' });
    }

    // Verify the webhook signature
    // Note: For Vercel/Netlify, the raw body must be passed as-is (not parsed)
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        rawBody,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).json({ error: 'Invalid signature' });
    }

    // Handle the checkout.session.completed event
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;

      // Log the session for debugging/monitoring
      console.log('✓ Payment successful:', {
        sessionId: session.id,
        customerId: session.customer,
        paymentStatus: session.payment_status,
        amount: session.amount_total,
        currency: session.currency,
      });

      // TODO: Fulfillment logic
      // - Verify payment_status is 'paid'
      // - Look up the order/customer in your database
      // - Mark the order as paid
      // - Send confirmation email
      // - Grant access to purchased content
      // - etc.

      // Example stub:
      // await markOrderAsPaid(session.id);
      // await sendConfirmationEmail(session.customer_email);

      return res.status(200).json({ received: true });
    }

    // Handle other events as needed
    if (event.type === 'checkout.session.expired') {
      console.log('Checkout session expired:', event.data.object.id);
      // Handle expiration if needed
    }

    if (event.type === 'charge.refunded') {
      console.log('Charge refunded:', event.data.object.id);
      // Handle refund if needed
    }

    // Acknowledge receipt of the event
    res.status(200).json({ received: true });
  } catch (err) {
    console.error('Webhook processing error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * IMPORTANT: Netlify/Vercel Configuration
 * 
 * For these platforms to pass the raw body to your function,
 * configure your function to receive raw body:
 * 
 * Netlify (netlify.toml):
 *   [functions]
 *   node_bundler = "esbuild"
 * 
 * And in your function definition, use this pattern:
 *   export default async (req, res) => { ... }
 * 
 * Vercel (vercel.json):
 *   {
 *     "functions": {
 *       "api/webhook.js": {
 *         "memory": 1024,
 *         "maxDuration": 60
 *       }
 *     }
 *   }
 * 
 * Alternatively, use middleware to capture raw body before Express parsing.
 */
