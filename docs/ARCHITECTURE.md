# Architecture

## Public flow
1. Visitor opens the home page.
2. Visitor enters a product code.
3. The app looks up the published product.
4. Product page renders up to four images in a swipeable gallery.
5. Buy Now redirects to the saved affiliate URL.

## Admin flow
1. Admin authenticates.
2. Admin creates a product with code, product name, pricing, up to four images, affiliate URL and description.
3. Product can be saved as draft or published.
4. Admin can later edit, hide or delete products.

## Security
Affiliate URLs are treated as admin-managed data and are not displayed as editable content to public visitors. Public users never need an account.

## Suggested stack
- Next.js / React frontend
- API routes or a small Node backend
- Database for products and admin records
- Object storage for uploaded product images
