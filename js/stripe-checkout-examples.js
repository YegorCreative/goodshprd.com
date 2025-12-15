/**
 * STRIPE CHECKOUT EXAMPLES
 * 
 * This file contains practical examples for common use cases.
 * Copy and adapt these patterns to your application.
 */

// ============================================================================
// EXAMPLE 1: Basic Purchase Button
// ============================================================================

// HTML:
// <button id="basic-purchase" class="stripe-checkout-btn" data-price-id="price_1A2B3C4D">
//   Purchase - $19.99
// </button>

// No JavaScript needed! The script auto-attaches handlers.
// Just add the class and data-price-id attribute.


// ============================================================================
// EXAMPLE 2: Multiple Products on Same Page
// ============================================================================

// HTML:
// <div class="product-grid">
//   <div class="product-card">
//     <h3>Starter Plan</h3>
//     <p>$9.99/month</p>
//     <button class="stripe-checkout-btn" data-price-id="price_starter">
//       Get Started
//     </button>
//   </div>
//   
//   <div class="product-card">
//     <h3>Pro Plan</h3>
//     <p>$19.99/month</p>
//     <button class="stripe-checkout-btn" data-price-id="price_pro">
//       Get Pro
//     </button>
//   </div>
//   
//   <div class="product-card">
//     <h3>Enterprise Plan</h3>
//     <p>Custom Pricing</p>
//     <button class="stripe-checkout-btn" data-price-id="price_enterprise">
//       Contact Sales
//     </button>
//   </div>
// </div>

// The script handles all buttons automatically.


// ============================================================================
// EXAMPLE 3: Dynamic Button Creation
// ============================================================================

// If you create buttons dynamically:

function createDynamicButton(priceId, text) {
  const button = document.createElement('button');
  button.className = 'stripe-checkout-btn';
  button.setAttribute('data-price-id', priceId);
  button.textContent = text;
  
  // After adding to DOM, re-attach handlers
  document.body.appendChild(button);
  StripeCheckout.attachCheckoutButtons();
}

// Usage:
// createDynamicButton('price_1A2B3C4D', 'Buy Now');


// ============================================================================
// EXAMPLE 4: Custom Checkout Function with Parameters
// ============================================================================

// Advanced: Programmatically start checkout with additional data

async function purchaseWithCustomData(priceId, userData) {
  try {
    // Call your backend to create session with custom data
    const response = await fetch('/api/create-checkout-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        priceId,
        // Optional: pass additional metadata to your backend
        email: userData.email,
        customerId: userData.id,
      }),
    });

    if (!response.ok) {
      throw new Error('Checkout creation failed');
    }

    const { url } = await response.json();
    window.location.href = url;
  } catch (error) {
    console.error('Error:', error);
    alert('Payment processing failed. Please try again.');
  }
}

// Usage:
// purchaseWithCustomData('price_1A2B3C4D', { email: 'user@example.com', id: '123' });


// ============================================================================
// EXAMPLE 5: Webhook Fulfillment Logic (Backend - Node.js)
// ============================================================================

// In your api/webhook.js, expand the checkout.session.completed handler:

const exampleWebhookFulfillment = async (session) => {
  // 1. Verify payment is completed
  if (session.payment_status !== 'paid') {
    console.log('Payment not yet completed for session:', session.id);
    return;
  }

  // 2. Look up customer in your database
  const customerId = session.customer_details?.email || session.customer;
  // const user = await db.users.findByEmail(customerId);

  // 3. Log the successful payment
  // await db.orders.create({
  //   stripeSessionId: session.id,
  //   userId: user.id,
  //   amount: session.amount_total,
  //   currency: session.currency,
  //   status: 'paid',
  //   createdAt: new Date(),
  // });

  // 4. Send confirmation email
  // await sendEmail({
  //   to: customerId,
  //   subject: 'Order Confirmed',
  //   body: `Thank you for your purchase of $${session.amount_total / 100}.`,
  // });

  // 5. Grant access (e.g., activate subscription)
  // await db.users.update(user.id, {
  //   subscriptionStatus: 'active',
  //   subscriptionEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
  // });

  // 6. Log success
  console.log('Order fulfilled:', {
    sessionId: session.id,
    customerId,
    amount: session.amount_total,
  });
};


// ============================================================================
// EXAMPLE 6: Display Order Details on Success Page
// ============================================================================

// In success.html or in a script tag:

async function displayOrderDetails() {
  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get('session_id');

  if (!sessionId) return;

  try {
    // Note: You can't call Stripe API from frontend (no secret key)
    // Instead, create a backend endpoint to fetch session details:
    // const response = await fetch(`/api/session/${sessionId}`);
    // const session = await response.json();

    // For now, just display the session ID
    document.getElementById('session-display').textContent = sessionId;

    // Optionally redirect to account page after 5 seconds
    // setTimeout(() => {
    //   window.location.href = '/account';
    // }, 5000);
  } catch (error) {
    console.error('Error loading order details:', error);
  }
}

