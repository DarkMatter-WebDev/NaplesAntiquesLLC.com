# Current Status

> Concise present-state snapshot for session startup. Historical implementation
> detail belongs in `CHANGELOG.md`; durable rationale belongs in `DECISIONS.md`.
> Last reconciled: **2026-08-01**.

## ✅ Shipped 2026-08-01 (deployed and production-verified)

The entire batch below — the 2026-07-30/31 work, the 2026-08-01 social batch
(items 11-14), the domain switch (item 15), and the page retirements
(item 16) — is **live**. Verified against production after deploy: the
Facebook post's `Shop: …/p/21` short link 302s to the product page (the
long-standing deploy-urgency item), `.co` and naplesantiquesllc.com 301
path-preservingly to `.com`, the `.co/api/*` carve-out serves 200,
the sitemap is all-`.com`, and core routes return 200. The domain migration
is complete end to end including PayPal/eBay/Etsy re-registration and a
confirmed Google Change of Address — see `TASKS.md` and `CHANGELOG.md`.

> ✅ **Marketplace shipping tiers are fully provisioned on BOTH marketplaces**
> (eBay 2026-08-01, Etsy 2026-08-02 after its delivery-days fix deployed) —
> seven objects each, ids in `TASKS.md`.
>
> ✅ **Retired-page redirects are live** (production-verified 2026-08-02):
> `/auctions` → `/shop`, `/auction-terms` + `/vendor-terms` → `/terms`, 308,
> both locales.
>
> ⚠️ **One fix awaits the next deploy: the other 22 legacy redirects.**
> Verifying the above exposed that **every English-side redirect was dead in
> production** (404) while its `/es/*` twin worked — the 12 legacy `.html`
> URLs, `/cart`, `/wishlist`, `/saved`, `/account/saved`, and the 6
> re-slugged product URLs. Long-standing, not caused by recent work: on
> Netlify the next-intl proxy is an edge function that rewrites locale-less
> paths to `/en/...` before any redirect layer runs. All of them now live in
> `src/lib/legacy-redirects.ts`, served by `src/proxy.ts` ahead of the locale
> rewrite (308 for equity-carrying URLs, 307 for drawer URLs);
> `next.config.ts` `redirects()` removed. 596/596 tests (8 new), tsc, lint,
> 438-page build green. **Re-verify against production after deploy** — local
> dev cannot reproduce the ordering that caused this.

1. Value-based shipping tiers (checkout + server) with coded checkout errors.
2. Four-step checkout wizard (Summary → Delivery → Contact → Review & Pay)
   with the sign-in/guest entry dialog.
3. Marketplace shipping-tier extension (Etsy/eBay; SQL migration applied
   2026-07-30). **Both provisioned** — 7 eBay fulfillment policies
   (2026-08-01) and 7 Etsy shipping profiles (2026-08-02), one per distinct
   fee. Listing-level verification is still open.
4. eBay account-change listing-state reset admin action.
5. naplesantiquesllc.com SEO recovery 301 redirects (DNS/alias/cert already
   live; redirects activate on deploy).
6. Tap-to-refresh spot pills, "last updated" price ticker, iPad hydration
   fix (format-detection off site-wide), total-grams-only weight spec,
   `/payment` placeholder removal, cart-icon/popup polish, thin-mobile header
   fit, circular product-detail thumbnail rail, and grouped thin-layout product
   specifications. Thumbnail rails show whole cards only, and the header action
   controls receive an additional proportional scale below 350px. The complete
   product price-update ticker also stays on one fluidly scaled line from 320px
   upward, including the longer Spanish copy in the tablet half-column. Admin
   Products now has a mobile-only full-screen table mode for practical two-axis
   inventory browsing without shrinking the ordinary dashboard table. Admin
   account dashboards also place their Admin Panel access card above Account
   Overview on mobile while retaining the desktop side rail.

7. Customer-reveal hardening: the pending→visible flip now commits
   immediately in hidden documents and keeps a bounded backstop while
   visible, so a suspended `requestAnimationFrame` (background tabs,
   prerendering, non-compositing webviews) can no longer leave customer
   content at opacity 0 with pointer events blocked.
8. Site-credit footer banner ("Website built by SuretteSystems.com",
   localized, linking to `https://surettesystems.com`) on every page, and
   `Page Not Found` metadata + noindex on the root 404 shell instead of the
   inherited home title.
9. Clickable desktop Admin Orders rows (row click opens the order detail
   like View; trash rows and in-row controls unaffected), and the customer
   account order query no longer selects admin-only `internal_notes`, which
   was previously serialized unrendered into the customer's page payload.
10. Restructured admin order-detail Items table: Inventory, row-height
    Photo thumbnail, linked Item title (replaces the Open column), live
    Melt estimate from linked products + spot, Unit Price, Qty, and a
    compact 80px Discount input; Date/Metal/Purity/Weight columns removed
    and horizontal padding tightened. Its summary strip is now a `tfoot`
    row: Save Line Discounts left, Line discounts right of it, and New
    total column-aligned under Unit Price.
11. Instagram backdrop matching. Square renditions now pad in the photo's own
    backdrop colour instead of hard-coded white, which removes the white bars
    that framed all 19 black-backdrop products. Every carousel now leads with a
    generated ad card (part of the pipeline, not a setting), and images support
    per-image crops with an auto-proposal and a drag editor. **Requires
    `supabase/instagram-image-crops-2026-08.sql`** — see the ⚠️ note below.

