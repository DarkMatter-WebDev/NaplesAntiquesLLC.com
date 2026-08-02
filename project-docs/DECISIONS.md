# Decisions

> Current durable decisions only. Superseded experiments and session-by-session
> reasoning remain in `CHANGELOG.md`. Older runbooks that cite a dated
> `DECISIONS.md` "session" or "addendum" should follow the same date/label in
> `CHANGELOG.md`; those historical entries moved there during the 2026-07-23
> compaction. Last reconciled: **2026-08-01**.

## Repository And Memory

### Source-of-truth folder has no git workflow

This folder is the user's repo-ready source of truth. Do not run git commands
here. The user copies it into a separate GitHub working folder manually.

Keep runtime code in `next-app/`, SQL in `supabase/`, and durable project memory
in `project-docs/`. Do not leave temporary reports, archives, logs, or generated
caches in the root.

### Startup memory is a snapshot, not a second changelog

`CURRENT_STATUS.md` describes the present system, `TASKS.md` contains open work,
and this file contains decisions still governing the project. Detailed
chronology belongs only in `CHANGELOG.md`; feature-specific implementation
detail belongs in `features/` or the Etsy/eBay plan folders.

## Application Architecture

### Next.js under `next-app/` remains the only runtime

The old static root site is retired. Root `netlify.toml` builds with
`base = "next-app"` and publishes `.next`. Do not recreate root HTML, scripts,
assets, or Netlify Functions as an alternate runtime.

### Redirects for locale-less paths belong in proxy.ts, not netlify.toml or next.config.ts

On Netlify the next-intl proxy (`src/proxy.ts`) is deployed as an **edge
function that runs before both the Netlify redirect engine and the Next.js
server**. It rewrites every locale-less path to `/en/...`, so a request for a
route that no longer exists 404s before any redirect layer is consulted.
Consequences, learned the hard way on the retired `/auctions`,
`/auction-terms`, and `/vendor-terms` pages (three attempts, 2026-08-01/02):

- `netlify.toml` redirects — including `force = true` — never fire for bare
  English URLs. They DO fire for `/es/*`, which is why a broken fix can look
  half-working and mislead the diagnosis.
- `next.config.ts` `redirects()` never fire either, **but they do work under
  `next dev`** — so a local test will pass while production still 404s.
- The only reliable layer is `proxy.ts` itself, ahead of the locale rewrite
  (see `RETIRED_PATHS`). Normalise `/x`, `/en/x`, and `/es/x` to one rule.

Rule: any redirect for a path the app no longer serves goes in `proxy.ts`,
and is verified **against the deployed site**, never only locally.

### The primary domain is naplesestatejewelry.com; email stays on .co

Owner decision 2026-08-01, after buying the `.com`: the canonical web domain
is `https://naplesestatejewelry.com`. The legacy `.co` remains owned as a
Netlify alias that 301s path-preservingly to `.com` (rules in root
`netlify.toml`), and `naplesantiquesllc.com` redirects straight to `.com` so
old links never hop twice. **The business email deliberately did NOT move**:
`info@` / `chris@` / `noreply@naplesestatejewelry.co` remain the real
mailboxes and Resend sender identities — never rewrite an
`@naplesestatejewelry.co` address to `.com`, and never touch the `.co` MX
records. New site-URL code must build from `NEXT_PUBLIC_SITE_URL`/`SITE_URL`
(falling back to the `.com`), never hardcode either domain.

### Development and production builds never run concurrently

Stop the Next development server before running `npm run build`, then restart
development afterward. Both modes use the same `.next` output tree; allowing a
production build to overwrite it while `next dev` is serving can mix old
server HTML with new client chunks and produce recoverable hydration errors.

### Supabase is the system of record

Products, accounts, orders, inquiries, settings, marketing data, and
marketplace state live in Supabase. Product IDs are durable URL/saved-state
keys. Product schema changes must update SQL, TypeScript contracts, read/write
queries, UI, and docs together.

### Localized behavior remains paired

English and Spanish routes use `next-intl`. Shared strings belong in paired
message files or explicitly paired localized page data. Route metadata, legal
copy, filters, errors, and transactional/customer content must be checked in
both locales.

### UI icons are inline SVG, never ligature fonts

All application icons render through
`next-app/src/components/AppIcon.tsx`, which maps stable semantic names to
direct Lucide React SVG imports. Do not add icon fonts, ligature text,
font-glyph subsetting, or independently cached icon-font assets.

