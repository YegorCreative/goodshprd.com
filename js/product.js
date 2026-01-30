/**
 * Product Detail Functionality
 */

document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const productId = params.get('id');

    const els = {
        title: document.getElementById('productTitle'),
        meta: document.getElementById('productMeta'),
        error: document.getElementById('productError'),
        layout: document.getElementById('productLayout'),
        image: document.getElementById('productImage'),
        price: document.getElementById('productPrice'),
        availability: document.getElementById('productAvailability'),
        description: document.getElementById('productDescription'),
        badges: document.getElementById('productBadges'),
        ctas: document.getElementById('productCtas'),
        relatedGrid: document.getElementById('relatedGrid'),
        relatedSection: document.querySelector('.related-section')
    };

    if (!productId) {
        showError();
        return;
    }

    fetch('data/products.json')
        .then(res => {
            if (!res.ok) throw new Error('Failed to load data');
            return res.json();
        })
        .then(products => {
            const product = products.find(p => p.id === productId);
            if (!product) {
                showError();
                return;
            }
            renderProduct(product, products);
        })
        .catch(err => {
            console.error(err);
            showError();
        });

    function showError() {
        if (els.error) {
            els.error.textContent = 'We couldn’t find that piece. ';
            const link = document.createElement('a');
            link.href = 'shop.html';
            link.className = 'text-link';
            link.textContent = 'Browse the collection.';
            els.error.appendChild(link);
        }
        if (els.layout) els.layout.style.display = 'none';
        if (els.relatedSection) els.relatedSection.style.display = 'none';

        // Hide hero title text "Loading..." if error
        if (els.title) els.title.textContent = '';
    }

    function renderProduct(product, allProducts) {
        // Title
        if (els.title) els.title.textContent = product.name;

        // Meta: Category · Era · Size
        if (els.meta) {
            const cat = product.category.charAt(0).toUpperCase() + product.category.slice(1);
            els.meta.textContent = `${cat} · ${product.era} · ${product.size}`;
        }

        // Price
        if (els.price) {
            let pStr = String(product.price);
            if (!pStr.startsWith('$')) pStr = '$' + pStr;
            els.price.textContent = pStr;
        }

        // Availability Badge
        if (els.availability) {
            els.availability.classList.remove('is-available', 'is-sold');
            if (product.available) {
                els.availability.textContent = 'Available';
                els.availability.classList.add('is-available');
            } else {
                els.availability.textContent = 'Sold';
                els.availability.classList.add('is-sold');
            }
        }

        // Image
        if (els.image) {
            if (product.image) {
                els.image.src = product.image;
                els.image.alt = product.name;
                els.image.loading = 'eager';

                // Reset class
                els.image.classList.remove('loaded');

                const onImageLoad = () => {
                    els.image.classList.add('loaded');
                };

                if (els.image.complete) {
                    onImageLoad();
                } else {
                    els.image.addEventListener('load', onImageLoad, { once: true });
                    els.image.addEventListener('error', () => {
                        els.image.style.display = 'none';
                    }, { once: true });
                }
            } else {
                // Replace img with placeholder div
                const placeholder = document.createElement('div');
                placeholder.className = 'placeholder-image product-placeholder';
                els.image.parentNode.replaceChild(placeholder, els.image);
            }
        }

        // Description
        if (els.description && product.description) {
            els.description.textContent = product.description;
        }

        // Badges
        if (els.badges) els.badges.innerHTML = '';
        if (els.badges) {
            // Condition
            if (product.condition) {
                createBadge(`Condition: ${product.condition}`);
            }
            // Restored
            if (product.restored) {
                createBadge('Restored');
            }
            // Category (Optional)
            if (product.category) {
                createBadge(product.category.charAt(0).toUpperCase() + product.category.slice(1));
            }
        }

        // CTAs
        if (els.ctas) els.ctas.innerHTML = '';
        if (els.ctas) {
            if (product.available) {
                // Book Appointment
                const btnPrimary = document.createElement('a');
                btnPrimary.href = 'appointments.html';
                btnPrimary.className = 'button button-primary';
                btnPrimary.textContent = 'Book Appointment';
                els.ctas.appendChild(btnPrimary);

                // Ask About This Piece
                const btnSecondary = document.createElement('a');
                btnSecondary.href = `contact.html?item=${encodeURIComponent(product.id)}`;
                btnSecondary.className = 'button button-secondary';
                btnSecondary.textContent = 'Ask About This Piece';
                els.ctas.appendChild(btnSecondary);
            } else {
                // Browse Similar
                const btnPrimary = document.createElement('a');
                btnPrimary.href = `shop.html?category=${encodeURIComponent(product.category)}`;
                btnPrimary.className = 'button button-primary';
                btnPrimary.textContent = 'Browse Similar Pieces';
                els.ctas.appendChild(btnPrimary);

                // Contact
                const btnSecondary = document.createElement('a');
                btnSecondary.href = 'contact.html';
                btnSecondary.className = 'button button-secondary';
                btnSecondary.textContent = 'Contact';
                els.ctas.appendChild(btnSecondary);
            }
        }

        // Related
        renderRelated(product, allProducts);
    }

    function createBadge(text) {
        if (!els.badges) return;
        const span = document.createElement('span');
        span.className = 'product-pill';
        span.textContent = text;
        els.badges.appendChild(span);
    }

    function renderRelated(currentProduct, allProducts) {
        if (!els.relatedGrid) return;

        // Filter: same category, different ID
        let related = allProducts.filter(p => p.category === currentProduct.category && p.id !== currentProduct.id);

        // Sort: Available first
        related.sort((a, b) => (a.available === b.available) ? 0 : a.available ? -1 : 1);

        // Slice max 3
        related = related.slice(0, 3);

        if (related.length === 0) {
            if (els.relatedSection) els.relatedSection.style.display = 'none';
            return;
        }

        els.relatedGrid.innerHTML = related.map(p => {
            const priceStr = String(p.price).startsWith('$') ? p.price : '$' + p.price;

            // Image handling
            let imageHtml = '';
            if (p.image) {
                // Initialize opacity: 0 via class, will transition to opacity: 1 when loaded
                imageHtml = `<img src="${p.image}" alt="${p.name}" class="lazy-image" loading="lazy">`;
            }

            return `
            <article class="product-card">
                <a href="product.html?id=${p.id}" class="product-card-link" aria-label="View details for ${p.name}">
                    <div class="product-image">
                        ${!p.available ? '<div class="product-badges"><span class="product-badge badge-sold">Sold</span></div>' : ''}
                        <div class="placeholder-image"></div>
                        ${imageHtml}
                    </div>
                    <div class="product-info">
                        <h4 class="product-name">${p.name}</h4>
                        <p class="product-description">${p.era} | ${p.size}</p>
                        <p class="product-price">${priceStr}</p>
                    </div>
                </a>
            </article>
          `;
        }).join('');

        // Attach listeners to related images
        const images = els.relatedGrid.querySelectorAll('img');
        images.forEach(img => {
            const onLoad = () => img.classList.add('loaded');
            if (img.complete) {
                onLoad();
            } else {
                img.addEventListener('load', onLoad, { once: true });
                img.addEventListener('error', () => {
                    img.style.display = 'none';
                }, { once: true });
            }
        });
    }
});
