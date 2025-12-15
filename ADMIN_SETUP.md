# Decap CMS Admin Setup Guide

This guide explains how to set up and use the Decap CMS (Netlify CMS) admin interface for managing Good Shepherd shop products.

## Overview

The admin interface allows your team to:
- **Add new products** without touching code
- **Edit existing products** (title, price, photos, etc.)
- **Mark items as sold out** with a single click
- **Feature products** on the homepage
- **Upload product images** directly
- **Preview changes** before publishing

## Architecture

```
┌─────────────────────────┐
│  Your Team (Admin User) │
│  /admin/               │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│  Decap CMS Dashboard   │
│  (admin/index.html)    │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│  Git Gateway (Auth)    │
│  Netlify Identity      │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│  GitHub Repository     │
│  (Commit changes)      │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│  Website Auto-Deploy   │
│  (Netlify)             │
└─────────────────────────┘
```

## Setup Steps

### 1. Netlify Connections (One-Time Setup)

Your repository must be connected to Netlify for the admin to work. If not already done:

1. Go to [Netlify](https://netlify.com)
2. Connect your GitHub repository (`yegorhambaryan/goodshprd.com`)
3. Approve access to your repo

### 2. Enable Netlify Identity

1. Go to your Netlify site dashboard
2. **Site Settings** → **Identity** → **Enable Identity**
3. Click **Invite users** and add your team member's email
4. They'll receive an invitation to set up their account

### 3. Enable Git Gateway

This allows the admin to push changes directly to GitHub:

1. In Netlify, go **Site Settings** → **Identity**
2. Under "Services", click **Enable Git Gateway**
3. Select your repository and GitHub branch (usually `main`)

### 4. Verify Files Are in Place

Check that these files exist in your repository:

```
├── /admin/
│   ├── index.html          ✓ Admin dashboard entry point
│   └── config.yml          ✓ Decap CMS configuration
├── /content/products/      ✓ Product JSON files folder
├── /js/shop.js            ✓ Product loader script
├── /css/shop.css          ✓ Product styling
└── /shop.html             ✓ Shop page (updated)
```

## Using the Admin Interface

### Accessing the Admin

1. Go to: `https://goodshprd.com/admin`
2. Log in with your Netlify Identity credentials
3. You'll see the Decap CMS dashboard

### Adding a New Product

1. Click **Products** in the sidebar
2. Click **New Product**
3. Fill in the fields:
   - **Title**: Product name (e.g., "Vintage Wool Overcoat")
   - **Slug**: Auto-generated from title, can edit (used in URLs)
   - **Price**: Dollar amount (e.g., 185.00)
   - **Size**: Size descriptor (e.g., "Large", "One Size Fits All")
   - **Category**: Choose from dropdown (Tops, Bottoms, Outerwear, Accessories, Unisex)
   - **Condition Notes**: Brief condition description (e.g., "Gently used, professionally cleaned")
   - **Full Description**: Detailed description with care instructions, sizing, etc.
   - **Product Photos**: Upload 1-6 images (first image is the thumbnail)
   - **Featured on Homepage**: Check to show in featured section (max 6)
   - **Sold Out**: Check if item is no longer available
   - **Created Date**: Auto-set to now (can change if needed)

4. Click **Save** to publish

### Editing a Product

1. Click **Products** in the sidebar
2. Find the product in the list
3. Click to open it
4. Make changes
5. Click **Save**

### Marking as Sold Out

1. Open the product
2. Check the **Sold Out** checkbox
3. Click **Save**

The product will:
- Show a red "Sold Out" badge
- Not be available for purchase
- Still be visible but disabled on the shop page

### Featuring on Homepage

1. Open the product
2. Check the **Featured on Homepage** checkbox
3. Click **Save**

The product will appear in the featured section on the homepage (max 6 items).

## How Products are Stored

Each product is stored as a JSON file in `/content/products/`:

**Example: `vintage-wool-overcoat.json`**
```json
{
  "title": "Vintage Wool Overcoat",
  "slug": "vintage-wool-overcoat",
  "price": 185.00,
  "size": "Large",
  "category": "Outerwear",
  "conditionNotes": "Gently used, professionally cleaned",
  "description": "Beautiful 1960s wool overcoat...",
  "photos": ["/images/products/photo1.jpg", ...],
  "featured": true,
  "soldOut": false,
  "createdAt": "2025-12-15T10:00:00Z"
}
```

When you publish a product in the admin, Decap CMS:
1. Creates/updates the JSON file
2. Commits it to GitHub with an auto-generated message
3. GitHub webhook triggers a Netlify deploy
4. Website updates automatically with the new product

## How the Website Uses Products

### Frontend Loading (`/js/shop.js`)

When someone visits the shop page:
1. JavaScript fetches `/content/products/manifest.json` (list of all products)
2. Loads each product's JSON file
3. Filters by status (in-stock, sold-out, featured)
4. Renders HTML dynamically

**This means:**
- No database needed
- Products load instantly
- Changes appear within seconds of publishing

### Featured Products on Homepage

The homepage can display featured products:

```html
<script>
  // When DOM is ready, fetch and render featured products
  ShopProducts.renderFeatured('featured-container', 6);
</script>
```

(Ask the developer where to add this if you want featured products on your homepage)

## Troubleshooting

### "Not Authorized" error

- Make sure your Netlify Identity account is activated
- Check that you received the invitation email
- Click the link in the email to set your password

### Changes aren't showing on the website

1. Wait a few seconds for the Netlify deploy to finish
2. Refresh the page (hard refresh: Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows)
3. Check Netlify Deploys dashboard to see if the build succeeded

### Can't upload images

- Images are stored in `/public/images/products/`
- Netlify must have permission to write to this folder
- Contact the site administrator if you see permission errors

### Product not appearing on shop page

- Check that **Sold Out** is NOT checked
- Check the browser console for errors (F12)
- Verify the product JSON file was created in `/content/products/`

## Field Descriptions

| Field | Type | Description |
|-------|------|-------------|
| Title | Text | Product name |
| Slug | Text | URL-friendly identifier (auto-generated) |
| Price | Number | Price in dollars |
| Size | Text | Size or dimensions |
| Category | Select | One of: Tops, Bottoms, Outerwear, Accessories, Unisex |
| Condition Notes | Text | Brief condition description |
| Description | Markdown | Detailed description (supports markdown) |
| Photos | Images | 1-6 product images |
| Featured | Boolean | Show on homepage featured section |
| Sold Out | Boolean | Mark as no longer available |
| Created Date | DateTime | When product was added |

## Tips & Best Practices

✅ **DO:**
- Use clear, descriptive titles
- Add multiple photos from different angles
- Write detailed condition notes (be honest about wear)
- Mark items as sold out immediately
- Feature your best items

❌ **DON'T:**
- Leave photos empty
- Use unclear titles (e.g., "Jacket" instead of "Vintage Leather Jacket")
- Forget to mark sold items as sold out
- Feature too many items (max 6 for homepage)
- Edit the JSON files directly (use the admin interface)

## Support

If you have questions:
1. Check this guide (ADMIN_SETUP.md)
2. Reference the field descriptions above
3. Ask the site administrator for help

---

**Admin URL:** `https://goodshprd.com/admin`  
**Repository:** `yegorhambaryan/goodshprd.com`  
**Platform:** Netlify + Decap CMS + GitHub