Decorative graphics may be omitted. Functional icons must remain accessible
through surrounding text or control labels. An unknown data-driven icon renders
nothing rather than exposing its identifier, and the icon-integrity regression
test must continue rejecting legacy font infrastructure and unmapped static
`AppIcon` names.

## Product Data And Media

### Product rows store references, not media bytes

Images and videos never belong in Postgres as blobs/base64. New product images
go to Supabase Storage, are downscaled and encoded to WebP, and use immutable
cache headers. Public/list queries select only the columns they need.

Image cleanup is always reference-aware and dry-run-first. A remove/replace/
delete path must clean owned objects, and any new upload destination must be
added to Storage GC reference scanning.

### Product videos use staged direct Cloudflare Stream uploads

The browser uploads bytes directly to a server-provisioned TUS URL. One saved
video is allowed per product. Replacement remains a candidate until Save;
cancel deletes the candidate; permanent remove/delete is provider-first.
Only ready videos are projected publicly, and list queries do not join/poll
video state.

Marketplace video sync stays disabled until a real generated MP4 succeeds in a
controlled Etsy and eBay test.

### Product measurement contracts are explicit

`products.width_mm numeric(8,2)` is nullable and meaningful only for Necklace
and Bracelet. It stores millimeters, must be positive and no more than 1000,
and is never estimated from photos.

New Length writes normalize inch-bearing input to a bare numeric string.
Public matching continues accepting unitless, `in`, `inches`, quoted, and
decimal-equivalent legacy forms.

The AI assistant may extract width/length only from explicit, reliable evidence
and must honor the same storage contracts as manual forms.

## Storefront

### `/shop` is the only storefront entry

Search, filters, view, sorting, per-page, and pagination remain URL-backed.
Categories are explicit merchandising scopes; item types remain navigable
catalog values and may include admin-created custom types.

Public browse shows Available and optionally Sold products. Draft,
Pending Payment, and Archived remain private. Sold-price masking is a display/
structured-data policy and never erases product/order price history.

The public status filter always selects exactly one state. Available is the
default for bare, cleared, or invalid shop URLs; Sold inventory is shown only
after the shopper explicitly selects Sold. Available is the baseline rather
than an extra active-filter count.

### Homepage carousel uses one server-authoritative initial payload

The localized homepage reads `carousel_selection` and `carousel_settings` on
the server and renders that result into the initial HTML. `HomeHero` must not
perform a second client-side selection/settings fetch after hydration. The
read is cached for five minutes under the `home-carousel` tag; successful
Admin carousel saves invalidate that tag immediately. Bundled carousel products
remain a resilience fallback only when the server read fails or returns no
selected products.

### Optimize cards before introducing virtualization

Gallery cards mount one cover initially, lazy-load offscreen content, and mount
carousel neighbors on interaction. Offscreen containment, database pagination,
accurate `sizes`, and targeted priority are preferred before full row/card
virtualization, because virtualization would complicate accessibility, focus,
history, and responsive layout.

### Responsive failures are tested by width and height

The desktop filter sidebar keeps its sticky layout but receives a viewport-
relative maximum height and internal scrolling. Narrow pagination uses a
localized page status; omitted desktop page ranges use ellipses. Customer
controls must remain reachable and free of page-level overflow from 320px
mobile through wide desktop, including short landscape viewports.

## Checkout, Tax, And Payments

### Server pricing is authoritative

The browser sends product IDs/quantities and selections, never trusted amounts.
`checkout-pricing.ts` reloads products and spot data, checks purchasability/
quantity, snapshots item prices, and computes tax, shipping, and total.

`checkout-shipping.ts` is the sole shipping catalog. Fees are value-based
tiers keyed to the order's merchandise subtotal (2026-07-30 owner-approved
plan, `features/shipping-tiers-plan.md`): Local Pickup $0; Standard Insured
$19/$25/$29/$35/$59/$99/$99/$165 across eight bands with USPS Registered Mail
at $5,000+; Express Overnight $55/$79/$119 and not offered at $5,000+ because
USPS insurance caps there. Unknown methods and unavailable methods are
rejected rather than falling back to free shipping or a substituted service.
Every tier must charge above its worst-case postage + USPS carrier insurance
cost — the store never pays shipping out of pocket. The same standard tier
table is the future source for Etsy/eBay shipping via the exported
marketplace scaffold (`getMarketplaceStandardShippingFee`, not yet wired).

### Shipping is U.S.-only and structurally validated

Shipped checkout requires street, city, a canonical U.S. state/D.C., and a
five-digit ZIP or ZIP+4. Country is United States. The server repeats
normalization/validation and rejects tampered or international input.

