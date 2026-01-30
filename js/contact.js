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
    const context = document.getElementById('contactContext');

    // Always set subject if present
    if (subject) subject.value = 'product';
    if (!message) return;

    // Track whether the user has typed anything, to avoid overwriting.
    let userTouchedMessage = message.value.trim().length > 0;
    const markTouched = () => { userTouchedMessage = true; };
    message.addEventListener('input', markTouched, { once: true });

    const canPrefillNow = () => !userTouchedMessage && message.value.trim().length === 0;

    const setContext = (text) => {
        if (!context) return;
        context.textContent = text;
    };

    const fallbackPrefill = () => {
        setContext(`Context: Item ${itemId}`);
        if (canPrefillNow()) {
            message.value = `Hi Good Shepherd,\n\nI'm interested in item: ${itemId}.\n\nMy question:\n`;
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

            if (p) {
                setContext(`Context: ${p.name} (${p.id})`);
                if (canPrefillNow()) {
                    message.value = `Hi Good Shepherd,\n\nI'm interested in: ${p.name} (${p.id}).\n\nMy question:\n`;
                }
            } else {
                fallbackPrefill();
            }
        })
        .catch(() => {
            fallbackPrefill();
        });
});
