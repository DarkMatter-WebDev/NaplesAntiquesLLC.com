# Architecture

> Update whenever significant structural changes occur. Last updated:
> **2026-07-08** after the Etsy sync build (Phase 1 + Phase 2 code-complete,
> unverified live — see `project-docs/features/etsy-sync.md`).

## System Design

The active site is a **Next.js App Router** app in `next-app/`, deployed on
Netlify with `@netlify/plugin-nextjs`.

```text
Browser
  â”œâ”€â”€ Next localized routes (/ and /es)
  â”œâ”€â”€ React components and context (cart, wishlist, layout, admin, legal notice)
  â”œâ”€â”€ Next route handlers (/api/metal-prices, /api/inquire, /api/inquiries/:id,
  â”‚   /api/checkout/order, /api/paypal/create-order, /api/paypal/capture-order,
  â”‚   /api/paypal/webhook, /api/subscribe, /api/unsubscribe,
  â”‚   /api/admin/marketing/*, /api/webhooks/resend)
  â””â”€â”€ Public assets from next-app/public/assets
        â”‚
        â”œâ”€â”€> Supabase Auth + Postgres + Storage
        â”œâ”€â”€> gold-api.com via server-side spot-price helper
        â”œâ”€â”€> PayPal Orders API v2 (sandbox/live) for online payments
        â””â”€â”€> Resend for inquiry/order and direct marketing email when configured
```

The old root `*.html`, `es/`, `scripts/`, root `assets/`, and
`netlify/functions/` runtime have been removed.

## Folder Structure

```text
NaplesEstateJewelry.co/
â”œâ”€â”€ AGENTS.md
â”œâ”€â”€ ACCOUNT_SETUP.md
â”œâ”€â”€ netlify.toml                 # Netlify parent config: base = next-app
â”œâ”€â”€ .gitignore
â”œâ”€â”€ project-docs/                # project memory
â”œâ”€â”€ supabase/                    # SQL schema/policy scripts
â””â”€â”€ next-app/
    â”œâ”€â”€ package.json
    â”œâ”€â”€ package-lock.json
    â”œâ”€â”€ netlify.toml             # app-local Netlify config
    â”œâ”€â”€ next.config.ts
    â”œâ”€â”€ messages/                # next-intl messages
    â”œâ”€â”€ public/
    â”‚   â”œâ”€â”€ assets/              # local images/video
    â”‚   â””â”€â”€ netlify-forms.html
    â””â”€â”€ src/
        â”œâ”€â”€ app/                 # routes, metadata, APIs
        â”œâ”€â”€ components/          # layout/shop/admin/account/contact UI
        â”œâ”€â”€ context/             # cart + wishlist context
        â”œâ”€â”€ i18n/                # next-intl routing/request config
        â”œâ”€â”€ lib/                 # pricing, spot price, Supabase clients
        â””â”€â”€ types/               # shared TypeScript contracts
```

## Routing

Localized pages live under `next-app/src/app/[locale]/`. The localized
homepage route is grouped under `next-app/src/app/[locale]/(home)/` so its
branded loading fallback does not wrap every internal localized route.

Current route families include:

- `/` and `/es`
- `/about`, `/contact`, `/free-evaluation`, `/privacy`, `/terms`,
  `/cookie-preferences`, `/accessibility`, `/returns-refunds`, `/shipping`,
  `/auction-terms`, `/vendor-terms`, `/unsubscribe`, `/faq`
- `/estate-jewelry`, `/estate-services`, `/gold-services`,
  `/silver-services`, `/bullion`
- `/shop` and `/shop/[id]`
- `/account`, `/account/sign-in`, `/account/sign-up`
- `/admin`, `/admin/orders`, `/admin/orders/[id]`, `/admin/messages`,
  `/admin/inquiries`, `/admin/subscribers`, `/admin/marketing`,
  `/admin/settings`, `/admin/users`, `/admin/users/[id]/invoices`,
  `/admin/orders/[id]/invoice`, and `/admin/orders/[id]/print`

## Compliance Foundation

The shared footer (`next-app/src/components/layout/SiteFooter.tsx`) exposes a
Legal column on every page using the shared footer. Legal/policy pages share the
`LegalPolicyPage` renderer under `next-app/src/components/legal/`.