### Current tax policy is Florida-only

Local Pickup and validated Florida destinations use a 6% rate on discounted
taxable merchandise plus charged shipping. Non-Florida destinations receive
$0 Florida tax. There is no California-specific branch.

Florida county discretionary surtax and other-state nexus collection remain
deferred until accountant review and registration. Existing orders are
historical snapshots and are not retroactively recalculated.

### Checkout is a four-step single-page wizard

`/checkout` flows Order Summary → Delivery (radio cards with live tier fees)
→ Contact & Address → Review & Pay, with a step indicator that unlocks
completed steps and a sign-in-or-guest entry dialog for signed-out visitors
(guest choice remembered per tab). The payment controls (policies,
confirmation checkbox, PayPal buttons) live in the final step so buyers
always see final totals before paying. This is a presentation layer only —
payReady gating, effective-method derivation, capture recovery, and order
reuse are unchanged beneath it. With capture-on-approve, "Place order"
remains PayPal's own Pay Now review; do not add a post-PayPal confirm step.

Financial summaries list tax AFTER the shipping cost (Subtotal → Shipping →
Shipping Cost → FL Sales Tax → Total) so the merchandise-plus-shipping
taxable base is visually obvious.

Server checkout rejections carry machine-readable codes
(`OrderDraftErrorCode`); the client maps codes to precise bilingual guidance
and falls back to message-pattern matching only for uncoded/legacy
responses. New rejection reasons must add a code, not rely on wording.

### PayPal captures on approval with no reservation

PayPal Orders API v2 is the storefront processor. PayPal credentials and
`PAYPAL_ENV` must be one consistent set; the client ID may reach the browser,
while the secret remains server-only.

There is no checkout inventory hold. The first successful capture wins under a
database row lock. Capture evidence is preserved before local fulfillment.
Ambiguous capture is reconciled against PayPal, and buyers are warned not to pay
again when provider success is known or unresolved.

Refunds require deterministic request IDs and the `paypal_refunds` ledger.
Webhook and route retries must be idempotent. A refund does not automatically
restore inventory; restoration is an explicit admin action.

The validated checkout address is authoritative for shipped PayPal orders.
Local Pickup does not request a shipping address.

## Admin And Orders

### Lifecycle changes are explicit

Draft and Archived are non-public. Permanent product deletion is a second,
confirmed step after archive and must clean owned media. Sold price is locked
until deliberate relisting. Manual order lifecycle and explicit inventory
restore must not silently rewrite payment history.

Orders and Messages use recycle bins where supported. Invoices are created
idempotently at order creation and updated to paid after capture. Email history
records the actual From identity separately from the initiating admin/system.

### Admin tables favor working visibility

Admin Products defaults to Available inventory, preserves sticky product
identity and totals inside the scroll viewport, and keeps row quick actions in
page-sized dialogs that are isolated from table layout styles.

On mobile, the compact inline table remains the dashboard preview, but an
explicit **Open Product Table** control must promote that same table into a
full-screen dynamic-viewport dialog. The dialog owns two-axis scrolling, keeps
Close and Escape available, locks background scrolling, and closes if the
viewport reaches desktop size. In the full-screen mobile mode, pin only the
selection edge, product image, and row actions. Inventory number and title must
pan with the statistics, while the image stays visible as the compact visual
identifier for every row. Do not pin the full identity group: it would consume
almost the entire phone. The ordinary tablet/desktop inline table and its
sticky identity columns remain unchanged.

The mobile toolbar pairs **Add Product** with a compact **Open Product Table**
launcher. The launcher may use tighter type, icon, spacing, and horizontal
padding to fit narrow phones, but must preserve its complete label and must not
alter the desktop toolbar. Search belongs at the top of the expanded mobile
Filters panel, not in a permanently visible toolbar row; a non-empty search is
included in the mobile Filters badge. The visible/total count belongs at the
right edge of the table utility row beside Reset/status. Desktop retains its
always-visible toolbar search and count.

The explanatory drag-reorder sentence is desktop-only. Mobile table space is
reserved for inventory and actionable state: retain **Reset view to drag
reorder** when sorting/filtering prevents reordering and retain the saving
status during a reorder, but hide the entire strip when neither is present.

## AI And Bilingual Listing Copy

### Buyer-facing copy excludes seller guesses

Seller opinions, suggestions, unsupported identifications, and uncertainty may
not be presented as fact in title, description, or public notes. Objective
facts and visible markings may be used; unresolved uncertainty remains an
admin-facing warning.

