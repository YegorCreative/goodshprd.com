/**
 * Stripe Checkout Session Creation Endpoint (Netlify Version)
 * 
 * IMPORTANT: For Netlify functions, place this in:
 * netlify/functions/create-checkout-session.js
 * 
 * This version handles Netlify's function structure.
 */

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

/**
 * Lambda handler for Netlify Functions
 */
exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const body = JSON.parse(event.body);
    const { priceId } = body;

    // Validate priceId is provided and is a string
    if (!priceId || typeof priceId !== 'string') {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'priceId is required' }),
      };
    }

    // Validate priceId format (basic check: should start with 'price_')
    if (!priceId.startsWith('price_')) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid priceId format' }),
      };
    }

    // Determine the origin for success/cancel URLs
    const protocol = event.headers['x-forwarded-proto'] || 'https';
    const host = event.headers['x-forwarded-host'] || event.headers.host || 'localhost:3000';
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
      success_url: `${origin}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/canceled.html`,
    });

    // Return the session URL to the client
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: session.url }),
    };
  } catch (err) {
    console.error('Stripe session creation error:', err);

    if (err.type === 'StripeInvalidRequestError') {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: err.message }),
      };
    }

    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
