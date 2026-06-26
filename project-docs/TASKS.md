# Tasks

> Move tasks between sections as work progresses. Keep it current at the end of
> every session. Newest/most important first within each section.

## Backlog

- **`supabase/service-role-insert-grants.sql` — likely NOT needed (optional safety).**
  Live testing (2026-06-25) showed `service_role` INSERT into `admin_notifications`
  already succeeds (the "Message Us Directly" and unified-inbox inquiry notifications
  land in `/admin/messages` without it). The file is an idempotent safety grant —
  run only if message-center notifications ever stop appearing with a 42501 error.
  The lead-form (inquiries) 42501 bug was fixed in code (insert as anon).
- **Apply `supabase/admin-notifications-image-urls.sql`** in the live Supabase
  project so the `admin_notifications.image_urls` column exists and photos attached
  to "Message Us Directly" submissions persist + render in `/admin/messages`. Until
  then the message still saves and photo links are kept in the notification body
  text (degraded). Also confirm `inquiries.uploaded_image_urls` exists (from
  `sales-workflow.sql`) so inquiry/free-eval photos show in `/admin/inquiries`. After
  applying, submit a message + an inquiry with photos and confirm thumbnails render.
- **Promote CSP from Report-Only to enforcing.** Root `netlify.toml` ships
  `Content-Security-Policy-Report-Only`. After deploy, watch the browser console
  / a report endpoint across the main pages; once clean, rename the header key to
  `Content-Security-Policy`. Current policy: default-src 'self'; img-src 'self'
  data: + Supabase; script-src 'self' 'unsafe-inline'; style-src 'self'
  'unsafe-inline' + fonts.googleapis.com; font-src 'self' + fonts.gstatic.com;
  connect-src 'self' + Supabase + api.gold-api.com; frame-ancestors 'none'.
- **Verify the new security headers, caching, and 410 bot rules live** after the
  next Netlify deploy (`curl -I` the site + a `/wp-login.php` probe → 410). These
  come from root `netlify.toml` and cannot be exercised by the local dev server.
- **Apply `supabase/shop-new-listing-jpg-to-webp.sql`** so product rows that
  reference `shop-new-listing-06-04.jpg` / `-05.jpg` repoint to the new `.webp`
  files (the JPGs were deleted from `public/`). Netlify 301s cover old paths as a
  safety net until applied.
- **Verify the contact + free-evaluation lead forms end to end (2026-06-25).**
  Submit a real test on `/contact` (submit-item) and `/free-evaluation` and
  confirm it appears in `/admin/inquiries`, the owner notification + customer
  confirmation emails send (needs `RESEND_API_KEY`), and photos upload to the
  `product-images/inquiries/` path (needs `SUPABASE_SERVICE_ROLE_KEY`). Without
  the service-role key, the inquiry text still saves but photos are skipped.
- **Optionally** push `silver.webp` (394KB) and `money.webp` (323KB) under the
  300KB guideline (they stayed slightly over at the requested q80/2048 because
  they are large detailed photos) — drop to q75 or cap ~1600px if desired.
- **Apply `supabase/product-public-notes-es.sql`** in the live Supabase project so
  the new `products.public_notes_es` column exists. Until then the bilingual notes
  feature degrades gracefully (the listing form's Notes (ES) field shows, but saving
  it is dropped by the missing-column fallback and the /es product page falls back to
  the English note). After applying, edit a product, confirm Notes (ES) saves and
  auto-translates from Notes (EN), and confirm it renders on the `/es` product detail
  page.
- **Verify the create-account duplicate-email + password-reset flow end to end
  (2026-06-25).** In Supabase confirm Auth → URL Configuration Redirect URLs
  allow `…/account/reset-password` for prod + localhost + 127.0.0.1 (the existing
  `/**` entries already cover it). Then, signed out, try Create Account with a
  **known confirmed** account email and confirm the "This email already has an
  account" notice + Reset Password button appear (it could not be exercised in
  dev because the available test email was not a confirmed account there). Click
  Reset Password, open the emailed link, and confirm `/account/reset-password`
  shows "Set a New Password" and that updating the password then lets you sign in.
- **Remaining shop performance work (deferred from the 2026-06-24 cold-load
  pass — higher risk, left for a focused follow-up):**
  1. **DB-side pagination/faceting.** `shop/page.tsx` still fetches ALL public
     rows (including `images`/`tags` arrays) then filters/sorts/slices in JS to
     build facets. Push the visible page to `.range(start, start+perPage-1)` and
     compute brand/price/count facets via a separate lightweight aggregate query
     or materialized view, rather than over the full row set each request.
  2. **Make bare `/shop` (no query params) static/ISR** instead of fully dynamic.
     It awaits `searchParams` for filters, which opts the whole route into
     dynamic SSR even for the no-filter external-link case. Split the default
     catalog into a statically generated segment + client-side URL filtering, or
     render the no-filter view from a `'use cache'` segment.
  3. **Server-render `ProductCard`'s static markup**; isolate only the
     interactive bits (cart/wishlist buttons, hover carousel, rAF image-load
     poll) into small client islands. Today all 48 cards + the 1465-line
     `ShopFilters` hydrate on first load.
  4. **Re-encode oversized `/public` page images** that violate the 2048px/WebP
     rule: `shop-new-listing-06-05.jpg` (~1.07 MB), `money.webp` (~882 KB), and
     regenerate the brand `logo.webp` source (491 KB) smaller. (Product images
     from Supabase already go through next/image.)
  5. Consider self-hosting/subsetting the Material Symbols icon glyphs actually
     used (~12) to drop the third-party render-blocking font stylesheet entirely
     and clear the `google-font-display` lint warning.
- Convert `/shop` to a cached public shell with client-side URL filtering, or
  move the derived filtering/sorting/pagination into a database RPC/materialized
  query shape. The 2026-06-22 performance pass made public reads cookie-free,
  parallelized independent reads, and cut repeated card CSS from the initial
  payload, but `/shop` remains dynamic (`private, no-cache, no-store`) because
  server-side search params, live spot-price sorting/filtering, item-group
  inference, and page slicing are still intertwined.
- Apply `supabase/product-item-year.sql`, then re-run
  `supabase/admin-notifications-checkout.sql`, so live products persist the
  Product Admin Date (Year Made) field (`products.item_year`, a smallint) and
  order items can snapshot it (`order_items.item_year_snapshot`). This migration
  **drops the old `item_date` column**, clearing the incorrect listing-creation
  dates that had been backfilled into it. The app falls back safely before the
  migration, but year values will not persist/show from live DB rows until it is
  applied, and checkout will fail until the checkout function is re-run.
- Migrate the remaining legacy local-only product photos to Supabase Storage so
  product image bytes live consistently outside the app bundle. Current audit:
  19 local-only products plus 1 mixed product still reference local
  `/assets/...` product images, now as optimized WebP paths where applicable.
- Stop the local preview process when convenient, then delete any locked
  `.codex-dev-server*.log` files that were left in `next-app/`. They are
  ignored, but this source-of-truth folder should not keep runtime logs after
  the process releases them.
- Apply `supabase/order-query-indexes.sql` in the live Supabase project so
  common order, order item, and invoice lookups use the new supporting indexes.
- Keep shop pagination/sort residual explicit: `/shop` now narrows the product
  columns and pushes safe exact predicates to Supabase, but item-group
  inference, live spot-price filtering/sorting, purchasable-first grouping, and
  the current page slice still run in app memory by design. Do not force
  DB-side `.range()` pagination until those derived filters are moved to an RPC,
  materialized fields, or another query shape that preserves visible results.
- Confirm `chris@naplesestatejewelry.co` is a real receiving mailbox or alias,
  and confirm Resend allows sending from that address/domain. Optionally set
  `MARKETING_CHRIS_FROM`, `MARKETING_CHRIS_REPLY_TO`, and
  `MARKETING_NOREPLY_FROM` in deployment if the default sender labels should
  differ.
- Apply `supabase/email-marketing.sql` in Supabase, then configure
  `SUPABASE_SERVICE_ROLE_KEY`, `EMAIL_PROVIDER_API_KEY` or `RESEND_API_KEY`,
  `EMAIL_FROM`, `SITE_URL=https://naplesestatejewelry.co`,
  `MARKETING_TRANSPORT=direct`, and `PROVIDER_WEBHOOK_SECRET`/Resend webhook.
  If the subscriber table was created before this migration, rerun the updated
  file so `subscribed`, `unsubscribed_at`, `unsubscribe_token`, and the
  service-role grants are all present for unsubscribe/campaign sends.
- After email marketing env/migration setup, add the physical mailing address in
  Admin Settings, send an admin test from `/admin/marketing`, confirm
  `/admin/subscribers` shows newsletter subscribers plus non-opted-out account
  holders, and test unsubscribe suppression.
- Have business owner/counsel review the new Privacy Policy, Terms of Service,
  Returns & Refunds, Shipping Policy, Auction Terms, Vendor Terms, and
  Accessibility Statement before relying on them in production.
- Apply `supabase/compliance-consent.sql` so live profiles store account
  Terms/Privacy acceptance timestamps, accepted policy version, and age
  confirmation copied from Supabase Auth metadata.
- Apply the updated `supabase/homepage-subscribers.sql` so live subscribers can
  be marked unsubscribed by `/unsubscribe` and `/api/unsubscribe`.
- Configure AI assistant environment variables before using live generation:
  `AI_PROVIDER`, `AI_MODEL`, the matching provider API key or local endpoint,
  and optional controls such as `AI_MODEL_FAST`, `AI_MAX_IMAGES`,
  `AI_RATE_LIMIT_HOURLY`, and `AI_RATE_LIMIT_DAILY`.
- Apply `supabase/product-image-padding.sql` so live products can persist the
  per-product image frame padding mode, including custom `#rrggbb` colors, used
  by shop cards and detail pages.
- Apply `supabase/product-type-metal-type.sql` so live products can persist and
  backfill Product Type and Metal Type; the current script also adds the
  missing `products.brand` column if needed.
- Apply `supabase/product-brand.sql` so live products can persist Brand values.
- Correct the current duplicate live inventory `#21` product row, then apply
  `supabase/product-inventory-number-unique.sql` so Supabase enforces unique
  product inventory numbers.
- Apply `supabase/product-jewelry-type.sql` so live products can store broad
  Jewelry Type values and keep Link Type scoped to necklace/bracelet rows.
- Apply `supabase/product-metal-variants.sql` so live products can store and
  filter Yellow Gold, White Gold, Rose Gold, Tricolor Gold, Bicolor Gold,
  Silver, Vermeil, and Platinum subtype selections.
- Apply `supabase/homepage-subscribers.sql` so homepage subscriber signups can
  write through the secure `subscribe_homepage` RPC and admins can read
  `/admin/subscribers`.
- Apply `supabase/admin-notifications-checkout.sql` after
  `supabase/sales-workflow.sql` so public checkout can create orders, insert
  admin message-center notifications, and use the secure checkout RPC.
- Apply `supabase/order-item-line-discounts.sql` so live order items can store
  per-line discounts used by manual orders, existing order edits, and emailed
  invoice totals.
- Run `next-app/carousel/sql/setup.sql` in the live Supabase project so the
  Store Carousel Hero admin controls can persist `carousel_selection` and
  `carousel_settings`.
- Run `next-app/sql/ai-settings-setup.sql` in the live Supabase project so the
  editable AI listing-assistant prompt can persist to `ai_settings`. Until then
  the Settings panel shows the default prompt but saving a custom prompt fails.
- Apply `supabase/inventory-number-numeric.sql` if the live Supabase project
  already has `products.inventory_number` as text from the earlier workflow SQL.
- Build Chunk 3: invoice/receipt generation, printable invoice/receipt pages,
  and order-linked invoice controls.
- Apply `supabase/sales-workflow.sql` to the live Supabase project before using
  lifecycle statuses, orders, invoices, saved items, and guarded product delete
  behavior in production.
- Apply `supabase/admin-profile-read-policy.sql` to the live Supabase project so
  admin accounts can read the complete `profiles` table on `/admin/users`.
- Do a Netlify preview smoke test after the legacy cleanup deploy:
  `/`, `/es`, `/shop`, one product page, `/contact`, `/free-evaluation`,
  `/account/sign-in`, `/admin`, `/api/metal-prices`, `/robots.txt`,
  `/sitemap.xml`.
- Continue pruning or rewriting older feature docs in `project-docs/features/`
  that still describe the retired static site. The 2026-06-20 pass updated
  `online-shop.md`, `shop-listings.md`, `lead-capture.md`, and
  `spanish-translation.md`; remaining candidates include older meeting notes
  and historical changelog/decision entries that are intentionally archival.
- Verify Supabase **Auth -> URL configuration** redirect URLs include
  `https://naplesestatejewelry.co/**`, `http://localhost:3000/**`, and
  `http://127.0.0.1:3000/**`.
- Fill in unknowns in `CLIENTS.md` (Netlify site name/ID, DNS registrar,
  maintenance plan, billing status, credential locations).
- Keep Supabase product inventory current through the Next/Supabase product
  flow.
- Expand shop beyond gold (silver / diamonds / antiques categories) when
  inventory is ready.
- Consider real checkout/payments (for example Stripe) vs. the current
  contact-to-buy flow.
- Add basic analytics if not already present.
- Confirm whether a self-hosted metal-price API key/rate limit is needed for
  production traffic.

## In Progress

- (None)

## Completed

