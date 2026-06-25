# Feature: Shop Listings - Product Runbook

> How to add, edit, audit, and retire listings in the current Next.js/Supabase
> shop. Last updated: **2026-06-20**.

## Source Of Truth

- Product rows live in Supabase `products`.
- Product type/status/image contracts live in `next-app/src/types/product.ts`.
- Product Admin lives at `/admin` and is implemented mainly in
  `next-app/src/components/admin/AdminShell.tsx`.
- Public listing/detail rendering lives under
  `next-app/src/app/[locale]/shop/` and `next-app/src/components/shop/`.
- Product photos should live in Supabase Storage (`product-images/products`) for
  new uploads. Some legacy products still reference local
  `next-app/public/assets/images/shop/*` files.

Do not reintroduce the retired static `window.SHOP_PRODUCTS` catalog.

## Listing Fields

Keep these fields especially consistent:

- `id`: permanent public identifier used in URLs, carts, favorites, orders, and
  admin references.
- `inventory_number`: visible inventory number. Fix duplicate live values before
  enforcing the unique migration.
- `status`: lifecycle status (`draft`, `available`, `reserved`,
  `pending_payment`, `sold`, `archived`).
- `product_type` / `jewelry_type`: broad item form. Admin supports curated
  options plus concise custom product type strings.
- `chain_type`: link type, scoped to necklace/bracelet products.
- `length`: bare numeric/string measurement; buyer-facing code adds units when
  appropriate.
- `category`: legacy pricing category (`Gold`/`Silver`).
- `metal_type`: broader metal family.
- `metal_variant`: merchandising color/subtype such as yellow gold, white gold,
  rose gold, silver, vermeil, or platinum.
- `images` / `image_urls`: URL/path string arrays only. No inline image data.

## Add A Listing

1. Open `/admin` as an admin user.
2. Choose Add Product.
3. Fill title, metal/pricing fields, product type, brand, size/length, notes,
   status, and Spanish copy when available.
4. Upload photos in the drawer. New files are compressed to WebP and uploaded to
   Supabase Storage.
5. Put the intended cover photo first. Drag/reorder images in the drawer if
   needed.
6. Use Crop only when necessary. Crop creates a new Storage object and replaces
   the URL in the form state.
7. Use image padding controls for product-card/detail frame color when a photo
   needs a white/black/custom-color background.
8. Save. The normal save path writes metadata and image URL/path strings to
   Supabase.
9. Verify the product on `/shop` and `/shop/[id]`.

## Edit A Listing

- Preserve `id` unless the owner explicitly accepts URL/saved-state breakage.
- Prefer changing `status` over deleting products with sales/order history.
- Keep `image_urls` and `images` aligned until the compatibility field strategy
  changes.
- When replacing photos, verify the old uploaded Storage object is no longer
  referenced before deleting it.
- Run the relevant SQL migrations before relying on newer fields such as
  product type, brand, metal variants, per-photo padding, and unique inventory
  numbers in production.

## Retire Or Mark Sold

- Use `sold` for sold inventory.
- Use `archived` for internal records that should not appear publicly.
- Use `pending_payment` when checkout/order flow is holding inventory.
- Avoid hard delete if the product has order, invoice, saved-item, or inquiry
  history.

## Image Audit Checklist

For a storage cleanup pass:

1. Query `products.images` and `products.image_urls`.
2. Normalize Storage paths from URLs containing
   `/storage/v1/object/public/product-images/`.
3. Compare those paths with objects listed in Supabase Storage bucket
   `product-images`, folder `products`.
4. Treat DB-referenced missing objects as broken product images.
5. Treat unreferenced objects as cleanup candidates only after checking whether
   they are draft/recovery/recently replaced assets.
6. Confirm there are no `data:` entries in product image arrays.

2026-06-20 audit found no DB-referenced missing Storage objects and 91
unreferenced Storage objects.

## Verification

For code/schema changes:

```bash
cd next-app
npm run lint
npm run build
```

For documentation-only or data-audit sessions, update project memory and record
the exact audit counts/date.
