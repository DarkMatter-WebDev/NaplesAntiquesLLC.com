# Feature Plan: Spanish Translation (EN/ES)

> **Status:** Planned (not yet implemented). This is the agreed design; implement
> in phases (see Rollout). Decision recorded in `DECISIONS.md` (2026-06-01).

## Goal

Offer a fully Spanish version of the site that:

- is **one click** to switch (EN ⇄ ES toggle in the header),
- is **separately indexable for Spanish SEO** (real Spanish leads in Southwest
  Florida — large Spanish-speaking market in Naples / Fort Myers / Cape Coral),
- reads professionally for a luxury/trust brand (human-reviewed, not machine),
- fits the existing static + Netlify setup with **no build step / framework**.

## Chosen Approach

**Separate Spanish pages in a `/es/` subdirectory**, paired with English pages via
`hreflang`, with a header language toggle.

### Why (vs. alternatives)

- **Rejected — JS text-swap toggle:** Google would index only English → no Spanish
  search traffic; flash of untranslated text; heavy per-node tagging. Defeats the
  lead-gen purpose.
- **Rejected — Google Translate widget / browser auto-translate:** inaccurate,
  unprofessional for a luxury brand, zero SEO value.
- **Chosen — `/es/` pages:** indexable, accurate, no-JS-dependent, fast, fits the
  current architecture. Toggle is still one click (link to the page's twin).

## URL Structure

```
/index.html              ↔  /es/index.html
/about.html              ↔  /es/about.html
/what-we-buy.html        ↔  /es/what-we-buy.html
... (one Spanish twin per English page)
```

- Spanish pages live under `/es/`. Asset/script paths use root-absolute URLs
  (e.g. `/assets/...`, `/scripts/...`) or correct relative paths so they resolve
  from the `/es/` depth.
- `x-default` points to the English (root) version.

## Pages to Translate

**Phase 1 — marketing (highest SEO value):**
`index`, `about`, `what-we-buy`, `estate-jewelry`, `gold-services`,
`silver-services`, `bullion`, `process`, `estate-services`, `faq`, `contact`,
`privacy`.

**Phase 2 — app/commerce pages:**
`shop`, `product`, `cart`, `account`, `account-dashboard`, `member-access`.
(These are more JS-driven; UI strings live in scripts — see Shop + UI Strings.)

## SEO Requirements (every page pair)

- `<html lang="es">` on Spanish pages.
- Reciprocal alternate links in BOTH pages' `<head>`:
  ```html
  <link rel="alternate" hreflang="en" href="https://naplesantiquesllc.com/about.html" />
  <link rel="alternate" hreflang="es" href="https://naplesantiquesllc.com/es/about.html" />
  <link rel="alternate" hreflang="x-default" href="https://naplesantiquesllc.com/about.html" />
  ```
- Translated `<title>`, `meta description`, `og:`/`twitter:` text, and a
  **self-referencing `canonical`** per page (ES canonical → the ES URL).
- JSON-LD: keep structured data; translate human-readable `description` fields on
  ES pages (keep NAP — name/address/phone — identical).
- Add ES URLs to `sitemap.xml` (with `xhtml:link` hreflang annotations, or list
  them as additional entries).
- Keep Spanish keywords meta for ES pages (e.g. "vender oro Naples", "comprador de
  joyas Naples", "tasación de plata Fort Myers").

## Language Toggle

- A small **EN | ES** switch in the site header, visible on every page.
- Implementation: add it to the header template in `_sync-editorial.ps1` (and the
  compact `_repair-site.ps1`) so it propagates to all pages, and/or inject it via
  `scripts/shared/site-header.js`.
- Behavior: clicking ES navigates to the `/es/` twin of the current page (and EN
  navigates back). Compute the twin from the current path.
- Remember preference in `localStorage` (`naplesSiteLang`). Optional, **light**
  auto-suggest based on `navigator.language` on first visit only — must NOT block
  or redirect crawlers (client-side only, no hard server redirect).

## Scope: EVERYTHING is translated (no English left on ES pages)

Per the client: the Spanish version must be **fully** translated — all marketing
copy AND **all shop listings** (titles, descriptions, details, and tags), plus
all UI strings, buttons, form labels, and price-context text. No English should
leak onto `/es/` pages (brand/proper nouns excepted: Rolex, Tiffany, Cartier,
the business name).

## Shop Product Localization (single source of truth)

Do **NOT** duplicate `shop-products.js`. Prices, `id`s, and Supabase `favorites`
must stay single-source.

- Add **required** localized fields to **every** product object:
  `title_es`, `description_es`, `details_es[]`, and `tags_es[]`. Every listing
  must have complete Spanish content (no English fallback shown on ES pages).
- Set a page-level language flag (e.g. `window.SITE_LANG = 'es'` on ES pages).
- Update the display layer (`shop-filters.js`, `product-page.js`,
  `shop-pricing.js` label text) to pick `*_es` fields when `SITE_LANG === 'es'`,
  falling back to English if a field is missing.

## UI Strings in JavaScript

Some user-facing text is in JS (cart labels, pricing context like "Live price",
"Market closed", account portal messages, "Next update: N min"). For Phase 2:

- Extract these into a tiny shared dictionary (e.g.
  `scripts/shared/i18n.js` with `en`/`es` maps) keyed by `window.SITE_LANG`,
  or pass localized strings per page. Keep it minimal — no framework.

## Forms

- **Jotform** ("Submit Your Item", id `261379265677068`): clone to a Spanish
  version in the Jotform dashboard and embed the ES form id on `/es/contact.html`.
- **MailerLite** newsletter (form `I6Xvs6`): create a Spanish form/variant and
  embed it on the ES homepage, or translate the existing form's fields.

## Translation Workflow

- **Source of copy:** AI-drafted Spanish, **reviewed by Chris / a native speaker
  before publishing** (chosen). 
- Maintain a **glossary** (below) so terminology stays consistent (gold purity,
  "estate", "spot price", brand terms left in English where appropriate).
- Keep tone luxury/trust, regionally neutral Latin-American Spanish.

### Starter glossary (to refine)

| English | Spanish |
|---------|---------|
| Estate jewelry | Joyería de patrimonio / joyería heredada |
| What We Buy | Qué compramos |
| Sell to us | Véndanos |
| Gold / Silver / Bullion | Oro / Plata / Lingotes |
| Sterling silver | Plata de ley |
| Spot price | Precio spot |
| Appointment / consultation | Cita / consulta |
| Submit your item | Envíe su artículo |
| Free evaluation | Evaluación gratuita |

(Brand/proper nouns — Rolex, Tiffany, Cartier, Naples Estate Jewelry & Antiques —
stay as-is.)

## Maintenance Strategy

- Marketing copy changes infrequently → start with **manual** dual maintenance.
- Lean on `_sync-editorial.ps1` to keep **structure** (header, theme, asset
  includes, body classes) identical across EN/ES so only prose is hand-edited;
  extend the script to also process `/es/` and inject the toggle.
- Revisit heavier tooling (source + translation JSON → generated pages) only if
  drift becomes a real problem.

## Rollout (phased)

1. **POC — DONE (2026-06-01):** `/es/index.html` translated end-to-end; EN/ES
   header toggle built in `site-header.js` (computes each page's twin, injected
   site-wide); hreflang on the home pair; root-absolute asset paths. Verified in
   browser both directions.
2. **Marketing pages — DONE (2026-06-01):** all remaining marketing pages translated
   into `/es/` (about, what-we-buy, estate-jewelry, gold-services, silver-services,
   bullion, process, estate-services, faq, contact, privacy) with reciprocal
   hreflang on the English originals.
3. **Sitemap — DONE (2026-06-01):** `sitemap.xml` lists all EN + ES URLs with
   `xhtml:link` hreflang alternates.
4. **Shop / app pages + listings — DONE (2026-06-01):** `/es/` twins for shop,
   product, cart, account, account-dashboard, member-access; all 11 products carry
   `title_es`/`description_es`/`details_es`/`tags_es` (single-source IDs/prices);
   product images made root-absolute; shop/account JS branches on `<html lang="es">`
   to render Spanish (cache-bust `?v=es-i18n-20260601`).
5. **QA — DONE (2026-06-01):** in-browser checks of `/es/` shop, product, and cart
   (Spanish strings + working images); grep confirmed no relative paths / untranslated
   nav; English pages confirmed unaffected.
6. **Remaining:** native-speaker review of all ES copy; create a Spanish MailerLite
   newsletter form (homepage embed still English, deferred by client); optionally a
   Spanish Jotform for `/es/contact.html`.

## Risks / Open Items

- **Maintenance drift** between EN/ES (mitigated by sync script + discipline).
- Native-speaker review bandwidth for accuracy.
- `/es/` relative-path correctness for assets/scripts (use root-absolute paths).
- Netlify: confirm no redirect rules conflict with `/es/` paths.
- Decide whether Phase 2 app pages need full ES or can stay EN initially.
