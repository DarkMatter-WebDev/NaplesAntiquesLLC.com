# Tasks

> Actionable open work plus a short recent-completions summary. Full history is
> in `CHANGELOG.md`. Last reconciled: **2026-08-09**.

## Deploy-day checklist (reusable)

Standing procedure for every deploy from this folder — the last run of it was
2026-08-08, and the 2026-08-06 sign-off evidence behind it is in CHANGELOG.

1. **Copy this folder to the repo folder and deploy.**
2. **Watch the Netlify build log.** Local builds run on **Node v24**; Netlify
   pins **NODE_VERSION = 20** and `package.json` declares no `engines`.
   Production has built on 20 all along, so risk is low — but a local green
   build is not literally proof of theirs.
3. **If the deploy touches email, test send and OPEN THE INBOX.** DMARC is
   `p=quarantine`, so a DKIM or alignment fault delivers to spam **without
   erroring** — a green "sent" in Resend's log is not the check that matters.
4. **Check for outstanding manual SQL** before deploying. (None is outstanding
   as of 2026-08-09.)

Closed and moved to CHANGELOG — do not re-litigate:

- **2026-08-06 pre-deploy sign-off** (clean-build gate, 38-route production
  smoke, legacy-host single-hop, webhook carve-out 401, email end-state, DNS
  record counts). CHANGELOG 2026-08-06.
- **2026-08-05 `EMAIL_FROM` Netlify blocker** — the marketing sender precedence
  chain read the env var *before* the corrected code default; corrected in all
  five deploy contexts and in `.env.local`. The durable rule (env precedence
  can silently defeat a code-level fix) is in DECISIONS under the email
  entries. CHANGELOG 2026-08-05.

## Standing Local-Environment Warnings

⚠️ **Local checkout loads a LIVE PayPal client ID** from `.env.local`
(`AamwcjQe…`). Do not click PayPal buttons on localhost — it can create real
orders. This matters most when testing on a phone over LAN, where checkout is
two taps from any product page.

⚠️ **Local dev shares PRODUCTION Supabase**, and the Deep Field sync fires for
real from dev (no `DEEPFIELD_SYNC_DRY_RUN` set). Any admin save from a dev
session is a real product change.

⚠️ **Node here is v24; Netlify pins NODE_VERSION 20** with no `engines` in
`package.json`. Local green builds are strong evidence, not proof of theirs.

⚠️ **`npm run build` and `npm run dev` share `.next`, and the dev server does
not survive it.** Running a production build (correctly, with the dev server
stopped) leaves production artifacts in `.next`; restarting dev on top of them
throws `SyntaxError: Unexpected non-whitespace character after JSON` and serves
**500s on every route**. Seen twice — position 746 and 763. It looks exactly
like corrupted `messages/*.json`, and it is not: validate the JSON to rule that
out (it has always passed), then **stop dev, `rm -rf .next`, restart**. The
fix is reliable. The same wipe also clears the separate Turbopack **per-rule
CSS staleness** bug, where one rule in a file updates while another in the same
file keeps serving old declarations — a reload does not fix that one either.

## Verified Healthy — Do Not Re-Audit

Recorded so these are not re-checked every session. All confirmed 2026-08-05
against the **production build** (`next start`), and the deploy that followed
was verified on 2026-08-06/08:

- Server-authoritative checkout pricing with `$0`/negative rejection and a
  stale-spot guard; no `cost_basis`/keys/JWTs in public HTML; rate limits on
  every public endpoint plus honeypots on all three public forms; security
  headers live with CSP **enforcing** (every browser-loaded origin allowlisted,
  which resolved the old "verify after deploy" note at `netlify.toml:168`).
- 46 route/locale combos with no 4xx/5xx; all 23 legacy redirects resolve to
  200 with no soft-404 dead ends; `/p/` shortlinks resolve; the proxy host
  redirect is single-hop on every legacy host and does not loop; `/api/*` never
  redirects; `.co/api/webhooks/resend` returns **401, not 301** (a 301 there
  would break the live webhooks); zero horizontal overflow at 320px; robots and
  sitemap contain zero `.co` URLs; 404s return a real 404.
