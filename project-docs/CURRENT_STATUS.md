# Current Status

> Present-state snapshot for session startup. Historical implementation detail
> lives in `CHANGELOG.md`; open work lives in `TASKS.md`; durable rationale lives
> in `DECISIONS.md`. Last reconciled: **2026-08-13**.

## Start Here (handoff, end of the 2026-08-13 session)

**Read this, then `TASKS.md`. Everything below is current as of 2026-08-13.**

### ✅ DEPLOYED AND VERIFIED IN PRODUCTION (2026-08-13)

The batch is live and was exercised end to end through an authenticated admin
session in the owner's own browser.

**One bug was caught in production and fixed without a redeploy:** the admin
Discount Codes page could READ but not WRITE —
`permission denied for table discount_codes`. The migration granted only
`SELECT` to `authenticated`, and Postgres checks GRANTS before RLS. Fixed by
`supabase/discount-codes-grant-fix-2026-08-13.sql` (already run). See DECISIONS,
*"An RLS policy without a table GRANT is a page that reads but cannot write"*.

Verified working live: create / edit / deactivate / delete, the percent↔dollar
type toggle, required-field validation, the codes table, the checkout chip and
discount line, and the checkout validation API. Button typography confirmed —
the font fix shipped correctly. **The pre-discount shipping-tier rule holds in
production**: a $5,518.10 order discounted to $4,414.48 still drew the $99.00
Registered Mail tier and still blocked Overnight. All test data removed.

**One thing remains unexercised in production:** the refund fix. Every refund
before this deploy failed to record; the corrected path has been proven locally
against real PayPal refunds but has not yet run automatically end to end.
**Confirm the first real refund records itself.**

### What this session produced

- **Discount codes** — new admin tab, checkout field, percent or fixed-dollar,
  optional minimum order / expiry / redemption cap. SQL applied, proven by a
  real purchase.
- 🔴 **A PayPal refund bug found and fixed** — the most consequential item here.
  Every refund silently failed to record. Verified against one full and two
  partial live refunds.
- **A button font bug** — Tailwind font utilities are inert on `<button>`
  sitewide; fixed in the discount components only.
- **A pre-deploy PayPal audit** — the four mysterious `refunded` orders are all
  pre-go-live test artifacts, two of them sandbox. No customer money involved.

### Three things a future session should NOT re-derive

- **~205 buttons across the codebase carry Tailwind font classes that do
  nothing.** Pre-existing, understood, deliberately not fixed sitewide.
- **Sandbox rows live permanently in the live `orders` table** (early July,
  before the 2026-07-09 go-live). Filter by the host in `payment_response`.
- **`paypal_refunds.amount` was reworked 2026-08-13** and now means *this
  refund's own amount*; `orders.refund_amount` is SET from PayPal's cumulative.
  Reconciling against a SUM of the ledger is valid again. ⚠️ **The SQL is
  applied but the code change is UNDEPLOYED** — see `TASKS.md`.

### ✅ Discount-codes SQL applied and proven by a real purchase (2026-08-12)

`supabase/discount-codes-2026-08.sql` has been run in Supabase. A real $42.39
PayPal purchase with a 20% code passed **18 of 18 checks** — including the
atomic redemption inside `capture_paypal_order` and PayPal accepting the
discount breakdown, the two things that could not be verified any other way.
No manual SQL is outstanding again. Detail: CHANGELOG 2026-08-12.

✅ **Test data fully torn down 2026-08-12**, after the payment was refunded in
PayPal (full $42.39, zero fee). Verified clean: 0 test products, 0
`discount_codes`, 0 redemptions, 0 orders with a discount code, no orphaned
`paypal_refunds` row, and `DEEPFIELD_SYNC_DRY_RUN` restored to `false`.

🔴 **That refund exposed a real production bug, now FIXED (undeployed):
every PayPal refund silently failed to record.** The money moved correctly but
the order stayed `paid` with a null `refund_amount`, because a
`PAYMENT.CAPTURE.REFUNDED` resource is a REFUND, not a capture — so the refund
id was passed where the capture id belonged and `apply_paypal_refund` refused
the write. See CHANGELOG 2026-08-12 and DECISIONS.