Marketing email uses `next-app/src/lib/marketing.ts` as the single audience and
send chokepoint. Newsletter subscribers are explicit opt-in via
`homepage_subscribers`; account holders are included by default unless
`profiles.marketing_opt_out = true`. Admin campaign pages and APIs use the
service-role Supabase client server-side only, require an admin profile check,
and refuse marketing sends until a physical mailing address is configured in
`marketing_settings`.

The locale layout mounts `CookieNotice`, which stores only a notice-accepted
flag in localStorage. `Cookie Preferences` lets visitors reset/accept that
notice. Source review on 2026-06-19 found no GA/GTM/Meta Pixel/Clarity/Hotjar
tracking code in the app; if non-essential tracking is added later, the policy
and cookie preference UI need a real opt-in/out update.

Account registration stores Terms/Privacy acceptance in Supabase Auth user
metadata. `supabase/compliance-consent.sql` and `supabase/schema.sql` add
matching `profiles` fields for acceptance timestamps and accepted policy version
so the live database can copy those values into profile records. Homepage
subscribers can opt out through `/unsubscribe`, which
posts to `/api/unsubscribe` and calls the `unsubscribe_homepage` RPC added to
`supabase/homepage-subscribers.sql`.

## Carousel Hero

The **home page** hero (`next-app/src/components/home/HomeHero.tsx`) is the 3D
carousel widget (`next-app/carousel`), replacing the old MP4 ring video. Storefront
CTAs route directly to `/shop`; there is no intermediate `/store` chooser route.
The ring is **windowed/infinite** (only an admin-set number of cards exist at
once; the curated list cycles through), photos carry a per-photo **White/Black
group** that drives a **swept** hero background, images go through `next/image`
with an off-screen preloader, and an `IntersectionObserver` pauses it offscreen.
Admin curation is at `/admin/settings` â†’ `Store Carousel Hero`, backed by
`next-app/carousel/lib/carouselData.ts`. The
hero reads `carousel_selection` + `carousel_settings` on the client and falls back
to hardcoded items if the tables are absent/empty. Setup SQL: `next-app/carousel/
sql/setup.sql` (+ `add-per-item-bg.sql`, `add-visible-count.sql`,
`add-visible-count-mobile.sql`). Full detail: `project-docs/features/carousel-hero.md`.

## Customer-Facing Reveal Motion

The locale layout mounts `next-app/src/components/layout/CustomerReveal.tsx`
inside `data-customer-reveal-root`. It is a small client-side coordinator that
adds loaded-block entrance reveals on customer-facing localized pages while
skipping `/admin` routes. Each selected block waits for its own descendant
images, CSS background images, and `document.fonts.ready` before moving from
`data-customer-reveal="pending"` to `visible`; image errors count as complete so
content does not remain hidden. Large shop gallery parents are excluded because
product cards already have their own image-aware reveal and lazy offscreen
images should not block the whole gallery. Shared CSS lives in
`next-app/src/app/globals.css` and disables the motion for reduced-motion users
and print. The home carousel hero carries `data-customer-reveal-skip` because
the 3D carousel depends on unmodified ancestor transform/filter state and its
own admin-driven visible-count/windowing behavior. `HomeHero` owns a local
top-down readiness fade instead: after carousel data/settings settle and the
visible ring image URLs plus fonts are ready, the headline fades in first, the
carousel layer second, and the subscriber/actions layer last while preserving
the existing centered `translateX(-50%)` transforms.

Next-generated SEO endpoints:

- `/robots.txt` from `next-app/src/app/robots.ts`
- `/sitemap.xml` from `next-app/src/app/sitemap.ts`

Current route handlers include `/api/metal-prices`, `/api/inquire`,
`/api/inquiries/[id]`, `/api/checkout/order`, `/api/contact-message`,
`/api/subscribe`, `/api/unsubscribe`, the PayPal family
(`/api/paypal/create-order`, `/api/paypal/capture-order`,
`/api/paypal/webhook`), and admin-only routes
under `/api/admin/*` (`ai-product-fill`, `ai-settings`, `messages`,
`subscribers`, `translate`, `storage-gc`, `users/[id]`,
`orders/[id]/invoice`, `orders/[id]/email-invoice`,
`orders/[id]/email-update`, `marketing/*`). This
list is representative, not exhaustive â€” see `next-app/src/app/api/` for the
full route tree.

