# Changelog

> Track meaningful changes. Newest at the top. One dated section per day of work;
> bullet the notable changes. Keep entries short.

## 2026-06-13

- **Updated gallery card cart buttons.**
  Add to Cart now shows a brief local confirmation, then becomes Remove from
  Cart. Clicking Remove from Cart removes the item and restores Add to Cart.
  Verified in-browser and `npm run build` passes.
- **Added admin inventory numbers.**
  The product admin table now shows an "Inv #" column matching the unfiltered
  public shop gallery order. Verified against `/shop` and `npm run build`
  passes.
- **Added sortable admin product columns.**
  Product admin table headers now sort the filtered product list by each data
  column, including numeric current price. Verified in-browser and `npm run
  build` passes.
- **Moved Auctions under the Shop menu.**
  The top-level Shop header item now opens Store (`/shop`) and Auctions
  (`/auctions`) on desktop and mobile, and the standalone top-level Auctions
  button has been removed. Verified in-browser and `npm run build` passes.
- **Split checkout into its own page.**
  The cart drawer now stays cart-only, while `/checkout` owns the customer
  form, order summary, and confirmation flow. The drawer's "Proceed to
  Checkout" action now links to the standalone checkout page. Verified
  in-browser and `npm run build` passes.
- **Added Auctions page and header link.**
  Added a localized `/auctions` route, inserted Auctions between Sell and About
  in the header, and included the route in the sitemap. Verified in-browser and
  `npm run build` passes.
- **Added About dropdown and Other Services page.**
  The header About item now opens About Us and Other Services links. Added a
  new `/services` page with buttons to Free Evaluation and Estate Services, and
  included it in the sitemap. Verified in-browser and `npm run build` passes.
- **Updated Sell submenu labels.**
  Changed the English header dropdown items to "Sell Us Gold," "Sell Us
  Silver," and "Sell Us Bullion." Verified in-browser and `npm run build`
  passes.
- **Shortened the English header Sell label.**
  Changed the main nav label from "Sell To Us" to "Sell." Verified in-browser
  and `npm run build` passes.
- **Bolded gallery card prices.**
  Increased the shop card price amount weight while keeping the "Your price"
  label bold. Verified in-browser and `npm run build` passes.
- **Matched "Your price" to the price amount.**
  Gallery cards now render the "Your price" label at the same font size and
  bold weight as the price. Verified in-browser and `npm run build` passes.
- **Refined shop card spacing and specs.**
  Tightened the gap between gallery card titles and prices, and enlarged the
  purity/grams line for better readability. Verified in-browser and
  `npm run build` passes.
- **Widened the desktop shop gallery.**
  The shop page container now uses more available desktop width, with 4 columns
  at normal desktop, 5 columns at 2xl, and 6 columns on very wide screens.
  Verified at 1440px, 1536px, and 1800px in-browser; `npm run build` passes.
- **Simplified shop card actions.**
  Removed the Inquire button from gallery cards and changed the compact cart
  button label to “Add to Cart.”
- **Tuned shop card typography.**
  Product titles are slightly smaller on gallery cards, while purity and grams
  are larger for easier scanning.
- **Updated shop card price/spec copy.**
  Gallery cards now show “Your price” next to the price, and the former
  live-spot context line now displays item purity and gram weight.
- **Added live gold/silver prices beside shop search.**
  The main shop search row now shows live silver on the left and live gold on
  the right, reusing the same spot data already fetched for shop pricing.
  Verified desktop and mobile layouts in-browser.
- **Added an Item Type shop filter.**
  The hidden filter panel now includes broad product type choices such as
  necklaces, bracelets, earrings, rings, pendants, and watches. Filtering is
  backed by the `itemType` URL parameter and verified in-browser.
- **Collapsed shop filters behind a Filter button.**
  The shop search and result count stay visible, while metal, purity, chain
  type, gender, length, and available-only controls open on demand. The button
  shows an active-filter count. Verified in-browser and `npm run build` passes.
- **Stopped product photo cropping on upload-driven surfaces.**
  Shop cards, product detail galleries, admin thumbnails, cart thumbnails, and
  wishlist thumbnails now fit images inside their frames instead of cropping
  edges. Product zoom math now follows the contained image bounds.
