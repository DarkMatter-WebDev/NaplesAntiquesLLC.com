# Integrity Rules & Pre-Publish Checklist

> Concrete rules that keep the static site consistent, plus the checklist to run
> before publishing. The mechanical rules are enforced by
> `node tools/check-integrity.mjs`. See `STRUCTURE.md` for the big-picture map.
> Last updated: **2026-06-02**.

## The one command

```bash
node tools/check-integrity.mjs
```

No install needed (pure Node built-ins). Exit `0` = pass, `1` = fail. Run it
after editing listings, adding pages, or changing scripts/CSS. It is also the
**Netlify build command** (`netlify.toml`), so a failure **blocks the deploy**.
It checks:

- **Catalog schema** — required fields present, valid `priceMode`, spot-priced
  items have positive `purity` / `weightGrams` / `pricingMultiplier`, manual
  items have a `manualPriceLabel`.
- **Unique ids** — no duplicate product ids.
- **Image integrity** — every image path is root-absolute (`/assets/...`) and
  the file actually exists on disk (ignoring any `?v=` cache token).
- **Shop parity** — `shop.html` and `es/shop.html` list the **same item ids, in
  the same count**, and every card maps to a real product.
- **Shop grid titles** — each card `<h3>` matches `title` / `title_es` in the
  catalog; English ≤ 62 chars, Spanish ≤ 85 chars (keeps price/trade-in rows
  aligned). See `features/shop-listings.md` → “Shop grid title rules”.
- **EN ↔ ES page parity** — warns if any page is missing its twin.
- **Spanish paths** — fails if an `es/` page uses a relative `assets/`,
  `scripts/`, or `editorial-*` path instead of root-absolute.

## Rules in detail

### 1. Bilingual or it doesn't ship
Every product needs `title_es`, `description_es`, `details_es`, `tags_es`. Every
new page needs an `/es/` twin with reciprocal `hreflang` and a `sitemap.xml`
entry. AI-drafted Spanish is acceptable to publish but must be flagged for a
native-speaker review pass (tracked in `TASKS.md`).

### 2. Root-absolute paths only
Use `/assets/...`, `/scripts/...`, `/editorial-theme.css`. Relative paths break
on `/es/` pages because they resolve one directory too deep. This is the most
common Spanish-page regression.

### 3. Product ids are forever
`favorites.product_id` and saved carts in Supabase store these strings. Renaming
an id silently orphans a customer's saved data. To remove an item from sale,
change its `status` (e.g. `"Sold"`), don't delete/rename the id.

> Note: some ids are friendly-but-stale (e.g. `new-listing-06` is now a real,
> detailed Cuban-link necklace). That's fine — **keep the id stable**; the title
> and copy are what customers see.

### 4. Cache-bust together
When you change a shared script or `editorial-theme.css`, bump its `?v=` token on
**every** page that references it — English and Spanish. A mismatch means some
pages load old JS and behave differently. Use a dated token,
e.g. `?v=incart-state-20260602`.

### 5. Shop grid mirrors the catalog
The hand-authored cards in `shop.html` / `es/shop.html` must mirror
`SHOP_PRODUCTS`: same ids, same order, same count, prices and copy consistent
with the data object. The detail page (`product.html`) already renders straight
from the catalog, so the catalog wins any disagreement. Grid `<h3>` titles must
match `title` / `title_es` and stay within the two-line limits enforced by the
integrity checker so card pricing blocks stay aligned.

### 6. Pricing stays data-driven
Don't hard-code a final price in two places that can drift. For spot-priced
items the displayed price is computed from `purity × weightGrams × spot ×
pricingMultiplier`; `priceLabel`/`manualPriceLabel` are fallbacks only. Run
`node scripts/shop/test-shop-pricing.js` when touching pricing logic.

### 7. Never commit secrets
Only the Supabase **anon** key (public by design) belongs in
`scripts/shared/supabase-config.js`. Service-role keys, `.env`, `.env.local`
never enter the repo.

## Pre-publish checklist

- [ ] `node tools/check-integrity.mjs` passes (0 errors).
- [ ] New/changed product also updated in EN + ES (`title_es`, etc.).
- [ ] `shop.html` and `es/shop.html` cards match the catalog (ids/order/count).
- [ ] Images are in `assets/images/shop/`, root-absolute, and load on a `/es/`
      page (not just the English one).
- [ ] Any changed JS/CSS has a bumped `?v=` token on **all** pages (EN + ES).
- [ ] New page has an `/es/` twin, `hreflang` tags, and a `sitemap.xml` entry.
- [ ] Spot-pricing test passes if pricing logic changed.
- [ ] Updated `project-docs/` (`CURRENT_STATUS`, `CHANGELOG`, `TASKS` as needed).

## When something breaks "only on Spanish pages"
Almost always one of: (a) a relative asset path, (b) a stale `?v=` token on the
ES page, or (c) a string that isn't language-aware in a shared script (it should
branch on `document.documentElement.lang === "es"`). The integrity check catches
(a); the others are caught by viewing the `/es/` page in a browser.