- **Unified admin inbox** (2026-06-25): `/api/inquire` now also writes an
  `admin_notifications` row (`type: 'inquiry'`, photos attached) for every Free
  Evaluation / Submit Your Item / product inquiry, so all submissions show in
  `/admin/messages` next to contact messages and order notifications (unread badge
  covers all). Added shared `lib/admin-notify.ts` (`createAdminNotification`), reused
  by `/api/contact-message`. Best-effort (never fails the submission). Live test
  confirmed the notification insert succeeds. Build + lint clean. See DECISIONS
  (2026-06-25).
- **Fixed lead forms 42501 permission-denied on insert** (2026-06-25): `/api/inquire`
  inserted inquiry rows via the service-role client, which lacks INSERT on
  `inquiries`; switched both the multipart and JSON paths to insert as the anon role
  (`createPublicClient()`), keeping the service client only for Storage uploads.
  Verified live (free-eval path returns 200, was 500). Added
  `supabase/service-role-insert-grants.sql` for the `admin_notifications` equivalent
  (see Backlog). Build + lint clean. See DECISIONS (2026-06-25).
- **Customer photos surfaced in the admin panel** (2026-06-25): `/admin/inquiries`
  renders `inquiries.uploaded_image_urls` as thumbnails; the "Message Us Directly"
  form gained optional multi-photo upload, `/api/contact-message` now takes multipart
  and uploads to `product-images` under a `messages/` prefix, storing URLs in a new
  `admin_notifications.image_urls` column rendered by `/admin/messages`. New upload
  destination registered with the Storage GC reference scan. Touched
  `InquiriesPanel.tsx`, `admin/inquiries/page.tsx`, `MessagesPanel.tsx`,
  `admin/messages/page.tsx`, `MessageUsForm.tsx`, `api/contact-message/route.ts`,
  `api/admin/storage-gc/route.ts`, `admin-notifications-checkout.sql`, + new
  `admin-notifications-image-urls.sql`. Build clean (205 pages); lint only the 3
  known issues. See Backlog for the migration. See DECISIONS (2026-06-25).
- **"Message Us Directly" contact form added** (2026-06-25): New section below the
  `/contact` hero with name/email/optional-phone and a large message textarea, posting
  to the new `/api/contact-message` route, which inserts a `type: 'message'` row into
  `admin_notifications` (service-role) so it lands in `/admin/messages`, plus a
  best-effort owner email. New `components/contact/MessageUsForm.tsx`; wired into
  `contact/page.tsx` above `ContactForm`. Build clean (205 pages); lint only the 3
  known issues. Depends on existing `SUPABASE_SERVICE_ROLE_KEY` + `admin_notifications`
  (`admin-notifications-checkout.sql`). See DECISIONS (2026-06-25).
- **Web performance/security audit fixes (4 phases)** (2026-06-25): Fixed the
  silently-failing `/contact` + `/free-evaluation` forms by rewiring them to the
  existing `/api/inquire` (Resend + Supabase + `/admin/inquiries`) with
  server-side photo upload; consolidated/hardened `netlify.toml` (security
  headers, CSP Report-Only, 1y asset caching, 410 bot rules, `410.html`),
  tightened `robots.ts`; re-encoded oversized images to WebP and deleted the
  unused hero MP4; added root `app/not-found.tsx`. Build clean; lint only the 3
  known issues. See Backlog for the pending live verifications + the
  `shop-new-listing-jpg-to-webp.sql` migration. See DECISIONS (2026-06-25).
- **Product listing notes made bilingual (Notes EN / Notes ES)** (2026-06-25):
  Replaced the listing form's admin-only Internal Notes field with a public
  Notes (ES) field; relabeled Public Notes → Notes (EN). New
  `products.public_notes_es` rendered on the `/es` product detail page (fallback to
  English), auto-translated on save and manually editable. Products-only scope;
  orders/inquiries/profiles `internal_notes` left unchanged. Touched
  `products.sql` (+ new `product-public-notes-es.sql` migration), `types/product.ts`,
  `AdminShell.tsx`, `ai-translate.ts`, `api/admin/translate/route.ts`,
  `shop/[id]/page.tsx`, and `lib/admin-settings.ts`. Reads/writes degrade gracefully
  pre-migration. Build clean (204 pages); lint only the 3 known issues. See the
  Backlog item to run the migration. See DECISIONS (2026-06-25).
- **AI listing prompt collapsed to a single editable value** (2026-06-25):
  Removed the default+override duality (Custom/Default badge, `isCustom`,
  `defaultPrompt`, "override" naming) so there is one editable prompt; the saved
  `ai_settings` value is the prompt and the code constant is its built-in starting
  value (recoverable via Restore Built-In). Touched `AdminSettingsPanel.tsx`,
  `api/admin/ai-settings/route.ts`, `api/admin/ai-product-fill/route.ts`,
  `lib/ai-settings-store.ts`, and `lib/ai-product-provider.ts`. Build clean (204
  pages); lint only the 3 known pre-existing issues. See DECISIONS (2026-06-25).
  (The existing Backlog item to run `ai-settings-setup.sql` in the live DB still
  applies for saves to persist.)
- **Spanish localization orthography sweep completed** (2026-06-25): Audited
  every Spanish UI string and corrected missing accents/tildes, inverted
  punctuation (`¿`/`¡`), and spelling while preserving wording and meaning.
  Started with the homepage newsletter signup (`HomeSubscriberForm` placeholder
  `Correo electronico` → `Correo electrónico`; `FormPrivacyNotice` `informacion`
  → `información`, `Politica` → `Política`), then applied ~124 fixes across 22
  files (about, privacy, terms, auctions, services, shop/page, shop/[id],
  ShopFilters, ShopPagination, account/security, AccountDashboard,
  AccountProfileForm, CartDrawer, CheckoutClient, OrderSummary, PaymentClient,
  SiteFooter, legal components). `messages/es.json` was already correct; admin
  pages are English-only. Verified `npm run build` clean (202 pages) and
  `npm run lint` shows only the 3 known pre-existing issues; all `/es` routes
  return 200 and the newsletter section renders the accented copy with 0
  console/server errors.
- **Create-account duplicate-email block + password reset offer added**
  (2026-06-25): Create Account now detects an already-registered email and shows
  a notice with a Reset Password button + Go to Sign In link instead of silently
  re-sending a confirmation. Detection via Supabase's empty-`identities` signal +
  "already registered" error fallback. New dual-mode `account/reset-password`
  recovery page and a "Forgot password?" sign-in link. Build clean (route
  registered EN/ES), lint only the 3 known issues, new-email path verified live
  with no false positive. See the Backlog item to verify Supabase redirect URLs
  and run the end-to-end existing-account/reset-email check with a confirmed
  account.
- **Shop gallery/list view toggle added** (2026-06-25): Added a grid/list view
  toggle to the `/shop` gallery toolbar that switches between the existing
  gallery cards and a new compact list mode on desktop and mobile, without
  changing the gallery cards. New `ShopViewToggle` (URL `view=list` param,
  defaults to gallery) and `ProductListRow`; `ShopProductGrid` gained a `view`
  prop with the list branch + scoped CSS, and `shop/page.tsx` parses/passes it.
  Verified gallery unchanged, list mode at 450px/1280px, toggle both ways, 0
  console errors, `npm run build` clean, `npm run lint` only the 3 known issues.
- **Mobile shop filter apply button added** (2026-06-22): Added a large gold
  "Save and Apply Filters" action at the bottom of the mobile/tablet expandable
  shop filter panel. The button commits any typed price range and closes the
  panel so shoppers have an obvious completion action. Verified typecheck,
  build, and in-app browser mobile smoke at 390px with the panel opening,
  button visible, button click closing the panel, and 0 horizontal overflow.
- **Homepage carousel first-load fallback refined** (2026-06-22): Changed the
  carousel data gate so the hardcoded homepage fallback list only appears after
  a longer hard-fallback delay, and late live-selection results are ignored once
  fallback has been shown. This prevents fallback product photos from flashing
  and then swapping to the real curated starting items. Verified typecheck,
  build, and timed in-app browser samples showing live curated alts visible,
  no fallback image paths visible, `is-ready` true, and 0 horizontal overflow.
- **Homepage/shop reveal fail-open fixed** (2026-06-22): Added bounded
  fallbacks around homepage carousel data/settings readiness, hero image/font
  readiness, and shop card cover-image readiness so those customer-facing
  reveals cannot remain opacity-hidden indefinitely. Verified typecheck,
  production build, and in-app browser smoke: `/` hero `is-ready` with visible
  layers, `/shop` 48/48 visible cards, and 0 horizontal overflow on both pages.
  Lint remains blocked by unrelated existing issues.
- **Responsive layout audit/refactor completed** (2026-06-22): Added shared
  responsive layout primitives and global clamp/minmax helpers, refactored the
  header, shop grid/hero/catalog, home/contact/about sections, checkout/payment
  forms, cart drawer, admin header, admin table wrappers, and `/admin/users`
  mobile cards. Verified typecheck, production build, and Chrome viewport sweep
  at 320/375/390/430/768/1024/1280/1440/1920px across 12 major routes with 0
  horizontal-overflow failures. Lint remains blocked by unrelated existing
  `AdminShell.tsx` / `ShopFilters.tsx` issues and an `app/layout.tsx` warning.
- **Top Clear Filters control added to shop sidebar** (2026-06-21): Added a
  second Clear Filters button at the top of the left shop filter panel when
  filters are active, sharing the existing clear-all behavior. Verified
  typecheck, build, and local rendered HTML checks; lint remains blocked by
  unrelated existing issues.
- **Gallery sort dropdown added above shop cards** (2026-06-21): Added a
  compact right-aligned Sort dropdown above the public shop product grid. It
  reuses the same shared URL-backed sort control as the left filter menu, with
  matching Inventory/Price/Weight/Brand options and page reset on changes.
  Verified typecheck, build, and local rendered HTML smoke; lint remains
  blocked by unrelated existing issues.
- **Public shop hides draft/reserved inventory** (2026-06-21): Added a shared
  storefront-visible status helper so `/shop` only displays `available` and
  `sold` products. Draft, reserved, pending-payment, and archived products are
  excluded from public shop queries, counts, filter options, and normal product
  detail access, while admin/account return paths can still preview detail
  pages. Verified with typecheck, build, local preview HTTP smoke, and a
  Supabase-vs-rendered HTML check; lint is blocked by unrelated existing
  lint issues.
- **Customer-facing loaded-block reveal added** (2026-06-20): Added a shared
  `CustomerReveal` coordinator for customer-facing localized pages, skipping
  admin routes. Blocks wait for their own images, CSS background images, and
  fonts before fading in, while large shop gallery parents are excluded so lazy
  product images cannot hold the page hidden. The homepage carousel hero is
  explicitly excluded so its 3D transform geometry, admin-visible-count
  behavior, and centered text/email layout remain unchanged; `HomeHero` now
  handles its own top-down loaded fade after carousel data, visible images, and
  fonts are ready: headline first, carousel second, subscriber/actions last.
  Mobile menu panels use the same motion language, and reduced-motion/print
  users skip the shared animation. Verified with `npm run lint`,
  `npm run build`, and browser smoke on `/` showing the hero ready state,
  top/carousel/bottom delays of 0.08s/0.26s/0.5s, no reveal transform/filter on
  the hero, centered content, 6 active carousel slots, 0 broken images, and 0
  console errors.
- **Product Date field added** (2026-06-20): Added nullable
  `products.item_date` / `order_items.item_date_snapshot` support, Product
  Admin Add/Edit Date input, admin table Date display/sort, public
  card/detail/cart/checkout Date display when present, and migration-safe
  fallbacks for not-yet-applied live columns. Added
  `supabase/product-item-date.sql`. Verified `npx tsc --noEmit`,
  `npm run lint`, `npm run build`, and local browser smoke on `/shop`.
- **Shop gallery staged reveal added** (2026-06-20): `/shop` product cards now
  stay hidden until their cover image is complete, then fade in with
  responsive row-by-row stagger timing. First-row cover images are prioritized,
  and browser smoke reported no broken images or console errors.
- **Order item image snapshot WebP migration applied** (2026-06-20):
  `supabase/order-item-image-snapshots-png-to-webp.sql` was applied in Supabase
  and its verification select returned 0 remaining
  `/assets/images/shop/*.png` rows in `order_items.image_snapshot`. Runtime
  normalizers remain for browser-local cart/wishlist snapshots.
- **Data/object-storage optimization pass implemented** (2026-06-20): Added
  product-image reference parsing, admin product image cleanup on removal,
  replacement, deletion, and dry-run GC, one-year Storage cache-control on new
  uploads, upload size/count guardrails, narrower Supabase selects for shop,
  checkout, account, order, message, and inquiry flows, order lookup index SQL,
  responsive `next/image` size hints, and optimized oversized local PNG assets.
  Verified with `npx tsc --noEmit`, `npm run lint`, `npm run build`, and a
  browser smoke test of `/shop?itemGroup=jewelry`.
- **Repo-ready folder cleanup and docs reconciliation completed**
  (2026-06-20): Removed the generated Storage GC archive and temporary shop PNG
  delete-list JSON, tightened root ignore rules for app build output, caches,
  logs, env files, and cleanup artifacts, and reconciled project memory around
  the completed Storage GC + image WebP migration. Locked live preview logs are
  ignored and queued for deletion after the preview process releases them.
- **Project docs and stale local artifacts swept** (2026-06-20): Updated
  setup/readme/agent docs, feature guidance, memory docs, and ignore rules for
  the active Next/Supabase app. Removed verified redundant root image
  references, the superseded email-marketing handoff, and the unused
  `AdminShell` archive copy.
