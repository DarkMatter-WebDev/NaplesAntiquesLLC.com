# Tasks

> Open work only, plus a short recent-completions record. Full completed history
> lives in `CHANGELOG.md`. Last reconciled: **2026-08-01**.

## In Progress

- ⚠️ **Domain switch to naplesestatejewelry.com (2026-08-01) — code AND
  external wiring DONE; deploy, then finish steps 5-7.** The owner bought the
  `.com` and decided the switch (business email stays on `.co` — `.co` MX
  never touched). The entire codebase now canonicalizes on
  `https://naplesestatejewelry.com`: metadata/OG, sitemap, robots, JSON-LD,
  legal copy, header/footer/checkout branding, order/marketing email branding
  and fallbacks, test fixtures, and root `netlify.toml` (naplesantiquesllc
  301s retargeted to `.com`; new `.co`→`.com` path-preserving 301s with an
  `/api/*` carve-out so PayPal/eBay/Etsy endpoints registered on `.co` keep
  answering until re-registered).
  1. ✅ DONE 2026-08-01 — GoDaddy: found and REMOVED the pre-existing
     Connect-Domain **302 forwarding `.com` → `.co`** (same broken GoDaddy
     product as the old naplesantiquesllc.com setup; it also held the DNS
     records locked), then set apex A → `75.2.60.5` (600s TTL) and
     `www` CNAME → `naplesantiques.netlify.app`. `.co` DNS untouched.
  2. ✅ DONE 2026-08-01 — Netlify: `.com` + `www.com` added and DNS-verified,
     `.com` set as PRIMARY (`www.com` auto-redirects; `.co` now an alias;
     `www.naplesestatejewelry.co` re-added as an alias because the primary
     flip silently dropped it), Let's Encrypt cert reissued covering all
     hosts. Browser-verified: `https://naplesestatejewelry.com/shop` serves
     with a valid cert; `https://naplesestatejewelry.co` still serves
     normally (its 301s activate on deploy).
  3. ✅ DONE 2026-08-01 — Netlify env: `NEXT_PUBLIC_SITE_URL` (all four
     contexts) and `SITE_URL` (all scopes) → `https://naplesestatejewelry.com`.
     Takes effect on the next deploy.
  4. ✅ DONE 2026-08-01 — Supabase Auth URL configuration: Site URL →
     `https://naplesestatejewelry.com`; added redirect URLs
     `https://naplesestatejewelry.com/**` and the bare origin (10 total;
     `.co` entries kept for transition) — `ACCOUNT_SETUP.md` updated.
  5. **Owner: deploy** (rides with the pending 2026-07-31/08-01 batch), then
     smoke-test: `.com` home/shop/product, `.co/anything` → 301 → `.com`,
     checkout/PayPal, sitemap.xml on `.com`.
  6. **After deploy — re-register external endpoints on `.com`:** PayPal
     webhook (`/api/paypal/webhook`, then match `PAYPAL_WEBHOOK_ID` if it
     changes), eBay account-deletion endpoint + auth accepted/declined URLs +
     privacy URL, Etsy OAuth callback, and the Meta app's site/privacy URLs
     if listed. After all are moved, the `/api/*` carve-out in `netlify.toml`
     can be removed (optional cleanup).
  7. **After deploy — Google Search Console:** add the `.com` property (the
     existing HTML-tag token verifies it), submit the sitemap, run Change of
     Address `.co` → `.com`, and fold the naplesantiquesllc recovery into the
     same target.
