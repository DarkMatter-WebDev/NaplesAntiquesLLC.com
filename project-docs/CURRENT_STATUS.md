# Current Status

> Reflects the present state of development. **Update this at the end of every
> work session.** Last updated: **2026-06-26**.

## ⚠️ Pending manual SQL (run in Supabase, project `evzluixourmsefwdsieu`)

- **`supabase/admin-notifications-recycle-bin.sql`** — adds
  `admin_notifications.deleted_at` and the `trash_/restore_/delete_admin_notifications`
  RPCs that power the Messages Recycle Bin. Until run, "Delete Selected" permanently
  deletes (legacy behavior) and the Recycle Bin link is hidden. Script self-verifies
  (returns 3 function rows).
- Older pending items below still apply (image_urls, public_notes_es, etc.).

## Current App

- The current deploy target is the **Next.js app in `next-app/`**.
- Root `netlify.toml` sets `base = "next-app"`, runs `npm run build`, and
  publishes `.next` with `@netlify/plugin-nextjs`.
- The retired root static HTML site has been removed: root `*.html`, `es/`,
  `scripts/`, root `assets/`, `tools/`, and old `netlify/functions/` are gone.
- Keep runtime code and public assets under `next-app/`.

## What Is Currently Working

- **Localized marketing site** with EN/ES routes for home, about, contact, free
  evaluation, FAQ, privacy, and service/category pages.
- **Online shop** (`/shop`, `/shop/[id]`) backed by Supabase `products`, with
  filters, product detail pages, local/Supabase image support, and live metal
  pricing.
- **Live metal pricing** via
  `next-app/src/app/api/metal-prices/route.ts`,
  `next-app/src/lib/spot-price.ts`, and `next-app/src/lib/pricing.ts`.
- **Customer accounts** through Supabase Auth and Next routes
  `/account/sign-in`, `/account/sign-up`, and `/account`.
- **Admin, users, and inquiries** through Next admin pages and API routes under
  `next-app/src/app/[locale]/admin*` and `next-app/src/app/api/inquir*`.
- **SEO** through Next metadata, `robots.ts`, and `sitemap.ts`.
- **Carousel hero** on the home page — a windowed/infinite 3D ring of curated
  pieces with a per-photo White/Black swept background, `next/image` optimization
  + preloading, offscreen pause, and admin-configurable selection, ordering, group
  colors, show-price, and desktop/mobile ring sizes. See
  `project-docs/features/carousel-hero.md`.

## What Was Recently Completed

- **Contact page hero removed (2026-06-25):** The normal `/contact` view no longer
  has the top hero — it opens directly with the "Message Us Directly" section (now
  the page `<h1>`), followed by "Submit Your Item". The hero is kept only for the
  product-inquiry flow (`/contact?item=…`), which needs its heading. Verified in the
  preview (hero gone, message section is the first `<main>` child at y=64, 0 console
  errors); build clean.
- **Unified admin inbox (2026-06-25):** Every inquiry submission (Free Evaluation,
  Submit Your Item, product inquiry) now also posts an `admin_notifications` row
  (`type: 'inquiry'`, with photos) via `/api/inquire`, so all incoming submissions
  surface in `/admin/messages` alongside "Message Us Directly" messages and order
  notifications (unread badge covers everything). Inquiries still also live in
  `/admin/inquiries` and still email the owner. New shared `lib/admin-notify.ts`
  (`createAdminNotification`), reused by `/api/contact-message`. Notification insert
  is best-effort (never fails the submission). Notification titles are type-aware and
  human ("Free evaluation request from {name}", "Item submission from {name}",
  "Inquiry about {product} from {name}", "Message from {name}"), and the message
  center shows a color-coded type chip (Inquiry / Message / Order). Live test
  confirmed the `admin_notifications` insert succeeds (service_role already has the
  grant; `service-role-insert-grants.sql` kept as an idempotent safety net, likely not
  needed). Build + lint clean.
- **Fixed lead forms failing with 42501 permission-denied (2026-06-25):** Free
  Evaluation / Submit Your Item / inquiry submissions were returning 500 because
  `/api/inquire` inserted via the **service-role** client, which lacks INSERT on
  `inquiries` (grants are scoped to `anon`/`authenticated`; inserts run as `anon`
  under the public-insert policy). Once a service key was set for photo uploads the
  insert switched to `service_role` and failed. Fixed by inserting as the **anon
  role** (`createPublicClient()`) in both the multipart and JSON paths; the service
  client is now used only for the Storage upload. Verified live: the exact free-eval
  path returns 200 (was 500). Also added `supabase/service-role-insert-grants.sql`
  granting `service_role` INSERT on `admin_notifications` for the "Message Us
  Directly" form (no anon path) — **pending manual apply**; that form falls back to
  the email backup until then. Build + lint clean. See DECISIONS (2026-06-25).
- **Customer photos surfaced in the admin panel (2026-06-25):** `/admin/inquiries`
  now renders submitted photos (`inquiries.uploaded_image_urls`) as clickable
  thumbnails in each inquiry's expanded view. The "Message Us Directly" form gained
  optional multi-photo upload; `/api/contact-message` now takes multipart, uploads
  to the `product-images` bucket under a `messages/` prefix, and stores URLs in a new
  `admin_notifications.image_urls` column that `/admin/messages` renders as
  thumbnails. The new upload destination was added to the Storage GC reference scan.
  Reads/writes degrade gracefully pre-migration. **Pending manual: run
  `supabase/admin-notifications-image-urls.sql`** (and ensure
  `inquiries.uploaded_image_urls` exists via `sales-workflow.sql` for inquiry photos).
  Verified build clean (205 pages), lint only the 3 known issues, message form renders
  the photo zone, API validates under multipart. See DECISIONS (2026-06-25).
- **"Message Us Directly" contact form added (2026-06-25):** New section below the
  `/contact` hero (above "Submit Your Item") with name, email, optional phone, and a
  large message textarea. It delivers straight to the admin message center: the new
  `/api/contact-message` route inserts a `type: 'message'` row into
  `admin_notifications` via the service-role client (so it shows in `/admin/messages`)
  and sends a best-effort owner email (reply-to the sender) as backup. New
  `components/contact/MessageUsForm.tsx` (bilingual, honeypot, privacy notice).
  Verified: page renders the section under the hero, API validation works
  (missing/invalid → 400, honeypot dropped), build clean (205 pages), lint only the
  3 known issues. Depends on `SUPABASE_SERVICE_ROLE_KEY` + the `admin_notifications`
  table (already used by checkout/messages); if the table is missing the message
  still emails the owner. See DECISIONS (2026-06-25).
- **Web performance/security audit fixes (2026-06-25):** Four-phase pass.
  (1) **Contact forms fixed** — `/contact` + `/free-evaluation` were silently
  failing on Netlify Forms (undetectable on client-rendered React); rewired to
  the existing `/api/inquire` Resend+Supabase pipeline via `fetch` multipart,
  with server-side photo upload to `product-images` and `uploaded_image_urls`.
  (2) **netlify.toml** consolidated (deleted `next-app/netlify.toml`), added
  security headers + CSP **Report-Only**, 1y immutable caching for
  `/_next/static/*` + `/assets/*`, 410 bot rules → `public/410.html`, tightened
  `robots.ts`. (3) **Images** re-encoded/recompressed to WebP (logo 480→5KB,
  jeweler 370→64KB, bullion 529→236KB, money 862→323KB, silver/shop JPGs→WebP);
  deleted unused `homepage-hero.mp4`. (4) **Root `app/not-found.tsx`** added;
  meta descriptions spot-checked unique. `npm run build` clean; `npm run lint`
  only the 3 known pre-existing issues. **Pending manual:** run
  `supabase/shop-new-listing-jpg-to-webp.sql`; after deploy, promote CSP from
  Report-Only to enforcing once the console/report endpoint is clean; verify
  headers/410s live; send one real test submission and confirm it lands in
  `/admin/inquiries`. See DECISIONS (2026-06-25).
- **Mobile header oversized text fixed (2026-06-25):** The MENU toggle and the
  "Saved Items" (Favorites) row in the mobile menu rendered at 16px instead of
  their intended small size, because the global `button { font: inherit }` reset
  in `globals.css` (unlayered) overrode Tailwind's text utilities on `<button>`
  elements. Fixed in `SiteHeader` CSS by setting explicit `font-size` on
  `.menu-toggle` (10px / 12px at md) and `.mobile-nav-link` (12px), which beats
  the global rule by specificity without affecting other buttons. Verified at
  375px: MENU = 10px (matches the language toggle), all mobile menu rows = 12px.
- **Product listing notes made bilingual (2026-06-25):** The add/edit listing
  form's admin-only "Internal Notes" field was replaced with a public "Notes (ES)"
  field, and "Public Notes" was relabeled "Notes (EN)". New `products.public_notes_es`
  column (ES counterpart to `public_notes`); the `/es` product detail page shows it
  with fallback to the English note (like `description_es`). Notes (ES) auto-translates
  from Notes (EN) on save and is manually editable. Scope is products only —
  `orders`/`inquiries`/`profiles` `internal_notes` are unrelated admin fields and were
  left unchanged; legacy `products.internal_notes` is kept (hidden) for the existing
  `details` fold. Reads/writes degrade gracefully pre-migration. **Pending manual: run
  `supabase/product-public-notes-es.sql` in Supabase** so the column exists and Notes
  (ES) persists/renders from live data. Verified `npm run build` clean (204 pages),
  `npm run lint` only the 3 known issues, and `/en`+`/es` product detail pages return
  200 against the un-migrated DB. See DECISIONS (2026-06-25).
- **AI listing prompt simplified to one editable value (2026-06-25):** Collapsed
  the AI listing-assistant prompt from a "default + override" model (Custom/Default
  badge) to a single editable prompt. The admin edits it in `/admin/settings` and
  the saved value becomes the prompt; the code constant
  `PRODUCT_EXTRACTION_SYSTEM_PROMPT` (v11) is only its built-in starting value,
  recoverable via **Restore Built-In**. `/api/admin/ai-settings` returns
  `systemPrompt` + `builtInPrompt` (no more `isCustom`); store helpers are now
  `fetchStoredSystemPrompt`/`saveSystemPrompt`; the fill route and provider drop
  the "override" framing. Persistence behavior is unchanged (saved value wins,
  blank clears to built-in). Still requires `next-app/sql/ai-settings-setup.sql`
  in the live DB for saves to persist (until then the panel shows the built-in
  prompt and saving fails). Verified `npm run build` clean (204 pages) and
  `npm run lint` shows only the 3 known pre-existing issues; `/api/admin/ai-settings`
  returns the expected admin-gated JSON. See DECISIONS (2026-06-25).
- **Spanish orthography sweep across all UI strings (2026-06-25):** Audited every
  Spanish string in the app (placeholders, headings, labels, nav, forms,
  product/shop pages, legal pages, banners, footers, tooltips, messages) and
  corrected missing accents/tildes, inverted punctuation (`¿`/`¡`), and spelling
  while preserving wording and meaning. Began with the homepage newsletter signup
  (`HomeSubscriberForm` placeholder `Correo electronico` → `Correo electrónico`;
  `FormPrivacyNotice` `informacion` → `información` and `Politica` → `Política`),
  then applied ~124 fixes across 22 files (`about`, `privacy`, `terms`,
  `auctions`, `services`, `shop/page`, `shop/[id]`, `ShopFilters`,
  `ShopPagination`, `account/security`, `AccountDashboard`, `AccountProfileForm`,
  `CartDrawer`, `CheckoutClient`, `OrderSummary`, `PaymentClient`, `SiteFooter`,
  and legal components). `messages/es.json` was already correct; admin pages are
  English-only. Verified `npm run build` clean (202 pages) and `npm run lint`
  shows only the 3 known pre-existing issues (`AdminShell.tsx`, `ShopFilters.tsx`,
  `app/layout.tsx`); all `/es` routes return 200 and the newsletter section
  renders the accented copy with 0 console/server errors.
- **Create-account duplicate-email block + reset offer (2026-06-25):** The
  Create Account form now detects an email that already has an account and shows
  a notice with a **Reset Password** button (sends `resetPasswordForEmail`) and a
  Go to Sign In link, instead of silently re-sending a confirmation. Detection
  uses Supabase's empty-`identities` signal (existing confirmed account) plus an
  "already registered" error fallback. New dual-mode recovery page
  `account/reset-password` (request a reset email, or set a new password from the
  emailed recovery session) and a "Forgot password?" link on sign-in. Verified
  build (route registered EN/ES), lint (only the 3 known issues), and that a
  brand-new email still reaches "Check your email" with no false positive.
  **Pending manual:** confirm Supabase redirect URLs allow
  `…/account/reset-password`, and end-to-end test the existing-account notice +
  reset email with a known confirmed account (not exercisable in dev).
- **Shop gallery/list view toggle (2026-06-25):** Added a grid/list view toggle
  to the `/shop` gallery toolbar (beside Sort) that switches the catalog between
  the existing gallery cards and a new compact list mode on both desktop and
  mobile. The gallery cards are unchanged — list mode is a separate
  `ProductListRow` rendered only when active, with state in a `view=list` URL
  param (defaults to gallery). New `components/shop/ShopViewToggle.tsx` and
  `components/shop/ProductListRow.tsx`; `ShopProductGrid` gained a `view` prop
  (list branch + scoped CSS); `shop/page.tsx` parses/passes `view`. List rows
  show thumbnail + status badge, metal label, title, brand/link flag, circa,
  purity/weight/length chips, "Your price", and wishlist + cart icon buttons
  (price/actions wrap below on phones). Verified: gallery view unchanged, list
  view renders at 450px and 1280px (3-col row grid), toggle works both ways, 0
  console errors. `npm run build` clean (202 pages); `npm run lint` shows only
  the 3 known pre-existing issues.
- **Shop cold-load performance pass + skeleton loaders (2026-06-24):** Cached the
  `/shop` catalog read in `unstable_cache` (keyed by the DB filter set) so cold
  concurrent visitors share one DB round trip per 300s window; added a 1.5s
  timeout to the upstream metal-price fetch so it can't block shop TTFB; set true
  `priority` on first-row product cover images and `prefetch={false}` on the 48
  dynamic product links; dropped the unused `GRAD` axis from the Material Symbols
  font; removed `unoptimized` from the header logo (per-page logo preload
  491,738 B → 1,321 B). Added warm-tone shimmer `loading.tsx` skeletons for
  `/shop` and `/shop/[id]` (shared `.nej-skeleton` utility, reduced-motion aware)
  that stream instantly and reserve layout boxes to prevent CLS. `/shop` remains
  dynamic SSR by design (it awaits `searchParams` for filters), but the cache +
  timeout remove the repeated full-table scan and the upstream-API stall that
  caused the slow cold load. Verified: `npm run build` clean (202 pages),
  `/shop` 48/54 cards, `/shop?metal=gold` 47/54 (filtering preserved), product
  page renders; `npm run lint` shows only the 3 known pre-existing issues.
- **Cookie banner + header logo responsive fixes (2026-06-24):** Cookie notice
  buttons stack full-width vertically below 480px (`flex-col w-full`) and
  switch to a single horizontal row at 480px+, so the "Accept" button never
  overflows the banner's backdrop-blur background on narrow phones. Added
  `flex-shrink-0` to the button row at `md` so it holds its natural width when
  the banner uses the horizontal `justify-between` layout at 768px+. Added
  `min-w-0` to the text div so it wraps gracefully. Also added `overflow-hidden`
  to the logo `<Link>` in `SiteHeader` so the `whitespace-nowrap` brand text
  clips at the link boundary instead of overlapping the "ES" language toggle by
  ~20px at 320px. Verified: `npm run build` clean, Playwright viewport sweep at
  320–1440px across /, /shop, /contact, /estate-jewelry, /about — 0
  horizontal-overflow failures.
- **Production performance/caching pass completed (2026-06-22):** Added a
  cookie-free public Supabase server client for anonymous reads, moved `/shop`
  and `/shop/[id]` reads to it, narrowed product-detail selects, added
  `generateStaticParams` for product IDs, scoped proxy Supabase session refresh
  to account/admin/checkout/payment routes, and enabled static locale params via
  `next-intl` `setRequestLocale`. Marketing/legal/service pages now build as
  SSG while auth/admin/payment and query-driven shop routes remain dynamic.
  Enabled explicit Next compression and cache headers for `/api/metal-prices`;
  added repeatable `npm run check:compression` and `npm run measure:routes`
  probes. Parallelized independent `/shop` product/spot/count reads, changed
  admin drag reorder from per-row update loops to one bulk upsert, made the
  homepage subscriber form optimistically clear and restore input on failure,
  and removed repeated per-card style payload from the shop grid. Verified with
  `npx tsc --noEmit`, `npm run build`, `npm run check:compression`, warmed
  `npm run measure:routes`, and an in-app browser production `/shop` smoke:
  48/48 cards visible after reveal, 0 horizontal overflow, 0 console errors.
  Final warmed route probe: `/` 89,161 B gzip / 117.4 ms total / cache HIT,
  `/shop` 1,195,030 B gzip / 517.8 ms total / dynamic no-store,
  `/api/metal-prices` 117 B / 8.5 ms total / `s-maxage=300`. `npm run lint`
  remains blocked only by the existing `AdminShell.tsx` state-in-effect error,
  `ShopFilters.tsx` unused-variable warning, and `app/layout.tsx`
  font-display warning.
