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

`APP_DATA_DIR` controls where SQLite and uploaded images are stored. Locally it defaults to `./data`; in the included Render deployment blueprint it is `/var/data` on a persistent disk.

## Production deployment

The repository includes `render.yaml` for a single-service Render deployment. It builds the Vite app, starts the Express server, exposes `/api/health` for health checks, and mounts persistent storage for the SQLite database and uploaded images.

1. Push the repository to GitHub.
2. In Render, create a new Blueprint and select this repository. Render will read `render.yaml`.
3. Before the first deploy, set `ADMIN_PASSWORD_HASH` to a bcrypt hash for the password you want to use. Do not put the plaintext password or its hash into GitHub.
4. Deploy. Render provides the public HTTPS URL.
5. Open `<your-render-url>/#admin` to manage products.
6. Share `<your-render-url>/?code=PRODUCTCODE` in Instagram.

For the included persistent-disk configuration, the service uses `/var/data` for `products.db` and `uploads/`. Back up this storage before making major production changes.