- **Header hydration mismatch fixed** (2026-06-20): Normalized both `en` and
  `es` locale prefixes in `SiteHeader` before computing active nav state and
  alternate locale hrefs, fixing the `/shop` hydration mismatch that rendered
  `data-active` and `/es/en/shop` differently between server and client.
  Verified visible overlay removal in-browser, plus `npm run lint` and
  `npm run build`.
- **Supporting docs refreshed for current Next/Supabase app** (2026-06-20):
  Rewrote stale feature runbooks for online shop, shop listings, lead capture,
  and Spanish localization so they describe the active Next.js/Supabase app
  instead of the retired static site. Updated structure, integrity,
  architecture, overview, current status, tasks, changelog, and client notes for
  the Supabase Storage image boundary and cleanup follow-ups. No app code
  changed.
- **Product image/object-storage audit started** (2026-06-20): Confirmed live
  product rows store URL/path strings only, not image bytes. Audit found 28
  Storage-only products, 19 local-only products, 1 mixed product, 202
  DB-referenced Storage objects with none missing, and 91 old unreferenced
  Storage objects that were later archived and deleted after a confirmed GC run.
- **Cufflinks and custom product types enabled** (2026-06-19): Added
  Cufflinks as a product/item type, changed the admin Product Type field to a
  combobox that accepts new item forms, preserved AI-provided custom product
  types instead of coercing them to Other, and made `/shop` derive additional
  Item Type choices from visible inventory. Verified browser dropdown behavior,
  `npm run lint`, and `npm run build`.
- **Shop hero copy broadened to precious metals** (2026-06-19): Updated the
  English `/shop` investment hero from gold-only wording to precious-metals
  language around live spot values, exact scrap value, and gold-or-silver
  trade-ins. Verified rendered copy on `/shop`, plus `npm run lint` and
  `npm run build`.
- **Shop category toggle labels refined** (2026-06-19): Renamed the modern
  shop sidebar category buttons to "Jewelry & Watches" and "Sterling Silver,"
  hid Silverware / Sterling from Item Type while Jewelry & Watches is active,
  removed Bullion from the public Item Type menu, and made Sterling Silver set
  Metal to Silver while hiding the Metal and Gender dropdowns. Brand options are
  scoped separately for the sterling-side product set, and Sterling Silver has
  its own Item Type list with only All items and Silverware / Sterling for now.
  Verified rendered labels/options on `/shop`, plus `npm run lint` and
  `npm run build`.
- **Store chooser and silver-tableware routes removed** (2026-06-19): Removed
  localized `/store` and `/silver-tableware` route files, pointed homepage shop
  CTAs plus header Shop/Store links directly to `/shop`, and removed both
  routes from the sitemap. Verified `/shop` 200, `/store` and
  `/silver-tableware` 404, source scan, `npm run lint`, and `npm run build`.
- **Sterling tableware page opened to full catalog browsing** (2026-06-19):
  `/silver-tableware` defaults to Silverware / Sterling + Silver on plain
  visits, keeps its Item Type dropdown ordered Silverware / Sterling, Bullion,
  Coins, Watches, Brooches, then the remaining categories, and keeps All items
  last as an explicit full-catalog choice. Verified in-browser with default,
  All items, and Necklace states, plus `npm run lint` and `npm run build`.
- **Sterling tableware hero copy refined** (2026-06-19): Updated the
  `/silver-tableware` title to "Sterling Tableware & More" and rewrote the
  three proof cards around heirloom beauty, reasonable prices, and transparent
  buying. Verified rendered copy/no-overflow in-browser, plus `npm run lint`
  and `npm run build`.
- **Sterling tableware removed from Shop submenu** (2026-06-19): Removed the
  direct Sterling Tableware item from the Shop dropdown/mobile submenu so the
  category is reached through `/store`. The Store tile still links to
  `/silver-tableware`, and the route remains live/sitemap-listed. Verified
  rendered menu links, Store tile link, `npm run lint`, and `npm run build`.
- **Live metal spot badges tinted** (2026-06-19): Updated the shared shop
  spot-price pills so Silver / oz has a silver-tinted treatment and Gold / oz
  has a gold-tinted treatment across desktop and mobile. Verified
  `/silver-tableware` at desktop and 390px mobile/no-overflow, plus
  `npm run lint` and `npm run build`.
- **Sterling tableware shop route added** (2026-06-19): Added
  `/silver-tableware` as a dedicated modern shop clone locked to Silverware /
  Sterling and Silver, linked the `/store` Sterling Silver Tablewares tile to
  it, added the route to Shop navigation and sitemap, and verified desktop
  click-through plus 390px mobile/no-overflow behavior. `npm run lint` and
  `npm run build` pass.
- **Unused product types removed** (2026-06-19): Removed Estate Lot, Loose
  Gemstone, and Loose Diamond from shared product type options, public shop
  item-type filters, URL aliases, and AI/admin prompt guidance. Verified source
  scan, browser shop filter options, `npm run lint`, and `npm run build`.
- **Header nav underline animation added** (2026-06-19): Added a desktop
  left-to-right underline animation on header nav hover/focus and persistent
  active-route underlines for direct and dropdown-group routes. Verified
  `/about` at 1920px with the About link active and no horizontal overflow,
  plus `npm run lint` and `npm run build`.
- **Header anchored to viewport edges** (2026-06-19): Removed the centered
  desktop max-width rail from the shared `SiteHeader` so the left brand/nav
  cluster and right action/call cluster sit near the viewport edges on wide
  screens. Verified at 1920px desktop and 390px mobile with no horizontal
  overflow, plus `npm run lint` and `npm run build`.
- **Marketing campaign sender profiles added** (2026-06-19): Added a Sender
  dropdown to `/admin/marketing` with Chris reply-enabled as the default and
  no-reply as an alternate. Send Test/Send Campaign now pass the selected
  sender to Resend with `replyTo` for Chris, campaign history displays a Sender
  column, and the SQL migration includes sender audit columns. Verified
  in-browser, plus `npm run lint` and `npm run build`.
- **Admin manual subscriber source label fixed** (2026-06-19): Carried
  `homepage_subscribers.source` through the marketing audience rows so
  `/admin/subscribers` shows manually-entered recipients as "Admin manual"
  instead of "Newsletter subscriber." Verified in-browser, plus `npm run lint`
  and `npm run build`.
- **Admin manual subscriber add added** (2026-06-19): Added an Add Subscriber
  form to `/admin/subscribers` for manually entering name/email newsletter
  recipients, backed by an admin-only POST route and `homepage_subscribers`
  rows with `source = 'admin_manual'`. Updated the email marketing SQL grant
  for insert/delete support. Verified in-browser, plus `npm run lint` and
  `npm run build`.
- **Marketing campaign history delete + wider desktop view added**
  (2026-06-19): Added an Actions/Delete control to `/admin/marketing` campaign
  history, backed by an admin-only DELETE route, and widened the admin marketing
  page to 1800px on widescreen desktop layouts. Verified in-browser, plus
  `npm run lint` and `npm run build`.
- **Lint warnings cleaned up** (2026-06-19): Fixed the remaining four ESLint
  warnings: Material Symbols now uses `display=optional` with a documented
  icon-font exception, and admin preview/crop modal images use `next/image`.
  `npm run lint` is clean and `npm run build` passes.
- **Marketing email preview window added** (2026-06-19): Added a Preview Email
  button to `/admin/marketing` that opens a compact iframe-backed dialog showing
  the composed HTML with the automatic unsubscribe/mailing-address footer. The
  dialog closes from the Close button, Escape, or the backdrop. Verified
  in-browser, plus `npm run lint` and `npm run build`.
- **Marketing campaign analytics added** (2026-06-19): Extended the
  `/admin/marketing` campaign history table with delivered, opens, clicks,
  bounces, complaints, latest event time, and rate/count summaries based on
  local `email_campaign_events` populated by Resend webhooks. Verified the
  rendered admin page in-browser, plus `npm run lint` and `npm run build`.
- **Public square-layout audit completed** (2026-06-19): Audited the public
  site for leftover sharp/square legacy surfaces and rounded remaining
  customer-facing items across About, Free Evaluation, Estate Services, FAQ,
  Store, Shop, product detail placeholders, wishlist placeholders, account/auth
  controls, header menus, shop filters, and pagination. Source scan now finds no
  public `rounded-sm`, old gradient CTA, emoji photo/check placeholders, or
  6px/8px scoped radii; remaining matches are admin-only internal UI. Browser
  computed checks at 390px confirmed `/shop` and `/account/sign-up` no longer
  expose the previously flagged square surfaces. `npm run build` passes; `npm
  run lint` remains blocked by existing carousel ref/purity errors in
  `next-app/carousel/components/Carousel.tsx`.
- **Contact and Sell-category surfaces modernized** (2026-06-19): Updated the
  contact submission form, product inquiry form, free-evaluation form, and the
  main Sell pages (`/estate-jewelry`, `/gold-services`, `/silver-services`,
  `/bullion`) to match the rounded, lighter shop aesthetic. Replaced old square
  cards/upload boxes/chart panels/CTA blocks and emoji-style form icons with
  rounded cards, softer borders/shadows, pill actions, SVG camera icons, and
  material icons. Verified at 390px mobile and 1280px desktop with no horizontal
  overflow; `npm run build` passes. `npm run lint` remains blocked by existing
  carousel ref/purity errors in `next-app/carousel/components/Carousel.tsx`.
- **About Google review CTA artifacts fixed** (2026-06-19): Replaced the
  mojibake star/external-link glyphs around the About page Google review CTA
  with clean text and an ASCII arrow (`->`). Verified `/about` rendered HTML no
  longer contains the broken `â˜…` or `â†—` artifacts and `npm run build` passes;
  `npm run lint` remains blocked by existing carousel ref/purity errors in
  `next-app/carousel/components/Carousel.tsx`.
- **Legal/cookie surfaces modernized** (2026-06-19): Updated sharp square
  policy/cookie UI to match the rounded, lighter shop aesthetic. Shared
  buttons/forms now have softer rounded/pill styling, policy content renders in
  rounded white cards with subtle shadows and numbered chips, and cookie
  preference/notice panels are rounded translucent cards. Verified
  `/cookie-preferences` at desktop width: 16px policy/preference card radii,
  999px Back to Home radius, no horizontal overflow, and `npm run build`
  passes; `npm run lint` remains blocked by existing carousel ref/purity errors
  in `next-app/carousel/components/Carousel.tsx`.
- **About page process/showroom section removed** (2026-06-19): Removed the
  About page "How It Works" section, including Competitive Offers, the three
  process steps, and the imagined no-storefront showroom image/copy. The page
  now flows from Meet Chris directly to the final contact CTA. Verified `/about`
  returns 200, removed text is absent from rendered HTML, and `npm run build`
  passes; `npm run lint` remains blocked by existing carousel ref/purity errors
  in `next-app/carousel/components/Carousel.tsx`.
- **Homepage service strip icons redesigned** (2026-06-19): Replaced the
  emoji-style icons in the homepage We Buy Gold / We Sell Jewelry / Direct
  Contact strip with a custom HTML canvas icon component for gold, jewelry, and
  direct contact, plus refined spacing/dividers. Verified desktop and 390px
  mobile with three 64px canvases, no emoji text in the section, and no
  horizontal overflow; `npm run build` passes. `npm run lint` remains blocked by
  existing carousel ref/purity errors in
  `next-app/carousel/components/Carousel.tsx`.
- **Store mobile hero image shortened/zoomed out** (2026-06-19): Reduced the
  `/store` hero image's mobile-only fixed height from `36rem` to `30rem` so the
  image crop backs off and the page is shorter. Tablet/desktop sizing remains
  unchanged. Verified at 390px with a 480px image/section height, 901px page
  height, and no horizontal overflow; `npm run build` passes. `npm run lint`
  remains blocked by existing carousel ref/purity errors in
  `next-app/carousel/components/Carousel.tsx`.
- **Store mobile footer legal columns centered** (2026-06-19): Centered the
  mobile Legal two-column footer links within each column while keeping desktop
  left-aligned. Verified `/store` at 390px with centered computed styles, no
  horizontal overflow, and about 357px footer height. `npm run build` passes;
  `npm run lint` remains blocked by existing carousel ref/purity errors in
  `next-app/carousel/components/Carousel.tsx`.
- **Store mobile footer shortened again** (2026-06-19): Reworked the remaining
  mobile footer links so Company is a compact three-link row, Legal is a
  smaller two-column list, and footer padding/bottom-bar spacing are tighter.
  Verified `/store` at 390px with no horizontal overflow and about 357px footer
  height, plus `npm run build`; `npm run lint` remains blocked by existing
  carousel ref/purity errors in `next-app/carousel/components/Carousel.tsx`.
- **Store mobile footer Company/Legal reorganized** (2026-06-19): Changed the
  mobile footer's remaining groups after Shop removal so Company is a vertical
  list and Legal is a readable two-column list rather than a dense compact
  grid. Verified `/store` at 390px with no horizontal overflow and `npm run
  build`; `npm run lint` remains blocked by existing carousel ref/purity errors
  in `next-app/carousel/components/Carousel.tsx`.
- **Store mobile footer Shop links removed** (2026-06-19): Hid the shared
  footer's Shop group on mobile only, removing Gold Jewelry, Silver Jewelry,
  All Items, Free Evaluation, and Gold Services from the `/store` mobile
  footer while keeping the desktop footer intact. Verified 390px mobile
  removal/no overflow, desktop Shop link presence, and `npm run build`; `npm
  run lint` remains blocked by existing carousel ref/purity errors in
  `next-app/carousel/components/Carousel.tsx`.