## Data Model

Supabase is the source for app data:

- `products` - shop catalog, pricing inputs, copy, lifecycle status, images,
  inventory/SKU fields, new primary Product Type (`product_type`) with legacy
  `jewelry_type` fallback, secondary Metal Type (`metal_type`) with legacy
  Gold/Silver `category` pricing fallback, Metal Color (`metal_variant`),
  necklace/bracelet Link Type (`chain_type`), location, featured flag, bilingual
  public notes (`public_notes` = Notes (EN), `public_notes_es` = Notes (ES),
  shown on the /es product page), and admin-only cost/acquisition fields. The
  legacy `internal_notes` column is retained for the `details` fold but no longer
  surfaced in the listing form.
- `orders` - order headers/customer totals/payment/fulfillment state, plus PayPal
  references (`paypal_order_id`, `paypal_capture_id`, `payment_response`, `paid_at`)
  and legacy `reserved_until` compatibility data. `deleted_at` powers the admin Orders
  Recycle Bin (`/admin/orders?view=trash`). `customer_notes` and the `shipping_address` jsonb
  (line1/line2/city/state/postal_code/country) are shown on the order detail page and
  the invoice email.
- `order_items` - immutable product snapshots attached to orders (incl. `discount`).
- `invoices` - invoice headers/totals/status for order-linked billing. New
  PayPal and manual admin orders generate a draft invoice row at order creation;
  paid capture updates the same row to `paid`; the order detail page can
  generate/refresh the row for older orders.
- `webhook_events` - idempotent log of PayPal (and future provider) webhook events,
  unique on `(provider, event_id)`.
- `admin_notifications` - admin message center notifications for contact messages
  and inquiries. (PayPal order events no longer write here â€” paid orders surface on
  the Orders-tab badge instead.)
- `homepage_subscribers` - homepage subscriber CTA signups displayed in the
  admin Subscribers tab.
- `saved_items` - account-linked saved item records for the next account phase.
- `profiles` - customer profile/contact/address details plus admin/VIP flags.
- `favorites` / cart-related account data - customer saved state.
- `inquiries` - submitted seller/buyer inquiries.
- `ai_settings` - single-row table holding the optional admin override for the
  AI listing-assistant system prompt (NULL = use the built-in default).
- `carousel_selection` / `carousel_settings` - Carousel Hero curation. Selection:
  `product_id`, `position`, `bg_color` (per-photo White/Black group). Settings:
  `show_price`, `bg_color` (legacy default), `visible_count` (desktop ring size),
  `visible_count_mobile`.
- `etsy_connection` / `etsy_oauth_states` / `etsy_listings` /
  `etsy_listing_images` / `etsy_sync_log` - Etsy sync (2026-07-08, see
  "Etsy Sync" below). **Written in `supabase/etsy-sync.sql`, not yet applied.**
- `ebay_connection` / `ebay_oauth_states` / `ebay_listings` /
  `ebay_sync_log` - eBay sync (2026-07-09, see "eBay Sync" below); one fewer
  table than Etsy (no per-image table — eBay takes image URLs directly).
  **Written in `supabase/ebay-sync.sql`, not yet applied.**

SQL setup and policy scripts live in `supabase/`.

Anonymous public reads should use `next-app/src/lib/supabase/public.ts`, which
creates a cookie-free Supabase anon client for server-side rendering. The
cookie-backed server client is reserved for user-state routes/actions that need
the logged-in Supabase session. As of 2026-06-22, the proxy refreshes Supabase
sessions only for account/admin/checkout/payment paths so marketing/legal/service
pages can prerender and cache without harmless public reads forcing
request-time rendering.

Existing Supabase projects should run `supabase/profile-contact-fields.sql` to
add the full editable customer profile fields used by `/account` and checkout
prefill.

Existing Supabase projects should also run
`supabase/admin-profile-read-policy.sql` before using `/admin/users`; it adds a
security-definer admin check and an RLS policy so admin accounts can read the
complete `profiles` table.