- **Added mobile magnification for product photos.**
  `ProductImageGallery` now handles pointer/touch input so mobile visitors can
  press and drag on a product image to see a floating magnified view, while
  desktop hover zoom remains unchanged. Verified the product page in-browser and
  `npm run build` passes.
- **Fixed English redirect loop in the Next proxy.** `next-app/src/proxy.ts`
  now marks internal unprefixed-English rewrites so the second proxy pass
  renders `/en/...` instead of redirecting back to the canonical unprefixed URL.
  `/` and `/shop` return 200, direct `/en` and `/en/shop` redirect once to `/`
  and `/shop`, `/es` routes still return 200, and `npm run build` passes.
- **Generated legacy removal audit.** Added
  `project-docs/LEGACY_REMOVAL_REPORT.md` separating the current `next-app/`
  runtime from root static-site cleanup candidates. Confirmed root
  `netlify.toml` builds from `next-app`, the Next shop reads Supabase
  `products`, root assets are mirrored into `next-app/public/assets`, and
  `npm run build` passes from `next-app`.
- **Updated memory docs for the Next transition.** Marked the Next app as the
  current deploy target in `CURRENT_STATUS.md`, added cleanup follow-ups to
  `TASKS.md`, and indexed the new report in `README.md`.
- **Removed the legacy static-site files.** Deleted root static HTML pages,
  `/es`, old vanilla scripts, root copied assets, old Netlify Function, static
  maintenance tooling, empty staging folders, the old static admin, and unused
  create-next-app SVG/reference files. Kept `next-app`, `project-docs`,
  `supabase`, root `netlify.toml`, root `.gitignore`, root `AGENTS.md`, and
  setup docs.
- **Rewrote cleanup-sensitive docs.** Updated `AGENTS.md`,
  `ACCOUNT_SETUP.md`, `STRUCTURE.md`, and `INTEGRITY.md` so they point at the
  current Next.js app and `npm run build` instead of deleted static-site
  tooling.

## 2026-06-12

- **Replaced Jotform with Netlify Forms (EN + ES).** Removed the embedded
  Jotform script from `contact.html` and `/es/contact.html`, and added static
  Netlify Forms (`submit-item`, `submit-item-es`) with multipart photo uploads,
  honeypot spam protection, localized fields, and a large square upload target.
  The visible page is now photo-first: after the visitor chooses photos from
  their computer/camera roll, a native modal opens for details and final send.
  Repurposed `scripts/forms/submit-item-form.js` to show selected photo names
  and manage that modal without blocking submission. Removed the unused root
  `submit-item-form.partial.html` and `submit-item-form.css`.
- **Tightened lead-form phone requirement.** The EN/ES modal labels now mark
  phone as required, and the helper script blocks submit, opens the details
  modal, and focuses browser validation on the phone field if it is missing.
- **Aligned upload field with Netlify Forms limits.** Netlify supports one file
  upload per field, so the visible upload control now accepts one required image
  instead of a multi-file selection.

## 2026-06-10

- **Added compact homepage announcement banner (EN + ES).** The banner drops
  down one second after load from behind the fixed header, promotes trusted
  gold/silver/jewelry buying and this month's free mobile evaluations for
  jewelry collections, and includes a close button. Updated the ad copy with a
  reference-style dark/gold strip, clock icon, "Limited-Time: Free Jewelry
  Evaluations," "Now booking in Naples," and "Schedule your appointment today"
  language. Removed "spots are limited" / "secure yours" wording. Desktop height
  verifies at ~84px and mobile at ~86px in the in-app preview. Banner offset now
  uses the measured fixed-header height, eliminating the small top-edge overlap
  under the menu. The banner now opens the same Calendly popup as the Schedule a
  Consultation CTA when clicked, except the X close button only dismisses the
  banner. The homepage content now slides down by the measured banner height
  while the banner is open and returns when dismissed. Reverted the shadow-removal
  experiment and changed the banner background to near-black (`#030303`) so any
  lower-edge overlay reads as part of the same dark strip; integrity check passes.
- **Fixed homepage hero old-image flash (EN + ES).** Removed the old bangles
  image from the hero video `poster`, changed the video to `preload="auto"`,
  lowered the fallback image load priority, and made that still image visible
  only for reduced-motion visitors. Verified no stale poster/high-priority
  fallback references remain; integrity check passes.

