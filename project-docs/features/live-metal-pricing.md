# Feature: Live Metal Pricing

> Current pricing flow for gold/silver spot-backed products. Last updated:
> **2026-06-20**.

## Summary

Shop prices update against server-side spot data in the Next.js app. The old
root Netlify Function and static `window.ShopPricing` script are retired.

Current surfaces:

- public shop cards,
- product detail pricing and melt/scrap context,
- cart, checkout, wishlist, admin pricing previews,
- `/api/metal-prices` for browser/API consumers.

## Key Files

- `next-app/src/lib/spot-price.ts` - fetches/caches spot data from
  `api.gold-api.com` with fallback values.
- `next-app/src/app/api/metal-prices/route.ts` - Next route handler exposing
  spot data to the app.
- `next-app/src/lib/pricing.ts` - product melt value and display price helpers.
- `next-app/src/types/product.ts` - product pricing fields and status helpers.
- `next-app/src/app/[locale]/shop/page.tsx` - server-side spot fetch for shop
  listing pricing.
- `next-app/src/app/[locale]/shop/[id]/page.tsx` - product detail price context.
- `next-app/src/components/shop/PriceUpdateTicker.tsx` - visible refresh timing
  where used.

## Data Shape

Pricing inputs live on Supabase `products` rows:

- `category` - legacy broad pricing category, currently `Gold` or `Silver`.
- `metal_type` - broader merchandising metal family.
- `metal_variant` - color/subtype such as yellow gold, white gold, silver,
  vermeil, platinum.
- `purity` - karat for gold, sterling/silver value for silver inventory.
- `weight_grams` / `gram_weight` - product weight used for melt value.
- `price_mode` - `spot-multiplier` or `manual`.
- `pricing_multiplier` - multiplier over melt for spot-priced items.
- `manual_price_label` / `asking_price` - fixed/manual display values.

## Pricing Logic

For spot-multiplier products:

```text
meltValue = spotPerGram * purityRatio * gramWeight
displayPrice = meltValue * pricingMultiplier
```

`pricing.ts` owns the exact helper behavior so shop cards, detail pages, cart,
checkout, and admin surfaces stay consistent.

Manual-priced products skip the live multiplier math and display the saved
manual price label/asking price.

## Source And Fallback

`spot-price.ts` currently uses `api.gold-api.com` and keeps a fallback so the
shop remains usable if the provider is unavailable. If traffic grows or the
public endpoint becomes unreliable, add a keyed provider behind the same helper
instead of calling a provider directly from the browser.

## Verification

After pricing code, route, or schema-contract changes:

```bash
cd next-app
npm run lint
npm run build
```

Also verify `/api/metal-prices`, `/shop`, and at least one `/shop/[id]` product
detail page in-browser.