Existing Supabase projects should run `next-app/sql/ai-settings-setup.sql` to
create the admin-only `ai_settings` table and the `is_app_admin()` helper that
back the editable AI listing-assistant prompt. Until it is run, the Settings
panel still shows the default prompt, but saving a custom prompt fails with a
clear "table not found" error.

Existing Supabase projects should run `supabase/sales-workflow.sql` before
using Orders/Sales, invoices, saved item records, guarded product delete, or the
new product lifecycle fields in production.

Existing Supabase projects should run `supabase/product-jewelry-type.sql` to add
and backfill `products.jewelry_type` for the separated Jewelry Type / Link Type
catalog model.

Existing Supabase projects should run `supabase/product-type-metal-type.sql` to
add and backfill nullable `products.product_type` and `products.metal_type`.
The app currently dual-writes these fields while preserving `jewelry_type` and
`category` for compatibility.

Existing Supabase projects should run
`supabase/admin-notifications-checkout.sql` after `sales-workflow.sql` before
using public checkout order submission or `/admin/messages` in production.

Existing Supabase projects should run `supabase/homepage-subscribers.sql`
before using the homepage subscriber CTA or `/admin/subscribers` in production.

Existing Supabase projects must run `supabase/order-item-line-discounts.sql`
(adds `order_items.discount`) â€” without it the admin Orders list query errors and
shows no orders â€” and the PayPal SQL runbook (`supabase/paypal-checkout.sql`, then
`supabase/no-reservation-checkout.sql`) before using PayPal checkout. Those scripts add
PayPal columns, the `webhook_events` table, current create/capture/event RPCs, and the
`service_role` table grants.

Existing Supabase projects should run `supabase/orders-recycle-bin.sql` before using
admin order deletion. Until `orders.deleted_at` exists, the app shows a migration notice
and blocks the Orders Recycle Bin delete/restore actions.

## Product Images

Products can use:

- local paths under `/assets/...`, served from `next-app/public/assets/...`
- Supabase Storage public URLs for uploaded admin images

Remote Supabase Storage images are allowed in `next-app/next.config.ts`.

Product image bytes are intentionally stored outside product rows. The
`products.images` and `products.image_urls` arrays store URL/path strings only;
new uploads go to Supabase Storage bucket `product-images` under `products/`.
The admin upload path compresses images to WebP before upload, then stores the
returned public URL on the product record. Public shop/card/detail rendering
prefers `image_urls` and falls back to `images`.

2026-06-20 live audit: 48 products, 321 entries in each image array, zero
`data:`/inline image payloads, 28 Storage-only products, 19 local-only legacy
products, 1 mixed product, and 202 DB-referenced Storage objects all present.
The subsequent confirmed Storage GC deleted 91 old unreferenced objects; the
follow-up dry-run reported 202 objects, 202 referenced paths, 0 orphans, and 0
deletable paths. The DB-backed local shop PNG paths were migrated to WebP and
the 114 repointed shop PNG originals were removed, leaving no PNG files under
`next-app/public/assets`.

## Pricing

Metal pricing is server-side:

- `next-app/src/lib/spot-price.ts` fetches gold/silver spot data from
  `api.gold-api.com` with a fallback.
- `next-app/src/app/api/metal-prices/route.ts` exposes the app API.
- `next-app/src/lib/pricing.ts` computes display pricing.

## Payments (PayPal)

Online payment runs through PayPal on the existing `/checkout` page (the older
manual unpaid-order flow via `/api/checkout/order` is retained but no longer the
storefront path; `/payment` stays a disabled placeholder). Full runbook:
`project-docs/features/paypal-checkout.md`.

- **Frontend:** `next-app/src/components/checkout/PayPalCheckoutButton.tsx` loads
  the PayPal JS SDK (client id passed from the server checkout page, not a
  `NEXT_PUBLIC_*` var) and renders the PayPal + card buttons. It validates contact
  (and, when shipping, address) fields in PayPal's `onClick` before opening the
  window. The shipping method is chosen on the Order Summary's "Shipping" row; the
  Shipping Address block sits in the left review column under the summary.