## 2026-06-02

- **WebP path updates sitewide.** Page and branding references now point at
  `.webp` assets; shop listings remain `.png`/`.jpg`. Renamed branding files to
  `logo.webp` / `logo2.webp`; legacy Netlify redirects updated. Script:
  `tools/update-webp-paths.mjs`.
- **Image optimization workflow (3 groups).** Added `tools/image-optimization.md`,
  `tools/copy-all-site-images.ps1`, `tools/deploy-optimized-images.ps1`, and
  `tools/list-image-groups.mjs`. Group 3 shop listings: lossless PNG/JPEG only,
  no resize; pages use WebP q90; branding lossless (user-run in XnConvert).
- **Removed Process page (EN + ES).** Deleted `process.html` and `es/process.html`,
  removed Process/Proceso from desktop and mobile header nav on all pages, dropped
  sitemap entries, and added 301 redirects to Free Evaluation. In-page CTAs on
  gold-services and estate-jewelry now point to free evaluation instead.
- **Shop grid title alignment + Monaco listing rename.** Shortened `new-listing-03` to
  **10K Gold Monaco Cuban Link Necklace** (clasp detail stays in description). Shop cards
  now use a fixed **two-line title clamp** and `margin-top: auto` on price so scrap/trade-in
  rows line up; integrity enforces title length (EN ≤ 62, ES ≤ 85) and card `<h3>` ↔
  catalog parity. Docs updated in `shop-listings.md`, `INTEGRITY.md`, `STRUCTURE.md`.
