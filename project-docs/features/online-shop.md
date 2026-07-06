# Feature: Online Shop

> Current Next.js/Supabase shop behavior. Last updated: **2026-07-06**.

## Summary

The shop is the public storefront for curated estate inventory. It lives in the
Next.js app at `/shop` and `/shop/[id]`, with Spanish equivalents under `/es`.
The catalog is backed by the Supabase `products` table and priced live against
gold/silver spot data.

There is no active root static `shop.html`, `product.html`, or
`scripts/shop/shop-products.js` catalog anymore.

## Key Files

- `next-app/src/app/[locale]/shop/page.tsx` - shop listing route, filtering,
  sorting, pagination, hero, and server-side product query.
- `next-app/src/app/[locale]/shop/[id]/page.tsx` - product detail route.
- `next-app/src/components/shop/ProductCard.tsx` - public product card,
  image rendering, cart/wishlist affordances.
- `next-app/src/components/shop/ProductImageGallery.tsx` - product detail
  image gallery and zoom behavior.
- `next-app/src/components/shop/ShopFilters.tsx` - public filter controls.
- `next-app/src/components/admin/AdminShell.tsx` - Product Admin inventory
  editor, image uploads, crop workflow, product save path.
- `next-app/src/types/product.ts` - product/status/taxonomy/image-padding
  contract.
- `next-app/src/lib/pricing.ts` and `next-app/src/lib/spot-price.ts` - display
  price and spot-price logic.
- `supabase/products.sql` plus additive migrations in `supabase/` - database
  schema and storage policies.

## Product Data

Supabase `products` is the source of truth. Important fields include:

- identity/order: `id`, `slug`, `inventory_number`, `sku`, `sort_order`
- status/location: `status`, `location`, `featured`
- copy: `title`, `title_es`, `description`, `description_es`, `public_notes`,
  `internal_notes`
- catalog taxonomy: `product_type`, `jewelry_type`, `chain_type`, `length`,
  `brand`, `gender`
- metal/pricing: `category`, `metal_type`, `metal_variant`, `purity`,
  `weight_grams`, `gram_weight`, `price_mode`, `pricing_multiplier`,
  `manual_price_label` (`asking_price` remains a legacy DB fallback only)
- images: `images`, `image_urls`, `image_padding`,
  `image_padding_by_image`
- arrays: `tags`, `tags_es`, `details`, `details_es`

`image_urls` is preferred at render time, with `images` kept as compatibility
fallback. The current admin save path mirrors the same URL/path list into both
fields.

## Product Images

Image bytes are not stored in product rows.

- New admin uploads are compressed to WebP in the browser and uploaded to the
  Supabase Storage bucket `product-images`, under the `products/` folder.
- Product rows store only public Storage URLs or legacy local `/assets/...`
  paths.
- Local product/page images live under `next-app/public/assets`.
- `next-app/next.config.ts` allows the Supabase Storage public object host for
  optimized `next/image` rendering.

2026-06-20 audit:

- 48 live products.
- 321 image entries in `products.images` and 321 in `products.image_urls`.
- 0 `data:`/base64 inline image payloads.
- 28 products are Supabase Storage-only.
- 19 products are local-asset-only.
- 1 product mixes local assets and Storage URLs.
- All 202 DB-referenced Storage objects exist.
- The 91 old unreferenced Storage objects found by the audit were archived,
  deleted with a confirmed GC run, and followed by a dry-run showing 0 orphans
  and 0 deletable paths.
- DB-backed local shop PNG paths were migrated to WebP; the 114 repointed shop
  PNG originals were deleted, and no PNG files remain under
  `next-app/public/assets`.

## Pricing Logic

For spot-multiplier products:

```text
meltValue = spotPerGram * purityRatio * gramWeight
displayPrice = meltValue * pricingMultiplier
```

Gold and silver spot data are fetched server-side by `spot-price.ts` and exposed
through `/api/metal-prices`. Product detail pages also show melt/scrap context
and the spot basis used for the calculation. Manual-priced products use
`manual_price_label` instead of live multiplier pricing; checkout still keeps a
legacy `asking_price` fallback for older rows that have no label.
Bare numeric manual labels are normalized by `pricing.ts` (`1` -> `$1`,
`1200` -> `$1,200`) and parsed by the same helper in shop display, cart,
checkout, and order snapshots. New Item's **Quick add** mode sets manual fixed
pricing and skips spot-pricing requirements, supporting a basic title + price
listing without purity/weight/multiplier inputs.

## Public Browse Behavior

- `/shop` is the single storefront entry route.
- The retired `/store` chooser and `/silver-tableware` merchandising route were
  removed on 2026-06-19.
- The modern shop page participates in the shared customer-facing loaded-block
  reveal for its hero/filter surfaces. Product cards keep their dedicated
  image-aware row-by-row reveal; broad gallery parents are excluded so lazy
  product images cannot hold the page hidden. Reduced-motion users skip the
  entrance animation.
- Filters are URL-backed and include item group/type, metal, metal color,
  purity, brand, gender, length/size, price range, availability, sort, and
  pagination.
- Public gallery shows only `available`/`sold`; it excludes `pending_payment`,
  `draft`, and `archived` (`pending_payment` comes from admin-created unpaid orders;
  PayPal checkout no longer holds inventory; see the no-hold model in
  `features/paypal-checkout.md`). A sold item drops out of the cached catalog
  promptly via `revalidateTag('shop-catalog', { expire: 0 })` on capture.
  Every admin order-flow write to `products` (cancel/reopen/mark-paid,
  delete-order return-to-inventory, archive/delete) calls the same tag
  through `adminRevalidateProduct(s)` in
  `next-app/src/app/actions/admin-products.ts` â€” see
  `features/paypal-checkout.md`.

## Admin Workflow

Admins manage inventory from `/admin`.

1. Add/edit a product in Product Admin.
2. Upload photos through the product drawer. The browser compresses each photo
   to WebP and uploads it to Supabase Storage.
3. Save the product. The database stores image URLs/paths and product metadata,
   not binary image payloads.
4. Use crop/padding controls when needed. Cropping uploads a replacement image
   and attempts to remove the old uploaded Storage object when no product still
   references it.
5. Product ordering is managed by drag-to-reorder in the admin table.

For quick fixed-price listings, admins can check **Quick add** on New Item, enter a
title and price label, and save without entering spot-pricing fields. The save path
normalizes the manual price label and stores `price_mode='manual'`.

## Verification

After shop/admin/product code, route, schema-contract, or config changes:

```bash
cd next-app
npm run lint
npm run build
```

For data-only image/storage audits, verify against live Supabase before deleting
objects. Destructive Storage cleanup must stay dry-run-first, include the
reference set in the report, respect the 24-hour safety threshold, and be
followed by a second dry-run after any confirmed delete.
