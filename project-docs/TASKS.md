# Tasks

> Open work only, plus a short recent-completions record. Full completed history
> lives in `CHANGELOG.md`. Last reconciled: **2026-07-28**.

## In Progress

- **Deploy and verify the 2026-07-28 production follow-up fixes.** Local source
  now fixes the product-detail hydration mismatch with an explicit
  `America/New_York` clock and returns scanner probes from a pre-routing edge
  handler. After the owner's manual deployment, repeat live English/Spanish
  desktop/mobile console checks and confirm all configured probes return 410.

## High Priority Backlog

- **Complete destination-tax design after accountant review.** Keep the current
  6% Florida-only policy until reviewed. Remaining design includes destination
  county/rate lookup, Florida's per-item $5,000 discretionary-surtax cap,
  registered nexus states, pre-address estimate wording, and PayPal end-to-end
  jurisdiction cases. Do not collect another state's tax before registration.
- **Run the controlled PayPal recovery matrix.** Cover create retry, normal and
  ambiguous capture, local-finalization failure/retry, duplicate/retried
  webhooks, two-buyer conflict, declined capture, pending/failed refunds,
  idempotent partial/full refunds, locked shipped address, Local Pickup, invoice
  creation, receipt history, and printable guest confirmation.
- **Fix eBay sold-hidden freshness scanning.** Opening bulk eBay summary can
  hash a `hidden_oos` sold product and incorrectly mark it `out_of_date`.
  Preserve sold-hidden lifecycle and add regression coverage.
- **Reattach eBay inventory #82 deliberately.** Listing `800354878200` is a live
  external relist not attached to stored offer `204558136011`. Keep app-side
  writes blocked until an owner-approved migration/end-and-republish path is
  tested.
- **Complete remaining controlled marketplace checks.** Inventory #53's
  out-of-date/policy transition has since been live-verified. Publish eBay
  #83/#84 only if desired; do not blanket re-sync, sync sold #6, or manage #82
  before reattachment. Observe Etsy's fixed cumulative image counter during the
  next real image upload.
- **Run the scoped eBay webhook-payload scrub only after fresh confirmation.**
  The read-only audit found 10,922 old account-deletion events with identifiers.
  Dry-run/count, update only the audited event type, then prove no
  `payload.notification.data` remains. This is destructive database work.

## Production And Owner Verification

- Verify one shipped PayPal order keeps the exact checkout address locked in
  PayPal, and one Local Pickup checkout omits shipping.
- Verify Available -> Sold -> Available sold-price locking on a deliberate
  product; separately review the three legacy manually sold rows without order
  snapshots.
- Print one invoice on the affected physical laser printer after deployment.
- Verify shipment carrier/tracking save and the corresponding Resend email.
- Verify a paid test order and one new manual order create/update invoice rows.
- Verify explicit inventory restore, order recycle-bin restore/permanent delete,
  Reopen Order, and Messages recycle-bin behavior while signed in.
- Verify order Email History for automatic paid receipt plus manual receipt and
  fulfillment messages.
- Verify inquiry/message image attachments, Spanish public notes, item year
  snapshots, and the migrated WebP listing paths on deliberate records.
- Verify contact/free-evaluation email and upload flow with production
  service-role and Resend configuration.
- Verify duplicate account sign-up, reset-password redirects, and production
  Supabase Auth redirect URLs.
- After the next manual deployment, verify retired WordPress/XML-RPC/dotfile
  probes all return the new edge-level 410 rather than the current mixed
  404/410 responses.

## Business And Content

- Complete Google Business Profile video verification. The two duplicate draft
  profiles are already deleted.
- Have the owner/counsel review Privacy, Terms, Returns, Shipping, Auction,
  Vendor, and Accessibility policies before relying on them.
- Confirm Resend sending-domain/SPF/DKIM support for the intended From
  identities.
- Complete `CLIENTS.md` unknowns: Netlify site/team/slug, DNS registrar,
  maintenance plan, billing status, and credential-reference owners.
- Correct duplicate live inventory #21 if it still exists.
- Decide whether root `banner.png` should replace the current eBay banner after
  removing the remaining visible website address. Do not connect either banner
  to live eBay descriptions until it is policy-safe.

## Deferred And Optional

