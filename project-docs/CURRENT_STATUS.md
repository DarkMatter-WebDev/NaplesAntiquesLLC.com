# Current Status

> Present-state snapshot for session startup. Historical implementation detail
> lives in `CHANGELOG.md`; open work lives in `TASKS.md`; durable rationale lives
> in `DECISIONS.md`. Last reconciled: **2026-08-08**.

## Deployment State

- 🟢 **THIS BATCH IS SIGNED OFF AND READY TO DEPLOY** (pre-flight 2026-08-06 —
  clean-from-scratch build, production-mode smoke, DNS and compiled-output
  checks; full evidence in TASKS.md).
- 🔴 **OUTBOUND EMAIL IS DOWN UNTIL THIS BATCH DEPLOYS — that is the one thing
  the deploy fixes, and the reason not to sit on it.** Resend's sending domain
  was swapped from `.co` to `.com` on 2026-08-05 (Free plan allows only one, so
  `.co` had to be deleted). Resend, DNS, code, and the Netlify `EMAIL_FROM`
  override are all done and verified; the *deployed* code still sends from `.co`,
  which is no longer a verified domain, so every send currently fails.

  Checkout is unaffected — send failures are caught and never throw — and missed
  receipts re-send from Admin → Orders.

  **After deploying, two steps remain and both are owner-owned:** confirm the
  Netlify build log succeeds (local builds ran on Node v24, Netlify pins Node
  20), then do a real test send **and open the inbox to confirm it arrived**.
  DMARC is at `p=quarantine`, so a DKIM or alignment fault delivers to spam
  without erroring — a green "sent" in Resend's log is not the check that matters.
- **Production:** `https://naplesestatejewelry.com` is live on Netlify. The
  `.com` domain is primary; `naplesestatejewelry.co` and
  `naplesantiquesllc.com` redirect path-preservingly to it. The `.co/api/*`
  carve-out remains for registered external endpoints. Business **mailboxes**
  stay on `.co`; never alter its MX records as part of website work. Outbound
  **sender** addresses are now `@naplesestatejewelry.com`.
- **External domain migration:** complete. GoDaddy DNS, Netlify primary/cert,
  environment URLs, Supabase Auth, PayPal/eBay/Etsy registrations, Search
  Console, sitemap, and Google Change of Address were completed and verified.
- **Local source-of-truth batch:** verified 2026-08-06 at **720/720 tests**,
  `npx tsc --noEmit`, full lint, and a clean-from-scratch **449-page production
  build**, plus a `next start` smoke of 38 route/locale combos (all 200 bar the
  correct `/es/` 308). Still not production-reverified as a batch — that happens
  after it ships.
- **Deploy workflow:** this folder has no git workflow. The owner copies it to a
  separate repository folder and handles version control/deployment manually.

## Runtime And Data

- The only active application is the Next.js App Router app in `next-app/`.
  Root `netlify.toml` builds that directory and publishes `.next`.
- Supabase project `evzluixourmsefwdsieu` is the system of record for catalog,
  auth, customer state, orders, inquiries, admin data, marketplace state, and
  social state. Product rows store media references, never image/video bytes.
- New product images use Supabase Storage with WebP/downscale/cache defaults.
  Product-video bytes use Cloudflare Stream; marketplace video publishing is
  not enabled.
- EN/ES routing uses `next-intl`. Public routes, metadata, validation, and legal
  behavior are paired across locales.

## Storefront And Accounts

- The product purchase panel is its own query container: the scrap-value and
  live-spot tiles always sit side by side and compact their type/padding rather
  than stacking, and the buy actions are a flush grid (one row of four on a
  column ≥470px, otherwise Add to Cart full width above Save/Inquire/Call).
- Products whose first photo is shot on black render a dark page variant. The
  dark palette applies only to content on the dark page; any card that paints
  its own light background (related products, reviews) carries
  `product-light-surface` and restores the light text tokens. Both variants
  audit clean for WCAG AA text contrast in both locales.
- The product gallery has no hover/touch magnifier (removed 2026-08-04);
  clicking the main photo opens the full-size lightbox, and the prev/next
  controls only navigate. Swiping the main photo changes it on touch devices at
  every size; below 768px that swipe is the only on-image control, since the
  edge bars are hidden there. From 768px up the bars return alongside it. Those
  bars are narrow full-height strips hugging
  each side of the photo — the bar is exactly the
  clickable area — each fading in as the cursor approaches that side and solid
  once it is over the bar, permanently visible on touch. Their translucent scrim
  reads on any backdrop (it darkens light content and lifts dark content), so it
  no longer depends on the frame's padding colour matching the photo, and they
  sit above every layer in the frame,
  with a flat scrim whose tone follows the frame's own backdrop. The middle
  15%–85% of the photo stays the lightbox's.
