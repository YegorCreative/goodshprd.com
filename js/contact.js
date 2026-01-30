/**
 * Contact Deep-Link Logic
 * Handles ?item=<id> to prefill subject and message.
 */
document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(location.search);
    const itemId = params.get('item');
    if (!itemId) return;

    const subject = document.getElementById('contact-subject');
    const message = document.getElementById('contact-message');

    // Always set subject if present
    if (subject) subject.value = 'product';

    // Only proceed to prefill message if it exists and is effectively empty
    const shouldPrefill = message && message.value.trim().length === 0;

    const fallbackPrefill = () => {
        if (message && shouldPrefill) {
            message.value = `Hi Good Shepherd,\n\nI’m interested in item: ${itemId}.\n\nMy question:\n`;
        }
    };

    // Attempt to fetch product details for a nicer prefill
    fetch('data/products.json')
        .then(r => {
            if (!r.ok) throw new Error('Network response was not ok');
            return r.json();
        })
        .then(list => {
            const p = Array.isArray(list) ? list.find(x => x && x.id === itemId) : null;
            if (p && message && shouldPrefill) {
                message.value = `Hi Good Shepherd,\n\nI’m interested in: ${p.name} (${p.id}).\n\nMy question:\n`;
            } else if (!p) {
                // Product ID not found in JSON, fall back to raw ID
                fallbackPrefill();
            }
        })
        .catch(() => {
            // Fetch failed, fall back to raw ID
            fallbackPrefill();
        });
});