- ⚠️ **Deploy urgency (2026-08-01): the LIVE Facebook post for product 21
  carries `Shop: https://naplesestatejewelry.co/p/21`, and the `/p/` short-link
  route only exists in this batch — the link 404s in production until the next
  deploy.** The 2026-08-01 social work (caption restructure, card fixes,
  publish-to-both, copy-curation, discard, `/api/admin/social/copy-curation`,
  `/p/[code]`) rides the same deploy as the 2026-07-31 batch below; latest
  local verification 588/588 tests + 438-page build (444 → 438 after the
  auctions + auction-terms + vendor-terms page removals; 592 → 588 tests
  from the removed pages' parameterized metadata tests).
- **Owner: first "Publish to both" is staged.** Product 28 (vintage 10K
  diamond ring) is prepared on BOTH channels with the final caption format and
  the fixed card — open either panel → "Publish to both…" → review →
  one click. Publishes Instagram first, then Facebook.
- ✅ **RESOLVED 2026-08-01 — Instagram Shop-link domain.** The `.com` is now
  the primary domain (see the DEPLOY GATE item above), so the typeable
  `Shop: NaplesEstateJewelry.com/p/N` caption line is correct as-is. The only
  remaining rule: do not publish the first Instagram post until the `.com` is
  wired and the batch is deployed (captions are permanent; the link must
  resolve). Facebook's clickable link builds from `SITE_URL`, so it emits
  `.com` automatically once the env var is updated.
- **Owner: test and deploy the 2026-07-31 batch, then run the post-deploy
  runbook.** The owner is testing on the LAN dev server
  (http://10.0.0.208:3002) before the final deploy. The batch contents are
  listed in `CURRENT_STATUS.md` ("Pending Deployment"). Remaining owner
  checks before deploy: the checkout wizard on the tablet (including the
  sign-in/guest entry dialog, which only shows signed-out), and confirming
  the iPad hydration error is gone after a refresh. After deploying:
  1. Verify `https://naplesantiquesllc.com/shop?metal=gold` 301-redirects to
     the same path on naplesestatejewelry.com (retargeted 2026-08-01 from
     `.co` straight to the new primary), then do the Search Console
     steps (verify both domains, submit sitemap, Change of Address old→new,
     request indexing on top product pages).
  2. Click "Provision tiered shipping profiles" (Etsy) and "Provision tiered
     shipping policies" (eBay) in Admin → Settings (the
     marketplace-shipping-tiers SQL is already applied), then verify one
     tier-shipped listing per marketplace per the runbook item below.
  3. Spot-check production: checkout wizard, a $5,000+ item (Express hidden,
     Registered note), spot-pill refresh, product weight spec.
   4. When done testing locally, kill the PID listening on port 3002 to stop
      the detached LAN dev server.
- **Deploy and production-verify marketplace price automation.** The local
  implementation is complete. After the owner's manual deployment, confirm
  Netlify lists `etsy-price-push` and `ebay-price-push` with Scheduled badges,
  run each once from the Functions page, and verify the Admin Settings
  last-run cards plus summary logs. Etsy's live daily toggle is enabled;
  eBay's is currently disabled and should be enabled only after its test run.
  Local Etsy secret readiness and rejection of a secretless request are
  verified. Both scheduled wrappers also passed an isolated localhost-stub
  harness, and the optimized app passed a local production-runtime smoke test;
  the remaining checks require the published Netlify runtime.

## High Priority Backlog

- **Deploy and provision the marketplace shipping tiers (owner runbook).**
  The Etsy/eBay shipping extension is code-complete and locally verified but
  NOT live until these owner steps run, in order:
  1. Run `supabase/marketplace-shipping-tiers-2026-07.sql` in the Supabase
     SQL Editor (the provisioning actions refuse to run without it — checked
     before any external object is created).
  2. Deploy the app.
  3. In Admin → Settings → Etsy Sync, click "Provision tiered shipping
     profiles"; in eBay Sync, click "Provision tiered shipping policies".
     Both are idempotent (match by the canonical "NEJ Insured Shipping $N"
     names; re-running after a fee change re-aligns costs).
  4. Verify one listing per marketplace: eBay — expect tier-priced listings
     to flag out_of_date on the next status scan, then review-first publish
     the update and confirm the offer's shipping cost on eBay; Etsy — run one
     Sync Updates on a listing and confirm its shipping profile switched to
     the tier profile (sync log action `shipping_tier`).
  Until provisioned, both syncs keep today's single default profile/policy.
- **Phase 2 shipping (deferred): explore Parcel Pro / JM Shipping Solution /
  FedEx Declared Value Advantage** for cheaper $2,500+ insurance and a fast
  fully insured option above $5,000 (USPS-only phase ships $5,000+ via
  Registered Mail, 2-10 days). Quote/account-based; owner signup required.
  Operational rules until then: never insure jewelry through ShipStation's
  ParcelGuard/Shipsurance, never declare over $1,000 on standard FedEx for
  jewelry/watches, ship Registered in plain boxes with kraft paper tape.
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

## Facebook Posting (LIVE-VERIFIED 2026-08-01 — see features/facebook-posting.md)

- ✅ Done 2026-08-01: SQL applied, env vars in Netlify, Page connected
  (never-expiring token via use-case addition → consent → debugger extend →
  page-token derivation; runbook details in `CHANGELOG.md`), and the full
  prepare → publish → API-delete loop proven through the operator UI.
- ✅ `social-card-source-2026-08.sql` applied 2026-08-01; card-image choice
  saves and Prepare uses it (image 6 saved on product 21).
- ✅ `social-card-background-2026-08.sql` applied 2026-08-01; the card
  background choice (Auto/White/Black/Cream) saves in both panels.
- **After the next deploy:** confirm Netlify lists `facebook-drip` with a
  Scheduled badge (14:40/22:40 UTC, 20 min after the Instagram drip), and
  re-verify one prepare in production (fonts must trace into
  `/api/admin/facebook/**` and `/api/admin/card-preview` — checked in the local
  build, worth one production confirmation).

## Instagram Posting (Phases 1-2 built — see features/instagram-posting-plan.md)

- ✅ Done 2026-08-01: `supabase/instagram-image-crops-2026-08.sql` applied by
  owner (crop saves work), and the generated ad card is verified end to end —
  `renderInstagramCard` ran live (Prepare on inventory #21, card badged `CARD`,
  backdrop auto-detection pixel-verified, and generated cards led the live
  Facebook post). Card render failure still degrades to photos-only with a
  prepare warning, never a block.
- **Note (2026-08-01): the Instagram caption format changed** to match
  Facebook's (Available now! → title → specs → price sentence with spot basis;
  no description, no inventory number, typeable `Shop:` short link). Captions
  are immutable, so this simply applies to the next Prepare/publish — any
  previously prepared-but-unpublished caption should be re-prepared first.