- Finish Cloudflare Stream deployment only when product video becomes a
  priority: configure the four documented Netlify variables, reconcile the
  Stream webhook, run the device matrix in `features/product-videos.md`, and
  validate one real MP4 on controlled Etsy/eBay listings before enabling
  marketplace video writes.
- Add `OPENAI_API_KEY` only if server-generated read-aloud is desired; the
  device voice remains the fallback.
- Add `ETSY_CRON_SECRET` only when wiring the external daily Etsy price-push
  trigger; manual admin price pushes do not depend on it.
- Investigate the intermittent development JSON parse failure if it appears
  outside cold-start/hot-reload timing. The 2026-07-27 audit reproduced it
  during a parallel cold preview probe across several routes; both translation
  JSON files validated, and a clean restart plus sequential route checks passed.
- Monitor stable `eslint-config-next` and React lint-plugin releases for ESLint
  10 compatibility. The full audit's nine findings are confined to ESLint 9's
  development-only `minimatch@3` / `brace-expansion@1` chain. Do not force
  ESLint 10 while the stable Next lint plugins fail at rule startup; keep the
  production audit at zero and retest when upstream support lands.
- Add a Material Symbols subset manifest/integrity check after owner approval.
- Profile Admin Products pagination/virtualization only if production timings
  show the 83-row working table remains slow.
- Migrate the remaining legacy local-only product photos to Supabase Storage.
- Optionally optimize the remaining near-guideline local image assets.
- Consider relocating real `node_modules` content outside OneDrive only if sync
  overhead remains noticeable.
- Evaluate Next.js 16.3 when stable for the upstream Windows Turbopack cache fix.
- Add basic analytics only with a corresponding consent/policy update.
- Expand catalog categories when inventory is ready.
- Confirm whether production metal-price traffic needs a keyed provider or a
  stronger rate-limit/fallback plan.

## Recently Completed

- **2026-07-28:** fixed the production product-detail hydration mismatch by
  formatting the price-update clock explicitly in `America/New_York`. Added a
  narrowly scoped Netlify Edge handler so blocked WordPress/XML-RPC/dotfile
  probes return 410 before Next routing. Five focused tests, all 455 tests,
  lint, and the complete 419-page production build passed. English desktop,
  390px mobile, and Spanish product checks showed visible content and no
  console warnings/errors. Manual deployment/live verification remains.
- **2026-07-28:** completed a read-only production smoke test after deployment.
  Security headers, HTTPS/apex redirects, static caching, robots/sitemap,
  English/Spanish storefront routes, Available/Sold filtering, the previously
  affected 390px product detail, Back to Shop context, checkout/PayPal
  rendering, TradingView, contact/evaluation forms, signed-in Admin, and the AI
  assistant UI passed without orders, submissions, or saved changes. One
  recoverable product-detail hydration mismatch and nonuniform 404/410 probe
  statuses were recorded for follow-up.
- **2026-07-28:** audited the repeated `29 of 127 pieces` label for Silver +
  Everything Else without changing code. Available and Sold each genuinely
  return 29 distinct matching products, both paginate as 1-24 of 29, and show
  status-appropriate cards and price ranges. The denominator intentionally
  represents all 127 visible public products.
- **2026-07-28:** verified all three security SQL scripts against production
  after the owner re-ran them. Both subscriber RPCs and the rate-limit RPC are
  blocked for `anon`/`authenticated` and allowed for `service_role`; the
  rate-limit function has `SECURITY DEFINER`, `search_path=public`, the current
  deterministic cleanup body, and its supporting index. All seven internal
  product columns remain blocked while `products.id` remains readable.
- **2026-07-27:** removed the production build and dependency blockers after
  revalidating them against current Next documentation, official advisories,
  and the live npm registry. The shared shop renderer now lives outside
  `page.tsx`; Next/ESLint config is 16.2.12, Sharp is 0.35.3, and production
  overrides pin patched PostCSS/Sharp throughout the tree. Production audit,
  lint, all 452 tests, the complete 419-page build, public route smoke checks,
  and desktop/mobile browser checks passed.
- **2026-07-24:** added deterministic confirmation and read-aloud to the Smart
  Listing Assistant. Overwrites, sensitive facts, and any low/medium/missing
  confidence value stay pending until accepted; warnings and uncertain
  unchanged values force clarification questions. Admin-only OpenAI speech
  includes device-voice fallback, Read Aloud/Stop, and optional automatic
  playback. Live accept/keep/undo/read-aloud checks passed without saving a
  listing, as did 18 focused tests, all 452 tests, and lint; build remains
  blocked only by the existing `renderShopPage` route-contract error.