✅ **Nothing needs repairing from it.** Audited 2026-08-13: **no refund-type
webhook has ever been received on a real order**, so no customer refund was
lost. The four orders sitting at `refunded` with a null `refund_amount` are all
pre-go-live test artifacts — two SANDBOX ($5,646.90 and $37.10, fictional money)
and two live $1.06 owner tests the database wrongly calls refunded. Owner is
deleting all four; see `TASKS.md`.

✅ **Refunds are verified both ways, both LIVE.** Full: end to end on a real
$42.39 capture. Partial: two real partial refunds ($0.50 then $0.56 on a $1.06
purchase, 2026-08-13) taking the order `paid` → `partially_refunded` →
`refunded`, plus 18 synthetic checks covering `PENDING`-ledger attachment,
idempotent replay and the over-refund clamp. **`total_refunded_amount` is
confirmed CUMULATIVE** — the assumption the incremental branch rests on. The
long-open "PayPal refund matrix" item is closed for refunds; capture races,
disputes and invoices remain untested.

⚠️ **Reconcile refunds against `orders.refund_amount`, never a SUM of
`paypal_refunds.amount`** — the ledger amount can drift on a repeat call for an
already-applied refund id. Unreachable from the real webhook path; see DECISIONS.

### One thing is waiting: DEPLOY

A batch is finished, fully verified, and sitting undeployed in
`C:\Users\rcman\NEJ-repo-staging` — **rebuilt 2026-08-13, 835 files / 19.0 MB,
verified as an exact mirror of this folder** (two-way inventory diff: 0 missing,
0 extra) and leak-checked clean. Production is `main@3e30d0e`.

**Nothing further is needed before deploying.** Copy the staging folder into the
repo folder, keeping that folder's `.git`, then push.

**What is in it:**

1. **eBay per-item exclusion** — the two Rolexes are held out of eBay by id
   (`EBAY_EXCLUDED_PRODUCT_IDS`). WARNING: **deploy before running any bulk eBay
   sync** — until it lands they sort FIRST in the enqueue order and would fail
   back to `error`.
2. **Bulk-enqueue ordering** — `orderEnqueueCandidates` (stale -> error ->
   published) so a repeated bulk run advances instead of redoing its first page.
3. **Marketplace flag split** — "Content stale" plus a separate price chip.
4. **In-app-browser stutter fix** — `svh` sitewide, guarded `resize` listeners.
5. **Announcement banner** — pinned inside the hero frame, now the
   free-evaluation promo, linked to `/free-evaluation`.
6. **Discount codes** (2026-08-11) — a new admin tab plus a checkout field.
   Percent or fixed-dollar, with optional minimum order, expiry, and a hard
   redemption cap. Its SQL is **already applied** in Supabase, and the feature is
   proven by a real purchase.
7. **PayPal refund fix** (2026-08-12) — 🔴 the highest-value item in this batch.
   Before it, **every refund silently failed to record**. Verified live on a
   full refund and two partial refunds.
8. **Button font fix** (2026-08-12) — Tailwind font utilities are inert on
   `<button>` in this app; the discount components now set font properties
   inline. Scoped to those components deliberately, not fixed sitewide.
9. **Refund ledger rework** (2026-08-13) — `paypal_refunds.amount` now has one
   meaning. **Its SQL is already applied**; the code is not.
10. **Checkout price-drift guard** (2026-08-13) — a live quote endpoint plus a
   `price_changed` rejection, so a buyer can never be charged a total their
   screen did not show. No SQL.

### How this folder ships

There is **no git workflow here**. Copy `C:\Users\rcman\NEJ-repo-staging`
wholesale into the repo folder (`OneDrive\Documents\GitHub\NaplesAntiquesLLC.com`),
keeping that folder's `.git`, then push. Rebuild staging after any edit — the
exact command is in `TASKS.md` under *Copying to the repo folder*.

WARNING: **never copy the project root directly** — it contains `.git` AND a
stray `next-app/.git`, and the latter would silently drop the whole app from
commits. **Check the deploy reaches `Published`**; one showed `Canceled` earlier
in this session (superseded, not lost, but do not assume).

### What changed structurally this session

- **GitHub Actions owns every cron now**, not Netlify. All five Netlify
  scheduled functions had NEVER executed — a platform fault, not our code.
  `.github/workflows/scheduled-jobs.yml` replaced them and is **confirmed firing
  on its own**. The `.mts` files remain only so the change is reversible.
- **The eBay shipping-tier campaign is COMPLETE** (85 of 86; #82 is
  write-blocked by design).

