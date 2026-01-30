document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const item = params.get('item');
    const name = params.get('name');

    const contextEl = document.getElementById('contactContext');
    const form = document.querySelector('.contact-form');
    const messageField = document.getElementById('contact-message');
    const subjectField = document.getElementById('contact-subject');
    const confirmation = document.getElementById('contactConfirmation');

    // ---- Product context ----
    if (item && name && contextEl) {
        contextEl.textContent = `About this piece: ${decodeURIComponent(name)} (${item})`;

        if (subjectField) subjectField.value = 'product';

        if (messageField && !messageField.value) {
            messageField.value = `Hi, I’m interested in ${decodeURIComponent(name)} (${item}).\n\n`;
        }
    }

    // ---- Fake submit / confirmation ----
    if (!form) return;

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        form.reset();

        if (confirmation) {
            confirmation.classList.add('is-visible');
            confirmation.innerHTML = `
        <p class="confirmation-title">Message sent</p>
        <p class="confirmation-text">Thanks for reaching out. We’ll get back to you within 24 hours.</p>
      `;
        }
    });
});