- **Store mobile footer compacted further** (2026-06-19): Reduced the shared
  footer's mobile vertical footprint on `/store` with tighter spacing,
  smaller mobile typography, denser Shop/Company mini-grids, and a compact
  Legal grid. Verified at 390px in-browser with no horizontal overflow, plus
  `npm run build`; `npm run lint` remains blocked by existing carousel
  ref/purity errors in `next-app/carousel/components/Carousel.tsx`.
- **Store Browse Jewelry CTA redesigned** (2026-06-19): Updated the `/store`
  Estate Jewelry tile CTA from a heavy gold rectangle to a lighter rounded
  editorial button with a fine gold border and circular arrow. Verified mobile
  and desktop fit in-browser, plus `npm run build`; `npm run lint` remains
  blocked by existing carousel ref/purity errors in
  `next-app/carousel/components/Carousel.tsx`.
- **Sign-in mobile background image removed** (2026-06-19): `/account/sign-in`
  now uses a plain white mobile background while preserving the desktop jewelry
  background image. Verified 390px mobile computed background and layout, plus
  `npm run build`; `npm run lint` remains blocked by existing carousel
  ref/purity errors in `next-app/carousel/components/Carousel.tsx`.
- **Mobile auth pages top-aligned** (2026-06-19): Account sign-up and sign-in
  cards now start directly below the fixed header on mobile instead of staying
  vertically centered lower on the screen. Mobile card padding is tighter, while
  desktop centering remains. Verified both auth pages at 390px in-browser and
  `npm run build`; `npm run lint` remains blocked by existing carousel
  ref/purity errors in `next-app/carousel/components/Carousel.tsx`.
- **Account sign-up password visibility toggles added** (2026-06-19): Password
  and Confirm Password now each have their own keyboard-accessible Show/Hide
  button with accessible state labels. Toggling does not clear typed values,
  and the password-match validation plus Terms/Privacy checkbox remain intact.
  Verified in-browser, including 390px mobile layout and a valid signup success
  path; `npm run build` passes. `npm run lint` remains blocked by existing
  carousel ref/purity errors in `next-app/carousel/components/Carousel.tsx`.
- **Account sign-up password confirmation added** (2026-06-19): Registration
  now includes Password and Confirm Password fields and prevents Supabase signup
  when the values differ. Verified in-browser on `/account/sign-up` and
  `npm run build`; `npm run lint` remains blocked by existing carousel
  ref/purity errors in `next-app/carousel/components/Carousel.tsx`.
- **Compliance foundation implemented** (2026-06-19): Added expanded legal and
  disclosure pages (`/privacy`, `/terms`, `/cookie-preferences`,
  `/accessibility`, `/returns-refunds`, `/shipping`, `/auction-terms`,
  `/vendor-terms`, `/unsubscribe`), updated the shared footer, added an
  essential cookie/storage notice, added form privacy disclosures, required a
  single Terms/Privacy consent checkbox during account registration, linked checkout/payment
  to ecommerce policies, added `/api/unsubscribe`, updated subscriber and
  consent SQL, and added `project-docs/COMPLIANCE_AUDIT.md`. Verified
  `npm run build`; `npm run lint` remains blocked by existing carousel
  ref/purity errors in `next-app/carousel/components/Carousel.tsx`.
- **Shared mobile footer reformatted** (2026-06-18): Updated only the shared
  `SiteFooter` mobile layout so all public pages get a cleaner footer: centered
  full-width brand/contact block, two compact mobile link columns, a tappable
  phone button, and a wrapped centered legal/domain bottom bar. Desktop footer
  remains three columns. Verified `/store` at 390px in-browser with no
  horizontal overflow and `npm run build` passes. `npm run lint` remains
  blocked by existing carousel ref/purity errors in
  `next-app/carousel/components/Carousel.tsx`.
- **Store category chooser simplified to two hero buttons** (2026-06-18):
  `/store` now shows only two large square category controls floating over the
  main hero image, spaced left and right. Estate Jewelry links to `/shop`, while
  Sterling Silver Tablewares remains a disabled coming soon option. The controls
  now have layered shadows, inner bevels, and highlight bands for more depth.
  Verified desktop and 390px mobile in-browser, and `npm run build` passes.
  `npm run lint` is currently blocked by existing carousel ref/purity errors in
  `next-app/carousel/components/Carousel.tsx`.
- **Store Carousel admin controls added** (2026-06-18): Admin Settings now has
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
- **Admin product table Link Type column added** (2026-06-18): The main Product
  Admin table now shows a sortable `Link Type` column on extra-wide desktop
  layouts, using the existing product `chain_type`/link-type value. The column
  stays hidden below the `2xl` breakpoint so the regular admin table width is
  not made more cramped. Verified `/admin` at wide and standard desktop widths,
  `npm run lint`, and `npm run build`.
- **Homepage-only loading fallback scoped** (2026-06-18): Moved the localized
  homepage route and loading fallback into `next-app/src/app/[locale]/(home)/`
  so the branded `NaplesEstateJewelry.co` loading screen only wraps the
  homepage route instead of every localized internal page. Internal navigation
  to routes such as `/store` no longer shows the site loading screen. Verified
  `/store` and `/` in-browser, `npm run lint`, and `npm run build`.
- **Store Carousel hero added** (2026-06-18): The `/store` page now uses the
  supplied `next-app/carousel` Carousel widget as the main first-viewport hero.
  Its animation/rendering engine remains intact; the store page passes local
  shop/page image variables directly as `CarouselItem`s, keeps prices off, and
  sizes the hero to fill the detected screen under the header. The chooser cards
  remain below the hero. Added narrow TypeScript casts in the carousel data
  helper so the supplied Supabase join helpers type-check when imported by the
  app. Desktop presentation zooms the hero carousel larger and lets cards travel
  beyond the viewport edge, while mobile now uses proportional card and
  perspective settings for a similar close-up experience. The carousel no
  longer pauses on hover, and both desktop/mobile use a light edge fade so cards
  disappear slightly as they reach the viewport edge. The hero heading group is
  positioned higher so the category prompt sits in the open space above the
  carousel. Added foggy white edge overlays on the far left and right to echo
  the original widget fade treatment. Verified `/store` desktop and 390px
  mobile layout, 8 hero images, continuous 32s animation, no horizontal
  overflow, `npm run lint`, and `npm run build`.
- **Store chooser page added** (2026-06-18): Added a localized `/store`
  intermediate page between homepage shopping CTAs and the live `/shop`
  catalog. It has an active Estate Jewelry Shop choice and a disabled Sterling
  Silver Tablewares placeholder for a future category. Homepage Buy/Browse Shop
  links now route to `/store`; existing cart, account, header, footer, and
  product flows still point directly to `/shop`. Added `/store` to the sitemap.
  Verified `/store`, homepage CTA hrefs, 390px mobile layout, `npm run lint`,
  and `npm run build`.
- **Branded route loading screen refined** (2026-06-18): Localized site routes
  now have a dark, centered `NaplesEstateJewelry.co` loading fallback with
  classy supporting text and an animated gold wheel, without the older logo
  image or off-white background. The loading brand now uses a clean mobile
  break point plus responsive title/spinner sizing so it does not overflow on
  narrow phones. The temporary local `/loading-preview` review route has been
  removed now that the screen is approved. Verified in-browser at 320px and
  390px, `npm run lint`, and `npm run build`.
- **Customer order item metadata cleaned up** (2026-06-18): Account order
  detail item rows no longer expose slug-like product ids in the subtext.
  Buyer-visible metadata now shows inventory as its own `Inv #...` chip,
  formats gold purity values as `14K`/`18K`, and keeps metal/weight specs.
  Account orders enrich older slug snapshots from live product inventory
  numbers when possible. Verified `/account?tab=orders` in-browser,
  `npm run lint`, and `npm run build`.
- **Shop mobile top controls reduced** (2026-06-18): Product-card Available
  flags and favorites icons now use smaller mobile-only sizing, with the badge
  around 12px tall and the heart button around 22px square at 390px. Verified
  `/shop` at 390px, `npm run lint`, and `npm run build`.
- **Shop mobile Add button shortened** (2026-06-18): On thin mobile shop
  screens, product-card Add buttons now use less vertical padding, a smaller
  icon, and reduced action-row top spacing so the three-across cards are more
  compact. Verified `/shop` at 390px, `npm run lint`, and `npm run build`.
- **Admin mobile photo reorder controls added** (2026-06-18): The add/edit
  product photo gallery now includes tap-friendly previous/next reorder
  buttons on every thumbnail, so mobile admins can reorder photos without
  dragging. Drag reorder remains available on desktop. Verified in-browser at
  390px without saving, `npm run lint`, and `npm run build`.
- **Shop mobile card arrows reduced** (2026-06-18): Product-card image
  carousel arrows now use a smaller mobile-only treatment, rendering at about
  18px square with a lighter shadow in the three-across gallery. Desktop arrow
  sizing is unchanged. Verified `/shop` at 390px, `npm run lint`, and
  `npm run build`.
- **Shop price range filter added** (2026-06-18): The shop filter panel now
  includes a two-handle price slider with editable min/max fields, backed by
  `priceMin`/`priceMax` URL params and the same displayed product price basis
  used by price sorting. Verified `/shop?priceMin=1000&priceMax=2500`,
  mobile 390px, `npm run lint`, and `npm run build`.
- **Shop mobile item flags reduced** (2026-06-18): Brand and link-type flags
  on mobile shop gallery cards now use smaller type, tighter padding, shorter
  height, and lighter shadows for the three-across card grid. Longer
  individual flags now step down again so labels such as `Anchor / Gucci link`
  fit fully without clipping. Verified `/shop?itemType=necklace` at 390px,
  `npm run lint`, and `npm run build`.
- **Account order item product links added** (2026-06-18): Customer order
  detail items now link to their matching public product detail pages when a
  product id is available, and those product pages show `Back to Orders` when
  opened from account order history. Verified `/account?tab=orders`
  in-browser, `npm run lint`, and `npm run build`.
- **Shop link-type flag compacted** (2026-06-18): Link-type fallback flags on
  gallery cards now use a shorter badge treatment in the lower-left image
  corner, while brand flags keep their taller gold-tinted styling. Verified
  `/shop?itemType=necklace` at desktop and mobile widths, `npm run lint`, and
  `npm run build`.
- **Shop gallery brand/link flag styles separated** (2026-06-18): Brand flags
  keep the newer gold-tinted styling, while link-type fallback flags use the
  quieter plain flag style so makers and link styles are visually distinct.
  Verified `/shop?itemType=necklace` in-browser, `npm run lint`, and
  `npm run build`.
- **Shop Link Type filter repositioned** (2026-06-18): When Item Type is
  Necklace or Bracelet, Link Type now appears directly after Item Type in the
  shop filter grid instead of lower in the panel. Verified
  `/shop?itemType=necklace` in-browser, `npm run lint`, and `npm run build`.
- **Shop gallery flag fallback added** (2026-06-18): Product-card image flags
  now prefer Brand, then fall back to link type for unbranded necklaces and
  bracelets. Verified `/shop?itemType=necklace` and `/shop?itemType=bracelet`
  in-browser, `npm run lint`, and `npm run build`.
- **Shop mobile status tag reduced** (2026-06-18): The Available/Sold status
  badge on shop gallery cards now has a smaller mobile-only treatment for the
  three-across grid, while desktop badges keep their prior size. Verified
  `/shop` at 390px, `npm run lint`, and `npm run build`.
- **Shop gallery brand tag styling refined** (2026-06-18): Product-card brand
  tags now use a warmer gold-tinted gradient, stronger border, bolder lettering,
  and subtle shadow/highlight so they stand out without feeling flashy. Verified
  `/shop` in-browser, `npm run lint`, and `npm run build`.
- **Shop mobile card spec chips compacted** (2026-06-18): Mobile shop card
  purity/weight/length chips now use shorter labels to fit the dense
  three-across grid: weights over 10g use at most one decimal, silver purity
  shows as `925`, ring sizes drop `Size:`, and fractional inch lengths use
  compact card labels. Verified `/shop` at 390px with no spec-chip overflow,
  `npm run lint`, and `npm run build`.
- **Shop mobile gallery changed to three across** (2026-06-18): The mobile shop
  product grid now renders three smaller cards per row with tighter mobile
  gaps. Verified `/shop` at 360px, 390px, and 430px browser viewports,
  including a 390px screenshot check, plus `npm run lint` and
  `npm run build`.
- **Shop gallery widescreen grid expanded** (2026-06-18): The desktop shop
  gallery now scales to 4 columns near 1440px, 5 near 1800px, 6 near 2048px,
  and 7 on 2400px+ viewports, with the shop shell widened to 2400px and image
  size hints matched to the denser grid. Verified `/shop` with browser viewport
  measurements, `npm run lint`, and `npm run build`.
- **Shop gallery brand image tags added** (2026-06-18): Product cards now show
  a lower-left brand tag on the first preview image when Brand is present. The
  tag hides on non-first preview images and fades while the desktop title
  tooltip or image-arrow focus/hover is active. Verified `/shop` in-browser,
  `npm run lint`, and `npm run build`.
- **Admin order line discounts added** (2026-06-18): Manual custom orders now
  support per-item Line Discount inputs alongside the existing order-level
  discount. Existing order detail pages can edit per-line discounts, recalculate
  order tax/totals, and the Email Invoice preview/send path shows the original
  price, discount, and adjusted line total. Added
  `supabase/order-item-line-discounts.sql`. Verified in-browser without
  saving/sending, `npm run lint`, and `npm run build`.
