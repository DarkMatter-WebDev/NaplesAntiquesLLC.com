# Architecture

> Update whenever significant structural changes occur (new pages, new scripts,
> schema changes, new integrations, hosting/deploy changes).

## System Design

A **static multi-page website** with no server-side rendering and no SPA
framework. Each page is a standalone `.html` file. Shared behavior is layered in
via small vanilla-JS modules and shared CSS. Two external services provide
dynamic capability:

- **Supabase** — customer auth + data (profiles, favorites, carts).
- **Netlify Functions** — live gold spot price (server-side fetch + caching to
  avoid exposing/abusing the upstream API and to add CORS + a fallback).

The product catalog is **static data in JavaScript** (`shop-products.js`), not a
database. Pricing is computed client-side from the live spot price.

```
Browser
  ├── HTML pages (Tailwind CDN + editorial CSS)
  ├── scripts/shared/*  (header, auth, cart, pricing config)
  ├── scripts/shop/*    (catalog, filters, pricing, product page)
  ├── scripts/account/* (account portal, dashboard)
  └── scripts/forms/*   (item submission)
        │
        ├──> Netlify Function /.netlify/functions/metal-prices ──> gold-api.com
        ├──> Supabase (auth, profiles, favorites, customer_carts)
        └──> MailerLite (newsletter embed)
```

## Folder Structure

```
EstateJewelry/
├── *.html                      # all site pages (index, about, shop, etc.)
├── editorial-base.css          # base editorial styles
├── editorial-theme.css         # theme (cache-busted via ?v= query)
├── submit-item-form.css        # LEGACY (custom lead form, superseded by Jotform)
├── submit-item-form.partial.html  # LEGACY custom "Submit Your Item" fragment
├── netlify.toml                # Netlify build/redirects/headers
├── robots.txt, sitemap.xml     # SEO
├── .gitignore                  # ignores .env / .env.local
├── ACCOUNT_SETUP.md            # Supabase setup instructions
├── _sync-editorial.ps1         # re-injects shared header/theme into all pages
├── _repair-site.ps1            # compact variant of the sync script
├── assets/                     # images (branding/, pages/, shop/)
├── listing photos/             # raw/source product photos (not served)
├── listing photos 2/           # raw/source product photos (not served)
├── admin/                      # (currently empty)
├── data/                       # (currently empty)
├── netlify/functions/
│   └── metal-prices.js         # live gold spot price function
├── supabase/
│   ├── schema.sql              # account tables, triggers, RLS policies
│   └── fix-permissions.sql     # idempotent grants/columns fixup
├── scripts/
│   ├── shared/
│   │   ├── site-header.js              # injects account/cart links, mobile menu, active nav
│   │   ├── editorial-tailwind-config.js
│   │   ├── supabase-config.js          # window.NAPLES_SUPABASE (url + anon key)
│   │   ├── supabase-config.example.js  # template for the above
│   │   ├── naples-auth.js              # window.NaplesAuth (auth + profile + favorites + cart API)
│   │   ├── cart.js                     # window.ShopCart (cart state)
│   │   ├── cart-page.js                # cart.html UI
│   │   └── registered-only.js          # gates [data-registered-*] content
│   ├── shop/
│   │   ├── shop-products.js            # window.SHOP_PRODUCTS catalog (static data)
│   │   ├── shop-pricing.js             # window.ShopPricing (spot fetch + price calc)
│   │   ├── shop-filters.js             # shop listing filters
│   │   ├── product-page.js             # product.html rendering
│   │   └── test-shop-pricing.js        # pricing sanity checks
│   ├── account/
│   │   ├── account-portal.js           # account.html sign in / sign up
│   │   └── account-dashboard.js        # account-dashboard.html profile/favorites/cart
│   └── forms/
│       └── submit-item-form.js         # LEGACY custom lead form (superseded by Jotform embed)
├── tools/
│   └── check-integrity.mjs    # dependency-free build-integrity guardrail (node, no install)
└── project-docs/              # THIS memory system (incl. STRUCTURE.md + INTEGRITY.md)
```

## Pages