12. Facebook Page auto-posting, a full mirror of the Instagram channel: schema,
    lib modules, ten admin routes, settings + per-product panels, AdminShell
    chips/cards/drawer section, and a scheduled drip (14:40/22:40 UTC).
    Differences leaned into: non-expiring Page token (no refresh cron), real
    API deletion, synchronous publish, and a clickable `Shop:` product link in
    every post. **Requires `supabase/facebook-sync.sql` + two Netlify env vars
    + a pasted Page token** — see the ⚠️ note below and `TASKS.md`.

13. **Instagram caption ported to the final Facebook structure (2026-08-01):**
    "Available now!" hook → title → spec line → "≈ $X at time of posting
    (based on $Y/oz gold spot)." with uniform one-blank-line rhythm, no
    description body, no inventory number in public copy on either channel
    (shared `buildPublicSpecLine`), and a *typeable* short link
    `Shop: NaplesEstateJewelry.com/p/{inv#}` (Instagram never linkifies).
    Applies to future posts only — captions are immutable and no Instagram
    post is currently live. Verified: 592 tests, tsc, lint, build, live
    admin preview for product 21. Same evening: default CTA shortened ("DM us
    or visit the site…" — no repeated domain), the generated card now
    **replaces its source photo** in the slides (both channels, shared
    `buildRenditions`), and prepared-slide thumbnails click open to a
    full-size AdminModal view. Drafts re-prepared: product 21 (8 slides),
    product 28 (7 slides).

14. **Cross-channel operator tools (2026-08-01 late):** "Publish to both…" on
    each social panel opens a shared side-by-side review modal (both captions
    + prepared slides, per-channel Prepare buttons) that publishes Instagram
    first, then Facebook, with per-channel results — and "Copy setup to
    Facebook/Instagram" copies the saved lineup/crops/card choices across
    channels (`/api/admin/social/copy-curation`; refused when the target post
    is live). Confirmed: linked-account auto-crossposting does NOT apply to
    API-published posts, so this cannot double-post. UI-verified end to end on
    products 21/28; the actual both-channel publish awaits the owner. Also
    added "Discard prepared upload" to both panels — deletes the prepared
    slides/caption and un-queues while keeping lineup/crops/card choices;
    refused for live posts; row chip shows "Not posted" after.

15. **Domain switch `.co` → `.com` (2026-08-01, code-complete, GATED — see
    the warning above):** all canonical URLs, sitemap/robots, JSON-LD
    (`@id`/url/image/logo, `sameAs` cleanup), Terms copy (EN/ES), header brand
    (later the same day the suffix was dropped entirely — the header and 404
    wordmark now read just "Naples Estate Jewelry", and the loading/boot
    splash wordmarks read `NaplesEstateJewelry.com`), footer/checkout-receipt
    domain text, order
    + marketing email branding (`SITE_DOMAIN_LABEL`, closings, headers) and
    URL fallbacks, admin marketing panels, and test fixtures now emit
    `https://naplesestatejewelry.com`. Root `netlify.toml`: naplesantiquesllc
    301s retargeted to `.com`; new `.co`→`.com` path-preserving 301s (apex +
    www, both schemes) with a `.co/api/*` carve-out serving APIs directly
    until PayPal/eBay/Etsy re-register on `.com`. **All
    `@naplesestatejewelry.co` email addresses are intentionally unchanged**
    (owner keeps the business email on `.co`).

16. **Auctions page retired + direct Shop nav (2026-08-01 late):** the
    `/auctions` route is deleted (EN + ES; 301s to `/shop` in
    `netlify.toml`; removed from the sitemap; unused `nav.store`/
    `nav.auctions` message keys dropped), and the header's Shop control is a
    plain direct link to `/shop` at every viewport — no `SHOP_ITEMS`, no
    desktop dropdown, no mobile accordion. Sell and About keep their
    dropdowns/accordions. In follow-ups the same evening, BOTH aspirational
    legal pages were retired: `/auction-terms` (footer legal link, metadata
    union/entry, Spanish copy block, sitemap entry, and test-list key all
    removed) and `/vendor-terms` (same set; it was never footer-linked).
    Both URLs 301 to the matching `/terms` page. The remaining legal set is
    the six real policies (privacy, terms, returns-refunds, shipping,
    accessibility, cookie-preferences). The remaining legal copy was then
    scrubbed of auction/vendor and stale "if enabled" language in six
    owner-approved edits (both locales): the Terms auctions/vendors section
    and trailing services sentence removed, two Privacy bullets removed,
    "auctions" dropped from the Terms meta description, and the payments
    clause made present-tense (PayPal is live). Verified in-browser at
    desktop and 375px in both locales; 588 tests, lint, tsc, and the
    438-page build passed after stale-`.next` types rebuilds.

> ✅ **Facebook is LIVE-VERIFIED (2026-08-01).** SQL applied, env vars in
> Netlify, and the **Naples Estate Jewelry Co.** Page connected with a
> never-expiring Page token. Full operator-UI walkthrough proven against the
> live Graph API: prepare (card + 9 photos) → publish (permalink + clickable
> Shop link confirmed) → **Remove post deleted it through the API** with
> renditions and local state cleaned. Sold-comment remains the one unexercised
> call (wiring to the sold transition is still open anyway).

> ✅ **All four social SQL migrations are applied** (owner-run 2026-08-01):
> `facebook-sync.sql`, `instagram-image-crops-2026-08.sql`,
> `social-card-source-2026-08.sql`, `social-card-background-2026-08.sql`.
> Card-source/background saves and crop saves work; end-to-end card rendering
> is live-verified (generated cards led the live Facebook post, background
> auto-detection pixel-verified).

Owner runbook after deploy is in `TASKS.md` ("Owner: test and deploy…").

## At A Glance

- The active application is the Next.js App Router project in `next-app/`.
- Netlify builds from `next-app/` through the root `netlify.toml`.
- Supabase is the system of record for products, accounts, orders, inquiries,
  marketing data, marketplace state, and app metadata.
- The public site supports English and Spanish, a database-backed shop,
  customer accounts, PayPal checkout, admin inventory/order tools, Etsy sync,
  eBay sync, and AI-assisted product entry.
- For authenticated administrators, the account dashboard shows one Admin Panel
  access card. At 700px and below it appears immediately after the account tabs,
  before Account Overview; above 700px it remains in the right side rail.
- Local development serves `http://localhost:3002`, also reachable on the LAN
  at `http://10.0.0.208:3002`. `allowedDevOrigins` in `next.config.ts` covers
  the `10.0.0.*` network (dev-only key). The earlier detached OS-owned server
  was found already stopped at the start of the later 2026-07-31 session; a
  session-managed dev server now serves port 3002 while work is active. If the
  owner needs the always-on LAN server for tablet testing again, relaunch it
  detached and stop it afterward by killing the PID listening on port 3002.
- The 2026-07-28 Netlify deployment is live and received a read-only production
  smoke test covering the main English/Spanish storefront, affected mobile
  product detail, checkout, forms, integrations, admin shell, headers, caching,
  redirects, robots, and sitemap.
- The product-clock and blocked-probe follow-up is now deployed and
  production-verified. Local source and the tested live behavior are aligned.

## Storefront

- `/shop` supports gallery/list views, database-side pagination, URL-backed
  search/filter/sort state, responsive filters, Saved Items, and cart flows.
- Shop cards mount only the cover image initially. Carousel neighbors mount on
  interaction, offscreen cards use containment, and multi-image gallery cards
  show a bottom-edge progress fill during hover progression.
- Product-detail and lightbox thumbnail rails keep the active image and its
  next image visible across 320px mobile through wide desktop. Both directions
  wrap smoothly across the ends using accessibility-hidden edge clones, with
  reduced-motion, keyboard, touch-scroll, resize, and localized-label support.
  Rail widths snap to exact card-and-gap increments so only complete thumbnail
  cards are visible at rest. Arrow/thumbnail navigation uses a deterministic
  eased animation (about 300 ms for one card), so cards visibly flow sideways;
  rapid input continues from the current offset and circular resets occur only
  after the edge-clone motion finishes.
- Product-detail summary metadata treats metal/purity and length as one
  no-wrap specification group. On narrow containers the complete group moves
  beneath the availability badge instead of orphaning only the length.
- The product price-update ticker never wraps its timestamp/countdown sequence.
  Its label typography scales from 8px on thin phones to the existing 9.92px
  cap, with slightly tighter tracking so English and Spanish both fit at 320px
  and in the narrow 768px product column without clipping or truncation.
- Pagination uses explicit ellipses for omitted ranges and localized
  `Page X of Y` status at 440px and below.
- Public browse includes available items and, when enabled in Admin Settings,
  sold items. A second setting can replace sold prices with `Sold` without
  changing stored product prices.
- The public status filter is a required Available/Sold radio choice. Available
  is selected by default; Sold inventory appears only after selecting Sold.
- The shop count uses the fully filtered result count as its numerator and the
  whole visible public inventory as its denominator. A live 2026-07-28 audit of
  Silver + Everything Else confirmed the current data genuinely has 29
  Available and 29 Sold matches out of 127 public pieces; the equal numerators
  are coincidental, while the constant denominator is intentional.
- Product attributes are consistent across gallery and list views. Necklace and
  bracelet width is stored as `width_mm`, displayed in millimeters, and
  filterable through five multi-select ranges.
- Necklace/bracelet length accepts legacy and current inch formats for reads,
  while new Admin/AI writes normalize to a bare numeric value.
- The desktop filter sidebar has a viewport-relative height and internal scroll,
  so all controls remain reachable on short tablet-landscape and small-desktop
  viewports.
- The desktop header uses the optimized 160x160
  `public/assets/images/branding/nav-logo.webp` asset.
- At browser widths below 400px, the header compacts its micro-spacing and
  fluidly scales the brand label so `Naples Estate Jewelry` (domain suffix
  dropped from the wordmark 2026-08-01 — now shorter, so thin-mobile fit only
  improved), language, call, cart, and menu all remain visible without
  horizontal overflow down to 320px. Below 350px, call/cart controls, icon glyphs/count badge, and the
  outlined menu receive a second proportional size step.
- Live-spot pills (shop sidebar badges, mobile spot row, and the product
  page's "Based on spot" box) are tap-to-refresh via the shared
  `SpotRefreshPill`: `router.refresh()` plus a portaled, timestamped
  "Price refreshed" note. Product pages' price ticker reads
  "Last updated <time> · Updates in <m:ss> · <time>" in pinned Eastern
  time, and the Weight spec shows only the written-out total
  ("18.13 grams total" / "18.13 gramos en total").
- iOS format detection (telephone/date/address/email) is disabled site-wide
  via root-layout metadata — iOS Safari's auto-linking was mutating
  server-rendered text and causing real iPad hydration errors. Any visible
  phone number that should be tappable must be an explicit `tel:` anchor.
- Desktop Saved Items and Cart controls use color feedback plus motion on the
  icon glyph only; their hover state has no pale fill, surrounding lift, or
  shadow box.
- The header cart icon's has-items state keeps the bag outline visible: gold
  stroke with a 22% translucent gold interior tint plus the count badge,
  replacing the earlier solid-fill glyph. The Saved Items heart keeps its
  solid-fill active state.

## Checkout And Orders

- `/checkout` is a four-step single-page wizard (2026-07-31): Order Summary →
  Delivery/shipping/pickup radio cards with live tier fees → Contact &
  Address → Review & Pay (recap with Edit links, confirmation checkbox,
  PayPal). Signed-out visitors get a sign-in-or-guest entry dialog
  (per-tab remembered; not yet exercised live — verify once from a
  signed-out device). Tax renders after shipping in the summary so the
  merchandise + shipping taxable base is visually obvious.
- Server checkout rejections carry machine-readable codes
  (`OrderDraftErrorCode`); the client maps them to precise bilingual
  guidance (Express-over-$5,000 → switch-shipping copy; spot outage and
  call-to-purchase keep the phone number) with a legacy word-match fallback
  for uncoded responses.
- PayPal Orders API v2 is the storefront payment processor. The browser never
  supplies authoritative amounts; `src/lib/checkout-pricing.ts` reloads product
  data and calculates item snapshots, shipping, tax, and total.
- Checkout is U.S.-only for shipped orders. State is normalized to one of the
  50 states plus D.C.; ZIP accepts five digits or ZIP+4; the server rejects
  incomplete, invalid, international, and tampered addresses.
- `src/lib/checkout-shipping.ts` is the only shipping-rate catalog and is
  value-based as of 2026-07-30: fees tier on the order's merchandise
  subtotal. Local Pickup $0; Standard Insured $19-$165 across eight bands
  with USPS Registered Mail (2-10 business days, stated in both locales) at
  $5,000+; Express Overnight $55/$79/$119, hidden client-side and rejected
  server-side at $5,000+ because USPS insurance caps there. The checkout
  selector shows each option's live fee; FL tax applies to the tier fee. An
  exported marketplace scaffold (`getMarketplaceStandardShippingFee`) awaits
  the future Etsy/eBay shipping sync and is not yet wired. See
  `features/shipping-tiers-plan.md`.
- Current owner policy: Local Pickup and validated Florida destinations are
  charged 6% Florida sales tax on discounted taxable merchandise plus charged
  shipping. Non-Florida destinations receive $0 Florida tax.
- Florida destination-county discretionary surtax is not implemented. Tax
  collection in other nexus states is also not implemented and requires
  accountant review before expansion.
- Checkout uses no inventory reservation. Multiple buyers may reach PayPal;
  the first successful capture wins the row-locked inventory race.
- Capture evidence, webhooks, refunds, invoices, receipts, shipping/tracking,
  recycle-bin behavior, and sold-price locking have durable database support.
  The final live recovery/refund/race matrix remains an owner-controlled test.
- Pickup order details omit a meaningless shipping-address block. Financial
  summaries use exact two-decimal currency output.

## Admin And Listing Intake

- Admin Products defaults to Available inventory and supports filtering,
  selection, sticky identity columns/totals, row quick actions, draft/archive/
  sold lifecycle controls, image lightboxes, cloning, and permanent deletion
  behind explicit confirmation.
- Admin Products intentionally omits the separate Total, Available, and Sold
  summary cards; inventory counts remain available through the table and filters.
- The Admin Products screen is locked to the dynamic viewport; only the product
  table wrapper scrolls, including on narrow layouts.
- Below the tablet breakpoint, Admin Products includes an **Open Product Table**
  control. It promotes the existing table into a full-screen dialog with the
  complete dynamic viewport available for vertical and horizontal scrolling,
  a persistent Close control, Escape dismissal, and automatic desktop exit.
  The selection edge, product image, and row actions remain pinned in this
  mode, so the image keeps each row identifiable while inventory number, title,
  and every statistic pan beneath it. Its compact mobile launcher shares one
  row with **Add Product**. Mobile search now lives inside the collapsible
  Filters panel instead of reserving a toolbar row, and the visible/total item
  count sits in the table utility row beside **Reset view to drag reorder**.
  An active mobile search is included in the Filters badge count. The ordinary
  desktop search/count toolbar remains unchanged. The drag-reorder explanation
  is desktop-only; mobile keeps the actionable reset/reordering status when
  applicable without spending table height on that instructional sentence.
- Add/Edit listing supports product type, material/pricing fields, bilingual
  copy, `width_mm`, quantity, product video candidates, Etsy data, and eBay data.
- Edit Listing can regenerate only blank Spanish title/description/notes fields;
  retained Spanish copy is never overwritten and the result is saved only when
  the admin saves the form.
- The AI listing assistant supports iterative, in-editor conversation. Each
  turn revises the current form, reports what changed or could not be verified,
  and asks targeted follow-up questions. The server now auto-applies only
  high-confidence descriptive values going into blank fields; overwrites,
  uncertain values, and sensitive facts remain pending until the admin accepts
  them. Assistant turns have Read Aloud/Stop plus optional automatic playback,
  using OpenAI speech with a browser-device fallback. Its provider abstraction,
  admin-editable prompt, buyer-copy firewall, and explicit measurement rules
  remain enforced on every turn.
- UI icons now render through the shared inline-SVG `AppIcon` component backed
  by direct Lucide imports. The Material Symbols font, preload, immutable font
  assets, and subset-generation script are gone, so stale cached glyph subsets
  can no longer expose icon names as text. Decorative listing-editor header
  icons and the Spanish-regeneration icon were removed.
- Orders support invoices, email history, partial/full PayPal refund handling,
  shipment carrier/tracking, explicit inventory restoration, and a recycle bin.
- Messages and inquiries share the admin notification workflow; marketing
  supports subscribers, account holders, buyers, and combined audiences.

## Marketplace Integrations

- Etsy Phase 1/2 is live. The durable resumable queue migration is applied, and
  the 2026-07-21 repair action recovered all previously affected image-sync
  rows. Status reconciliation preserves local content freshness independently
  from remote active/draft lifecycle.
- Etsy draft publishing, selected review-first sync, channel-specific status
  checks, taxonomy correction, price pushes, and one-click repair are in the
  Admin Products Actions modal.
- eBay Phase 0 webhook/status reconciliation is live and Phase 1/2 write paths
  are partially live-verified. Review-first publishing remains the default.
- Etsy and eBay have separate status-check actions and separate Publish All
  Ready actions. Marketplace sync entry points are consolidated in the Actions
  modal.
- Marketplace listing shipping now follows the site's value-based tiers in
  code, pending owner activation: run
  `supabase/marketplace-shipping-tiers-2026-07.sql`, then the "Provision
  tiered shipping" actions in Settings → Etsy Sync / eBay Sync (idempotent;
  canonical "NEJ Insured Shipping $N" objects). Until then every sync path
  falls back to the existing single default shipping profile/policy. See
  `TASKS.md` for the verification runbook.
- Marketplace price automation is implemented locally and awaits the owner's
  manual deployment. Marketplace writes now reject fallback/missing relevant-
  metal spot quotes; manual and scheduled runs use bounded price-only batches;
  eBay filters already-current rows before each 25-item batch; and each daily
  run records an explicit summary shown in Admin Settings.
- Netlify Scheduled Functions are defined for Etsy at 11:15 UTC and eBay at
  11:45 UTC. The owner reports `ETSY_CRON_SECRET` is now entered in Netlify;
  `EBAY_CRON_SECRET` was already present. Etsy's daily toggle is enabled in the
  live database, while eBay's remains disabled until the owner deliberately
  enables it after deployment/testing.
- Open marketplace risks are tracked in `TASKS.md`: sold hidden eBay status
  scanning, inventory #82's external relist, remaining controlled eBay write
  checks, and one real Etsy image-progress observation.
- The current shipped eBay description banner contains off-eBay contact
  information and is intentionally not connected to listing descriptions.
  Root `banner.png` is a newer, different candidate, but still includes the
  website address; it is retained pending an owner decision and policy review.

## Instagram Posting (new 2026-07-31)

- The Meta app **Naples Estate Jewelry Social** exists (App ID
  `1551269126645242`, Instagram app ID `1561238015679345`), in development mode
  under the verified Naples Estate Jewelry business portfolio, with
  `instagram_business_basic`, `instagram_business_content_publish`, and
  `instagram_business_manage_comments` ready for testing.
- Phases 1 and 2 are code-complete and verified locally: schema, Graph API
  client, encrypted token storage with weekly auto-refresh, typed store, pure
  caption mapper, the JPEG rendition pipeline, the prepare→review→publish state
  machine, nine admin routes, the Admin → Settings panel, and two Netlify
  scheduled functions (token refresh, drip posting).
- The rendition pipeline is proven end to end against the live database: a real
  product produced nine 1080x1080 JPEGs in Supabase Storage, each publicly
  fetchable at HTTP 200 with immutable caching — exactly what Meta's image
  fetcher requires.
- The SQL is applied and `INSTAGRAM_TOKEN_ENC_KEY` / `INSTAGRAM_CRON_SECRET`
  are set in both Netlify and `.env.local`. The encryption key must stay
  identical in both places: local and production share one Supabase database,
  so a mismatch would make a stored token undecryptable in the other
  environment.
- **Live and proven.** `@naples_estate_jewelry` (BUSINESS) is connected, token
  valid to 2026-09-30 with the weekly refresh armed. The first live test on
  2026-08-01 published a real 9-image carousel with correct square images,
  live spot price, Spanish line, and clean hashtags.
- **An Instagram post cannot be edited OR deleted through the API.** Removal is
  a manual action in the Instagram app; `deletePost()` detects this and returns
  the permalink with instructions, and `forgetPost()` clears local state
  afterwards. This is why posting stays review-first.
- One test post remains live pending manual deletion (see `TASKS.md`); its
  caption carries the since-fixed "Inventory #21" auto-linked hashtag.
- The operator UI is built: a per-product Instagram panel (verbatim caption
  preview with character count, rendition thumbnails, queue controls, two-step
  publish confirmation, and the manual-delete path), reachable from a
  standalone `/admin/products/[id]/instagram` page, a collapsible section in the
  product editor drawer, and a Manage Instagram card in the Actions modal, with
  status chips on product rows.
- Renditions pad in each photo's own backdrop colour rather than white
  (2026-08-01). Catalog measurement: 109 light/cream covers, 19 opaque black,
  0 non-uniform, across 128 products with images. The 19 black ones are the
  chains — Miami Cuban, Byzantine, rope, Figaro, anchor, Monaco, box link —
  and 16 of them are legacy covers served from `public/assets/images/shop`
  rather than Supabase Storage, which `resolveImageUrl` already handles.
- **Every carousel leads with a generated ad card**: title, specs and price over
  the cover photo, on that photo's own backdrop colour. It is part of the
  posting pipeline rather than a setting, so there is no toggle. It permanently
  takes one of Meta's ten slots, leaving 9 for photos
  (`INSTAGRAM_MAX_PHOTO_ITEMS`). Type renders via Satori with brand fonts
  vendored under `next-app/src/assets/fonts` (static TTFs — Satori cannot parse
  variable fonts) and shipped through `outputFileTracingIncludes`.
- A card render failure is **not** fatal: the post degrades to photos only with
  a warning, because the card is presentation while the caption and photos are
  the substance. The card's Storage object is named `card-<hash>.jpg`, so the
  review UI can tell a real card from a fallback rather than assuming slide 0.
- **Per-image crops** are Instagram-only, stored normalized and keyed by image
  URL in `instagram_posts.image_crops`. The auto-proposal keys on saturation for
  dark backdrops so a chain is framed instead of the black velvet bust it hangs
  on, and on plain tolerance otherwise. `products.image_urls` is never touched.
- Still to build: wiring `markPostSold()` to the available→sold transition,
  out-of-date detection, and optionally a bulk queueing flow.

## Facebook Posting (LIVE-VERIFIED 2026-08-01)

- A deliberate mirror of the Instagram channel — see
  `features/facebook-posting.md` for the full shape and the API-difference
  table. Independent lineup/crops per channel; shared pure caption helpers and
  the shared card/rendition engine writing under its own
  `facebook-renditions/` prefix (GC scan updated).
- Every post carries a clickable `Shop:` link to the product page — the main
  reason to be on Facebook at all. Same fail-closed price rule as everywhere.
- **Live**: Page **Naples Estate Jewelry Co.** connected with a never-expiring
  Page token; prepare → publish → API-delete proven repeatedly through the
  operator UI; one approved post is live for product 21.
- Later on 2026-08-01 both channels gained the shared final caption structure,
  card fixes, publish-to-both modal, copy-curation, and discard — see items
  13-14 at the top of this file and `features/*.md`. The same
  `markPostSold()`/out-of-date/bulk gaps as Instagram apply.
- Instagram renditions live in the product-images bucket but are referenced by
  `instagram_posts.rendition_paths`; the Storage GC reference scan now includes
  them, without which the sweep would delete them as orphans after 24 hours.
- Policy: review-first (nothing auto-posts), 2 posts/day, captions quote
  "≈ $X at time of posting", English plus one Spanish line, and sold items get
  an auto "SOLD" comment while the post stays up.

## Product Media

- Product images are URL/path references only. New uploads go to Supabase
  Storage, are downscaled/encoded as WebP, and use immutable cache headers.
- Storage cleanup is reference-aware and dry-run-first. The last confirmed
  product-image GC pass reported no deletable orphans.
- Product video code is complete around direct browser-to-Cloudflare Stream TUS
  uploads, staged replacement, webhook processing, ready-only public playback,
  and provider-first deletion.
- The product-video SQL is applied. Netlify environment variables, Stream
  webhook registration, device testing, and marketplace MP4 validation remain
  pending.

## Security

- Netlify Edge applies a broad per-IP `/api/*` rate limit. Sensitive public
  routes also use distributed Supabase counters with route-specific limits.
- The shared limiter fails closed when its service client/RPC is unavailable.
  After the owner re-ran the SQL on 2026-07-28, a live read-only production
  probe confirmed that the rate-limit RPC is `SECURITY DEFINER`, has
  `search_path=public`, is blocked for `anon`/`authenticated`, remains
  executable by `service_role`, contains the deterministic one-percent
  one-day stale-row cleanup, and has `rate_limits_window_start_idx`.
- Public subscriber mutations are routed through validated Next APIs. Live
  2026-07-28 privilege probes now confirm both
  `subscribe_homepage(text,text,text)` and `unsubscribe_homepage(text)` are
  blocked for `anon`/`authenticated` and remain executable by `service_role`.
- The authenticated product-column hardening is applied: all seven internal
  product columns are unreadable to `authenticated`, while a normal public
  column remains readable.
- Admin routes require an authenticated admin profile. Browser clients use only
  public Supabase credentials; service-role access remains server-only.
- The deployed site returns the enforcing CSP, HSTS, frame blocking, referrer,
  permissions, nosniff, and cross-domain-policy headers. HTTP and `www`
  canonicalize to the HTTPS apex domain; fingerprinted Next assets return
  one-year immutable caching.
- Next.js is 16.2.12, PostCSS is overridden to 8.5.23, and Sharp is 0.35.3
  throughout the installed production tree. The production-only audit reports
  zero vulnerabilities.
- The full audit reports nine high-severity development-tool findings through
  ESLint 9's `minimatch@3` / `brace-expansion@1` chain. The audit's forced
  ESLint 10 remediation was tested and rejected because the stable React lint
  plugins bundled by `eslint-config-next@16.2.12` do not support it; lint fails
  at rule startup. This is not part of the deployed dependency tree. Monitor
  upstream stable tooling rather than forcing an incompatible major upgrade.
- The deployed `blocked-probes` edge response terminates the configured
  WordPress, XML-RPC, `.env`, `config.json`, and `.git` paths before framework
  routing. A live 2026-07-28 probe of nine exact/base/wildcard variants
  confirmed every response is 410 with the expected five-byte plain-text body.
  The forced redirects remain as fallback. Rate-limit exhaustion was not
  intentionally triggered in production.

## Database And Deployment

Confirmed applied migrations include the main sales/PayPal schema, no-
reservation checkout, PayPal hardening/refund ledger, order email history,
order tracking, order/message recycle bins, sold-price locking, product
quantity, product width, Etsy sync/resumable queue, eBay sync, and product
videos. Individual runbooks remain the authority for migration order.

Do not infer that every SQL file is applied. The three 2026-07 security scripts
are specifically verified in production: subscriber RPC execution is
service-role-only, the current rate-limit function/index/cleanup definition is
present, and authenticated users cannot read the seven internal product
columns.

Netlify environment values are the current operating credentials. Local
`next-app/.env.local` is known to be stale and must not be treated as the
production configuration.

A read-only Netlify key-name audit on 2026-07-28 found the core Supabase, site
URL, Resend, PayPal, Anthropic AI, Etsy, and eBay entries present. The four
Cloudflare Stream variables and `OPENAI_API_KEY` remain intentionally deferred.
On 2026-07-29 the owner reported adding `ETSY_CRON_SECRET` directly in Netlify;
its value was not read or recorded. `EBAY_CRON_SECRET` was already confirmed
present. The owner also added `ETSY_CRON_SECRET` to the ignored local
environment. The signed-in local Admin Settings status check now reports the
Etsy daily automation as ready, and an unauthenticated POST to the protected
price-push route returned HTTP 401 without running a marketplace update.

## Verification Baseline

Current baseline (2026-07-31, end of session): **492 tests passing**,
`npx tsc --noEmit`, `npm run lint`, and the full production build all exit 0
with all 420 static pages generated — re-run after every change in the
pending-deployment batch, but stop the dev server before building and restart
it afterward so dev/build never write `.next` concurrently. Browser
verification in both locales covered the checkout wizard end to end
(boundary tiers, blocked Continue, recap edits, PayPal mount at step 4),
spot-pill refresh with the portaled note, the ticker line, and the weight
spec; the tablet-only iPad hydration error was root-caused to iOS
phone-number auto-linking and fixed via site-wide format-detection metadata
(verified present on all page types including the 404 shell). The thin-mobile
header also passed at 320, 350, 375, and 400px without brand clipping or
horizontal overflow, including Spanish at the 320px worst case. The rebuilt
product-detail thumbnail rail passed page/lightbox, forward/reverse wrap,
rapid-click, keyboard, English/Spanish, and 320/375/768/1024/1440px browser
checks; the active and next thumbnails stayed visible without page overflow.
The product-summary specification grouping also passed English/Spanish checks
at 320/350/375/390/768/1024px with no orphaned spec or page overflow.

A 2026-07-30 read-only pre-deployment audit of the PayPal checkout system
(routes, pricing/shipping/address libraries, client flow, webhook, refunds, and
the applied SQL definitions) confirmed the documented payment invariants in
current source with zero code changes, and re-ran the full verification:
463/463 tests, `npx tsc --noEmit`, `npm run lint`, and the 419-page production
build all passed. The audit's non-blocking follow-ups (removing the legacy
`/payment` placeholder page and fixing the PayPal feature-doc drift) were
completed later the same day; see `CHANGELOG.md` 2026-07-30. A same-day
read-only debugging session then re-verified the post-removal state: full
suite green (462/462 tests, TypeScript, lint, 0-vulnerability production
audit, complete build), an error-free browser walkthrough of
home/shop/product/checkout with policy-correct totals in all three tax cases,
rendered PayPal buttons behind the working not-ready gate (no order created),
Spanish and 375px mobile passes, and 200 + CSP/HSTS production probes. The
deployed site still serves `/payment` until the next owner deploy.

