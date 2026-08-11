# Current Status

> Present-state snapshot for session startup. Historical implementation detail
> lives in `CHANGELOG.md`; open work lives in `TASKS.md`; durable rationale lives
> in `DECISIONS.md`. Last reconciled: **2026-08-10**.

## 🟢 Scheduled jobs now RUN — via GitHub Actions (cut over 2026-08-11)

**The automation works for the first time in this project's history.** The
GitHub Actions workflow replaced the dead Netlify schedules and, on its first
real run, produced rows that had never existed:

| Log | Result |
| --- | --- |
| `etsy_sync_log` / `scheduled_price_push` | **FIRST EVER** — "42 pushed, 32 unchanged, 0 blocked, 0 failed, 16 deferred" |
| `instagram_sync_log` / `scheduled_drip` | ok — 0 published, 0 skipped |
| `facebook_sync_log` / `scheduled_drip` | ok — 0 published, 0 skipped |
| `instagram_sync_log` / `token_refresh` | ok — "no action needed (not_due)" |
| `ebay_sync_log` / `scheduled_price_push` | **FIRST EVER** — "50 pushed, 67 unchanged, 1 blocked, 0 failed, 6 deferred" |

A second dispatch at 02:47 UTC drained the deferred remainders. **Day totals:
Etsy 58 pushed, eBay 56 pushed, 0 failures on either, 0 listings at the
3-attempt backoff ceiling.** Etsy's final run returned outcome **`ok`** with
`remaining: 0` — the first completely clean scheduled run in the project's
history. eBay's stays `warning` only because inventory #82 is deliberately
write-blocked.

The `token_refresh` row exists solely because of the skip-logging added the same
day — before that, a successful run would have left no trace at all.

✅ **`EBAY_CRON_SECRET` was rotated and eBay now works too.** Its first attempt
failed `HTTP 401 {"code":"unauthorized","message":"Invalid cron secret."}` —
"Invalid" rather than "not configured", so the secret existed but its value
differed from Netlify's. It could not simply be re-copied: Netlify marks that
variable **secret in four of five deploy contexts**, which is write-only (lock
icons, Options offers only Edit/Delete, no reveal). The owner rotated it in
Netlify, redeployed, updated the GitHub secret, and the rerun went green.

**The eBay result is the more meaningful one.** Before the 2026-08-08 fixes an
eBay price push produced **139 errors in a single run**. This run: **50 pushed,
0 failed**, zero listings left with `error_count > 0`. The "1 blocked" is
inventory #82, held back by `EBAY_WRITE_BLOCKED_PRODUCT_IDS` exactly as
designed.

⚠️ **`.env.local` was NOT in sync with Netlify for the eBay cron secret** (local
ended `3bb6`, Netlify production ended `4e67`). That is why eBay failed while the
other three, which did match, succeeded. Both are now the rotated value. The
standing rule — Netlify is authoritative, check rather than assume — is evidenced
rather than merely cautionary; do not record `.env.local` as authoritative.

The Netlify functions remain deployed and still never fire; they are left in
place only so the change is reversible. History of the fault is below.

## 🔴 No Netlify scheduled function has ever run (found 2026-08-10)

**Nothing automatic is running on this site.** Not the Etsy price push, not the
eBay price push, not the Instagram or Facebook drip workers, not the Instagram
token refresh. Verified from both sides on 2026-08-10:

- **Database:** zero `scheduled_price_push` rows across 1,538 Etsy and 56,480
  eBay log rows; zero `scheduled_drip` rows with both social channels
  `connected`. Every one of those code paths logs unconditionally, including
  skips.
- **Netlify:** the function log is empty for the last 24 hours on both
  `ebay-price-push` and `instagram-drip` — the latter is scheduled 14 hours a day
  and should show ~14 invocations.

Ruled out: functions are deployed (6 on `main@7576826`), all five show the
**Scheduled** badge with a *Next execution*, all four `*_CRON_SECRET` variables
exist scoped to Functions, and 614 team credits remain. An erroring function
would still write to Netlify's log — these are never invoked.

**Manual `Run now` fails the same way**, which narrows it further. Pressing it on
`instagram-drip` — with the due-row query verified server-side as returning `[]`
first, so the run was a guaranteed no-op that still logs unconditionally —
produced no `scheduled_drip` row and no Netlify log line. The Next.js Server
Handler is also a function here and works fine, so the fault is specific to
**scheduled** functions. **This is a platform fault, not an application bug;
nothing in this repo can fix it — it needs a Netlify support ticket.** Detail in
`CHANGELOG.md` 2026-08-10; owner steps in `TASKS.md` → *Etsy And eBay*.