- **Owner: reset the test product's Instagram lineup if desired.** Verifying the
  editor on inventory #21 left it with 8 of 9 images and a promoted cover
  (original order not preserved). Add the excluded photo back and reorder in
  the panel, then Prepare — nothing depends on the current arrangement.
- **Photography standard: shoot silver on black, not white.** Measured
  2026-08-01: silver on white is the hardest case for any background removal —
  7-12% of the product sits within 25 luminance of the backdrop (those are the
  polished highlights). Silver on black is trivial. Gold is fine on either.
  Costs nothing and permanently removes the hard case for the compositing
  plan (`features/instagram-posting-plan.md` §8c).
- **AI on-model image: run the fidelity bake-off before any build.** Plan is in
  `features/instagram-posting-plan.md` §8b. Pick 5-8 hard pieces (chain, ring,
  earrings, bracelet, one with distinctive wear), run them by hand through 2-3
  providers, and score product fidelity against the real photos. Claude cannot
  generate images, so this adds a new third-party dependency. Abandoning the
  feature is a legitimate outcome. Decide the AI-imagery disclosure policy
  (recommended: label it and never make it the only image) before any public post.
- **Owner: delete the test post by hand.** The 2026-08-01 live test published
  `instagram.com/p/Dbf7lhNoN-T/` (inventory #21 bracelet). Instagram's API
  cannot delete posts, so it must be removed in the Instagram app. Its caption
  contains the since-fixed "Inventory #21" auto-linked hashtag, so it is worth
  removing rather than keeping. Nothing in the app depends on it.
- Connection is **live and verified**: `@naples_estate_jewelry`, BUSINESS
  account, token valid to 2026-09-30 with the weekly refresh armed. The full
  publish path (renditions → carousel → publish → verify) is proven end to end.
- **Optional: bulk Instagram queueing.** The per-product panel, row chips,
  editor-drawer section, and Actions-modal card are all built. What is missing
  is a multi-select "queue these N products" flow like the Etsy/eBay bulk
  modals. With a 2/day drip and review-first captions, queueing a handful at a
  time from the per-product panel may well be enough — build this only if the
  one-at-a-time flow proves tedious in practice.
- **Wire the sold auto-comment to the status change.** `markPostSold()` is
  implemented and idempotent but is not yet called from the available→sold
  transition.
- **Add out-of-date detection — but note the API cannot delete.** `content_hash`
  is stored per post and nothing compares it yet. The originally planned
  automatic delete-and-repost is NOT possible: removal is a manual step in the
  Instagram app. Any flow must therefore be: flag as out of date → tell the
  owner which post to delete by hand (with permalink) → "Forget this post" →
  re-prepare and publish fresh.
- After deploying, confirm Netlify lists `instagram-token-refresh` (Mondays
  12:15 UTC) and `instagram-drip` (14:20/22:20 UTC) with Scheduled badges.

## Business And Content

- ✅ **SUPERSEDED 2026-08-01 — `naplesestatejewelry.com` wiring.** The owner
  decided the opposite of the "301 to `.co`" default considered here: `.com`
  is now the PRIMARY domain and `.co` 301s to it (email stays on `.co`). The
  full migration runbook is the ⚠️ DEPLOY GATE item at the top of this file;
  the code side is complete.
- **Finish the naplesantiquesllc.com SEO recovery (step 1 done 2026-07-30).**
  Background: the app was previously indexed under naplesantiquesllc.com; a
  broken GoDaddy forwarding product (HTTPS failed, paths dropped) left those
  results stale while naplesestatejewelry.co sits mostly unindexed (~7 of
  120 sitemap URLs). Completed 2026-07-30 with the owner: removed the
  GoDaddy Connect Domain forwarding, repointed the apex A record to Netlify
  (75.2.60.5, DNS already propagating), added apex + www as Netlify domain
  aliases (Let's Encrypt cert provisioning), and added path-preserving
  301 rules for both hosts/schemes to root `netlify.toml` (top of the
  redirect list). Remaining: 1) deploy so the 301s go live (until then the
  old domain serves the site with correct canonicals), 2) verify
  `https://naplesantiquesllc.com/shop?metal=gold` returns a 301 to the same
  path on the primary domain, 3) Google Search Console — verify both
  domains, submit the sitemap, run Change of Address old → new, request
  indexing for key product pages.