- **Mobile shop filter apply button added (2026-06-22):** The mobile/tablet
  expandable shop filter panel now ends with a large gold "Save and Apply
  Filters" button that commits any typed price range and closes the panel,
  giving shoppers a clear way back to the product grid. Verified with
  `npx tsc --noEmit`, `npm run build`, and an in-app browser 390px `/shop`
  smoke: the Filters toggle opened the panel, the new button was visible at
  309px wide / ~51px tall, clicking it closed the panel, and horizontal
  overflow stayed 0. `npm run lint` remains blocked only by the existing
  unrelated `AdminShell.tsx`, `ShopFilters.tsx`, and `app/layout.tsx` issues.
- **Homepage/shop reveal fail-open fixed (2026-06-22):** The home carousel
  hero and shop product cards now use bounded reveal fallbacks so stalled or
  missed carousel settings, font, or image load events cannot leave customer
  content invisible. Verified with `npx tsc --noEmit`, `npm run build`, and
  in-app browser smoke on `/` and `/shop`: the homepage hero reached
  `is-ready` with top/carousel/bottom layers at opacity 1, `/shop` rendered 48
  visible product cards, and both pages had 0 horizontal overflow. `npm run
  lint` is still blocked only by the existing `AdminShell.tsx` error, the
  existing `ShopFilters.tsx` unused-variable warning, and the existing
  `app/layout.tsx` font-display warning.
- **Homepage carousel first-load fallback refined (2026-06-22):** The hero now
  waits longer for the live curated carousel selection before showing the
  baked-in fallback list, and ignores late live-selection results after fallback
  has been used so fallback photos cannot flash visibly and then swap to the
  real starting items. Verified with `npx tsc --noEmit`, `npm run build`, and
  in-app browser timed samples on `/`: the early visible carousel used live
  curated item alts, no fallback image paths were visible, the hero reached
  `is-ready`, and horizontal overflow remained 0. `npm run lint` remains
  blocked only by the same unrelated existing issues.
- **Responsive layout audit/refactor completed (2026-06-22):** Added shared
  responsive layout primitives (`PageContainer`, `Section`, `ResponsiveGrid`,
  `Stack`, `CardGrid`, `FormGrid`, `HeroSection`) plus global clamp-based
  spacing/type helpers and overflow-safe media/control defaults. Refactored the
  header breakpoint behavior, shop hero/catalog/product grid, home/contact/about
  layout sections, checkout/payment form grids, cart drawer sizing, admin header
  wrapping, subscriber/marketing table wrappers, and `/admin/users` mobile card
  fallback. Verified with `npx tsc --noEmit`, `npm run build`, and a local
  Chrome/Playwright sweep across `/`, `/shop`, `/contact`, `/about`,
  `/checkout`, `/payment`, `/account/sign-in`, `/free-evaluation`,
  `/gold-services`, `/silver-services`, `/estate-jewelry`, and `/admin/users`
  at 320, 375, 390, 430, 768, 1024, 1280, 1440, and 1920px: 108 checks, 0
  horizontal-overflow failures. `npm run lint` remains blocked only by unrelated
  existing issues in `AdminShell.tsx` and `ShopFilters.tsx`, plus the existing
  font-display warning in `app/layout.tsx`.
- **Top Clear Filters control added to shop sidebar (2026-06-21):** Added a
  second Clear Filters button at the top of the left shop filter panel, shown
  only when filters are active and wired to the same clear-all behavior as the
  existing bottom control. Verified with `npx tsc --noEmit`, `npm run build`,
  and local rendered HTML checks for filtered/unfiltered `/shop` states. `npm
  run lint` remains blocked by unrelated pre-existing issues in
  `AdminHeader.tsx`, `AdminShell.tsx`, and the existing unused
  `hasDrawerFilters` warning in `ShopFilters.tsx`.
- **Gallery sort dropdown added above shop cards (2026-06-21):** Added a
  compact rectangular Sort dropdown at the top right of the product gallery,
  using the same URL-backed `sort` parameter and option set as the left filter
  menu. The shared `ShopSortSelect` client control now powers both surfaces and
  clears `page` on sort changes so pagination cannot remain stale. Verified
  with `npx tsc --noEmit`, `npm run build`, and a local `/shop` HTML smoke
  showing the new gallery toolbar plus Inventory/Price sort options. `npm run
  lint` remains blocked by unrelated pre-existing issues in `AdminHeader.tsx`,
  `AdminShell.tsx`, and the existing unused `hasDrawerFilters` warning in
  `ShopFilters.tsx`.
- **Public shop hides draft/reserved inventory (2026-06-21):** The public
  shop now treats only `available` and `sold` products (including legacy
  capitalized values) as storefront-visible. Draft, reserved, pending-payment,
  and archived rows are excluded from `/shop` product queries, public inventory
  counts, filter option derivation, and normal product detail access; existing
  admin/account return paths can still preview order/admin-linked product
  detail pages. Verified with `npx tsc --noEmit`, `npm run build`, local
  preview smoke at `http://127.0.0.1:3000/shop`, a Supabase-vs-rendered HTML
  check showing 0 hidden-status product links rendered, and
  `/shop?status=reserved` returning the empty state. `npm run lint` is
  currently blocked by unrelated pre-existing lint issues in `AdminHeader.tsx`,
  `AdminShell.tsx`, and `ShopFilters.tsx`.
- **Shop Era/Year slider added (2026-06-20):** A full-width dual-handle range
  slider below the shop hero filters by `item_year`, with labeled estate-jewelry
  era bands (Victorian→Contemporary, 1837→current year) and boundary-year ticks,
  plus a stacked overlapping row for Art Nouveau (1890–1910) with end-cap ticks.
  The left end is labeled "1837 & earlier" and imposes no lower limit.
  Defaults to the full span ("All years" = show everything); narrowing filters
  to items in range and hides blank-year items. Era titles are clickable and
  snap the range to that era (highlighted as active). Uses `yearMin`/`yearMax` URL
  params; new `src/lib/jewelry-eras.ts` and
  `src/components/shop/ShopYearFilter.tsx`. Pairs with the item-year change
  below — the slider stays empty-on-narrow until years are entered on products.
- **Product Date changed to year made (2026-06-20):** The "Date" field now
  records the year the physical piece was made (e.g. 1930), not the
  listing-creation date. Renamed `products.item_date` → `products.item_year`
  (`smallint`) and `order_items.item_date_snapshot` → `item_year_snapshot`
  across the app; Product Admin Add/Edit is now a year number input
  ("Date (Year Made)"), the admin table still displays/sorts by it, and public
  cards/detail/cart/checkout/invoice show the year under a "Ca." (circa) label
  (internal label stays "Date"). New migration `supabase/product-item-year.sql` drops the old `item_date`
  column (clearing the listing-creation dates backfilled into it); re-run
  `admin-notifications-checkout.sql` afterward for the checkout function. Live
  reads/writes fall back cleanly before the migration is applied.
  Verified with `npx tsc --noEmit`, `npm run lint`, `npm run build`, and an
  in-app browser smoke of `http://127.0.0.1:3000/shop` showing 48 product cards,
  no broken images, no console errors, and no failed-products message before
  the live migration is applied.
- **Customer-facing loaded-block reveal added (2026-06-20):** A shared
  `CustomerReveal` coordinator now applies soft opacity/translate/blur entrance
  reveals to customer-facing localized pages while skipping admin routes.
  Individual blocks wait for their own images, CSS background images, and fonts
  before revealing; large shop gallery parents are excluded so lazy product
  images cannot hold the page hidden. The homepage carousel hero is explicitly
  excluded so its 3D transform geometry, admin-visible-count behavior, and
  centered text/email layout remain unchanged; `HomeHero` now handles its own
  top-down loaded fade after carousel data, visible images, and fonts are ready:
  headline first, carousel second, subscriber/actions last. Mobile menu panels
  also use the same motion language, and reduced-motion/print users skip the
  shared animation. Verified with `npm run lint`, `npm run build`, and browser
  smoke on `/` showing the hero ready state, top/carousel/bottom delays of
  0.08s/0.26s/0.5s, no reveal transform/filter on the hero, centered content, 6
  active carousel slots, 0 broken images, and 0 console errors.
- **Shop gallery loading polish completed (2026-06-20):** `/shop` product
  cards now wait for their cover image to complete before becoming visible, then
  fade in with row-by-row, column-aware stagger timing. The gallery keeps the
  existing responsive column breakpoints and prioritizes the first visible row's
  cover images. Verified with `npx tsc --noEmit`, `npm run lint`,
  `npm run build`, and browser smoke showing 0 broken images and 0 console
  errors.
- **Data/object-storage optimization pass completed (2026-06-20):** Added
  shared product-image storage path parsing, admin-side cleanup for removed,
  replaced, and deleted product images, upload cache-control headers, client
  upload guardrails, and an admin-only dry-run-first Storage GC endpoint/panel.
  The GC route uses the service-role client, reads `products.images`,
  `products.image_urls`, `order_items.image_snapshot`, and
  `inquiries.uploaded_image_urls`, and aborts before object listing/deletion if
  any required reference read fails. Added
  `supabase/storage-gc-service-role-grants.sql`; the grant was applied to the
  live DB before the confirmed cleanup.
- **Storage GC cleanup executed (2026-06-20):** After the service-role grants
  were applied, a dry-run found 293 objects, 202 referenced paths, and 91
  old unreferenced/deletable paths. The 91 deletable objects were archived
  locally first, then deleted with `confirm: true`. A follow-up dry-run reported
  202 objects, 202 referenced paths, 0 orphans, and 0 deletable paths. The
  temporary local archive has since been removed from the repo-ready folder.
- **Upload cap and local image cleanup completed (2026-06-20):** New admin
  upload/crop processing now caps the longest edge at 2048px while preserving
  the existing WebP quality settings. Oversized local PNGs under
  `next-app/public/assets/images` were converted to WebP; page-level references
  now use WebP and their PNG originals were removed. There are currently no PNG
  files under `next-app/public/assets`.
- **Shop image WebP migration completed (2026-06-20):** After
  `supabase/shop-images-png-to-webp.sql` was applied and verified with zero
  remaining `/assets/images/shop/*.png` DB references, the 114 repointed shop
  PNG originals were deleted. WebP siblings remain in
  `next-app/public/assets/images/shop`.
- **Repo-ready cleanup pass completed (2026-06-20):** Removed the generated
  Storage GC archive and shop PNG delete-list JSON from the project folder,
  tightened root ignore rules for build output, caches, logs, env files, and
  one-off cleanup artifacts, and reconciled project memory around the completed
  storage/image work. Two dev-server log files are still present only while the
  current preview process has them locked; they are ignored and should be
  deleted when the preview is stopped.
- **Legacy local image snapshot fallback fixed (2026-06-20):** Browser smoke
  found two broken cart thumbnails from persisted localStorage snapshots that
  still pointed at deleted `/assets/images/shop/*.png` files. Added a narrow
  local image URL normalizer so old cart, wishlist, checkout, account-order,
  order-detail, and invoice-email snapshots resolve those local shop PNG paths
  to their WebP replacements. Follow-up `/shop?itemGroup=jewelry` smoke shows 0
  broken images, 0 shop PNG image sources, and 0 console errors.
- **Order item image snapshot migration applied (2026-06-20):**
  `supabase/order-item-image-snapshots-png-to-webp.sql` was applied in Supabase
  and verified with 0 remaining `/assets/images/shop/*.png` rows in
  `order_items.image_snapshot`. The runtime normalizer remains for browser
  localStorage cart/wishlist snapshots.
- **Rendered mojibake artifact sweep completed (2026-06-20):** Fixed the
  account sign-in password placeholder, auth loading labels, about-page
  Spanish copy, and the admin Quick Fill multiplier parser where accidental
  mojibake characters were present. Source scan across `next-app/src`,
  `next-app/messages`, and `next-app/public` now returns no `â`/`Ã`/`Â`/replacement
  character matches, and `/account/sign-in` smoke shows no artifact characters.
- **Project docs and stale local artifacts swept (2026-06-20):** Reviewed
  Markdown, memory, and agent-facing docs for stale current guidance; refreshed
  `ACCOUNT_SETUP.md`, `next-app/README.md`, `next-app/AGENTS.md`, live pricing
  docs, account docs, and ignore rules. Removed verified redundant root image
  references, the superseded email-marketing handoff, local dev logs, and the
  unused `AdminShell` Quick Fill archive copy after confirming active app assets
  and current documentation already cover those concerns. Historical changelog,
  decisions, and removal-report references were intentionally kept as history.
- **Header hydration mismatch fixed (2026-06-20):** Fixed the Next dev overlay
  on `/shop` caused by the header computing active nav state and alternate
  locale URLs from `/en/...` during server render but `/...` in the browser.
  `SiteHeader` now normalizes both `en` and `es` locale prefixes before
  computing `data-active` and language-switch links. Verified the visible error
  overlay is gone in-browser, and `npm run lint` / `npm run build` pass.
- **Supporting docs refreshed for current Next/Supabase app (2026-06-20):**
  Rewrote stale feature docs that still described the retired static shop,
  static listing workflow, old lead-capture forms, and old `/es/*.html`
  localization model. Updated architecture, structure, integrity, overview, and
  client notes so future agents see the current Next.js route model, Supabase
  products, Supabase Storage image boundary, subscriber/marketing flow, and
  remaining product-image cleanup tasks. No app code was changed.
- **Product image/object-storage audit started (2026-06-20):** Opened the
  local Next preview at `http://127.0.0.1:3000/shop` and audited live product
  image references against Supabase. The `products.images` and
  `products.image_urls` fields contain URL/path strings only, with zero
  `data:`/inline image payloads found across 48 products and 321 entries per
  field. Current live catalog split: 28 products use only Supabase Storage
  image URLs, 19 products still use only local `/assets/...` product images,
  and 1 product mixes both. Supabase Storage bucket `product-images` has 202
  DB-referenced objects under `products/`, all present. The 91 old
  unreferenced objects found by this audit were later archived and deleted
  through the confirmed Storage GC flow.
- **Cufflinks and custom product types enabled (2026-06-19):** Added
  Cufflinks to the shared product type taxonomy, AI listing guidance, admin
  product form, and public shop Item Type filter. Admin Product Type is now a
  combobox that accepts new concise item forms, AI coercion preserves clear
  custom product types instead of forcing them to Other, saved custom product
  types are retained on products/tags, and `/shop` derives extra Item Type
  dropdown choices from visible inventory. Verified Jewelry & Watches shows
  Cufflinks while Sterling Silver remains scoped to All items plus Silverware /
  Sterling, with `npm run lint` and `npm run build` passing.
- **Shop hero copy broadened to precious metals (2026-06-19):** Updated the
  English `/shop` hero from gold-only investment language to precious-metals
  language, including live spot values, exact precious-metal scrap value, and a
  gold-or-silver trade-in offer. Verified rendered copy on `/shop`, plus
  `npm run lint` and `npm run build`.
- **Shop category toggle labels refined (2026-06-19):** Renamed the modern
  shop sidebar category buttons to "Jewelry & Watches" and "Sterling Silver"
  so watches are visibly included with jewelry while the second group calls out
  sterling inventory. The Item Type dropdown now hides Silverware / Sterling
  while Jewelry & Watches is active, keeps it available under Sterling Silver,
  no longer lists Bullion in either item-type menu, and automatically sets
  Metal to Silver when Sterling Silver is selected or directly loaded. The Metal
  and Gender dropdowns are hidden in the Sterling Silver view because Silver and
  All genders are implied, and the Brand dropdown is scoped to the sterling-side
  product set instead of carrying jewelry/watch brands across. Sterling Silver
  also has its own scoped Item Type list with only All items and Silverware /
  Sterling for now. Verified rendered labels/options on `/shop`, plus
  `npm run lint` and `npm run build`.
