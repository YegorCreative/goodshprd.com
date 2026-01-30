/**
 * Appointments Form Logic
 * Handles date validation (Tue-Sat only) and form submission simulation.
 */

document.addEventListener('DOMContentLoaded', () => {
    const form = document.querySelector('.booking-form');
    const dateInput = document.getElementById('date');
    const confirmation = document.querySelector('.form-confirmation');

    // 1. Date Constraints
    if (dateInput) {
        // Disable past dates
        const today = new Date().toISOString().split('T')[0];
        dateInput.min = today;

        // Enforce Tue-Sat (Days 2-6)
        dateInput.addEventListener('input', (e) => {
            const val = e.target.value;
            if (!val) return;

            const day = new Date(val).getUTCDay();
            // Sunday = 0, Monday = 1
            if (day === 0 || day === 1) {
                e.target.value = '';
                alert('We are open Tuesday through Saturday. Please choose another date.');
            }
        });
    }

    // 2. Form Submission
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();

            // Basic validation check (HTML5 'required' handles most)
            if (!form.checkValidity()) return;

            // Simulate processing
            const button = form.querySelector('button[type="submit"]');
            const originalText = button.textContent;
            button.textContent = 'Requesting...';
            button.disabled = true;

            setTimeout(() => {
                // Hide form, show confirmation
                form.style.display = 'none';
                if (confirmation) {
                    confirmation.classList.add('is-visible'); // Ensure CSS shows this
                    confirmation.style.display = 'block'; // Inline override just in case
                    confirmation.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }

                // Reset
                form.reset();
                button.textContent = originalText;
                button.disabled = false;
            }, 800);
        });
    }
});
