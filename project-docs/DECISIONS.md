# Decisions

> Current durable decisions only. Superseded experiments and session-by-session
> reasoning remain in `CHANGELOG.md`. Older runbooks that cite a dated
> `DECISIONS.md` "session" or "addendum" should follow the same date/label in
> `CHANGELOG.md`; those historical entries moved there during the 2026-07-23
> compaction. Last reconciled: **2026-07-24**.

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

`checkout-shipping.ts` is the sole shipping catalog: Local Pickup $0, Priority
Insured $45, Express Overnight Insured $75. Unknown methods are rejected rather
than falling back to free shipping.

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

### Etsy queue progress is durable

Bounded image requests retain queue ownership after intermediate states. Normal
and repair drains use separate atomic claims. Progress is cumulative against a
fixed total, and a one-click repair action resumes linked interrupted rows.

### eBay verification follows relists without mutating them

Read-only verification may follow an ended listing to a live relist, but must
not silently attach, end, or republish that external relist. App-side writes
remain blocked until the stored offer/listing relationship is deliberately
reattached.

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

Customer text actions use one left-to-right underline reveal for hover and
keyboard focus, with reduced-motion support. Persistent content underlines and
selected indicators remain unchanged.

Customer page-reveal animations must never gate the visibility of a product
page on offscreen or lazy-loaded gallery thumbnails. The shared reveal ignores
lazy images and has a short fallback, so primary content remains visible even
if a non-lazy media resource stalls; deferred media may load afterward.

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