- **Invoice email item thumbnails added** (2026-06-18): The Email Invoice
  preview and sent customer email now show small product thumbnails in the item
  breakdown when image snapshots are present. Relative local image paths are
  expanded to absolute site URLs for email clients. Verified in-browser preview,
  `npm run lint`, and `npm run build`.
- **Admin order Reopen Order action added** (2026-06-18): Cancelled order
  detail pages now show `Reopen Order` instead of `Cancel Order`. Reopening
  restores order status to open and fulfillment to pending; unpaid linked
  products return to pending payment, while paid order products remain sold for
  review. Verified in-browser button visibility, `npm run lint`, and
  `npm run build`; the action was not clicked to avoid mutating the live order.
- **Admin order item product links fixed** (2026-06-18): Order detail item
  table `Open` links now navigate to the corresponding public product detail
  page with a safe encoded admin return path. Product pages opened this way show
  `Back to Admin` in the top-left and return directly to the originating order
  detail page. Verified in-browser, `npm run lint`, and `npm run build`.
- **Admin order Email Invoice send flow added** (2026-06-18): Order detail
  pages now have an Email Invoice button beside the status controls. The modal
  has a quick top-right close X, prefilled editable customer email, subject
  preview, formatted itemized/totals preview, and a Send Invoice Email action
  backed by a protected admin Resend route. Verified in-browser without sending
  a real email, `npm run lint`, and `npm run build`.
- **Admin manual-order shipping fields labeled** (2026-06-18): The Create
  Manual Order modal now has visible labels for Delivery Method, Shipping Fee,
  Discount, and all address inputs so the zero-value money fields are no longer
  ambiguous. Verified desktop/mobile in-browser, `npm run lint`, and
  `npm run build`.
- **Admin manual-order product picker changed to search** (2026-06-18): The
  Create Manual Order modal now lets admins type an inventory number, SKU/id,
  or product title fragment and choose matching available products from a
  dropdown. Selected products appear in a compact removable list instead of the
  modal showing every available product by default. A right-side arrow can
  intentionally open the full available-products dropdown when needed. Verified
  desktop/mobile in-browser, `npm run lint`, and `npm run build`.
- **Admin Orders mobile layout reformatted** (2026-06-18): The admin Orders
  page now renders stacked, accessible order cards on mobile while preserving
  the desktop table. Mobile filters sit in a compact white panel, cards show
  customer/item/status/total context with a full-width View Order action, and
  the manual-order product picker keeps prices visible under long titles on
  phones. Verified in-browser mobile view, `npm run lint`, and `npm run build`.
- **Product Admin padding modal Close action added** (2026-06-17): The Image
  Padding modal footer now has a clear gold `Close` button for finishing the
  per-photo padding workflow. Verified `npm run lint` and `npm run build`.
- **Product Admin selected-photo eyedropper fixed** (2026-06-17): The Pad
  modal's `Pick From Selected Photo` action now uses a ref-backed selected
  photo index and opens the eyedropper immediately from the click, preventing
  photo 2+ picks from falling back to photo 1. Verified `npm run lint` and
  `npm run build`.
- **Product detail gallery arrow icon centering fixed** (2026-06-17): The
  circular left/right product image controls now use a separate centered
  Material Symbols glyph span so the chevrons sit in the middle of the button.
  Verified `npm run lint` and `npm run build`.
- **Product Admin per-photo image padding added** (2026-06-17): The Product
  Admin Pad modal now lets admins choose any product photo and apply padding to
  that image specifically, while public galleries/cards/cart/checkout resolve
  per-image padding with the old product-level value as fallback. Added
  `products.image_padding_by_image` to the image-padding SQL. Verified
  `npm run lint` and `npm run build`; admin modal browser interaction was
  blocked by sign-in in this session.
- **Product detail gallery arrows suppress zoom** (2026-06-17): Hovering or
  pressing inside the product detail image edge-arrow zones now closes the
  magnifier and prevents it from reopening over the controls. Verified
  in-browser, `npm run lint`, and `npm run build`.
- **Product image padding now follows cart/saved thumbnails** (2026-06-17):
  Cart and wishlist items carry `image_padding`, older saved entries hydrate
  missing padding from Supabase, and cart drawer, checkout summary,
  saved-items drawer, and account wishlist thumbnails render the same padded
  frame background as product images. Verified cart and checkout in-browser,
  `npm run lint`, and `npm run build`.
- **Product detail gallery carousel controls added** (2026-06-17): Product
  detail main images now support left/right edge clicks, centered thumbnail
  arrows, and a wrapping thumbnail lineup that keeps the active image centered.
  Verified in-browser, `npm run lint`, and `npm run build`.
- **Gold services Dental Gold image added** (2026-06-17): The Gold Services
  `Dental Gold` acquisition card now uses the new `dental.webp` asset, served
  from `next-app/public/assets/images/pages/dental.webp`. Verified in-browser,
  `npm run lint`, and `npm run build`.
- **Gold services Scrap & Broken image added** (2026-06-17): The Gold Services
  `Scrap & Broken` acquisition card now uses the new `scrap.jpg` asset, served
  from `next-app/public/assets/images/pages/scrap.jpg`. Verified in-browser,
  `npm run lint`, and `npm run build`.
- **Gold services Fine Jewelry image swapped** (2026-06-17): The Gold Services
  `Fine Jewelry` acquisition card now uses the new `gold.png` asset, served
  from `next-app/public/assets/images/pages/gold.png`. Verified in-browser,
  `npm run lint`, and `npm run build`.
- **Gold services Items We Acquire moved up** (2026-06-17): The Gold Services
  `Items We Acquire` section now appears directly below the Current Gold Spot
  Price block and before Decoding Gold Markings. Verified in-browser,
  `npm run lint`, and `npm run build`.
- **Login hero background image added** (2026-06-17): The account sign-in page
  now uses `login.png` as a full-page jewelry/silverware hero background with a
  soft white overlay behind the auth card. The image is served from
  `next-app/public/assets/images/pages/login.png`. Verified in-browser,
  `npm run lint`, and `npm run build`.
- **Gold buttons brightened site-wide** (2026-06-17): Shared `.gold-button`
  CTAs, outline-button hover fills, shop pagination active state, account tab
  active states, and hardcoded service-page CTA backgrounds now use the brighter
  Call Now gold gradient instead of the older dark-gold fill. Verified
  in-browser, `npm run lint`, and `npm run build`.
- **Shop pagination modernized** (2026-06-17): The bottom shop pagination and
  per-page controls now render as a white modern toolbar with compact page
  controls, icon chevrons, active-page emphasis, result count, and a cleaner
  per-page selector. Verified in-browser, `npm run lint`, and `npm run build`.
- **Account overview sign-out button added** (2026-06-17): The My Account
  overview heading block now has a right-aligned Sign Out button in the desktop
  blank space, stacking full-width on small screens. Verified in-browser,
  `npm run lint`, and `npm run build`.
- **Shop background changed to white** (2026-06-17): The modern `/shop` page
  main background now uses plain white instead of the prior warm off-white
  gradient. The shop filter sidebar, its inputs/selects, and My Account
  page/form/auth surfaces now use true white as well, while preserving existing
  borders, shadows, hero imagery, and product card styling. Verified
  in-browser, `npm run lint`, and `npm run build`.
- **Checkout and cart drawer modernized** (2026-06-17): Checkout now uses an
  account-style dashboard layout with a full-width top Order Summary, complete
  item titles, clearer prices, brief descriptions, and the contact form below.
  Cart items now support optional descriptions, checkout enriches older cart
  rows from Supabase, and the cart drawer was restyled as a wider modern
  white/gold side panel with card-like rows, larger images, descriptions, and
  clearer totals/actions. Verified in-browser, `npm run lint`, and
  `npm run build`. The expanded checkout Order Summary later isolated each item
  price into its own right-side Price column, centered the label/value inside a
  framed price block, and tightened item rows with smaller thumbnails, a
  one-line description, and a one-line specs strip for purity, metal, type,
  link type, length/size, and weight.
- **Silver metal purity filters limited to silver purities** (2026-06-17): Shop
  and Product Admin purity filters now show only silver-designated options such
  as `925 Sterling` when Metal is Silver, hide karat options, and clear
  incompatible purity selections when switching metal. Verified in-browser,
  `npm run lint`, and `npm run build`.
- **Silverware metal choices constrained to Silver** (2026-06-17): When
  Silverware / Sterling is selected in shop or Product Admin filters, the Metal
  dropdown now offers only Silver. Product Admin continues to snap Metal Type to
  Silver. Verified in-browser, `npm run lint`, and `npm run build`.
- **Silverware label expanded to Silverware / Sterling** (2026-06-17): Updated
  shop and Product Admin item/product type dropdown labels to display
  `Silverware / Sterling` while preserving the existing stored values and URL
  parameters. AI/admin prompt guidance was updated to match. Verified
  in-browser, `npm run lint`, and `npm run build`.
- **Silverware filters snap to Silver** (2026-06-17): Selecting Silverware in
  the shop Item Type filter or admin Product Type filter now automatically sets
  the Metal filter to Silver. Admin also sets Metal Type to Silver and clears
  incompatible gold-only Metal Color filters. Verified in-browser,
  `npm run lint`, and `npm run build`.
- **Admin product filters collapsed behind button** (2026-06-17): The Product
  Admin table filter system is now hidden by default behind a Filters button
  beside Add Product, with active-filter count feedback and the table result
  count still visible in the toolbar. Verified in-browser, `npm run lint`, and
  `npm run build`.
- **Admin product filters matched to shop hierarchy** (2026-06-17): Reordered
  the Product Admin table filters to follow the shop-side catalog flow: Gender,
  Product Type, Brand, Metal, Metal Type, Metal Color, Purity, scoped Link Type
  and Length/Size, then admin-only Status, Location, and Featured. Product Type
  now controls whether Link Type, Length, or Size appears. Verified in-browser,
  `npm run lint`, and `npm run build`.
- **Admin Size/Length values normalized** (2026-06-17): Product Admin now
  strips inch units from Length/Size values entered manually, through Quick
  Fill parsing, or through the AI listing assistant, storing/displaying bare
  numerics in the admin table while public buyer displays continue to append
  `in` for necklace/bracelet lengths. Verified in-browser, `npm run lint`, and
  `npm run build`.
- **Product form AI assistant UI restyled** (2026-06-16): Add/Edit Product now
  uses a wider modern listing drawer with Photos first, a pastel Smart Listing
  Assistant panel second, Quick Fill as the manual fallback, and regular product
  fields below. The assistant includes a large tap-to-talk button, guided
  description checklist, no-photo context warning, and animated floating
  mic/waveform indicator while recording. Verified in-browser,
  `npm run lint`, and `npm run build`.
- **Provider-neutral AI product listing assistant foundation added**
  (2026-06-16): Product Admin Add/Edit now includes an AI Listing Assistant
  that accepts typed or browser-transcribed descriptions, requests a structured
  product draft through an admin-only route, previews returned fields, applies
  them with undo/optional overwrite, and keeps Quick Fill intact. Provider/model
  details live only in `next-app/src/lib/ai-product-provider.ts`, are configured
  by environment variables, and include multimodal image context from the first
  allowed product images. Verified in-browser, `npm run lint`, and
  `npm run build`.
- **Account order chevron icon fixed** (2026-06-16): corrected the Orders tab
  row chevron so the Material Symbols icon font is preserved instead of showing
  the literal `chevron_right` text. Verified in-browser, `npm run lint`, and
  `npm run build`.
- **Account order details dialog added** (2026-06-16): the buyer account Orders
  tab now lets customers click an order row to open a full details window with
  statuses, item snapshots, customer info, totals, and notes/addresses when
  present. The dialog closes from a top-left X. Verified in-browser,
  `npm run lint`, and `npm run build`.
- **Account tab layout stabilized** (2026-06-16): shared the account tab rail
  and support strip between `/account` and `/account/security`, aligned the
  security page hero/menu sizing with the main dashboard, and verified the tab
  rail keeps the same position across Overview, Wishlist, and Admin and
  Security. Verified in-browser, `npm run lint`, and `npm run build`.
- **Account overview detail cards reformatted** (2026-06-16): refined the main
  `/account` Account Overview personal-detail tiles with a dedicated icon
  column, label/value copy block, tightened label styling, consistent spacing,
  and safer wrapping for longer values. Verified in-browser,
  `npm run lint`, and `npm run build`.
- **Account security menu completed** (2026-06-16): fixed `/account/security`
  so it shows the full account menu: Overview, Orders, Wishlist, and active
  Admin and Security. Orders and Wishlist links now return to `/account` with
  URL-backed tab selection. Verified in-browser, `npm run lint`, and
  `npm run build`.
- **Account Admin and Security page added** (2026-06-16): removed the Profile
  Information tab/page and added an `Admin and Security` account menu link after
  Wishlist. The new protected `/account/security` page contains the Supabase
  Auth password-change flow and keeps the same right-side Admin Panel, Account
  Details, and Shop Now card rail as the main buyer dashboard. Verified
  in-browser, `npm run lint`, and `npm run build`.
- **Profile Information moved to standalone page** (2026-06-16): changed the
  account dashboard Profile Information tab into a link to the new protected
  `/account/profile` route. This intermediate page was later removed when the
  account menu was simplified around Admin and Security.
