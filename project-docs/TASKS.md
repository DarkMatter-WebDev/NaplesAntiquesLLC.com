# Tasks

> Move tasks between sections as work progresses. Keep it current at the end of
> every session. Newest/most important first within each section.

## Backlog

- **Spanish translation (EN/ES)** — full site is translated (see Completed). Left:
  - **Native-speaker review pass** over all `/es/` copy + product translations
    (AI-drafted; needs human QA before considering it final).
  - Create a **Spanish MailerLite newsletter form** and swap it into `/es/` pages
    (currently the homepage embed is still English — deferred by client).
  - Optionally create a **Spanish Jotform** and point `/es/contact.html` at it
    (currently reuses English form id `261379265677068`).
- Remove now-unused legacy lead-form files (`submit-item-form.js`,
  `submit-item-form.partial.html`, `submit-item-form.css`) superseded by the
  Jotform embed — and drop the legacy `/submit-item-form.js` redirect in
  `netlify.toml` once removed.
- Confirm Jotform email notifications/recipients and test an end-to-end submit
  (with and without photos).
- Verify Supabase **Auth → URL configuration** redirect URLs include the live
  domain (`https://naplesantiquesllc.com/account.html`, optional wildcard,
  localhost for testing).
- Fill in unknowns in `CLIENTS.md` (GitHub repo URL, Netlify site name/ID,
  maintenance plan, billing status, credential locations).
- Expand shop beyond gold (silver / diamonds / antiques categories) when
  inventory is ready.
- Consider real checkout/payments (e.g. Stripe) vs. current contact-to-buy flow.
- Add basic analytics (e.g. Plausible / GA4) if not already present.
- Extend pricing test (`scripts/shop/test-shop-pricing.js`) with explicit
  expected-value assertions per product (catalog-schema + parity checks now live
  in `tools/check-integrity.mjs` — see Completed).
- Confirm whether a self-hosted metal-price API key/rate limit is needed for
  production traffic (currently using public `gold-api.com`).

## In Progress

- (None)

## Completed

- **Build-structure / integrity guardrails** (2026-06-02): added permanent docs
  `STRUCTURE.md`, `INTEGRITY.md`, `features/shop-listings.md`, and a
  dependency-free `tools/check-integrity.mjs` validator (catalog schema, unique
  ids, image existence, EN↔ES shop + page parity, root-absolute Spanish paths).
  Passes against the live repo. Linked from `AGENTS.md` + `README.md`.
- **Full Spanish (EN/ES) site** (2026-06-01): created `/es/` twins for all 18 pages
  (marketing + shop/product/cart/account/dashboard/member-access), added reciprocal
  hreflang across all pages + `sitemap.xml`, and a site-wide EN/ES header toggle.
  Localized `shop-products.js` (`*_es` fields on all 11 products) with single-source
  IDs/prices, made product images root-absolute, and made the shop/account JS
  language-aware (`?v=es-i18n-20260601`). QA'd in-browser; English unaffected.
- "Submit Your Item" lead form already runs on **Jotform** (embedded on
  `contact.html`, form id `261379265677068`) — handles delivery + photo uploads.
  (Pre-existing; confirmed/documented 2026-06-01, not changed.)
- Created the `project-docs/` memory framework: overview, status, architecture,
  decisions, tasks, changelog, features, meetings, and `CLIENTS.md` (2026-06-01).
- Added Dark Matter Web Services footer credit across all pages (2026-06-01).
- Reorganized assets into `assets/images/...` and scripts into
  `scripts/{shared,shop,account,forms}/` with 301 redirects in `netlify.toml`.
- Implemented live gold-spot pricing (Netlify function + client pricing module).
- Implemented Supabase customer accounts (auth, profiles, favorites, saved cart).
- Built the full marketing site + online shop with SEO metadata and JSON-LD.
