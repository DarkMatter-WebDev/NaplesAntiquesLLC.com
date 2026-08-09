# Tasks

> Actionable open work plus a short recent-completions summary. Full history is
> in `CHANGELOG.md`. Last reconciled: **2026-08-08**.

## ✅ Pre-Deploy Sign-Off — 2026-08-06

Final pre-flight run against a **clean build from scratch** (`.next` deleted
first), not an incremental one:

- `npx tsc --noEmit` clean · `npm run lint` clean · **720/720 tests** ·
  `npm run build` exit 0, compiled successfully, **449/449 static pages**.
  Artifact verified present: `BUILD_ID`, `server/`, `static/`,
  `prerender-manifest.json`, 58 prerendered `.html`.
- **Production-mode smoke** (`next start`): 38 route/locale combos all 200; the
  only non-200 is `/es/` → 308 trailing-slash normalization, which is correct.
- **Legacy host still single-hop**: `.co/shop` → 301 `.com/shop`, no `/en`.
- **Webhook carve-out intact**: `POST .co/api/webhooks/resend` → **401**, not a
  redirect.
- **Email end-state**: zero `.co` senders in the compiled output, 19 files carry
  the `.com` sender; DKIM/SPF/MX all resolve on the authoritative nameserver;
  root still has **5 Google MX and exactly 1 `v=spf1`**, so Workspace mail is
  untouched. Resend shows `naplesestatejewelry.com` **Verified**.
- **Repo-ready**: no stray `.bak/.tmp/.log/.orig` artifacts anywhere outside
  `node_modules`/`.next`; `.env`, `.next`, `node_modules` all gitignored;
  `.env.local` `EMAIL_FROM` is the `.com` value.

**Cleared to deploy.**

### Deploy-day checklist (owner-owned)

1. **Copy this folder to the repo folder and deploy.** Outbound email is failing
   in production right now; this deploy is what fixes it.
2. **Watch the Netlify build log.** Local builds ran on **Node v24**; Netlify
   pins **NODE_VERSION = 20** and `package.json` declares no `engines`. Production
   has built on 20 all along, so risk is low — but a local green build is not
   literally proof of theirs.
3. **Test send, then OPEN THE INBOX.** Submit the contact form and confirm the
   mail arrives in the inbox, not spam. DMARC is `p=quarantine`, so a DKIM or
   alignment fault delivers to spam **without erroring** — a green "sent" in
   Resend's log is not the check that matters. This is the single most important
   post-deploy step.
4. ✅ **The manual SQL is done** — `add-third-lineup.sql` verified applied
   2026-08-06. No database step is outstanding.

Nothing else in this batch needs a manual step. `EMAIL_FROM` is already corrected
in Netlify (all five deploy contexts) and in `.env.local`.

## ✅ Deploy Blocker Found AND Cleared 2026-08-05 (production-build pass)

- **`EMAIL_FROM` in Netlify would have silently defeated the marketing half of the
  email migration — now fixed.** `lib/marketing.ts:173-176` reads
  `MARKETING_NOREPLY_FROM || EMAIL_FROM || RESEND_FROM` **before** the corrected
  code default. Netlify held `EMAIL_FROM=noreply@naplesestatejewelry.co` in **all
  five deploy contexts** (Production, Deploy Previews, Branch deploys, Preview
  Server & Agent Runners, Local development), so marketing campaigns would have
  kept sending from the now-unverified `.co` domain and failing.

  **Changed 2026-08-05** to `Naples Estate Jewelry <noreply@naplesestatejewelry.com>`
  — matching the code default exactly, so behavior is identical whether the
  variable is present or removed. Verified byte-exact before saving and confirmed
  across all five contexts after.

  The rest of the precedence chain was checked and is **unset**, so nothing else
  can override: no `MARKETING_NOREPLY_FROM`, no `RESEND_FROM`, no
  `MARKETING_CHRIS_FROM`. The only other marketing variable is
  `MARKETING_TRANSPORT=direct`. `MARKETING_CHRIS_REPLY_TO` is also unset, so the
  intentional `.co` Reply-To default applies.

  Blast radius had been marketing only — every transactional path uses a
  hardcoded literal that is already `.com`.

  ✅ **`.env.local` updated to match** (2026-08-05), so local previews behave like
  production. Edited surgically without reading the file into context: exactly one
  of 83 lines changed, all 36 keys intact, no BOM introduced, CRLF preserved, and
  the value confirmed through `@next/env` — Next's own loader — to parse as the
  exact 55-character string with no stray quotes despite being unquoted with
  spaces and angle brackets. The file is gitignored and never deploys.

  Note: the Netlify change takes effect with the next deploy; it does not
  retroactively fix the currently-deployed build, which still carries `.co`
  hardcoded in its transactional senders.

## Open Findings From The 2026-08-05 Pre-Deploy Audit

A read-only customer-facing audit ran against the dev server plus live probes of
production. Four of the five findings have since been fixed (see CHANGELOG:
checkout labels + autocomplete, legacy-host redirect hops, homepage heading
order). One remains open, and it is a design judgment call, not a defect.

- ✅ **Legacy `.co` two-hop redirects — FIXED 2026-08-05** in `proxy.ts` (not
  `netlify.toml`, where the audit first misattributed it). Root cause: the proxy
  runs before the Netlify rule and prefixes `/en`. Now a single 301 per legacy
  host. **Verify after deploy** with auto-redirect disabled: `.co/shop` should
  give exactly one 301 to `.com/shop`, and `POST .co/api/webhooks/resend` must
  still return 401 — a 301 there would break the live webhooks.
- ✅ **Homepage heading skip — FIXED 2026-08-05.** The three intro cards are now
  `h2`; outline is `H1,H2,H2,…` with zero level skips, visually unchanged.
- ✅ **Spanish chip units — FIXED 2026-08-05.** `formatLengthChip` now takes
  `isEs` and renders ` pulg` / `Talla`, matching the spec table. `formatWeight`
  was intentionally NOT localized — the site uses period decimals in Spanish, so
  `es-ES` would print `53,91g` beside a table reading `53.91 gramos`. No-wrap
  behavior re-verified by measurement at 320px and 768px in both languages.