**A replacement trigger is built and waiting on four secrets.**
`.github/workflows/scheduled-jobs.yml` runs all five jobs from GitHub Actions on
the same cron expressions, hitting the same secret-guarded routes — the routes
were designed trigger-agnostic, so **no application code changed**. The owner
must add `ETSY_CRON_SECRET`, `EBAY_CRON_SECRET`, `INSTAGRAM_CRON_SECRET` and
`FACEBOOK_CRON_SECRET` as repository secrets (the repo has none today); the
workflow then also gives a manual **Run workflow** button per job, replacing the
Netlify Run now that no longer works. Steps and caveats in `TASKS.md`.

Confirmed 2026-08-11 that this approach works at all: an unauthenticated
`POST https://naplesestatejewelry.com/api/admin/etsy/price-push` returns
**401 `{"error":"Unauthorized."}`**, so the routes are reachable from outside
Netlify.

Consequences until that lands: marketplace prices move **only** when someone
clicks "Push prices now", the Instagram/Facebook queues never drain on their
own, and the Instagram long-lived token is not being refreshed weekly. That last
one is the only real deadline, and it is not urgent — the token runs to
**2026-09-30** and the renewal window is 7 days.

The Admin Settings price cards no longer hide this: a never-run or overdue
schedule renders red and names the Netlify function log, instead of the old
green check reading *"Ready for Daily at 11:45 UTC."* (undeployed, 2026-08-10).

## Start Here (handoff, end of the 2026-08-09 → 2026-08-10 session)

> **⚠️ SUPERSEDED IN PART — the batch below SHIPPED as `main@27c12e2` on
> 2026-08-09 and production verification passed, except for ONE regression that
> is fixed locally and awaiting a second deploy.**
>
> - **Deployed and verified:** hero CTAs two-up-one-down, hero Trade →
>   `/trade-in`, reviews band 2-up with clamped quotes and Google links,
>   redirects/webhook carve-out, robots/sitemap. Netlify build clean at
>   449/449 pages. Detail: `CHANGELOG.md` → *2026-08-09 (post-deploy)*.
> - 🔴 **Undeployed fix:** the shop-card `Ca. YYYY` label collides with the
>   price on 2-up cards (measured **-9px** on production at 390px). Fixed
>   locally with a container query on the price row that **drops the "Ca."
>   prefix and keeps the bare year** when the row is under 185px of content
>   width — the label stays in its left slot and no card changes height.
>   `tsc` and `lint` clean, measured across the width ladder in both locales.
>   **`npm run build` has now been run and is clean (449/449 pages, no
>   warnings) — this is waiting on a redeploy only.** (`npm test` green at
>   **848/848**.)
> - 🔴 **Undeployed:** `/free-evaluation` **rebuilt as a sendable landing
>   page** — form moved out of the hero into its own "Send a request below"
>   block (photos optional), hero now explains the service in Chris's voice
>   beside a photo of an evaluation in progress, plus a new detailed sorting
>   section covering purity subcategories and piece-by-piece pricing. Both
>   locales. ⚠️ The hero image is a **placeholder**
>   (`pages/evaluation-desk-placeholder.webp`) — owner rejected the generated
>   likeness of himself and will supply a real photo. It is framed with no
>   identifiable face on purpose, because the copy beside it is first person.
>   **Swap the file and its alt text together.**
> - 🔴 **Undeployed:** **wrap groups centred below `lg`** on
>   `/free-evaluation` (trust chips + hero CTAs). Every other customer-facing
>   wrap group was audited and needed no change — see `CHANGELOG.md`,
>   *2026-08-09 (post-deploy 5)*, for the list so the sweep is not redone.
> - 🔴 **Undeployed:** **Free Evaluation is now in the header Sell nav**
>   (last, after Trade-In Program). It was previously reachable only from the
>   footer. One `SELL_ITEMS` entry covers the desktop dropdown, the mobile
>   accordion, and the parent Sell tab's active state.
> - 🔴 **Undeployed:** **the `/free-evaluation` hero prose now has hierarchy** —
>   brighter lede, a gold `<h2>` kicker with a hairline, the metal list moved
>   out of the prose into a `<dl>` panel with an aligned term column, and the
>   two trailing paragraphs split into a quiet footnote and a bright closer.
>   The metal terms went cream → brand gold; see `CHANGELOG.md`,
>   *2026-08-09 (post-deploy 6)*, for why that is **not** a WCAG regression.
> - 🔴 **Undeployed:** **matte-clay illustrated marks are now sitewide** — the
>   homepage services strip, `/free-evaluation`, `/sell`, `/sell/[city]`,
>   `/trade-in`, `/bullion`, `/gold-services` and `/silver-services`. 20 WebP
>   assets in `public/assets/images/icons/`, rendered through
>   `components/ClayMark.tsx`. `ServiceIconCanvas` was deleted (the homepage's
>   canvas-drawn icons). Functional UI icons (cart, heart, chevrons, admin, and
>   small inline glyphs) are unchanged and stay Lucide. See DECISIONS,
>   *"Illustrated clay marks are IMAGES"*.
> - 🔴 **Undeployed fix:** every icon rendered as a solid blob wherever a legacy
>   `fontVariationSettings: "'FILL' 1"` style survived — the Material Symbols
>   fill bridge in `AppIcon` flooded Lucide outline icons. Bridge deleted, all
>   27 usages cleaned, four semantic swaps, two regression tests added. Ships
>   with the same redeploy.
> - 🔴 **Undeployed fix:** the `/free-evaluation` hero eyebrow ("100% Free — No
>   Obligation") was painting itself with `--color-primary` on the near-black
>   hero — **2.96:1, below AA**. Now the on-dark gold at **12.19:1**. The other
>   13 `--color-primary` nodes on that page sit on light surfaces and pass
>   (5.26–6.44:1), so the fix is scoped to the one that was broken.
> - ⚠️ **Netlify Node correction:** `NODE_VERSION` is **20.20.2**, but
>   `@netlify/plugin-nextjs` cannot run on it and Netlify silently executes the
>   plugin on **22.23.1**, warning every build. Raising the pin to 22 would
>   align them.

**One thing is waiting: DEPLOY.** A full UX/performance batch is finished,
fully verified, and sitting undeployed. There is **no outstanding local work,
no failing check, and no pending SQL** — the session's one migration
(`add-slideshow-bg-colors.sql`) was run and confirmed by the owner.

- **What's in it:** shop gallery-card touch overhaul (Add to Cart restored on
  mobile, cart icon sitewide, windowed dot indicators, photo swipe, one-card-
  off-cover model), homepage hero touch snap + slower handover, a hero
  performance batch (duplicate image downloads eliminated, q82, spinner),
  **one solid admin-chosen background per slideshow** replacing the per-photo
  sweep, the **reviews band at a 2-column minimum, 8-line-clamped quotes,
  and each card linking to the Google Business Profile**, the hero's
  **Trade CTA now pointing at `/trade-in`** instead of `/contact`, and the
  **hero CTAs held at two-up-one-down on mobile**. Full detail:
  `CHANGELOG.md` → *2026-08-09* and *2026-08-09 (later session)*.