- **Server lib:** `next-app/src/lib/paypal.ts` (OAuth token cache, Orders v2
  create/capture, `verifyPayPalWebhook`). `next-app/src/lib/checkout-pricing.ts`
  is the single source of truth for authoritative subtotal/7%-tax/shipping/total
  (also used by the legacy checkout route). **No amounts are trusted from the
  browser.**
- **Routes:** `POST /api/paypal/create-order` (build authoritative order, create
  PayPal order â€” no inventory hold), `POST /api/paypal/capture-order`
  (capture, verify amount+currency, mark paid + products sold, resolve the
  concurrent-buyer race), `POST /api/paypal/webhook` (signature-verified,
  idempotent via `webhook_events`).
- **Invoices:** PayPal create-order and manual admin order creation generate a
  draft invoice row with `upsertOrderInvoice`; paid capture calls the same helper
  so the existing row becomes `paid` instead of creating a duplicate. Admin order
  detail can generate/refresh this row for older orders.
- **Capture-on-approve (2026-07-03):** the sale is captured in the PayPal
  Buttons `onApprove` callback the moment the buyer hits **Pay Now** in the
  PayPal window; on return to our tab they land directly on the "Order Received"
  confirmation. There is no confirm-on-return review screen and no sessionStorage
  resume machinery (both removed â€” the earlier 2026-07-02 reload/eviction-resume
  approach with `GET /api/paypal/order-status` was reverted). Since nothing is
  reserved, a tab evicted after approval but before capture simply leaves the item
  available (buyer can retry / another buyer can purchase); the
  `PAYMENT.CAPTURE.COMPLETED` webhook still reconciles any capture that landed.
  Detail: `features/paypal-checkout.md`.
- **Inventory â€” whoever pays first gets the item (2026-07-03):** there is **no
  reservation**. `create_paypal_order` creates the order and leaves the one-of-one
  products `available`, so multiple buyers can check out the same piece at once.
  `capture_paypal_order` resolves the race: it row-locks the product rows, and if
  the item was already `sold` by a first buyer's capture it returns `item_conflict`
  (this order is flagged `failed` for a manual refund); otherwise it flips the
  products to `sold` and the order to `payment_status='paid'` /
  `order_status='completed'`. Capture + denial/refund webhook call
  `revalidateTag('shop-catalog', { expire: 0 })` so sold items leave the gallery
  promptly. The old 30-min `reserve_paypal_order` hold + expiry sweep were removed
  (`no-reservation-checkout.sql`). The active app has no manual admin **Reserved**
  product status.
- **Admin surfacing:** the admin **Orders** nav badge (`AdminOrdersLink`) counts active
  orders created after that admin/browser last viewed Orders; paid orders no longer
  surface in the Messages center.
- **Env:** `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_ENV`
  (sandbox/live â€” creds must match the env), `PAYPAL_WEBHOOK_ID`.

## Etsy Sync (2026-07-08 — code-complete, unverified live)

One-way push (Supabase `products` → an Etsy shop, as a secondary sales
channel). Full plan: `etsy-sync-plan/` (17 docs); full build report: owner
checklist in `etsy-sync-plan/OWNER-SETUP.md`; feature detail:
`project-docs/features/etsy-sync.md`.

- **Module:** `next-app/src/lib/etsy/` — `client.ts` (fetch wrapper: x-api-key
  + bearer, throttle, 429/5xx backoff, typed `EtsyApiError`), `auth.ts` (OAuth
  2.0 + PKCE, AES-256-GCM token encryption, refresh with rotation), `mapping.ts`
  (pure `Product` → Etsy payload functions: title/tags/materials/`when_made`/
  price/taxonomy/pre-flight — unit-tested), `images.ts` (Supabase Storage/
  `/assets` fetch → `sharp` WebP→JPEG transcode → upload; image-diff
  planning), `sync.ts` (the step machine: draft → images → inventory →
  activate/draft-review, plus Phase 2 bulk queue drain, content-hash
  out-of-date detection, and the scheduled price push), `store.ts` (typed
  access to the `etsy_*` tables).
