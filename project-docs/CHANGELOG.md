# Changelog

> Track meaningful changes. Newest at the top. One dated section per day of work;
> bullet the notable changes. Keep entries short.

## 2026-06-02

- **Filled in real details for the 6 placeholder listings** (EN + ES). Converted
  "New Listing 1–6" from manual placeholders into real spot-priced gold products in
  `shop-products.js` (`priceMode: "spot-multiplier"`, `category: "Gold"`, full
  `*_es` copy/specs/tags) and rebuilt the cards in `shop.html` + `es/shop.html` with
  live `data-shop-price` hooks, filter attributes, and Shopify embed divs:
  1) Italian 14K two-tone Cuban link & ring-station necklace — 44.72g, 30", 5.5/13mm,
     14K Italy — 1.25x → $5,766.10; 2) 14K round box/rolo link chain — 14.34g, 24",
     3mm, LXG 14K — 1.5x → $2,218.76; 3) 10K Monaco Cuban link w/ pavé diamond box
     clasp — 12.45g, 20.5", 5mm — 1.25x → $1,146.63; 4) 14K rope chain — 12.48g, 25",
     2.5mm, 14K — 1.25x → $1,609.14; 5) 10K rope chain — 15.19g, 25", 2.6mm, ALI 417 —
     1.25x → $1,398.98; 6) 14K semi-solid Cuban link chain — 9g, 24", 3.7mm, 14K —
     1.4x → $1,299.69. Added a **"Box link" / "Eslabón box"** chain-type filter option
     for #2. Prices verified against the live calculator at the $5,500 fallback spot.
- **Reordered the shop grid** so the non-necklace pieces sit last: moved the
  **18K heraldic cross ring** and **14K men's Cuban/curb link bracelet** below all
  necklaces in `shop.html`, `es/shop.html`, and the `shop-products.js` array (now ends
  necklaces → ring → bracelet). Shop still lists 19 pieces.
- Bumped `shop-products.js` cache token to `?v=listings-detail-20260602` across all 10
  pages that load it. Verified the full EN + ES grids in-browser (order, titles,
  descriptions, live prices) and deleted the now-empty `pictures/` source folder (29 files).

## 2026-06-01

- **Added 6 placeholder shop listings** ("New Listing 1–6" / "Artículo Nuevo 1–6")
  as photo-first place markers while details are gathered. Copied/renamed 29 photos
  from the `pictures/` folder into `assets/images/shop/`
  (`shop-new-listing-01..06-NN.png`; counts 5/5/7/4/5/3), appended 6 products to
  `shop-products.js` (`priceMode: "manual"`, "Price on request"/"Precio a consultar",
  generic `Jewelry` category, EN+ES placeholder copy), and added cards to `shop.html`
  + `es/shop.html`. Shop now lists 19 pieces. Cards use static localized price text
  (no `data-shop-price` hook). Bumped `shop-products.js` cache token to
  `?v=placeholders-20260601`. Verified grid + a placeholder detail page (full gallery)
  in both languages. NOTE: detail pages still show the shared gold-spot meta line
  ("Manual price" + spot) on these manual-priced placeholders — harmless, will resolve
  once real specs/pricing are added.
