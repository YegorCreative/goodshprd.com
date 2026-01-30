/**
 * Shop Functionality
 * Fetches product data and renders grid
 */

document.addEventListener('DOMContentLoaded', () => {
  const grid = document.getElementById('products-grid');
  const errorContainer = document.getElementById('products-error');

  if (!grid) return;

  fetch('data/products.json')
    .then(response => {
      if (!response.ok) throw new Error('Failed to load products');
      return response.json();
    })
    .then(products => {
      renderProducts(products, grid);
    })
    .catch(err => {
      console.error(err);
      if (errorContainer) {
        errorContainer.style.display = 'block';
        errorContainer.textContent = 'Unable to load collection. Please try again later.';
      }
      grid.innerHTML = '';
    });
});

function renderProducts(products, container) {
  if (products.length === 0) {
    container.innerHTML = '<div class="no-products">No products found.</div>';
    return;
  }

  container.innerHTML = products.map(product => {
    // Determine badges
    let badgesHtml = '';
    if (!product.available) {
      badgesHtml += '<span class="product-badge badge-sold">Sold</span>';
    } else if (product.restored) {
      badgesHtml += '<span class="product-badge badge-restored">Restored</span>';
    }

    const badgeContainer = badgesHtml ? `<div class="product-badges">${badgesHtml}</div>` : '';

    // Button text
    const buttonText = product.available ? 'View Details' : 'Sold Out';
    const buttonClass = product.available ? 'button button-secondary product-button' : 'button button-secondary product-button disabled';

    return `
            <article class="product-card" data-category="${product.category}" data-era="${product.era}">
                <div class="product-image">
                    ${badgeContainer}
                    <div class="placeholder-image"></div>
                    <img data-src="${product.image}" alt="${product.name}" class="lazy-image">
                </div>
                <div class="product-info">
                    <h3 class="product-name">${product.name}</h3>
                    <p class="product-description">${product.era} | ${product.condition} | ${product.size}</p>
                    <p class="product-price">$${product.price}</p>
                    <a href="#" class="button button-secondary product-button" ${!product.available ? 'style="opacity: 0.5; pointer-events: none;"' : ''}>${buttonText}</a>
                </div>
            </article>
        `;
  }).join('');

  // Trigger lazy load
  initShopLazyLoad(container);
}

// Internal lazy load handler since the global one might be private or already run
function initShopLazyLoad(container) {
  const images = container.querySelectorAll('img[data-src]');

  const loadImg = (img) => {
    img.src = img.dataset.src;
    img.onload = () => img.classList.add('loaded');
    img.removeAttribute('data-src');
  };

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          loadImg(entry.target);
          observer.unobserve(entry.target);
        }
      });
    });
    images.forEach(img => observer.observe(img));
  } else {
    images.forEach(loadImg);
  }
}