- Five customer-facing findings from that audit were all fixed and shipped
  (legacy two-hop redirects, homepage heading skip, Spanish chip units,
  product-page 11px floor, wishlist drawer viewport cap). Detail in CHANGELOG
  2026-08-05; the drawer's durable rule is in DECISIONS under *"Always-mounted
  off-canvas panels must cap their width at the viewport"*.
- **`?returnTo=` hidden-product disclosure** — shipped alone 2026-08-08 and
  verified against production (28/28 anonymous probes 404). Durable rule in
  DECISIONS under *"A query parameter is never an authorization signal"*.

## ✅ Contact Address Moved To .com — CLOSED

The public contact mailbox changed `info@naplesestatejewelry.co` →
`info@naplesestatejewelry.com` sitewide (owner, 2026-08-08), reversing the
mailbox half of the 2026-08-01 split. Six occurrences in five files: footer,
account dashboard, root JSON-LD, per-city JSON-LD, and the order-notification
default.

- ✅ **`info@naplesestatejewelry.com` RECEIVES MAIL — owner-confirmed
  2026-08-09.** This was the last open verification on the email surface, and it
  is not verifiable from the code side, so the owner's confirmation is the
  evidence. Do not re-open or re-audit it.

  Worth keeping visible because it does not stop being true: **`info@…com` is
  the single point of failure for the entire email surface** — footer inquiries,
  account-page inquiries, new-order notifications, marketing campaign From *and*
  Reply-To, campaign bounce handling, and both JSON-LD blocks all route through
  that one mailbox. If it is ever deleted or renamed in Google Workspace, all of
  them break silently and at once.

- ⚠️ **OWNER: delete `ORDER_NOTIFY_EMAIL` from Netlify** (all deploy contexts)
  if it is set there. Local is already done. Background: the code used to read
  `ORDER_NOTIFICATION_EMAIL` (set nowhere) while every environment configured
  `ORDER_NOTIFY_EMAIL` (read by nothing), so the override silently never worked.
  `ownerNotificationRecipient()` now accepts **both** names — do not narrow it
  back to one — which means that previously-dead Netlify variable would become
  live on the next deploy and redirect order alerts to a personal `@aol.com`
  inbox. Leave it set only if you genuinely want that. Detail: CHANGELOG
  2026-08-08.

- ✅ Closed 2026-08-08, detail in CHANGELOG: marketing Reply-To and From both
  moved to `info@…com`; zero `@naplesestatejewelry.co` and zero `chris@`
  addresses remain in a clean production build.

- ✅ **Owner's personal `@aol.com` address no longer ships in the public client
  bundle** (2026-08-08). `ADMIN_EMAIL` was imported by a client-side module, so
  it compiled into the browser bundle; `isCurrentUserAdmin()` now reads
  `profiles.is_admin`. Verified 0 occurrences in `.next`. **Owner confirmed the
  carousel admin panel still loads and saves — 2026-08-09**, which closes the
  one behavior that needed an authenticated session. Note
  `carousel/sql/setup.sql:24` still hard-codes the email in
  `is_carousel_admin()` on purpose: database-side, never reaches a browser, and
  it remains the real enforcement for every write.

## Deep Field Gallery Sync

**LIVE.** Bulk import complete against production, live hooks armed and proven.
See `features/deepfield-sync.md`.

✅ Closed and moved to CHANGELOG 2026-08-08 / `features/deepfield-sync.md`:
the 128-product / 974-image production import (reconciled exactly, 0 failed),
Netlify env vars across all 5 contexts, the live hook proven end to end, the
archived-product push, `image_count` in the feed, and Deep Field's own
confirmations (zero duplicate storage objects, live pricing, 128 rows matching).

Still true and worth keeping visible:

- ⚠️ **No environment writes to a sandbox.** `.env.local` points at PRODUCTION
  Deep Field deliberately — dev shares production Supabase, so a dev save is a
  real product change and must not silently skip the partner. Set
  `DEEPFIELD_SYNC_DRY_RUN=true` locally if a safe run is ever needed.
- ⚠️ **Do not normalize the reconciliation feed's timestamp.** The raw
  microsecond `+00:00` form is emitted deliberately (see the pinning comment at
  the emitting line); under a rounding runtime roughly half the catalog would
  compare as permanently stale.
- ◻️ **Deep Field side, not yet running in production:** their hourly
  reconciliation cron is written and tested but undeployed; they poll manually.
  Until it runs, hard deletes and dropped pushes depend on someone remembering.
  Their first manual run found real drift — `test-item-111-131` displaying as
  available after being archived here — exactly the class the push cannot cover.
- ◻️ **`deleted_at` tombstone: withdrawn, do not build.** Absence already
  produces "hide" on their side, so reconciliation by absence covers both
  archived and hard-deleted.
- ◻️ **Raise the image budget 30 → ~50 only after Deep Field supplies the
  timeout line** from their dashboard. Not urgent. (The 18 → 30 retune is in
  the undeployed batch.)
- ◻️ **Pin the production batching defaults.** `IMAGE_BUDGET_PER_REQUEST` and
  `MAX_PRODUCTS_PER_REQUEST` have **no test asserting their values**. The
  batching tests pass budgets in as explicit arguments — correct, because it
  keeps them from silently re-baselining on a retune — but it means changing 30
  to 300 breaks nothing. This is the *policy test* half of the mechanism/policy
  split described in DECISIONS, and it is the same "unenforced claim" class Deep
  Field found in their `{n}/20 photos` label. Fix is three lines in
  `src/lib/__tests__/deepfield-batching.test.ts`:

  ```ts
  it('pins the gateway-safe production budget', () => {
    expect(IMAGE_BUDGET_PER_REQUEST).toBe(30);
    expect(MAX_PRODUCTS_PER_REQUEST).toBe(3);
  });
  ```

  Found 2026-08-09 by re-running the constant sweep; deliberately left undone
  rather than expanded into a session that was closing.

## Next Deployment And Production Smoke

- ✅ **NO MANUAL SQL IS OUTSTANDING.** Every carousel migration has been run and
  verified against the live database (project `evzluixourmsefwdsieu`):
  `add-second-lineup.sql` and `add-random-lineup-modes.sql` (2026-08-04),
  `add-third-lineup.sql` (2026-08-06, RLS confirmed — anon INSERT refused
  `42501`), and `add-slideshow-bg-colors.sql` (2026-08-09, owner-run, colors
  save and render). All three lineup modes read `manual`, so the storefront
  draws the curated lineups rather than random draws.
- 🔴 **REDEPLOY NEEDED — shop-card date collision.** The 2026-08-09 batch
  shipped as `main@27c12e2` and verified clean except for this: on 2-up shop
  cards the `Ca. YYYY` label overlaps the price (measured **-9px** on production
  at 390px, most other cards at 2px clearance). Fixed locally via a container
  query on `.modern-price-row` that drops the "Ca." prefix below 185px of
  content width, leaving the bare year in place; `tsc`/`lint` clean and measured
  across 320/390/472/1280 in both locales with zero negative gaps and no change
  in row height. **The pre-deploy gate is now GREEN:** `npm test` 848/848 and a
  from-scratch `npm run build` (`.next` deleted, dev server stopped) compiled
  successfully at 449/449 pages with no warnings. **This is waiting on a
  redeploy only.** Detail: CHANGELOG *2026-08-09 (post-deploy)*.
- ◻️ **OWNER: supply a real photograph of Chris for the /free-evaluation hero.**
  It currently shows `evaluation-desk-placeholder.webp` — a generated desk shot
  with the face deliberately out of frame, because the copy beside it is first
  person and a recognisable stranger there would imply he is Chris. When the
  real photo lands, replace the file **and** the alt text together (the alt
  text currently describes a desk, not a person).
