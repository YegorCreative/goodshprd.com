/**
 * Product Detail Functionality
 * Fetches product data and renders the detail page
 */

document.addEventListener('DOMContentLoaded', () => {
    const errorContainer = document.getElementById('productError');
    const contentContainer = document.getElementById('productContent');
    const relatedSection = document.getElementById('relatedSection');

    // Get Product ID from URL
    const params = new URLSearchParams(window.location.search);
    const productId = params.get('id');

    if (!productId) {
        showError();
        return;
    }

    // Fetch Data
    fetch('data/products.json')
        .then(response => {
            if (!response.ok) throw new Error('Failed to load products');
            return response.json();
        })
        .then(products => {
            const product = products.find(p => p.id === productId);
            if (product) {
                renderProduct(product);
                renderRelated(product, products);
            } else {
                showError();
            }
        })
        .catch(err => {
            console.error(err);
            showError();
        });

    function showError() {
        if (contentContainer) contentContainer.style.display = 'none';
        if (relatedSection) relatedSection.style.display = 'none';
        if (errorContainer) errorContainer.style.display = 'block';
    }

    function renderProduct(product) {
        if (errorContainer) errorContainer.style.display = 'none';
        if (contentContainer) contentContainer.style.display = 'block';

        // Set Page Title
        document.title = `${product.name} | Good Shepherd`;

        // Populate Basic Info
        setText('productTitle', product.name);
        setText('productMeta', `${capitalize(product.category)} · ${product.era} · ${product.size}`);
        setText('productPrice', `$${product.price}`);
        setText('productDescription', product.description);

        // Availability Wrapper
        const availContainer = document.getElementById('productAvailability');
        if (availContainer) {
            if (product.available) {
                availContainer.innerHTML = `<span class="availability-badge badge-available">Available</span>`;
            } else {
                availContainer.innerHTML = `<span class="availability-badge badge-sold-detail">Sold</span>`;
            }
        }

        // Image
        const imgContainer = document.getElementById('productImageContainer');
        if (imgContainer) {
            imgContainer.innerHTML = `
                <div class="placeholder-image"></div>
                <img src="${product.image}" alt="${product.name}" class="fade-in-image" onload="this.classList.add('loaded')">
            `;
        }

        // Actions
        const actionContainer = document.getElementById('productActions');
        if (actionContainer) {
            if (product.available) {
                actionContainer.innerHTML = `
                    <a href="appointments.html" class="button button-primary">Book Wardrobe Appointment</a>
                    <a href="contact.html?subject=Inquiry: ${product.name} (${product.id})" class="button button-secondary">Contact About This Piece</a>
                `;
            } else {
                actionContainer.innerHTML = `
                    <p style="margin-bottom: 1rem; color: #6B5E4A;">This piece has found a new home.</p>
                    <a href="shop.html?category=${product.category}" class="button button-secondary">Browse Similar Pieces</a>
                `;
            }
        }

        // Dynamic Sections
        const sectionContainer = document.getElementById('productSections');
        if (sectionContainer) {
            let sectionsHtml = '';

            // Standard/Sample Content logic if fields existed, 
            // but for now we'll imply them or check if JSON has them.
            // Since JSON currently just has "restored" and basic fields, we can add a generic blurb for restored items.

            if (product.restored) {
                sectionsHtml += `
                    <div class="detail-block">
                        <h4>Restoration</h4>
                        <p>This piece has been carefully inspected and restored by hand. Sewing, cleaning, and conditioning have been performed to ensure it’s ready for wear.</p>
                    </div>
                `;
            }

            // Always add a care section
            sectionsHtml += `
                <div class="detail-block">
                    <h4>Care</h4>
                    <p>Vintage garments require gentle care. We recommend spot cleaning or professional dry cleaning when necessary.</p>
                </div>
            `;

            sectionContainer.innerHTML = sectionsHtml;
        }
    }

    function renderRelated(currentProduct, allProducts) {
        const relatedGrid = document.getElementById('relatedGrid');
        if (!relatedGrid) return;

        // Filter: Same category, not current product, prioritize available
        let related = allProducts
            .filter(p => p.category === currentProduct.category && p.id !== currentProduct.id)
            .sort((a, b) => (b.available === a.available) ? 0 : b.available ? 1 : -1) // Available first
            .slice(0, 3); // Max 3

        if (related.length === 0) {
            if (relatedSection) relatedSection.style.display = 'none';
            return;
        }

        if (relatedSection) relatedSection.style.display = 'block';

        relatedGrid.innerHTML = related.map(p => {
            const buttonText = p.available ? 'View Details' : 'Sold Out';
            return `
                <article class="product-card">
                    <a href="product.html?id=${p.id}" class="product-card-link">
                        <div class="product-image">
                            ${!p.available ? '<div class="product-badges"><span class="product-badge badge-sold">Sold</span></div>' : ''}
                            <div class="placeholder-image"></div>
                            <img src="${p.image}" alt="${p.name}" class="lazy-image" style="opacity: 1;"> 
                        </div>
                        <div class="product-info">
                            <h3 class="product-name">${p.name}</h3>
                            <p class="product-description">${p.era} | ${p.size}</p>
                            <p class="product-price">$${p.price}</p>
                            <span class="button button-secondary product-button" style="${!p.available ? 'opacity: 0.5' : ''}">${buttonText}</span>
                        </div>
                    </a>
                </article>
            `;
        }).join('');
    }

    function setText(id, text) {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    }

    function capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
});