- **Tables (`supabase/etsy-sync.sql`, written, not yet run):**
  `etsy_connection` (single-row OAuth + shop defaults + sync policy),
  `etsy_oauth_states` (transient PKCE handshake), `etsy_listings`
  (product↔listing mapping + sync-state machine + content hash),
  `etsy_listing_images` (per-image checkpoint), `etsy_sync_log`
  (audit/dead-letter). All RLS-enabled, service-role-only (same trust model
  as `webhook_events`); a `claim_next_pending_etsy_listing()` RPC does the
  atomic `FOR UPDATE SKIP LOCKED` queue claim for Phase 2's bulk drain.
- **Routes (all under `/api/admin/etsy/`, admin-gated + service-role client,
  same pattern as `/api/admin/ai-settings`):** `connect`, `callback`,
  `status`, `disconnect`, `settings`, `shop-profiles`, `preview` (dry-run, no
  Etsy calls), `sync`, `sync-batch` (Phase 2 enqueue/drain), `delist`,
  `listings` (bulk status map for the product table), `eligibility-summary`
  (bulk pre-flight counts), `price-push` (Phase 2 scheduled push — guarded by
  a shared secret header, not an admin session, since a cron has no browser
  session). Phase 3's `/api/webhooks/etsy` (Etsy order ingest) is
  deliberately **not built** — out of scope per the plan.
- **Admin UI:** `EtsySettingsPanel.tsx` (composed into `/admin/settings` —
  connect/disconnect, shipping/return/readiness dropdowns, sync policy
  toggles, recent activity log), a per-product Etsy status chip + drawer
  section (`EtsyProductPanel.tsx`, wired into `AdminShell.tsx` — dry-run
  preview, sync/sync-updates, delist/reactivate), and `EtsyBulkSyncModal.tsx`
  (Phase 2 "Sync All to Etsy" with a pre-flight summary and cancellable
  progress).
- **Phase 2 automation:** auto-delist/relist is triggered from
  `handleProductStatusChange()` (`lib/etsy/sync.ts`), called from the
  existing revalidation chokepoints — `adminRevalidateProduct(s)`
  (`app/actions/admin-products.ts`), PayPal `capture-order`, and the PayPal
  webhook — rather than a new "who changes product status" audit. Always
  best-effort/non-throwing and gated off unless `auto_delist_on_sold` is on.
- **Known gap before this is usable live:** Etsy taxonomy leaf IDs are
  unpinned (`null`) in `ETSY_TAXONOMY_MAP` — pre-flight correctly blocks every
  product until a developer runs `getSellerTaxonomyNodes` post-connect and
  fills them in. Four other spec details are pinned as best-guesses with
  `TODO(etsy-verify)` comments (image constraints, rate-limit header names,
  the readiness-state list endpoint, image re-rank semantics). See
  `project-docs/DECISIONS.md` 2026-07-08 (later) for the full list.

## eBay Sync (2026-07-09 — code-complete, unverified live)

One-way push (Supabase `products` → an eBay listing, as a secondary sales
channel), deliberately mirroring the Etsy Sync shape above. Full plan:
`ebay-sync-plan/` (18 docs); owner checklist:
`ebay-sync-plan/OWNER-SETUP.md`; feature detail:
`project-docs/features/ebay-sync.md`.

- **Module:** `next-app/src/lib/ebay/` — `client.ts` (fetch wrapper: Bearer
  auth, throttle, 429/5xx backoff, typed `EbayApiError`, cached
  client-credentials application token for Taxonomy/Metadata-class calls),
  `auth.ts` (OAuth 2.0 authorization-code, **no PKCE** — confidential
  client, Basic auth on token calls; AES-256-GCM token encryption;
  non-rotating ~18-month refresh token), `mapping.ts` (pure `Product` →
  `InventoryItem`+`Offer` payload functions: title/aspects/condition/
  category/price+markup/**Q16 price-tiered shipping-policy resolution**/
  pre-flight — unit-tested, 49 tests), `sync.ts` (the step machine:
  item → offer → review/published, plus Phase 2 bulk queue drain,
  content-hash out-of-date detection, and the scheduled price push —
  `drainQueueCore`/`shouldPushPrice` unit-tested, 9 tests), `store.ts`
  (typed access to the `ebay_*` tables). No `images.ts` — eBay's Inventory
  API takes public HTTPS image URLs directly, so the server never touches
  image bytes.