- 🔴 **Same redeploy carries the /free-evaluation clay marks.** Three trust
  pillars + six category tiles now use matte-clay WebP illustrations
  (`public/assets/images/icons/clay-*.webp`). After deploy, look at the page on
  a real screen in both locales and check the marks read at 72px/56px and that
  the pillar drop-shadow looks right on the cream band. The pipeline and the
  hard-won rules (generate-then-recolour, all-or-nothing per grid, no shadow on
  dark) are in DECISIONS.
  - ✅ **Rolled out sitewide** — the homepage services strip plus `/sell`,
    `/sell/[city]`, `/trade-in`, `/bullion`, `/gold-services` and
    `/silver-services` now use clay marks through `components/ClayMark.tsx`
    (20 marks total). The earlier inconsistency note is closed. After deploy,
    check each of those pages in both locales.
  - ◻️ The large empty placeholder blocks from the audit are still untouched:
    `/estate-jewelry` "Professional Integrity" (726x726 card, 63px icon) and the
    two `/gold-services` cards. Those want photography, not marks.
- 🔴 **Same redeploy carries the icon fix.** Every `AppIcon` was rendering
  filled wherever a legacy `fontVariationSettings: "'FILL' 1"` style survived,
  turning Lucide outline icons into solid blobs (14 of 24 on
  `/free-evaluation`). The bridge is deleted and all 27 usages cleaned; 137
  icons across 10 pages now show only the 2 intentional rating stars filled.
  Four semantic swaps as well (chains, heirlooms, sterling silver ×2, tea
  services). Guarded by two new tests (846 → 848). Detail: CHANGELOG
  *2026-08-09 (post-deploy 2)*.
  - ◻️ **After deploying, look at the marketing pages on a real screen.** The
    measurements prove the icons are no longer filled; whether every glyph is
    the RIGHT one is a judgement call — `redeem` (gift box) for "Sell Jewelry"
    on the city pages is the one remaining choice worth a second opinion.
- ◻️ **Consider raising Netlify `NODE_VERSION` 20 → 22.** Build log for
  `27c12e2` warns every build: `@netlify/plugin-nextjs` cannot execute on the
  pinned 20.20.2, so Netlify runs the plugin on 22.23.1 instead. Builds succeed;
  this is drift, not breakage.
- 🔴 **Same redeploy carries the /free-evaluation hero rework.** Prose
  hierarchy (lede / gold `<h2>` kicker / `<dl>` metal panel / quiet footnote /
  bright closer), wrap groups centred below `lg`, and the eyebrow contrast fix
  (**2.96:1 → 12.19:1** — it was below AA). Detail: CHANGELOG *2026-08-09
  (post-deploy 5)* and *(post-deploy 6)*.
- 🔴 **Same redeploy carries Free Evaluation in the header Sell nav.** The page
  was previously reachable only from the footer. Detail: CHANGELOG *2026-08-09
  (post-deploy 7)*.
- **Deploy the batch. The full gate has passed on the COMPLETE batch** —
  clean from-scratch `npm run build` exit 0 / 449 pages, **848/848** tests
  across 87 files, tsc and lint clean. **Last run 2026-08-10, after the final
  code change**, with the dev server stopped and `.next` deleted. Exact
  figures, the compiled-output spot check, and the email invariant re-check are
  in `CURRENT_STATUS.md`. Nothing needs re-running before you copy and deploy.
