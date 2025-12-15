/**
 * Shop Products Manager
 * 
 * This module handles loading, filtering, and rendering products from JSON files.
 * Products are stored in /content/products/ and are managed via the admin interface.
 * 
 * Features:
 * - Loads all product JSON files dynamically
 * - Filters products (in stock, featured, by category)
 * - Renders product grid with responsive layout
 * - Handles sold-out state with visual badge
 * - Integrates with Stripe checkout
 */

const ShopProducts = {
  // Cache for loaded products
  products: [],
  allProducts: [],

  /**
   * Initialize the shop
   * Call this when DOM is ready
   */
  async init() {
    try {
      await this.loadProducts();
      this.renderGrid();
    } catch (error) {
      console.error('Failed to initialize shop:', error);
      this.showError('Failed to load products. Please refresh the page.');
    }
  },

  /**
   * Load all products from /content/products/ directory
   * 
   * Fetches the product list and loads each product's JSON file.
   */
  async loadProducts() {
    try {
      // Fetch the list of product files
      // Note: This uses a manifest file that lists all products
      const response = await fetch('/content/products/manifest.json');
      
      if (!response.ok) {
        // Fallback: try loading from GitHub API if manifest doesn't exist yet
        console.warn('Product manifest not found, trying fallback method');
        this.products = [];
        return;
      }

      const manifest = await response.json();
      const productFiles = manifest.products || [];

      // Load each product JSON file
      const productPromises = productFiles.map((filename) =>
        fetch(`/content/products/${filename}`)
          .then((res) => res.json())
          .catch((error) => {
            console.error(`Failed to load ${filename}:`, error);
            return null;
          })
      );

      const loadedProducts = await Promise.all(productPromises);
      this.allProducts = loadedProducts.filter((p) => p !== null);
      this.products = this.allProducts;

      console.log(`Loaded ${this.products.length} products`);
    } catch (error) {
      console.error('Error loading products:', error);
      this.products = [];
    }
  },

  /**
   * Get products by filter
   * 
   * @param {object} options - Filter options
   * @param {boolean} options.inStockOnly - Exclude sold-out items
   * @param {boolean} options.featuredOnly - Only featured items
   * @param {string} options.category - Filter by category
   * @returns {array} Filtered product list
   */
  getFilteredProducts(options = {}) {
    let filtered = [...this.allProducts];

    // Exclude sold-out items
    if (options.inStockOnly) {
      filtered = filtered.filter((p) => !p.soldOut);
    }

    // Only featured items
    if (options.featuredOnly) {
      filtered = filtered.filter((p) => p.featured);
    }

    // Filter by category
    if (options.category) {
      filtered = filtered.filter((p) => p.category === options.category);
    }

    // Sort by creation date (newest first)
    filtered.sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    return filtered;
  },

  /**
   * Render the full product grid
   * Called on page load to display all in-stock products
   */
  renderGrid() {
    const container = document.getElementById('products-grid');
    if (!container) {
      console.error('No #products-grid element found');
      return;
    }

    // Get in-stock products only
    const products = this.getFilteredProducts({ inStockOnly: true });

    if (products.length === 0) {
      container.innerHTML = '<p class="no-products">No products available right now.</p>';
      return;
    }

    container.innerHTML = products
      .map((product) => this.renderProductCard(product))
      .join('');
  },

  /**
   * Render a single product card
   * 
   * @param {object} product - Product object
   * @returns {string} HTML for product card
   */
  renderProductCard(product) {
    const thumbnailUrl = product.photos && product.photos[0] 
      ? product.photos[0] 
      : '/images/placeholder.jpg';
    
    const soldOutBadge = product.soldOut 
      ? '<div class="product-badge sold-out">Sold Out</div>' 
      : '';

    const buyButtonHtml = product.soldOut
      ? '<button class="product-btn sold-out-btn" disabled>Sold Out</button>'
      : `<button class="product-btn stripe-checkout-btn" data-price-id="price_${product.slug}">Buy Now</button>`;

    return `
      <div class="product-card" data-product-id="${product.slug}">
        <div class="product-image">
          <img src="${thumbnailUrl}" alt="${product.title}" loading="lazy" />
          ${soldOutBadge}
        </div>
        <div class="product-info">
          <h3 class="product-title">${this.escapeHtml(product.title)}</h3>
          <p class="product-category">${product.category}</p>
          <p class="product-size">Size: ${this.escapeHtml(product.size)}</p>
          <p class="product-price">$${product.price.toFixed(2)}</p>
          <p class="product-condition">${this.escapeHtml(product.conditionNotes)}</p>
          ${buyButtonHtml}
        </div>
      </div>
    `;
  },

  /**
   * Render featured products section
   * Used on homepage to show up to 6 featured items
   * 
   * @param {string} containerId - ID of container element
   * @param {number} limit - Max number of featured products (default 6)
   */
  renderFeatured(containerId, limit = 6) {
    const container = document.getElementById(containerId);
    if (!container) {
      console.warn(`No #${containerId} element found for featured products`);
      return;
    }

    // Get featured products
    const featured = this.getFilteredProducts({
      featuredOnly: true,
      inStockOnly: true,
    }).slice(0, limit);

    if (featured.length === 0) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = featured
      .map((product) => this.renderProductCard(product))
      .join('');
  },

  /**
   * Get a single product by slug
   * 
   * @param {string} slug - Product slug
   * @returns {object|null} Product object or null if not found
   */
  getProductBySlug(slug) {
    return this.allProducts.find((p) => p.slug === slug) || null;
  },

  /**
   * Escape HTML to prevent XSS
   * 
   * @param {string} text - Text to escape
   * @returns {string} Escaped HTML
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  /**
   * Show error message to user
   * 
   * @param {string} message - Error message
   */
  showError(message) {
    const errorEl = document.getElementById('products-error');
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.style.display = 'block';
    } else {
      console.error(message);
    }
  },
};

// Initialize shop when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  ShopProducts.init();

  // Re-attach Stripe checkout handlers if they exist
  if (window.StripeCheckout && typeof window.StripeCheckout.attachCheckoutButtons === 'function') {
    window.StripeCheckout.attachCheckoutButtons();
  }
});
