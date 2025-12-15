# Decap CMS Admin - Deployment & Configuration Guide

This guide covers everything needed to deploy and configure the Decap CMS admin interface for the Good Shepherd website.

## Pre-Deployment Checklist

- [ ] Repository is connected to Netlify
- [ ] GitHub personal access token created (for Git Gateway)
- [ ] Netlify Identity is enabled on your site
- [ ] Git Gateway is configured
- [ ] All files are committed to GitHub

## Files Created/Modified

### Admin Files
- ✅ `/admin/index.html` - Admin dashboard entry point
- ✅ `/admin/config.yml` - CMS configuration with product schema

### Frontend Files
- ✅ `/js/shop.js` - Product loader and renderer
- ✅ `/css/shop.css` - Product grid styling
- ✅ `/shop.html` - Updated to use dynamic products
- ✅ `/content/products/manifest.json` - Product listing
- ✅ `/content/products/sample-*.json` - Example product

### Configuration
- ✅ `/netlify.toml` - Updated with admin headers

## Deployment Steps

### Step 1: Commit All Changes

```bash
git add .
git commit -m "Add Decap CMS admin interface for product management"
git push origin main
```

Netlify will automatically deploy the changes.

### Step 2: Verify Netlify Identity

1. Go to your Netlify site dashboard
2. Go to **Site Settings** → **Identity**
3. Verify the identity widget is enabled
4. Take note of your site URL (e.g., `https://goodshprd.netlify.app`)

### Step 3: Enable Git Gateway

1. In Netlify Site Settings → **Identity**
2. Find "Services" section
3. Click **Enable Git Gateway**
4. Select your GitHub repository and main branch
5. Wait for it to finish setting up (usually 1-2 minutes)

### Step 4: Create a GitHub Personal Access Token (if using Git Gateway)

If Git Gateway requests it:

1. Go to GitHub → **Settings** → **Developer settings** → **Personal access tokens**
2. Click **Generate new token**
3. Select scopes:
   - ✅ `repo` (full control of private repositories)
   - ✅ `user:email` (access to email)
4. Copy the token
5. Paste it in Netlify Git Gateway setup

### Step 5: Invite Admin Users

1. In Netlify Site Settings → **Identity**
2. Click **Invite users**
3. Enter email addresses of team members
4. They'll receive invitation emails
5. They set up their own passwords

### Step 6: Test the Admin Interface

1. Go to `https://yourdomain.com/admin` (or `https://goodshprd.netlify.app/admin` if not using custom domain)
2. Log in with your credentials
3. Click **Products** → you should see the sample product
4. Try editing the sample product
5. Verify changes appear on the shop page

## Configuration Details

### `/admin/config.yml` Explained

**Backend Section:**
```yaml
backend:
  name: git-gateway      # Uses Netlify Git Gateway for auth
  branch: main           # Commits to main branch
  repo: yegorhambaryan/goodshprd.com  # Your GitHub repo
```

This tells Decap CMS how to authenticate and commit changes.

**Media Folder:**
```yaml
media_folder: "public/images/products"    # Where images are stored
public_folder: "/images/products"         # How URLs are constructed
```

Images uploaded via the admin are stored locally in `public/images/products/`.

**Product Collection:**
```yaml
collections:
  - name: "products"
    label: "Products"
    folder: "content/products"           # JSON files stored here
    create: true                         # Allow creating new products
    slug: "{{slug}}"                     # Use slug as filename
    format: "json"                       # Store as JSON
```

Each product becomes a separate JSON file in `/content/products/`.

## How Git Gateway Works

1. **Admin User Logs In:**
   - Uses Netlify Identity for authentication
   - GitHub credential encrypted by Netlify

2. **Admin Makes Changes:**
   - Edits product in Decap CMS
   - Clicks "Save"

3. **Decap CMS Commits:**
   - Creates/updates JSON file
   - Git Gateway commits to GitHub as the authenticated user
   - Commit message: `Add product: [slug]` or `Update product: [slug]`

4. **Netlify Auto-Deploy:**
   - GitHub webhook triggers Netlify
   - Site automatically rebuilds and deploys
   - Changes live in ~30 seconds

5. **Website Loads Products:**
   - JavaScript fetches `manifest.json`
   - Loads each product's JSON file
   - Renders dynamically in the browser

## Troubleshooting Deployment

### Admin page shows login but login fails

**Solution:**
- Verify Netlify Identity is enabled
- Check that Git Gateway is enabled
- Try clearing cookies and logging in again
- Check browser console for errors (F12)

### "Unauthorized" when trying to save

**Solution:**
- Verify your user has edit permissions
- Try logging out and logging back in
- Check that Git Gateway is properly configured
- Verify the GitHub personal access token hasn't expired

### Changes don't appear on website

**Solution:**
1. Verify the product JSON file was created in `content/products/`
2. Check Netlify Deploy log for errors
3. Hard refresh the shop page (Cmd+Shift+R on Mac)
4. Check browser console for JavaScript errors

### Netlify shows "Build failed"

**Solution:**
- Check the build log in Netlify → Deploys
- Ensure `netlify.toml` is valid TOML syntax
- Verify all file paths in config.yml are correct

## Production Checklist

- [ ] Test creating a new product in admin
- [ ] Verify product appears on shop page within 1 minute
- [ ] Test uploading product images
- [ ] Test marking product as sold out
- [ ] Test featuring a product
- [ ] Verify featured products appear on homepage
- [ ] Test on mobile device
- [ ] Have team member test with their account
- [ ] Document admin URL for team
- [ ] Document the ADMIN_SETUP.md location

## Security Notes

✅ **What's Secure:**
- Secret keys are never exposed (Netlify Identity handles auth)
- GitHub commits are encrypted
- Admin interface is password-protected
- No database or backend server needed

❌ **What to Keep Safe:**
- GitHub Personal Access Token (if using)
- Netlify Identity credentials
- Don't share admin login with untrusted users

## Monitoring

### Check for Errors:

1. **Netlify Deploy Logs:**
   - Go to Netlify → Deploys
   - Each deploy shows logs and success/failure

2. **Browser Console:**
   - Visit shop page, press F12
   - Look for red errors in Console tab

3. **Admin Logs:**
   - No persistent logs, but check Netlify Deploy history

## Rollback Procedure

If something goes wrong:

1. Go to Netlify → Deploys
2. Find the last good deployment
3. Click **Deploy** → **Publish deploy**
4. Site reverts to that version

Or revert in GitHub:
```bash
git revert HEAD
git push origin main
```

## Updating Products via Admin

See **ADMIN_SETUP.md** for full instructions on using the admin interface.

Quick guide:
1. Go to `/admin`
2. Log in
3. Click **Products**
4. Click **New Product** or edit existing
5. Fill in fields
6. Click **Save**
7. Changes live in ~30 seconds

## Cost & Hosting

- **Netlify:** Generous free tier
- **GitHub:** Free for public/private repos
- **Decap CMS:** Free & open source
- **No database fees**
- **No backend server fees**

This setup costs $0 unless you add paid Netlify features.

## Next Steps

1. Push all changes to GitHub
2. Verify Netlify deploys successfully
3. Enable Git Gateway in Netlify
4. Invite team members
5. Have team test the admin interface
6. Share ADMIN_SETUP.md with team members

---

**Admin URL:** `https://goodshprd.com/admin`  
**Documentation:** See `ADMIN_SETUP.md` for user guide  
**Questions?** Check the troubleshooting section above