- **New surfaces to smoke after the NEXT deploy (2026-08-09 batch), on a real
  phone where marked 📱:**
  - Shop cards 📱: bottom ADD button present on every card; corner cart icon
    (mobile) and header/drawer/checkout icons all render as a CART, not a bag;
    swipe a card photo left/right (dots advance, vertical swipe still scrolls,
    tap still opens the product, a swipe does NOT open it); swipe a second
    card and confirm the first snaps back to its cover; dots float without a
    pill on touch and stay legible on a white-backdrop piece; arrows absent on
    touch, present on desktop aligned with the brand-flag baseline.
  - Hero 📱: flick through the hero — each flick lands on exactly the next
    slideshow, never past it (the momentum override is the one thing synthetic
    touch could not prove); ~1s smooth settle; scrolling out at either end is
    free; desktop wheel behavior unchanged.
  - Hero backgrounds: solid per slideshow, no gradient sweep anywhere; set
    Slideshow 1 black in Admin (its lineup is black-backdrop) and confirm the
    overlay text flips light and the crossing shows a clean color change at
    the midpoint; confirm the admin panel's per-tab background control saves
    without the missing-column warning.
  - Shop card date 📱: confirm the `Ca. YYYY` label is back at the left of the
    price row on a phone, and that it never touches the price or the width
    chip — check a card with a long price and one with no width chip.
  - Hero CTAs 📱: on a real phone confirm Buy/Sell sit side by side with Trade
    centred beneath them — never three stacked rows — and that Trade opens
    `/trade-in` (it used to go to `/contact`). Check Spanish too, where
    `Intercambiar` is the long label.
  - Reviews band 📱: on a real phone confirm the client reviews sit TWO across,
    never one, and that the quote text is comfortably readable at that size —
    this is the judgement call the measurements cannot make for you. The long
    reviews now clamp to 8 lines, so all four cards should be the same height.
    Confirm Spanish too, and the band on a product page including a
    dark-backdrop one, since it renders there from the same component.
  - 🔴 **Reviews → Google link: click one card on the deployed site.** Every
    card links to `https://share.google/KAE0mjQwhKx9EqEZ1` (owner-supplied).
    It is an opaque Google redirect and google.com is unreachable from the
    development environment, so **nothing has verified where it actually
    lands** — confirm it opens the Naples Estate Jewelry profile with the
    reviews visible. One constant to change if not:
    `GOOGLE_REVIEWS_URL` in `next-app/src/lib/testimonials.ts`. While there,
    confirm the whole card is clickable (not just the "Read on Google" line)
    on both a phone and a desktop.
  - `/free-evaluation` as a landing page 📱: open it the way a customer will —
    from a TEXTED link on a phone. The form must NOT be the first thing in
    view; the hero should explain the service, and the form lives in the
    "Send a request below" block underneath. Submit one real test request and
    confirm it arrives at `info@naplesestatejewelry.com`.
  - `/free-evaluation` hero hierarchy 📱: the block should read as lede →
    gold kicker → metal panel → footnote → closer, not as one wall of text.
    The three metal terms (GOLD / SILVER / EVERYTHING ELSE) sit in a left
    column that stays aligned from `sm` up; check Spanish, where the terms are
    shorter but the details are longer.
  - Pills centred 📱: the `/free-evaluation` trust chips wrap 2/1/1 on a phone
    and 3/1 on a tablet — every row should look centred, not ragged-left. This
    is the judgement call the measurements cannot make.
  - Eyebrow contrast 📱: "100% Free — No Obligation" should read as a bright
    gold accent, not a dimmed/disabled label. It was **2.96:1** (below AA) and
    is now 12.19:1 — worth confirming on a real screen in daylight.
  - Header nav: **Free Evaluation** now appears last in the Sell dropdown
    (desktop) and the Sell accordion (mobile), after Trade-In Program. Confirm
    both, in both locales, and note that the parent **Sell** tab now highlights
    while you are on `/free-evaluation` — that is intended.
  - Hero perf spot-checks: network tab shows NO raw-original image fetches
    beside the `/_next/image` ones (formerly a full duplicate set), hero
    images at `q=82`, and the loading spinner disappears from the DOM after
    the fade rather than spinning invisibly.
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
    rounded black cards with no white bars or square photo corners. (The
    swept-background half of this check is OBSOLETE as of 2026-08-09 — the
    hero background is now one solid color per slideshow; see the new smoke
    items above.)
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
  - Hero pane seam: `PANE_A_TRAVEL` is **85**, so the arriving pane overlaps
    the departing one by ~15% of a frame. Scroll the homepage and confirm the
    join reads as one continuous move with no band of empty backdrop between
    the two slideshows.
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

