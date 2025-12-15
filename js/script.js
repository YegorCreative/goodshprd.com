/**
 * Good Shepherd Website JavaScript
 * Mobile-First Progressive Enhancements
 * Minimal, calm, intentional interactions
 */

(function() {
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
        const body = document.body;
        
        if (!navToggle) {
            console.warn('Navigation toggle button not found');
            return;
        }

        navToggle.addEventListener('click', function() {
            const isOpen = body.classList.contains('nav-open');
            
            // Toggle open state
            body.classList.toggle('nav-open');
            
            // Update ARIA attribute for accessibility
            this.setAttribute('aria-expanded', !isOpen);
        });

        // Close menu when navigation link is clicked
        const navLinks = document.querySelectorAll('.main-nav a');
        navLinks.forEach(link => {
            link.addEventListener('click', function() {
                body.classList.remove('nav-open');
                navToggle.setAttribute('aria-expanded', 'false');
            });
        });

        // Close menu when clicking outside
        document.addEventListener('click', function(e) {
            const isNavToggle = e.target.closest('.nav-toggle');
            const isNavMenu = e.target.closest('.main-nav');
            
            if (!isNavToggle && !isNavMenu && body.classList.contains('nav-open')) {
                body.classList.remove('nav-open');
                navToggle.setAttribute('aria-expanded', 'false');
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
            link.addEventListener('click', function(e) {
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
    // Initialize on DOM Ready
    // ========================================
    
    document.addEventListener('DOMContentLoaded', function() {
        removeNoJsClass();
        initMobileNav();
        initSmoothScroll();
        initLazyLoad();
        
        console.log('✓ Good Shepherd website initialized');
    });

})();