### AI listing refinement is conversational but remains a draft

The open product editor owns the AI conversation. Every turn sends the current
form as the baseline plus a bounded set of prior turns, returns a complete
revised field set, explains changes, and asks only relevant clarification
questions. Current supported values are preserved unless the admin requests a
change or stronger evidence contradicts them.

Conversation state resets when a different Add/Edit editor opens and is not
stored in product rows. AI revisions update only the unsaved form; the normal
Save action remains the sole persistence boundary. The buyer-copy firewall and
explicit-only measurement rules apply on every refinement turn.

### AI review safety is application-enforced

The model prompt is guidance, not the confirmation boundary. After coercion,
the server compares every returned field with the current form. Only a
high-confidence, non-sensitive value added to a blank field may auto-apply.
Every replacement of an existing value, low/medium/missing-confidence value,
and chain, measurement, purity, or pricing fact stays pending until the admin
accepts it. Warnings, uncertainties, and unchanged values without high
confidence generate explicit clarification questions.

Read-aloud is admin-only. The server may use OpenAI's speech endpoint with the
server-held key; the browser falls back to its device voice when unavailable.
The UI identifies playback as an AI-generated voice, and speech is never stored
with the product or conversation.

### Spanish regeneration is explicit and fill-only

The Edit Listing action generates Spanish values only for blank Spanish fields.
It never overwrites retained copy, rejects stale results if source fields change
during the request, and does not persist until the admin saves normally.

## Marketplace Integrations

### Etsy and eBay remain independent channels

Each integration owns its client, mapping, state machine, SQL, routes, settings,
and error handling. Admin bulk entry points are consolidated in the Products
Actions modal, but status checks and Publish All Ready actions are separate per
marketplace.

### Review-first is the default

Selected/bulk work reuses bounded single-item state machines. Preflight and
review occur before publish where supported. Targeted repair/update is preferred
to blanket re-sync.

### Remote lifecycle and local freshness are separate

An active remote listing may still be locally `out_of_date`. Status checks
reconcile remote lifecycle without clearing content drift. Only a successful
content sync refreshes the pushed hash and clears local freshness state.

Price-only drift does not mark content out of date; dedicated price-push actions
handle price changes. Marketplace failures never block storefront cache
revalidation or successful buyer checkout.

### Marketplace writes require a live relevant-metal quote

The storefront may display its explicitly labeled fallback estimate during a
metal-provider outage, but Etsy/eBay writes are durable financial actions and
must fail closed. A spot-priced item can be written only when the spot payload
comes from the live API and contains a positive quote for that item's metal.
Manual-priced items and an already-locked sold price do not depend on live spot.

### Daily marketplace price runs are bounded and observable

Netlify owns one staggered daily scheduled function per marketplace. The
secret-guarded Next routes do the actual work with a fixed time budget,
price-only writes, oldest-row-first rotation, and summary log records. eBay
uses verified batches of at most 25 and isolates a failed mixed batch so one
offer cannot starve later listings. Admin Settings exposes secret readiness and
the latest scheduled result; no new database table is required.

### Etsy queue progress is durable

Bounded image requests retain queue ownership after intermediate states. Normal
and repair drains use separate atomic claims. Progress is cumulative against a
fixed total, and a one-click repair action resumes linked interrupted rows.

### eBay verification follows relists without mutating them

Read-only verification may follow an ended listing to a live relist, but must
not silently attach, end, or republish that external relist. App-side writes
remain blocked until the stored offer/listing relationship is deliberately
reattached.

### An Instagram post is effectively permanent once published

Two hard limits, both confirmed live on 2026-08-01, make publishing a one-way
door and are the reason this integration is review-first:

1. **Captions cannot be edited.** Instagram's API has no update endpoint.
2. **Posts cannot be deleted through the API either.** The Instagram API with
   Instagram Login exposes no media-deletion endpoint; `DELETE /{media-id}`
   returns "does not support this operation". The `instagram_manage_contents`
   permission that can delete posts belongs to the Facebook-Login variant,
   which requires a linked Facebook Page — an architecture we deliberately
   avoid. **Removing a post is a manual action in the Instagram app.**

So the app can create a post but can never take it back. Therefore: nothing
auto-posts (review-first by default, the owner approves each item), a quoted
price is always written as an explicit "≈ $X at time of posting" alongside a
pointer to live site pricing, and a post whose price would come from a fallback
spot estimate is blocked outright — the same fail-closed rule as Etsy/eBay
writes.