- ✅ **Product-page small text — FIXED 2026-08-05.** 11px floor applied; 46 → 15
  elements under 11px at desktop, and none of the remainder is product-page
  content (footer headings and `text-xs` buttons at 10.4–10.88px). See CHANGELOG
  for the three issues surfaced along the way, including a horizontal-scroll
  regression this introduced and then corrected.

- ✅ **Wishlist drawer viewport cap — FIXED 2026-08-05.** Was `w-full max-w-sm`
  with no viewport cap, so below ~384px the always-mounted, off-canvas-parked
  panel dragged the document into horizontal scroll. Now
  `max-w-[min(24rem,100vw)]`, mirroring `CartDrawer`. Verified the cap engages
  below the design width and disengages above it, with the drawer opened both
  empty and holding an item at 320px.

  ⚠️ **Invariant for any future off-canvas panel:** if it is always mounted and
  hidden via `translateX(100%)` rather than unmounted, its width MUST be capped at
  the viewport, or it extends the document by its own overflow — which then feeds
  back into its own `w-full` measurement.

**Verified healthy, no action needed** (recorded so it is not re-audited): server
authoritative pricing with `$0`/negative rejection and a stale-spot guard
(`checkout-pricing.ts`); no `cost_basis`/keys/JWTs in public HTML; rate limits on
every public endpoint plus honeypots on all three public forms; production
security headers live and CSP **enforcing**; `.co/api/*` carve-out intact
(`POST .co/api/webhooks/resend` → **401, not 301**, so the Resend webhook works
and rejects unsigned payloads); zero horizontal overflow at 320px; dark-theme
contrast clean across the 9-of-20 products that use it; robots/sitemap contain
zero `.co` URLs; 404s return a real 404.

**Second pass, 2026-08-05, against the PRODUCTION build (`next start`), not dev** —
this is the gap that earlier passes had left open. All clean: 46 route/locale
combos with no 4xx/5xx (only correct 3xx: trailing-slash normalization and the
auth gate); all 23 legacy redirects resolve to 200 destinations with no soft-404
dead ends, and the deliberately-omitted `new-listing-04` still 404s; `/p/`
shortlinks resolve and fall back to `/shop`; the new proxy host-redirect is
single-hop on every legacy host and **does not loop** on the canonical host, `www`,
`netlify.app`, or deploy-preview hosts; `/api/*` still never redirects; zero
console errors on home/product/checkout; no `localhost` in any canonical/og:url/
og:image across 14 pages; and no `noreply@…co` survives anywhere in the compiled
output (19 files carry the `.com` sender; the 11 `chris@…co` hits are the
intentional Reply-To).

**CSP was pre-verified rather than left to post-deploy.** Every browser-loaded
origin is already allowlisted: `supabase.co` + `www.paypal.com` on `/checkout`,
`s3.tradingview.com` + `www.tradingview-widget.com` on `/gold-services`. The
pending batch introduces no new external origin, so the enforcing CSP is safe —
which resolves the "verify after deploy" note at `netlify.toml:168`.

⚠️ **Local checkout loads a LIVE PayPal client ID** from `.env.local`
(`AamwcjQe…`). Do not click PayPal buttons on localhost — it can create real
orders.

⚠️ **Build-verification caveat:** local Node is **v24.16.0** while Netlify pins
**NODE_VERSION = "20"** and `package.json` declares no `engines`. Local green
builds are therefore strong but not identical to the production build.

## 🔴 DEPLOY BLOCKS A LIVE SECURITY FIX

**Any hidden product is currently readable on production by appending
`?returnTo=/admin` to its URL.** No session required. Reproduced on all three
archived products; `?returnTo=/account` works identically, and `draft` /
`pending_payment` items are equally exposed. Found by the Deep Field team in a
port of this code.

Fixed in the working folder and verified anonymously — bare, `?returnTo=/admin`
and `?returnTo=/account` all 404 for hidden products, visible products
unaffected — but **the fix is undeployed, so the hole is live.**

This is the highest-priority item in the current batch. Full detail in
CHANGELOG; the durable rule is in DECISIONS under *"A query parameter is never
an authorization signal"*.

- ◻️ **After deploying, re-verify against production:**
  `curl -o /dev/null -w "%{http_code}" "https://naplesestatejewelry.com/shop/test-item-111-131?returnTo=/admin"`
  must return **404**, not 200.
- ◻️ **Consider shipping this alone.** The current batch also carries marketplace
  fixes, an integration change, and UI work; a security fix is easier to attribute
  and roll back on its own.

## 🔴 Contact Address Moved To .com — TWO THINGS TO VERIFY

The public contact mailbox changed `info@naplesestatejewelry.co` →
`info@naplesestatejewelry.com` sitewide (owner, 2026-08-08), reversing the
mailbox half of the 2026-08-01 split. Six occurrences in five files: footer,
account dashboard, root JSON-LD, per-city JSON-LD, and the order-notification
default.

- 🔴 **OWNER: confirm `info@naplesestatejewelry.com` actually receives mail
  BEFORE this deploys.** The `.com` root MX points at Google Workspace (5
  records verified live), so the domain is accepted — but the `info@`
  mailbox/alias must exist on `.com` in Workspace or every customer inquiry
  bounces. Send a test message to it from an outside account and confirm it
  lands. This cannot be verified from the code side.

  Blast radius if it does not exist: the footer and account-page addresses are
  the primary "contact us" path, and **new-order notifications go to this same
  address** (see the bug below), so a missing mailbox loses both customer
  inquiries and order alerts, silently.

