# Feature: Online Shop

## Summary

Browse and view estate jewelry for sale, priced live against the gold spot price.
Currently ~12 products, all in the **Gold** category (chains, a bracelet, a ring).

## Key Files

- `shop.html` — listing page (grid of product cards + filters + spot meta).
- `product.html` — single product detail, read via `?id=<product-id>`.
- `scripts/shop/shop-products.js` — `window.SHOP_PRODUCTS` static catalog (source
  of truth for inventory).
- `scripts/shop/shop-pricing.js` — `window.ShopPricing`: fetches spot, computes
  prices, updates cards + product page, periodic refresh.
- `scripts/shop/shop-filters.js` — listing filters.
- `scripts/shop/product-page.js` — renders the product detail page.
- `scripts/shop/test-shop-pricing.js` — pricing sanity checks.

## Product Data Shape

Each item in `SHOP_PRODUCTS` includes:

- `id`, `category`, `title`, `description`, `details[]`, `tags[]`, `images[]`
- `status` (e.g. `"Available"`)
- Pricing fields: `priceMode` (`"spot-multiplier"`), `purity` (10/14/18k),
  `weightGrams`, `pricingMultiplier`, plus `priceLabel` / `manualPriceLabel`
  (display fallback).
- Optional `privatePriceLabel` for VIP-only pricing.

## Pricing Logic

For spot-multiplier items:

```
spotPerGram24k = goldSpotPerGram24k (from the metal-prices function)
meltValue      = spotPerGram24k * (purity / 24) * weightGrams
price          = round2(meltValue * pricingMultiplier)
```

The displayed "exact gold scrap value" is the melt value; the sale price applies
the multiplier (typically 1.25x, some at 1.5x). Manual-priced items just show
`manualPriceLabel`. See `features/live-metal-pricing.md` for the spot source.

## Adding / Editing Products

1. Edit `scripts/shop/shop-products.js`.
2. Add images under `assets/images/shop/` and reference them in `images[]`
   (cache-bust with `?v=...` when replacing an existing filename).
3. Keep `id` stable — it's used in URLs and in the `favorites` table.
4. Set pricing fields for live pricing, or use `manualPriceLabel` for a fixed price.

## Notes / Gotchas

- No real checkout/payment yet — buying is contact-driven.
- `product_id` in Supabase `favorites` must match the `id` here.
- All current inventory is gold; other categories are backlog (see `TASKS.md`).