- **Tables (`supabase/ebay-sync.sql`, written, not yet run):**
  `ebay_connection` (single-row OAuth + account defaults, incl. the Q16
  express-shipping policy id + `high_value_shipping_threshold`),
  `ebay_oauth_states` (transient handshake state — no PKCE verifier column),
  `ebay_listings` (product↔SKU/offer/listing mapping + sync-state machine +
  content hash), `ebay_sync_log` (audit/dead-letter). All RLS-enabled,
  service-role-only; `claim_next_pending_ebay_listing()` RPC does the atomic
  `FOR UPDATE SKIP LOCKED` queue claim, with the re-enqueue/update detection
  and drain seen-guard built in from day one (a fix the Etsy build only
  added after a production incident).
- **Routes (all under `/api/admin/ebay/`, admin-gated, `{error:{code,message}}`
  error shape):** `connect`, `callback`, `status`, `disconnect`, `settings`,
  `account-profiles`, `preview` (dry-run, no eBay calls), `sync` (modes:
  `publish`/`update`/`price-only`/`publish-live`), `sync-batch` (Phase 2
  enqueue/drain), `delist` (hide/withdraw/restore), `listings` (bulk status
  map), `eligibility-summary`, `verify-listing`, `verify-all`, `price-push`
  (cron-secret-guarded), `push-prices`. Plus the Phase 0 compliance webhook
  `/api/webhooks/ebay-account-deletion` (GET challenge echo, POST
  signature-verified ack, reuses `webhook_events` for idempotency). Phase
  3's order-ingest route is deliberately **not built** — out of scope per Q15.