- Complete Google Business Profile video verification. The two duplicate draft
  profiles are already deleted.
- Have the owner/counsel review Privacy, Terms, Returns, Shipping, and
  Accessibility policies before relying on them. (The Auction Terms and
  Vendor Terms pages were retired 2026-08-01 with the auctions page; both
  URLs 301 to /terms.)
- Confirm Resend sending-domain/SPF/DKIM support for the intended From
  identities.
- Complete `CLIENTS.md` unknowns: Netlify site/team/slug, DNS registrar,
  maintenance plan, billing status, and credential-reference owners.
- Correct duplicate live inventory #21 if it still exists.
- Decide whether root `banner.png` should replace the current eBay banner after
  removing the remaining visible website address. Do not connect either banner
  to live eBay descriptions until it is policy-safe.

## Deferred And Optional

- Optionally add a `[locale]/[...rest]` catch-all so unmatched Spanish URLs
  render the localized 404 (with header/footer) instead of the root English
  shell. Both shells now carry correct `Page Not Found` metadata and noindex;
  this would only localize the body copy for `/es/*` misses.
- Finish Cloudflare Stream deployment only when product video becomes a
  priority: configure the four documented Netlify variables, reconcile the
  Stream webhook, run the device matrix in `features/product-videos.md`, and
  validate one real MP4 on controlled Etsy/eBay listings before enabling
  marketplace video writes.
- Add `OPENAI_API_KEY` only if server-generated read-aloud is desired; the
  device voice remains the fallback.
- Investigate the intermittent development JSON parse failure if it appears
  outside cold-start/hot-reload timing. The 2026-07-27 audit reproduced it
  during a parallel cold preview probe across several routes; both translation
  JSON files validated, and a clean restart plus sequential route checks passed.
- Monitor stable `eslint-config-next` and React lint-plugin releases for ESLint
  10 compatibility. The full audit's nine findings are confined to ESLint 9's
  development-only `minimatch@3` / `brace-expansion@1` chain. Do not force
  ESLint 10 while the stable Next lint plugins fail at rule startup; keep the
  production audit at zero and retest when upstream support lands.
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

- **2026-07-31:** ran a read-only customer-facing viewport test pass over this
  session's features in a fresh browser tab (authoritative console). Pages:
  EN/ES home, EN/ES shop, EN/ES product detail, contact, empty + loaded
  checkout wizard, privacy, account orders tab + order dialog, root and
  localized 404. Widths: 320/350/375/390/768/1024/1440 (subset per page,
  320 everywhere). All pages: zero horizontal overflow, zero pending reveal
  containers, SuretteSystems banner single-line and lowermost in both
  locales (9.6px font at 320, 41px strip), EN and ES product tickers
  one-line at 320, localized weight specs, 404 titles/noindex/actions
  correct, account dialog fits 375 with no `internal_notes` in the payload,
  checkout wizard correct at 320/768 ($5,210 tier total + Registered Mail
  note). Zero console errors across the entire run; no code changed; test
  cart cleared.