- `/shop` is the canonical catalog. Public visibility is Available and Sold;
  Draft, Pending Payment, and Archived remain private. Sold prices are masked
  unless a captured sale snapshot supplies the historical amount.
- Product cards, gallery/lightbox, shop filters/pagination, account/favorites,
  cart return state, live spot pricing, and checkout are active. Product
  detail pages end with three policy accordions (Shipping & Returns /
  Condition & Wear / Payment Options, linking to the full policy pages), a
  full-width Sustainably Sourced / Fully Insured / Local Pickup trust strip
  beneath both columns, and a
  compact band of the four curated Google reviews (single source:
  `src/lib/testimonials.ts`, shared with the homepage section), preceded by a
  "You Might Also Like" strip of four same-category available pieces ranked
  same-type-first, each card carrying the shop cards' purity/weight/length/width
  chips from the shared `lib/product-spec-chips.ts`.
  From md up the product page is a two-column layout that fills the space under
  the photo: column 1 is the gallery then notes + the policy accordions, and
  column 2 is the purchase panel, description, and Specifications (which
  include a chain/band Width in mm for necklaces and bracelets), so both
  columns end together (~947px at 1280-1920 for a typical piece, down from
  1337px). At 2000px+ the roles invert — the gallery is the taller column — so
  the aside moves under the info stack instead. Below md everything collapses
  to the original single-column order. The trade-in
  service has a named page at `/trade-in` (Gold & Silver Trade-In Program),
  linked from the Sell menu, footer, and each product page's trade-in line.
  The homepage carries an announcement bar (top of content, not the fixed
  header) that never wraps — its type shrinks fluidly to hold one line, and its
  third item appears only from 780px. It also carries
  a Meet the Owner story block, a Why Buy Estate Gold? education
  section, and four FAQ accordions linking to `/faq`, ordered hero →
  services → owner → education → FAQs → testimonials → call CTA. Checkout is a
  single-page two-column layout: one Shipping card on the left (delivery
  method → contact → address) and a sticky Order summary on the right holding
  items, totals, and the PayPal buttons, with a **Back to cart** link that
  reopens the cart drawer.
- The fixed site header is fully opaque (`#f9f9f7`, no backdrop blur; the mobile
  menu panel likewise), and its height comes from one token,
  `--site-header-height` — 3.5rem on phones, 4.5rem from md up. The header is
  sized BY the token, so page offsets (`.site-header-offset`), sticky tops, and
  full-height panes derive from it and cannot drift. A source guard test rejects
  a reintroduced `pt-16` main, `top: 4rem`, or `calc(100svh - 4rem)`.