| Page | Purpose |
|------|---------|
| `index.html` | Home / hero / services / newsletter / appointment CTA |
| `about.html` | Owner (Chris) story and trust building |
| `what-we-buy.html` | Overview of categories bought |
| `estate-jewelry.html` / `gold-services.html` / `silver-services.html` / `bullion.html` | Category landing pages (grouped under "What We Buy") |
| `estate-services.html` | Full-estate / liquidation services |
| `faq.html` | FAQs |
| `contact.html` | Contact + "Submit Your Item" (Jotform embed) |
| `privacy.html` | Privacy policy |
| `shop.html` | Product listing with filters + live pricing |
| `product.html` | Single product detail (`?id=...`) |
| `cart.html` | Cart |
| `account.html` | Sign in / create account |
| `account-dashboard.html` | Profile, favorites, saved cart |
| `member-access.html` | Example registered-only gated page |

## Database Schema (Supabase / Postgres)

Defined in `supabase/schema.sql`. All tables key off `auth.users(id)` and are
protected by Row Level Security (a user can only access their own rows).

- **`profiles`** — `id` (PK → auth.users), `full_name`, `phone`, address fields
  (`address_line1/2`, `city`, `state`, `postal_code`, `country`),
  `marketing_opt_in`, `interests text[]`, `budget_range`, `is_vip`,
  timestamps. Auto-created by trigger `on_auth_user_created`.
- **`customer_carts`** — `user_id` (PK → auth.users), `items jsonb`, `updated_at`.
- **`favorites`** — `id`, `user_id`, `product_id` (matches `SHOP_PRODUCTS` ids),
  unique `(user_id, product_id)`.

Triggers: `handle_new_user()` seeds a profile + empty cart on signup;
`set_updated_at()` maintains `updated_at`. RLS policies + explicit grants to the
`authenticated` role. `fix-permissions.sql` re-applies columns/grants idempotently.

## API Integrations

- **Gold price**: `gold-api.com` (`/price/XAU`) via the Netlify function. 5-min
  server cache + 5-min client (sessionStorage) cache. Fallback spot = 5500/oz.
  Eastern-time market-status logic flags weekend closure.
- **Supabase JS** loaded from CDN (`@supabase/supabase-js@2` UMD).
- **MailerLite** universal script + embedded form on the homepage.
- **Jotform** embedded on `contact.html` (form id `261379265677068`) for the
  "Submit Your Item" lead form, including photo uploads.

## Authentication Flow

1. `supabase-config.js` sets `window.NAPLES_SUPABASE` (url + public anon key).
2. `naples-auth.js` lazily creates the Supabase client and exposes
   `window.NaplesAuth` (init, signUp, signIn, signOut, updateProfile,
   favorites, cart load/save, `isVip`).
3. On signup, Supabase sends a confirmation email (`emailRedirectTo` →
   `/account.html`). After confirming, the session is established and the user is
   routed to the dashboard.
4. A DB trigger creates the `profiles` + `customer_carts` rows; client code also
   upserts them defensively (`ensureProfileRow`).
5. Registered-only content uses `registered-only.js` + `[data-registered-*]`
   attributes. VIP/admin gating uses `profiles.is_vip` (and optional `is_admin`).

## Hosting & Deployment Architecture

- **Netlify** serves the repo root as a static site. `netlify.toml` defines:
  - `publish = "."`, `functions = "netlify/functions"`, esbuild bundler.
  - CORS headers for `/.netlify/functions/*`.
  - 301 redirects from legacy root asset/script URLs to their new
    `assets/images/...` and `scripts/...` locations.
- **Domains**: primary `naplesantiquesllc.com` (+ related domains as `sameAs`).
- **Secrets**: only the Supabase **anon** key ships to the browser (safe by
  design). `.env` / `.env.local` are gitignored. No service-role key in the repo.

## Maintenance Tooling

`_sync-editorial.ps1` and `_repair-site.ps1` are PowerShell scripts that rewrite
every `*.html` page to inject the canonical shared header, editorial asset
includes, theme version, body classes, and hero typography — keeping all pages
visually consistent without a templating engine. Run after structural header/
theme changes. Files starting with `_` are skipped by the sync.

`tools/check-integrity.mjs` is a **dependency-free** Node guardrail (no npm
install; runs with plain `node`). It validates the product catalog schema,
unique ids, on-disk image existence, EN↔ES shop-card + page parity, and
root-absolute Spanish paths, exiting non-zero on failure. Run it after any
listing/structural/script change, or wire it as a Netlify build command. The
rules it enforces are documented in `STRUCTURE.md` + `INTEGRITY.md`.