Latest app verification for the marketplace price-automation pass:

- `npm test -- --run`: **463 tests passed**.
- `npx tsc --noEmit`: **passed**.
- `npm run lint`: **passed**.
- `npm audit --omit=dev`: **0 vulnerabilities**.
- `npm audit`: **9 high-severity development-tool findings** in the supported
  ESLint 9 matching stack; the forced ESLint 10 path is currently incompatible
  with Next's stable React lint plugins.
- `npm run build`: **passed** on Next.js 16.2.12. TypeScript completed, all 419
  static pages generated, and the command exited 0.
- An isolated Node localhost-stub harness imported both Netlify scheduled
  functions and verified their UTC schedules, POST paths, marketplace-specific
  secret headers, missing-secret rejection, and non-2xx error propagation.
  The harness did not contact Etsy or eBay.
- `npm start -- -p 3100` production-runtime smoke test: home, Available/Sold
  shop views, the Egyptian tray detail in English and Spanish, and
  `/api/metal-prices` returned HTTP 200; both secretless cron POSTs returned
  HTTP 401; no server runtime errors were logged.
- Recent browser checks covered shop routes, filtering, responsive overflow,
  image loading, checkout address validation, and Florida/non-Florida totals.
- 2026-07-28 production smoke test: live security headers, apex/HTTPS
  redirects, immutable Next-asset caching, robots, and the 120-URL sitemap
  passed. English/Spanish home and shop routes, Available/Sold inventory,
  Silver + Everything Else counts, checkout/PayPal rendering, TradingView,
  contact/evaluation forms, the signed-in Admin Products shell, and the AI
  listing-assistant controls rendered without data writes or submissions. The
  previously affected Egyptian tray remained visible at 390x844 with all
  customer-reveal containers visible. Back to Shop restored page 2 and the
  recorded card position. The hero used one server-authoritative product set;
  later per-slot changes were the carousel's intentional back-of-ring cycling.