- **Added two new shop listings** (EN + ES): a **10K semi-solid Cuban link chain**
  (26g, 24.5", 6.3mm, box clasp w/ double safety, marked 10K — $2,394.56 @ 1.25x) and
  a **14K Byzantine (fancy) link chain** (31.28g, 21.5", 4.3mm, barrel clasp marked
  14K — $4,033.18 @ 1.25x). Copied/renamed their photos (7 + 6) into
  `assets/images/shop/`, appended both products (with `*_es` fields) to
  `shop-products.js`, and added the static cards to `shop.html` + `es/shop.html`.
  Added a new **"Byzantine link" / "Eslabón bizantino"** chain-type filter option in
  both languages. Shop now lists 13 pieces. Bumped `shop-products.js` cache token to
  `?v=add-listings-20260601`. Verified both detail pages (EN + ES) in-browser.
- **Streamlined the shop search bar + filter selects** (EN + ES `shop.html`): reduced
  the search input height/font and narrowed it (max-width 28rem→24rem), tightened the
  4-up filter grid (gap, max-width 56rem→48rem, smaller labels + select padding) so
  the controls are shorter and less blocky. Kept the centered 4-column lineup and
  label alignment; verified both languages in-browser.

- Recorded the GitHub repo (`DarkMatter-WebDev/NaplesAntiquesLLC.com`) in
  `CLIENTS.md` / `PROJECT_OVERVIEW.md`; made `CLIENTS.md` a reusable client roster
  with a copy-paste template.
- Approved and documented the **Spanish translation plan** (separate `/es/` pages
  + hreflang + header toggle) in `features/spanish-translation.md` + `DECISIONS.md`.
- Built the **Spanish home-page POC**: added `/es/index.html` (full Spanish copy,
  `lang="es"`, translated title/meta/OG/JSON-LD, root-absolute asset paths),
  hreflang alternates on `/` and `/es/`, and an EN/ES language toggle in
  `scripts/shared/site-header.js`. Tested in-browser both directions.
- **Completed the full Spanish rollout** (after POC): created `/es/` twins for all
  remaining pages — `about`, `what-we-buy`, `estate-jewelry`, `gold-services`,
  `silver-services`, `bullion`, `process`, `estate-services`, `faq`, `contact`,
  `privacy`, `shop`, `product`, `cart`, `account`, `account-dashboard`,
  `member-access` (18 total). Added reciprocal hreflang to every English page and
  to `sitemap.xml`.
- **Localized the shop single-source**: added `title_es`/`description_es`/
  `details_es`/`tags_es` to all 11 products in `shop-products.js`, and made product
  image paths root-absolute (`/assets/...`) so they load on `/es/` pages.
- **Made shared JS language-aware** (branches on `<html lang="es">`):
  `shop-pricing.js`, `product-page.js`, `shop-filters.js`, `cart-page.js`,
  `account-portal.js`, `account-dashboard.js`, `registered-only.js`. Bumped all
  changed scripts to cache-bust `?v=es-i18n-20260601`.
- QA'd `/es/` shop, product, and cart in-browser (Spanish strings + working images);
  confirmed English pages unaffected.
- **Fixed two Spanish-header bugs** (in `editorial-theme.css`): (1) the "Tienda" /
  "Véndanos" nav underline was hardcoded to the English hrefs
  (`a[href="shop.html"]` / `a[href="what-we-buy.html"]`), so `/es/` links never
  matched — switched to suffix selectors (`a[href$="shop.html"]`,
  `a[href$="what-we-buy.html"]`) so both EN and ES underline. (2) On wide screens
  (≥1536px) the longer Spanish nav labels widened the desktop nav and crushed the
  brand name into ~6 stacked lines (header ballooned to ~200px); added a
  `@media (min-width:1536px) html[lang="es"]` block that tightens the nav
  (gap/font/padding) and keeps `.site-brand-text` on one line (header back to
  ~81px). Verified at 1536/1680px; English header unchanged (94px). Bumped the
  `editorial-theme.css` cache token to `?v=es-nav-fix-20260601` across all pages.
- **Header polish (EN + ES):** (1) localized the JS-injected nav links — "My
  Account"/"Cart" now render "Mi Cuenta"/"Carrito" on `/es/` pages
  (`site-header.js` reads `<html lang>`); (2) rebuilt the language toggle as a
  visible **EN / ES** switcher (both shown, current one highlighted gold +
  bold, other muted) instead of a single target code; (3) aligned the
  "Véndanos"/"Sell To Us" dropdown trigger with its sibling nav links via
  `.nav-buy-group { display:flex; align-items:center }` (was sitting a couple px
  high). Bumped cache tokens to `?v=lang-switcher-20260601`
  (`site-header.js` + `editorial-theme.css`). Verified both languages in-browser.
- **Main-menu cleanup (EN + ES):** renamed the header "Contact Us" → "Contact"
  ("Contáctenos" → "Contacto" on `/es/`) in both the desktop nav and mobile menu,
  and removed "FAQ"/"Preguntas Frecuentes" from the header entirely. Added a
  "Have Questions About the Process?" / "¿Preguntas Sobre el Proceso?" section
  with a Read the FAQ / Ver Preguntas Frecuentes link near the bottom of
  `process.html` + `es/process.html`. The **footer FAQ link is kept** on every
  page (footer uses a different class, so it was untouched). Applied across all
  32 affected pages via a UTF-8-safe, class-scoped script; verified in-browser.
- **Fixed the language switcher showing the word "LANGUAGE"** on the account
  area: the 6 app pages (`account`, `account-dashboard`, `member-access` × EN/ES)
  never loaded the Material Symbols **webfont** (only the inline
  `font-variation-settings`), so the injected switcher's globe ligature fell back
  to its literal text ("language" → uppercased "LANGUAGE"). Added the standard
  `fonts.googleapis.com/...Material+Symbols+Outlined` `<link>` (same as the other
  30 pages) to all 6. Verified the globe renders as a glyph and the font loads.
- **Shortened the brand name to "Naples Estate Jewelry" everywhere it appears as the
  official name** (removed "& Antiques"), across all 36 EN + ES pages: header
  spans, footer headings/copyright, page `<title>`s, meta `author`/`description`,
  OG/Twitter tags, JSON-LD `name`/`founder`, logo `alt` text, and the privacy-policy
  legal references. Also updated the JS-built product-page `<title>`
  (`product-page.js`, cache-bumped to `?v=brand-short-20260601` on both
  `product.html`s). Descriptive phrases (e.g. "Watches & Antiques",
  "Oro y Antigüedades") were intentionally left unchanged. Legacy
  `submit-item-form.partial.html` (unused, slated for removal) left as-is.
- Confirmed the "Submit Your Item" lead form is handled by an embedded **Jotform**
  (id `261379265677068`) on `contact.html`; marked the old custom form files as
  legacy.
- Added `project-docs/` persistent memory system (overview, current status,
  architecture, decisions, tasks, changelog, features, meeting notes).
- Added `CLIENTS.md` for Dark Matter Web Services client/maintenance tracking.
- Added Dark Matter Web Services footer credit badge to all pages; bumped theme
  cache version to `darkmatter-credit-20260601`.

## Earlier (pre-memory-system, approximate)

- Reorganized images under `assets/images/{branding,pages,shop}/` and grouped
  scripts under `scripts/{shared,shop,account,forms}/`; added 301 redirects for
  all legacy root URLs in `netlify.toml`.
- Implemented live gold-spot pricing: `netlify/functions/metal-prices.js` +
  `scripts/shop/shop-pricing.js` (spot-multiplier price model, caching, fallback,
  market-closed handling).
- Implemented Supabase customer accounts: `supabase/schema.sql` (profiles,
  customer_carts, favorites, triggers, RLS), `naples-auth.js`, account pages, and
  saved-cart merge on sign-in.
- Built the marketing site (home, about, what-we-buy + category pages, process,
  estate-services, faq, contact, privacy) with SEO meta, canonical tags, JSON-LD
  `JewelryStore` schema, `sitemap.xml`, and `robots.txt`.
- Added the online shop (`shop.html` / `product.html`) with filters and a static
  `SHOP_PRODUCTS` catalog.
- Added the reusable "Submit Your Item" lead-form fragment (backend endpoint not
  yet configured).
