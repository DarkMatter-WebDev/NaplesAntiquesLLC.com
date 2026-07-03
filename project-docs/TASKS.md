# Tasks

> Move tasks between sections as work progresses. Keep it current at the end of
> every session. Newest/most important first within each section.

## Backlog

- **Bring PayPal checkout live (sandbox → production).** Canonical, up-to-date
  status/steps live in the **🔴 HANDOFF — PayPal checkout** section at the top
  of `CURRENT_STATUS.md` — read that first, not this file, for the current
  blocker and ordered go-live steps. (Do not duplicate the checklist here; it
  goes stale the moment the two copies diverge — see DECISIONS 2026-07-02.)
- **Verify Messages Recycle Bin behavior post-migration.**
  `supabase/admin-notifications-recycle-bin.sql` has been applied (owner
  confirmed 2026-07-03), adding `admin_notifications.deleted_at` and the
  `trash_/restore_/delete_admin_notifications` RPCs. Confirm "Delete Selected"
  in `/admin/messages` now soft-deletes to the Recycle Bin (instead of the old
  permanent-delete behavior) and that the Recycle Bin link is visible and
  restore/permanently-delete both work.
- **Run the current `supabase/no-reservation-checkout.sql` in the live Supabase
  project — by itself.** This is the no-reservation checkout model ("whoever pays
  first gets the item"). An earlier copy is confirmed applied (a 2026-07-03
  `paypal-checkout.sql` re-run hit `42P13` on `capture_paypal_order`, proving the
  live function already has the `item_conflict` return), but the file was enhanced
  2026-07-03 to also **drop** the old `reserve_paypal_order` +
  `release_expired_paypal_reservations` functions and rewrite
  `apply_paypal_order_event`. Do **not** re-run `paypal-checkout.sql` first — it is
  fully applied, and re-running it downgrades the capture function (it now has a
  drop guard so it no longer 42P13s, but no-reservation must then run again).
  Idempotent. Until run, the orphaned 30-min reservation functions still exist in
  the DB (unused). After PayPal go-live,
  verify the concurrent-buyers race: two sandbox buyers approve the same
  one-of-one, both capture → first wins (`sold`), second gets `item_conflict`
  (order flagged `failed` + 409). See `features/paypal-checkout.md`.
- **Verify `admin_notifications.image_urls` behavior post-migration.**
  `supabase/admin-notifications-image-urls.sql` has been applied (owner
  confirmed 2026-07-03), so the column should now exist and photos attached to
  "Message Us Directly" submissions should persist + render in
  `/admin/messages`. Also confirm `inquiries.uploaded_image_urls` exists (from
  `sales-workflow.sql`) so inquiry/free-eval photos show in
  `/admin/inquiries`. Submit a message + an inquiry with photos and confirm
  thumbnails render.
- **Verify `products.public_notes_es` behavior post-migration.**
  `supabase/product-public-notes-es.sql` has been applied (owner confirmed
  2026-07-03). Edit a product, confirm Notes (ES) saves and auto-translates
  from Notes (EN), and confirm it renders on the `/es` product detail page.
- **Verify `products.item_year` behavior post-migration.**
  `supabase/product-item-year.sql` and the `supabase/admin-notifications-checkout.sql`
  re-run have been applied (owner confirmed 2026-07-03) — this dropped the old
  `item_date` column (clearing the incorrect listing-creation dates that had
  been backfilled into it). Confirm the Product Admin Date (Year Made) field
  persists on `products.item_year`, order items snapshot it
  (`order_items.item_year_snapshot`), and checkout still succeeds end to end.
- **Verify `shop-new-listing-jpg-to-webp.sql` behavior post-migration.** Applied
  (owner confirmed 2026-07-03) — confirm product rows that referenced
  `shop-new-listing-06-04.jpg` / `-05.jpg` now point at the `.webp` files and
  render correctly (the JPGs were already deleted from `public/`; Netlify 301s
  were the interim safety net).
- **Promote CSP from Report-Only to enforcing.** Root `netlify.toml` ships
  `Content-Security-Policy-Report-Only`. After deploy, watch the browser
  console / a report endpoint across the main pages; once clean, rename the
  header key to `Content-Security-Policy`. Current policy: default-src
  'self'; img-src 'self' data: + Supabase; script-src 'self' 'unsafe-inline';
  style-src 'self' 'unsafe-inline' + fonts.googleapis.com; font-src 'self' +
  fonts.gstatic.com; connect-src 'self' + Supabase + api.gold-api.com;
  frame-ancestors 'none'.
- **Verify the security headers, caching, and 410 bot rules live** after the
  next Netlify deploy (`curl -I` the site + a `/wp-login.php` probe → 410).
  These come from root `netlify.toml` and cannot be exercised by the local
  dev server.
- **Verify the contact + free-evaluation lead forms end to end.** Submit a
  real test on `/contact` (submit-item) and `/free-evaluation` and confirm it
  appears in `/admin/inquiries`, the owner notification + customer
  confirmation emails send (needs `RESEND_API_KEY`), and photos upload to the
  `product-images/inquiries/` path (needs `SUPABASE_SERVICE_ROLE_KEY`).
  Without the service-role key, the inquiry text still saves but photos are
  skipped.