### Before writing code, read these DECISIONS entries

- *An absent record is a fault, not a clean slate* — why a never-run schedule
  must render red.
- *Content freshness and price-push health are two separate signals* — do not
  merge them; a successful price push cannot clear `out_of_date`.
- *A bounded bulk run must ORDER its queue, not just cap it*.
- *Watches are not listed on eBay* — do NOT implement the `Department`
  `TODO(ebay-verify)` in `mapping.ts`; it is answered.
- *Viewport height is `svh`, and `resize` is never listened to bare*.
- Hero/shop-card rules: *One solid background per slideshow*, *On touch, the hero
  snaps exactly one slideshow per gesture*, *Shop-card photos: swipe + windowed
  dots on touch*. Older entries describing the removed background sweep carry
  inline supersession notes — the newer entry is the rule.

### Verification at session end

| Command | Result |
| --- | --- |
| `npx tsc --noEmit` | clean |
| `npm run lint` | clean |
| `npm test` | **944 passed / 944**, 94 files |
| `npm run build` | compiled successfully, **453/453** static pages, no warnings |

(Re-run 2026-08-11 after the discount-codes feature; previously 903/903 across
92 files and 449 pages. The +41 tests and +4 pages are that feature.)

Run from `next-app/`, with the dev server stopped and `.next` deleted first.

### Owner-owned, not blocking

eBay **#82** reattachment, the `/free-evaluation` hero photo, and the phone-only
checks (in-app-browser scroll, shop cards, hero flick) in `TASKS.md`.

## Marketplace Automation — current state

**GitHub Actions owns every scheduled job.** All five Netlify scheduled functions
had never once executed (a platform fault; the `.mts` files are kept only so the
change is reversible). `.github/workflows/scheduled-jobs.yml` replaced them and is
**confirmed firing on its own** — Etsy 11:54 UTC and eBay 12:27 UTC on
2026-08-11, ~40 min after their slots, which is normal GitHub best-effort
scheduling. Zero failures. Full history: CHANGELOG 2026-08-10 and 2026-08-11.

**The eBay shipping-tier campaign is COMPLETE.** 85 of 86 available listings
carry the correct tier, verified on the live listings across two bands ($35.00 at
$600–1,000; $99.00 "Signed" at $5,000–15,000). Zero listings sit in `error`.

Two items are deliberately not synced and are **not** open work:

- **#82** — write-blocked in code pending an owner-approved reattachment on eBay.
  It is the one remaining `out_of_date` row and can only be fixed on eBay.
- **#83 / #84 (the Rolexes)** — owner decided 2026-08-11 that watches are not
  listed on eBay. Held out per item by `EBAY_EXCLUDED_PRODUCT_IDS`. ⛔ Do NOT
  implement the `Department` `TODO(ebay-verify)` in `mapping.ts`; see DECISIONS,
  *"Watches are not listed on eBay"*.

⚠️ **`.env.local` is not authoritative.** It was out of sync with Netlify for the
eBay cron secret, which is exactly how that value broke. Netlify wins; check
rather than assume. A rotated cron secret must change in three places: Netlify
(plus a redeploy), the GitHub Actions secret, and `.env.local`.


## Deployment State

- 🟢 **The email/security/integration batch SHIPPED 2026-08-08.** Outbound email,
  the `?returnTo=` product-disclosure fix, the Deep Field integration, the
  eBay/Etsy price-push fixes, and the hero carousel work are all deployed. The
  `returnTo` fix was verified against production (28/28 anonymous probes 404).
- ✅ **The email surface is fully verified. `info@naplesestatejewelry.com`
  receives mail — owner-confirmed 2026-08-09**, closing the last outstanding
  check. That mailbox is the single point of failure for every inbound path
  (footer and account inquiries, order notifications, marketing From/Reply-To,
  bounce handling, both JSON-LD blocks), so it stays worth naming even though it
  is no longer an open task. The standing hazard for any FUTURE email change is
  unchanged: DMARC is at `p=quarantine`, so a DKIM or alignment fault delivers to
  **spam without erroring** — a green "sent" in Resend's log is never the check
  that matters, only an opened inbox is. Checkout is unaffected either way (send
  failures are caught and never throw) and missed receipts re-send from
  Admin → Orders.