- **2026-07-31:** moved the Items-table summary into a `tfoot` row on the
  admin order detail page: Save Line Discounts on the left, Line discounts
  to its right, and New total starting exactly in the Unit Price column
  (pixel-verified shared left edge). Fresh-tab console clean; 492 tests,
  TypeScript, lint, and the 420-page build passed.
- **2026-07-31:** restructured the admin order-detail Items table to
  Inventory | Photo | Item | Melt | Unit Price | Qty | Discount: removed
  Date/Metal/Purity/Weight and the Open column (the title is now the product
  link), added a row-height thumbnail and a live melt estimate (linked
  product rows + spot via `calcSpotMeltValue`), tightened padding, and
  narrowed the discount input to 80px. Also recovered from a corrupted
  `.next` dev cache that 404'd admin orders routes and broke `tsc` in
  generated route types (deleted `.next`, rebuilt). Final state verified
  signed-in with a fresh-tab zero-error console; 492 tests, TypeScript,
  lint, and the 420-page build passed.
- **2026-07-31:** made desktop Admin Orders rows clickable (opens the order
  detail like View; trash view and in-row controls keep their own behavior)
  and removed admin-only `internal_notes` from the customer account order
  query, where it was fetched unrendered into the customer's client payload.
  Signed-in row-click navigation and the internal_notes-free account payload
  verified pre- and post-build; all 492 tests, TypeScript, lint, and the
  production build passed with a clean port-3002 restart.
- **2026-07-31:** added the site-credit footer banner and fixed the root 404
  title. Every page's footer now ends with a thin full-width strip linking
  "Website built by SuretteSystems.com" / "Sitio web creado por
  SuretteSystems.com" to `https://surettesystems.com` (new tab, `noopener`).
  The Dark Matter credit was previously removed deliberately; the stale
  `PROJECT_OVERVIEW.md` claim is corrected. The root `not-found.tsx` (all
  unmatched URLs, including `/es/*`) now exports `Page Not Found` metadata
  plus noindex instead of inheriting the home title; `notFound()` calls inside
  the locale segment already had correct localized metadata. Verified via HTTP
  title/robots probes and EN/ES browser checks; all 492 tests, TypeScript,
  lint, and the 420-page production build passed, followed by a clean
  port-3002 restart re-check.
- **2026-07-31:** hardened the customer page-reveal so the pending→visible flip
  no longer depends solely on `requestAnimationFrame`. Hidden documents
  (background tabs, prerendering, non-compositing webviews) suspend rAF and
  left product pages at opacity 0 with clicks blocked until the page became
  visible; the reveal now commits immediately while hidden and keeps a bounded
  500 ms backstop while visible. Verified in a hidden in-app pane (previously
  stuck `pending` with Add to Cart unclickable; now `visible` with the same
  click landing); all 492 tests, TypeScript, lint, and the production build
  passed, followed by a clean port-3002 restart.
- **2026-07-31:** compacted the mobile Admin Products controls by removing the
  standalone search row, placing Search first inside the expanded Filters
  panel, and moving the visible/total count into the table utility row directly
  right of **Reset view to drag reorder**. The mobile Filters badge includes an
  active search, and the toolbar/table margins, gaps, and utility-row padding
  are tighter. Signed-in checks covered 320px inline/full-screen tables, search
  open/collapse/state/count behavior, 390px mobile, and the unchanged 768px
  desktop toolbar. All 492 tests, TypeScript, lint, and the complete 420-page
  production build passed; the restarted port-3002 server repeated the 320px
  placement and filter-expansion checks.
- **2026-07-31:** removed the drag-reorder instruction sentence from both the
  compact and full-screen mobile Admin product tables. When filters or sorting
  disable reordering, the useful **Reset view to drag reorder** action remains;
  when there is no mobile action/status to show, the instruction strip is
  removed entirely. The sentence remains visible at the 768px desktop boundary.
  Signed-in 320px inline/popup and 768px checks passed, as did all 492 tests,
  TypeScript, lint, and the complete 420-page production build. The port-3002
  dev server was cleanly restarted afterward.
