# Structure & Build Integrity

> The canonical map of how this project is laid out and the **invariants** that
> keep it consistent over time. If you change the structure, update this file
> **and** the automated guard (`tools/check-integrity.mjs`). Paired docs:
> `INTEGRITY.md` (rules + checklist) and `features/shop-listings.md` (how to add
> a listing). Last updated: **2026-06-02**.

## What kind of site this is

A **static multi-page website** — one hand-written `.html` file per page, plain
CSS, and small vanilla-JS modules. There is **no SPA framework and no compile
step**: Netlify serves the repo root as-is (`publish = "."`). Dynamic behavior
comes from three places only:

- **Supabase** — customer auth + data (profiles, favorites, carts).
- **Netlify Function** `metal-prices.js` — live gold spot price.
- **Client JS** — cart, filters, pricing math, header injection.

This is intentional and appropriate for the site's size. The trade-off is that
**shared chrome (header/footer/nav) is duplicated across every page**, so
consistency is maintained by convention + tooling rather than by a templating
engine. The rules below exist to protect that consistency.

## Single sources of truth

Each of these is the **one** place a given fact lives. Never fork them.

| Concern | Single source of truth |
|---------|------------------------|
| Product catalog (ids, prices, copy, images, EN + ES) | `scripts/shop/shop-products.js` (`window.SHOP_PRODUCTS`) |
| Pricing math (melt value × multiplier, spot fetch) | `scripts/shop/shop-pricing.js` |
| Header/nav + account/cart links + EN/ES toggle | `scripts/shared/site-header.js` |
| Live gold spot price | `netlify/functions/metal-prices.js` |
| Auth / profile / favorites / saved cart API | `scripts/shared/naples-auth.js` |
| Cart state | `scripts/shared/cart.js` (`window.ShopCart`) |
| Theme version / cache-bust token | `?v=` query on `editorial-theme.css` + script tags |
| Project context / history | `project-docs/` |

The product **detail page** (`product.html`) and the **shop grid cards** both
describe the same items. The detail page renders entirely from
`SHOP_PRODUCTS`. The shop-grid cards are currently hand-authored HTML that
**mirror** `SHOP_PRODUCTS` — see `INTEGRITY.md` for the parity rules that keep
the two in sync, and `features/shop-listings.md` for the add-a-listing runbook
(including **shop grid title length limits** and the shared two-line card layout
in `shop.html` / `es/shop.html` CSS).

## Directory map

```
EstateJewelry/
├── *.html                      # English pages (index, shop, product, ...)
├── es/*.html                   # Spanish twins (one per English page)
├── editorial-base.css          # base editorial styles
├── editorial-theme.css         # theme (cache-busted via ?v=)
├── netlify.toml                # publish/functions/redirects/headers
├── robots.txt, sitemap.xml     # SEO (sitemap lists EN + ES with hreflang)
├── AGENTS.md                   # entry point for AI/human contributors
├── ACCOUNT_SETUP.md            # Supabase setup notes
├── assets/images/{branding,pages,shop}/   # served images
├── netlify/functions/metal-prices.js      # live gold spot price
├── supabase/{schema.sql,fix-permissions.sql}
├── scripts/
│   ├── shared/   # site-header, cart, naples-auth, supabase-config, registered-only
│   ├── shop/     # shop-products (catalog), shop-pricing, shop-filters, product-page
│   ├── account/  # account-portal, account-dashboard
│   └── forms/    # submit-item-form (LEGACY — superseded by Jotform embed)
├── tools/
│   └── check-integrity.mjs     # dependency-free guardrail (node, no install)
└── project-docs/               # persistent memory + these guardrail docs
```

> `ARCHITECTURE.md` holds the deeper system design (DB schema, auth flow,
> integrations, hosting). This file is the quick structural map + the rules.

## Page set (must stay 1:1 EN ↔ ES)

`index, about, what-we-buy, estate-jewelry, gold-services, silver-services,
bullion, process, estate-services, faq, contact, privacy, shop, product, cart,
account, account-dashboard, member-access` — every English page has a
`/es/` twin. The integrity check warns if a twin is missing.

## Structural invariants (do not break)

1. **EN ↔ ES page parity.** Every English page has an `es/` twin and vice versa.
2. **Root-absolute paths everywhere.** Reference assets/scripts/CSS as
   `/assets/...`, `/scripts/...`, `/editorial-*.css` so they resolve at `/es/`
   depth. Spanish pages must **never** use relative `assets/` or `scripts/`.
3. **Catalog is the source of truth for items.** Add/edit a product in
   `shop-products.js` first; the shop card + detail page follow from it.
4. **Every product is bilingual.** `title/title_es`, `description/description_es`,
   `details/details_es`, `tags/tags_es` are all required.
5. **Product ids are permanent.** Favorites + saved carts persist ids in
   Supabase. Never rename an id; retire by setting `status` instead.
6. **Cache-bust on JS/CSS change.** Bump the shared `?v=` token on the changed
   file across **all** pages that load it (EN + ES). Stale caches are the most
   common "it works for me" bug here.
7. **Shop grid mirrors the catalog.** Same item ids, same order, same count on
   `shop.html` and `es/shop.html` (see `INTEGRITY.md`).
8. **Secrets stay out of the repo.** Only the Supabase public **anon** key ships
   to the browser. `.env`/`.env.local` are gitignored.

## The guardrail

`node tools/check-integrity.mjs` enforces invariants 1–4, 7, and image paths
mechanically. It needs **no npm install** (pure Node built-ins) and exits
non-zero on failure. It is wired as the **Netlify build command**
(`netlify.toml` → `[build] command`), so a malformed listing or broken EN/ES
parity **fails the deploy** instead of shipping. Run it locally too, after any
listing or structural change.

## Known debt / future structure (not yet done)

- **Chrome duplication.** Header/footer/nav are copied into ~37 pages and kept
  in sync by the legacy PowerShell scripts (`_sync-editorial.ps1`,
  `_repair-site.ps1`). The robust long-term fix is a build step (Eleventy/Astro
  + Tailwind CLI) that renders shared partials and the shop grid from
  `shop-products.js`. That requires a Node/npm + git environment (not available
  in the current authoring shell), so it is deferred and documented here rather
  than half-implemented. When that environment exists, the integrity checker
  becomes the test that the generated output is correct.