- 🟡 **The undeployed batch grew substantially on 2026-08-09 and is now a real
  UX release** (still no security or delivery impact): the shop-card touch pass
  (mobile Add to Cart restored, cart icon sitewide, dot indicators + swipe,
  single-card-off-cover model), the hero touch snap + slowdown, the hero
  performance batch (double-fetch fix, q82, spinner), and **one solid
  background per slideshow** (the per-photo sweep is removed). Plus the
  earlier small items: Deep Field image budget 18 → 30 and test hardening.
  The one manual SQL for the batch (`add-slideshow-bg-colors.sql`) is ALREADY
  RUN and owner-verified, so deploying is copy-and-go. See CHANGELOG
  2026-08-09 and the smoke list in TASKS.
- **Production:** `https://naplesestatejewelry.com` is live on Netlify. The
  `.com` domain is primary; `naplesestatejewelry.co` and
  `naplesantiquesllc.com` redirect path-preservingly to it. The `.co/api/*`
  carve-out remains for registered external endpoints.

  **Email is fully `.com` as of 2026-08-08** — the earlier mailbox-vs-sender
  split is reversed. Verified 2026-08-09: **zero `@naplesestatejewelry.co`
  addresses remain in `next-app/src`** (18 `info@…com`, 8 `noreply@…com`).
  Contact addresses, Reply-To, schema.org `email`, and marketing campaign
  senders are all `.com`. Do not restore a `.co` address. Still true regardless:
  **never alter `.co` MX records as part of website work.**
- **External domain migration:** complete. GoDaddy DNS, Netlify primary/cert,
  environment URLs, Supabase Auth, PayPal/eBay/Etsy registrations, Search
  Console, sitemap, and Google Change of Address were completed and verified.
- **Local source-of-truth batch — FULL GATE PASSED 2026-08-09 (re-run at the
  end of the later session, covering the complete batch).** Dev server stopped
  and `.next` deleted first, so this is a clean from-scratch build, not
  incremental:
  - `npm test` → **846/846 across 87 files** (unchanged; the later session's
    changes are CSS and markup, and no suite covers them)
  - `npx tsc --noEmit` → clean
  - `npm run lint` → clean
  - `npm run build` → **exit 0**, compiled successfully in 10.9s,
    **449/449 static pages**; `BUILD_ID`, `server/`, `static/`,
    `prerender-manifest.json` all present, 56 prerendered `.html`,
    911 js files across the tree
  - **Compiled-output spot check** (1022 js/css/html files): removed markers
    `Hide date label on mobile` = **0** and `testimonial-card-link` = **0**;
    new markers all shipped — `testimonial-google-link` 5 files,
    `home-hero-actions` 4, `-webkit-line-clamp` 4, the `share.google` URL 4,
    `/trade-in` 80, `modern-card-date` still present in 2.
  - **Email invariant re-confirmed:** bare `@naplesestatejewelry.co` = **0**
    files and `aol.com` = **0**, against a control of `naplesestatejewelry`
    matching 138 files (`info@…com` 76, `noreply@…com` 19). ⚠️ Method note
    worth keeping: the first attempt reported 0 for *everything* because
    PowerShell 5.1's `Select-String` does not populate `.Matches` when
    `-SimpleMatch` and `-AllMatches` are combined. **Always run a positive
    control through the same scan** — a broken absence check looks exactly
    like a clean result.

  The earlier session-end run of this same gate is superseded by this one. Its
  figures were 449 pages / 846 tests / 58 prerendered `.html` / 961 js, and its
  spot check confirmed the hero sweep's removal (`shop-card-image-progress` = 0,
  the new dot classes present, `shopping_cart` × 23, `pan-y pinch-zoom` × 4,
  `quality:82` × 3). The small `.html` and js deltas between the two runs are
  ordinary build variation.
  - ⚠️ Node here is **v24**; Netlify pins **NODE_VERSION 20** and
    `package.json` declares no `engines`, so a green local build is strong but
    not identical to theirs. Watch the Netlify build log.
  The 2026-08-06 sign-off run additionally smoke-tested 38 route/locale
  combos under `next start` (all 200 bar the correct `/es/` 308); that smoke has
  not been re-run since, as the changes after it were test-and-docs only.
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
- Shop gallery cards (undeployed 2026-08-09 batch): the photo carries windowed
  DOT indicators (max 7, tapered edges when truncated; on the scrim pill +
  hover-revealed on pointer devices, permanent and floating with per-dot
  ring/halo contrast on touch), seated on the photo's bottom edge with the
  brand/link flag lifted above and the prev/next arrows bottom-aligned to the
  flag's baseline. On touch the arrows are hidden and SWIPE changes the photo
  (native non-passive touchmove, 5px slop, ~51° horizontal cone; vertical
  drags still scroll the page); a swiped card keeps its photo until a
  DIFFERENT card is swiped (`shop-card-photo-focus`), so at most one card is
  ever off its cover. Hover auto-cycling and the 1s mouse-leave reset are
  mouse-only. Every card shows the bottom Add to Cart button at all widths
  again (mobile also keeps the corner cart icon), and the cart icon is
  Lucide's ShoppingCart sitewide (header, drawer, checkout empty state, tiles);
  the admin's `shopping_bag` uses are Etsy marketplace icons and stay. The
  **"Ca. YYYY" date shows at every width** (the mobile hide was removed
  2026-08-09); "Your price" stays hidden at every width.