- **Store chooser and silver-tableware routes removed (2026-06-19):**
  Removed the intermediate `/store` category chooser and the dedicated
  `/silver-tableware` route. Homepage shop CTAs, the header Shop link, and the
  Shop dropdown's Store item now point directly to `/shop` again, and the
  sitemap no longer lists `/store` or `/silver-tableware`. Verified `/shop`
  returns 200, `/store` and `/silver-tableware` return 404, source scans show
  no active links to either removed route, and `npm run lint` / `npm run build`
  pass.
- **Sterling tableware page opened to full catalog browsing (2026-06-19):**
  `/silver-tableware` no longer forces the catalog to Silverware / Sterling and
  Silver after a shopper chooses another category, but a plain visit defaults
  the filters to Silverware / Sterling + Silver. The Item Type dropdown uses a
  tableware-first order on that page: Silverware / Sterling, Bullion, Coins,
  Watches, Brooches, the remaining jewelry types, and All items at the end,
  with `All items` explicitly showing the full catalog. Verified in-browser
  with `/silver-tableware`, `/silver-tableware?itemType=all`, and
  `/silver-tableware?itemType=necklace`, plus `npm run lint` and
  `npm run build`.
- **Sterling tableware hero copy refined (2026-06-19):** Updated
  `/silver-tableware` hero title from "Sterling Tableware Shop" to
  "Sterling Tableware & More" and rewrote the three proof cards around heirloom
  beauty, reasonable prices, and transparent buying. Verified rendered page
  copy in-browser with no horizontal overflow, plus `npm run lint` and
  `npm run build`.
- **Sterling tableware removed from Shop submenu (2026-06-19):** Removed the
  direct Sterling Tableware item from the shared Shop dropdown/mobile submenu
  so shoppers enter that category through `/store` first. The `/store` tile
  still links to `/silver-tableware`, the route remains live/sitemap-listed,
  and the Shop top-level active underline still covers the tableware page.
  Verified in-browser that the dropdown shows only Store and Auctions, the
  Store tile remains active, and `npm run lint` / `npm run build` pass.
- **Live metal spot badges tinted (2026-06-19):** Updated the shared shop
  filter spot-price pills so Silver / oz uses a cool silver-tinted gradient,
  border, and price color while Gold / oz uses a warm gold-tinted gradient,
  border, and price color. Verified on `/silver-tableware` at desktop and
  390px mobile with no horizontal overflow. `npm run lint` and
  `npm run build` pass.
- **Sterling tableware shop route added (2026-06-19):** Added a dedicated
  `/silver-tableware` shop clone that reuses the modern shop renderer and
  initially served the Silverware / Sterling and Silver catalog path. The
  `/store` Sterling Silver Tablewares tile now links to the new
  route instead of showing a disabled coming-soon state, the Shop dropdown and
  sitemap include the route, and the page uses tableware-specific hero copy.
  Verified desktop click-through from `/store`, 390px mobile layout/no
  horizontal overflow, `npm run lint`, and `npm run build`.
- **Unused product types removed (2026-06-19):** Removed Estate Lot, Loose
  Gemstone, and Loose Diamond from the shared product type taxonomy, public shop
  item-type filter, shop URL filter aliases, and AI/admin prompt guidance. A
  source scan confirms no remaining category references; browser verification
  confirms the shop filter no longer shows those options while Silverware /
  Sterling remains. `npm run lint` / `npm run build` pass.
- **Header nav underline animation added (2026-06-19):** Desktop header links
  now animate a fine gold underline from left to right on hover/focus, and the
  underline stays visible on the active route, including dropdown groups such
  as Shop, Sell, and About. Verified `/about` at 1920px with the About link
  active and no horizontal overflow; `npm run lint` / `npm run build` pass.
- **Header anchored to viewport edges (2026-06-19):** Removed the centered
  `1440px` desktop rail from the shared `SiteHeader` so the left brand/nav
  cluster and right action/call cluster anchor to the user's viewport edges on
  wide screens. Verified at 1920px desktop and 390px mobile with no horizontal
  overflow, and `npm run lint` / `npm run build` pass.
- **Marketing campaign sender profiles added (2026-06-19):** `/admin/marketing`
  now lets admins choose between a Chris reply-enabled sender and a no-reply
  sender. The default is `Chris at Naples Estate Jewelry
  <chris@naplesestatejewelry.co>` with `Reply-To:
  chris@naplesestatejewelry.co`, so recipients can reply directly. Send Test
  and Send Campaign both honor the selected sender, campaign history shows a
  Sender column, and `supabase/email-marketing.sql` now includes optional
  sender metadata columns for campaign audit records. Verified in-browser, and
  `npm run lint` / `npm run build` pass.
- **Admin manual subscriber source label fixed (2026-06-19):** The marketing
  audience builder now carries the original `homepage_subscribers.source`
  through to `/admin/subscribers`, so manually-added rows display as
  "Admin manual" instead of the generic "Newsletter subscriber" label. Verified
  Yisel's row in-browser, and `npm run lint` / `npm run build` pass.
- **Admin manual subscriber add added (2026-06-19):** `/admin/subscribers`
  now includes an Add Subscriber form where admins can manually add a newsletter
  recipient by name and email. Added an admin-gated POST path to
  `/api/admin/subscribers`, storing rows in `homepage_subscribers` with
  `source = 'admin_manual'`, and updated the email marketing SQL service-role
  grant for insert/delete support. Verified in-browser, and `npm run lint` /
  `npm run build` pass.
- **Marketing campaign history delete + wider desktop view added (2026-06-19):**
  `/admin/marketing` now uses a wider 1800px admin content container on
  widescreen desktops, adds an Actions column to campaign history, and lets
  admins delete individual campaign history records through a confirmed,
  admin-gated API route. Deleting a campaign also removes related send/event
  analytics through the existing cascade relationships. Verified in-browser,
  and `npm run lint` / `npm run build` pass.
- **Lint warnings cleaned up (2026-06-19):** Removed the four remaining ESLint
  warnings by adding `display=optional` and a documented exception for the
  Material Symbols icon stylesheet, and replacing the last raw admin modal/crop
  images with `next/image`. `npm run lint` now reports no warnings or errors,
  and `npm run build` passes.
- **Marketing email preview window added (2026-06-19):** The
  `/admin/marketing` composer now has a Preview Email button that opens a
  compact dialog with an iframe-rendered preview of the campaign HTML plus the
  same unsubscribe/mailing-address footer used for real sends. The preview can
  be closed with the Close button, Escape, or the backdrop. Verified in-browser,
  and `npm run lint` / `npm run build` pass.
- **Marketing campaign analytics added (2026-06-19):** The existing
  `/admin/marketing` campaign history table now aggregates recorded Resend
  webhook events from `email_campaign_events` and displays delivered, opens,
  clicks, bounces, complaints, latest event time, and rates/recorded click URL
  counts beside each campaign. Verified the updated admin page in the in-app
  browser, and `npm run lint` / `npm run build` pass.
- **Email marketing opt-out model implemented (2026-06-19):** Implemented the
  email-marketing opt-out recommendation. Account holders are
  included by default unless `marketing_opt_out = true`; newsletter subscribers
  remain explicit opt-in. Added `/admin/marketing`, campaign send/test APIs,
  centralized audience building, editable Admin Settings mailing address,
  unsubscribe suppression for subscribers and accounts, Resend webhook event
  handling, and `supabase/email-marketing.sql`.
- **Admin subscribers live-schema mismatch fixed (2026-06-19):** Updated the
  marketing audience builder so `/admin/subscribers` works against older live
  `homepage_subscribers` tables that do not yet have `subscribed` or
  `unsubscribed_at`. The updated SQL migration now adds those compatibility
  columns and service-role grants. Verified the red SQL warning is gone in the
  in-app browser and `npm run build` passes.
- **Marketing audience count preview added (2026-06-19):** The admin email
  campaign composer now previews counts for combined audience, newsletter-only,
  and account-holder-only scopes, and mirrors those counts in the Audience
  dropdown labels. Verified `/admin/marketing` in the in-app browser and
  `npm run build` passes.
- **Subscriber management controls added (2026-06-19):** `/admin/subscribers`
  now lets admins copy all reachable email addresses and edit/delete newsletter
  subscriber records. Account-holder-only audience rows remain read-only to avoid
  changing account profiles from the subscriber table. Verified controls in the
  in-app browser and `npm run build` passes.
- **Marketing campaign button feedback fixed (2026-06-19):** The admin campaign
  composer no longer leaves Send Test/Send Campaign silently disabled for
  missing subject/body/address/recipient requirements. Buttons now remain
  clickable when idle and show a visible validation message before any send is
  attempted. Verified the in-app browser shows "Add a subject before sending."
  on an incomplete Send Test click, and `npm run build` passes.
- **Marketing short subject/body validation fixed (2026-06-19):** Relaxed admin
  marketing campaign validation from hidden 3-character subject/10-character
  body minimums to simple non-empty checks. Verified in-browser that subject
  `hi` and body `hi` no longer trigger the subject validation and Send Test
  succeeds. `npm run build` passes.
- **Carousel lint blocker fixed (2026-06-19):** Updated
  `next-app/carousel/components/Carousel.tsx` so latest-value refs are updated
  from effects instead of during render, and reset window state is derived from
  the current data/window key instead of synchronously setting state in the reset
  effect. `npm run lint` now passes with only existing non-blocking warnings,
  and `npm run build` passes.
- **Marketing campaign success confirmation added (2026-06-19):** A successful
  real campaign send now shows a prominent "Campaign Sent Successfully" panel
  with subject, audience scope, sent/failed/total counts, and campaign ID. Build
  and lint pass; lint has warnings only.
- **Public square-layout audit completed (2026-06-19):** Audited the public
  site for leftover sharp/square legacy surfaces after the Sell/contact
  modernization. Rounded remaining public-facing items across About, Free
  Evaluation, Estate Services, FAQ, Store, Shop, product detail placeholders,
  wishlist placeholders, account/auth controls, header menus, shop filters, and
  pagination. Source scan now finds no public `rounded-sm`, old gradient CTA,
  emoji photo/check placeholders, or 6px/8px scoped radii; remaining matches are
  admin-only internal UI. Browser-computed checks at 390px confirmed the
  previously flagged `/shop` and `/account/sign-up` surfaces are clean. `npm run
  build` passes; `npm run lint` remains blocked only by existing carousel
  ref/purity errors in `next-app/carousel/components/Carousel.tsx`.
- **Contact and Sell-category surfaces modernized (2026-06-19):** Applied the
  rounded, lighter shop-page aesthetic to `ContactForm`, `InquiryForm`,
  `EvalForm`, and the primary Sell pages: `/estate-jewelry`, `/gold-services`,
  `/silver-services`, and `/bullion`. Replaced older square cards, upload
  boxes, chart panels, CTA buttons, and emoji/glyph icons with rounded cards,
  softer borders/shadows, pill actions, and modern SVG/material icons. Verified
  the targeted pages at 390px mobile and 1280px desktop: no leftover
  `rounded-sm`/old gradient CTA patterns in the target set and no horizontal
  overflow. `npm run build` passes; `npm run lint` remains blocked only by
  existing carousel ref/purity errors in
  `next-app/carousel/components/Carousel.tsx`.
- **About Google review CTA artifacts fixed (2026-06-19):** Replaced the
  mojibake star/external-link glyphs around the About page Google review CTA
  with clean text and an ASCII arrow (`->`). Verified `/about` rendered HTML no
  longer contains the broken `â˜…` or `â†—` artifacts, the Google review label
  remains, and `npm run build` passes. `npm run lint` remains blocked only by
  existing carousel ref/purity errors in
  `next-app/carousel/components/Carousel.tsx`.
- **Legal/cookie surfaces modernized (2026-06-19):** Updated sharp square
  policy/cookie UI to better match the rounded, lighter shop aesthetic. Shared
  `gold-button`, `outline-button`, and form radius now use softer rounded/pill
  styling; `LegalPolicyPage` uses rounded white policy cards with subtle
  shadows, numbered chips, custom bullet dots, and a pill Back to Home action;
  `CookiePreferencesClient` and `CookieNotice` use rounded translucent cards
  with softer borders/shadows. Verified `/cookie-preferences` at desktop width:
  policy card and preference card compute 16px radius, Back to Home computes
  999px radius, and there is no horizontal overflow. `npm run build` passes;
  `npm run lint` remains blocked only by existing carousel ref/purity errors in
  `next-app/carousel/components/Carousel.tsx`.
- **About page process/showroom section removed (2026-06-19):** Removed the
  full About page "How It Works" section, including Competitive Offers,
  Initial Consultation, On-Site Evaluation, Immediate Offers & Payment, and the
  imagined no-storefront showroom image/copy. The page now flows from Meet
  Chris directly to the final contact CTA. Verified `/about` returns 200, the
  removed text is absent from rendered HTML, and the final CTA remains. `npm
  run build` passes; `npm run lint` remains blocked only by existing carousel
  ref/purity errors in `next-app/carousel/components/Carousel.tsx`.
- **Homepage service strip icons redesigned (2026-06-19):** Replaced the
  emoji-style icons in the homepage We Buy Gold / We Sell Jewelry / Direct
  Contact strip with a custom client-rendered HTML canvas icon component for
  gold, jewelry, and direct contact. Refined the strip spacing and column
  dividers for a more modern editorial feel. Verified desktop and 390px mobile:
  three 64px canvases render, no emoji text remains in the section, and there
  is no horizontal overflow. `npm run build` passes; `npm run lint` remains
  blocked only by existing carousel ref/purity errors in
  `next-app/carousel/components/Carousel.tsx`.
- **Store mobile hero image shortened/zoomed out (2026-06-19):** Reduced the
  `/store` hero image's mobile-only fixed height from `36rem` to `30rem`, which
  backs off the object-cover crop and shortens the page while preserving
  tablet/desktop image sizing. Verified at 390px: image/section height is 480px,
  page height is 901px, and there is no horizontal overflow. `npm run build`
  passes; `npm run lint` remains blocked only by existing carousel ref/purity
  errors in `next-app/carousel/components/Carousel.tsx`.
- **Store mobile footer legal columns centered (2026-06-19):** Centered the
  mobile Legal two-column footer links within each column while preserving
  desktop left alignment. Verified `/store` at 390px: all Legal links compute
  `text-align: center`/`justify-self: center`, no horizontal overflow, and
  mobile footer height remains about 357px. `npm run build` passes; `npm run
  lint` remains blocked only by existing carousel ref/purity errors in
  `next-app/carousel/components/Carousel.tsx`.
- **Store mobile footer shortened again (2026-06-19):** Reworked the remaining
  mobile footer links so Company is a compact three-link row, Legal is a
  smaller two-column list, and footer padding/bottom-bar spacing are tighter.
  Verified `/store` at 390px with no horizontal overflow; mobile footer height
  is now about 357px. `npm run build` passes; `npm run lint` remains blocked
  only by existing carousel ref/purity errors in
  `next-app/carousel/components/Carousel.tsx`.
- **Store mobile footer Company/Legal reorganized (2026-06-19):** Adjusted the
  mobile footer after removing the Shop group so Company reads as a centered
  vertical list and Legal reads as a clearer two-column list instead of a dense
  multi-column grid. Verified `/store` at 390px with no horizontal overflow and
  `npm run build`; `npm run lint` remains blocked only by existing carousel
  ref/purity errors in `next-app/carousel/components/Carousel.tsx`.
- **Store mobile footer Shop links removed (2026-06-19):** Hid the shared
  footer's Shop link group on mobile so `/store` no longer shows Gold Jewelry,
  Silver Jewelry, All Items, Free Evaluation, or Gold Services in the mobile
  footer. Desktop footer still keeps the Shop group. Verified 390px mobile
  removal/no overflow, desktop Shop link presence, and `npm run build`; `npm run
  lint` remains blocked only by existing carousel ref/purity errors in
  `next-app/carousel/components/Carousel.tsx`.
- **Store mobile footer compacted further (2026-06-19):** Tightened the shared
  `SiteFooter` mobile layout used on `/store` by reducing mobile padding,
  type, gaps, bottom-bar spacing, and packing Shop/Company/Legal links into
  denser mobile grids while preserving desktop footer layout. Verified `/store`
  at 390px in-browser with no horizontal overflow and `npm run build`; `npm run
  lint` remains blocked only by existing carousel ref/purity errors in
  `next-app/carousel/components/Carousel.tsx`.
- **Store Browse Jewelry CTA redesigned (2026-06-19):** Replaced the dated
  heavy gold rectangular `Browse Jewelry >` button inside the `/store` Estate
  Jewelry tile with a lighter rounded editorial CTA: white/glass surface, fine
  gold border, uppercase label, and a small gold circular arrow. Verified at
  390px and desktop widths that the CTA stays inside the tile with no
  horizontal overflow. `npm run build` passes; `npm run lint` remains blocked
  only by existing carousel ref/purity errors in
  `next-app/carousel/components/Carousel.tsx`.