- **2026-07-24:** replaced the public shop's Available-only checkbox with
  mutually exclusive Available/Sold radios. Available is the default for bare
  and invalid URLs; Sold is explicit and URL-backed. English/Spanish browser
  checks, 18 focused tests, all 443 tests, and lint passed; build remains
  blocked only by the existing `renderShopPage` route-contract error.
- **2026-07-24:** eliminated the homepage carousel's fallback-to-curated
  hydration swap. The server now renders one cached curated payload into the
  initial HTML, while local products remain a true failure/empty-selection
  fallback. Admin saves invalidate the tagged cache immediately. Three focused
  tests, all 442 tests, lint, initial-HTML inspection, and six repeated preview
  reloads passed; build remains blocked only by the existing `renderShopPage`
  route-contract error.
- **2026-07-24:** changed the Smart Listing Assistant from a one-shot fill into
  an iterative conversation. It now explains each revision, asks targeted
  questions for unsupported or conflicting details, accepts repeated typed or
  spoken follow-up input, and revises the current form without auto-saving.
  A real two-turn Admin preview passed, as did 9 focused tests, all 439 tests,
  and lint; build remains blocked only by the existing `renderShopPage`
  route-contract error.
- **2026-07-24:** made Back to Shop return buyers to the exact shop page,
  filters, language, and vertical position they had before opening a product.
  This is session-scoped, applies to gallery and list product links, and
  safely falls back to the normal shop route for direct entries. Focused tests,
  all 437 tests, lint, and a page-2 browser return check passed; build remains
  blocked only by the existing `renderShopPage` route-contract error.
- **2026-07-24:** fixed the shared customer-reveal deadlock that could hide
  multi-image product pages on mobile. Lazy images no longer block visibility,
  and a 1.4-second fallback prevents any slow media resource from leaving a
  customer page hidden. The affected 15-image product and 27 additional
  English/Spanish public routes passed 390px browser checks with no
  pending/hidden reveal containers or console errors. Lint and all 435 tests
  passed; build compiled but remains blocked by the existing
  `renderShopPage` route-contract error.
- **2026-07-24:** confirmed the local Next.js development preview starts at
  `http://localhost:3000`; homepage and `/shop` browser smoke checks passed.

- **2026-07-23:** added and desktop-verified hover/press affordances for
  storefront, account, contact, cart, and checkout controls; mobile-only
  controls were intentionally excluded. Lint passed; the known
  `renderShopPage` build blocker remains.
- **2026-07-23:** removed the pale yellow hover fill from the desktop Saved
  Items and Cart nav icons while retaining non-color hover/press feedback.
- **2026-07-23:** refined those nav icons to move only the glyph on hover and
  press; the surrounding button no longer lifts or casts a shadow.
- **2026-07-23:** removed the Total, Available, and Sold inventory summary
  cards from Admin Products at the shared component level for every viewport.
  Lint passed; build compilation succeeded but the known route-contract error
  remains.
- **2026-07-23:** locked the Admin Products shell to the dynamic viewport and
  kept only the product-table wrapper scrollable, preventing page-level scroll
  on desktop, tablet, and mobile layouts.
- **2026-07-23:** centralized U.S.-only address validation and the three
  checkout shipping rates; owner policy now taxes charged shipping for Florida
  orders while non-Florida Florida-tax remains $0.
- **2026-07-23:** completed a no-write shop thumbnail-delivery audit.
- **2026-07-22:** added necklace/bracelet width storage, admin/AI intake,
  gallery/list display, and conditional public filters; SQL was applied and
  verified.
- **2026-07-22:** normalized product length input and fixed legacy/current
  length filter matching.
- **2026-07-22:** fixed responsive filter access, narrow toolbar overflow, and
  pagination gaps; added gallery image progress and the optimized nav logo.
- **2026-07-21:** hardened API abuse controls and dependency overrides; last
  audits reported zero vulnerabilities.
- **2026-07-21:** repaired Etsy's resumable multi-image queue and recovered all
  affected linked rows.
- **2026-07-20:** applied and verified PayPal hardening, product-video schema,
  sold-price locking, shipment tracking, and current order-email schema.
