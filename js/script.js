/**
 * Good Shepherd Website JavaScript
 * Mobile-First Progressive Enhancements
 * Minimal, calm, intentional interactions
 */

(function () {
    'use strict';

    // ========================================
    // Mobile Navigation Toggle
    // ========================================

    /**
     * Hamburger menu toggle for mobile navigation
     * Shows/hides navigation on mobile devices
     */
    function initMobileNav() {
        const navToggle = document.querySelector('.nav-toggle');
        const siteHeader = document.querySelector('.site-header');

        if (!navToggle || !siteHeader) {
            console.warn('Navigation elements not found');
            return;
        }

        // Function to close the menu
        function closeMenu() {
            siteHeader.classList.remove('nav-open');
            navToggle.setAttribute('aria-expanded', 'false');
        }

        // Function to open the menu
        function openMenu() {
            siteHeader.classList.add('nav-open');
            navToggle.setAttribute('aria-expanded', 'true');
        }

        // Toggle menu on button click
        navToggle.addEventListener('click', function () {
            const isOpen = siteHeader.classList.contains('nav-open');

            if (isOpen) {
                closeMenu();
            } else {
                openMenu();
            }
        });

        // Close menu when navigation link is clicked
        const navLinks = document.querySelectorAll('.main-nav a');
        navLinks.forEach(link => {
            link.addEventListener('click', function () {
                closeMenu();
            });
        });

        // Close menu when clicking outside
        document.addEventListener('click', function (e) {
            const isNavToggle = e.target.closest('.nav-toggle');
            const isNavMenu = e.target.closest('.main-nav');

            if (!isNavToggle && !isNavMenu && siteHeader.classList.contains('nav-open')) {
                closeMenu();
            }
        });

        // Close menu when Escape key is pressed
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && siteHeader.classList.contains('nav-open')) {
                closeMenu();
                navToggle.focus(); // Return focus to toggle button
            }
        });

        console.log('Mobile navigation initialized');
    }

    // ========================================
    // Smooth Scroll Enhancement
    // ========================================

    /**
     * Enhance anchor link behavior with smooth scrolling
     * Adds offset for sticky header
     */
    function initSmoothScroll() {
        const links = document.querySelectorAll('a[href^="#"]');
        const header = document.querySelector('.site-header');
        const headerHeight = header ? header.offsetHeight : 0;

        links.forEach(link => {
            link.addEventListener('click', function (e) {
                const targetId = this.getAttribute('href');

                // Skip if just #
                if (targetId === '#' || targetId === '#home') {
                    e.preventDefault();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                    return;
                }

                const targetElement = document.querySelector(targetId);

                if (targetElement) {
                    e.preventDefault();

                    // Calculate position with header offset
                    const targetPosition = targetElement.offsetTop - headerHeight - 20;

                    window.scrollTo({
                        top: targetPosition,
                        behavior: 'smooth'
                    });
                }
            });
        });

        console.log('Smooth scroll initialized');
    }

    // ========================================
    // Lazy Loading Images
    // ========================================

    /**
     * Progressive image loading using Intersection Observer
     * Loads images when they enter viewport
     */
    function initLazyLoad() {
        // Check for images with data-src attribute
        const lazyImages = document.querySelectorAll('img[data-src]');

        if (lazyImages.length === 0) {
            return; // No lazy images to load
        }

        // Check for Intersection Observer support
        if ('IntersectionObserver' in window) {
            const imageObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        img.src = img.dataset.src;
                        img.removeAttribute('data-src');
                        observer.unobserve(img);
                    }
                });
            });

            lazyImages.forEach(img => imageObserver.observe(img));
            console.log('Lazy loading initialized');
        } else {
            // Fallback: Load all images immediately
            lazyImages.forEach(img => {
                img.src = img.dataset.src;
                img.removeAttribute('data-src');
            });
        }
    }

    // ========================================
    // Remove no-js class if JavaScript is enabled
    // ========================================

    function removeNoJsClass() {
        document.documentElement.classList.remove('no-js');
        document.documentElement.classList.add('js');
    }

    // ========================================
    // Back To Top Button
    // ========================================
    function initBackToTop() {
        const btn = document.querySelector('.back-to-top');
        if (!btn) return;

        const showThreshold = 200; // px scrolled
        const onScroll = () => {
            const y = window.scrollY || document.documentElement.scrollTop;
            if (y > showThreshold) {
                btn.classList.add('is-visible');
            } else {
                btn.classList.remove('is-visible');
            }
        };

        window.addEventListener('scroll', onScroll, { passive: true });

        btn.addEventListener('click', (e) => {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });

        // Keyboard accessibility
        btn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });

        // Initial state
        onScroll();
    }

    // ========================================
    // Booking Form Handler
    // ========================================


    // ========================================
    // Form UX (client-side confirmation, no backend)
    // ========================================
    function initFormsUX() {
        // Booking form (appointments)
        const bookingForm = document.querySelector('.booking-form');
        const bookingConfirmation = document.getElementById('bookingConfirmation'); // Use ID if available, likely class .form-confirmation in markup

        // Fallback for ID if not present but class is
        const bookingConfEl = bookingConfirmation || document.querySelector('.booking-section .form-confirmation');

        if (bookingForm && bookingConfEl) {
            bookingForm.addEventListener('submit', (e) => {
                e.preventDefault();

                // Native validation
                if (!bookingForm.reportValidity()) return;

                bookingForm.reset();
                bookingConfEl.classList.add('is-visible');

                // Scroll confirmation into view (gentle)
                bookingConfEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        }

        // Contact form
        const contactForm = document.querySelector('.contact-form');
        const contactConfirmation = document.getElementById('contactConfirmation');

        // Prefill contact message if arriving with ?item=product-id
        if (contactForm) {
            const params = new URLSearchParams(window.location.search);
            const item = params.get('item');
            const messageEl = document.getElementById('contact-message');
            const subjectEl = document.getElementById('contact-subject');

            if (item && messageEl) {
                if (subjectEl) subjectEl.value = 'product';
                messageEl.value = `Hi — I have a question about this piece: ${item}\n\n`;
            }
        }

        if (contactForm && contactConfirmation) {
            contactForm.addEventListener('submit', (e) => {
                e.preventDefault();
                if (!contactForm.reportValidity()) return;

                contactForm.reset();
                contactConfirmation.classList.add('is-visible');
                contactConfirmation.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        }

        // Newsletter form
        const newsletterForm = document.querySelector('.newsletter-form');
        const newsletterConfirmation = document.getElementById('newsletterConfirmation');

        if (newsletterForm && newsletterConfirmation) {
            newsletterForm.addEventListener('submit', (e) => {
                e.preventDefault();
                if (!newsletterForm.reportValidity()) return;

                newsletterForm.reset();
                newsletterConfirmation.classList.add('is-visible');
                newsletterConfirmation.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        }
    }

    // ========================================
    // Initialize on DOM Ready
    // ========================================

    document.addEventListener('DOMContentLoaded', function () {
        removeNoJsClass();
        initMobileNav();
        initSmoothScroll();
        initLazyLoad();
        initBackToTop();
        initFormsUX();

        console.log('✓ Good Shepherd website initialized');
    });

})();