- **Verify the create-account duplicate-email + password-reset flow end to
  end.** In Supabase confirm Auth → URL Configuration Redirect URLs allow
  `…/account/reset-password` for prod + localhost + 127.0.0.1 (the existing
  `/**` entries already cover it). Then, signed out, try Create Account with
  a **known confirmed** account email and confirm the "This email already has
  an account" notice + Reset Password button appear. Click Reset Password,
  open the emailed link, and confirm `/account/reset-password` shows "Set a
  New Password" and that updating the password then lets you sign in.
- **Optionally** push `silver.webp` (394KB) and `money.webp` (323KB) under the
  300KB guideline (they stayed slightly over at the requested q80/2048
  because they are large detailed photos) — drop to q75 or cap ~1600px if
  desired.
- **Remaining shop performance work (deferred — higher risk, left for a
  focused follow-up):**
  1. **DB-side pagination/faceting.** `shop/page.tsx` still fetches ALL public
     rows (including `images`/`tags` arrays) then filters/sorts/slices in JS
     to build facets. Push the visible page to `.range(start,
     start+perPage-1)` and compute brand/price/count facets via a separate
     lightweight aggregate query or materialized view, rather than over the
     full row set each request.
  2. **Make bare `/shop` (no query params) static/ISR** instead of fully
     dynamic. It awaits `searchParams` for filters, which opts the whole
     route into dynamic SSR even for the no-filter external-link case. Split
     the default catalog into a statically generated segment + client-side
     URL filtering, or render the no-filter view from a `'use cache'`
     segment.
  3. **Server-render `ProductCard`'s static markup**; isolate only the
     interactive bits (cart/wishlist buttons, hover carousel, rAF image-load
     poll) into small client islands.
  4. **Re-encode oversized `/public` page images** that violate the
     2048px/WebP rule: `shop-new-listing-06-05.jpg` (~1.07 MB), `money.webp`
     (~882 KB), and regenerate the brand `logo.webp` source (491 KB) smaller.
  5. Consider self-hosting/subsetting the Material Symbols icon glyphs
     actually used (~12) to drop the third-party render-blocking font
     stylesheet entirely and clear the `google-font-display` lint warning.
- Migrate the remaining legacy local-only product photos to Supabase Storage
  so product image bytes live consistently outside the app bundle. Current
  audit: 19 local-only products plus 1 mixed product still reference local
  `/assets/...` product images, now as optimized WebP paths where applicable.
- Confirm `chris@naplesestatejewelry.co` is a real receiving mailbox or
  alias, and confirm Resend allows sending from that address/domain.
  Optionally set `MARKETING_CHRIS_FROM`, `MARKETING_CHRIS_REPLY_TO`, and
  `MARKETING_NOREPLY_FROM` in deployment if the default sender labels should
  differ.
- Have business owner/counsel review the new Privacy Policy, Terms of
  Service, Returns & Refunds, Shipping Policy, Auction Terms, Vendor Terms,
  and Accessibility Statement before relying on them in production.
- Configure AI assistant environment variables before using live generation:
  `AI_PROVIDER`, `AI_MODEL`, the matching provider API key or local endpoint,
  and optional controls such as `AI_MODEL_FAST`, `AI_MAX_IMAGES`,
  `AI_RATE_LIMIT_HOURLY`, and `AI_RATE_LIMIT_DAILY`.
- Correct the current duplicate live inventory `#21` product row if it's
  still present (flagged 2026-06-15).
- Verify Supabase **Auth → URL configuration** redirect URLs include
  `https://naplesestatejewelry.co/**`, `http://localhost:3000/**`, and
  `http://127.0.0.1:3000/**`.
- Fill in unknowns in `CLIENTS.md` (Netlify site name/ID, DNS registrar,
  maintenance plan, billing status, credential locations) — confirmed still
  blank as of 2026-07-02.
- Expand shop beyond gold (silver / diamonds / antiques categories) when
  inventory is ready.
- Add basic analytics if not already present.
- Confirm whether a self-hosted metal-price API key/rate limit is needed for
  production traffic.

> **Note on older migration items:** a large batch of "apply supabase/X.sql"
> items from the 2026-06-15 → 06-20 sessions (product type/metal/brand/
> jewelry-type variants, homepage subscribers, sales workflow, admin profile
> read policy, order-item line discounts, admin notifications checkout,
> carousel + AI-settings setup) was removed from this list on 2026-07-02 —
> those features are confirmed live in "What Is Currently Working"
> (`CURRENT_STATUS.md`) and their completion is recorded in `CHANGELOG.md`.
> If one of those ever turns out to still need a live-DB migration, re-add it
> here with the specific broken behavior observed.

## In Progress

- (None)

## Completed

> Full dated history lives in `CHANGELOG.md` (newest first, back to project
> start) — this section is intentionally just a short pointer, not a mirror
> of it.

- **2026-07-02:** PayPal checkout hardened (reload/eviction resume, stale-total
  retry fix) + shop-gallery cache now purged after every admin order-flow
  product write. See `CHANGELOG.md` 2026-07-02 entries.
- **2026-06-29:** PayPal Orders API v2 checkout wired into `/checkout`,
  sandbox Test 1 passed end-to-end, admin order delete/return-to-inventory
  added. See `CHANGELOG.md` 2026-06-29.
- **2026-06-13 → 2026-06-25:** Legacy static site fully removed, Next.js/
  Supabase app became the sole deploy target; sales workflow, AI listing
  assistant, compliance/legal pages, unified admin inbox, and a broad shop/
  responsive/performance pass were built out. See `CHANGELOG.md` for the
  day-by-day detail.
