/**
 * Shop Functionality
 * Fetches product data, handles filtering, sorting, and rendering
 */

document.addEventListener('DOMContentLoaded', () => {
  const grid = document.getElementById('products-grid');
  const errorContainer = document.getElementById('products-error');
  const resultsCount = document.getElementById('resultsCount');

  // Filter Elements
  const filterCategory = document.getElementById('filterCategory');
  const filterSize = document.getElementById('filterSize');
  const filterEra = document.getElementById('filterEra');
  const filterAvailability = document.getElementById('filterAvailability');
  const sortBy = document.getElementById('sortBy');

  let allProducts = [];

  if (!grid) return;

  // Fetch Data
  fetch('data/products.json')
    .then(response => {
      if (!response.ok) throw new Error('Failed to load products');
      return response.json();
    })
    .then(products => {
      allProducts = products;
      initializeShop();
    })
    .catch(err => {
      console.error(err);
      if (errorContainer) {
        errorContainer.style.display = 'block';
        errorContainer.textContent = 'Unable to load collection. Please try again later.';
      }
      grid.innerHTML = '';
    });

  function initializeShop() {
    populateFilters();
    readUrlParams();
    applyFiltersAndSort();

    // Add Event Listeners
    [filterCategory, filterSize, filterEra, filterAvailability, sortBy].forEach(el => {
      if (el) el.addEventListener('change', () => {
        updateUrlParams();
        applyFiltersAndSort();
      });
    });
  }

  function populateFilters() {
    const categories = [...new Set(allProducts.map(p => p.category))].sort();
    const sizes = [...new Set(allProducts.map(p => p.size))].sort();
    const eras = [...new Set(allProducts.map(p => p.era))].sort();

    populateSelect(filterCategory, categories);
    populateSelect(filterSize, sizes);
    populateSelect(filterEra, eras);
  }

  function populateSelect(selectElement, options) {
    if (!selectElement) return;
    // Keep the first "All" option
    const firstOption = selectElement.options[0];
    selectElement.innerHTML = '';
    selectElement.appendChild(firstOption);

    options.forEach(option => {
      const el = document.createElement('option');
      el.value = option;
      el.textContent = capitalize(option);
      selectElement.appendChild(el);
    });
  }

  function applyFiltersAndSort() {
    const category = filterCategory ? filterCategory.value : 'all';
    const size = filterSize ? filterSize.value : 'all';
    const era = filterEra ? filterEra.value : 'all';
    const availability = filterAvailability ? filterAvailability.value : 'all';
    const sort = sortBy ? sortBy.value : 'newest';

    let filtered = allProducts.filter(product => {
      if (category !== 'all' && product.category !== category) return false;
      if (size !== 'all' && product.size !== size) return false;
      if (era !== 'all' && product.era !== era) return false;

      if (availability === 'available' && !product.available) return false;
      if (availability === 'sold' && product.available) return false;

      return true;
    });

    // Sorting
    if (sort === 'priceAsc') {
      filtered.sort((a, b) => a.price - b.price);
    } else if (sort === 'priceDesc') {
      filtered.sort((a, b) => b.price - a.price);
    } else {
      // Newest (Default) - assuming original order is newest or IDs are chronological
      // If explicit date field existed, we'd sort by that.
      // For now, reverse index check or just existing order is fine if JSON is ordered new->old.
      // Let's assume JSON is new->old for this implementation.
    }

    renderProducts(filtered, grid);
    updateResultsCount(filtered.length, allProducts.length);
  }

  function renderProducts(products, container) {
    if (products.length === 0) {
      container.innerHTML = `
                <div class="no-products" style="grid-column: 1/-1; text-align: center; padding: 4rem 1rem;">
                    <p style="color: #6B5E4A; margin-bottom: 1rem;">No pieces match these filters.</p>
                    <button type="button" class="text-link" id="resetFiltersInner">Reset filters</button>
                </div>
            `;

      const resetBtn = document.getElementById('resetFiltersInner');
      if (resetBtn) resetBtn.addEventListener('click', resetFilters);
      return;
    }

    container.innerHTML = products.map(product => {
      let badgesHtml = '';
      if (!product.available) {
        badgesHtml += '<span class="product-badge badge-sold">Sold</span>';
      } else if (product.restored) {
        badgesHtml += '<span class="product-badge badge-restored">Restored</span>';
      }

      const badgeContainer = badgesHtml ? `<div class="product-badges">${badgesHtml}</div>` : '';
      const buttonText = product.available ? 'View Details' : 'Sold Out';

      return `
                <article class="product-card">
                    <a href="product.html?id=${product.id}" class="product-card-link" aria-label="View details for ${product.name}">
                        <div class="product-image">
                            ${badgeContainer}
                            <div class="placeholder-image"></div>
                            <img data-src="${product.image}" alt="${product.name}" class="lazy-image">
                        </div>
                        <div class="product-info">
                            <h3 class="product-name">${product.name}</h3>
                            <p class="product-description">${product.era} | ${product.condition} | ${product.size}</p>
                            <p class="product-price">$${product.price}</p>
                            <span class="button button-secondary product-button" ${!product.available ? 'style="opacity: 0.5;"' : ''}>${buttonText}</span>
                        </div>
                    </a>
                </article>
            `;
    }).join('');

    initShopLazyLoad(container);
  }

  function updateResultsCount(count, total) {
    if (!resultsCount) return;

    let text = `Showing ${count} of ${total} pieces`;
    if (count < total) {
      text += ` <button type="button" class="text-link" id="resetFiltersMain" style="font-size: 0.85rem; margin-left: 0.5rem; border: none; background: none; cursor: pointer; text-decoration: underline;">(Reset)</button>`;
    }
    resultsCount.innerHTML = text;

    const mainReset = document.getElementById('resetFiltersMain');
    if (mainReset) mainReset.addEventListener('click', resetFilters);
  }

  function resetFilters() {
    if (filterCategory) filterCategory.value = 'all';
    if (filterSize) filterSize.value = 'all';
    if (filterEra) filterEra.value = 'all';
    if (filterAvailability) filterAvailability.value = 'all';
    if (sortBy) sortBy.value = 'newest';

    updateUrlParams();
    applyFiltersAndSort();
  }

  function updateUrlParams() {
    const params = new URLSearchParams();

    if (filterCategory && filterCategory.value !== 'all') params.set('category', filterCategory.value);
    if (filterSize && filterSize.value !== 'all') params.set('size', filterSize.value);
    if (filterEra && filterEra.value !== 'all') params.set('era', filterEra.value);
    if (filterAvailability && filterAvailability.value !== 'all') params.set('availability', filterAvailability.value);
    if (sortBy && sortBy.value !== 'newest') params.set('sort', sortBy.value);

    const newUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
    window.history.replaceState({}, '', newUrl);
  }

  function readUrlParams() {
    const params = new URLSearchParams(window.location.search);

    if (filterCategory && params.has('category')) filterCategory.value = params.get('category');
    if (filterSize && params.has('size')) filterSize.value = params.get('size');
    if (filterEra && params.has('era')) filterEra.value = params.get('era');
    if (filterAvailability && params.has('availability')) filterAvailability.value = params.get('availability');
    if (sortBy && params.has('sort')) sortBy.value = params.get('sort');
  }

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

  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
});