- The first live test found one reproducible non-blocking React hydration error
  because Netlify formatted the product update clock in UTC while the browser
  used Eastern time. The deployed ticker now formats explicitly in
  `America/New_York`. Follow-up English and Spanish checks at desktop and
  390x844 mobile rendered matching Eastern-time labels, visible customer-reveal
  containers, and purchase controls with zero console warnings/errors.
- 2026-07-28 post-fix verification: five focused tests passed, the full suite
  passed all 455 tests, lint passed, and the Next.js 16.2.12 production build
  completed TypeScript and all 419 static pages. The affected English product
  passed desktop and 390x844 browser checks with visible reveal containers,
  Add to Cart, Eastern-time ticker output, and no warnings/errors; the Spanish
  product passed the same hydration check. The edge response unit coverage
  confirms all configured probe patterns return cacheable, non-indexable 410.
- 2026-07-23 desktop hover-affordance pass: `npm run lint` passed; desktop
  homepage and shop preview checks confirmed the new controls have pointer
  cursors and transition rules. The dev server remains available at
  `http://localhost:3000`.
- 2026-07-23 Admin Products summary-card removal: `npm run lint` passed; the
  `/admin` preview showed the toolbar directly below the header with no
  summary cards. The shared JSX removal applies at desktop, tablet, and mobile
  widths. `npm run build` compiled successfully but remains blocked by the
  known generated `renderShopPage` route-contract error above.
