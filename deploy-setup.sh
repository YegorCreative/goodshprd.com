#!/bin/bash

# STRIPE DEPLOYMENT SETUP SCRIPT
# 
# This script helps you set up Stripe integration for deployment.
# Run this after configuring your Stripe account and obtaining API keys.
#
# Usage:
#   chmod +x deploy-setup.sh
#   ./deploy-setup.sh

set -e

echo "🚀 Stripe Checkout Integration - Deployment Setup"
echo "=================================================="
echo ""

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo "❌ .env.local not found!"
    echo ""
    echo "Please create .env.local with your Stripe keys:"
    echo "  cp .env.example .env.local"
    echo "  # Edit .env.local and add your Stripe keys"
    exit 1
fi

echo "✓ .env.local found"

# Check for Stripe keys
if grep -q "sk_test_\|sk_live_" .env.local; then
    echo "✓ STRIPE_SECRET_KEY configured"
else
    echo "❌ STRIPE_SECRET_KEY not found in .env.local"
    echo "   Add: STRIPE_SECRET_KEY=sk_test_... or sk_live_..."
    exit 1
fi

if grep -q "whsec_" .env.local; then
    echo "✓ STRIPE_WEBHOOK_SECRET configured"
else
    echo "⚠️  STRIPE_WEBHOOK_SECRET not found - you'll need to add this after creating webhook endpoint"
fi

# Check package.json
if [ -f "package.json" ]; then
    echo "✓ package.json found"
    if grep -q "stripe" package.json; then
        echo "✓ stripe package in package.json"
    else
        echo "⚠️  stripe package not in package.json - run: npm install stripe"
    fi
else
    echo "❌ package.json not found"
    exit 1
fi

# Check backend files
BACKEND_FILES=(
    "api/create-checkout-session.js"
    "api/webhook.js"
    "netlify/functions/create-checkout-session.js"
    "netlify/functions/webhook.js"
)

echo ""
echo "Checking backend files..."
for file in "${BACKEND_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "✓ $file"
    else
        echo "❌ $file missing!"
    fi
done

# Check frontend files
FRONTEND_FILES=(
    "js/stripe-checkout.js"
    "success.html"
    "canceled.html"
)

echo ""
echo "Checking frontend files..."
for file in "${FRONTEND_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "✓ $file"
    else
        echo "❌ $file missing!"
    fi
done

# Check config files
echo ""
echo "Checking configuration files..."
if [ -f "vercel.json" ]; then
    echo "✓ vercel.json"
else
    echo "⚠️  vercel.json not found (needed for Vercel)"
fi

if [ -f "netlify.toml" ]; then
    echo "✓ netlify.toml"
else
    echo "⚠️  netlify.toml not found (needed for Netlify)"
fi

echo ""
echo "✅ Setup verification complete!"
echo ""
echo "Next steps:"
echo "==========="
echo ""
echo "1. INSTALL DEPENDENCIES"
echo "   npm install"
echo ""
echo "2. SET UP STRIPE ACCOUNT"
echo "   - Go to https://stripe.com/"
echo "   - Create account or sign in"
echo "   - Navigate to Developers → API Keys"
echo "   - Copy Secret Key → STRIPE_SECRET_KEY"
echo ""
echo "3. CREATE A PRODUCT & PRICE"
echo "   - Go to Products"
echo "   - Create a new product"
echo "   - Add a price"
echo "   - Copy Price ID (starts with 'price_')"
echo ""
echo "4. ADD PURCHASE BUTTON TO HTML"
echo "   <script src=\"/js/stripe-checkout.js\"></script>"
echo "   <button class=\"stripe-checkout-btn\" data-price-id=\"price_YOUR_PRICE_ID\">"
echo "     Buy Now"
echo "   </button>"
echo ""
echo "5. TEST LOCALLY (OPTIONAL)"
echo "   npm install -g @stripe/cli"
echo "   stripe listen --forward-to localhost:3000/api/webhook"
echo "   stripe trigger checkout.session.completed"
echo ""
echo "6. DEPLOY TO VERCEL OR NETLIFY"
echo ""
echo "   FOR VERCEL:"
echo "   - npm install -g vercel"
echo "   - vercel"
echo "   - Go to Vercel Dashboard → Settings → Environment Variables"
echo "   - Add STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET"
echo ""
echo "   FOR NETLIFY:"
echo "   - Push code to GitHub"
echo "   - Connect repo on netlify.com"
echo "   - Go to Site Settings → Environment → Add variables"
echo "   - Add STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET"
echo ""
echo "7. CONFIGURE WEBHOOK IN STRIPE"
echo "   - Go to Developers → Webhooks"
echo "   - Add Endpoint"
echo "   - URL: https://yourdomain.com/api/webhook"
echo "   - Listen for: checkout.session.completed"
echo "   - Copy Signing Secret → STRIPE_WEBHOOK_SECRET"
echo ""
echo "For detailed instructions, see STRIPE_QUICK_START.md or STRIPE_SETUP.md"
echo ""