- ✅ **BUG FIXED 2026-08-08: the order-notification override never worked.**
  `order-owner-notification.ts` read `ORDER_NOTIFICATION_EMAIL` (set nowhere)
  while every environment configured `ORDER_NOTIFY_EMAIL` (read by nothing), so
  the owner's chosen address was silently ignored and the hardcoded default was
  always the live recipient. Invisible at runtime — a valid default is
  indistinguishable from a working override.

  `ownerNotificationRecipient()` now accepts **both** names, so the mismatch
  cannot recur, and warns if both are set and disagree. 8 regression tests.
  **Do not narrow it back to one name.**

  `ORDER_NOTIFY_EMAIL` was removed from `.env.local` deliberately: once the code
  started reading it, that previously-dead variable would have become live and
  silently redirected order alerts to a personal `@aol.com` inbox — the opposite
  of the `info@` consolidation. Removing it keeps the destination unchanged.

  ⚠️ **OWNER: delete `ORDER_NOTIFY_EMAIL` from Netlify too** (all deploy
  contexts) if it is set there. Local is done; Netlify was not reachable from
  here. Leave it set only if you deliberately want order alerts at that personal
  address instead of `info@naplesestatejewelry.com` — it now genuinely works
  either way, which was not true before.

- ✅ **Marketing Reply-To also moved (2026-08-08):**
  `chris@naplesestatejewelry.co` → `info@naplesestatejewelry.com` in
  `marketing.ts:181`, `MarketingComposer.tsx:201`,
  `MarketingSettingsPanel.tsx:110`. Verified live before changing:
  `MARKETING_CHRIS_REPLY_TO` unset and `marketing_settings` has no
  sender-profile columns, so the hardcoded value was the real Reply-To.
  **No `@naplesestatejewelry.co` address remains in shipped code** — zero in a
  clean production build.

  ⚠️ This raises the stakes on the mailbox check above: `info@…com` is now the
  destination for footer inquiries, account-page inquiries, order notifications,
  AND marketing campaign replies. One missing mailbox breaks all four.

- ✅ **Marketing FROM also moved (2026-08-08):** campaigns now send from
  `Chris at Naples Estate Jewelry <info@naplesestatejewelry.com>`
  (`marketing.ts:183`, `MarketingComposer.tsx:198`,
  `MarketingSettingsPanel.tsx:107`). Display name deliberately stays personal.
  Safe because the address is on Resend's verified `.com` sending domain.
  **No `chris@` address remains in shipped code** — zero in a clean build.

  ⚠️ **`info@…com` is now BOTH the From and the Reply-To for campaigns**, on top
  of footer, account page, order notifications, and JSON-LD. Bounce handling for
  campaigns now lands there too. The mailbox check above is the single point of
  failure for the entire email surface.

## ✅ Fixed From The 2026-08-08 Pre-Deploy Audit

