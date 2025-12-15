/**
 * Stripe Checkout Session Creation Endpoint
 * 
 * This serverless function creates a Stripe Checkout Session and returns
 * the URL to which the client should be redirected.
 * 
 * Deployment: Vercel / Netlify
 * Environment Variables Required:
 *   - STRIPE_SECRET_KEY: Your Stripe secret API key
 */

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

/**
 * POST /api/create-checkout-session
 * 
 * Request body: { priceId: "price_xxxxx" }
 * Returns: { url: "https://checkout.stripe.com/pay/..." }
 */
module.exports = async (req, res) => {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { priceId } = req.body;

    // Validate priceId is provided and is a string
    if (!priceId || typeof priceId !== 'string') {
      return res.status(400).json({ error: 'priceId is required' });
    }

    // Validate priceId format (basic check: should start with 'price_')
    if (!priceId.startsWith('price_')) {
      return res.status(400).json({ error: 'Invalid priceId format' });
    }

    // Determine the origin for success/cancel URLs
    // For Vercel/Netlify: use headers to construct absolute URL
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
    const origin = `${protocol}://${host}`;

    // Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      // Success and cancel URLs
      // Replace {CHECKOUT_SESSION_ID} if you need to reference the session ID
      success_url: `${origin}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/canceled.html`,
      // Optional: Customer email
      // customer_email: req.body.email,
    });

    // Return the session URL to the client
    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Stripe session creation error:', err);

    // Return appropriate error to client
    if (err.type === 'StripeInvalidRequestError') {
      return res.status(400).json({ error: err.message });
    }

    res.status(500).json({ error: 'Internal server error' });
  }
};
