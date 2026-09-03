# UPCHA Affiliate Product Portal

A full-stack affiliate product publishing portal designed for Instagram traffic.

## Features

### Public customer experience
- No customer login or registration.
- Enter a product code to open a published product.
- Direct links work with `/?code=PRODUCTCODE`.
- Mobile-first white/clean product page.
- Up to 4 product images with swipe/previous/next controls.
- Selling price, original price, savings and description.
- Buy Now records an affiliate click and redirects to the stored affiliate URL.

### Admin experience
- Protected admin login.
- Product dashboard with total, published, draft and affiliate-click stats.
- Create, edit and delete products.
- Product code, name, selling price, original price, description and affiliate URL.
- Upload up to 4 images per product; JPG/PNG/WEBP/GIF, 5 MB each.
- Draft or publish products.
- Search products.
- Copy public product links.
- Affiliate click tracking.
- Password-change API is included for the Cloudflare deployment.

## Free production deployment

The recommended zero-cost architecture is **Cloudflare Workers + D1 + R2**:

- Workers serves the React/Vite site and API.
- D1 stores products, clicks and the admin account.
- R2 stores uploaded product images.
- No Render persistent disk is required.

Cloudflare's current Free limits include 100,000 Worker requests/day, D1 with 5 million rows read/day, 100,000 rows written/day and 5 GB total account storage, plus R2's free Standard tier of 10 GB-month storage, 1 million Class A operations/month and 10 million Class B operations/month. Static assets are free and unlimited. These limits are usage limits; exceeding them can stop free-tier requests or require an upgrade. See the Cloudflare pricing documentation for current limits.

### One-time setup

1. Create/sign in to a Cloudflare account.
2. On your Windows PC, install Node.js 20+.
3. In PowerShell, clone the repository and enter it:
   `git clone https://github.com/chanduuu0718/product.git`
   `cd product`
4. Log in to Cloudflare:
   `npx wrangler login`
5. Create the D1 database:
   `npx wrangler d1 create upcha-products`
6. Copy the `database_id` returned by Wrangler into `wrangler.jsonc`, replacing `REPLACE_WITH_D1_DATABASE_ID`.
7. Create the R2 bucket:
   `npx wrangler r2 bucket create upcha-product-images`
8. Initialize the database schema:
   `npx wrangler d1 execute upcha-products --remote --file=./schema.sql`
9. Set the admin bootstrap password as a Cloudflare secret. Do not put the password in GitHub:
   `npx wrangler secret put ADMIN_BOOTSTRAP_PASSWORD`
10. Set a separate random session secret:
   `npx wrangler secret put SESSION_SECRET`
11. Build and deploy:
   `npm install`
   `npm run cf:deploy`
12. Wrangler will print the public `workers.dev` URL. Open `<your-url>/#admin` to sign in.

The first admin account is created automatically from `ADMIN_USER` (default `admin`) and `ADMIN_BOOTSTRAP_PASSWORD`. The password is stored as a salted PBKDF2 hash in D1, not as plaintext. After signing in, use the password-change API if you add a UI for it; changing the secret alone does not overwrite an existing admin account.

### Important free-tier note

As of September 1, 2026, Cloudflare enforces D1's Free daily row-read and row-write limits. If those limits are exceeded, D1 requests fail until the daily reset. citeturn0search6

### Local development

The existing Express + SQLite version is still kept for local development:

1. Copy `.env.example` to `.env`.
2. Set a strong `JWT_SECRET` and `ADMIN_PASSWORD_HASH`.
3. Run `npm install`.
4. Run `npm run dev`.
5. Open `http://localhost:3000` or `http://localhost:3000/#admin`.

The Cloudflare Worker is in `worker/index.js`, the D1 schema is `schema.sql`, and the deployment configuration is `wrangler.jsonc`.

## Security

Never commit passwords, API tokens, Cloudflare secrets, `.env` files, D1 data, uploaded images, or `.dev.vars` to GitHub. The repository's `.gitignore` excludes local data and Wrangler state.

## Existing Render deployment

`render.yaml` and the Express server remain in the repository for users who later choose paid persistent hosting. They are not required for the free Cloudflare deployment.