// Call on page load:
// document.addEventListener('DOMContentLoaded', displayOrderDetails);


// ============================================================================
// EXAMPLE 7: Backend Endpoint to Fetch Session Details
// ============================================================================

// Create a new file: api/get-session.js

const exampleGetSessionEndpoint = async (req, res) => {
  // GET /api/session/:sessionId
  const { sessionId } = req.query || req.params;

  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId required' });
  }

  try {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // Return only safe data to frontend
    return res.status(200).json({
      id: session.id,
      amount: session.amount_total,
      currency: session.currency,
      customer_email: session.customer_email,
      payment_status: session.payment_status,
    });
  } catch (error) {
    console.error('Error fetching session:', error);
    return res.status(500).json({ error: 'Failed to fetch session' });
  }
};


// ============================================================================
// EXAMPLE 8: Email Confirmation Template
// ============================================================================

// Example email body for confirmation:

const exampleEmailTemplate = (session) => `
  <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.5; color: #333;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        
        <h2 style="color: #667eea;">Thank You for Your Purchase!</h2>
        
        <p>Your order has been successfully processed.</p>
        
        <div style="background: #f5f5f5; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <p><strong>Order Details:</strong></p>
          <ul style="list-style: none; padding: 0;">
            <li><strong>Order ID:</strong> ${session.id}</li>
            <li><strong>Amount:</strong> $${(session.amount_total / 100).toFixed(2)}</li>
            <li><strong>Date:</strong> ${new Date().toLocaleDateString()}</li>
            <li><strong>Status:</strong> Paid</li>
          </ul>
        </div>
        
        <p>Your subscription will be activated immediately and you can start using all features.</p>
        
        <p>
          <a href="https://yoursite.com/account" style="background: #667eea; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">
            Go to Account
          </a>
        </p>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
        
        <p style="font-size: 12px; color: #999;">
          If you have questions, contact us at support@yoursite.com
        </p>
        
      </div>
    </body>
  </html>
`;


// ============================================================================
// EXAMPLE 9: Error Handling with Retry Logic
// ============================================================================

async function purchaseWithRetry(priceId, maxRetries = 3) {
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      await StripeCheckout.redirectToCheckout(priceId);
      return; // Success
    } catch (error) {
      attempt++;
      console.warn(`Attempt ${attempt} failed:`, error);

      if (attempt < maxRetries) {
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      } else {
        // All retries exhausted
        const message = 'Payment processing failed after multiple attempts. Please try again later.';
        StripeCheckout.showError(message);
        throw error;
      }
    }
  }
}

// Usage:
// purchaseWithRetry('price_1A2B3C4D');


// ============================================================================
// EXAMPLE 10: Analytics Tracking
// ============================================================================

// Track checkout events (e.g., for Google Analytics):

function trackCheckoutEvent(priceId) {
  // Google Analytics example
  if (window.gtag) {
    gtag('event', 'begin_checkout', {
      price_id: priceId,
      timestamp: new Date().toISOString(),
    });
  }

  // Custom event
  window.dispatchEvent(new CustomEvent('stripe-checkout-start', {
    detail: { priceId },
  }));
}

function trackCheckoutSuccess(sessionId) {
  if (window.gtag) {
    gtag('event', 'purchase', {
      session_id: sessionId,
      timestamp: new Date().toISOString(),
    });
  }
}

// Listen for success page
document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get('session_id');
  if (sessionId) {
    trackCheckoutSuccess(sessionId);
  }
});


// ============================================================================
// EXAMPLE 11: Localization (Multiple Currencies)
// ============================================================================

// Store different prices for different currencies:

const PRODUCTS = {
  starter: {
    usd: 'price_starter_usd',
    eur: 'price_starter_eur',
    gbp: 'price_starter_gbp',
  },
  pro: {
    usd: 'price_pro_usd',
    eur: 'price_pro_eur',
    gbp: 'price_pro_gbp',
  },
};

function getPriceIdForCurrency(plan, currency = 'usd') {
  return PRODUCTS[plan]?.[currency.toLowerCase()] || PRODUCTS[plan]?.usd;
}

// HTML with dynamic prices:
// <button class="stripe-checkout-btn" data-price-id="price_starter_usd" data-plan="starter">
//   Buy Starter
// </button>

// Update price when currency changes:
function handleCurrencyChange(newCurrency) {
  const buttons = document.querySelectorAll('.stripe-checkout-btn');
  buttons.forEach(btn => {
    const plan = btn.getAttribute('data-plan');
    const newPriceId = getPriceIdForCurrency(plan, newCurrency);
    btn.setAttribute('data-price-id', newPriceId);
  });
}


// ============================================================================
// EXPORT FOR USE IN OTHER FILES
// ============================================================================

window.StripeCheckoutExamples = {
  purchaseWithCustomData,
  exampleWebhookFulfillment,
  displayOrderDetails,
  exampleEmailTemplate,
  purchaseWithRetry,
  trackCheckoutEvent,
  trackCheckoutSuccess,
  getPriceIdForCurrency,
  handleCurrencyChange,
};
