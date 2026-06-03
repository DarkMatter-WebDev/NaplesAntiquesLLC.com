# Current Status

> Reflects the present state of development. **Update this at the end of every
> work session.** Last updated: **2026-06-02**.

## What Is Currently Working

- **Full marketing site** is live: home, about, what-we-buy (+ estate-jewelry,
  gold-services, silver-services, bullion sub-pages), process, estate-services,
  faq, contact, privacy.
- **Online shop** (`shop.html`) lists 19 estate gold products (all "Gold"
  category) defined in `scripts/shop/shop-products.js`, with filtering and a
  product detail page (`product.html?id=...`).
- **Live gold-spot pricing**: `netlify/functions/metal-prices.js` fetches the
  XAU price from `gold-api.com`, caches it 5 min, and the shop recalculates each
  product price as `meltValue * pricingMultiplier`. Falls back to a static spot
  estimate and shows a "market closed" state on weekends.
- **Customer accounts** (Supabase): sign up / sign in / email confirmation,
  profile with address + interests, saved favorites, and a saved cart that
  merges local → account on sign-in. Config is filled in
  `scripts/shared/supabase-config.js` (anon key only).
- **Cart**: localStorage cart for guests, synced to Supabase for signed-in users.
- **Lead form**: "Submit Your Item" on `contact.html` is a **Jotform embed**
  (form id `261379265677068`); Jotform handles delivery + photo uploads.
- **Newsletter**: MailerLite embed on the homepage (`#newsletter`, form `I6Xvs6`).
- **SEO**: per-page meta, canonical tags, JSON-LD `JewelryStore` schema,
  `sitemap.xml`, `robots.txt`.
- **Dark Matter Web Services** footer credit badge on all pages.

## What Was Recently Completed

- **Build-structure / integrity guardrails (2026-06-02):** added permanent docs
  `project-docs/STRUCTURE.md`, `INTEGRITY.md`, and `features/shop-listings.md`,
  plus a dependency-free guardrail `tools/check-integrity.mjs` (run with plain
  `node`, no install). It validates the catalog schema, unique ids, image
  existence, EN↔ES shop/page parity, and root-absolute Spanish paths. Currently
  passes (19 products, 0 errors). Run before publishing.
- Asset reorganization into `assets/images/...` with 301 redirects from legacy
  root URLs in `netlify.toml`.
- Scripts grouped under `scripts/{shared,shop,account,forms}/` with legacy-URL
  redirects.
- Added the Dark Matter Web Services credit bar (theme version
  `darkmatter-credit-20260601`).
- Established this `project-docs/` memory system (2026-06-01).

## Current Priorities

1. **Spanish translation (EN/ES)** — **full site translated** (all 18 `/es/` pages
   incl. shop + all 11 listings + dynamic JS strings). Next: native-speaker review
   pass, then create a Spanish MailerLite newsletter form. Plan:
   `features/spanish-translation.md`.
2. Keep shop inventory current (add/remove items in `shop-products.js`) — remember
   to add `title_es`/`description_es`/`details_es`/`tags_es` for each new product.
3. Confirm Supabase email redirect URLs match the production domain.
4. Confirm Jotform notifications go to the right email/recipient.

## Spanish (EN/ES) — full rollout status

- **Done (2026-06-01):** all 18 pages have `/es/` twins — `index`, `about`,
  `what-we-buy`, `estate-jewelry`, `gold-services`, `silver-services`, `bullion`,
  `process`, `estate-services`, `faq`, `contact`, `privacy`, `shop`, `product`,
  `cart`, `account`, `account-dashboard`, `member-access`. All English + Spanish
  pages carry reciprocal `hreflang` (en/es/x-default); `sitemap.xml` lists both.
- EN/ES toggle is injected site-wide via `scripts/shared/site-header.js` (computes
  each page's twin). Verified both directions in-browser.
- Spanish pages use **root-absolute** asset/script paths (`/assets`, `/scripts`,
  `/editorial-*.css`) so they resolve from `/es/` depth.
- **Shop is single-source**: every product in `shop-products.js` has
  `title_es`/`description_es`/`details_es`/`tags_es`; product images were made
  root-absolute (`/assets/...`) so they load on `/es/` pages too.
- **Shared JS is language-aware** (detects `<html lang="es">`): `shop-pricing.js`,
  `product-page.js`, `shop-filters.js`, `cart-page.js`, `account-portal.js`,
  `account-dashboard.js`, `registered-only.js` render Spanish strings on `/es/`.
  All changed scripts bumped to cache-bust `?v=es-i18n-20260601`.
- **Remaining gap:** the MailerLite newsletter embed is still English (per client,
  handled later) — needs a Spanish form. Jotform on `/es/contact.html` still uses
  the English form id `261379265677068`.

## Active Blockers

- No automated tests / CI; verification is manual.
- `git` is not available on the current Windows shell PATH — confirm the repo's
  version-control + deploy workflow (see `CLIENTS.md` / `TASKS.md`).

## Next Recommended Actions

- Verify Supabase **Auth → URL configuration** redirect URLs include the live
  domain (`https://naplesantiquesllc.com/account.html`).
- Fill in the unknowns in `CLIENTS.md` (GitHub repo URL, Netlify site name,
  billing/maintenance plan).
- Optionally remove the now-unused legacy lead-form files
  (`submit-item-form.js`, `submit-item-form.partial.html`, `submit-item-form.css`)
  superseded by the Jotform embed.