- 2026-07-23 Admin Products page-scroll removal: the `/admin` preview measured
  the document and body at the viewport height while the product-table wrapper
  retained independent vertical scrolling. `npm run lint` passed; the build
  remains blocked by the same known generated route-contract error.
- 2026-07-24 local preview orientation: `npm run dev` started successfully at
  `http://localhost:3000`; the homepage and `/shop` rendered in the in-app
  browser. The shop showed live spot prices, filters, and product cards. No
  source or data changes were made.
- 2026-07-24 product-detail mobile investigation: the affected item route
  returned HTTP 200 and had no browser console errors, but its shared content
  wrapper stayed at `data-customer-reveal="pending"` / `opacity: 0` at 390px.
  The reveal waits on 15 gallery images, including offscreen lazy thumbnails
  that never load on mobile. This explained the brief flash followed by blank
  content.
- 2026-07-24 customer-reveal hardening: the shared reveal now ignores lazy
  images and has a 1.4-second fallback, so slow/deferred media cannot leave
  customer content hidden. At 390px the affected 15-image product stayed
  visible while three offscreen thumbnails remained unloaded. A browser audit
  of 28 English/Spanish public routes found zero pending/hidden reveal
  containers and no browser warnings/errors. `npm run lint` passed and
  `npm test -- --run` passed all 435 tests; `npm run build` compiled before
  stopping at the pre-existing `renderShopPage` route-contract error.