- **Admin UI:** `EbaySettingsPanel.tsx` (composed into `/admin/settings` next
  to `EtsySettingsPanel` — connect/disconnect, 5 policy fields incl. the
  Q16 express-shipping picker + threshold, markup save/stale-callout/
  push-now, recent activity), a per-product eBay status chip + drawer
  section (`EbayProductPanel.tsx`, wired into `AdminShell.tsx` next to the
  Etsy section — dry-run preview, sync/publish-on-eBay/price-only-push,
  hide/end/restore), and `EbayBulkSyncModal.tsx` (Phase 2 "Sync all to
  eBay" with a pre-flight summary and cancellable progress).
- **Phase 2 automation:** auto-hide (quantity-zero, Q7)/withdraw is
  triggered from `handleProductStatusChange()` (`lib/ebay/sync.ts`), added
  **next to** the existing Etsy call — never replacing it — at all three
  chokepoints: `adminRevalidateProduct(s)` (`app/actions/admin-products.ts`),
  PayPal `capture-order`, and the PayPal webhook. Always
  best-effort/non-throwing.
- **Structural differences from Etsy** (by design, not gaps): no draft
  state — `publishOffer` goes live immediately, so review-first (Q1) is
  enforced entirely by stopping the step machine at `review` until an
  explicit `publish-live` call; ~3-4 API calls per publish vs Etsy's ~12
  (no image upload calls); heavier one-time account prerequisites (Business
  Policy opt-in, inventory location, the account-deletion compliance gate)
  before the production keyset activates at all.
- **Known gaps before this is usable live:** no Fashion Jewelry eBay
  category id is pinned anywhere (vermeil items are correctly blocked at
  pre-flight rather than guessing one); item-aspect values aren't
  cross-checked against eBay's live SELECTION_ONLY value lists; no eBay
  username is resolved (out of the plan's OAuth scope list); this build
  environment had no eBay credentials or network access to
  developer.ebay.com to verify any of the above, or the general API
  host/header conventions, against a live contract. Full list with
  reasoning: `project-docs/DECISIONS.md` 2026-07-09 (session 14).

## Public-shop cache invalidation (2026-07-02)

`/shop` is server-cached (`unstable_cache`, tag `shop-catalog`, `revalidate: 300`).
Any write to `products` from a **browser** Supabase client (admin order
cancel/reopen/mark-paid, delete-order return-to-inventory, archive/delete)
cannot itself purge that cache, so the gallery would keep serving a stale
status for up to 5 minutes. `next-app/src/app/actions/admin-products.ts`
exports `adminRevalidateProduct(id)` / `adminRevalidateProducts(ids)` (both
call `revalidateTag('shop-catalog', { expire: 0 })` + revalidate the EN/ES
product detail paths) â€” call one of these after every client-side `products`
write. Server-side writes (PayPal capture/webhook,
`adminUpdateProductStatus`) already revalidate inline.

## Authentication

Supabase Auth is configured through:

- `next-app/src/lib/supabase/client.ts`
- `next-app/src/lib/supabase/server.ts`
- `next-app/src/lib/supabase/public.ts` for anonymous server-side public reads.
- `next-app/src/proxy.ts`, which refreshes Supabase sessions during routing only
  for user-state route prefixes.

Account routes live under `next-app/src/app/[locale]/account/`.

## AI Product Listing Assistant

The Product Admin Add/Edit drawer includes an integrated AI Listing Assistant
that accepts typed text or browser speech-recognition transcript text, requests
a structured product draft from the server, previews returned fields, and
applies them into the current form state. It does not write directly to
Supabase; the normal product Save flow remains the persistence step. The older
manual Quick Fill workflow is currently disabled in the editor UI
(`SHOW_QUICK_FILL = false` in `AdminShell.tsx`), but its parser and gated panel
still live in `AdminShell.tsx` so it can be restored without carrying a stale
backup copy.

Provider and model details are isolated in
`next-app/src/lib/ai-product-provider.ts`. UI components, route handlers,
schema coercion, and form population code must stay provider-neutral.

The trust boundary is:

- `next-app/src/app/api/admin/ai-product-fill/route.ts` verifies the signed-in
  Supabase user is an admin, validates transcript/images, rate-limits per admin
  user, calls the provider-neutral draft function, coerces the result, and
  returns structured JSON.
- `next-app/src/lib/ai-product-schema.ts` owns the provider-neutral schema,
  accepted field keys, enum coercion, warnings, and confidence/uncertainty
  shape.
- `next-app/src/lib/ai-product-provider.ts` is the only file that may read AI
  API keys, know provider names/model names, construct provider requests, parse
  provider-specific responses, or store the default extraction prompt
  (`PRODUCT_EXTRACTION_SYSTEM_PROMPT`).

### Editable system prompt

The system prompt that drives extraction is editable by the admin at
`/admin/settings` (the "AI Listing Assistant Prompt" panel).
`PRODUCT_EXTRACTION_SYSTEM_PROMPT` in `ai-product-provider.ts` is the built-in
default; an optional override is stored in the single-row `ai_settings` table
and read server-side per request via `next-app/src/lib/ai-settings-store.ts`.
The admin-gated `next-app/src/app/api/admin/ai-settings/route.ts` (`GET`/`PUT`)
loads and saves the override; saving a blank value clears it and reverts to the
default. The fill route passes the override into the provider through the
`systemPrompt` input. If the `ai_settings` table is missing or the read fails,
the default prompt is used so generation never breaks. Required setup SQL lives
at `next-app/sql/ai-settings-setup.sql`.

The assistant sends the first allowed product images as visual context to the
provider layer. `AI_MAX_IMAGES` controls the count and defaults to 2; local
`/assets/...` product images and Supabase Storage `product-images` URLs are the
allowed sources.

Required live environment configuration before actual generation works:

```text
AI_PROVIDER=<openai|anthropic|google|local>
AI_MODEL=<configured model name>
OPENAI_API_KEY=... or ANTHROPIC_API_KEY=... or GOOGLE_AI_API_KEY=...
```

Optional controls include `AI_MODEL_FAST`, `AI_MODEL_ACCURATE`,
`AI_MODEL_PREMIUM`, `AI_MAX_IMAGES`, `AI_MAX_IMAGE_BYTES`,
`AI_RATE_LIMIT_HOURLY`, `AI_RATE_LIMIT_DAILY`, `AI_TIMEOUT_MS`, and
`AI_MAX_OUTPUT_TOKENS`.

## Deployment

Root `netlify.toml`:

```toml
[build]
  base = "next-app"
  command = "npm run build"
  publish = ".next"
```

It keeps useful legacy image redirects that still land on
`next-app/public/assets`. Redirects to deleted legacy scripts were removed.

## Verification

Primary check:

```bash
cd next-app
npm run build
```

Run `npm run lint` when touching TypeScript, React components, routing, or
shared UI behavior.