- **Sign-in mobile background image removed (2026-06-19):** The sign-in page
  keeps its jewelry background image on desktop, but mobile now uses a plain
  white background behind the top-aligned auth card. Verified at 390px that
  `background-image` is `none`, card top remains 80px, and there is no
  horizontal overflow. `npm run build` passes; `npm run lint` remains blocked
  only by existing carousel ref/purity errors in
  `next-app/carousel/components/Carousel.tsx`.
- **Mobile auth pages top-aligned (2026-06-19):** The account sign-up and
  sign-in pages no longer vertically center their cards on mobile. Mobile now
  top-aligns the forms directly below the fixed header with tighter card
  padding, removing the large blank space above the form while preserving
  desktop centering. Verified `/account/sign-up` and `/account/sign-in` at
  390px in-browser with no horizontal overflow, plus `npm run build`. `npm run
  lint` remains blocked only by existing carousel ref/purity errors in
  `next-app/carousel/components/Carousel.tsx`.
- **Account sign-up password visibility toggles added (2026-06-19):** Password
  and Confirm Password now each have independent Show/Hide controls with
  `aria-label` and `aria-pressed`, preserving typed values and the existing
  password-match/minimum-length/Terms consent behavior. Verified desktop
  rendering, independent toggles, mismatch blocking, a matching-password
  Supabase signup success path, and 390px mobile layout. `npm run build`
  passes; `npm run lint` remains blocked only by existing carousel ref/purity
  errors in `next-app/carousel/components/Carousel.tsx`.
- **Account sign-up password confirmation added (2026-06-19):** The account
  registration form now asks shoppers to enter their desired password twice and
  blocks signup client-side with `Passwords do not match.` before calling
  Supabase if the two entries differ. Verified in-browser on
  `/account/sign-up`, plus `npm run build`. `npm run lint` remains blocked only
  by existing carousel ref/purity errors in
  `next-app/carousel/components/Carousel.tsx`.
- **Compliance foundation implemented (2026-06-19):** Added a small-business
  website compliance baseline across the Next app: expanded Privacy Policy,
  Terms of Service, Cookie Preferences, Accessibility Statement, Returns &
  Refunds, Shipping Policy, Auction Terms, Vendor Terms, and Unsubscribe pages.
  Updated the shared footer with legal links, added an essential cookie/storage
  notice, added form privacy disclosures, linked checkout/payment to ecommerce
  policies, required one Terms/Privacy consent checkbox during account registration,
  and added `/api/unsubscribe`. Added `supabase/compliance-consent.sql` plus
  subscriber unsubscribe/status updates in `supabase/homepage-subscribers.sql`.
  Added `project-docs/COMPLIANCE_AUDIT.md`. Verified `npm run build`; `npm run
  lint` remains blocked only by existing carousel ref/purity errors in
  `next-app/carousel/components/Carousel.tsx`.
- **Shared mobile footer reformatted (2026-06-18):** Reworked the shared
  `SiteFooter` mobile layout only: brand/contact now spans the full width and
  centers, Shop and Company links sit in two compact mobile columns, phone is a
  tappable button, and the legal/domain bottom bar wraps cleanly without
  horizontal overflow. This affects all pages using the shared footer while
  preserving the desktop three-column footer. Verified `/store` at 390px
  in-browser and `npm run build`; `npm run lint` remains blocked by existing
  carousel ref/purity errors in `next-app/carousel/components/Carousel.tsx`.
- **Store category chooser simplified to two hero buttons (2026-06-18):** The
  `/store` hero no longer has separate prompt/headline/body text. The page now
  centers two large square overlay controls over the main store image, spaced
  left and right: Estate Jewelry links to `/shop`, while Sterling Silver
  Tablewares remains disabled/coming soon. The buttons use layered drop shadows,
  inner bevels, and highlight bands for a subtle 3D effect. Mobile uses a taller
  cropped hero image and locked square button dimensions; verified desktop and
  390px mobile in-browser, plus `npm run build`. `npm run lint` remains blocked
  by existing carousel ref/purity errors in
  `next-app/carousel/components/Carousel.tsx`.
- **Carousel hero rebuilt on the home page (2026-06-18):** Moved the 3D carousel
  from `/store` to the home hero (replacing the MP4 video; `/store` is now a static
  category chooser). Made it windowed/infinite (admin-set cards-visible, separate
  desktop/mobile), added per-photo White/Black groups driving a swept hero
  background with matching text-theme flip, `next/image` optimization + off-screen
  preloading, and offscreen pause. New columns `carousel_selection.bg_color`,
  `carousel_settings.visible_count`/`visible_count_mobile` (migrations under
  `next-app/carousel/sql/`; reads/writes degrade gracefully until run). Details in
  `project-docs/features/carousel-hero.md`.
- **AI listing-assistant prompt made editable (2026-06-18):** The
  `/admin/settings` prompt editor now controls the real extraction system
  prompt instead of the leftover (disabled) Quick Fill prompt. Edits save to a
  single-row `ai_settings` table through the admin-gated
  `/api/admin/ai-settings` route and are applied per request by the
  `ai-product-fill` route; the built-in default in `ai-product-provider.ts` is
  used whenever no override is stored. The panel shows a Custom/Default badge
  and an Edit → Save / Reset Default flow. Verified prompt load/render and
  graceful save-failure messaging in-browser, plus `tsc` and `eslint`. Live
  saves require running `next-app/sql/ai-settings-setup.sql` in Supabase.
- **Header Shop/Store links routed through `/store` (2026-06-18):** The site
  header's Shop link and Store dropdown item now point to the `/store` category
  landing page (matching the homepage hero) instead of jumping to `/shop`.
- **Store Carousel admin controls added (2026-06-18):** Admin Settings now has
  a `Store Carousel Hero` section below the Quick Fill AI prompt. It loads
  available products through the supplied carousel helpers, supports search,
  add/remove selection, ordered up/down controls, black/white background
  choices, a show-price toggle, save, and a compact live preview. The `/store`
  hero now reads saved carousel selection/settings on the client and falls back
  to the previous hardcoded hero items if the carousel tables are not installed
  or no items are selected. The store hero adapts text and edge fades for black
  backgrounds. Updated the supplied carousel route mapping to `/shop/{id}` and
  changed the carousel helper to use the app Supabase browser client/session.
  Verified Admin Settings form rendering/selection state, `/store` fallback
  rendering, `npm run lint`, and `npm run build`. The live database still needs
  `next-app/carousel/sql/setup.sql` run before saves can persist.
- **Admin product table Link Type column added (2026-06-18):** The main
  Product Admin table now shows a sortable `Link Type` column on extra-wide
  desktop layouts, using the existing product `chain_type`/link-type value. The
  column stays hidden below the `2xl` breakpoint so the regular admin table
  width is not made more cramped. Verified `/admin` at wide and standard
  desktop widths, `npm run lint`, and `npm run build`.
- **Homepage-only loading fallback scoped (2026-06-18):** Moved the localized
  homepage route and loading fallback into `next-app/src/app/[locale]/(home)/`
  so the branded `NaplesEstateJewelry.co` loading screen only wraps the
  homepage route instead of every localized internal page. Internal navigation
  to routes such as `/store` no longer shows the site loading screen. Verified
  `/store` and `/` in-browser, `npm run lint`, and `npm run build`.
- **Store Carousel hero added (2026-06-18):** The `/store` page now uses the
  supplied `next-app/carousel` Carousel widget as the main first-viewport hero.
  The carousel animation/rendering engine remains intact; the store page passes
  local shop/page image variables directly as `CarouselItem`s, keeps prices off,
  and sizes the hero to fill the detected screen under the header. The chooser
  cards remain below the hero. Added narrow TypeScript casts in the carousel
  data helper so the supplied Supabase join helpers type-check when imported by
  the app. Desktop presentation zooms the hero carousel larger and lets cards
  travel beyond the viewport edge, while mobile now uses proportional card and
  perspective settings for a similar close-up experience. The carousel no
  longer pauses on hover, and both desktop/mobile use a light edge fade so cards
  disappear slightly as they reach the viewport edge. The hero heading group is
  positioned higher so the category prompt sits in the open space above the
  carousel. Added foggy white edge overlays on the far left and right to echo
  the original widget fade treatment. Verified `/store` desktop and 390px
  mobile layout, 8 hero images, continuous 32s animation, no horizontal
  overflow, `npm run lint`, and `npm run build`.
- **Store chooser page added (2026-06-18):** Added a localized `/store`
  intermediate page between homepage shopping CTAs and the live `/shop`
  catalog. The page presents an active Estate Jewelry Shop choice plus a
  disabled Sterling Silver Tablewares placeholder for a future category.
  Homepage Buy/Browse Shop links now route to `/store`, while existing cart,
  account, header, footer, and product flows still point directly to `/shop`.
  Added `/store` to the sitemap. Verified `/store`, homepage CTA hrefs,
  390px mobile layout, `npm run lint`, and `npm run build`.
- **Branded route loading screen refined (2026-06-18):** Localized site routes
  now have a dark, centered `NaplesEstateJewelry.co` loading fallback with
  classy supporting text and an animated gold wheel, without the older logo
  image or off-white background. The loading brand now uses a clean mobile
  break point plus responsive title/spinner sizing so it does not overflow on
  narrow phones. The temporary local `/loading-preview` review route has been
  removed now that the screen is approved. Verified in-browser at 320px and
  390px, `npm run lint`, and `npm run build`.
- **Customer order item metadata cleaned up (2026-06-18):** Account order
  detail item rows no longer expose slug-like product ids in the subtext.
  Buyer-visible metadata now shows inventory as its own `Inv #...` chip,
  formats gold purity values as `14K`/`18K`, and keeps metal/weight specs.
  Account orders enrich older slug snapshots from live product inventory
  numbers when possible. Verified `/account?tab=orders` in-browser,
  `npm run lint`, and `npm run build`.
- **Shop mobile top controls reduced (2026-06-18):** Product-card Available
  flags and favorites icons now use smaller mobile-only sizing, with the badge
  around 12px tall and the heart button around 22px square at 390px. Verified
  `/shop` at 390px, `npm run lint`, and `npm run build`.
- **Shop mobile Add button shortened (2026-06-18):** On thin mobile shop
  screens, product-card Add buttons now use less vertical padding, a smaller
  icon, and reduced action-row top spacing so the three-across cards are more
  compact. Verified `/shop` at 390px, `npm run lint`, and `npm run build`.
- **Admin mobile photo reorder controls added (2026-06-18):** The add/edit
  product photo gallery now includes tap-friendly previous/next reorder
  buttons on every thumbnail, so mobile admins can reorder photos without
  dragging. Drag reorder remains available on desktop. Verified in-browser at
  390px without saving, `npm run lint`, and `npm run build`.
- **Shop mobile card arrows reduced (2026-06-18):** Product-card image
  carousel arrows now use a smaller mobile-only treatment, rendering at about
  18px square with a lighter shadow in the three-across gallery. Desktop arrow
  sizing is unchanged. Verified `/shop` at 390px, `npm run lint`, and
  `npm run build`.
- **Shop price range filter added (2026-06-18):** The shop filter panel now
  includes a two-handle price slider with editable min/max fields. Price
  filtering uses the same displayed product price basis as sorting, updates
  `priceMin`/`priceMax` URL params, resets pagination, and works on desktop
  and mobile. Verified `/shop?priceMin=1000&priceMax=2500`, mobile 390px,
  `npm run lint`, and `npm run build`.
- **Shop mobile item flags reduced (2026-06-18):** Brand and link-type flags
  on mobile shop gallery cards now use smaller type, tighter padding, shorter
  height, and lighter shadows so they fit better in the three-across card grid.
  Longer individual flags now step down again so labels such as
  `Anchor / Gucci link` fit fully without clipping. Verified
  `/shop?itemType=necklace` at 390px, `npm run lint`, and `npm run build`.
- **Account order item product links added (2026-06-18):** Customer account
  order detail items now link to the matching public product detail page when
  a product id is available. Product pages accept safe account order return
  paths and show `Back to Orders` when opened from account order history.
  Verified `/account?tab=orders` in-browser, `npm run lint`, and
  `npm run build`.
- **Shop link-type flag compacted (2026-06-18):** Link-type fallback flags on
  gallery cards now use a shorter, more compact badge treatment in the
  lower-left image corner, while brand flags keep their taller gold-tinted
  styling. Verified `/shop?itemType=necklace` at desktop and mobile widths,
  `npm run lint`, and `npm run build`.
- **Shop gallery brand/link flag styles separated (2026-06-18):** Brand flags
  keep the newer gold-tinted styling, while link-type fallback flags now use
  the quieter plain flag style so shoppers can distinguish makers from link
  styles. Verified `/shop?itemType=necklace` in-browser, `npm run lint`, and
  `npm run build`.
- **Shop Link Type filter repositioned (2026-06-18):** When Item Type is
  Necklace or Bracelet, the conditional Link Type dropdown now appears directly
  after Item Type in the shop filter grid instead of lower in the panel.
  Verified `/shop?itemType=necklace` in-browser, `npm run lint`, and
  `npm run build`.
- **Shop gallery flag fallback added (2026-06-18):** Product-card image flags
  still prefer Brand, but unbranded necklaces and bracelets now show the
  product link type in the same flag area. Verified `/shop?itemType=necklace`
  and `/shop?itemType=bracelet` in-browser, `npm run lint`, and
  `npm run build`.
- **Shop mobile status tag reduced (2026-06-18):** The Available/Sold status
  badge on shop gallery cards now has a smaller mobile-only treatment so it
  takes less photo space in the three-across mobile grid. Desktop card badges
  keep their previous size. Verified `/shop` at 390px, `npm run lint`, and
  `npm run build`.
- **Shop gallery brand tag styling refined (2026-06-18):** Product-card brand
  tags now use a warmer gold-tinted gradient, stronger gold border, bolder
  lettering, and a subtle shadow/highlight so they read more clearly without
  overpowering product photos. Verified `/shop` in-browser, `npm run lint`, and
  `npm run build`.
- **Shop mobile card spec chips compacted (2026-06-18):** Mobile shop card
  purity/weight/length chips now use compact labels so dense three-across
  cards do not overflow. Weights over 10g show at most one decimal, silver
  purity chips use `925`, ring sizes omit the `Size:` prefix, and fractional
  inch lengths use shorter card labels. Verified `/shop` at 390px with no
  spec-chip overflow, plus `npm run lint` and `npm run build`.
- **Shop mobile gallery changed to three across (2026-06-18):** The mobile
  shop product grid now renders three smaller cards per row with tighter
  mobile gaps. Verified `/shop` at 360px, 390px, and 430px browser viewports,
  including a 390px screenshot check, plus `npm run lint` and
  `npm run build`.
- **Shop gallery widescreen grid expanded (2026-06-18):** The desktop shop
  gallery now follows wider windows more closely: 4 columns around 1440px,
  5 columns around 1800px, 6 columns around 2048px, and 7 columns on very wide
  2400px+ viewports. The shop shell now expands up to 2400px and card image
  size hints were updated for the denser grid. Verified `/shop` with temporary
  browser viewport measurements, `npm run lint`, and `npm run build`.
- **Shop gallery brand image tags added (2026-06-18):** Product cards now show
  a small brand tag in the lower-left of the first preview image when a product
  has a Brand value. The tag hides after moving to another preview image and is
  faded while the desktop title tooltip or image-arrow focus/hover is active.
  Verified `/shop` in-browser, `npm run lint`, and `npm run build`.
- **Admin order line discounts added (2026-06-18):** Manual custom orders can
  now capture a per-item Line Discount in addition to the order-level discount.
  Existing order detail pages expose editable per-line discounts, recalculate
  order totals/tax, and the Email Invoice preview/send flow uses the same
  adjusted line totals with original price and discount shown. Added
  `supabase/order-item-line-discounts.sql` for the required
  `order_items.discount` column. Verified in-browser without saving/sending,
  `npm run lint`, and `npm run build`.
- **Invoice email item thumbnails added (2026-06-18):** The Email Invoice
  preview and sent customer email now include small product thumbnails in the
  itemized breakdown when order item image snapshots are available. Relative
  local image paths are expanded to absolute site URLs for email delivery.
  Verified in-browser preview, `npm run lint`, and `npm run build`.
- **Admin order Reopen Order action added (2026-06-18):** Cancelled order
  detail pages now show `Reopen Order` in the top action bar instead of
  `Cancel Order`. Reopening restores `order_status` to `open` and
  `fulfillment_status` to `pending`; unpaid orders also return linked products
  to `pending_payment`, while paid order products remain sold for review.
  Verified in-browser button visibility, `npm run lint`, and `npm run build`;
  the action was not clicked to avoid mutating the live order.
