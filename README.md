# Good Shepherd — Vintage & Restored Clothing

A minimal, editorial-style website for Good Shepherd, a Minnesota-rooted vintage and restored clothing brand. Built with strict mobile-first principles, semantic HTML5, and warm, timeless design.

## 🎨 Brand Identity

**Tone:** Warm, timeless, human, and intentional  
**Feel:** Printed paper, craftsmanship, and natural light — not modern tech UI

**Colors:**
- Primary Text: `#1F1F1D`
- Main Background: `#F6F4EF`
- Secondary Background: `#ECE8DF`
- Accent Colors: `#6B5E4A`, `#7A7F6A`

**Typography:**
- Headings: Libre Baskerville (serif, elegant, print-inspired)
- Body: Inter (clean, readable)

## 📁 Project Structure

```
goodshprd.com/
├── index.html              # Homepage
├── shop.html               # Product grid with filters
├── appointments.html       # Booking form
├── about.html              # Brand story & values
├── journal.html            # Editorial content & lookbook
├── contact.html            # Contact form & info
├── css/
│   ├── styles.css          # Mobile-first base styles
│   └── mobile.css          # Minimal micro-fixes (iOS, no-JS fallback)
├── js/
│   └── script.js           # Mobile nav toggle & enhancements
└── img/                    # Images directory (ready for assets)
```

## 🏗️ Architecture

### Mobile-First Design
- **Mobile (default):** 320px+ single-column layouts
- **Tablet:** `@media (min-width: 768px)` — 2 columns, horizontal nav
- **Desktop:** `@media (min-width: 1024px)` — 3-4 columns, expanded spacing
- **Large Desktop:** `@media (min-width: 1440px)` — Typography refinements

### CSS Organization
- **styles.css:** Main stylesheet with mobile defaults and min-width breakpoints
- **mobile.css:** Only for micro-fixes (iOS zoom prevention, safe-area insets, no-JS fallback)
- No duplication of layout rules across files

### JavaScript
- Mobile navigation toggle (hamburger menu)
- Escape key support for closing menu
- Click-outside-to-close functionality
- Smooth scroll with header offset
- Progressive enhancement (works without JS)

## ✨ Features

### Accessibility
- ✓ Semantic HTML5 structure
- ✓ 44px minimum tap targets
- ✓ ARIA attributes (aria-expanded, aria-current)
- ✓ Keyboard navigation support
- ✓ Focus states for all interactive elements
- ✓ `no-js` class for progressive enhancement

### Responsive Design
- ✓ Fluid typography with `clamp()`
- ✓ Flexible layouts (%, rem, no fixed widths)
- ✓ Responsive images (`max-width: 100%`, `height: auto`)
- ✓ Mobile-friendly forms
- ✓ iOS-specific optimizations

### Performance
- ✓ Minimal CSS (no frameworks)
- ✓ No heavy animations or effects
- ✓ Lazy loading ready
- ✓ Fast, lightweight JavaScript

## 🚀 Deployment

### GitHub Pages
This project is ready to deploy to GitHub Pages:

1. Push to GitHub repository
2. Go to Settings → Pages
3. Select branch and root directory
4. Save and wait for deployment

### Manual Deployment
Upload all files to any static hosting service. No build process required.

## 📱 Testing Checklist

- [ ] iPhone SE (320px) — single column layouts
- [ ] Standard phones (375px-428px) — mobile optimized
- [ ] Tablets (768px+) — 2 columns, horizontal nav
- [ ] Desktops (1024px+) — 3-4 columns, expanded
- [ ] Touch targets minimum 44px
- [ ] Form inputs prevent iOS zoom
- [ ] Navigation works without JavaScript
- [ ] Keyboard navigation functional
- [ ] All links and buttons have focus states

## 🎯 Design Principles

1. **Mobile-first always:** Start with small screens, enhance for larger
2. **No modern tech patterns:** Avoid gradients, shadows, flashy effects
3. **Generous spacing:** Let content breathe
4. **Fluid everything:** Use flexible units, not fixed pixels
5. **Calm interactions:** Subtle fades only, no aggressive animations
6. **Editorial layout:** Inspired by printed materials, not web UI

## 📄 Pages

### index.html
Homepage with hero, featured products, about preview, gallery, and CTA

### shop.html
Product grid with filters (category, era, sort), product cards with badges

### appointments.html
Booking form with date/time selection, informational content

### about.html
Origin story, values, process explanation with multiple content sections

### journal.html
Editorial content grid and lookbook gallery layout

### contact.html
Contact form, business information, newsletter signup

## 🛠️ Customization

### Adding Images
Replace placeholder elements in `/img/` directory. Images automatically responsive.

### Updating Colors
Modify color variables in `css/styles.css` header comments, then find/replace.

### Adding Pages
1. Copy any existing HTML file as template
2. Update navigation links
3. Add page-specific sections using existing classes
4. No additional CSS needed if using existing patterns

## 📦 Dependencies

- Google Fonts (Libre Baskerville, Inter)
- No JavaScript frameworks
- No CSS frameworks
- No build tools required

## 📝 License

All rights reserved © 2025 Good Shepherd

## 👥 Credits

Built with care, following editorial design principles and mobile-first best practices.
Good Shepherd — A minimal, editorial-style website for a Minnesota-rooted vintage and restored clothing brand. Built with a focus on craftsmanship, ethical sourcing, storytelling, and timeless design.


# Good Shepherd

A warm, minimal, editorial-style website for **Good Shepherd** — a Minnesota-rooted vintage and restored clothing brand built on craftsmanship, storytelling, and stewardship.

## Project Goals
- Create a clean, timeless online presence
- Highlight featured pieces, story, and ethical identity
- Support private shopping appointment requests
- Stay mobile-first, fast, and easy to maintain

## Pages (Planned)
- Home
- Shop
- Appointments
- About
- Journal (Lookbook)
- Contact

## Tech Stack
- HTML5 (semantic structure)
- CSS3 (separated base + mobile styles)
- JavaScript (lightweight interactions only)

## Folder Structure

## Design System
**Tone:** warm, minimal, timeless, human.

**Colors**
- Text: `#1F1F1D`
- Background: `#F6F4EF`
- Secondary background: `#ECE8DF`
- Accents: `#6B5E4A`, `#7A7F6A`

**Typography**
- Headings: Libre Baskerville
- Body: Inter

## Local Development
Open `index.html` directly in your browser, or use a local server for best results.

### Option A: VS Code Live Server
1. Install the “Live Server” extension
2. Right-click `index.html` → **Open with Live Server**

### Option B: Python (if installed)
```bash
python3 -m http.server 5500