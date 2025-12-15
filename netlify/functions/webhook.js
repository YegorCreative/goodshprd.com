/**
 * Stripe Webhook Endpoint (Netlify Version)
 * 
 * IMPORTANT: For Netlify functions, place this in:
 * netlify/functions/webhook.js
 * 
 * This version handles Netlify's function structure and raw body parsing.
 */

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Middleware to capture raw body before JSON parsing
const getRawBody = (event) => {
  if (event.isBase64Encoded) {
    return Buffer.from(event.body, 'base64').toString('utf-8');
  }
  return event.body;
};

/**
 * Lambda handler for Netlify Functions
 */
exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    // Get the raw body and signature from headers
    const sig = event.headers['stripe-signature'];
    const rawBody = getRawBody(event);

    if (!sig) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing stripe-signature header' }),
      };
    }

    // Verify the webhook signature
    let webhookEvent;
    try {
      webhookEvent = stripe.webhooks.constructEvent(
        rawBody,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid signature' }),
      };
    }

    // Handle the checkout.session.completed event
    if (webhookEvent.type === 'checkout.session.completed') {
      const session = webhookEvent.data.object;

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

      return {
        statusCode: 200,
        body: JSON.stringify({ received: true }),
      };
    }

    // Handle other events as needed
    if (webhookEvent.type === 'checkout.session.expired') {
      console.log('Checkout session expired:', webhookEvent.data.object.id);
    }

    if (webhookEvent.type === 'charge.refunded') {
      console.log('Charge refunded:', webhookEvent.data.object.id);
    }

    // Acknowledge receipt of the event
    return {
      statusCode: 200,
      body: JSON.stringify({ received: true }),
    };
  } catch (err) {
    console.error('Webhook processing error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