- **Admin order item product links fixed (2026-06-18):** The `Open` links in
  the order detail item table now navigate to the matching public product
  detail page instead of the admin product table query. Product detail pages
  accept a safe admin `returnTo` path and show a top-left `Back to Admin` link
  that returns directly to the originating order detail page. Verified
  in-browser, `npm run lint`, and `npm run build`.
- **Admin order Email Invoice send flow added (2026-06-18):** Order detail
  pages now include an `Email Invoice` action beside the status buttons. It
  opens a modal with a top-right close X, prefilled editable customer email,
  subject preview, formatted itemized/totals preview, and a `Send Invoice
  Email` action. Preview and sent HTML/text are built from the shared
  `order-invoice-email` helper, and the send action posts to a protected admin
  Resend route. Verified in-browser without sending a real email,
  `npm run lint`, and `npm run build`.
- **Admin manual-order shipping fields labeled (2026-06-18):** The Create
  Manual Order modal now uses visible labels for Delivery Method, Shipping Fee,
  Discount, and all shipping address fields, removing the confusing unlabeled
  zero-value boxes. Verified desktop and mobile modal behavior in-browser,
  `npm run lint`, and `npm run build`.
- **Admin manual-order product picker changed to search (2026-06-18):** The
  Create Manual Order modal no longer renders the full available-products list.
  Admins now search by inventory number, SKU/id, or product title and choose
  matching results from a dropdown, with selected products shown in a compact
  removable list. The search field now also includes a right-side arrow for
  intentionally opening the full available-products dropdown when needed,
  while typing continues to show filtered matches. Verified desktop and mobile
  modal behavior in-browser, `npm run lint`, and `npm run build`.
- **Admin Orders mobile layout reformatted (2026-06-18):** The admin Orders
  page now uses stacked mobile order cards instead of a horizontally scrolling
  wide table on small screens. Mobile filters are grouped in a white panel,
  each card exposes customer, item, status, total, and a full-width View Order
  action, and the Create Manual Order modal now keeps product titles and prices
  readable on phones. Desktop keeps the existing table. Verified in-browser
  mobile view, `npm run lint`, and `npm run build`.
- **Product Admin padding modal Close action added (2026-06-17):** The Image
  Padding modal footer now has a clear gold `Close` button for finishing the
  per-photo padding workflow. Verified `npm run lint` and `npm run build`.
- **Product Admin selected-photo eyedropper fixed (2026-06-17):** The Pad
  modal's `Pick From Selected Photo` action now opens the browser eyedropper
  immediately from the click and saves against a ref-backed selected photo
  index, so photos beyond the first no longer fall back to photo 1. Verified
  `npm run lint` and `npm run build`.
- **Product detail gallery arrow icon centering fixed (2026-06-17):** The
  left/right circular image navigation controls now wrap the Material Symbols
  chevrons in a separate centered glyph span so the arrows align visually in
  the middle of the circle. Verified `npm run lint` and `npm run build`.
- **Product Admin per-photo image padding added (2026-06-17):** The Product
  Admin table Pad modal now lets admins select any product photo and apply
  No/White/Black/custom sampled padding to that specific image. The storefront
  product gallery, shop cards, cart/wishlist payloads, and checkout/saved-item
  thumbnails resolve padding per image with the existing product-level
  `image_padding` as a fallback. Added `products.image_padding_by_image` to the
  product image-padding SQL. Verified `npm run lint` and `npm run build`; live
  in-browser admin interaction was blocked by sign-in in this session.
- **Product detail gallery arrows suppress zoom (2026-06-17):** Hovering or
  pressing inside the product detail image edge-arrow zones now closes the
  magnifier and prevents it from reopening over the arrow controls, while the
  arrows remain clickable for image navigation. Verified in-browser,
  `npm run lint`, and `npm run build`.
- **Product image padding now follows cart/saved thumbnails (2026-06-17):**
  Cart and wishlist item payloads now carry `image_padding`, older local cart
  and wishlist entries hydrate missing padding from Supabase, and cart drawer,
  checkout summary, saved-items drawer, and account wishlist thumbnails use the
  same padded image-frame background as shop/product detail images. Verified
  cart and checkout in-browser, `npm run lint`, and `npm run build`.
- **Product detail gallery carousel controls added (2026-06-17):** Product
  detail main images now support left/right edge clicks to move through photos,
  and the thumbnail strip is centered below the main image with previous/next
  arrow controls. The active image remains in the center thumbnail slot as the
  lineup wraps through the product photos. Verified in-browser,
  `npm run lint`, and `npm run build`.
- **Gold services Dental Gold image added (2026-06-17):** The Gold Services
  `Dental Gold` acquisition card now uses the new `dental.webp` asset, served
  from `next-app/public/assets/images/pages/dental.webp`. Verified in-browser,
  `npm run lint`, and `npm run build`.
- **Gold services Scrap & Broken image added (2026-06-17):** The Gold Services
  `Scrap & Broken` acquisition card now uses the new `scrap.jpg` asset, served
  from `next-app/public/assets/images/pages/scrap.jpg`. Verified in-browser,
  `npm run lint`, and `npm run build`.
- **Gold services Fine Jewelry image swapped (2026-06-17):** The Gold Services
  `Fine Jewelry` acquisition card now uses the new `gold.png` asset, served
  from `next-app/public/assets/images/pages/gold.png`. Verified in-browser,
  `npm run lint`, and `npm run build`.
- **Gold services Items We Acquire moved up (2026-06-17):** The Gold Services
  `Items We Acquire` section now appears directly below the Current Gold Spot
  Price block and before Decoding Gold Markings. Verified in-browser,
  `npm run lint`, and `npm run build`.
- **Login hero background image added (2026-06-17):** The account sign-in page
  now uses `login.png` as a full-page jewelry/silverware hero background with a
  soft white overlay behind the auth card. The image is served from
  `next-app/public/assets/images/pages/login.png`. Verified in-browser,
  `npm run lint`, and `npm run build`.
- **Gold buttons brightened site-wide (2026-06-17):** Shared `.gold-button`
  CTAs, outline-button hover fills, shop pagination active state, account tab
  active states, and hardcoded service-page CTA backgrounds now use the brighter
  Call Now gold gradient instead of the older dark-gold fill. Verified
  in-browser, `npm run lint`, and `npm run build`.
- **Shop pagination modernized (2026-06-17):** The bottom shop pagination and
  per-page controls now render as a white modern toolbar with compact page
  controls, icon chevrons, active-page emphasis, result count, and a cleaner
  per-page selector. Verified in-browser, `npm run lint`, and `npm run build`.
- **Account overview sign-out button added (2026-06-17):** The My Account
  overview heading block now has a right-aligned Sign Out button in the desktop
  blank space, stacking full-width on small screens. Verified in-browser,
  `npm run lint`, and `npm run build`.
- **Shop background changed to white (2026-06-17):** The modern `/shop` page
  main background now uses plain white instead of the prior warm off-white
  gradient. The shop filter sidebar, its inputs/selects, and the My Account
  page/form/auth surfaces now use true white as well, while preserving existing
  borders, shadows, hero imagery, and product card styling. Verified
  in-browser, `npm run lint`, and `npm run build`.
- **Checkout and cart drawer modernized (2026-06-17):** Checkout now uses an
  account-page-inspired dashboard layout with a full-width top Order Summary,
  complete product titles, clearer prices, brief item descriptions, and the
  name/phone/contact form below. Cart items now carry optional descriptions,
  checkout enriches older cart rows from Supabase when needed, and the cart
  drawer was restyled as a wider modern white/gold side panel with card-like
  item rows, larger images, descriptions, and clearer totals/actions. Verified
  in-browser, `npm run lint`, and `npm run build`. The expanded checkout Order
  Summary later isolated each item price into its own right-side Price column,
  then centered the label/value inside a framed price block. The item rows were
  then tightened with smaller thumbnails, a one-line description, and a
  one-line specs strip for values such as purity, metal color, product type,
  link type, length/size, and weight.
- **Silver metal purity filters limited to silver purities (2026-06-17):** Shop
  and Product Admin purity filters now react to the selected Metal filter.
  Silver shows only silver-designated purity options such as `925 Sterling` and
  hides karat options; Gold keeps karat options. Incompatible purity selections
  are cleared when switching metal. Verified in-browser, `npm run lint`, and
  `npm run build`.
- **Silverware metal choices constrained to Silver (2026-06-17):** When
  Silverware / Sterling is selected in the shop or Product Admin filters, the
  Metal dropdown now offers only Silver instead of leaving All/Gold choices
  available. Product Admin still snaps Metal Type to Silver. Verified
  in-browser, `npm run lint`, and `npm run build`.
- **Silverware label expanded to Silverware / Sterling (2026-06-17):** Shop and
  Product Admin item/product type dropdowns now display `Silverware / Sterling`
  while keeping the existing stored values and URL parameters stable. AI/admin
  prompt guidance was updated to use the new visible label. Verified
  in-browser, `npm run lint`, and `npm run build`.
- **Silverware filters snap to Silver (2026-06-17):** Shop Item Type and
  Product Admin Product Type filters now automatically set the broad Metal
  filter to Silver when Silverware is selected; Product Admin also sets Metal
  Type to Silver and clears incompatible gold-only Metal Color selections.
  Verified in-browser, `npm run lint`, and `npm run build`.
- **Admin product filters collapsed behind button (2026-06-17):** The main
  Product Admin table now keeps the shop-aligned filter system hidden behind a
  Filters button beside Add Product, with the result count still visible in the
  toolbar and an active-filter count shown on the button. Verified in-browser,
  `npm run lint`, and `npm run build`.
- **Admin product filters matched to shop hierarchy (2026-06-17):** The main
  Product Admin table filter row now follows the shop-side catalog order:
  Gender, Product Type, Brand, Metal, Metal Type, Metal Color, Purity, then
  scoped Link Type and Length/Size controls, followed by admin-only Status,
  Location, and Featured. Link Type appears only for necklace/bracelet product
  types; Length shows necklace or bracelet lengths based on Product Type; Ring
  shows Size options. Verified in-browser, `npm run lint`, and
  `npm run build`.
- **Admin Size/Length values normalized (2026-06-17):** Product Admin now
  normalizes entered or AI-generated Length/Size values such as `7.75 in`,
  `7.75in`, `7.75 inches`, or `7.75"` to bare numeric values such as `7.75`
  before displaying/saving them in the admin table and product payload. Public
  buyer-facing product displays still add `in` for necklace/bracelet lengths.
  Verified in-browser, `npm run lint`, and `npm run build`.
- **Product form AI assistant UI restyled (2026-06-16):** Add/Edit Product now
  opens as a wider modern listing drawer with a top Photos panel, a pastel Smart
  Listing Assistant panel, and Quick Fill below as the manual fallback. The
  assistant includes a large tap-to-talk button, guided prompt checklist,
  warning when no photos are present, and an animated floating recording badge
  with mic/waveform motion while speech capture is active. Verified in-browser,
  `npm run lint`, and `npm run build`.
- **Provider-neutral AI product listing assistant foundation added
  (2026-06-16):** Product Admin Add/Edit now includes an AI Listing Assistant
  that accepts typed or browser-transcribed item descriptions, requests a
  structured product draft through an admin-only server route, previews returned
  fields, applies them into the existing form with undo and optional overwrite,
  and keeps Quick Fill as the fallback/manual workflow. AI provider/model
  details are isolated in `next-app/src/lib/ai-product-provider.ts` and selected
  through environment variables. The route validates admin access, rate limits
  usage, filters image sources, and sends the first allowed product images as
  visual context. Verified in-browser, `npm run lint`, and `npm run build`.
- **Account order chevron icon fixed (2026-06-16):** corrected the Orders tab
  row chevron so the Material Symbols icon font is preserved instead of showing
  the literal `chevron_right` text. Verified in-browser, `npm run lint`, and
  `npm run build`.
- **Account order details dialog added (2026-06-16):** the buyer account Orders
  tab now lets customers click an order row to open a full details window with
  statuses, item snapshots, customer info, totals, and notes/addresses when
  present. The dialog closes from a top-left X. Verified in-browser,
  `npm run lint`, and `npm run build`.
- **Account tab layout stabilized (2026-06-16):** shared the buyer account tab
  rail and support strip between `/account` and `/account/security`, aligned the
  security page hero/menu sizing with the main dashboard, and verified the tab
  rail keeps the same top/left/width/height across Overview, Wishlist, and Admin
  and Security. Verified in-browser, `npm run lint`, and `npm run build`.
- **Account overview detail cards reformatted (2026-06-16):** refined the main
  `/account` Account Overview personal-detail tiles with a dedicated icon
  column, label/value copy block, tighter title styling, consistent tile
  spacing, and safer wrapping for longer values like addresses. Verified
  in-browser, `npm run lint`, and `npm run build`.
- **Account security menu completed (2026-06-16):** fixed `/account/security`
  so the full account menu appears there too: Overview, Orders, Wishlist, and
  active Admin and Security. Orders and Wishlist links return to `/account`
  with URL-backed tab selection (`?tab=orders` / `?tab=wishlist`). Verified
  in-browser, `npm run lint`, and `npm run build`.
- **Account Admin and Security page added (2026-06-16):** removed the
  Profile Information tab/page and added an `Admin and Security` account menu
  item after Wishlist that links to the new protected `/account/security` page.
  The security page contains the Supabase Auth password-change flow and keeps
  the same right-side Admin Panel, Account Details, and Shop Now card rail used
  by the main buyer account dashboard. Verified in-browser, `npm run lint`, and
  `npm run build`.
- **Profile Information moved to standalone page (2026-06-16):** changed the
  account dashboard's Profile Information tab into a link to the new protected
  `/account/profile` route. This intermediate page was later removed and
  replaced by `/account/security` after the account menu was simplified.
- **Account dashboard tab views added (2026-06-16):** converted the buyer
  account tab rail into real in-page tabs for Overview, Orders, and Wishlist,
  with Profile Information now linking to its own page. Admin Panel was removed
  from the top tab menu while the admin shortcut card remains visible for admin
  users. Orders reads the signed in user's live Supabase orders, Wishlist
  displays the current saved-items list from the wishlist context, and Account
  Details includes an expandable password-change form using Supabase Auth.
  Verified in-browser, `npm run lint`, and `npm run build`.
- **Buyer account dashboard makeover added (2026-06-16):** restyled
  `/account` into a desktop buyer dashboard inspired by the supplied reference,
  with a wide welcome hero, compact tab-style account menu, main Account
  Overview panel, right-side Account Details/Admin/Shop cards, and a bottom
  support strip. The tab rail was later revised to current/relevant areas only:
  Overview, Orders, Wishlist, and Admin and Security.
  Verified in-browser, `npm run lint`, and `npm run build`.
- **Account profile preview/edit flow added (2026-06-16):** the Complete
  Profile card now opens as a compact read-only profile summary with an Edit
  Profile button. Clicking Edit expands the full editable form with Save Profile
  at the bottom, and a successful save collapses the card back into preview
  mode with the updated values. Verified in-browser, `npm run lint`, and
  `npm run build`.
- **Account background hero fade extended (2026-06-16):** moved the account
  hero jewelry image from the bounded hero section onto a fixed account-page
  background layer, extended it behind the upper account content, and added a
  vertical fade so the image softens into the page instead of ending at a hard
  horizontal edge. Verified in-browser, `npm run lint`, and `npm run build`.
- **Cart clear-all controls added (2026-06-16):** added `Clear Cart` /
  `Vaciar carrito` actions to the cart drawer footer and the header
  added-item cart popup. Both use the existing shared cart context `clear()`
  method so the cart count, local storage state, and cart drawer all update
  through the normal provider flow. Verified in-browser, `npm run lint`, and
  `npm run build`.
- **Account hero image swapped to jewelry asset (2026-06-16):** copied the new
  root `jewelry.png` into public assets as `account-hero-jewelry.png`, updated
  `/account` to use it as the hero background, and removed the temporary root
  source file afterward. Verified in-browser, `npm run lint`, and
  `npm run build`.
- **Account page redesigned (2026-06-16):** rebuilt `/account` with the modern
  white/gold buyer-dashboard layout inspired by `account.png`, including a
  chain-image hero, wide welcome header, rounded elevated admin-only shortcut
  card, larger profile form card, account-details card, and bottom trust strip.
  The Admin Panel block remains guarded by the existing `isAdmin` check and
  only appears for admin profiles. Verified in-browser, `npm run lint`, and
  `npm run build`.
- **Add/Edit Product image previews enlarged (2026-06-16):** increased the
  Product Admin form image thumbnail previews from small 64px squares to larger
  112px squares, expanded thumbnail spacing, enlarged the cover badge and hover
  controls, and made the upload drop zone taller so the whole photo area reads
  as a larger preview/editing section. Verified `npm run lint` and
  `npm run build`.