- The homepage hero is a scroll-pinned parallax stack (`HomeHeroStack`) of
  THREE slideshows: the headline/sign-up/CTA overlay stays pinned while A
  slides away upward and B descends from above, B holds, B slides away and C
  descends, C holds, then the whole frame breaks free with normal scrolling.
  All panes travel one frame height at matching speed (`PANE_A_TRAVEL` can
  raise the departing pane's for depth). Overlay text theme follows the
  dominant slideshow; ring direction alternates — A and C right-to-left, B
  reversed. Reduced motion collapses it to the single static hero. B and C
  each have their own admin-curated lineup (Slideshow 2 / 3 tabs in Admin
  Settings, `carousel_selection_alt` — migration run by owner, 10-item lineup
  live — and `carousel_selection_third`, NOT yet migrated), each mirroring A
  while its lineup is empty. B mounts on first scroll intent or idle and C
  only once scroll progress passes 12%, so initial load carries one carousel.
  Each slideshow's lineup can also be FILLED from a random draw — Gold
  jewelry / Silver jewelry / Non-jewelry items, reusing the shop's Jewelry &
  Watches classification — which replaces the list with up to 10 pieces that
  are then edited and saved like any hand-picked lineup. Random is a starting
  point, not a live rotating source, so saved lineups are always explicit.
  The picker and the random fills work from a chosen status list (All /
  Available / Sold); lineups may include sold pieces, which render in the
  hero with no price caption and link to their product page showing Sold. App code locally verified only; not yet deployed, and
  add-random-lineup-modes.sql / add-third-lineup.sql have NOT been run in
  Supabase yet (see TASKS.md).
- The local batch fixes thumbnail-rail clipping/wrap stutter, normalizes all
  seven password fields through one shared eye-toggle component, and expands
  large application canvases at ultra-wide breakpoints while preserving narrow
  prose/dialog surfaces.
- Admin Products fills surplus width at 2100px+, expanding Brand first and then
  distributing remaining space across flexible columns.

## Checkout, Orders, And Compliance

- PayPal Orders API v2 owns payment. Totals, product availability, U.S. address,
  shipping method/fee, and tax are recomputed server-side. There is no inventory
  hold; the first successful capture wins one-of-one inventory.
- Shipping is U.S.-only. Local Pickup is free. Insured shipping uses value-based
  tiers; $5,000+ Standard uses USPS Registered Mail, and Express is unavailable
  above that coverage threshold.
- Current tax policy is 6% on merchandise plus charged shipping for Florida
  destinations and no collected tax outside Florida. County surtax and any
  additional nexus rules remain blocked on accountant/legal review.
- Orders support invoices, receipts, fulfillment email/history, refunds,
  recycle-bin restore/permanent delete, and sold-price locking. The controlled
  live PayPal recovery/refund/race matrix remains open.
- **All outbound mail sends from `@naplesestatejewelry.com`** (Resend's only
  verified domain since 2026-08-05). Customer receipts and fulfillment updates
  carry `Reply-To: info@naplesestatejewelry.com`; marketing keeps
  `Reply-To: chris@naplesestatejewelry.co`, a live mailbox. Never "fix" a sender
  back to `.co` — it will not send at all. See DECISIONS.md for the
  mailbox-vs-sender split.
- The checkout form's fields are properly labelled (`id`/`htmlFor`) and carry
  full `autocomplete`; keep both when editing `CheckoutClient.tsx`, since the
  visible `.form-label` markup does not associate on its own.
- Privacy, Terms, Returns/Refunds, Shipping, Accessibility, and cookie controls
  are present. Auction and vendor pages are retired and redirect to current
  destinations. Counsel review remains recommended.

## Marketplace Integrations

- Etsy and eBay are independent, review-first one-way sales channels. Both have
  connection/settings, previews, per-item and bulk sync, status reconciliation,
  delist/relist behavior, price freshness, shipping policy/profile selection,
  and bounded observable daily price-push infrastructure.
- Seven insured-shipping tiers are provisioned on **both** marketplaces. One
  controlled listing update per marketplace still needs owner verification.
- **Deep Field Gallery** is a one-way outbound product push to a separate site,
  server-side only, sharing nothing but a bearer token — no Supabase credential
  crosses in either direction and NEJ never touches the Deep Field database.
  The initial 128-product / 974-image bulk import is **complete and reconciled**
  against a local Deep Field receiver. The live fire-and-forget hooks (admin
  save/status-change plus both checkout sold-flip paths) are **code complete but
  inert** until `DEEPFIELD_SYNC_URL` and `DEEPFIELD_SYNC_TOKEN` are set in
  Netlify. **Production Deep Field has received nothing.** See
  `features/deepfield-sync.md`.
- All scheduled-function badges were production-confirmed. The owner has not
  yet deliberately run each live price-push function and checked its resulting
  Admin last-run card/log.
- eBay inventory #82 remains write-blocked pending deliberate reattachment to
  its external relist — now enforced in code by a pinned id
  (`EBAY_WRITE_BLOCKED_PRODUCT_IDS`) rather than inferred from a `last_error`
  string that any later write could clear. The sold-hidden freshness bug and
  remaining controlled marketplace checks are tracked in `TASKS.md`.
- **eBay listings are flagged `out_of_date` because the new tier fulfillment
  policies are part of the content hash.** The count read 123, which was wrong:
  the freshness scan was also hashing `hidden_oos` rows, so 36 sold-and-hidden
  listings were mis-flagged. That is fixed and self-repairing on the next scan;
  the true figure is **87 available listings, 86 writable (#82 is blocked) ≈ 4
  capped runs**. The daily price push cannot clear the flag (price/quantity
  only), so applying the new shipping requires deliberate batched syncs. Every
  bulk enqueue is now bounded to 25 items and drops write-blocked and
  non-available products first. No live eBay write has been made — this is an
  owner-run campaign from the deployed admin, starting with one drawer-level
  sync verified on eBay. See `features/ebay-sync.md`.

## Instagram And Facebook

- Both channels use one guided owner flow: curate caption/photos/card → **Save
  & prepare** → review → schedule or publish. Downstream actions stay hidden
  until the prepared review is current. The generated card is always slide 1.
- Captions share the reviewed wording while retaining channel-specific link and
  hashtag blocks. Instagram uses `Store link in bio` plus an `Item:` short link
  and a larger hashtag set; Facebook uses a clickable `Shop:` URL and three
  hashtags. Tiffany references normalize to `Tiffany & Co.` and
  `#tiffanyandco`; em/en dashes receive one space on both sides.
- AI openers are manual and steerable. Skipping generation keeps deterministic
  copy. Generated/editable text must be conversational, use “this” naturally,
  never say “our,” and must be saved into a new prepared review before publish.
- Photo/card curation previews the exact contain-to-square prepared framing,
  sampled canvas, and source crop. Prepared slides have a full-size keyboard
  viewer with arrows. Caption, wording, photos, or both can be synchronized
  between channels without publishing.
- Published status reconciles conservatively. Confirmed remote deletion clears
  published state; ambiguous token/permission/network failures do not. Facebook
  publish recovery is receipt/checkpoint-safe and avoids duplicate posts.
- Facebook uses a validated Page token for **Naples Estate Jewelry**; candidate
  tokens must pass app/Page/read-access checks and have at least 30 days of
  finite life. The locally connected token reported data access through
  2026-10-31 at last verification. Instagram uses its refreshable Business token.
- `/admin/social-queues` shows independent Instagram/Facebook queues, readiness,
  exact scheduled and approval times, worker health, and actions to edit,
  publish now, reschedule, or remove without discarding prepared copy.
- Allowed Eastern posting times are **noon, 2 PM, 4 PM, 6 PM, 8 PM, 10 PM, and
  midnight**. UI, API validation, defaults, dashboard copy, and both Netlify
  workers share that allowlist. Due-row queries prevent early publishing across
  EDT/EST coverage hours.
- The queues have no owner-configured or application-enforced daily post cap.
  Each worker invocation processes at most 25 due rows as a runtime safety
  bound and later invocations continue any remainder. Instagram can still defer
  a post when Meta reports its provider-enforced rolling publishing quota.
- Queue **Post now** runs in a route-persistent lower-right background widget.
  Each channel also supports selecting any ready queued rows and posting the
  selection now with one confirmation. Bulk posts run sequentially in visible
  queue order. Only one social publish or batch runs per tab; success auto-
  closes, while a failed batch stops and can resume at its failed item without
  reposting completed entries.
- Social Queues also exposes **Latest Posts**, a modal backed by the 12 newest
  locally published receipts per channel. It supports live-post links, manager
  links, conservative status refresh, public owner-written comments, permanent
  Facebook removal with confirmation, and Instagram's honest manual-removal
  handoff. The Instagram and Facebook headers independently collapse their full
  sections so long histories can be managed one channel at a time. No comment
  text is persisted locally; only an audit outcome is logged.
- Signed-in 2026-08-03 QA observed item 39 queued on both channels at 6 PM EDT.
  The seven-choice Instagram picker was opened and cancelled; no reservation,
  queue state, or public post changed. At 600px and 900px, all four row-action
  labels stayed inside their responsive two-column button grid.

## Security And Operations

- Secrets stay in gitignored local environment files, Netlify environment
  contexts, or encrypted provider rows. Only public Supabase values reach the
  browser. Project docs record locations and variable names, never values.
- Public mutation routes use validation plus edge/distributed rate limiting;
  scanner probes are blocked. Security headers are defense in depth.
- Netlify environment values are the operating configuration; local
  `.env.local` is for development only.
- Generated build output, caches, logs, temp files, and dependencies remain
  ignored. No scratch artifact was left by the 2026-08-03 session.
- Project memory has one current source per feature. The retired Etsy/eBay plan
  folders, kickoff notes, legacy-removal report, and obsolete carousel handoff
  were removed after their live guidance was consolidated into feature docs.

## Immediate Priorities

1. Deploy the locally verified batch and run the focused production smoke list
   in `TASKS.md`.
2. Complete accountant review before changing Florida surtax or other-state tax.
3. Run the controlled PayPal recovery/refund/concurrency matrix.
4. Complete deliberate marketplace price-push, shipping-tier, eBay #82, and
   remaining provider checks without blanket writes.
5. Finish the owner/content/credential-record items in `TASKS.md`.
6. Set the two Deep Field env vars in Netlify to activate the live product sync,
   then run the production import once Deep Field confirms the local results.