`deletePost()` attempts the API delete, detects the unsupported-operation
response, and returns the permalink with instructions rather than pretending to
have succeeded; it deliberately leaves the local record intact so the operator
can still find the post. A separate `forgetPost()` clears local state and
renditions after the operator has deleted it by hand. Any future "out of date"
handling must follow this same two-step shape — the app cannot repost over
something it cannot remove.

Anything that ends up in a caption must be correct the first time. Notably, an
inventory number is written as "Inventory 21", never "Inventory #21":
Instagram auto-links "#21" into a hashtag pointing at an unrelated tag page
(seen on the very first live post, permanently).

Since 2026-08-01, the inventory number stays out of PUBLIC post copy entirely,
on both channels (caption and alt text — `buildPublicSpecLine`, one shared
strip so the rule cannot drift). The piece is identified by the `/p/<inv#>`
short link instead: clickable full URL on Facebook, and a **typeable**
brand-case `Shop: NaplesEstateJewelry.com/p/N` line on Instagram, where caption
URLs are never linkified — a dead `https://` URL there is noise, but a short
brand-case path is something a viewer can retype. Both channels share one
caption structure (hook → title → specs → price sentence, uniform one-blank-line
rhythm, no description body); channel differences are limited to what the
platforms force (link form, CTA wording).

The Instagram content hash deliberately EXCLUDES price. Spot moves daily; if
price were hashed, every live post would flag itself out of date and invite a
delete-and-repost that costs real engagement. Only caption copy and the image
set mark a post stale.

Instagram-specific limits that the mapper must keep enforcing: 10 images per
carousel, JPEG only (the catalog is WebP, so renditions are mandatory), 2,200
caption characters, 30 hashtags, and 100 published posts per rolling 24 hours.

### Instagram renditions are padded squares, and the GC must know about them

Every image in an Instagram carousel is cropped to the FIRST image's aspect
ratio. Rather than let Instagram crop jewelry — clasps, hallmarks and gemstones
sit at the edges — each source image is padded onto a 1080x1080 canvas, which
makes the crop rule a no-op. Renditions are JPEG (Instagram rejects WebP),
content-addressed, and written to the existing product-images bucket under
`instagram-renditions/`.

