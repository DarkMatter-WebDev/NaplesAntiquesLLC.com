# Tasks

> Open work only, plus a short recent-completions record. Full completed history
> lives in `CHANGELOG.md`. Last reconciled: **2026-07-23**.

## In Progress

- **Deploy the 2026-07-21 security hardening.** Publish the updated Next/Netlify
  app, confirm Netlify accepts `netlify/edge-functions/api-rate-limit.ts`, and
  verify live CSP, HSTS, X-Frame-Options, Referrer-Policy,
  Permissions-Policy, nosniff, and cross-domain-policy headers.
- **Apply and verify the security SQL in this order:**
  `supabase/subscriber-rpc-hardening-2026-07.sql`,
  `supabase/rate-limiting-hardening-2026-07.sql`, then
  `supabase/products-internal-columns-authenticated-2026-07.sql`.
  Confirm every privilege probe returns false. Until this is proven, treat the
  direct subscriber RPC bypass as live.
- **Resolve the production-build route contract.** `npm run build` compiles the
  app but Next's generated route type rejects the named `renderShopPage` export
  from `src/app/[locale]/shop/(list)/page.tsx`. Move shared rendering logic out
  of the route module or otherwise expose only valid route exports, then rerun
  full tests, lint, and build.

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
- **Finish Cloudflare Stream deployment.** Configure the four documented
  Netlify variables, reconcile the one Stream webhook target, deploy, and run
  the iPhone/iPad create/replace/remove/cancel/interruption matrix in
  `features/product-videos.md`.
- **Validate marketplace video before enabling sync.** Inspect one real Stream
  MP4 with `ffprobe`, then test that exact asset on one controlled Etsy draft and
  one controlled eBay listing. Marketplace video writes remain disabled until
  both providers accept it.
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
- Verify live security headers, cache behavior, and retired WordPress probes
  returning 410 after the next deploy.

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

- Monitor the one non-reproducible development `/shop` JSON parse failure; act
  only if it recurs outside restart/hot-reload timing with a stable stack.
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