- **Modern shop design promoted to live `/shop` (2026-06-16):** changed the
  canonical English and Spanish shop routes (`/shop` and `/es/shop`) to render
  the modern cream/white/gold shop layout that was prototyped on
  `/shop-modern`, while keeping the same live Supabase products, filters,
  pricing, pagination, cart, wishlist, and image-preview behavior. Gender-tab
  links now stay on the canonical shop route; `/shop-modern` remains available
  as a preview/backup route. Verified `/shop` and `/es/shop` in-browser,
  `npm run lint`, and `npm run build`.
- **Modern shop hero image swapped to chain asset (2026-06-16):** copied the
  new root `chain.png` into public page assets as `shop-modern-chain.png` and
  changed `/shop-modern` to use it as a full-cover white-feathered hero
  background instead of the smaller cropped screenshot asset. Verified
  in-browser, `npm run lint`, and `npm run build`.
- **Modern shop hero background cleaned up (2026-06-16):** adjusted the
  `/shop-modern` hero from cream to white and changed the cropped hero image
  layer to span the full hero with white gradient feathering, removing the hard
  right-side transition where the image ended. Verified in-browser,
  `npm run lint`, and `npm run build`.
- **Modern shop sidebar alignment refined (2026-06-16):** adjusted the desktop
  `/shop-modern` sidebar offset so the left filter block lines up with the top
  of the first product-card row instead of the gender tab row. Verified
  in-browser, `npm run lint`, and `npm run build`.
- **Modern shop clone refined (2026-06-16):** tightened the `/shop-modern`
  preview against the `modern.png` reference by cropping the right-side hero
  jewelry image into a preview-only public asset, swapping the proof points to
  real icon badges, and giving the left filter menu a modern-only presentation
  with search first, stacked live spot cards, gender pill buttons, softer
  rounded fields, and a cleaner cream/gold filter shell. The live `/shop` page
  remains unchanged. Verified in-browser, `npm run lint`, and `npm run build`.
- **Modern shop clone preview added (2026-06-16):** added a separate
  `/shop-modern` route that reuses the live Supabase products, pricing, filters,
  pagination, cart, wishlist, image hover, and gender-tab behavior from `/shop`
  while applying a more modern cream/gold layout inspired by `modern.png`.
  Product cards keep the same buyer information as the current gallery but use
  softer rounded cards, elevated shadows, a modern price band, and a polished
  hero/filter presentation. `/shop` remains on the classic layout. Verified
  `/shop-modern` and `/shop` in-browser, `npm run lint`, and `npm run build`.
- **Quick Fill success notice color fixed (2026-06-16):** Product Admin Quick
  Fill feedback now renders successful applies in green, including repeat
  Quick Fill runs that replace existing form values. Partial applies still list
  any not-applied tokens, but they no longer turn the whole success notice red
  when fields were updated. Total failures remain red. Verified `npm run lint`
  and `npm run build`.
- **Shop gender path tabs added (2026-06-16):** the public shop gallery now has
  a modern segmented Men’s / All / Ladies’ tab control above the product grid,
  just below the hero/filter intro area. The tabs are URL-backed by the existing
  `gender` filter, preserve the left-sidebar search/filter values, reset paging
  when changed, and leave all existing sidebar controls in place. Verified
  in-browser, `npm run lint`, and `npm run build`.
- **Homepage hero CTA backing refined (2026-06-16):** the Buy, Sell, and Trade
  hero buttons now use a subtle translucent gold backing, stronger gold border,
  soft gold glow, and light blur so the actions are more visible over the video
  while staying refined. Verified in-browser, `npm run lint`, and
  `npm run build`.
- **Shop card spec chips simplified (2026-06-16):** product gallery cards now
  render the three spec chips in a consistent three-column row. Purity and grams
  show value-only labels such as `18K` and `12.7g`, and length values show as
  normalized inches such as `28 in` or `7.75 in` without the `Length:` prefix.
  Gold purity chips use a karat-based yellow ramp, so 10K is muted, 14K is
  mid-brightness, 18K is richer/brighter, and future higher karats such as 22K
  will render brighter still.
  The same shared display helper is used on product detail top stats and
  Specifications, so admins can store length as a simple number while buyer
  views add `in` for necklace/bracelet lengths. Verified in-browser,
  `npm run lint`, and `npm run build`.
- **Shop filter hierarchy reordered (2026-06-16):** the public shop filter
  controls now start with `Gender`, then `Item Type`, `Brand`, `Metal`,
  `Metal Color`, `Purity`, and `Sort`, with scoped Link Type and Length
  controls still appearing only when the selected item type supports them.
  Verified in-browser, `npm run lint`, and `npm run build`.
- **Product image custom padding color added (2026-06-16):** the Product Admin
  `Pad` modal now shows a first-photo preview, keeps No/White/Black one-click
  choices, and adds a custom hex color option through a `Pick From First Photo`
  browser eyedropper button where supported. The manual swatch/hex input path
  was removed to keep the flow focused on sampling from the product photo, and
  the picker button now includes a dropper icon. The Black Padding option uses
  a black filled button with white text so it is immediately visually distinct.
  Shop gallery cards, product detail galleries, and admin thumbnails all use
  custom hex `image_padding` values through the shared helper. Updated
  `supabase/product-image-padding.sql` to allow `#rrggbb` values; run the
  updated SQL before saving custom colors in the live database. If the old
  Supabase check constraint rejects a custom color, the admin modal now explains
  that the image-padding SQL needs to be run instead of showing the raw Postgres
  constraint error. Verified in-browser, `npm run lint`, and `npm run build`.
- **Product detail inventory reference added (2026-06-16):** public product
  detail pages now show a small buyer-facing `Item #` as its own first metadata
  line above the metal/status row whenever the product has an inventory number,
  and expose that same value as structured product `sku`. Verified in-browser,
  `npm run lint`, and `npm run build`.
- **Product detail top stats include length (2026-06-16):** product detail pages
  now show the item length in the top stats row whenever a length is available,
  with the row ordered as status, metal color, purity, then length. Verified
  in-browser, `npm run lint`, and `npm run build`.
- **Product detail fine-metal weight clarified (2026-06-16):** the
  Specifications weight line now labels both fine grams and fine troy ounces as
  fine gold/silver, avoiding confusion with total item weight. Verified
  in-browser, `npm run lint`, and `npm run build`.
- **Product detail Add to Cart CTA differentiated (2026-06-16):** the detail
  page Add to Cart button now uses a deep green CTA treatment so it stands apart
  from gold pricing/status accents and the quieter secondary action buttons.
  Verified in-browser, `npm run lint`, and `npm run build`.
- **Product Admin thumbnails honor image padding (2026-06-16):** the main
  Products table image preview now uses the same per-listing image padding frame
  background as shop gallery cards, so black/white/no-padding choices are visible
  in admin. Verified in-browser, `npm run lint`, and `npm run build`.
- **Product Admin Pad action shows applied state (2026-06-16):** Products table
  `Pad` row actions now turn green when a listing has white or black image
  padding applied, and remain neutral when padding is `none`. Verified
  in-browser, `npm run lint`, and `npm run build`.
- **Product Admin table width tightened (2026-06-16):** shortened table headers
  from Product Type to Type and Length/Size to Size, narrowed the Title column
  to encourage two-line wrapping, and reduced repeated column horizontal padding.
  Verified in-browser, `npm run lint`, and `npm run build`.
- **Product Admin table spacing optimized (2026-06-16):** the Products table now
  sizes to its content instead of stretching across the full desktop container,
  uses tighter width hints for smaller columns, truncates Brand when needed, and
  keeps the Actions column sticky so Delete remains visible. Verified
  in-browser, `npm run lint`, and `npm run build`.
- **Product Admin title/brand divider added (2026-06-16):** added a subtle
  vertical divider before the Brand column to visually separate long product
  titles from the smaller metadata columns. Verified in-browser,
  `npm run lint`, and `npm run build`.
- **Product Admin Brand column centered (2026-06-16):** the Brand header and all
  Brand cell contents are centered inside the existing fixed-width Brand column,
  with long values still truncated. Verified in-browser, `npm run lint`, and
  `npm run build`.
- **Add/Edit Product clear controls refined (2026-06-16):** field clear buttons
  now clear and refocus their field, native selects hide their dropdown arrow
  while the X is showing, and custom comboboxes use one right-side control that
  shows a dropdown arrow when empty or an X when filled; clearing a combobox
  reopens its options. Verified in-browser, `npm run lint`, and
  `npm run build`.
- **Add/Edit Product dropdown clear flow adjusted (2026-06-16):** dropdown-style
  controls now show the dropdown arrow first, even when prefilled. Clicking the
  arrow opens choices via the native picker where available and immediately
  arms the control as `x`; clicking that `x` clears the value and focuses the
  field for manual entry. Custom comboboxes show all options on the first click
  when a value is present. Verified native dropdown behavior in-browser;
  `npm run lint` and `npm run build` pass.
- **Inventory/SKU row alignment refined (2026-06-16):** the Add/Edit Product
  `SKU / Slug` toggle now aligns with the Inventory # input instead of the
  helper text below it. Verified in-browser, `npm run lint`, and
  `npm run build`.
- **Product Admin inventory display normalized (2026-06-16):** the main
  Products table now renders inventory numbers consistently as plain numeric
  values, including fallback/generated row numbers, so rows no longer mix `#2`
  and `#4` with `1`, `3`, `5`, etc. Verified in-browser, `npm run lint`, and
  `npm run build`.
- **Product image padding preference added (2026-06-16):** products now support
  an `image_padding` display preference (`none`, `white`, `black`, or a custom
  `#rrggbb` color) that controls the frame color behind contained product images
  on shop gallery cards and product detail galleries. Product Admin rows include
  a compact `Pad` action that opens an immediate chooser for No Padding, White
  Padding, Black Padding, or custom color. Added
  `supabase/product-image-padding.sql`; run it before saving padding choices in
  the live database. Verified in-browser, `npm run lint`, and `npm run build`.
- **Shop card spec chips colorized (2026-06-16):** product card Purity, Grams,
  and Length/Size details now render as compact chips with distinct subtle
  color treatments so shoppers can scan specs more easily. Verified
  in-browser, `npm run lint`, and `npm run build`.
- **Shop card price emphasis refined (2026-06-16):** product card `Your price`
  rows now use a subtle gold-tinted band, thin separators, stronger label
  weight, and a larger price amount so prices are easier to scan in the main
  gallery. Verified in-browser, `npm run lint`, and `npm run build`.
- **Shop pagination layout centered (2026-06-16):** the main shop pagination
  footer now keeps product page navigation centered while moving the Per Page
  selector to the right side on desktop, with the result count on the left.
  Verified in-browser, `npm run lint`, and `npm run build`.
- **Shop gallery image preview controls added (2026-06-16):** product cards on
  the main shop gallery now show compact edge-aware previous/next image arrows
  on listings with multiple photos. Hovering a card image rotates through the
  available photos with a slightly faster start, a true stacked opacity
  crossfade, and stops at the last photo; leaving the image area returns the
  card to its cover photo after one second. The image count badge was removed.
  Manual arrow clicks change the preview without navigating away from `/shop`.
  Verified in-browser, `npm run lint`, and `npm run build`.
- **Product detail scrap/spot panel standardized (2026-06-16):** product
  detail pages now show the scrap gold/silver value and Based on Spot panel
  whenever the product has enough structured metal data to calculate melt value
  (`weight_grams`/`gram_weight` plus `purity`), regardless of manual vs
  spot-multiplier pricing mode or multiplier value. Verified the Figaro chain
  detail page in-browser, `npm run lint`, and `npm run build`.
- **Quick Fill visible helper text simplified (2026-06-16):** removed the long
  visible "Best format..." helper paragraph from the Add/Edit Product drawer
  while keeping the Quick Fill input, Apply button, Copy Prompt, View AI Prompt,
  prompt modal, and parser behavior unchanged. Verified `npm run lint` and
  `npm run build`.
- **Add/Edit Product field clear buttons added (2026-06-16):** product drawer
  fields now show compact `X` clear/reset controls at the right side of normal
  inputs, selects, textareas, and combobox fields when they have a clearable
  value. Text and numeric fields clear to blank/null; required dropdowns reset
  to safe defaults such as Other, Gold/default metal color, Spot pricing,
  Showcase, Available, or Unisex. Verified in-browser, `npm run lint`, and
  `npm run build`.
- **Product Admin table tightened (2026-06-16):** hid Metal Type, Gender, and
  Location from the main Products table to reduce row width. These fields
  remain available in filters/forms/data where needed; the table now relies on
  Metal Color and Product Type for the primary scan view. Verified in-browser,
  `npm run lint`, and `npm run build`.
- **Product Type / Metal Type additive hierarchy added (2026-06-16):** added
  nullable `products.product_type` and `products.metal_type` support in shared
  product typing, Product Admin Add/Edit, Product Admin table/filter display,
  public shop item-type filters, and product detail specs. Admin now treats
  Product Type as the primary item classification and Metal Type as the
  secondary material classification while dual-writing Product Type to legacy
  `jewelry_type` and Metal Type-compatible values to legacy `category`/`metal`
  for pricing compatibility. Link Type only appears for Necklace/Bracelet,
  Length only for Necklace/Bracelet, Size only for Ring, and Gender is hidden
  for coin/bullion/loose stone/silverware-style entries. Quick Fill now accepts
  labeled Product Type and Metal Type fields and the AI prompt guidance was
  updated to prefer the new hierarchy. Added
  `supabase/product-type-metal-type.sql` and updated canonical product SQL.
  Verified in-browser, `npm run lint`, and `npm run build`.
- **Watch item type support swept site-wide (2026-06-16):** confirmed Watch is
  a first-class Jewelry Type in shared product typing, Add/Edit Product, admin
  filters/table behavior, shop filters, product detail specs, and Supabase
  jewelry-type SQL. Expanded recognition for watch, watches, wristwatch, wrist
  watch, and timepiece, and updated Quick Fill visible guidance plus the AI
  formatting prompt so watches use `Jewelry Type:Watch` and do not use Link
  Type. Verified in-browser, `npm run lint`, and `npm run build`.
- **Quick Fill AI Brand detection prompt strengthened (2026-06-16):** the
  default AI formatting prompt now has explicit Brand detection rules requiring
  a separate `Brand:...` line when a maker/designer/brand/manufacturer appears
  in the raw description, title, markings, or maker/signature language. Older
  saved Admin Settings prompt overrides are automatically appended with the
  current Brand rules when viewed/copied, and Quick Fill now accepts Brand Name,
  Maker Name, Designer Name, and Manufacturer Name labels. Verified
  `npm run lint` and `npm run build`.
- **Product detail CTA placement moved under price (2026-06-16):** moved the
  Add to Cart, Save, Inquire, and Call action row directly under "This is your
  price" and above the scrap/spot pricing cards, with the trade-in line and
  description following below. Verified in-browser, `npm run lint`, and
  `npm run build`.
- **Product detail pricing panel shifted to warm gold colorway (2026-06-16):**
  kept the modern segmented pricing panel shape while changing the violet
  styling to a lighter warm gold gradient, cream container, and warm neutral
  spot/ticker colors based on the supplied product-page visual reference.
  Verified in-browser, `npm run lint`, and `npm run build`.
- **Product detail pricing panel modernized (2026-06-16):** restyled the
  product-detail scrap value and spot basis panel with a softer app-like
  lavender container, violet primary scrap-value tile, white secondary spot tile,
  and 8px rounded corners inspired by the supplied visual reference. Verified
  in-browser, `npm run lint`, and `npm run build`.
- **Product detail pricing basis block refined (2026-06-16):** reformatted the
  item-detail scrap value / spot basis / update ticker area into a cleaner
  two-value pricing panel with separate color treatments for scrap value and
  spot basis, plus a shorter muted update line. Verified in-browser,
  `npm run lint`, and `npm run build`.
- **Shop card Length/Size spec added (2026-06-16):** gallery cards now show a
  right-aligned Length or Size spec on the same row as Purity and Grams whenever
  the product has a stored length/size value. Ring products label the value as
  Size; other products label it as Length. Verified in-browser,
  `npm run lint`, and `npm run build`.
- **Shop Brand filtering/sorting and pagination added (2026-06-16):** the
  public shop sidebar now includes a Brand filter and Brand A-Z/Z-A sort
  options. Product results are paginated with a default of 24 listings per page,
  bottom page navigation, and a per-page selector for 12, 24, 48, or 96
  listings. Filter changes reset to page one and pagination remains URL-backed.
  Verified in-browser, `npm run lint`, and `npm run build`.
