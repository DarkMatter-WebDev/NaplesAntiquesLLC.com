# Feature: Shop Listings — Schema & Add-a-Listing Runbook

> How a product is defined and the exact steps to add one without breaking
> anything. Goal: make new listings fast and consistent. Related:
> `online-shop.md` (shop behavior), `STRUCTURE.md`, `INTEGRITY.md`.
> Last updated: **2026-06-02**.

## Where listings live

- **Catalog (source of truth):** `scripts/shop/shop-products.js` —
  `window.SHOP_PRODUCTS` is an array of product objects.
- **Detail page:** `product.html?id=<id>` renders entirely from the catalog.
- **Shop grid cards:** hand-authored `<article>` blocks in `shop.html` and
  `es/shop.html` that mirror the catalog (same ids/order/count).
- **Images:** `assets/images/shop/`, referenced root-absolute (`/assets/...`).
- **Pricing math:** `scripts/shop/shop-pricing.js`.

## Product schema

```js
{
  id: "14k-byzantine-link-chain-necklace-01", // permanent, kebab-case, unique
  category: "Gold",                            // current catalog is all "Gold"
  title: "Solid 14K Gold Byzantine Link Chain Necklace",
  title_es: "Collar de Cadena de Eslabón Bizantino de Oro Sólido de 14K",

  priceMode: "spot-multiplier",   // "spot-multiplier" | "manual"
  // --- spot-multiplier pricing inputs (required when priceMode is spot) ---
  purity: 14,                     // karat: 10 | 14 | 18 ...
  weightGrams: 31.28,
  pricingMultiplier: 1.25,        // retail markup over melt value
  priceLabel: "$2,469.89",        // fallback shown before live spot loads
  manualPriceLabel: "$2,469.89",  // shown when priceMode === "manual"

  status: "Available",            // "Available" | "Sold" | "On Hold" ...
  images: [                       // root-absolute; first image is the card/hero
    "/assets/images/shop/shop-14k-byzantine-link-chain-01.png",
    "/assets/images/shop/shop-14k-byzantine-link-chain-02.png"
  ],

  description:    "Full English paragraph shown on the detail page.",
  description_es: "Párrafo completo en español.",
  details:    ["Category: Gold", "Metal: 14K yellow gold", "Weight: 31.28 g", ...],
  details_es: ["Categoría: Oro", "Metal: Oro amarillo de 14K", ...],
  tags:    ["14k", "byzantine link", "yellow gold", "31.28 grams", ...],
  tags_es: ["14k", "eslabón bizantino", "oro amarillo", ...]
}
```

### Shop grid title rules (card alignment)

Gallery cards use a **fixed two-line title slot** so price, scrap value, and
trade-in boxes line up across the row. CSS clamps overflow; longer copy belongs
in `description` / `details` (and on the product detail page).

| Field | Limit | Notes |
|-------|-------|--------|
| `title` | **≤ 62 characters** | Must match the `<h3>` on `shop.html` exactly. |
| `title_es` | **≤ 85 characters** | Must match the `<h3>` on `es/shop.html` exactly. |

`node tools/check-integrity.mjs` enforces character limits and **card ↔ catalog
title parity**. Put clasp style, stones, and other specifics in the description
or details bullets—not the grid title (e.g. use “10K Gold Monaco Cuban Link
Necklace”, not “…with Pavé Diamond Clasp”).

### Field rules
- `id` — **permanent.** Supabase favorites/carts store it. Never rename; retire
  with `status` instead. Lowercase, hyphenated, end with `-01` (bump for dupes).
- `priceMode: "spot-multiplier"` → must have positive `purity`, `weightGrams`,
  `pricingMultiplier`. Price = melt(`purity`,`weightGrams`,spot) × multiplier.
- `priceMode: "manual"` → must have `manualPriceLabel`; no live calc.
- `images[0]` is the gallery hero and the shop-card image.
- All `*_es` fields are **required** (bilingual rule).

## Add a listing — step by step

1. **Stage photos.** Copy into `assets/images/shop/` named
   `shop-<id-stem>-01.png`, `-02.png`, … (sequential). Keep originals out of the
   served tree.
2. **Add the catalog object** to `scripts/shop/shop-products.js` with every
   field above, EN **and** ES. Pick the spot multiplier you intend to use.
3. **Add the shop card** to `shop.html` (English) and `es/shop.html` (Spanish):
   copy an existing `<article data-shop-item="...">` block, then update
   `data-shop-item`, `data-filter-*` (metal/purity/chain-type/length),
   `data-tags`, `data-search`, the image `src`/`alt`, the `<h3>` title (must
   equal `title` / `title_es` and stay within the limits above), the short
   description, and the price context. **Match id/order/count** across both
   files.
4. **New chain type?** Add the `<option>` to the `shop-chain-type-filter`
   `<select>` in **both** `shop.html` and `es/shop.html` (localize the label).
5. **Cache-bust** if you changed any shared script: bump its `?v=` token on all
   pages that load it (EN + ES).
6. **Verify:**
   ```bash
   node tools/check-integrity.mjs
   node scripts/shop/test-shop-pricing.js   # if pricing logic touched
   ```
   Then open `/shop.html` and `/es/shop.html` and the new `product.html?id=<id>`
   in a browser; confirm the image loads on the **Spanish** page too.
7. **Document:** add a line to `project-docs/CHANGELOG.md`; update
   `CURRENT_STATUS.md` item count if relevant.

## Remove / mark sold
Set `status` to `"Sold"` (or remove the shop-grid cards but keep the catalog
object so existing favorites still resolve on the detail page). Do **not** delete
the `id`.

## Why it's structured this way
A real build step (Eleventy/Astro) would generate the shop cards from the
catalog so step 3 disappears. That needs a Node/npm + git environment we don't
have in the current authoring shell, so for now the cards are mirrored by hand
and the **integrity checker is the safety net** that fails the build if the
mirror drifts. See `STRUCTURE.md` → "Known debt / future structure."