- **Plus the whole `/free-evaluation` + icon-system arc** added later in the
  same session: the page rebuilt as a sendable landing page, matte-clay marks
  sitewide, the `AppIcon` fill-bridge fix, the hero prose hierarchy, wrap
  groups centred on tablet/mobile, the eyebrow contrast fix, and Free
  Evaluation added to the header Sell nav. Detail: `CHANGELOG.md` →
  *2026-08-09 (post-deploy 2)* through *(post-deploy 7)*.
- **✅ THE FULL GATE PASSED ON THE COMPLETE BATCH — re-run last at the END of
  the session (2026-08-10), after the final code change.** Dev server stopped
  and `.next` deleted first, so it is a clean from-scratch build covering every
  change in the batch. Nothing needs re-running before you copy and deploy.

  | Command | Result |
  | --- | --- |
  | `npx tsc --noEmit` | clean, no output |
  | `npm run lint` | clean, no findings |
  | `npm test` | **848 passed / 848**, 87 files |
  | `npm run build` | **compiled successfully, 449/449 static pages**, no warnings |

  The gate was re-run after *every* code change in the session, not just once
  at the end — the table above is the final run, on the final state of the tree.
- **To deploy:** copy this folder to the repo folder and push.
- **Then:** work the 📱-marked smoke list in `TASKS.md` → *New surfaces to
  smoke after the NEXT deploy*. Three of those genuinely need a real phone —
  they are the checks this environment could not perform.
- **Before writing hero or shop-card code**, read the three new entries in
  `DECISIONS.md`: *One solid background per slideshow*, *On touch, the hero
  snaps exactly one slideshow per gesture*, and *Shop-card photos: swipe +
  windowed dots on touch*. Several older entries in that file describe the
  removed background sweep and carry inline supersession notes — the rule is
  the newer entry.
- **Owner-owned items unrelated to this batch** (price-push logs, eBay #82
  reattachment, the inbox check) are unchanged in `TASKS.md`.

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

1. Deploy the locally verified batch and run the focused production smoke list
   in `TASKS.md`.
2. Complete accountant review before changing Florida surtax or other-state tax.
3. Run the controlled PayPal recovery/refund/concurrency matrix.
4. Complete deliberate marketplace price-push, shipping-tier, eBay #82, and
   remaining provider checks without blanket writes.
5. Finish the owner/content/credential-record items in `TASKS.md`.
6. ✅ Deep Field env vars + production import are DONE (2026-08-08; this line
   previously listed them as pending). Remaining Deep Field items are the
   budget-pin test and the 30→50 retune in `TASKS.md`.
