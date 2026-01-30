/**
 * Contact Form Logic
 * Handles URL parameters for product inquiries and form submission simulation.
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Handle URL Query Params for Product Context
    const params = new URLSearchParams(window.location.search);
    const itemId = params.get('item');
    const itemName = params.get('name');

    const subjectSelect = document.getElementById('contact-subject');
    const messageTextarea = document.getElementById('contact-message');
    const contextContainer = document.querySelector('.contact-form-wrapper p'); // Using the paragraph above form as insertion point

    if (itemId && itemName) {
        // Pre-select 'Product Question'
        if (subjectSelect) {
            subjectSelect.value = 'product';
        }

        // Show context message
        if (contextContainer) {
            const contextMsg = document.createElement('p');
            contextMsg.className = 'form-helper';
            contextMsg.style.marginBottom = '1.5rem';
            contextMsg.style.marginTop = '-1rem';
            contextMsg.style.fontWeight = '500';
            contextMsg.textContent = `About this piece: ${itemName} (${itemId})`;
            contextContainer.insertAdjacentElement('afterend', contextMsg);
        }

        // Pre-fill message
        if (messageTextarea) {
            messageTextarea.value = `Hi, I’m interested in ${itemName} (${itemId}). `;
        }
    }

    // 2. Handle Form Submission
    const form = document.querySelector('.contact-form');
    // Re-use existing confirmation block styles or inject new one if contact.html doesn't have one pre-built
    // Based on previous instructions, we'll create/reveal a confirmation message.

    // Check if confirmation block exists, if not create it
    let confirmation = document.querySelector('.form-confirmation');
    if (!confirmation && form) {
        confirmation = document.createElement('div');
        confirmation.className = 'form-confirmation';
        confirmation.setAttribute('aria-live', 'polite');
        confirmation.innerHTML = `
            <h3 class="confirmation-title">Message Sent</h3>
            <p class="confirmation-text">Thank you for reaching out. We’ll get back to you shortly.</p>
        `;
        form.parentNode.insertBefore(confirmation, form.nextSibling);
    }

    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();

            // Simulate network request
            const button = form.querySelector('button[type="submit"]');
            const originalText = button.textContent;
            button.textContent = 'Sending...';
            button.disabled = true;

            setTimeout(() => {
                // Hide form, show confirmation
                form.style.display = 'none';
                if (confirmation) {
                    confirmation.classList.add('is-visible');
                    confirmation.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }

                // Reset form for next time (if we were reloading, but here we just hide)
                form.reset();
                button.textContent = originalText;
                button.disabled = false;
            }, 800);
        });
    }
});