- Product cards, gallery/lightbox, shop filters/pagination, account/favorites,
  cart return state, live spot pricing, and checkout are active. Product
  detail pages end with three policy accordions (Shipping & Returns /
  Condition & Wear / Payment Options, linking to the full policy pages), a
  full-width Sustainably Sourced / Fully Insured / Local Pickup trust strip
  beneath both columns, and a
  compact band of the four curated Google reviews (single source:
  `src/lib/testimonials.ts`, shared with the homepage section; the grid is
  **2 columns minimum**, 4 from 1160px, the card compacts its padding and type
  on a narrow phone rather than dropping to one column, quotes clamp to 8 lines
  in CSS with the verbatim text intact in the DOM, and the whole card links out
  to the Google Business Profile), preceded by a
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
  linked from the Sell menu, footer, each product page's trade-in line, and the
  homepage hero's **Trade** CTA (which pointed at `/contact` until 2026-08-09).
  Below 640px the hero's three CTAs are a two-column grid — always two up and
  one centred below, never three stacked rows — reverting to a single flex row
  of three from 641px.
  The homepage carries an announcement bar that never wraps — its type shrinks
  fluidly to hold one line. It is **not** part of the fixed header; since
  2026-08-11 it rides INSIDE the pinned hero frame (passed to `HomeHeroStack` as
  `banner`), so it stays put until the hero text releases and then travels away
  with it. The frame's height is unchanged, so the hero choreography and touch
  snap are unaffected. 🟡 **It now advertises the free-evaluation promotion
  ("Free evaluations · This month only") and links to
  `/free-evaluation`** — time-limited copy that needs replacing when the promo
  ends; nothing expires it automatically. The old 780px third-item reveal was
  removed with that change. It also carries
  a Meet the Owner story block, a Why Buy Estate Gold? education
  section, and four FAQ accordions linking to `/faq`, ordered hero →
  services → owner → education → FAQs → testimonials → call CTA. Checkout is a
  single-page two-column layout: one Shipping card on the left (delivery
  method → contact → address) and a sticky Order summary on the right holding
  items, totals, and the PayPal buttons, with a **Back to cart** link that
  reopens the cart drawer.
- **In-app-browser stutter is fixed sitewide (2026-08-11, undeployed).**
  Instagram/Facebook embedded browsers hide their toolbar on scroll, changing the
  viewport height. All customer-facing viewport-height CSS now uses `svh` (stable
  against that) instead of `vh`/`dvh` — the worst was `/shop`'s sticky filter
  sidebar on `dvh` — and every `resize` listener goes through
  `onLayoutAffectingResize` (`lib/viewport-resize.ts`), which ignores height-only
  changes under 160px. See DECISIONS, *"Viewport height is `svh`, and `resize` is
  never listened to bare"*. 📱 Worth confirming on a real phone inside the
  Instagram browser — that is the one environment this cannot be reproduced in
  locally.
- The fixed site header is fully opaque (`#f9f9f7`, no backdrop blur; the mobile
  menu panel likewise), and its height comes from one token,
  `--site-header-height` — 3.5rem on phones, 4.5rem from md up. The header is
  sized BY the token, so page offsets (`.site-header-offset`), sticky tops, and
  full-height panes derive from it and cannot drift. A source guard test rejects
  a reintroduced `pt-16` main, `top: 4rem`, or `calc(100svh - 4rem)`.