- 2026-07-24 shop-return restoration: opening a product from either gallery or
  list view records the exact localized shop URL and vertical position for this
  tab. The detail-page Back to Shop action restores that state; direct entries
  still use the normal shop fallback. Focused coverage passed (2 tests), the
  full suite passed all 437 tests, and a browser check returned from page 2 to
  the exact 1,150px position. `npm run lint` passed. `npm run build` compiled
  before stopping at the same existing `renderShopPage` route-contract error.
- 2026-07-24 iterative AI listing assistant: a real two-turn Admin preview
  preserved the existing listing, reported four useful clarification points,
  accepted the admin's answers and revision request, and produced a second
  revised draft. Conversation state resets between product editors and remains
  unsaved until normal Save. Focused assistant tests passed (9), the full suite
  passed all 439 tests, and `npm run lint` passed. `npm run build` compiled
  before stopping at the unchanged `renderShopPage` route-contract error.
- 2026-07-24 homepage-carousel bootstrap fix: the homepage now server-renders
  one cached Supabase-curated payload and `HomeHero` no longer replaces it
  after hydration. Bundled products are used only if the server read fails or
  the selection is empty; admin saves expire the tagged cache immediately.
  Initial HTML contained the current curated Rolex and no fallback name/path,
  and six repeated preview reloads showed the same one-set result with no
  console errors. Three focused tests, all 442 tests, and lint passed.
  `npm run build` compiled before stopping at the unchanged `renderShopPage`
  route-contract error.