- **Product Brand field and labeled Quick Fill guidance added (2026-06-16):**
  products now support a `brand` field in Supabase, Product Admin table/search/
  filters, Add/Edit Product, Quick Fill, public shop search, and product detail
  specs. Quick Fill now accepts labeled `Brand:...` lines and can place custom
  labeled Link Type and Length/Size values directly into the form without
  promoting them into permanent dropdown choices. The default AI formatting
  prompt now explicitly requires labeled field-targeted `Field:Value` lines.
  Added `supabase/product-brand.sql`. Verified in-browser, `npm run lint`, and
  `npm run build`.
- **Shop desktop filter sidebar added (2026-06-16):** moved the shop filter
  section into a sticky left sidebar on desktop while preserving the collapsible
  top filter behavior on mobile. The sidebar includes search, live metal price
  badges, filter controls, availability toggle, result count, and clear action.
  Verified desktop and mobile layouts in-browser, `npm run lint`, and
  `npm run build`.
- **Product detail price notes stacked (2026-06-16):** moved the spot-price
  basis sentence onto its own line beneath the current scrap value on product
  detail pages, then shortened that line to `Based on $X/oz`. Verified
  in-browser, `npm run lint`, and `npm run build`.
- **Product detail spot-basis wording refined (2026-06-16):** changed the
  product detail spot-basis copy from "current gold value" to "current spot
  price" while keeping the live per-ounce value and refresh ticker. Verified
  in-browser, `npm run lint`, and `npm run build`.
- **Product detail spot basis/ticker added (2026-06-15):** individual item
  pages now show the current scrap gold/silver value with the current site-wide
  spot value per ounce on the same line, plus a live countdown showing when the
  next site-wide price update is expected. The display uses the shared pricing
  helper and the existing five-minute metal-price update window. Verified
  in-browser, `npm run lint`, and `npm run build`.
- **Bicolor Gold metal color added (2026-06-15):** products now support
  `bicolor_gold` as a Gold metal color alongside Tricolor Gold. Admin/Product
  forms, filters, product labels, Quick Fill, and the default AI formatting
  prompt include Bicolor Gold. Public shop broad Metal filtering treats Bicolor
  Gold like a crossover item, so it appears when shoppers filter either Gold or
  Silver. Updated `supabase/product-metal-variants.sql`. Verified in-browser,
  `npm run lint`, and `npm run build`.
- **Account admin shortcut moved up (2026-06-15):** admin users now see the
  My Account Admin Panel shortcut above the Complete Profile form for faster
  access. Verified in-browser, `npm run lint`, and `npm run build`.
- **Product Jewelry Type / Link Type split added (2026-06-15):** products now
  have a broad `jewelry_type` field for Necklace, Bracelet, Ring, Pendant,
  Earrings, Watch, or Other, while the existing `chain_type` field is now used
  as Link Type only for necklaces and bracelets. Product Admin has separate
  Jewelry Type and Link Type filters/form controls, the main Products table
  shows Jewelry Type and a combined Length/Size column instead of a Link Type
  column, and ring rows/forms use Size while necklaces/bracelets use Length.
  Quick Fill accepts Jewelry Type, Link Type, Length, Size, and Ring Size
  labels, public shop filtering scopes Link Type to selected necklace/bracelet
  item types, and product detail specs show Jewelry Type plus Link Type where
  applicable. Added
  `supabase/product-jewelry-type.sql`. Verified in-browser, `npm run lint`,
  and `npm run build`.
- **Save + Add Another inventory increment fixed (2026-06-15):** after adding a
  product with `Save + Add Another`, the next add form now calculates its
  auto-filled Inventory # from the just-updated product list, preventing the
  newly saved number from being reused. Verified Add Product auto-fill
  in-browser, `npm run lint`, and `npm run build`.
- **Product Admin Actions column tightened (2026-06-15):** the Products table
  Actions column now uses a compact fixed width and wraps actions into a clean
  two-row stack, reducing table width after the Melt column addition. Verified
  in-browser, `npm run lint`, and `npm run build`.
- **Product Admin Melt column added (2026-06-15):** the main Products table now
  shows a sortable `Melt` column between Weight and Mode, using the shared live
  spot melt-value calculation before pricing multipliers are applied. Verified
  in-browser, `npm run lint`, and `npm run build`.
- **Inventory number duplicate guard added (2026-06-15):** Add/Edit Product now
  rejects duplicate inventory numbers before insert/update and shows an inline
  warning when the current drawer value collides with another product. Added
  `supabase/product-inventory-number-unique.sql` plus updated product workflow
  SQL to enforce a unique partial index after existing duplicates are corrected.
  Verified the duplicate `#21` warning in-browser, `npm run lint`, and
  `npm run build`.
- **Product Admin table widened for desktop (2026-06-15):** the main Products
  admin table now uses a wider desktop container, a larger table minimum width,
  and a reserved Actions column width so right-side row actions are not clipped
  on widescreen admin views. Verified in-browser, `npm run lint`, and
  `npm run build`.
- **Admin product View return path fixed (2026-06-15):** Product Admin table
  `View` links now include `returnTo=admin`, and product detail pages use that
  query to show a `Back to Admin` link pointing to `/admin` (or `/es/admin`).
  Normal product pages still show `Back to Shop`. Verified in-browser,
  `npm run lint`, and `npm run build`.
- **Quick Fill Copy Prompt fallback fixed (2026-06-15):** Product Admin and
  Admin Settings now use a shared clipboard helper for Copy Prompt. If browser
  clipboard access is blocked, Product Admin automatically opens the AI prompt
  modal with the prompt text selected for manual copy, and Admin Settings
  selects the prompt textarea. Verified in-browser, `npm run lint`, and
  `npm run build`.
- **Quick Fill AI prompt output rules refined (2026-06-15):** the default AI
  formatting prompt now asks for a fenced code block, tells the AI not to put
  gram weight in product titles when Weight is supplied separately, and tells it
  not to repeat description-covered information in Public Notes or Internal
  Notes. Verified `npm run lint` and `npm run build`.
- **Quick Fill Metal Color guidance tightened (2026-06-15):** Add/Edit Product
  Quick Fill now shows a current visible helper and placeholder that include
  Metal Color values. The default AI formatting prompt explains that Metal Color
  maps to Category automatically, and the parser now lets explicit Metal Color
  win even if Category appears later in labeled Quick Fill text. Verified
  in-browser, `npm run lint`, and `npm run build`.
- **Shop Metal Color filter scoped by selected Metal (2026-06-15):** the public
  shop Metal Color dropdown now shows only Yellow/White/Rose/Tricolor/Bicolor
  Gold when Metal is Gold, and only Silver/Vermeil when Metal is Silver. Direct
  incompatible URL combinations are ignored server-side instead of hiding all
  products. Verified in-browser, `npm run lint`, and `npm run build`.
- **Metal Type renamed to Metal Color in UI (2026-06-15):** admin labels,
  Add/Edit Product, Product Admin filters/table headers, public shop filters,
  Quick Fill feedback, and the default AI formatting prompt now use "Metal
  Color." The shop now writes the URL filter as `metalColor` while still
  accepting legacy `metalType` links. Verified `npm run lint` and
  `npm run build`.
- **Product metal subtypes added (2026-06-15):** products now support a
  dedicated `metal_variant` subtype for Yellow Gold, White Gold, Rose Gold,
  Tricolor Gold, Bicolor Gold, Silver, and Vermeil while keeping `category` as the broad
  Gold/Silver pricing category. Add/Edit Product exposes a Metal Color selector,
  Product Admin can search/sort/filter by color, Quick Fill accepts labeled
  Metal Color values, public shop filters include Metal Color, product cards and
  detail specs show the subtype, and order item snapshots use the subtype label.
  Added `supabase/product-metal-variants.sql` for existing Supabase projects.
  Verified in-browser, `npm run lint`, and `npm run build`.
- **Product detail public notes moved below actions (2026-06-15):** product
  detail pages now render `public_notes` as a buyer-facing Notes section below
  the Add to Cart / Save / Inquire / Call action row, preserving line breaks.
  Verified in-browser, `npm run lint`, and `npm run build`.
- **Product table detail View link added (2026-06-15):** each row in the main
  Product Admin table now includes a `View` link that opens the public product
  detail page in the same tab. Browser Back returns to `/admin` and restores the
  product table. Verified in-browser, `npm run lint`, and `npm run build`.
- **Admin Settings prompt editor added (2026-06-15):** added `/admin/settings`
  and an `Admin Settings` link to the shared admin header. The settings page
  leads with a Quick Fill AI formatting prompt editor that can save a browser
  local override, reset to the default prompt, and copy the prompt. Product
  Admin reads the saved prompt override for Copy Prompt/View AI Prompt while
  falling back to the shared default prompt. Verified settings page in-browser,
  `npm run lint`, and `npm run build`.
- **Product ID field hidden on Add Product (2026-06-15):** the Add Product
  drawer now hides the standalone `ID (slug, auto-generated if blank)` field so
  new products use the generated ID. Edit Product still shows the field for
  post-creation adjustments, and edit saves now match the original row when an
  ID is changed. Verified in-browser, `npm run lint`, and `npm run build`.
- **Quick Fill validation tightened (2026-06-15):** Product Admin Quick Fill is
  now partially applies recognized comma-separated tokens while blocking and
  listing any unrecognized tokens. Chain type matching no longer uses loose
  substring matches, preventing misleading rogue `Applied: Chain Type` messages.
  Recognized tokens are allowed to replace existing form values, and category
  replacements keep the paired metal/purity fields consistent. Repeated Quick
  Fill applies now overwrite existing form values, explicitly blank optional
  fields can clear prior values, and the Quick Fill text box clears after a
  successful apply to prevent accidental appended re-runs. Quick Fill
  accepts plain comma values, `Field:Value` pairs, and two-line CSV
  header/value pastes, including title EN/ES, location, price mode, asking
  price, descriptions EN/ES, public notes, and internal notes. Feedback appears
  inside the Add/Edit Product drawer rather than behind the modal. Unlabeled CSV
  rows that do not parse cleanly as standalone tokens fall back to the Add/Edit
  Product form order, preserving blank columns and quoted text with commas,
  while labeled rows can be in any order. Combined
  chain/jewelry descriptors such as
  `Cuban link bracelet` are rejected as one token; enter those concepts as
  separate tokens. The Quick Fill helper now keeps the AI formatting prompt
  hidden by default, while exposing Copy Prompt and View AI Prompt actions. The
  prompt asks an AI agent to format random item descriptions into one quick-copy
  `Field:Value` text block and includes terminology/notes rules for Italian-made
  pieces, chain styles, and public/internal notes. Verified in-browser,
  `npm run lint`, and
  `npm run build`.
- **Product image crop workflow added (2026-06-15):** Product thumbnails in the
  Add/Edit Product drawer now open a full-size preview with a Crop action. The
  crop editor uses a draggable crop-box overlay with edge/corner resize handles
  and saves the cropped result as a new compressed WebP image that replaces the
  selected photo in the form. The crop box starts maximized over the image, so
  saving without adjustments is a no-op. Cropping also removes the old uploaded
  Supabase Storage object when no other product or image slot still references
  it. Verified preview/crop UI in-browser, `npm run lint`, and `npm run build`.
- **Asking Price gated by manual pricing (2026-06-15):** Add/Edit Product now
  grays out and disables Asking Price unless Price Mode is set to Manual /
  Fixed. Verified in-browser, `npm run lint`, and `npm run build`.
- **Product form sort-order field removed (2026-06-15):** removed Sort Order
  from the Add/Edit Product drawer so manual ordering is handled only by
  dragging rows in the master product table. New and cloned products still
  receive an automatic sort position when created. Verified in-browser,
  `npm run lint`, and `npm run build`.
- **Product note fields simplified (2026-06-15):** removed the redundant
  "Extra notes about this item" field from the Add/Edit Product drawer and
  stopped rendering the old `details[0]` extra-note path on public product
  pages. Existing extra-note values are folded into Internal Notes the next time
  a product is saved. Verified in-browser, `npm run lint`, and `npm run build`.
- **Inventory number auto-fill added to product form (2026-06-15):** Add
  Product now auto-fills Inventory # with the next available number and locks
  the field by default. Edit Product preserves the current number in auto mode,
  and a Manual checkbox unlocks the field when an override is needed. The
  auto-fill now treats displayed fallback inventory numbers in the admin table
  as already occupied, so older products without saved inventory numbers do not
  cause Add Product to reuse `1`. Verified in-browser, `npm run lint`, and
  `npm run build`.
- **Product form internal fields simplified (2026-06-15):** removed Minimum
  Price, Cost Basis, Melt Value Snapshot, Acquisition Date, and Acquisition
  Source from the shared Add/Edit Product form while keeping Asking Price.
  Verified in-browser, `npm run lint`, and `npm run build`.
- **Pending-payment products hidden from public gallery (2026-06-15):** the
  shop gallery now filters out products with `pending_payment` status before
  applying public filters/sorts/counts. If an unpaid order is cancelled and the
  product returns to `available`, it appears in the gallery again. Verified
  `/shop` in-browser, `npm run lint`, and `npm run build`.
- **Admin header Home link added (2026-06-15):** added a far-left `← Home`
  link to the shared admin header so every admin page can return to the public
  homepage (`/` or `/es` for Spanish admin routes). Verified in-browser,
  `npm run lint`, and `npm run build`.
- **User order/invoice visibility added (2026-06-15):** `/admin/users` now
  shows whether each account has placed orders, summarizes order count/total,
  and shows an Invoices button for order-linked accounts. Added
  `/admin/users/[id]/invoices` with generated invoice rows and a purchases
  without generated invoices section linking back to order detail. Verified
  in-browser, `npm run lint`, and `npm run build`.
- **Homepage subscribers capture added (2026-06-15):** added a homepage hero
  subscriber CTA, `/api/subscribe`, protected `/admin/subscribers`, and
  `supabase/homepage-subscribers.sql`. The shared admin header now includes
  Subscribers across all admin pages. Subscriber inserts use a security-definer
  Supabase RPC and admin reads use RLS. Verified homepage/admin in-browser,
  `npm run lint`, and `npm run build`.
- **Admin header centralized and standardized (2026-06-15):** replaced
  page-specific admin headers with a shared `AdminHeader` component so Products,
  Orders, Messages, Inquiries, and Users appear in the same order across Product
  Admin, Orders, Order Detail, Messages, Inquiries, and Users. Products remains
  gold, the Messages unread badge is preserved, and only the active section is
  underlined. Verified all admin headers in-browser, `npm run lint`, and
  `npm run build`.
- **Messages header navigation completed (2026-06-15):** added the missing
  Inquiries and Users links to the `/admin/messages` header so it matches the
  rest of the admin navigation, with only Messages underlined as active.
  Verified in-browser, `npm run lint`, and `npm run build`.
- **Admin nav active underline refined (2026-06-15):** renamed the Product
  Admin header label to `Products` and changed admin navigation so inactive menu
  links are not underlined; only the current section is underlined. Verified
  in-browser, `npm run lint`, and `npm run build`.
- **Product Admin menu styling aligned (2026-06-15):** changed the main Product
  Admin navigation links for Orders, Messages, Inquiries, and Users from mixed
  button/text treatments to the same compact underlined text-link style used on
  the admin Messages page. Verified in-browser, `npm run lint`, and
  `npm run build`.
- **Admin Messages unread badge added (2026-06-15):** admin navigation now
  shows a compact unread count on the Messages tab/link across Product Admin,
  Orders, Order Detail, Inquiries, Users, and Messages. The badge reads live
  unread rows from `admin_notifications` and disappears when the count is zero.
  Verified in-browser, `npm run lint`, and `npm run build`.
- **Checkout admin notifications/messages/email added (2026-06-15):** checkout
  now submits the cart to `/api/checkout/order`, creates an unpaid order through
  a Supabase RPC, moves ordered products to `pending_payment`, adds an
  `admin_notifications` message, and emails the configured order recipient via
  Resend when `RESEND_API_KEY` is present. Added protected `/admin/messages`
  for unread/read admin order alerts. New live database setup is in
  `supabase/admin-notifications-checkout.sql`. Verified `npm run lint` and
  `npm run build`.
- **Product Admin SKU field collapsed (2026-06-15):** removed SKU from the main
  inventory table and tucked SKU/Public Slug behind a compact optional
  `SKU / Slug` expander in the product form. Inventory number remains the
  primary visible identifier. Verified `npm run lint` and `npm run build`.
- **Inventory number made numeric (2026-06-15):** Product Admin inventory
  numbers now use a numeric-only input and product typing treats
  `inventory_number` as an integer. Added
  `supabase/inventory-number-numeric.sql` to convert existing Supabase projects
  that previously created `products.inventory_number` as text. Order item
  snapshots still keep inventory number as text to preserve historical invoices
  and receipts.