"Publish to both channels" publishes **Instagram first, always**: Instagram is
the permanent channel (no API delete or edit) with the most failure modes
(publishing quota, async container processing), so an Instagram failure means
nothing has gone out anywhere; Facebook — synchronous, deletable, trivially
retried — publishes second and is skipped with an explicit "not attempted"
result when Instagram failed. Cross-channel curation copying
(`/api/admin/social/copy-curation`) is verbatim-including-nulls ("make the
other channel match this one"), re-validated against current product images,
refused when the target post is live, and invalidates the target's prepared
renditions exactly like a lineup save. Channel curation STORAGE stays separate
(the copy is an explicit operator action, not a sync) — shared storage would
let one channel's re-prepare delete files the other still references.

The card's AUTO-proposed crop **never upscales** (2026-08-01): if the proposed
region cannot fill the card's photo well at native resolution, the full frame
is used instead — composition never justifies blur (`guardProposedCrop`).
Operator-set crops are exempt; they are chosen against a live preview.

The generated card **replaces its source photo** in the prepared slides
(2026-08-01): the card composites that photo full-bleed, so also posting the
standalone copy showed the same image twice in one carousel. The replacement
happens only when the card actually rendered — a card failure keeps every
photo, preserving the photos-are-the-substance degradation rule. A
single-photo product therefore prepares as one card-only slide, which both
publish paths handle via their existing single-image branches.

The pad colour is **sampled from the photo, not assumed** (2026-08-01). It was
hard-coded white, which is invisible on the cream-sweep majority but framed
every black-backdrop photo in white bars — the chains are portrait, so a
pure-black shot got ~92px of white down each side. Corner samples are
composited over white before being averaged, so a background-removed photo
(transparent corners) reports white and therefore agrees with whatever
`flatten()` paints behind it; reading raw RGB there would call it "black" and
pad a white-flattened image in black. White stays the fallback for a
non-uniform frame, where there is no single backdrop colour to match.

### Match the backdrop instead of cutting the product out

The generated ad card paints its background in the source photo's own backdrop
colour, and the crop-proposal and card share that measurement.

The alternative — chroma-keying the product and compositing it onto a fixed
dark card — was built and rejected. It forced a distinction that does not
reliably exist: the studio drop shadow is near-neutral and only ~10-35
luminance below the sweep, so separating it from genuine dark detail (the
crevices between links) needed per-image threshold tuning, punched holes
through polished metal, and failed outright on sterling against cream, where
7-12% of the piece sits within 25 luminance of the backdrop.

Matching the backdrop removes the problem rather than solving it. The shadow
lands on the surface it was cast on, so no matte is needed, and one code path
serves both sweeps. Product pixels are only ever cropped, scaled and placed —
never redrawn — so the piece cannot drift, which is the same guarantee that
keeps generative approaches off the table for listing imagery.

Two consequences worth keeping:

- **Feather any crop that is tighter than the backdrop.** A crop sitting on
  bare backdrop joins the card invisibly, but a tighter one necessarily cuts
  through whatever the piece rests on. The black velvet bust reads rgb(3,3,3)
  against a rgb(0,0,0) card, and three levels along a long straight edge shows
  as a rectangle. The alpha ramp is a no-op in the first case, so it is always
  applied.
- **Saturation-based cropping is for dark backdrops only.** It frames the metal
  and ignores the neutral prop, which is what a chain on a velvet bust needs
  (Byzantine: 57% of frame → 21%). It is not a general default — sterling on
  cream is barely more saturated than the sweep and would vanish under it.

### The lead card is pipeline, not preference

Every Instagram carousel leads with the generated card. There is no toggle and
no `card_enabled` column: it defines what a post looks like rather than being a
per-run choice, and a setting only invites the two paths (preview and prepare)
to disagree about how many slots are free. The photo cap therefore lives in
`buildInstagramPost` as `INSTAGRAM_MAX_PHOTO_ITEMS` (9 of Meta's 10), so the
count an operator reviews is the count that publishes by construction.

A card render failure is **not** fatal. The photos and caption are the substance
of a post; the card is presentation, so a failure degrades to a card-less
carousel with a warning rather than blocking. This is deliberately the opposite
of the fail-closed rule on price: a published caption is a durable public claim
and must never quote an estimate, whereas a missing decorative slide claims
nothing. Review-first means the operator sees the prepared slides either way.

Because of that fallback, position is not proof — the card's Storage object is
named `card-<hash>.jpg` rather than `0-<hash>.jpg` so the review UI can label
slide 0 honestly instead of assuming.

### Instagram card type renders through Satori, not sharp

sharp draws SVG text through fontconfig, which finds nothing on Netlify's
Lambda image. Satori (via `next/og`, already bundled with Next) takes font
buffers directly and needs no system fonts, so the card splits by strength:
sharp does the pixel work, Satori does the type.

The brand faces are vendored as OFL **static** TTFs under
`next-app/src/assets/fonts` with their licenses. Static specifically — Satori's
bundled opentype parser throws on a variable font's `fvar` table, so Google's
single-file `Family[wght].ttf` builds cannot be used. Nothing imports the files,
so `outputFileTracingIncludes` in `next.config.ts` is what puts them in the
serverless bundle; drop it and every card fails at render with ENOENT.

Because they live in that bucket but are referenced only by
`instagram_posts.rendition_paths`, the Storage GC reference scan MUST include
that column. Without it the sweep reads them as orphans and deletes them,
which breaks any prepared-but-unpublished post by making its image URLs 404
exactly when Instagram tries to fetch them.

### Instagram connects by pasted token, not redirect OAuth

Instagram rejects `http://localhost` redirect URIs, which would make the
owner's LAN/dev testing impossible, and this is a single owner-operated
professional account on a development-mode Meta app where Meta's own documented
path is dashboard token generation. The owner pastes a long-lived token once;
it is stored AES-256-GCM encrypted and refreshed weekly by a scheduled
function, so it never expires in practice. An expired token cannot be
refreshed — only re-pasted — which is why the refresh runs weekly rather than
at the last minute. Redirect OAuth can be added later without schema changes.

### Facebook mirrors Instagram as an independent channel

The Facebook Page integration copies the Instagram integration's shape
file-for-file (schema, lib modules, routes, panels, drip) rather than
abstracting a generic "social channel": an operator or agent who knows one
immediately knows the other, and a change to one can never destabilise the
other. Where the Graph API differs, the build leans into the difference instead
of forcing parity — Page tokens do not expire (so there is no refresh cron),
deletion genuinely works (so there is no manual-delete detour), publishing is
synchronous (no container polling), and links are clickable (so every post
carries a `Shop:` product URL, which Instagram cannot have).

Sharing boundaries: API clients are NEVER shared between channels. Pure caption
and lineup helpers ARE shared (imported from `lib/instagram/mapping`) so copy
fixes land on both channels at once. The rendition/card engine is shared code
but writes per-channel Storage prefixes (`instagram-renditions/` vs
`facebook-renditions/`) with per-channel GC reference columns — shared objects
would let one channel's re-prepare delete files the other still references.
Lineups and crops are stored per channel for the same reason: curating one
never changes the other.

### Do not publish off-eBay contact information

eBay description artwork must not display phone numbers, email addresses, or
off-eBay website URLs. Product-photo galleries must contain product imagery,
not a marketing banner.

## Security And Privacy

### Abuse controls are layered

Netlify Edge provides broad per-IP `/api/*` limiting before Next runs.
Sensitive public routes also use distributed Supabase counters and tighter
route-specific windows. The shared limiter fails closed if its backend is
unavailable, and stale counter rows are cleaned probabilistically.

Public mutations stay behind validated app routes. Direct public execution of
subscriber RPCs is revoked by the security migration. Admin/service-role
operations remain server-only.

### Headers are defense in depth

CSP, frame blocking, HSTS, referrer, permissions, nosniff, and cross-domain
policy are defined in Next and Netlify. Development-only CSP allowances must
not enter production.

No secret values are documented or committed. Netlify owns current operating
environment values; local `.env.local` is not authoritative.

### Security remediation must preserve a working supported toolchain

Production dependency safety is measured with the deployed tree and
`npm audit --omit=dev`, then verified by tests, lint, and a complete production
build. A full-audit finding in development-only lint tooling is still tracked,
but an audit tool's forced major downgrade/upgrade must not replace a supported
toolchain with one that fails at startup.

As of 2026-07-27, production uses patched Next.js, PostCSS, and Sharp versions
and audits cleanly. Stable `eslint-config-next` still bundles React lint plugins
that reject ESLint 10, so the working ESLint 9 line remains until upstream
stable compatibility lands.

## Compliance And Marketing

Account registration records policy acceptance. Newsletter subscribers are
explicit opt-in; account holders are an opt-out marketing audience. Campaign
sends require an admin check, configured physical address, unsubscribe
handling, and Resend event recording.

The legal pages provide an operational baseline, not legal advice. Owner/counsel
review remains required. New non-essential tracking requires a real consent
preference update before deployment.

## UI Conventions

### Admin editing surfaces open in pop-up windows, never inline

Owner rule (2026-08-01): when an admin action needs its own working area — a
crop editor, a generated preview, any focused edit flow — it opens in a modal
dialog OVER the page (`components/admin/AdminModal.tsx`: dimmed backdrop,
title bar, ✕, Escape, click-outside). It must never expand new space inline
under the trigger, which shoves the rest of the page around. Companion pattern
for collections: thumbnails are selection targets carrying badges only, and a
single toolbar acts on the selected item — per-item button clusters do not
scale visually (a 3×2 pad under 96px thumbnails shattered into text fragments
at moderate widths and was scrapped the same day it shipped).

### Mobile admin accounts prioritize the Admin Panel entry

For authenticated administrators only, the account dashboard's Admin Panel
access card appears immediately after the account tabs and before Account
Overview at 700px and below. From 701px upward, it stays in the established
right side rail. Both placements render the same localized card component and
must be mutually exclusive so there is exactly one visible admin entry. Regular
customer accounts do not render either placement.

### Product-summary specifications wrap as one group

In the product-detail eyebrow, availability is a status badge while
metal/purity and length are product specifications. The specifications remain
in one no-wrap group. If the full row lacks room, that complete group moves
beneath the badge; never allow length alone to become an orphaned second line.
This content-aware flex grouping is preferred over a viewport breakpoint
because Spanish labels and the tablet two-column layout need different amounts
of space.

### Product-detail thumbnail rails keep the active-next pair visible

The page gallery and full-screen lightbox share one circular thumbnail-track
behavior. Selecting or advancing media centers the active thumbnail together
with its logical next thumbnail, so controls never advance into an offscreen
selection. Two accessibility-hidden edge clones on each side provide a visible
last-to-first/first-to-last transition; after the transition, the rail resets
without animation to the matching original. Real thumbnails remain the only
focusable/announced choices. Preserve keyboard arrows, touch scrolling,
reduced-motion behavior, resize correction, localized labels, and no
document-level overflow from 320px upward. Rail widths and scroll offsets snap
to complete card-and-gap increments: partial thumbnail cards must not appear at
either viewport edge when motion settles. Navigation uses a controlled eased
requestAnimationFrame flow instead of relying on browser-native smooth scroll,
which was being interrupted by resize normalization and appeared as an instant
swap. Resize correction must not run during active motion; rapid navigation
continues from the live offset. Circular edge-clone normalization happens only
after animation completion, while reduced-motion preference keeps immediate
positioning.

### Shop is a direct nav link with no submenu

Owner decision 2026-08-01: the header's Shop control links straight to
`/shop` at every viewport — no dropdown on desktop, no accordion in the
mobile menu. The auctions page that used to live in that submenu is retired
(`/auctions` 301s to `/shop`), and both aspirational legal pages were
retired with it the same evening: `/auction-terms` and `/vendor-terms`
(each 301s to `/terms`). The legal set is now the six real policies only.
Do not reintroduce a Shop submenu or any retired page without an owner
request; Sell and About keep their dropdown/accordion pattern.

### Thin-mobile headers preserve the brand and primary actions

From 320px upward, the public header must keep the full
`Naples Estate Jewelry` label (owner dropped the domain suffix from the
header wordmark 2026-08-01) plus the language, call, cart, and menu
controls visible without horizontal overflow. Below 400px, compact
micro-spacing and fluid brand typography are preferred over truncating the
brand or hiding a primary action. Below 350px, proportionally reduce the visible
call/cart controls, glyph/count badge, and outlined menu while keeping every
action present and usable; regular mobile/tablet sizes remain unchanged.

### iOS format detection stays off; tappable numbers are explicit anchors

Root-layout metadata disables telephone/date/address/email format detection
site-wide: iOS Safari's auto-linking rewrites server-rendered text before
hydration and caused real iPad hydration failures (confirmed live
2026-07-31). Consequently, any visible phone number that should be tappable
must be written as an explicit `<a href="tel:...">` — never rely on browser
auto-detection. Do not remove the `formatDetection` metadata.

### Live-spot surfaces are tap-to-refresh via SpotRefreshPill

Spot-price displays (shop badges, mobile spot row, product "Based on spot"
box) share `SpotRefreshPill`: tapping runs `router.refresh()` so the pill
and every server-rendered price update together, confirmed by a portaled,
timestamped note (portal to document.body is required — sidebar reveal
animations create stacking contexts that clip in-place tooltips). The pill
root must remain a DIV with an inner stretched button because shop CSS
targets `.shop-search-spot-row > div:nth-child(...)` for layout. Product
pages' ticker shows "Last updated <time> · Updates in <m:ss> · <time>" in
pinned America/New_York time. That complete sequence is a single no-wrap unit:
use fluid 8-9.92px label type and compact tracking so English and Spanish both
remain intact from 320px upward and in the narrow tablet product column; do not
truncate or hide any timestamp. The Weight spec shows only the written-out
localized total ("N grams total" / "N gramos en total").

Customer text actions use one left-to-right underline reveal for hover and
keyboard focus, with reduced-motion support. Persistent content underlines and
selected indicators remain unchanged.

Customer page-reveal animations must never gate the visibility of a product
page on offscreen or lazy-loaded gallery thumbnails. The shared reveal ignores
lazy images and has a short fallback, so primary content remains visible even
if a non-lazy media resource stalls; deferred media may load afterward. The
pending→visible commit must also never depend solely on
`requestAnimationFrame`: hidden documents (background tabs, prerendering,
non-compositing webviews) suspend frames indefinitely while pending content
blocks pointer events, so the reveal commits immediately when
`document.visibilityState` is `hidden` and keeps a bounded timeout backstop
while visible.

When a buyer opens a product from the shop, preserve the exact localized shop
URL and vertical position in tab-scoped session storage. Back to Shop restores
that recorded context only for the same product and shop URL; direct product
entries retain the ordinary `/shop` fallback. This avoids polluting shareable
product URLs with transient navigation state.

Desktop interactive controls should expose a small, consistent hover lift or
color/background reaction plus press feedback. Mobile-only controls are not
part of the desktop affordance audit unless a future mobile pass is requested.

Admin Products does not display separate Total, Available, or Sold summary
cards. Keep the page focused on the inventory table, filters, and row actions;
this applies consistently across desktop, tablet, and mobile layouts.

The Admin Products shell is a fixed dynamic-viewport flex layout. Page-level
scroll is suppressed so the product table wrapper owns the inventory scroll;
this keeps the header and controls static across viewport sizes.

Async actions show immediate press feedback plus a durable loading/success/error
state. Financial summaries always show cents. Empty or inapplicable customer
fields are omitted rather than rendered as blank labels.