- **Account dashboard tab views added** (2026-06-16): the account tab rail now
  switches between real Overview, Orders, and Wishlist panels, with Profile
  Information linking to its own page. Admin Panel was removed from the top tabs
  but remains as an admin-only shortcut card. Orders reads live Supabase orders
  for the signed-in user, Wishlist shows the current saved-items context, and
  Account Details includes an expandable Supabase password-change form. Verified
  in-browser, `npm run lint`, and `npm run build`.
- **Buyer account dashboard makeover added** (2026-06-16): `/account` now uses
  a desktop buyer-dashboard layout inspired by the supplied reference, with a
  wide hero, compact tab-style account menu, Account Overview panel, right-side
  Account Details/Admin/Shop cards, and support strip. The tab menu was later
  revised to current/relevant areas only: Overview, Orders, Wishlist, and Admin
  and Security. Verified in-browser, `npm run lint`, and
  `npm run build`.
- **Account profile preview/edit flow added** (2026-06-16): Complete Profile now
  starts as a compact read-only summary with an Edit Profile button. Editing
  expands the full form, keeps Save Profile at the bottom, and collapses back
  to preview after a successful save. Verified in-browser, `npm run lint`, and
  `npm run build`.
- **Account background hero fade extended** (2026-06-16): moved the account
  jewelry image from the bounded hero section onto a fixed page background
  layer, extended it behind the upper account content, and added a vertical
  fade so the image no longer ends at a hard horizontal edge. Verified
  in-browser, `npm run lint`, and `npm run build`.
- **Cart clear-all controls added** (2026-06-16): added `Clear Cart` /
  `Vaciar carrito` actions to the cart drawer footer and the header
  added-item cart popup, both wired to the shared cart context `clear()` method
  so local cart state and storage clear together. Verified in-browser,
  `npm run lint`, and `npm run build`.
- **Account hero image swapped to jewelry asset** (2026-06-16): copied
  `jewelry.png` into public assets as `account-hero-jewelry.png`, updated the
  `/account` hero background to use it, and removed the temporary root
  `jewelry.png` file. Verified in-browser, `npm run lint`, and
  `npm run build`.
- **Account page redesigned** (2026-06-16): restyled `/account` around the
  `account.png` reference with a chain-image hero, wide welcome layout, rounded
  elevated cards, larger Complete Profile form styling, account details card,
  and bottom trust strip. The Admin Panel card remains conditional on
  `isAdmin`. Verified in-browser, `npm run lint`, and `npm run build`.
- **Add/Edit Product image previews enlarged** (2026-06-16): increased Product
  Admin form photo thumbnails to 112px squares, widened spacing, enlarged cover
  and hover controls, and made the upload drop zone taller for easier image
  review before saving. Verified `npm run lint` and `npm run build`.
- **Modern shop design promoted to live `/shop`** (2026-06-16): made `/shop`
  and `/es/shop` render the modern layout from the `/shop-modern` prototype
  while preserving live products, pricing, filters, pagination, cart, wishlist,
  and image-preview behavior. Gender tab links now stay on canonical shop URLs,
  and `/shop-modern` remains as a preview/backup route. Verified in-browser,
  `npm run lint`, and `npm run build`.
- **Modern shop hero image swapped to chain asset** (2026-06-16): copied the
  new `chain.png` into public assets and updated `/shop-modern` to use it as a
  larger full-cover white-feathered hero background. Verified in-browser,
  `npm run lint`, and `npm run build`.
- **Modern shop hero background cleaned up** (2026-06-16): changed the
  `/shop-modern` hero panel to white and feathered the cropped hero image across
  the full hero area so the right-side image edge no longer breaks into cream.
  Verified in-browser, `npm run lint`, and `npm run build`.
- **Modern shop sidebar alignment refined** (2026-06-16): adjusted the
  desktop `/shop-modern` sidebar offset so the left filter block aligns with
  the first product-card row. Verified in-browser, `npm run lint`, and
  `npm run build`.
- **Modern shop clone refined** (2026-06-16): refined `/shop-modern` to more
  closely match the `modern.png` reference. Added a preview-only cropped hero
  image asset from the screenshot, replaced generic hero proof marks with
  material icon badges, and restyled the left filter menu with search first,
  stacked spot cards, gender pill buttons, rounded fields, and a softer
  cream/gold shell. `/shop` remains classic. Verified in-browser,
  `npm run lint`, and `npm run build`.
- **Modern shop clone preview added** (2026-06-16): added `/shop-modern` as a
  low-risk layout experiment using the same live products, pricing, filters,
  pagination, cart, wishlist, hover image previews, and gender tabs as `/shop`.
  The clone keeps the current product-card information while applying a softer
  modern cream/gold hero, filter shell, segmented tabs, and elevated card skin.
  The original `/shop` remains classic. Verified in-browser, `npm run lint`,
  and `npm run build`.
- **Quick Fill success notice color fixed** (2026-06-16): Product Admin Quick
  Fill applies now show a green success notice whenever fields are updated,
  including repeat applies that overwrite existing values. Full failures remain
  red, while partial applies keep listing rejected tokens without coloring the
  whole notice as an error. Verified `npm run lint` and `npm run build`.
- **Shop gender path tabs added** (2026-06-16): added a modern segmented Men’s /
  All / Ladies’ control above the public shop gallery grid. It uses the existing
  URL-backed `gender` filter, preserves the left-sidebar filters/search, resets
  pagination on tab change, and keeps the sidebar controls intact. Verified
  in-browser, `npm run lint`, and `npm run build`.
- **Homepage hero CTA backing refined** (2026-06-16): the Buy, Sell, and Trade
  hero buttons now have a subtle translucent gold backing, stronger gold border,
  soft glow, and light blur for better visibility over the video. Verified
  in-browser, `npm run lint`, and `npm run build`.
- **Shop card spec chips simplified** (2026-06-16): product gallery cards now
  use a consistent three-column spec chip row. Purity and grams are value-only,
  and length values normalize to inches like `28 in` or `7.75 in` without the
  `Length:` prefix. Gold purity chips use a karat-based yellow ramp so higher
  purity appears brighter/richer than lower purity. Product detail top stats
  and Specifications use the same display helper, keeping admin-entered length
  values simple while buyer views show inches. Verified in-browser,
  `npm run lint`, and `npm run build`.
- **Shop filter hierarchy reordered** (2026-06-16): the public shop filter
  controls now start with `Gender`, then `Item Type`, `Brand`, `Metal`,
  `Metal Color`, `Purity`, and `Sort`, with Link Type and Length still scoped
  to compatible item types. Verified in-browser, `npm run lint`, and
  `npm run build`.
- **Product image custom padding color added** (2026-06-16): Product Admin
  `Pad` modal now includes a first-photo preview, built-in No/White/Black
  choices, and a custom hex color path through the `Pick From First Photo`
  browser eyedropper action where supported. The manual swatch/hex input path
  was removed, and the picker button now includes a dropper icon. The Black
  Padding option now uses a black filled button with white text for faster
  recognition. Custom hex values are rendered by the shared
  image-padding helper on shop cards, product detail
  galleries, and admin thumbnails. Updated `supabase/product-image-padding.sql`,
  and the modal now gives a clear migration-needed message if the old Supabase
  check constraint rejects custom colors. Verified in-browser, `npm run lint`,
  and `npm run build`.
- **Product detail inventory reference added** (2026-06-16): public product
  detail pages now display a small `Item #` as its own first metadata line above
  metal/status when an inventory number is saved, and include it as structured
  product `sku`. Verified in-browser, `npm run lint`, and `npm run build`.
- **Product detail top stats include length** (2026-06-16): product detail
  pages now include available item length in the top stats row, ordered as
  status, metal color, purity, then length. Verified in-browser,
  `npm run lint`, and `npm run build`.
- **Product detail fine-metal weight clarified** (2026-06-16): Specifications
  now label the troy ounce value as fine gold/silver instead of leaving it
  ambiguous after the fine gram value. Verified in-browser, `npm run lint`, and
  `npm run build`.
- **Product detail Add to Cart CTA differentiated** (2026-06-16): detail-page
  Add to Cart now uses a deep green CTA treatment, while secondary actions stay
  outlined. Verified in-browser, `npm run lint`, and `npm run build`.
- **Product Admin thumbnails honor image padding** (2026-06-16): main Products
  table thumbnails now use the same per-listing image padding background as shop
  gallery cards. Verified in-browser, `npm run lint`, and `npm run build`.
- **Product Admin Pad action shows applied state** (2026-06-16): Products table
  `Pad` buttons now turn green for listings with white/black image padding and
  stay neutral when no padding is applied. Verified in-browser, `npm run lint`,
  and `npm run build`.
- **Product Admin table width tightened** (2026-06-16): shortened Product table
  headers to Type and Size, narrowed the Title column, and reduced row/header
  cell padding. Verified in-browser, `npm run lint`, and `npm run build`.
- **Product Admin table spacing optimized** (2026-06-16): Products table now
  sizes to content instead of filling extra desktop width, uses tighter compact
  column hints, truncates Brand when needed, and keeps Actions sticky so Delete
  stays reachable. Verified in-browser, `npm run lint`, and `npm run build`.
- **Product Admin title/brand divider added** (2026-06-16): added a subtle
  vertical divider before the Brand column to separate titles from metadata.
  Verified in-browser, `npm run lint`, and `npm run build`.
- **Product Admin Brand column centered** (2026-06-16): centered the Brand
  header and all Brand cell contents inside the existing fixed-width column,
  keeping long values truncated. Verified in-browser, `npm run lint`, and
  `npm run build`.
- **Add/Edit Product clear controls refined** (2026-06-16): clear buttons now
  refocus fields after clearing, filled native selects hide their dropdown arrow
  behind the X, and comboboxes switch between arrow-empty and X-filled states
  while reopening options after clear. Verified in-browser, `npm run lint`, and
  `npm run build`.
- **Add/Edit Product dropdown clear flow adjusted** (2026-06-16): dropdown-style
  controls now start with an arrow even when prefilled, arm to `x` after opening
  choices via the native picker where available, and clear/focus on the second
  click. Custom comboboxes show all options when opened from an existing value.
  Verified native dropdown behavior in-browser; `npm run lint` and
  `npm run build` pass.
- **Inventory/SKU row alignment refined** (2026-06-16): aligned the Add/Edit
  Product `SKU / Slug` toggle with the Inventory # input instead of the helper
  text. Verified in-browser, `npm run lint`, and `npm run build`.
- **Product Admin inventory display normalized** (2026-06-16): the main
  Products table now displays inventory numbers as plain numeric values for
  both stored and fallback/generated values, removing mixed `#` prefixes from
  the column. Verified in-browser, `npm run lint`, and `npm run build`.
- **Product image padding preference added** (2026-06-16): added per-product
  `image_padding` support for `none`, `white`, and `black` frame backgrounds on
  shop cards and product detail galleries. Product Admin rows now include a
  compact `Pad` action that opens a chooser for the setting. Added
  `supabase/product-image-padding.sql`. Verified in-browser, `npm run lint`,
  and `npm run build`.
- **Shop card spec chips colorized** (2026-06-16): rendered Purity, Grams, and
  Length/Size as compact chips with distinct subtle color treatments on product
  cards. Verified in-browser, `npm run lint`, and `npm run build`.
- **Shop card price emphasis refined** (2026-06-16): made the product card
  `Your price` row easier to scan with a subtle gold-tinted band, separators,
  stronger label weight, and a larger price amount. Verified in-browser,
  `npm run lint`, and `npm run build`.
- **Shop pagination layout centered** (2026-06-16): centered the product page
  navigation in the shop pagination footer and aligned the Per Page selector to
  the right on desktop. Verified in-browser, `npm run lint`, and
  `npm run build`.
- **Shop gallery image preview controls added** (2026-06-16): product cards now
  include compact edge-aware previous/next image arrows and slightly faster
  hover-start rotation through available photos using a true opacity crossfade.
  The image count badge was removed, hover stops at the final photo, and leaving
  the image area returns the preview to the cover photo after one second.
  Verified in-browser, `npm run lint`, and `npm run build`.
- **Product detail scrap/spot panel standardized** (2026-06-16): product detail
  pages now render the scrap gold/silver value and Based on Spot panel whenever
  structured metal weight and purity data are available, independent of pricing
  mode/multiplier. Verified in-browser, `npm run lint`, and `npm run build`.
- **Quick Fill visible helper text simplified** (2026-06-16): removed the long
  visible "Best format..." paragraph from Add/Edit Product while preserving the
  Quick Fill controls and behavior. Verified `npm run lint` and
  `npm run build`.
- **Add/Edit Product field clear buttons added** (2026-06-16): added compact
  right-side `X` clear/reset controls to product drawer inputs, selects,
  textareas, and combobox fields. Verified in-browser, `npm run lint`, and
  `npm run build`.
- **Product Admin table tightened** (2026-06-16): hid Metal Type, Gender, and
  Location from the main Products table while keeping the fields in forms,
  filters, and data. Verified in-browser, `npm run lint`, and `npm run build`.
- **Product Type / Metal Type additive hierarchy added** (2026-06-16): added
  nullable Product Type and Metal Type support across shared typing, Product
  Admin Add/Edit/table/filters, public shop item-type filters, product detail
  specs, Quick Fill labeled fields, and Quick Fill AI prompt guidance. The app
  reads new fields with legacy fallback and dual-writes to existing
  `jewelry_type`/`category` compatibility fields. Added
  `supabase/product-type-metal-type.sql` and updated canonical SQL. Verified
  in-browser, `npm run lint`, and `npm run build`.
