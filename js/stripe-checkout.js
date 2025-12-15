/**
 * Stripe Checkout Integration
 * 
 * Frontend utility functions for Stripe Checkout integration.
 * This file is loaded in the browser and handles the UI flow.
 * 
 * SECURITY: The frontend only knows about priceId, never about secret keys.
 * Secret keys are only used server-side.
 */

const StripeCheckout = {
  /**
   * Initialize checkout for a given price.
   * 
   * Usage:
   *   StripeCheckout.redirectToCheckout('price_xxxxx')
   * 
   * @param {string} priceId - Stripe Price ID (e.g., "price_1A2B3C4D")
   * @returns {Promise<void>}
   */
  async redirectToCheckout(priceId) {
    try {
      // Show loading state (optional)
      this.setLoading(true);

      // Call the server endpoint to create a Checkout Session
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ priceId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create checkout session');
      }

      // Get the redirect URL from the server
      const data = await response.json();
      const checkoutUrl = data.url;

      // Redirect to Stripe Checkout
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
      } else {
        throw new Error('No checkout URL returned from server');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      this.showError(error.message || 'Checkout failed. Please try again.');
      this.setLoading(false);
    }
  },

  /**
   * Attach click handlers to "Buy Now" buttons.
   * 
   * HTML Usage:
   *   <button class="stripe-checkout-btn" data-price-id="price_xxxxx">
   *     Buy Now
   *   </button>
   * 
   * Call this function after DOM is loaded:
   *   StripeCheckout.attachCheckoutButtons()
   */
  attachCheckoutButtons() {
    const buttons = document.querySelectorAll('.stripe-checkout-btn');
    buttons.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const priceId = btn.getAttribute('data-price-id');
        if (!priceId) {
          console.error('Button missing data-price-id attribute');
          return;
        }
        this.redirectToCheckout(priceId);
      });
    });
  },

  /**
   * Check for success or cancellation query parameters.
   * Call this on checkout success/cancel pages.
   * 
   * Usage:
   *   StripeCheckout.checkSessionStatus()
   */
  checkSessionStatus() {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');

    if (sessionId) {
      // Success page: display confirmation
      console.log('Checkout succeeded. Session ID:', sessionId);
      this.showSuccess();
    } else if (window.location.pathname.includes('canceled')) {
      // Cancel page: display cancellation message
      console.log('Checkout was canceled');
      this.showCanceled();
    }
  },

  /**
   * Show error message to the user.
   * @param {string} message - Error message to display
   */
  showError(message) {
    const errorEl = document.getElementById('checkout-error');
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.style.display = 'block';
    } else {
      alert(`Error: ${message}`);
    }
  },

  /**
   * Show success message to the user.
   */
  showSuccess() {
    const successEl = document.getElementById('checkout-success');
    if (successEl) {
      successEl.style.display = 'block';
    }
  },

  /**
   * Show cancellation message to the user.
   */
  showCanceled() {
    const cancelEl = document.getElementById('checkout-canceled');
    if (cancelEl) {
      cancelEl.style.display = 'block';
    }
  },

  /**
   * Set loading state (e.g., disable buttons, show spinner).
   * @param {boolean} isLoading - Whether checkout is in progress
   */
  setLoading(isLoading) {
    const buttons = document.querySelectorAll('.stripe-checkout-btn');
    buttons.forEach((btn) => {
      btn.disabled = isLoading;
      btn.textContent = isLoading ? 'Processing...' : 'Buy Now';
    });

    // Optional: show spinner
    const spinner = document.getElementById('checkout-spinner');
    if (spinner) {
      spinner.style.display = isLoading ? 'block' : 'none';
    }
  },
};

// Auto-attach checkout buttons when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  StripeCheckout.attachCheckoutButtons();
  StripeCheckout.checkSessionStatus();
});