- **2026-07-31:** kept each product image visible while horizontally scrolling
  the full-screen mobile Admin product table. Inventory number and title now
  scroll away with the statistics, while selection, image, and row actions
  remain pinned; the image still opens the correct product-actions dialog.
  Signed-in checks covered 320/390/767px at a 900px horizontal offset with the
  image fixed at 36-100px, inventory/title fully offscreen, and no document
  overflow; the unchanged 768px inline table retains all desktop identity pins.
  All 492 tests, TypeScript, lint, and the 420-page production build passed,
  followed by a clean server restart and fresh 320px verification.
- **2026-07-31:** compacted the mobile **Open Product Table** launcher and
  placed it directly beside **Add Product**, with search retaining a dedicated
  full-width row. At 320px the controls measure approximately 151px and 125px
  and fit without document overflow; 390px also renders cleanly, while the
  launcher remains hidden in the unchanged 768px desktop toolbar. The button
  still opens the full-screen table, and Escape closes it and returns focus to
  the launcher. All 492 tests, TypeScript, lint, and the 420-page production
  build passed; the restarted server repeated the 320px check with zero browser
  errors.
- **2026-07-31:** moved the authenticated administrator's Admin Panel access
  card above Account Overview at mobile widths. The shared localized card has
  mutually exclusive mobile and rail placements, so English/Spanish render one
  visible card: first after the tabs through 700px, and in the original side
  rail from 701px upward. Signed-in checks covered 320/390/700/701/768/1024px;
  all 492 tests, TypeScript, lint, and the 420-page build passed, followed by a
  clean server restart and error-free 390px/768px smoke checks.
- **2026-07-31:** added the mobile-only **Open Product Table** mode to Admin
  Products. The same inventory table expands into a dynamic-viewport dialog
  with 2D touch scrolling, a visible Close control, Escape handling, body-scroll
  locking, and automatic dismissal at desktop size. Full-screen mobile drops
  the oversized middle-column pinning so all 1,698px of the table can pan while
  selection and row actions remain accessible. A later refinement pins only
  the image from the product-identity group. Signed-in browser checks covered
  320/390/767px mobile, full horizontal travel through eBay/actions, row-action
  handoff, and the unchanged 768px inline table. All 492 tests, TypeScript,
  lint, and the 420-page production build passed; the restarted server repeated
  the mobile/desktop checks with zero browser errors.
- **2026-07-31:** kept the complete product price-update ticker on one line at
  every supported width. The label now uses fluid 8-9.92px type, tighter
  tracking, and explicit no-wrap behavior instead of dropping the final time
  suffix onto a second line. English and the longer Spanish copy passed live
  browser checks at 320px and in the 768px two-column layout. All 492 tests,
  TypeScript, lint, and the 420-page build passed; the cleanly restarted
  port-3002 server passed fresh English/Spanish smoke checks with no errors.
- **2026-07-31:** replaced product-detail/lightbox thumbnail swaps with a
  deterministic eased sideways flow. One-card advances now expose continuous
  intermediate positions over about 300 ms; rapid clicks continue from the
  current offset, resize correction cannot interrupt active motion, and both
  circular directions animate through their edge clone before the invisible
  reset. Frame traces, a full nine-image loop, reverse wrap, rapid double click,
  and lightbox checks passed at 320px with whole-card resting positions. All
  492 tests, TypeScript, lint, and the 420-page build passed; the restarted
  fresh-tab smoke test had nine distinct offsets and zero runtime errors.
- **2026-07-31:** made product-detail and lightbox thumbnail rails show only
  whole cards by snapping both viewport widths and scroll positions to exact
  card/gap increments; full circular loops still keep active + next visible.
  Also added a sub-350px header scale (28px call/cart, 24px menu, proportional
  glyph/badge sizing) while preserving every English/Spanish action and the
  full brand. Browser checks covered 320-1440px rails, page/lightbox nine-image
  loops, and EN/ES 320px headers with no partial cards or page overflow. All
  492 tests, TypeScript, lint, and the 420-page build passed, followed by a
  clean port-3002 restart.
- **2026-07-31:** fixed the thin-mobile product-summary wrap by grouping
  metal/purity and length into one no-wrap specification unit. The availability
  badge may occupy its own line, but the specifications now move together
  instead of orphaning only the length. English/Spanish checks passed at
  320/350/375/390/768/1024px with no overflow; all 489 tests, TypeScript, lint,
  and the 420-page build passed, followed by a clean port-3002 restart and
  post-build browser smoke test.
