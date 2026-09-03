# UPCHA Affiliate Product Portal

A full-stack affiliate product publishing portal designed for Instagram traffic.

## Features

### Public customer experience
- No customer login or registration.
- Enter a product code to open a published product.
- Direct links also work with `/?code=PRODUCTCODE`.
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

## Run locally

1. Install Node.js 20+.
2. Copy `.env.example` to `.env`.
3. Set a strong `JWT_SECRET` and an admin password hash.
4. Install dependencies: `npm install`.
5. Build: `npm run build`.
6. Start: `npm start`.
7. Open `http://localhost:3000` for the public page.
8. Open `http://localhost:3000/#admin` for the admin portal.

For development, use `npm run dev` to start Vite and the API together.

## Environment

`ADMIN_USER` controls the admin username. `ADMIN_PASSWORD_HASH` is a bcrypt hash of the admin password. `JWT_SECRET` must be a long random secret in production. Never commit `.env` or real credentials.

## Storage

Products are stored in SQLite at `data/products.db`. Uploaded images are stored under `uploads/`. These directories are intentionally ignored from Git. For production, deploy the app on persistent storage or replace the storage layer with managed database/object storage.

## Deployment

The repository includes a GitHub Actions build check. A production host should run `npm install`, `npm run build`, then `npm start`, with the environment variables configured securely and persistent storage mounted for `data/` and `uploads/`.