- The homepage hero is a scroll-pinned parallax stack (`HomeHeroStack`) of
  THREE slideshows handing over in overlapping crossings, everything traveling
  upward (the next slideshow rises from below); the headline/sign-up/CTA
  overlay stays pinned until the frame releases. Full choreography rules live
  in DECISIONS. Each slideshow shows **one solid admin-chosen background
  color** for its whole time on screen (2026-08-09, undeployed — the per-photo
  sweep is removed; `add-slideshow-bg-colors.sql` already run and verified),
  and the overlay's light/dark text theme derives from the dominant pane's
  color by luminance. On TOUCH the hero SNAPS: one gesture advances exactly
  one slideshow however hard the fling (step measured from where the gesture
  began; B's snap point solved from the crossing constants), with a smooth
  ~1s scroll to the next slideshow (`SNAP_STEP_MS`) and free exit at both
  ends; wheel/desktop scrolling is untouched. Runway is 240svh (drag speed
  ~0.7x vs 1:1). All three lineups are admin-curated (Slideshow 1/2/3 tabs;
  all migrations run; later lineups mirror A while empty), each with its own
  background color control; random draws FILL the editable lineup and saved
  lineups are always explicit manual lists. Lineups may include sold pieces
  (no price caption, product page shows Sold). B arms on first scroll intent
  or idle, C one idle beat later, so initial load carries one carousel.
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
- **The buyer is never charged a total they were not shown (2026-08-13,
  undeployed).** 64% of the catalog is spot-linked, so a cart's stored price
  label drifts from the chargeable price as metal moves — measured at $69.33 on
  one bracelet within a single day. Two halves: `POST /api/checkout/quote`
  (read-only, keeps the summary showing live figures) and a `price_changed`
  guard in `paypal/create-order` that returns **409 before creating anything**
  when the displayed total and the authoritative total disagree by a cent or
  more. The server always charges its own price; the client's `quotedTotal`
  only decides whether to stop and ask. See DECISIONS, *"Never charge a total
  the buyer was not shown"*.
- **Discount codes (2026-08-11, undeployed, needs its SQL run first).** Admin →
  **Discount Codes** creates a code that is either a percentage or a fixed
  dollar amount off, each optionally carrying a minimum order subtotal, an
  expiry, and a total-redemption cap. Shoppers enter it at checkout.
  - The discount comes off **merchandise only**. Shipping tier and the $5,000
    Express cutoff key off the **pre-discount** subtotal; Florida tax is charged
    on the **discounted** merchandise plus shipping. A fixed discount is clamped
    to the subtotal, so merchandise can reach $0 but never negative.
  - **The cap is the real reuse control**, enforced by a conditional UPDATE
    inside `capture_paypal_order`'s existing row-locked transaction. "Once per
    email" also exists but is a **speed bump only** — guest checkout means a
    second email defeats it, and that is a deliberate accepted limit, not a bug.
    See DECISIONS, *"the cap is the control"*.
  - The checkout validation route is a **preview**; the charged discount is
    recomputed server-side in `buildOrderDraft` from the code string alone.
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

- **The product table carries TWO chips per marketplace (2026-08-11, undeployed):**
  the state chip, relabelled **"Content stale"** (was "Out of date"), and a
  separate **price chip** ("Price failed" / "Price stalled") that appears only
  when `error_count > 0`. They measure different things and must not be
  conflated — a successful price push cannot clear content drift, because the
  push never writes `content_hash`. See DECISIONS, *"Content freshness and
  price-push health are two separate signals"*. The price chip is invisible today
  because no listing has a failure, which is correct.
- Etsy and eBay are independent, review-first one-way sales channels. Both have
  connection/settings, previews, per-item and bulk sync, status reconciliation,
  delist/relist behavior, price freshness, shipping policy/profile selection,
  and bounded observable daily price-push infrastructure.
- Seven insured-shipping tiers are provisioned on **both** marketplaces. One
  controlled listing update per marketplace still needs owner verification.
- **Daily price pushes: schedules were always correct but had never run** (zero
  `scheduled_price_push` rows ever, in a log that records even skips) — and as of
  2026-08-10 they **still** never have, because Netlify is not invoking any
  scheduled function on this site. See the red section at the top. eBay's
  `price_push_enabled` was also `false`; the owner enabled it 2026-08-08. Three
  code defects fixed the same day — sold products were permanent eBay
  price-push candidates and produced ~33 guaranteed HTTP 400s per run
  (pool 124 → 88), `error_count` never incremented so nothing could back off
  (33 failures became 139 error rows in one run), and `err.detail` was
  discarded so every failure logged an unusable generic message. Etsy carried
  the same defects but is clean in practice because its auto-delist moves sold
  listings outside the selection; fixed there too. **Undeployed — production
  still runs the old code, so eBay's next 7:45 a.m. EDT cron will repeat the
  failures until this ships.**
- 🔴 **A live disclosure bug is fixed in the working folder but NOT DEPLOYED:**
  any hidden product (archived / draft / pending_payment) is readable on
  production by appending `?returnTo=/admin` to its URL, with no session. The
  gate used a back-link validator as an authorization check. Found by the Deep
  Field team in a port of this code. Highest-priority item in the batch — see
  TASKS and the DECISIONS rule *"A query parameter is never an authorization
  signal"*.
- **Deep Field Gallery is LIVE.** One-way outbound product push to a separate
  site, server-side only, sharing nothing but a bearer token — no Supabase
  credential crosses either way and NEJ never touches their database. The
  128-product / 974-image import into **production** is complete and reconciled
  exactly, the Netlify vars are set, and the hook is proven end to end (a save
  logs `[deepfield] synced 1 product(s)`). All environments write for real,
  including local dev, deliberately — so there is no sandbox unless
  `DEEPFIELD_SYNC_DRY_RUN=true` is set locally. Undeployed: the archived-product
  push and `image_count`. Their hourly reconciliation cron is built but not yet
  running, so hard deletes and dropped pushes currently depend on a manual poll.
  The hooks fire from admin save/status-change and both checkout sold-flip
  paths. See `features/deepfield-sync.md`.
- All scheduled-function badges were production-confirmed — **but the badge only
  proves registration, not execution.** As of 2026-08-10 none of them has ever
  actually run; see the red section at the top of this file. Do not read a
  Scheduled badge or a "Next execution" time as evidence that a cron works.
- eBay inventory #82 remains write-blocked pending deliberate reattachment to
  its external relist — now enforced in code by a pinned id
  (`EBAY_WRITE_BLOCKED_PRODUCT_IDS`) rather than inferred from a `last_error`
  string that any later write could clear. ✅ **The sold-hidden freshness bug is
  CLOSED — the repair ran 2026-08-11**, moving 36 mis-flagged rows
  `out_of_date` → `hidden_oos` with no eBay writes; 2 remain by design (no
  `last_pushed_qty = 0` marker). Remaining controlled marketplace checks are
  tracked in `TASKS.md`.
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
  `.env.local` is for development only. ⚠️ "`.env.local` is stale" is a
  tie-breaker rule, **not a blanket fact** — on 2026-08-11 the owner confirmed
  its four `*_CRON_SECRET` values matched Netlify's production values exactly.
  Check before assuming a local value is wrong.
- Generated build output, caches, logs, temp files, and dependencies remain
  ignored. No scratch artifact was left by the 2026-08-03 session.
- Project memory has one current source per feature. The retired Etsy/eBay plan
  folders, kickoff notes, legacy-removal report, and obsolete carousel handoff
  were removed after their live guidance was consolidated into feature docs.

## Immediate Priorities

1. **Deploy the staged batch** (`C:\Users\rcman\NEJ-repo-staging`) and run the
   focused production smoke list in `TASKS.md`. ⚠️ Do this **before** any bulk
   eBay sync — see *Start Here*.
2. Run the phone-only 📱 checks, above all the in-app-browser scroll test
   (open a texted link inside Instagram and scroll `/` and `/shop`). It is the
   one fix this environment could not exercise.
3. Complete accountant review before changing Florida surtax or other-state tax.
4. Run the controlled PayPal recovery/refund/concurrency matrix.
5. ✅ Marketplace price-push and shipping-tier work is **DONE** (2026-08-11).
   What remains is owner-side only: eBay **#82** reattachment on eBay itself.
6. Finish the owner/content/credential-record items in `TASKS.md`.
7. ✅ Deep Field env vars + production import are DONE (2026-08-08). Remaining
   Deep Field items are the budget-pin test and the 30→50 retune in `TASKS.md`.