- **🔴 OWNER ACTION — apply the new shipping policies to the flagged eBay
  listings, in batches, from the deployed admin.** (The count once read 123;
  the true figure is **86 writable** — see the sold-hidden fix below.) The
  2026-08-01/02 tier
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
- ✅ **Daily price pushes diagnosed, fixed, and SHIPPED 2026-08-08.** Four
  defects: the schedules had never actually run (zero `scheduled_price_push`
  rows ever), `price_push_enabled` was `false` (owner enabled it), sold products
  were permanent eBay candidates producing guaranteed HTTP 400s (pool 124 → 88),
  `error_count` never incremented so nothing could back off, and `err.detail`
  was discarded so every failure logged an unusable message. Etsy carried the
  same defects but is clean in practice via auto-delist. Full write-up in
  CHANGELOG 2026-08-08.
- ◻️ **After the first real scheduled run, confirm both sync logs** — expect a
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
  remain a possible later step. **Column ladder changed 2026-08-09: the grid is
  now 2 / 4, never 1** (owner: minimum 2-up) — the even-count assumption above
  is unchanged. See DECISIONS, *"The reviews band is never one column"*.
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
- ✅ **Resend `.co` → `.com` migration — COMPLETE and SHIPPED 2026-08-08.**
  Domain swapped and Verified in Resend, DNS at GoDaddy confirmed against the
  authoritative nameserver, every sender moved, deployed. Detail in CHANGELOG
  2026-08-05/08.

  ⛔ **Email is now FULLY `.com` — senders AND mailboxes.** An earlier version of
  this section said contact/display addresses "stay on `.co`"; that was reversed
  on 2026-08-08 and is **wrong now**. Zero `@naplesestatejewelry.co` addresses
  remain in shipped code, verified in a clean production build. **Never restore
  a `.co` address.** (Separately and permanently: never touch the `.co` MX
  records — that domain still carries live mailboxes.)

  Remaining, both optional and owner's call:

  - **Click/open tracking not re-enabled.** Resend now implements it as a
    `links.` tracking subdomain that redirects every link in every email —
    receipts included — plus another DNS record. That is a behavior change
    beyond a domain swap, not an oversight.
  - **Resend webhook is still registered on `.co`** and still Enabled (webhooks
    are account-level, so it survived the domain deletion). It keeps working
    because `netlify.toml` serves `.co/api/*` as a **200 rewrite, not a
    redirect** — do not let that become a 301. Re-registering on `.com` is
    optional cleanup.
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

Headlines only — full detail lives in `CHANGELOG.md` under each date.

- **2026-08-09 (undeployed):** shop-card touch overhaul, hero touch snap +
  slower handover, hero performance batch, and one solid background per
  slideshow replacing the per-photo sweep. This is the batch waiting to deploy.
- **2026-08-08 (shipped):** email fully `.com`, `?returnTo=` disclosure fix,
  Deep Field production import + live hooks, daily price-push defects fixed,
  admin email removed from the client bundle.
- **2026-08-06:** pre-deploy sign-off; hero runway compressed and crossings
  overlapped so the handover never stops.
- **2026-08-04:** hero random-fill lineups, product-page accordions + trust
  strip, `/trade-in` page, related-products strip, homepage story/education/FAQ
  blocks, single-page checkout.
- **2026-08-03:** hero became a scroll-pinned multi-slideshow parallax stack;
  Social Queues gained Latest Posts, row selection, background Post now, and
  the seven Eastern slots; 41 superseded planning docs removed.
- **2026-08-01/02:** `.com` became the live primary domain (DNS, redirects,
  cert, sitemap, Search Console, Change of Address all production-verified);
  seven insured-shipping policies/profiles provisioned on both marketplaces;
  Facebook Page token validated.
