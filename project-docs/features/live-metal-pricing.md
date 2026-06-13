# Feature: Live Metal (Gold) Pricing

## Summary

Shop prices update automatically against the live gold spot price. A Netlify
Function fetches and caches the spot price; the client computes each product's
price from it.

## Key Files

- `netlify/functions/metal-prices.js` — serverless price fetch + cache + fallback.
- `scripts/shop/shop-pricing.js` — `window.ShopPricing` client module.

## Server: `metal-prices.js`

- Endpoint: `/.netlify/functions/metal-prices` (GET; OPTIONS for CORS preflight).
- Source: `https://api.gold-api.com/price/XAU` (no key required currently).
- Returns: `goldSpotPerTroyOz`, `goldSpotPerGram24k`, `currency`, `source`,
  `updatedAt`, `nextUpdateAt`, and `marketStatus` (Eastern-time weekend-close
  detection).
- Caching: 5-minute in-memory cache (`CACHE_TTL_MS`).
- Fallback: if the API fails, returns `FALLBACK_GOLD_SPOT_PER_TROY_OZ = 5500`
  with `source: "fallback"` and a `warning`, so the shop never breaks.
- `GRAMS_PER_TROY_OZ = 31.1034768`.

## Client: `ShopPricing`

- Fetches the function, caches the payload 5 min in `sessionStorage`
  (`naplesGoldSpotCacheV2`), with its own fallback.
- Price math (per `online-shop.md`): `meltValue × pricingMultiplier`.
- Updates shop cards (`[data-shop-item]`), the product page, and spot-meta labels.
- Shows a live countdown to the next update, or a "market closed" message on
  weekends.
- Refresh timer re-checks every 15s and force-refreshes spot when due.
- Public API: `onReady`, `fetchSpot`, `refreshLiveSpot`, `calculatePublicPrice`,
  `getDisplayPrice`, `applyProductPrices`, `getSpotData`, `init`, etc.

## Notes / Gotchas

- Only **gold** is wired up today (silver/platinum would need new sources +
  product fields).
- The public `gold-api.com` endpoint has unknown rate limits — for higher traffic
  consider a keyed provider behind the same function (see `TASKS.md`).
- Fallback spot (5500) is intentionally high so fallback prices never undersell;
  revisit if it drifts far from market.