- **Decorative hero + graphics on the Free Evaluation page (EN + ES).** Replaced the plain
  text hero with a dramatic dark image hero (B&W `jeweler.jpg` of a ring being measured,
  slow Ken-Burns pan + gradient overlays), a catchy H1 ("What's It Really Worth? Find Out
  for Free." / "¿Cuánto Vale Realmente? Descúbralo Gratis."), dual gold/outline CTAs + phone,
  and four gold trust chips (no obligation / same-day cash / live pricing / private). Swapped
  the icon "What We Evaluate" grid for a 6-tile **image montage** (gold, ring, watch, silver,
  bullion, antiques — all existing `assets/images/pages/*`) with gradient labels, each linking
  to call. Added a **"Deal directly with Chris"** owner trust band (`chris.png`) before the
  final CTA to humanize and drive contact. All styling is page-local CSS (`.fe-hero*`,
  `.fe-chip`, `.fe-tile`, `.fe-owner-photo`); ES uses root-absolute image paths + translated
  copy. Verified EN + ES in-browser; integrity passes.
- **Trade-in ("special") price box on gallery cards (EN + ES).** Added the same
  store-credit trade-in offer that appears on the product detail page to every gallery
  card, as a compact gold-bordered box labeled **"Trade-in price" / "Precio de
  intercambio"** reading "Get this for $X with store credit" / "Llévatelo por $X con
  crédito de tienda" (X = exact scrap × `TRADE_IN_MULTIPLIER`, currently 1.1x). It's
  injected/updated dynamically in `shop-pricing.js` (`applyCardTradeIn`) so no per-card
  markup was needed, and only shows for gold/spot-priced items. Styling lives in the
  `.shop-trade-in-box` rules added to `shop.html` + `es/shop.html` (mirrors the detail
  page's `border-primary/30 bg-primary/[0.06]` gold box, with a mobile size step-down).
  Bumped the `shop-pricing.js` cache token to `?v=tradein-card-20260602` on all 8 pages.
  Verified all 19 cards EN + ES at desktop and 390px mobile (2-up); integrity passes.
- **New Free Evaluation marketing page + "Services" umbrella nav (EN + ES).** Created
  `free-evaluation.html` and `es/free-evaluation.html` — a dedicated, QR-friendly landing
  page for the free, no-obligation evaluation offer (what we evaluate, how it works,
  trust points, call/text CTAs, `Service` JSON-LD, full hreflang). To keep the header
  compact, the standalone **"Estate Services"** nav link was replaced by a **"Services"**
  dropdown (`nav-buy-group`) containing **Free Evaluation** + **Estate Services**, applied
  to desktop and mobile nav on every full-nav page (EN + ES) via a one-off migration
  script (since deleted). Added a prominent Free Evaluation CTA banner to both homepages
  (above the quick-nav grid), a footer link, and sitemap entries with hreflang. ES uses
  root-absolute paths and translated labels (Servicios / Evaluación Gratuita / Servicios
  de Patrimonio). Verified EN + ES nav (desktop dropdown + mobile group), both new pages,
  and homepage banners in-browser; integrity check passes.
- **Gallery card text shrink + "Your price" label + "Exact gold scrap value" (EN + ES).**
  Three things: (1) Added a small **"Your price" / "Tu precio"** eyebrow above the
  sale price on every gallery card (CSS `::before` on `[data-shop-price]`, localized
  per file). (2) Renamed the gallery scrap line from "Gold scrap value" →
  **"Exact gold scrap value"** ("Valor exacto de fundición del oro") to match the
  product page — changed in `shop-pricing.js` (`buildScrapContext`) and the static
  pre-JS fallback text on all 19 cards in `shop.html` + `es/shop.html`. (3) Fixed the
  oversized/"cartoony" mobile card text: an editorial hero rule
  (`main > section:first-of-type p { font-size: clamp(1rem,…) !important }`) was
  bleeding into the shop grid and forcing the price/scrap `<p>` up to ~16px on small
  screens. Added scoped `!important` font sizes for `[data-shop-price]` (0.85rem) and
  `[data-shop-price-context]` (0.62rem) on the cards to win, plus smaller mobile
  title/category. Bumped `shop-pricing.js` cache token to `?v=scrap-yourprice-20260602`
  on all 8 pages. Verified EN + ES at 390px; integrity check passes.
- **Removed the gallery card description entirely (EN + ES).** Per request, the
  per-item description paragraph is now hidden on the shop gallery cards at **all
  breakpoints** (`.shop-product-card .shop-product-body p.flex-1 { display: none; }`),
  so cards are much shorter — they now show image, category, title, price, gold
  scrap value, and the Inquire/Call actions only. The full description still renders
  on the product detail page. Removed the now-unnecessary mobile 3-line clamp rule.
  CSS-only in `shop.html` and `es/shop.html`; verified in-browser (mobile 2-up).
- **Denser, smaller shop gallery cards (EN + ES).** Reworked the `.shop-product-grid`
  responsive columns so the gallery shows **2 cards per row on mobile** (was 1),
  **3 on tablet (≥768px)**, and **4 on wide desktop (≥1280px)** (was 3) — overall
  smaller cards. Added a `max-width:767px` block that tightens card internals on
  mobile (smaller body padding, title/category type, cart button, and status badge).
  CSS-only, applied identically to the `<style>` blocks in `shop.html` and
  `es/shop.html`. Verified in-browser at 390px (2-up) and 1440px (4-up); integrity
  check passes.
- **New "invest in gold" shop tagline + homepage echo (EN + ES).** Changed the
  shop's main tagline from "Transparent pricing, live while you browse." to
  **"Don't just buy gold. Invest in it."** (eyebrow "A smarter way to own gold")
  with investment-framed copy emphasizing buying real, verifiable gold value.
  Mirrored the same headline/copy on the homepage "transparent buying" card and
  changed its CTA from "Shop Now" → **"Invest in Gold"** ("Invertir en Oro") to
  drive shop traffic. Applied to `shop.html`, `es/shop.html`, `index.html`,
  `es/index.html`. Copy-only; integrity check passes.
- **Reworded the product-page trade-in offer (EN + ES).** Reframed from a
  buy-your-gold message to a store-credit price on the item: "Have gold to sell?
  Trade-in special: get this for $X with store credit." / "¿Tienes oro para
  vender? Oferta de intercambio: llévatelo por $X con crédito de tienda." Same
  value (`scrapValue × 1.1`); copy-only change in `shop-pricing.js`. Bumped
  cache token to `?v=tradein-copy-20260602` on all 8 pages. Verified EN + ES.
- **Fixed mobile menu submenu placement (EN + ES).** In the flattened mobile
  nav the four "Sell To Us" subcategories (Estate Jewelry, Gold Services, Silver
  Services, Bullion) were rendered after the **About Us** link, so they appeared
  to belong under About Us. Moved the About Us link to *after* the four
  `mobile-subitem` links so they sit directly under **Sell To Us** (matching the
  desktop dropdown). Applied via a scoped regex across all 28 affected pages
  (14 EN + 14 ES); `contact.html`/`es/contact.html` already had the correct order
  and were left untouched. Verified in-browser at mobile width. (The desktop nav
  was already correct.)
- **Reworked shop pricing display into three tiers (EN + ES).** Gallery listing
  cards now drop the spot-multiplier text and instead show the **exact gold scrap
  value** beneath the sale price ("Gold scrap value: $X" / "Valor de fundición
  del oro: $X") so shoppers see scrap vs. your price at a glance. Product detail
  pages keep the spot-multiplier context **and** gain a third price: a **special
  trade-in offer** for a customer's own gold = `scrapValue × 1.1`, rendered in a
  gold-tinted callout ("Have gold to sell? Special trade-in offer: we pay you $Z
  for gold like this." / Spanish equivalent). Implemented centrally in
  `shop-pricing.js` (new `TRADE_IN_MULTIPLIER` constant, `tradeInValue`/Label on
  each product, `buildScrapContext` for cards, `#product-trade-in-offer` render);
  added the callout element to `product.html` + `es/product.html`; replaced the
  static multiplier placeholder text on all 19 gallery cards (EN + ES) with a
  neutral scrap fallback; and updated the shop "transparency" intro copy to point
  the multiplier/trade-in mentions at the product pages. Bumped `shop-pricing.js`
  cache token to `?v=scrap-tradein-20260602` across all 8 pages that load it.
  Verified in-browser: gallery (no multiplier, scrap shown) and detail page
  (scrap + your price + multiplier + trade-in, math 1.1×$1,684.30 = $1,852.73),
  EN and ES. Display contract documented in `features/online-shop.md`.
- **Added permanent build-structure / integrity guardrails.** New persistent
  Markdown detail files: `project-docs/STRUCTURE.md` (canonical repo map +
  single-sources-of-truth + structural invariants), `project-docs/INTEGRITY.md`
  (integrity rules + pre-publish checklist), and
  `project-docs/features/shop-listings.md` (product schema + add-a-listing
  runbook). Added a **dependency-free** guardrail script `tools/check-integrity.mjs`
  (plain Node, no npm install) that validates the product catalog schema, unique
  ids, on-disk image existence, EN↔ES shop-card parity, EN↔ES page parity, and
  root-absolute Spanish paths — exits non-zero on failure so it can gate
  publishes. Verified: passes against the live repo (19 products, 0 errors).
  Cross-linked from `AGENTS.md` and `project-docs/README.md`.
- **Wired the integrity guardrail into the Netlify deploy.** Set
  `netlify.toml` `[build] command = "node tools/check-integrity.mjs"` so a
  malformed listing or broken EN↔ES parity **fails the build instead of
  shipping**. `publish = "."` unchanged (no output transform; the command only
  gates the deploy).
- **Shop listing cards now show cart membership** (EN + ES). The image "Add to Cart"
  button reflects whether each piece is already in the cart: items in the cart render
  a dark gold-outlined **"✓ In Cart" / "✓ En el Carrito"** pill (with `aria-pressed`
  and a "Remove item from cart" label), and clicking toggles add/remove instead of the
  old flash-and-revert. State is computed on load from the saved cart and stays in sync
  via the `shopcart:updated` event (so changes from the product page, cart page, or
  account sync are reflected). Added a `has(id)` helper to `ShopCart` (`cart.js`),
  reworked the button render/toggle in `shop-filters.js`, and added `.is-in-cart`
  styling to both `shop.html` + `es/shop.html`. Bumped `cart.js` + `shop-filters.js`
  cache tokens to `?v=incart-state-20260602`. Verified in-browser: load-time state,
  add→persist, and remove round-trip (cart count tracked correctly).
- **Added 2 more photos to the 14K semi-solid Cuban link necklace** (`new-listing-06`):
  copied `IMG_4939`/`IMG_4946` → `shop-new-listing-06-04.jpg`/`-05.jpg` and appended
  them to the product's `images` array (gallery now 5 photos, both languages). Bumped
  `shop-products.js` token to `?v=listing06-photos-20260602`. Emptied the re-added
  `pictures/` folder afterward (kept the folder).
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