- **Watch item type support swept site-wide** (2026-06-16): confirmed Watch is
  supported across shared product typing, Add/Edit Product, admin/shop filters,
  product specs, and Supabase jewelry-type SQL. Expanded watch/wristwatch/
  timepiece recognition and updated Quick Fill/AI prompt guidance to use
  `Jewelry Type:Watch` without Link Type. Verified in-browser, `npm run lint`,
  and `npm run build`.
- **Quick Fill AI Brand detection prompt strengthened** (2026-06-16): added
  explicit Brand detection rules to the default AI prompt, automatically
  appends the rules to older saved prompt overrides, and expanded parser aliases
  for Brand Name, Maker Name, Designer Name, and Manufacturer Name. Verified
  `npm run lint` and `npm run build`.
- **Product detail CTA placement moved under price** (2026-06-16): moved Add
  to Cart, Save, Inquire, and Call directly under "This is your price" and above
  the scrap/spot pricing cards. Verified in-browser, `npm run lint`, and
  `npm run build`.
- **Product detail pricing panel shifted to warm gold colorway** (2026-06-16):
  kept the modern segmented panel shape and switched the violet/lavender
  styling to a lighter warm gold gradient with cream and warm neutral supporting
  colors. Verified in-browser, `npm run lint`, and `npm run build`.
- **Product detail pricing panel modernized** (2026-06-16): restyled the
  product-detail scrap value and spot basis panel with a lavender app-like
  surface, violet primary value tile, white secondary spot tile, and 8px rounded
  corners inspired by the supplied visual reference. Verified in-browser,
  `npm run lint`, and `npm run build`.
- **Product detail pricing basis block refined** (2026-06-16): reformatted the
  item-detail scrap value, spot basis, and site-wide update ticker into a
  cleaner colored pricing panel with a shorter update line. Verified
  in-browser, `npm run lint`, and `npm run build`.
- **Shop card Length/Size spec added** (2026-06-16): gallery cards now show a
  right-aligned Length or Size value on the same detail row as Purity and
  Grams when a product has a stored value. Verified in-browser,
  `npm run lint`, and `npm run build`.
- **Shop Brand filtering/sorting and pagination added** (2026-06-16): the shop
  left sidebar now includes Brand filtering and Brand A-Z/Z-A sorting. The
  gallery defaults to 24 listings per page with bottom pagination controls and
  a per-page selector for 12, 24, 48, or 96 listings. Verified in-browser,
  `npm run lint`, and `npm run build`.
- **Product Brand field and labeled Quick Fill guidance added** (2026-06-16):
  added `products.brand` support across Product Admin, Add/Edit Product, Quick
  Fill, public search, and product detail specs. Quick Fill now accepts labeled
  `Brand:...` and can directly populate custom Link Type or Length/Size text
  without turning those values into permanent dropdown choices. Added
  `supabase/product-brand.sql`. Verified in-browser, `npm run lint`, and
  `npm run build`.
- **Shop desktop filter sidebar added** (2026-06-16): moved shop filters,
  search, live metal price badges, availability toggle, count, and clear action
  into a sticky left sidebar on desktop while keeping the mobile filter area
  collapsed above the grid. Verified in-browser, `npm run lint`, and
  `npm run build`.
- **Product detail price notes stacked** (2026-06-16): moved the current
  spot-price basis sentence below the current scrap value note on product detail
  pages, then shortened the copy to `Based on $X/oz`. Verified in-browser,
  `npm run lint`, and `npm run build`.
- **Product detail spot-basis wording refined** (2026-06-16): changed the
  product detail copy to say "This price is based on the current spot price"
  instead of "current gold value." Verified in-browser, `npm run lint`, and
  `npm run build`.
- **Product detail spot basis/ticker added** (2026-06-15): item detail pages now
  show each spot-priced item's current scrap value with the current gold/silver
  spot value per ounce on the same line, followed by a live countdown to the
  next site-wide metal-price refresh. Verified in-browser, `npm run lint`, and
  `npm run build`.
- **Bicolor Gold metal color added** (2026-06-15): added `bicolor_gold` as a
  Gold metal color in product types, admin/product controls, filters, Quick
  Fill, public labels, and the default AI prompt. Public broad Metal filtering
  treats Bicolor Gold as a crossover item that appears under both Gold and
  Silver. Updated `supabase/product-metal-variants.sql`. Verified in-browser,
  `npm run lint`, and `npm run build`.
- **Account admin shortcut moved above Complete Profile** (2026-06-15): admin
  users now see the My Account Admin Panel shortcut before the Complete Profile
  form. Verified in-browser, `npm run lint`, and `npm run build`.
- **Product Jewelry Type / Link Type split added** (2026-06-15): products now
  separate broad Jewelry Type from Link Type. Admin Products has Jewelry Type
  and Link Type filters/form controls, Link Type is only available for
  necklaces and bracelets, the main Products table shows Jewelry Type plus
  Length/Size instead of a Link Type column, ring rows/forms use Size while
  necklaces/bracelets use Length, Quick Fill accepts Jewelry Type/Link Type and
  Size/Ring Size labels, public shop filters scope Link Type by selected item
  type, and product detail specs show the separate fields. Added
  `supabase/product-jewelry-type.sql`.
  Verified in-browser, `npm run lint`, and `npm run build`.
- **Save + Add Another inventory increment fixed** (2026-06-15): after adding a
  product with `Save + Add Another`, the reloaded add form now calculates
  Inventory # from the just-updated product list so it increments immediately.
  Verified Add Product auto-fill in-browser, `npm run lint`, and
  `npm run build`.
- **Product Admin Actions column tightened** (2026-06-15): the Products table
  Actions column now uses a compact fixed width and wraps row actions into a
  clean two-row stack, reducing table width after the Melt column addition.
  Verified in-browser, `npm run lint`, and `npm run build`.
- **Product Admin Melt column added** (2026-06-15): the main Products table now
  includes a sortable `Melt` column between Weight and Mode, showing the raw
  live spot melt value before the selling-price multiplier. Verified
  in-browser, `npm run lint`, and `npm run build`.
- **Inventory number duplicate guard added** (2026-06-15): Add/Edit Product now
  rejects duplicate inventory numbers before insert/update and shows an inline
  warning if the drawer value collides with another product. Added
  `supabase/product-inventory-number-unique.sql` and updated product workflow
  SQL to create a unique partial inventory-number index after existing
  duplicates are fixed. Verified the live duplicate `#21` warning in-browser,
  `npm run lint`, and `npm run build`.
- **Product Admin table widened for desktop** (2026-06-15): the main Products
  admin table now has a wider 2xl desktop container, a desktop table minimum
  width, and a reserved Actions column width so row action buttons remain inside
  the table boundary. Verified in-browser, `npm run lint`, and
  `npm run build`.
- **Admin product View return path fixed** (2026-06-15): Product Admin table
  `View` links now pass `returnTo=admin`, making product detail pages show a
  `Back to Admin` link to `/admin` or `/es/admin`; normal shopper product pages
  still link back to the shop. Verified in-browser, `npm run lint`, and
  `npm run build`.
- **Quick Fill Copy Prompt fallback fixed** (2026-06-15): Product Admin and
  Admin Settings now use a shared clipboard helper. If direct copy is blocked,
  Product Admin opens the AI prompt modal with text selected for manual copy,
  and Admin Settings selects the prompt textarea. Verified in-browser,
  `npm run lint`, and `npm run build`.
- **Quick Fill AI prompt output rules refined** (2026-06-15): the default AI
  formatting prompt now requests a fenced code block, keeps gram weight out of
  product titles when Weight is supplied separately, and avoids repeating
  description-covered details in Public Notes or Internal Notes. Verified
  `npm run lint` and `npm run build`.
- **Quick Fill Metal Color guidance tightened** (2026-06-15): Add/Edit Product
  Quick Fill now has a current visible helper and placeholder for Metal Color,
  the default AI prompt explains the Metal Color-to-Category mapping, and
  explicit Metal Color wins even if Category appears later in labeled Quick Fill
  text. Verified in-browser, `npm run lint`, and `npm run build`.
- **Shop Metal Color filter scoped by selected Metal** (2026-06-15): the public
  shop now limits Metal Color choices to gold colors when Metal is Gold and
  Silver/Vermeil when Metal is Silver. Incompatible direct URL combinations are
  ignored server-side. Verified in-browser, `npm run lint`, and
  `npm run build`.
- **Metal Type renamed to Metal Color in UI** (2026-06-15): changed admin,
  Add/Edit Product, public shop filters, Quick Fill feedback, and the default
  AI formatting prompt from "Metal Type" to "Metal Color." Public shop filters
  now write `metalColor` while still accepting older `metalType` URLs. Verified
  `npm run lint` and `npm run build`.
- **Product metal subtypes added** (2026-06-15): added a `metal_variant` product
  field for Yellow Gold, White Gold, Rose Gold, Tricolor Gold, Silver, and
  Vermeil while keeping broad `category` as Gold/Silver for pricing. Add/Edit
  Product now has a Metal Color selector, Product Admin can search/sort/filter by
  color, Quick Fill accepts labeled Metal Color values, public shop filters
  include Metal Color, product cards/details show subtype labels, and order item
  snapshots use the subtype label. Added `supabase/product-metal-variants.sql`.
  Verified in-browser, `npm run lint`, and `npm run build`.
- **Product detail public notes moved below actions** (2026-06-15): product
  detail pages now render `public_notes` as a buyer-facing Notes section below
  the Add to Cart / Save / Inquire / Call action row, preserving line breaks.
  Verified in-browser, `npm run lint`, and `npm run build`.
- **Product table detail View link added** (2026-06-15): each row in the main
  Product Admin table now includes a `View` link to the public product detail
  page. The link opens in the same tab so browser Back returns to `/admin` and
  restores the table. Verified in-browser, `npm run lint`, and `npm run build`.
- **Admin Settings prompt editor added** (2026-06-15): added protected
  `/admin/settings` plus an `Admin Settings` link in the shared admin header.
  The page starts with a Quick Fill AI formatting prompt editor that saves a
  browser local override, resets to the shared default prompt, and copies the
  prompt. Product Admin uses the saved prompt override for Copy Prompt/View AI
  Prompt. Verified settings page in-browser, `npm run lint`, and
  `npm run build`.
- **Product ID field hidden on Add Product** (2026-06-15): Add Product now
  hides the standalone `ID (slug, auto-generated if blank)` field and relies on
  generated IDs. Edit Product still exposes the field for post-creation
  adjustments, with saves matched against the original product row. Verified
  in-browser, `npm run lint`, and `npm run build`.
- **Quick Fill validation tightened** (2026-06-15): Product Admin Quick Fill is
  now partially applies recognized comma-separated tokens while blocking and
  listing any unrecognized tokens. Chain type matching no longer uses loose
  substring matches. Recognized tokens replace existing form values, category
  replacements keep paired metal/purity fields consistent, repeated applies
  overwrite existing form values, explicitly blank optional fields can clear
  prior values, and the Quick Fill text box clears after a successful apply.
  Quick Fill
  accepts plain comma values, `Field:Value` pairs, and two-line CSV
  header/value pastes, including title EN/ES, location, price mode, asking
  price, descriptions EN/ES, public notes, and internal notes. Feedback appears
  inside the Add/Edit Product drawer. Unlabeled CSV rows that do not parse
  cleanly as standalone tokens fall back to the Add/Edit Product form order,
  preserving blank columns and quoted text with commas, while labeled rows can
  be in any order. Combined chain/jewelry descriptors such as
  `Cuban link bracelet` are rejected as one token; enter those concepts
  separately. The Quick Fill helper now keeps the AI formatting prompt hidden by
  default, while exposing Copy Prompt and View AI Prompt actions. The prompt asks
  an AI agent to format random item descriptions into one quick-copy
  `Field:Value` text block and includes terminology/notes rules for Italian-made
  pieces, chain styles, and public/internal notes. Verified in-browser, `npm run lint`, and
  `npm run build`.
- **Product image crop workflow added** (2026-06-15): Add/Edit Product
  thumbnails now open a full-size preview with a Crop action. The crop editor
  now uses a draggable crop-box overlay with edge/corner resize handles, saves a
  compressed WebP replacement for the selected image in the product form, starts
  maximized so unchanged saves are no-ops, and deletes the old uploaded Supabase
  Storage object when it is no longer referenced. Verified preview/crop UI
  in-browser, `npm run lint`, and `npm run build`.
- **Asking Price gated by manual pricing** (2026-06-15): Add/Edit Product now
  disables and grays out Asking Price unless Price Mode is Manual / Fixed.
  Verified in-browser, `npm run lint`, and `npm run build`.
- **Product form sort-order field removed** (2026-06-15): removed Sort Order
  from Add/Edit Product so product ordering is managed only by dragging rows in
  the master product table. New and cloned products still get automatic sort
  positions. Verified in-browser, `npm run lint`, and `npm run build`.
- **Product note fields simplified** (2026-06-15): removed the redundant
  "Extra notes about this item" Add/Edit Product field, leaving Public Notes and
  Internal Notes as the two note paths. Existing extra-note values are folded
  into Internal Notes on the next product save. Verified in-browser,
  `npm run lint`, and `npm run build`.
- **Inventory number auto-fill added to product form** (2026-06-15): Add/Edit
  Product now treats Inventory # as auto-filled/locked by default, with a Manual
  checkbox to unlock overrides. The auto-fill also respects displayed fallback
  inventory numbers from older products, preventing Add Product from reusing a
  visible number such as `#1`. Verified in-browser, `npm run lint`, and
  `npm run build`.