- **2026-07-31:** rebuilt the product-detail and lightbox thumbnail rails as
  responsive circular carousels. Active + next thumbnails stay visible,
  forward/reverse end wraps animate through hidden edge clones and reset
  invisibly, and keyboard/touch/reduced-motion/localized behavior is preserved.
  Verified English/Spanish, main/lightbox, rapid clicks, keyboard, both wrap
  directions, and 320/375/768/1024/1440px widths with no page overflow; all
  489 tests, TypeScript, lint, and the 420-page build passed. The port-3002 dev
  server was restarted after the build and the full wrap passed again.
- **2026-07-31:** recovered the dev preview from a build/dev `.next` collision
  that mixed old server HTML with the new header client bundle. Restarted the
  port-3002 server cleanly; `/`, `/es`, and `/shop` return current markup and
  the homepage hydrates with zero console issues. Future production builds must
  run only while the dev server is stopped.
- **2026-07-31:** fixed the full header brand clipping at thin mobile widths by
  compacting only the sub-400px gaps/padding and using fluid mobile brand type.
  English passed at 320/350/375/400px and Spanish at 320px with no header or
  page overflow; lint, all 485 tests, and the 420-page build passed.
- **2026-07-31:** full checkout/storefront UX day, all verified green
  (485 tests, TypeScript, lint, production build after every change):
  pre-deploy shipping sweep + the three coded-checkout-error fixes; tax
  moved after shipping in summaries; the checkout page rebuilt as a
  four-step wizard with a sign-in/guest entry dialog; tap-to-refresh spot
  pills (shop + product pages) with portaled timestamped notes; product
  ticker gained "Last updated"; the live iPad hydration error was
  root-caused to iOS phone-number auto-linking and fixed site-wide via
  format-detection metadata (verified on all page types); product Weight
  spec simplified to written-out total grams, properly localized. Also:
  LAN-accessible detached dev server arranged for owner device testing,
  and the naplesantiquesllc.com SEO recovery step 1 (GoDaddy forwarding
  removed, DNS → Netlify, aliases + cert, 301 rules pending deploy).
- **2026-07-30:** added the eBay account-change reset action (Settings →
  eBay Sync): dry-run summary first, explicit confirm deletes all local
  `ebay_listings` rows + the orders cursor, logged to `ebay_sync_log`, eBay
  listings untouched. Preview verified the dry run against the real 123
  records and cancelled without deleting; 482 tests, TypeScript, lint, and
  the build passed. Account-change runbook documented in
  `features/ebay-sync.md`.
- **2026-07-30:** extended the shipping tiers to Etsy and eBay (code-complete;
  owner provisioning pending — see the runbook above). New shared
  `marketplace_shipping_profiles` mapping table + SQL, idempotent
  admin provisioning actions in both Settings panels, eBay tier-policy
  resolution ahead of the legacy standard/express pair with the policy id
  kept in the content hash, Etsy tier profiles applied at draft creation and
  reconciled on update/price paths (boundary crossings only on bulk pushes),
  and fail-closed fallbacks to the existing defaults everywhere. 480 tests,
  TypeScript, lint, and the production build passed; both admin buttons
  render in the signed-in settings preview.
- **2026-07-30:** implemented the owner-approved value-based shipping tiers.
  `checkout-shipping.ts` now prices by merchandise subtotal (Standard $19 to
  $165 across eight bands, Registered Mail wording at $5,000+; Express
  $55/$79/$119, hidden and server-rejected at $5,000+; Local Pickup $0),
  `buildOrderDraft` resolves the fee after the subtotal, the checkout
  selector shows live per-option fees with bilingual service notes, and a
  tested marketplace scaffold awaits the Etsy/eBay shipping sync. Browser
  checks: $49 item ships at $19; $5,176 item shows $99 + Registered note
  with Express absent; FL tax $316.50 on the tiered total; tampered Express
  request rejected 400. All 470 tests, TypeScript, lint, and the production
  build passed.
- **2026-07-30:** moved the "Item added" popup's ✕ dismiss control from the
  bottom-left of the actions row to the popup's top-right corner (borderless
  gold, title padded so English and Spanish labels never collide). Go to Cart
  and Clear Cart now stack full-width. Verified in both locales with zero
  console errors; 462 tests, lint, and the production build passed.