- ✅ **Owner's personal `@aol.com` address no longer ships in the public client
  bundle — FIXED 2026-08-08.** `ADMIN_EMAIL` was imported by a client-side module
  (`carouselData.ts`'s `isCurrentUserAdmin()`), so the literal address compiled
  into the browser bundle where it was readable by anyone viewing source.
  `isCurrentUserAdmin()` now reads `profiles.is_admin`; the constant is deleted.
  Verified: **0 occurrences in `.next` at all**, and a value-based scan of all 71
  client chunks against all 36 server-side keys reports `ORDER_NOTIFY_EMAIL`
  clean. (`SITE_URL` and `EMAIL_FROM` still match by value and are public by
  definition — the site's own domain and its `noreply@` sender.)

  ⚠️ **OWNER: confirm the carousel panel still loads.** Sign in and open
  **Admin → Settings → Store Carousel Hero**. It should render the curation
  table, not "not authorized". This is the one behavior I could not verify —
  it needs an authenticated admin session and I have no credentials.

  If it shows "not authorized", the account's `profiles.is_admin` is not `true`
  — check that row rather than reverting; the server page gate uses the same
  signal, so you would not have reached the page at all.

  Untouched on purpose: `carousel/sql/setup.sql:24` still hard-codes the email in
  `is_carousel_admin()`. That is database-side, never reaches a browser, and
  remains the real enforcement for every write.

## Deep Field Gallery Sync

**LIVE.** Bulk import complete against production, live hooks armed and proven.
See `features/deepfield-sync.md`.

- ✅ **Production import done and reconciled (2026-08-08).** 128 products / 974
  images, 67 requests, all HTTP 200, 0 failed. 128 sent, 128 acknowledged, 0
  missing, 0 unexpected, 0 id remapping.
- ✅ **Netlify env vars set on the NEJ project** — `DEEPFIELD_SYNC_URL` and
  `DEEPFIELD_SYNC_TOKEN`, Builds/Functions/Runtime, all 5 deploy contexts. No
  `DEEPFIELD_SYNC_DRY_RUN` exists, so nothing is silently no-op'd.
- ✅ **Live hook proven end to end.** A product saved in admin logs
  `[deepfield] synced 1 product(s)` and the receiver returns 200.
- ✅ **`.env.local` points at PRODUCTION Deep Field** (not the local receiver),
  so dev writes propagate exactly like production. Deliberate — dev shares
  production Supabase, so a dev save is a real product change and must not
  silently skip the partner.

  ⚠️ **Consequence: no environment writes to a sandbox.** Every save from
  anywhere is real. Set `DEEPFIELD_SYNC_DRY_RUN=true` in `.env.local` if a safe
  one is ever needed — it exercises the whole path and tells the receiver to
  validate and discard.

- 🔴 **UNDEPLOYED and waiting on the next deploy:**
  - the **archived-product push** (`status: 'archived'`), so archives currently
    reach Deep Field only by vanishing from the reconciliation feed;
  - **`image_count`** in the reconciliation feed — Deep Field's reconciler is
    built, forward-compatible, and reports `imageCountComparable: false` until
    it ships;
  - the **`returnTo` visibility fix** (see the security block at the top).
- ◻️ **Deep Field side, not yet running in production:** their hourly
  reconciliation cron is written and tested but undeployed; they poll manually.
  Until it runs, hard deletes and dropped pushes depend on someone remembering.
  Their first manual run found real drift — `test-item-111-131` displaying as
  available after being archived here — which is exactly the class the push
  cannot cover.
- ✅ **Deep Field confirmed on their side:** zero duplicate storage objects
  (content-addressed paths with `upsert: true`, so the 2–3× re-sends were
  provably idempotent); pricing computed live from `pricing_multiplier` with the
  sold lock holding; 128 rows matching; `jewelry_type` free text and hex
  `image_padding` both accepted; the 9-image spoon complete.
- ◻️ **`deleted_at` tombstone: withdrawn, do not build.** Deep Field checked
  whether the archived-vs-hard-deleted distinction drives different behavior on
  their side; it does not — absence produces "hide" either way. Reconciliation
  by absence already covers both.
- ◻️ **Re-measure the image-copy budget after Deep Field deploys.** Their
  concurrency change (sequential → 6 parallel) is not live yet, so the 19-image
  timings taken so far (cold 21.1s / warm avg 11.6s / best 9.1s) measured the
  OLD sequential path. The 18-image budget stays regardless unless a
  re-measurement plus the timeout asymmetry justifies otherwise.

## Next Deployment And Production Smoke

- ✅ **`add-third-lineup.sql` HAS BEEN RUN — verified 2026-08-06** by probing the
  live database (project `evzluixourmsefwdsieu`). No manual SQL is outstanding.
  - `carousel_selection_third` returns **200** for anon SELECT (was absent).
  - `carousel_settings.selection_mode_third` returns **200** and holds its
    `'manual'` default (previously **400 — column missing**).
  - RLS landed correctly: anon INSERT is refused **401 / `42501` insufficient
    privilege**, i.e. the write GRANT was properly withheld from `anon`. Probed
    with a non-existent `product_id` so the FK would have rejected the row even
    had RLS been permissive — the check could not create data.
  - PostgREST schema cache reloaded (the 200s prove it).
- ✅ `add-random-lineup-modes.sql` **has been run** — verified 2026-08-04 by
  probing the live database: `selection_mode` and `selection_mode_alt` both
  return 200, `selection_mode_third` returns 400 (missing). An earlier note
  here claiming it was still pending was stale.
- ✅ **That mode flip has already happened — verified 2026-08-07.** All three
  modes now read `manual` (`selection_mode`, `selection_mode_alt`,
  `selection_mode_third`), so the storefront is drawing the curated 13/10/10
  lineups, not random. The earlier warning here — that the DB held
  `random_gold_jewelry` / `random_silver_jewelry` and the next Save All
  Slideshows would switch them — is spent and has been removed so it does not
  read as still pending. Use the fill buttons to reseed if the random look is
  ever wanted again.
- ✅ `add-second-lineup.sql` was run by the owner (verified 2026-08-04:
  `carousel_selection_alt` exists and holds a 10-item curated Slideshow 2
  lineup that renders on the scroll reveal).
- **Deploy the locally verified batch.** Current local gate: 720/720 tests,
  `npx tsc --noEmit`, full lint, and a 449-page build.
- After deployment, verify these focused surfaces against production:
  - `/admin/social-queues`: seven Eastern choices, responsive row actions,
    individual and selected-row background **Post now**, change/remove
    confirmation, both worker-health summaries, and **Latest Posts** view/
    manage/refresh/comment/removal controls. Confirm both channel headers fully
    collapse and independently reopen their sections. Do not comment, remove,
    or publish merely for QA.
  - One Instagram and one Facebook manager: guided step order, Save & prepare,
    generated card as slide 1 with **NOW AVAILABLE**, exact prepared framing,
    slide viewer arrows, AI opener controls, and wording/photo/both sync.
  - One remotely deleted social post: Refresh status should mark it Removed only
    when Meta confirms absence; an ambiguous read must retain Published.
  - Admin Products at 2100px+: no right-side table gap; Brand expands first.
  - Manage Instagram, Shop, a product, My Account, Admin Orders, and a service
    page at 2000px+: application/grid canvases expand while prose, checkout,
    auth cards, and dialogs remain readable.
  - Purchase panel: on a phone and a tablet confirm the scrap-value and
    based-on-spot tiles sit side by side (never stacked), and that the buy
    buttons form a flush block — one row of four on a wide column, or Add to
    Cart full width above Save/Inquire/Call on a narrow one. Check a sold item
    too (its two buttons stack until the column is wide), and Spanish.
  - Dark-theme product page (one whose first photo is on a black backdrop, e.g.
    `/shop/10k-gold-rope-chain-necklace`): scroll to "You Might Also Like" and
    the reviews band and confirm the card text is dark-on-white and fully
    legible, in both locales. Compare against a light-backdrop product to be
    sure nothing there changed.
  - Product detail two-column fill: open a product at ~1280-1440 and confirm
    column 1 reads gallery → Notes → the three policy accordions while column 2
    reads price panel → description → Specifications, both columns ending
    together, clear blank space before the three trust icons, and the icons
    spanning the full page width. On a phone (below 640px) confirm the stacked
    trust badges AND the three policy accordions are centred, and that at 640px+
    the badges go 3-up while the accordion titles return to the left with their
    chevrons on the right. Confirm the phone layout still reads
    gallery → price → description → specs → notes → policies. Also check one
    ultra-wide screen (2000px+), where the notes/accordions aside should
    instead sit under the info column, and one Spanish product page.
  - Product specifications: confirm a necklace and a bracelet each show a
    **Width** row in mm (Ancho in Spanish) matching their shop-card chip, and
    that a ring/pendant shows no Width row.
  - "You Might Also Like" cards: confirm each shows purity / weight / length /
    width chips matching that piece's shop card, and that a piece with no stored
    width shows only three. The pills must stay on ONE line at every width —
    check a phone (they shrink and sit under the price) and a desktop (they sit
    beside the price) — must never spill outside the card, and within one strip
    must either ALL sit beside the price or ALL sit below it, never a mix. Below
    361px the strip should show one card per row at full title/pill size.
  - Homepage carousel backdrops: confirm black-backdrop photos render as solid
    rounded black cards with no white bars or square photo corners, and that
    the hero's swept background now goes dark as those pieces come round
    (expected — the sweep follows the same per-photo colour).
  - Product gallery/lightbox: no clipped thumbnail border or wrap stutter.
    Confirm the hover/touch magnifier is gone everywhere, that tapping a
    prev/next arrow on the main photo changes the image WITHOUT opening the
    lightbox, that clicking the photo itself still opens it, and that a vertical
    swipe starting on the photo scrolls the page on a real phone. The arrows are
    now narrow full-height bars hugging each side, present only from 768px up.
    On a real PHONE confirm there are no bars and that swiping the photo changes
    it (left = next, right = previous), that a vertical swipe still scrolls the
    page, and that a tap still opens the lightbox. On a real TABLET confirm the
    bars are there AND the swipe works. On desktop confirm each bar
    fades UP as the cursor approaches that side (independently — the far bar
    stays hidden) and is solid once the pointer is over it, that they are
    permanently
    visible on a phone, legible on both a white-backdrop and a black-backdrop
    product, advance the photo when clicked near the top or bottom of the bar
    rather than on the chevron, and that clicking the middle of the photo opens
    the lightbox rather than catching a bar. Step through EVERY photo of a
    product whose first image is on black: the bars must stay visible as a
    continuous strip on each one, including photos whose backdrop differs from
    the frame's padding colour.
  - `/account/sign-in`, `/account/sign-up`, My Account Change Password, and a
    real reset-password link: every password field uses the shared eye toggle.
  - Redirect smoke: `/shop.html` and `/cart` redirect correctly;
    `/shop/new-listing-04` intentionally 404s because its listing was deleted.
  - Checkout two-column layout, a $5,000+ item, spot refresh, and product
    weight/specs. Confirm the sticky summary rail, Back to cart / Edit cart
    reopening the drawer without losing entered details, the confirmation
    checkbox still gating the PayPal buttons, and Local Pickup hiding the
    required address.
  - Homepage hero parallax stack: text/form/CTAs stay pinned through the
    crossing and hold, only slideshows move, sticky release carries text and
    slideshow away together, scroll-back restores, offscreen pane is inert,
    overlay theme flips with the dominant slideshow, and the reduced-motion
    single-hero fallback works on a real device.
  - Second slideshow lineup: confirm the scroll reveal shows the curated
    Slideshow 2 lineup (and that clearing it falls back to mirroring
    Slideshow 1). Confirm slideshow B's photos flow left-to-right (opposite
    of A) and still cycle through the full lineup.
  - Random fill: on each slideshow tab try Gold jewelry / Silver jewelry /
    Non-jewelry items, adjust the drawn order, then **Save All Slideshows**
    and confirm the homepage shows exactly that saved arrangement (it should
    NOT re-randomize on the next cache refresh).
  - Sold pieces in slideshows (**not yet exercised end-to-end** — verifying
    storefront rendering requires saving a sold piece, a live DB write left
    to the owner): switch the picker to Sold items, add one sold piece, Save
    All Slideshows, and confirm the hero renders it with NO price caption and
    that clicking its card lands on the product page showing Sold. Also
    confirm the All/Available/Sold checkboxes scope both the picker and the
    random fill buttons.
  - **Not verified locally, needs a look:** the hero's matched pane speeds
    (`PANE_A_TRAVEL` at 100). Scroll the homepage and confirm A and B move
    together through the crossing with no gap opening between them.
  - Header height token: page content now starts exactly at the header's bottom
    edge (measured 72/72 desktop, 56/56 mobile) instead of 9px behind it. On a
    real device check a few converted pages — `/`, `/about`, `/faq`,
    `/checkout`, `/contact` — plus the hero pin and the mobile menu panel's
    scroll height. Mobile page tops sit 8px higher than before (56px reserved
    vs the old 64px) because the reservation now matches the real 56px header.
- Reconfirm that production build and development server are never writing
  `.next` concurrently; stop local dev before a manual production build.

## Checkout, Tax, Orders, And Email

- **Complete accountant review before changing tax.** Keep the current 6%
  Florida-only policy. Review destination county rate lookup, Florida's
  per-item $5,000 discretionary-surtax cap, registered nexus states, estimate
  wording, and PayPal jurisdiction cases.
- **Run the controlled PayPal matrix** in the configured environment: create
  retry, successful/declined/ambiguous capture, local-finalization retry,
  duplicate webhooks, two-buyer race, partial/full/idempotent refunds,
  pending/failed refund states, locked shipped address, Local Pickup, invoice,
  guest confirmation, and receipt history.
- Verify one shipped PayPal order retains the exact approved shipping address
  and one Local Pickup order omits shipping.
- Verify Available → Sold → Available sold-price locking on a deliberate item;
  separately review the three legacy manually sold rows without order snapshots.
- Print one invoice on the affected physical laser printer.
- Verify shipment carrier/tracking save plus fulfillment email, paid/manual
  invoice rows, automatic/manual Email History, order restore/permanent delete,
  Reopen Order, and Messages recycle-bin behavior.
- Verify production inquiry/contact/free-evaluation uploads and Resend delivery,
  including Spanish public notes and image attachments.
- Verify duplicate sign-up and reset-password redirects against production
  Supabase Auth settings.

## Etsy And eBay

- **🔴 OWNER ACTION — apply the new shipping policies to the 123 flagged eBay
  listings, in batches, from the deployed admin.** The 2026-08-01/02 tier
  policies (`252701344026`–`252701350026`) are part of the eBay content hash, so
  every listing created before them is correctly flagged `out_of_date`; the
  daily price push can never clear it because it only sends price/quantity
  (`bulkUpdatePriceQuantity`, [sync.ts:1443](next-app/src/lib/ebay/sync.ts:1443)).
  Only a full offer update carries `fulfillmentPolicyId`. The real campaign is
  **86 items ≈ 4 runs** of the capped bulk sync (87 available listings are
  flagged; #82 is write-blocked). Sequence: sync **one** item from its product
  drawer first, confirm on eBay that the shipping shown is the new tier, then
  run Sync all to eBay once per batch, spot-checking between runs. Guards now
  enforce the cautions automatically — see `features/ebay-sync.md`.
- ✅ **Sold-hidden freshness bug fixed** (was listed below as open). The scan
  hashed `hidden_oos` rows, so the new tier policy flipped all 36 sold-and-
  hidden listings to `out_of_date` — that is why the count read 123 instead of
  the expected ~90. `resolveFreshnessScanAction` now skips any non-available
  product and repairs the mis-flagged rows back to `hidden_oos`. **Repair runs
  automatically on the next freshness scan** (any `/api/admin/ebay/eligibility-
  summary` load, i.e. opening the eBay bulk-sync modal) once this is deployed;
  no manual SQL. Verified by dry run 2026-08-04: all 36 qualify
  (`last_pushed_qty === 0`), leaving 87 `out_of_date`, all available.
- Two available products have no `ebay_listings` row at all (90 available
  products, 88 linked). Confirm that is intentional (never listed) rather than a
  dropped link.
- ✅ **Daily price pushes diagnosed and fixed 2026-08-08** (full write-up in
  CHANGELOG). Summary of what changed and what is now true:
  - The Netlify schedules were never broken — Etsy 7:15 a.m. EDT, eBay 7:45 a.m.,
    both deployed, both cron secrets present. They had simply **never run**: zero
    `scheduled_price_push` rows ever, in a log that records even skips.
  - `ebay_connection.price_push_enabled` was `false` (column default). Owner
    enabled it via the admin toggle.
  - **Sold products were permanent price-push candidates on eBay** — their
    listing stays `out_of_date` while the eBay offer is already withdrawn, so
    every push was a guaranteed HTTP 400. Candidate pool now **124 → 88**.
  - `error_count` never incremented (the failure path passed a no-op `{}`
    patch), so nothing could back off — 33 broken listings produced 139 error
    rows in one run. Now increments, resets on success, ceiling of 3.
  - Failure logs discarded `err.detail`, which is why 140 rows all read
    `eBay API error (HTTP 400).` with no cause. Now persisted for both providers.
  - Etsy had the same three defects but is clean in practice because auto-delist
    moves sold listings to `delisted`, outside the selection. Fixed anyway — that
    protection is a side effect of another code path, not its own planner.
- 🔴 **DEPLOY BEFORE THE NEXT 7:15/7:45 a.m. EDT RUN.** These fixes are in the
  undeployed batch. Production still has the old code, so eBay's first scheduled
  run will repeat the ~33 guaranteed failures. Etsy is unaffected either way.
- ◻️ **After the first real scheduled run, confirm both sync logs** — expect an
  `scheduled_price_push` row per provider (the first ever) and, for eBay,
  roughly 88 eligible with 0 failures.
- ◻️ **`antique-georgian-…-82` needs manual repair on eBay.** Held back by
  `isEbayWriteBlocked` — relisted manually and no longer attached to the
  app-managed offer. It is the one genuinely stale price: **$861.29 stored vs
  $984.82 target**. Cannot be fixed from the app; reattach it on eBay.
- **Verify the Admin Settings last-run card** after that first scheduled run.
- **Verify one tier-shipped listing per marketplace.** On eBay, let a boundary
  change flag the listing `out_of_date`, review-first publish one update, and
  confirm the fulfillment-policy charge. On Etsy, Sync Updates on one listing
  and confirm the expected tier profile plus `shipping_tier` log action.
  Provisioned policy/profile IDs are recorded in
  `features/shipping-tiers.md`.
- ✅ Fixed 2026-08-04: the eBay sold-hidden freshness scan no longer hashes a
  `hidden_oos` sold item into `out_of_date`, and repairs rows it previously
  mis-flagged. Covered by three `resolveFreshnessScanAction` tests. Confirm the
  repair landed after deploy: sold pieces should read Hidden, not Out of date.
- Keep eBay inventory #82 / listing `800354878200` write-blocked until an
  owner-approved reattachment or end-and-republish migration is tested against
  stored offer `204558136011`. This is now enforced in code by
  `EBAY_WRITE_BLOCKED_PRODUCT_IDS`
  ([sync.ts:62](next-app/src/lib/ebay/sync.ts:62)) — removing that entry is the
  only way to unblock it, and it must not be removed before that migration is
  tested.
- Complete the remaining controlled checks: publish eBay #83/#84 only if
  desired, never blanket re-sync, never sync sold #6, and observe Etsy's fixed
  cumulative image counter on the next genuine image upload. The first two are
  now mechanical: `EBAY_BULK_ENQUEUE_LIMIT = 25`
  ([guards.ts:12](next-app/src/lib/ebay/guards.ts:12)) bounds every bulk run,
  and `enqueueProducts` drops non-available products before queueing.
- Only after fresh confirmation, perform the scoped eBay account-deletion event
  scrub. Re-run the dry count, update only the audited event type, and prove no
  `payload.notification.data` identifiers remain. This is destructive database
  work and must follow the backup/dry-run rules.
- Resolve the remaining provider-spec verification notes documented in
  `features/etsy-sync.md` and `features/ebay-sync.md`; fail closed when a live
  provider contract is unknown.

## Instagram And Facebook

- After deployment, re-prepare one product per channel so new card/caption/
  framing behavior is proven on fresh renditions. Review only; publish solely
  when the owner intends a public post.
- Before Meta's reported **2026-10-31** Facebook data-access limit, derive and
  validate a replacement Page token through Settings. Rotation must preserve
  the old credential until the replacement passes app, Page, read-access, and
  lifetime checks.
- Delete the 2026-08-01 Instagram test post for item 21 manually if it is still
  live (`instagram.com/p/Dbf7lhNoN-T/`), then use **Already removed on
  Instagram** or Refresh status to reconcile local state. Instagram's API
  cannot delete it.
- Reset item 21's test lineup if desired; verification left 8 of 9 images and a
  promoted cover. Nothing depends on that arrangement.
- Wire the existing idempotent `markPostSold()` helper into the
  Available → Sold transition only after a controlled live test.
- Add social out-of-date detection. Instagram changes must flag the owner to
  delete/forget/re-prepare rather than claiming API deletion is possible.
- Consider bulk social queueing only if the per-product, review-first flow proves
  too slow in practice.
- Treat AI on-model imagery as an optional research project: run the fidelity
  bake-off and decide disclosure policy before writing implementation code.

## UX Backlog From The mels-treasures.com Review (2026-08-04)

> Owner-requested competitive review; recommendations only, no code yet.
> Priorities the owner explicitly named: on-product shipping/returns
> dropdowns and "sustainably sourced" trust messaging.

- ✅ **Product page accordions + trust strip** — DONE 2026-08-04
  (`ProductTrustSections.tsx`: Shipping & Returns / Condition & Wear /
  Payment Options accordions plus the Sustainably Sourced / Fully Insured /
  Local Pickup badge trio; see CHANGELOG). Production smoke: open one product
  page per locale and expand all three accordions.
- ✅ **Name the trade-in program** — DONE 2026-08-04. `/trade-in` (Gold &
  Silver Trade-In Program), localized, in the sitemap, linked from the Sell
  menu, footer, and every product page's trade-in line ("How it works").
  Production smoke: load both locales and click through from a product page.
- ✅ **Customer reviews/testimonials** — DONE 2026-08-04. (Correction: the
  homepage already showed three real Google reviews; the review's "we display
  none" was wrong.) The reviews now live once in `src/lib/testimonials.ts`
  and render on the homepage and as a compact band on every product page via
  the shared `TestimonialsSection`. To add a review, append a verbatim entry
  to that file — never invent or paraphrase a quote. **Google review text
  cannot be fetched from here** (the browser pane blocks google.com, Maps
  renders reviews client-side so WebFetch sees nothing, and search returns only
  paraphrases) — ask the owner to paste the text and reviewer name, and whether
  Google badges them a Local Guide. The grid is pinned to 1/2/4 columns and so
  assumes an EVEN count; a fifth review will need that ladder revisited.
  Currently four (Cristian Reatiga added 2026-08-05). Per-product reviews
  remain a possible later step.
- **Spanish review translations want a native-speaker check**, including the
  newest (`Cristian Reatiga`). The English is the customer's own wording; the
  Spanish is ours.
- ✅ **Related items ("You might also like")** — DONE 2026-08-04.
  Same-category available pieces, same-type-first ranking, lean query, lazy
  images, spot-computed prices. Production smoke: open a product page in both
  locales and click a related card.
- **Admin reorder needs one live verification:** the drag-reorder write was
  changed from upsert to UPDATE-only after a live "null value in column
  title" failure (2026-08-04, see CHANGELOG). Reload Admin Products and
  perform one drag; expect "Inventory order saved" — possibly with a note
  that N listed items no longer exist, which means reload to refresh the
  list. While there, confirm the new edge auto-scroll with a real mouse drag
  (hold a row above the top of the table; it should run up to the beginning).
- ✅ **Homepage story + education + FAQs + announcement bar** — DONE
  2026-08-04. Meet the Owner (chris.webp + story), Why Buy Estate Gold?,
  four FAQ accordions linking to /faq, and a static announcement bar at the
  top of the homepage content (not the fixed header — its 4rem height is
  load-bearing). Production smoke: load both locales, open an accordion, and
  confirm the bar shows two items on a phone, three from 780px, and stays on
  ONE line at every width in BOTH locales (Spanish is the tight one).
- **Cart add-on/upsell (optional):** Mel sells a $29 tarot add-on and shows a
  cross-sell strip in the cart. A local-flavor equivalent (gift wrap,
  handwritten appraisal card) plus a "Discover something new" strip is a
  possible later experiment.
- **Keep (already at parity or better):** single-page checkout shape, guest
  checkout, insured shipping tiers with clear method descriptions (clearer
  than Mel's tariff prose), live spot pricing + scrap value (unique to us),
  INQUIRE/CALL direct-contact actions, "Taxes/shipping calculated at
  checkout"-style transparency (ours shows real numbers earlier than theirs).

## Business, Content, And Operations

- Complete Google Business Profile video verification; duplicate draft profiles
  are already removed.
- Have owner/counsel review Privacy, Terms, Returns/Refunds, Shipping,
  Accessibility, and cookie disclosures.
- Confirm Resend sending-domain SPF/DKIM and intended From identities.
- **🟡 Resend `.co` → `.com` migration — DONE in Resend, GoDaddy, and code.
  BLOCKED ON DEPLOY, and email is DOWN until then.**

  Completed 2026-08-05: `.co` deleted (owner), `.com` added and **Verified**
  (id `bd08d8e7-ca8d-47a5-b28e-d8d608cd772c`, us-east-1), three DNS records
  added at GoDaddy and confirmed against the authoritative nameserver, and every
  hardcoded From address moved to `.com`. Full detail in CHANGELOG 2026-08-05.
  Verified: `npx tsc --noEmit`, `npm run lint`, `npm run build` all clean.

  **Remaining, in order:**

  1. **DEPLOY.** Production still runs the old code, which sends from `.co` — no
     longer a verified domain, so **all outbound email is failing right now**.
     This is the whole outage. Checkout still works (`order-finalize.ts`
     catches; `order-owner-notification.ts` never throws); missed receipts
     re-send from Admin → Orders.
  2. **Check Netlify env for stale `.co` sender overrides.** `lib/marketing.ts`
     reads `MARKETING_NOREPLY_FROM`, `EMAIL_FROM`, `RESEND_FROM`, and
     `MARKETING_CHRIS_FROM` *before* the code default. A `.co` value in any of
     them still breaks marketing sending after deploy. Netlify is authoritative;
     `.env.local` is stale and cannot answer this.
  3. **Test send + inbox check — mandatory, not optional.** DMARC is at
     `p=quarantine`, so a DKIM/alignment problem lands mail in spam *silently*
     rather than erroring. Submit the contact form and confirm the mail reaches
     the inbox, not the spam folder. Owner-owned (live testing is post-deploy).

  **Deliberately not done, owner's call:**

  - **Tracking metrics not re-enabled.** `.co` had click/open tracking on, but
    Resend now implements it as a `links.` tracking subdomain that redirects
    every link in every email — receipts included — through it, plus another DNS
    record. That is a behavior change beyond a domain swap.
  - **Resend webhook still registered on `.co`** and still Enabled; it survived
    the domain deletion because webhooks are account-level. It keeps working:
    `netlify.toml:78-81` serves `.co/api/*` as a **200 rewrite, not a redirect**.
    Re-registering on `.com` is optional cleanup.
  - **Contact/display addresses stay on `.co`** (footer mailto, account
    dashboard, schema.org `email`), as does **Reply-To** for marketing
    (`chris@naplesestatejewelry.co`) — live mailboxes, and not senders, so the
    verified-domain constraint does not apply to them.

  Supersedes the 2026-08-01 DECISIONS entry that email stays on `.co`: the
  *sending* domain is now `.com`; the *mailboxes* are unchanged.
- Complete `CLIENTS.md` unknowns: Netlify site ID, service/dashboard owners,
  password-manager references, maintenance scope, billing status, and production
  Supabase Auth redirects.
- Resolve duplicate live inventory #21 if it still exists.
- Decide whether root `banner.png` should replace the current eBay banner after
  removing every off-eBay website/contact reference. Do not publish either
  banner until policy-safe.
- Native-speaker review of Spanish marketing/product/legal copy remains useful.

## Deferred And Optional

- Phase 2 high-value shipping: evaluate Parcel Pro, JM Shipping Solution, or
  FedEx Declared Value Advantage after owner quotes/account setup. Until then,
  retain the documented USPS Registered Mail rules for $5,000+ shipments.
- Finish Cloudflare Stream deployment only when video is a priority: configure
  the four documented Netlify variables, reconcile the webhook, run the device
  matrix, and validate one controlled Etsy/eBay MP4 before enabling marketplace
  video writes.
- Migrate remaining legacy local-only product photos to Supabase Storage and
  optionally optimize the remaining near-guideline assets.
- Add a localized catch-all only if Spanish 404 body localization is worth the
  extra route; existing 404 metadata/noindex behavior is correct.
- Add `OPENAI_API_KEY` only if server-generated read-aloud is desired; device
  speech remains the fallback.
- Revisit ESLint 10 only when the stable Next lint stack supports it. Keep the
  production audit clean and do not force an incompatible dev-only upgrade.
- Profile Admin Products virtualization only if production timing shows the
  current table is slow. Consider moving dependencies outside OneDrive only if
  synchronization overhead remains material.
- Evaluate Next.js 16.3 when stable, add analytics only with consent/policy
  updates, expand catalog categories as inventory warrants, and revisit a keyed
  metal provider only if production traffic justifies it.

## Recently Completed

- **2026-08-04:** each hero slideshow gained a Manual / Random gold / Random
  silver item-source radio in Admin Settings. Random modes draw
  `RANDOM_LINEUP_SIZE` (10) available pieces of that `products.category`
  server-side on each cache rebuild; curated lineups are preserved beneath
  the toggle. Pending: the manual add-random-lineup-modes.sql run flagged
  above.
- **2026-08-03:** the second hero slideshow gained its own admin-curated
  lineup (twin table `carousel_selection_alt`, Slideshow 1/2 tabs in Admin
  Settings, Save Both Slideshows) with mirror-fallback when empty, plus a
  deferred mount so initial page load carries exactly one carousel. Pending:
  the manual add-second-lineup.sql run flagged above.
- **2026-08-03:** the homepage hero became a scroll-pinned two-slideshow
  parallax stack, then refined so the headline/sign-up/CTA overlay
  (`HomeHeroOverlay`) stays pinned while only the slideshows (`HomeHero`
  panes) cross in opposite directions, hold, and break free with the frame.
  Verified locally (tsc, lint, 702/702, 445-page build, browser walkthrough
  desktop + mobile).
- **2026-08-03:** Instagram and Facebook inside **Latest Posts** now collapse
  independently from their full-width accessible headers, leaving a compact
  count-and-chevron row while the hidden channel is out of the way.
- **2026-08-03:** Social Queues gained a **Latest Posts** modal for the 12 newest
  live receipts per channel, with view/manage links, conservative refresh,
  public comment composition, confirmed Facebook deletion, and manual
  Instagram-removal guidance.
- **2026-08-03:** Social Queues now supports independent Instagram/Facebook row
  selection and one-confirmation **Post selected now**. Batches publish
  sequentially through the existing receipt-safe channel paths and stop/resume
  at a failed item without repeating completed posts.
- **2026-08-03:** removed the owner-configured daily limit from both social
  queues. Settings, status responses, dashboard copy, and worker scheduling no
  longer expose or enforce a local daily cap; each worker invocation retains a
  25-row safety batch, and Instagram still respects Meta's provider quota.
- **2026-08-03:** documentation cleanup removed 41 superseded planning,
  kickoff, legacy-audit, and handoff files. Current Etsy/eBay operator guidance
  was consolidated into the feature runbooks; Instagram and shipping plans were
  reduced to current contracts.
- **2026-08-03:** social queue buttons now keep their content inside a responsive
  two-column grid at 600px/900px, and all scheduling surfaces share seven
  Eastern slots: noon, 2, 4, 6, 8, 10, and midnight.
- **2026-08-03:** social setup copy now says the generated CARD image becomes
  slide 1, eliminating the prior order ambiguity.
- **2026-08-02:** route-persistent background **Post now**, full Social Queues
  dashboard/edit-return path, fixed scheduling, queue-both, guided preparation,
  exact photo framing/crop preview, slide viewer, AI opener controls, cross-
  channel wording/photo sync, conservative status refresh, and Facebook
  interrupted-publish recovery were completed locally.
- **2026-08-02:** Facebook app secret was configured in local and all Netlify
  contexts; a Page token passed same-Page, read-access, app, and lifetime checks.
- **2026-08-02:** Etsy's seven insured-shipping profiles were provisioned after
  its delivery-days fix; eBay's seven policies were provisioned 2026-08-01.
- **2026-08-01:** `.com` became the live primary domain. DNS, redirects, cert,
  environments, external endpoints, sitemap, Search Console, and Change of
  Address were completed and production-verified; email deliberately stayed on
  `.co`.
- **2026-08-01:** all five marketplace/social Netlify functions showed Scheduled
  badges, and core `.com` routes plus legacy-domain redirects were verified.