- **Product form internal fields simplified** (2026-06-15): removed Minimum
  Price, Cost Basis, Melt Value Snapshot, Acquisition Date, and Acquisition
  Source from the shared Add/Edit Product form. Verified in-browser,
  `npm run lint`, and `npm run build`.
- **Pending-payment products hidden from public gallery** (2026-06-15): updated
  `/shop` so `pending_payment` products are excluded from public gallery
  filters, counts, sorting, and cards until they are returned to `available`.
  Verified `/shop` in-browser, `npm run lint`, and `npm run build`.
- **Admin header Home link added** (2026-06-15): added a far-left `← Home`
  link to the shared admin header, returning admins to the public homepage.
  Verified in-browser, `npm run lint`, and `npm run build`.
- **User order/invoice visibility added** (2026-06-15): updated
  `/admin/users` with Orders and Invoices columns and added
  `/admin/users/[id]/invoices` to list generated invoices plus purchases/orders
  that do not yet have invoice records. Verified in-browser, `npm run lint`,
  and `npm run build`.
- **Homepage subscribers capture added** (2026-06-15): added a homepage hero
  subscriber CTA, `/api/subscribe`, protected `/admin/subscribers`, shared admin
  header Subscribers nav item, and `supabase/homepage-subscribers.sql` with a
  security-definer signup RPC plus admin read policy. Verified homepage/admin
  in-browser, `npm run lint`, and `npm run build`.
- **Admin header centralized and standardized** (2026-06-15): added a shared
  `AdminHeader` component and wired Product Admin, Orders, Order Detail,
  Messages, Inquiries, and Users to the same Products/Orders/Messages/Inquiries
  /Users menu. Products stays gold, Messages keeps its unread badge, and only
  the active section is underlined. Verified all admin headers in-browser,
  `npm run lint`, and `npm run build`.
- **Messages header navigation completed** (2026-06-15): added the missing
  Inquiries and Users links to `/admin/messages` and verified only the active
  Messages item is underlined. Verified in-browser, `npm run lint`, and
  `npm run build`.
- **Admin nav active underline refined** (2026-06-15): renamed the Product
  Admin header label to `Products` and adjusted admin nav styling so only the
  active menu item is underlined. Verified in-browser, `npm run lint`, and
  `npm run build`.
- **Product Admin menu styling aligned** (2026-06-15): changed the main Product
  Admin nav links to match the compact underlined admin header links used on
  the Messages page. Verified in-browser, `npm run lint`, and `npm run build`.
- **Admin Messages unread badge added** (2026-06-15): added a reusable Messages
  admin navigation link with a compact unread count badge, wired to
  `admin_notifications.is_read = false` across the main admin surfaces.
  Verified in-browser, `npm run lint`, and `npm run build`.
- **Checkout admin notifications/messages/email added** (2026-06-15): checkout
  now posts to `/api/checkout/order`, creates an unpaid order via Supabase RPC,
  snapshots items, moves ordered products to `pending_payment`, inserts an admin
  notification, and sends an order email through Resend when configured. Added
  protected `/admin/messages`. Verified `npm run lint` and `npm run build`.
- **Orders/Sales admin section added** (2026-06-15): added protected
  `/admin/orders` and `/admin/orders/[id]`, manual order creation from
  available products, order item snapshots, order list filters, order detail
  status controls, product lifecycle transitions for paid/unpaid/cancelled
  orders, internal notes, and invoice record generation. Verified in-browser,
  `npm run lint`, and `npm run build`.
- **Sales workflow foundation / inventory lifecycle chunk added** (2026-06-15):
  added additive Supabase schema for product lifecycle fields, orders,
  order_items, invoices, saved_items, and expanded inquiries/profile metadata.
  Product Admin now has richer status/location/featured filters, SKU/inventory
  search, lifecycle quick actions, duplicate, expanded product form fields, and
  guarded delete/archive behavior for order-linked products. Public shop/cart
  surfaces now treat reserved/pending/sold/archive states as unavailable.
  Verified `npm run lint` and `npm run build`.
- **Admin account users table added** (2026-06-15): added protected
  `/admin/users` route linked from Product Admin, reading live Supabase
  `profiles` rows with contact/location/marketing/admin metadata. Added the
  required admin profile read policy SQL. Verified `npm run build`; lint remains
  blocked by pre-existing cart/wishlist hydration lint errors.
- **Mobile shop card cart button overflow fixed** (2026-06-13): tightened
  card-only cart button spacing and switched to compact Add/Remove labels on
  slim mobile widths. Verified 320px/375px in-browser and `npm run build`.
- **Shop sort dropdown added** (2026-06-13): added a URL-backed Sort dropdown
  to the shop filter pop-out for price and weight ordering. Verified
  `/shop?sort=price-asc`, `/shop?sort=weight-desc`, and `npm run build`.
- **Estate route redirect loop fixed** (2026-06-13): updated the proxy
  English-locale internal rewrite handling so `/estate-jewelry` and
  `/estate-services` render instead of redirecting back to themselves. Verified
  `/estate-jewelry` in-browser and `npm run build`.
- **Admin drag-to-reorder inventory added** (2026-06-13): added a drag handle
  column to the product admin master list and persist row reorder changes to
  product `sort_order` values for the relevant Available/Sold group. Verified
  `/admin` render in-browser and `npm run build`.
- **Account profile full-name field hidden** (2026-06-13): removed the visible
  Full Name input from the complete profile form while preserving internal
  `full_name` generation from first/last name. Verified `/account` in-browser
  and `npm run build`.
- **Complete customer profiles added** (2026-06-13): added editable account
  profile fields for name, contact email, phone, alternate phone, complete
  address, country, and marketing opt-in; added Supabase profile migration SQL;
  checkout prefill now uses saved profile data. Verified `/account` render and
  `npm run build`.
- **Checkout account prefill added** (2026-06-13): checkout customer fields now
  prefill from the signed-in Supabase user/profile where data is available,
  while remaining editable. Verified build and in-browser email prefill.
- **Checkout-to-payment step added** (2026-06-13): removed the secure-payment
  placeholder from checkout, changed the button to Continue to Payment, added a
  `/payment` route with payment fields, and reused the order summary there.
  Verified in-browser and `npm run build`.
- **Checkout shipping rates added** (2026-06-13): priced Local Pickup at $0,
  Express Overnight Insured at $75, and Priority Insured at $45, with shipping
  included in the estimated total. Verified in-browser and `npm run build`.
- **Checkout shipping option selector added** (2026-06-13): added Local Pickup,
  Express Overnight, and Priority Insured options under Florida sales tax in
  the checkout order summary. Verified in-browser and `npm run build`.
- **Checkout summary remove control added** (2026-06-13): added per-item remove
  buttons to the checkout page's right-hand order summary, updating cart state
  and totals immediately. Verified in-browser and `npm run build`.
- **Shop length filter scoped by item type** (2026-06-13): length buttons now
  appear only for Necklace or Bracelet item types, with chain lengths for
  necklaces and bracelet lengths for bracelets. Verified in-browser and
  `npm run build`.
- **Shop length buttons made checkable** (2026-06-13): updated the horizontal
  length multi-select controls with embedded checked-state indicators while
  preserving URL-backed toggling. Verified in-browser and `npm run build`.
- **Shop card cart button alignment fixed** (2026-06-13): standardized gallery
  title height/action placement and fixed card cart button height so cart
  actions align across rows. Verified desktop/mobile in-browser and
  `npm run build`.
- **Shop length selector layout refined** (2026-06-13): moved the multi-select
  length options into a horizontal button row beneath the main shop filter
  dropdowns. Verified in-browser and `npm run build`.
- **Shop length multi-select added** (2026-06-13): changed the shop gallery
  length filter to support multiple selected lengths via checkboxes and a
  URL-backed `length` value. Verified in-browser and `npm run build`.
- **Product detail scrap value added** (2026-06-13): added the current scrap
  gold/silver value under "This is your price" on product detail pages. Verified
  in-browser and `npm run build`.
- **Shop card cart toggle updated** (2026-06-13): gallery Add to Cart buttons
  now show a brief local confirmation, switch to Remove from Cart after adding,
  and remove the item on the next click. Verified in-browser and `npm run build`.
- **Admin inventory numbers added** (2026-06-13): added an "Inv #" admin table
  column tied to the unfiltered public shop gallery order. Verified against
  `/shop` and `npm run build`.
- **Admin product table sorting added** (2026-06-13): made product admin table
  headers clickable for sorting by each data column, including numeric current
  price sorting. Verified in-browser and `npm run build`.
- **Shop menu reorganized** (2026-06-13): changed Shop into a header
  dropdown/mobile accordion with Store (`/shop`) and Auctions (`/auctions`), and
  removed Auctions as a standalone top-level nav item. Verified desktop/mobile
  in-browser and `npm run build`.
- **Checkout split into standalone page** (2026-06-13): changed the cart drawer
  to stay cart-only, moved checkout into `/checkout`, and made the drawer's
  "Proceed to Checkout" action navigate to the standalone page. Verified
  in-browser and `npm run build`.
- **Auctions page and header link added** (2026-06-13): added a localized
  `/auctions` route, placed Auctions between Sell and About in the header, and
  added the route to the sitemap. Verified in-browser and `npm run build`.
- **About menu and Services page added** (2026-06-13): changed the header About
  item into a dropdown with "About Us" and "Other Services," added `/services`
  with buttons to Free Evaluation and Estate Services, and added the route to
  the sitemap. Verified in-browser and `npm run build`.
- **Sell submenu labels updated** (2026-06-13): changed English header submenu
  labels to "Sell Us Gold," "Sell Us Silver," and "Sell Us Bullion." Verified
  in-browser and `npm run build`.
- **Header Sell label shortened** (2026-06-13): changed the English main
  header nav label from "Sell To Us" to "Sell." Verified in-browser and
  `npm run build`.
- **Shop card price amount bolded** (2026-06-13): increased the gallery card
  price amount font weight. Verified computed styles in-browser and
  `npm run build`.
- **Shop card price label matched to price** (2026-06-13): made "Your price"
  the same font size and bold weight as the price amount. Verified computed
  styles in-browser and `npm run build`.
- **Shop card spacing/spec text refined** (2026-06-13): tightened the gallery
  card title-to-price spacing and increased the purity/grams line size/weight.
  Verified rendered card metrics in-browser and `npm run build`.
- **Shop gallery widened for desktop** (2026-06-13): widened the shop page
  container and adjusted responsive columns so the gallery shows more listings
  per row on large and widescreen desktop displays. Verified 1440px, 1536px,
  and 1800px in-browser and `npm run build`.
- **Shop card action row simplified** (2026-06-13): removed the Inquire button
  from gallery cards and changed the card cart button to “Add to Cart.”
  Verified in-browser and `npm run build`.
- **Shop card typography tuned** (2026-06-13): decreased the gallery card title
  font size and increased the purity/grams spec line size. Verified in-browser
  and `npm run build`.
- **Shop card price/spec display updated** (2026-06-13): gallery cards now show
  “Your price” beside the price and replace the spot-context line with purity
  and grams. Verified in-browser and `npm run build`.
- **Shop live metal price strip added** (2026-06-13): displayed live silver to
  the left of the shop search bar and live gold to the right, reusing existing
  spot-price data. Verified desktop/mobile layout in-browser and
  `npm run build`.
- **Shop item-type filter added** (2026-06-13): added a URL-backed Item Type
  dropdown to the shop filter panel for necklaces, bracelets, earrings, rings,
  pendants, and watches. Verified Bracelet filtering in-browser and
  `npm run build`.
- **Shop filters collapsed behind Filter button** (2026-06-13): hid the metal,
  purity, chain type, gender, length, and available-only controls until the
  shopper opens the Filter panel. Verified panel open and filter application
  in-browser; `npm run build` passes.
- **Product images fit without cropping** (2026-06-13): product photos now use
  fit/contain rendering across shop cards, detail galleries, admin thumbnails,
  cart thumbnails, and wishlist thumbnails; gallery zoom accounts for contained
  image bounds. Verified in-browser and `npm run build`.
- **Mobile product image magnification added** (2026-06-13): product detail
  images now support touch/pen press-and-drag zoom on mobile, with the floating
  magnifier offset away from the finger. Desktop hover zoom still works.
  Verified the product route in-browser and `npm run build`.
- **English redirect loop fixed** (2026-06-13): patched the Next proxy so
  unprefixed English URLs render successfully, direct `/en` URLs canonicalize
  once to unprefixed paths, and Spanish prefixed URLs continue to work. Verified
  `/`, `/shop`, `/en`, `/en/shop`, `/es`, `/es/shop`, and `npm run build`.
- **Legacy static site removed** (2026-06-13): deleted root static pages, `es/`,
  old vanilla scripts, root copied assets, old Netlify Function, obsolete static
  tooling, empty staging folders, old static admin, and unused Next starter
  SVG/reference assets.
- **Docs updated for Next cleanup** (2026-06-13): rewrote `AGENTS.md`,
  `ACCOUNT_SETUP.md`, `STRUCTURE.md`, `INTEGRITY.md`, and `ARCHITECTURE.md` for
  the Next.js app; updated current status, changelog, overview, client notes,
  and root Netlify redirects.
- **Legacy removal audit completed** (2026-06-13): generated
  `project-docs/LEGACY_REMOVAL_REPORT.md`, confirmed root Netlify config builds
  from `next-app`, confirmed the Next shop uses Supabase `products`, checked
  mirrored assets, and verified `npm run build` passes from `next-app/`.
- Created the `project-docs/` memory framework (2026-06-01).