- **2026-07-30:** changed the header cart icon's has-items state from a solid
  filled glyph to a readable outline with a 22% translucent gold interior tint
  (gold color and count badge unchanged; empty state untouched). Browser
  verification of both states passed with zero console errors; 462 tests,
  lint, and the production build passed.
- **2026-07-30:** ran a read-only production-readiness debugging session after
  the `/payment` removal. Full suite green (462/462 tests, TypeScript, lint,
  0-vulnerability production audit, complete build). Browser walkthrough of
  home/shop/product/checkout showed zero console and server errors; checkout
  totals matched policy for non-FL, Local Pickup, and FL-destination cases;
  the PayPal SDK/buttons rendered with the not-ready gate blocking payment (no
  order created, nothing purchased); Spanish and 375px mobile passed.
  Production probes returned 200 + CSP/HSTS on all key routes; production
  `/payment` remains live until the next deploy.
- **2026-07-30:** removed the orphaned pre-PayPal `/payment` placeholder page,
  its `PaymentClient` component, and all references (secondary-page metadata +
  test, proxy session prefixes, robots disallows), and fixed the payment doc
  drift: `features/paypal-checkout.md` now records live status since
  2026-07-09, the completed go-live checklist, and the `cancel-order` route;
  `ARCHITECTURE.md`/`COMPLIANCE_AUDIT.md` now record the retired 410 manual
  order endpoint and removed placeholder. 462/462 tests, TypeScript, lint, and
  the production build passed; browser checks confirmed `/payment` 404s while
  `/checkout` renders cleanly.
- **2026-07-30:** completed a read-only pre-deployment audit of the entire
  PayPal checkout system with zero code changes. Confirmed in current source:
  server-authoritative pricing and guards, single shipping catalog, U.S.-only
  address revalidation, reconciled PayPal breakdowns, deterministic request
  IDs, capture-evidence-first finalization, recovery/do-not-pay-again locking,
  row-locked race conflict handling, fail-closed webhook verification with
  idempotent claims, gated admin refunds, and immediate shop-cache expiration.
  463/463 tests, TypeScript, lint, and the 419-page production build all
  passed. Non-blocking findings: remove the orphaned `/payment` placeholder
  page, and fix the stale "Status: sandbox" header plus missing cancel-order
  route in `features/paypal-checkout.md`. The live recovery/refund/race matrix
  remains the one outstanding owner-controlled payment test.
- **2026-07-29:** implemented safe marketplace price automation. Etsy/eBay
  writes now reject fallback or missing relevant-metal spot quotes, scheduled
  runs are time-bounded and batched, eBay's manual action filters completed
  prices before each 25-item batch, mixed bulk failures fall back to isolated
  writes, and Admin Settings shows cron-secret readiness plus the last
  scheduled result. Added staggered daily Netlify functions. All 463 tests,
  TypeScript, lint, the production audit, and the 419-page build passed.
- **2026-07-29:** permanently removed the Material Symbols ligature-font
  failure mode. Migrated all icon rendering to the shared inline-SVG `AppIcon`
  component with Lucide React 1.27.0, removed decorative listing-editor icons,
  deleted the font preload/assets/subsetting script, and added source guards
  against reintroduction or unmapped static icons. All 458 tests, lint, the
  zero-vulnerability production dependency audit, the 419-page production
  build, and four sequential local route probes passed.
- **2026-07-28:** production-verified the deployed product-clock and
  blocked-probe fixes. English and Spanish product details passed desktop and
  390x844 checks with Eastern-time ticker labels, visible reveal containers,
  purchase controls, and zero console warnings/errors. Nine WordPress,
  XML-RPC, `.env`, `config.json`, and `.git` variants all returned the expected
  five-byte plain-text 410 response; product security headers remained present.
- **2026-07-28:** fixed the production product-detail hydration mismatch by
  formatting the price-update clock explicitly in `America/New_York`. Added a
  narrowly scoped Netlify Edge handler so blocked WordPress/XML-RPC/dotfile
  probes return 410 before Next routing. Five focused tests, all 455 tests,
  lint, and the complete 419-page production build passed. English desktop,
  390px mobile, and Spanish product checks showed visible content and no
  console warnings/errors.
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