- 2026-07-24 shop status radios: the old Available-only checkbox is now an
  Available/Sold radio pair, with Available as the required default. Browser
  checks confirmed Available → Sold → Available URL/result transitions,
  exclusive checked state, and paired Spanish labels. The focused 18-test
  filter suite, all 443 tests, and lint passed. `npm run build` compiled before
  stopping at the unchanged `renderShopPage` route-contract error.

- 2026-07-24 AI confirmation and read-aloud hardening: the server now compares
  each AI draft with the current form and holds every overwrite, sensitive
  field, or low/medium/missing-confidence value for explicit accept/keep
  review. Warnings and uncertain unchanged values force clarification
  questions. Read Aloud/Stop and an automatic-play preference use an
  authenticated OpenAI speech route with a device-voice fallback. A live Admin
  test proved proposed fields stayed unchanged until accepted, Keep Existing
  preserved the original, Undo restored the accepted test field, and read-aloud
  entered/stopped playback; no listing was saved. Eighteen focused tests, all
  452 tests, and lint passed. `npm run build` compiled before stopping at the
  unchanged `renderShopPage` route-contract error.
- 2026-07-27 no-code deployment-readiness audit: all 452 tests and lint passed,
  but the production build still fails on the named `renderShopPage` route
  export and the dependency audits now report high-severity advisories.
  A cold parallel preview probe reproduced the previously intermittent
  development JSON parse failure across several routes; both translation JSON
  files validated, and a clean restart followed by sequential desktop/mobile-
  user-agent route checks returned 200 for home, shop, the affected multi-image
  detail page, Spanish home/shop, checkout, contact, and metal prices. Admin
  correctly redirected to sign-in. No application code, configuration,
  database, or site content changed.
- 2026-07-27 deploy-blocker remediation: current official guidance and live npm
  registry/audit data reconfirmed the route export and production dependency
  findings. The shop renderer moved to a normal colocated module, leaving the
  route file with only valid Next exports. Next/ESLint config advanced to
  16.2.12, Sharp to 0.35.3, and overrides pin PostCSS 8.5.23 plus Sharp 0.35.3
  throughout Next's nested tree. Production audit, lint, all 452 tests, and the
  complete 419-page build passed. English/Spanish shop, `/shop-modern`, the
  affected mobile product page, checkout, contact, auth redirect, and metal
  prices returned expected results with no browser warnings/errors or mobile
  overflow.

This session's UI changes harden customer-page reveal behavior and preserve
shop context when returning from product details, and add iterative Admin AI
listing feedback with explicit confirmation and read-aloud. The carousel now
also receives one server-authoritative initial payload. These changes do not
alter SQL, saved customer/product data, orders, or payments.

## Immediate Priorities

1. Complete accountant review for Florida county surtax and any non-Florida
   nexus registrations before changing tax collection.
2. Run the controlled PayPal recovery/refund/race matrix in the configured
   environment.
3. Complete the remaining targeted non-video marketplace verification.