- **Orders/Sales admin section added (2026-06-15):** added protected
  `/admin/orders` and `/admin/orders/[id]` routes. Admins can create manual
  orders from available products, snapshot item details into `order_items`,
  move selected products to `pending_payment`, search/filter order lists, and
  manage order detail status actions. Mark Paid sets products to `sold`; Mark
  Unpaid returns products to `pending_payment`; cancelling unpaid orders returns
  products to `available`; refunds do not automatically relist products. Added
  invoice record generation as a bridge to the next invoice/receipt chunk.
  Verified in-browser, `npm run lint`, and `npm run build`.
- **Sales workflow foundation / inventory lifecycle chunk added (2026-06-15):**
  added `supabase/sales-workflow.sql` with additive product lifecycle fields,
  `orders`, `order_items`, `invoices`, `saved_items`, stronger inquiry/profile
  fields, timestamps, grants, and RLS policies. Product Admin now supports
  lifecycle statuses (`draft`, `available`, `reserved`, `pending_payment`,
  `sold`, `archived`), location, featured, SKU/inventory search, expanded
  filters, Duplicate/Reserve/Sold/Archive quick actions, and guarded delete
  behavior that archives products with order history. Public shop/cart/product
  pages now treat unavailable lifecycle states as not purchasable. Verified
  `npm run lint` and `npm run build` from `next-app/`.
- **Admin account users table added (2026-06-15):** added a protected
  `/admin/users` route linked from the product admin header. The page reads live
  `profiles` rows for admin users and displays account contact, location,
  marketing opt-in, VIP/admin flags, and timestamps. Added
  `supabase/admin-profile-read-policy.sql` plus the same policy helper to
  `supabase/schema.sql`. Verified `npm run build` passes; `npm run lint` is
  still blocked by existing cart/wishlist hydration lint errors.
- **Mobile shop card cart button overflow fixed (2026-06-13):** shop gallery
  cart buttons now use tighter card-specific spacing and compact Add/Remove
  labels on slim mobile screens, preventing "Remove from Cart" overflow.
  Verified 320px and 375px mobile widths in-browser; `npm run build` passes.
- **Shop sort dropdown added (2026-06-13):** the shop filter pop-out now
  includes a Sort dropdown for inventory order, price low/high, price high/low,
  weight low/high, and weight high/low. Sorting is URL-backed via `sort` and
  preserves Available items before Sold items. Verified `/shop?sort=price-asc`
  and `/shop?sort=weight-desc` in-browser; `npm run build` passes.
- **Estate route redirect loop fixed (2026-06-13):** updated the Next proxy so
  internal English-locale rewrites keep the locale header on the second pass.
  `/estate-jewelry`, `/estate-services`, and Spanish equivalents now render
  without looping. Verified `/estate-jewelry` in-browser; `npm run build`
  passes.
- **Admin drag-to-reorder inventory added (2026-06-13):** product admin now
  shows an Order grip column in the clean master list. Dragging a row onto
  another row saves the reordered `sort_order` values to Supabase for the
  matching Available/Sold group, updating gallery inventory order. Sorting,
  search, and filters disable drag mode until the view is reset. Verified
  `/admin` render in-browser; `npm run build` passes.
- **Account profile full-name field hidden (2026-06-13):** removed the visible
  Full Name input from the complete account profile form while continuing to
  maintain `full_name` internally from first/last name. Verified `/account`
  in-browser; `npm run build` passes.
- **Complete customer profiles added (2026-06-13):** expanded account profiles
  with editable first/last/full name, contact email, phone, alternate phone,
  complete address, country, and marketing opt-in fields. Added
  `supabase/profile-contact-fields.sql` for existing Supabase projects and
  updated checkout prefill to use saved profile contact data. Verified
  `/account` render in-browser; `npm run build` passes.
- **Checkout account prefill added (2026-06-13):** checkout now looks up the
  signed-in Supabase user/profile and fills blank customer fields from known
  account data, including profile name, auth email, and phone metadata when
  present. Fields remain editable. Verified build and in-browser email prefill;
  `npm run build` passes.
- **Checkout-to-payment step added (2026-06-13):** removed the checkout
  secure-payment placeholder, changed the checkout submit button to "Continue
  to Payment," and added a new `/payment` route with payment fields plus a
  second shared order summary that carries the selected shipping option.
  Verified in-browser; `npm run build` passes.
- **Checkout shipping rates added (2026-06-13):** checkout shipping now prices
  Local Pickup at $0, Express Overnight Insured at $75, and Priority Insured at
  $45, with the selected shipping cost included in the estimated total.
  Verified in-browser; `npm run build` passes.
- **Checkout shipping option selector added (2026-06-13):** added a shipping
  dropdown under Florida sales tax in the checkout order summary with Local
  Pickup, Express Overnight, and Priority Insured options. Verified in-browser;
  `npm run build` passes.
- **Checkout summary remove control added (2026-06-13):** the right-hand
  checkout order summary now has a per-item remove button wired to the shared
  cart state, so removing an item updates the summary totals immediately.
  Verified in-browser; `npm run build` passes.
- **Shop length filter scoped by item type (2026-06-13):** length buttons now
  appear only after choosing Necklace or Bracelet in Item Type. Necklace shows
  chain lengths only, Bracelet shows bracelet lengths only, and server-side
  filtering ignores incompatible hidden length values. Verified in-browser;
  `npm run build` passes.
- **Shop length buttons made checkable (2026-06-13):** updated the horizontal
  length multi-select controls to read as checkable buttons with an embedded
  checked-state indicator while preserving URL-backed multi-select behavior.
  Verified in-browser; `npm run build` passes.
- **Shop card cart button alignment fixed (2026-06-13):** standardized gallery
  card title height and pushed action rows to the card bottom so cart buttons
  align consistently across cards with different title lengths. Card buttons
  now keep a fixed-height/no-wrap layout. Verified desktop/mobile in-browser;
  `npm run build` passes.
- **Shop length selector layout refined (2026-06-13):** moved the shop length
  multi-select out of the dropdown grid and into a horizontal row of selectable
  buttons underneath the main filter dropdowns. Verified in-browser;
  `npm run build` passes.
- **Shop length multi-select added (2026-06-13):** changed the shop gallery
  length filter from a single dropdown to a checkbox group so shoppers can
  select multiple lengths at once. The filter stays URL-backed with a stable
  comma-separated `length` value. Verified in-browser; `npm run build` passes.
- **Product detail scrap value added (2026-06-13):** individual shop product
  pages now show the current scrap gold/silver value directly under "This is
  your price," using the same live spot melt calculation as the trade-in callout.
  Verified in-browser; `npm run build` passes.
- **Shop card cart toggle updated (2026-06-13):** gallery card "Add to Cart"
  buttons now show a brief local "Added to cart" confirmation, switch to
  "Remove from Cart" after adding, and remove the item when clicked again.
  Verified in-browser; `npm run build` passes.
- **Admin inventory numbers added (2026-06-13):** added an "Inv #" column to
  the product admin table. Numbers are derived from the public shop's unfiltered
  master-gallery order: available items first, then sold items, preserving
  `sort_order` inside each group. Verified against `/shop`; `npm run build`
  passes.
- **Admin product table sorting added (2026-06-13):** made product admin table
  headers clickable for sorting by image presence, title, category, gender,
  chain type, length, purity, weight, price mode, current price, and status.
  Verified in-browser; `npm run build` passes.
- **Shop menu reorganized (2026-06-13):** changed the header Shop item into a
  dropdown/accordion with "Store" linking to `/shop` and "Auctions" linking to
  `/auctions`, and removed the standalone top-level Auctions nav item. Verified
  desktop/mobile in-browser; `npm run build` passes.
- **Checkout split into standalone page (2026-06-13):** changed the cart drawer
  to remain cart-only, moved checkout into a dedicated `/checkout` route with
  customer form/order summary/confirmation state, and made "Proceed to
  Checkout" navigate to that page. Verified in-browser; `npm run build` passes.
- **Auctions page and header link added (2026-06-13):** added a localized
  `/auctions` route, placed an Auctions nav item between Sell and About in the
  header, and added the page to the sitemap. Verified in-browser;
  `npm run build` passes.
- **About menu and Services page added (2026-06-13):** changed the header About
  nav item into a dropdown with "About Us" and "Other Services," added a new
  `/services` route with buttons to Free Evaluation and Estate Services, and
  added the route to the sitemap. Verified in-browser; `npm run build` passes.
- **Sell submenu labels updated (2026-06-13):** changed English header submenu
  labels to "Sell Us Gold," "Sell Us Silver," and "Sell Us Bullion." Verified
  the shop header in-browser; `npm run build` passes.
- **Header Sell label shortened (2026-06-13):** changed the English main
  header navigation label from "Sell To Us" to "Sell." Verified the shop header
  in-browser; `npm run build` passes.
- **Shop card price amount bolded (2026-06-13):** increased the gallery card
  price amount weight while keeping the "Your price" label bold. Verified
  computed styles in-browser; `npm run build` passes.
- **Shop card price label matched to price (2026-06-13):** changed the gallery
  card "Your price" label to match the price amount font size and bold weight.
  Verified computed styles in-browser; `npm run build` passes.
- **Shop card spacing/spec text refined (2026-06-13):** tightened the vertical
  space between gallery card titles and prices, and increased the purity/grams
  line size/weight. Verified rendered card spacing in-browser; `npm run build`
  passes.
- **Shop gallery widened for desktop (2026-06-13):** widened the shop page
  container and increased gallery density so desktop shows 4 columns, 2xl
  screens show 5 columns, and very wide screens show 6 columns. Verified at
  1440px, 1536px, and 1800px in-browser; `npm run build` passes.
- **Shop card action row simplified (2026-06-13):** removed the Inquire button
  from gallery product cards and changed the compact cart button label to “Add
  to Cart.” Verified in-browser; `npm run build` passes.
- **Shop card typography tuned (2026-06-13):** decreased gallery card product
  title size and increased the purity/grams spec line size for better scan
  balance. Verified computed card text sizes in-browser; `npm run build` passes.
- **Shop card price/spec display updated (2026-06-13):** changed gallery cards
  so the price row includes “Your price” beside the price and the former
  spot-price context line now shows each item’s purity and gram weight. Verified
  the shop cards in-browser; `npm run build` passes.
- **Shop live metal price strip added (2026-06-13):** added live silver and
  gold spot-price badges around the main shop search bar, using the existing
  `fetchSpotData` data already fetched for product pricing. Verified desktop
  and mobile layout in-browser; `npm run build` passes.
- **Shop item-type filter added (2026-06-13):** added an Item Type dropdown to
  the hidden shop filter panel for broad product categories such as necklaces,
  bracelets, earrings, rings, pendants, and watches. The filter is URL-backed
  via `itemType` and was verified in-browser; `npm run build` passes.
- **Shop filter panel collapsed behind button (2026-06-13):** updated
  `next-app/src/components/shop/ShopFilters.tsx` so the main shop keeps search
  and result count visible while hiding metal, purity, chain type, gender,
  length, and available-only controls behind a Filter button. Verified opening
  the panel and applying a filter in-browser; `npm run build` passes.
- **Product images fit without cropping (2026-06-13):** changed product image
  displays from cover/crop to contain/fit on shop cards, product detail
  galleries, admin thumbnails, cart thumbnails, and wishlist thumbnails. Updated
  gallery zoom math for contained images. Verified product/shop pages
  in-browser and `npm run build`.
- **Mobile product image magnification added (2026-06-13):** updated
  `next-app/src/components/shop/ProductImageGallery.tsx` so product-detail
  galleries support touch/pen press-and-drag zoom on mobile while preserving
  desktop hover zoom. Verified the product route in the in-app browser and
  confirmed `npm run build` passes.
- **English redirect loop fixed (2026-06-13):** updated `next-app/src/proxy.ts`
  so unprefixed English routes (`/`, `/shop`, etc.) rewrite internally to
  `/en/...` without being canonicalized back to themselves. Direct `/en` URLs
  still redirect to unprefixed canonical English URLs, and `/es` routes remain
  unchanged. Verified `npm run build` passes.
- **Legacy static site removed (2026-06-13):** deleted root static pages, `es/`,
  old vanilla scripts, root copied assets, old Netlify Function, static tooling,
  empty staging folders, old static admin, and unused create-next-app
  SVG/reference files.
- **Docs updated for the Next app (2026-06-13):** rewrote `AGENTS.md`,
  `ACCOUNT_SETUP.md`, `STRUCTURE.md`, `INTEGRITY.md`, and `ARCHITECTURE.md`;
  updated current status, tasks, changelog, overview, client notes, and root
  Netlify redirects.
- **Legacy removal audit (2026-06-13):** generated
  `project-docs/LEGACY_REMOVAL_REPORT.md`, identifying current Next runtime
  files, root static-site deletion candidates, files to keep, and the cleanup
  plan.

## Current Priorities

1. Migrate the remaining legacy local-only product photos to Supabase Storage
   so product image bytes live consistently outside the app bundle. The
   previous 91 old unreferenced `product-images/products` objects have already
   been deleted after archive + confirm-run.
2. Configure AI assistant environment variables before using live generation:
   `AI_PROVIDER`, `AI_MODEL`, the matching provider API key or local endpoint,
   and optional limits such as `AI_MAX_IMAGES`, `AI_RATE_LIMIT_HOURLY`, and
   `AI_RATE_LIMIT_DAILY`.
3. Have the business owner/counsel review the new compliance policies and
   confirm returns/refunds, shipping, auction, vendor, and dispute-resolution
   language before production reliance.
4. Apply `supabase/compliance-consent.sql` so live account profiles persist
   Terms/Privacy/age acceptance copied from Supabase Auth metadata.
5. Apply `supabase/email-marketing.sql` so live subscribers/accounts can use the
   opt-out marketing audience, one-click unsubscribe tokens, campaign audit
   tables, webhook events, and editable mailing address setting. This supersedes
   the standalone subscriber-only setup but keeps `supabase/homepage-subscribers.sql`
   compatible.
6. Apply `supabase/product-type-metal-type.sql` to the live Supabase project so
   products can persist/backfill Product Type and Metal Type; this current
   migration also includes a safety add for the missing `products.brand` column.
7. Apply `supabase/product-item-year.sql`, then re-run
   `supabase/admin-notifications-checkout.sql`, so live products persist the
   Product Admin Date (Year Made) field (`products.item_year`) and order items
   can snapshot it. This drops the old `item_date` column, clearing the
   listing-creation dates backfilled into it. Until it is applied, Date UI
   reads/writes degrade to blank/no-persist without breaking shop/order pages;
   checkout will fail between applying the migration and re-running the function.
8. Apply `supabase/product-image-padding.sql` so Product Admin can persist the
   per-product image frame padding choice, including custom `#rrggbb` colors,
   used by shop cards and detail pages.
9. Apply `supabase/product-brand.sql` to the live Supabase project so products
   can persist Brand values.
10. Correct the current duplicate live inventory `#21` product row, then apply
   `supabase/product-inventory-number-unique.sql` to enforce unique product
   inventory numbers in Supabase.
11. Apply `supabase/product-jewelry-type.sql` to the live Supabase project so
   products can persist Jewelry Type and scope Link Type to necklace/bracelet
   rows.
12. Apply `supabase/product-metal-variants.sql` to the live Supabase project so
   products can persist Yellow Gold, White Gold, Rose Gold, Tricolor Gold,
   Bicolor Gold, Silver, Vermeil, and Platinum subtype selections.
13. Apply `supabase/homepage-subscribers.sql` to the live Supabase project so
   the homepage subscriber CTA and `/admin/subscribers` table use live data.
14. Apply `supabase/order-item-line-discounts.sql` so manual orders and emailed
   invoices can persist per-item line discounts.
15. Apply `supabase/admin-notifications-checkout.sql` to the live Supabase
   project after `sales-workflow.sql` so public checkout can create orders and
   admin message-center notifications.
16. Run a Netlify preview smoke test after the cleanup deploy.
17. Keep historical static-site notes clearly framed as history; active
   guidance has been swept for the current Next/Supabase app.
18. Keep Supabase product inventory current through the Next/Supabase product
   flow.
19. Confirm Supabase Auth redirect URLs include `https://naplesestatejewelry.co/**`
   and localhost dev URLs.
20. Fill in unknowns in `CLIENTS.md` (Netlify site name/ID, DNS registrar,
   maintenance plan, billing status, credential locations).

## Active Blockers

- No CI is documented yet beyond Netlify running `npm run build`.
- A production preview smoke test is still needed after this cleanup.

## Verification

- Last known good local commands from `next-app/`:
  `npx tsc --noEmit`, `npm run lint`, and `npm run build`.
