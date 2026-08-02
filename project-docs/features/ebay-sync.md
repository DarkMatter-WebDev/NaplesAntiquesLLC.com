# Feature: eBay Sync

> **Account-change reset (built 2026-07-30):** Settings → eBay Sync has a
> "Reset listing state (account change)…" action for switching to a different
> eBay seller account. It is dry-run-first (shows a count-by-state summary
> and how many rows reference live listings) and on explicit confirm deletes
> every local `ebay_listings` row plus the account-scoped orders cursor —
> never touching listings on eBay itself; the action logs to `ebay_sync_log`.
> Full account-change runbook: 1) delist the old account's listings through
> the app while still connected, 2) disconnect / connect the new account,
> 3) re-pick payment/return policies + re-run location setup + re-click tier
> provisioning, 4) run this reset, 5) Sync All (mind the new account's
> selling limits). Without the reset, existing rows are treated as updates
> against the old account's offers, which the new token cannot see.

> **Shipping tiers (built 2026-07-30, awaiting owner provisioning):** offer
> shipping now follows the site's value-based tiers. Settings → eBay Sync has
> a "Provision tiered shipping policies" action that creates/updates one
> FLAT_RATE fulfillment policy per distinct tier fee ($19–$165, canonical
> names "NEJ Insured Shipping $N") and maps them in
> `marketplace_shipping_profiles` (run
> `supabase/marketplace-shipping-tiers-2026-07.sql` first). Once provisioned,
> `resolveFulfillmentPolicyId` prefers the tier policy for the item's price
> band (payload `shippingTier: 'tiered'`); the policy id stays in the content
> hash (Q16), so a price crossing a tier boundary flags the listing
> out_of_date for the normal review-first update. Unprovisioned tiers fall
> back to the legacy standard/express threshold pair — live behavior is
> unchanged until the owner provisions. See
> `features/shipping-tiers-plan.md`.

> Status: **code-complete; the Phase 0 account-deletion webhook and listing
> status/relist reconciliation are confirmed live.** Phase 1/2 write behavior
> is only partially live-tested; see "Verification status" below.
> Full plan: `ebay-sync-plan/` (18 docs). Owner checklist:
> `ebay-sync-plan/OWNER-SETUP.md`. Deliberately mirrors the shipped Etsy
> integration's shape — see `project-docs/features/etsy-sync.md` — but is a
> separate, independent module; neither channel depends on the other.

## What this is

**2026-07-21 status-drift fix:** An active eBay status check preserves local
`out_of_date` instead of replacing it with `published`. Remote lifecycle and
local content freshness remain independent, and the result reports **Live,
updates needed** until a successful sync refreshes the content hash. Inventory
#53 live-verified the fix after its mapped fulfillment policy crossed the
$1,000 high-value threshold.

**2026-07-21 status-to-post route:** Each product in the selected status
dialog's eBay Not listed detail has **Post to eBay**. It scopes the existing
selected eBay sync dialog to that product, where the admin still chooses
immediate sync or review-first submission. Closing or completing that route
returns to a newly reconciled combined status summary without clearing the
original table selection.

**2026-07-20 selected review-first sync:** Selected products can either use the
existing immediate eBay batch queue or open a sequential review flow. Each step
loads the real eBay preview checks, condition, shipping, aspects, and mapped
fields, then runs the established bounded single-product sync endpoint only
after explicit submission. Terminal success advances; failures stay on the
current item for refresh/retry, and explicit skips are counted. The flow keeps
eBay's existing review/publish/update semantics and is independently selectable
after Etsy in Sync to both.

**2026-07-20 selected reconciliation:** The Admin Products Actions modal has a
channel-specific **Check eBay status** action for the selected products. It
calls `verify-all` with an optional deduplicated `productIds` list and returns
a final state for every selected product independently from Etsy. The default
view reduces those records to clickable Listed, Not listed, and Needs attention
totals. A nonzero total opens only its matching products and translates eBay
state into Live, Draft, Not listed, Ended, Hidden (sold), Out of date, or a
check/error result; Back restores the totals without another request. The
internal local-update count remains in the API contract but is not displayed.
It performs marketplace reads and local reconciliation only, preserves the
selection, and pushes no listing content. A failed eBay check can be retried
without discarding a successful Etsy result. A live mixed-status check showed
one Listed and one Not listed, and both drill-downs passed.

**2026-07-19 description-banner preparation:** A shared banner was optimized
to `next-app/public/assets/marketplaces/ebay-description-banner.webp` (1400x468
WebP, 113,460 bytes), but it is not part of `mapDescription()` or any live
listing. The supplied art visibly includes the business phone number and
off-eBay domain, so it must be replaced with a policy-safe branding-only
variant before integration. A future compliant banner must use a public HTTPS
asset, stay non-clickable and responsive, appear only in the HTML description
(not `imageUrls`), and pass one controlled desktop/mobile listing check before
bulk Sync Updates.

**2026-07-16 full API audit:** All 79 linked offers were read from eBay, plus
per-SKU offer lookups: 73 were published/active, 5 unpublished/out-of-stock,
and one was inventory #82's known ended predecessor. No duplicate SKU offers or
API errors were found. Shared write paths now validate each entry in bulk HTTP
200 responses, include the required fixed-price `listingDuration: GTC`, capture
new listing IDs after publish/restore, distinguish Inventory-offer 404s from
Trading-item failures, and resolve detached relists before writes. Crash
recovery only adopts exact-marketplace fixed-price offers. Focused regression
tests and guarded admin-browser actions cover these cases; destructive live
write scenarios remain subject to the verification notes below.

**2026-07-16 relist correction:** Inventory `getOffer` can remain attached to
an ended item after that item is relisted outside the offer. Status verification
now uses seller-authenticated Trading `GetItem` to follow the bounded
`RelistedItemID` chain, requires the same seller SKU at each hop, and adopts the
latest active listing ID. A detached relist is displayed as Live with an admin
warning, while app-side sync, price, and delist writes are blocked until an
owner-approved reattachment is completed. Inventory #82 was live-tested twice
against active relist `800354878200` without drifting back to Ended.

A one-way push (Supabase `products` → an eBay listing) as a secondary sales
channel, same trust model as Etsy sync: `products` stays the source of
truth, eBay is never authoritative, and the only inbound flow (eBay → us) is
the optional, **not built**, Phase 3 order-ingest poll (Q15 — manual
handling is fine).

Two structural differences from Etsy that shaped the whole design:

1. **No draft state.** `publishOffer` makes a listing live and buyable
   immediately — there is no private eBay-side draft to review before
   publish. The dry-run preview is the only review surface, and Phase 1
   defaults to review-first (Q1): sync stops at `review`, and a distinct
   `publish-live` action (with UI copy that says so) is required to go
   public.
2. **Far fewer API calls per publish** (~3-4 vs Etsy's ~12) because eBay's
   Inventory API takes `product.imageUrls[]` directly and fetches/copies
   them itself — this build's server never downloads, transcodes, or
   uploads a single image byte. There is no `images.ts` and no per-image
   table, unlike Etsy.

## Module layout (`next-app/src/lib/ebay/`)

- **`client.ts`** — fetch wrapper: `Authorization: Bearer`, `Content-Language:
  en-US` on writes, throttle (~3.5 req/s courtesy pace) + 429/5xx backoff
  (1s/2s/4s + jitter, up to 3 retries), typed `EbayApiError` (`status`,
  `code`, `operatorMessage`, `retryable`, `errorId`/`category` from eBay's
  error envelope, redacted `detail`), and a cached client-credentials
  application token (`getApplicationToken()`) for Taxonomy/Metadata/
  Notification-public-key-class calls that don't need a seller's user
  token.
- **`auth.ts`** — OAuth 2.0 authorization-code grant, **no PKCE** (eBay
  requires a confidential client — HTTP Basic `client_id:client_secret` on
  every token call, so the exchange is server-side only). AES-256-GCM token
  encryption (`EBAY_TOKEN_ENC_KEY`, SHA-256-derived key, `iv.tag.ciphertext`
  storage format — same scheme as `etsy/auth.ts`, copied not imported).
  Refresh is on-demand (2-minute skew window), with a cheap single-flight
  guard on `access_token_expires_at` rather than Etsy's refresh-token
  rotation CAS, since **eBay refresh tokens don't rotate** (~18-month hard
  expiry instead).
- **`mapping.ts`** — pure, unit-tested (49 tests)
  `Product → InventoryItem + Offer` payload functions. Allowlist-by-
  construction, same discipline as Etsy's mapper: `buildMappedPayload()`
  only ever reads named fields into a fresh object, never spreads
  `...product`, so `cost_basis`/`minimum_price`/`internal_notes`/etc.
  structurally cannot leak (asserted by test). Key pieces:
  - `mapTitle` — 80-char word-boundary truncation (tighter than Etsy's 140).
  - `mapAspects` — best-effort `{Metal, Metal Purity, Type, Brand, Chain
    Length | Ring Size, Year Manufactured, Item Weight}` (see "Build-time
    resolutions and known gaps" below — not validated against eBay's live
    value lists).
  - `resolveCategory` — Fine vs Fashion Jewelry routing (Q4): solid metals
    → pinned Fine Jewelry leaf ids; `metal_variant === 'vermeil'` → Fashion
    Jewelry (unpinned, see gaps below — resolves to `null`, blocking
    pre-flight rather than guessing). Coin/Bullion → `null` always (Q6).
  - `computeEbayPrice` — reuses `calcSpotPriceValue`/
    `parseManualPriceLabelValue` (`lib/pricing.ts`, never reimplemented),
    applies the eBay-specific admin-variable markup (Q2, seeded 15%). No
    platform price floor (unlike Etsy's $0.20).
  - `resolveFulfillmentPolicyId` — **Q16**: compares the flattened price
    against `ebay_connection.high_value_shipping_threshold` (seeded $1000);
    over threshold → `express_fulfillment_policy_id` ("NEJ Express
    High-Value"), else → `fulfillment_policy_id` ("NEJ Insured Flat Rate").
    Pure mapping-time branch, no extra API call. The resolved policy id is
    part of `computeContentHash()`'s input, so a price crossing the
    threshold triggers an update push.
  - `buildPreflightChecks` — connected / account defaults present / not
    Coin-or-Bullion (Q6) / `status === 'available'` / quantity ≥ 1 / price
    computable / has images / category resolved (with an approximate-flag
    warning) — all no-eBay-call, all shown in the dry-run preview.
- **`sync.ts`** — the step machine (`item → offer → review|published →
  out_of_date|hidden_oos|ended|error`; full diagram:
  `ebay-sync-plan/03-sync-lifecycle.md`), Phase 2 bulk queue drain
  (`drainQueueCore`, dependency-injected and unit-tested — 9 tests), the
  scheduled/manual price push, and `handleProductStatusChange()` (the Q7
  auto-hide/withdraw hook). Runaway-prevention (a bulk re-enqueue of an
  already-published item reinterpreted as `mode: 'update'` instead of a
  fresh publish, plus a drain seen-guard) is built in **from day one** here
  — on Etsy this was a fix added after a real production incident
  (`CHANGELOG.md` 2026-07-08, seventeenth addendum).
- **`store.ts`** — typed access to `ebay_connection` / `ebay_oauth_states` /
  `ebay_listings` / `ebay_sync_log` (service-role only; same
  schema-not-migrated defensive pattern as `etsy/store.ts`).

## Database (`supabase/ebay-sync.sql` - applied)

One fewer table than Etsy (no `ebay_listing_images` — see "no image bytes"
above):

- **`ebay_connection`** — single row (`id=1`): OAuth tokens (encrypted),
  account defaults (`fulfillment_policy_id`, `express_fulfillment_policy_id`,
  `high_value_shipping_threshold`, `payment_policy_id`, `return_policy_id`,
  `merchant_location_key`), selling-limit snapshot (informational, Q14),
  sync policy (`auto_publish` Q1, `sold_handling` Q7, `best_offer_enabled`
  Q9, `price_push_enabled`/`price_push_threshold_pct` Q3,
  `price_markup_pct` Q2), and `orders_cursor` (column exists for the Phase 3
  seam; unused — no route reads/writes it).
- **`ebay_oauth_states`** — transient CSRF state, 10-minute TTL by
  convention, no PKCE verifier column (eBay's grant has no PKCE).
- **`ebay_listings`** — `product_id` (text, PK, FK → `products.id`)
  ↔ `ebay_sku` (= `products.id` verbatim, Q11) ↔ `ebay_offer_id` ↔
  `ebay_listing_id`; `sync_state` (`pending | item_synced | offer_created |
  review | published | out_of_date | hidden_oos | ended | error`);
  `content_hash`; `last_pushed_price`/`last_pushed_qty`; `category_id`;
  `last_error`/`error_count`.
- **`ebay_sync_log`** — audit/dead-letter, same shape as Etsy's.
- **`claim_next_pending_ebay_listing()`** — `FOR UPDATE SKIP LOCKED` RPC,
  mirrors `claim_next_pending_etsy_listing()`.

All four tables: RLS enabled, **no policies** (service-role only, same trust
model as `webhook_events`).

## API routes (all under `/api/admin/ebay/*`, admin-gated via `requireAdmin()`
+ service-role client; errors shaped `{ error: { code, message } }` — note
this differs from the Etsy routes' plain `{ error: string }`)

`connect` (GET, starts OAuth) · `callback` (GET, code exchange) · `status`
(GET) · `disconnect` (POST) · `settings` (PUT, partial patch) ·
`account-profiles` (GET, policy/location dropdowns) · `preview` (POST,
dry-run) · `sync` (POST, modes `publish`/`update`/`price-only`/
`publish-live`) · `sync-batch` (POST, Phase 2 `enqueue`/
`enqueue-all-eligible`/`drain`) · `delist` (POST, `hide`/`withdraw`/
`restore`) · `listings` (GET, bulk chip map) · `eligibility-summary` (GET) ·
`verify-listing` (POST) · `verify-all` (POST; all linked listings or
optional validated `productIds`) · `price-push` (POST,
`x-cron-secret` header, not admin-gated — a cron has no browser session) ·
`push-prices` (POST, admin-gated manual push).

Plus, outside `/api/admin/ebay/`: **`/api/webhooks/ebay-account-deletion`**
(Phase 0 compliance endpoint, not admin-gated — eBay calls it directly). GET
answers the challenge (`hex(sha256(challengeCode + EBAY_VERIFICATION_TOKEN +
endpointUrl))`, exact concatenation order, unit-tested). POST verifies
`X-EBAY-SIGNATURE`, records a sanitized notification in `webhook_events`
(`provider='ebay'`, unique on `(provider, event_id)`) for idempotency, and
acks 200. The stored payload keeps only notification metadata
(`notificationId`, event/publish dates, publish attempt count) and strips eBay
user identifiers (`username`, `userId`, `eiasToken`) before persistence. We
store no eBay buyer data (no Phase 3), so the handler is close to a no-op by
design.

**2026-07-16 correction:** the first live implementation stored raw
account-deletion payloads in `webhook_events.payload`; a read-only audit found
10,922 existing rows with eBay user identifiers. Code is fixed for future rows,
but the existing rows need the owner-confirmed scrub tracked in `TASKS.md`.

Phase 3's order-ingest route is **not built** (Q15 — deferred, manual
handling is fine; the `orders_cursor` column is the only seam left in
place).

## Admin UX

- **`EbaySettingsPanel.tsx`** (composed into `/admin/settings`, next to
  `EtsySettingsPanel`): connect/reconnect/disconnect, 18-month
  reconnect-by countdown, 5 policy fields — standard shipping, **express
  shipping (Q16, new — no Etsy precedent)**, **high-value threshold $
  (Q16)**, payment, return — plus a read-only inventory-location display,
  selling-limit readout, sync-policy toggles (auto-publish, sold-handling,
  best-offer, price-push), and the markup field with the **exact same**
  explicit-Save / `pricesStale` callout / gold "Push prices to eBay now"
  button interaction the Etsy panel settled on (Q2 explicitly required
  this).
- **`EbayProductPanel.tsx`** (drawer section next to the Etsy one): sync
  state chip, pre-flight checklist, mapped-payload preview (title, price,
  condition, category + approximate flag, aspects, image count, **which
  shipping tier this item resolves to**), and action buttons — Refresh
  Preview, Sync to eBay / Sync Updates (stall-guarded polling loop),
  **Publish on eBay** (only enabled once `syncState === 'review'`, copy
  makes clear it's live immediately), Push price only, Check eBay Status,
  Hide / End / Restore.
- **`EbayBulkSyncModal.tsx`** (Phase 2, toolbar button "Sync all to eBay"):
  eligibility summary (`"{eligible} eligible · {ineligible} ineligible ·
  {upToDate} up to date · {errors} errors"`, with Coin/Bullion items
  showing up under "ineligible" with the Q6 reason), enqueue + drain with
  live progress and a cooperative "Stop after current item" cancel.
- **Product Admin selected Actions** — **Check eBay** reconciles only the
  selected linked offers, reports checked/updated/reset/error/skipped totals,
  refreshes eBay chips on close, and keeps the selection for a follow-up sync.
- **Price automation:** `netlify/functions/ebay-price-push.mts` is scheduled
  daily at 11:45 UTC and calls the existing `EBAY_CRON_SECRET`-guarded route.
  Scheduled/manual planners bulk-load price inputs, reject fallback or missing
  relevant-metal spot values, and use eBay's 25-entry bulk update with
  per-item fallback for mixed failures. Admin Settings shows the last scheduled
  result. The live eBay price-push toggle remains off until the owner enables
  it after a controlled post-deploy `Run now` check.
- **Not built:** a dedicated "eBay: out of date / error / not listed"
  product-table filter chip — there's no existing single-marketplace filter
  control on the Etsy side to extend, so this was skipped rather than
  inventing a new filtering convention. The status chip + drawer + bulk
  modal cover the required surfaces.

## Lifecycle summary

`unlinked → pending → item_synced → offer_created → review (Q1 default) →
published → out_of_date (content hash mismatch) → published` (update loop);
`published → hidden_oos` (sold on-site, Q7 quantity-zero default) `→
published` (restocked); `→ ended` (withdraw, for archived/deleted or if Q7
is set to withdraw-on-sold) `→ pending` (re-publish mints a **new**
`ebay_listing_id`). Full state diagram: `ebay-sync-plan/03-sync-lifecycle.md`.

Phase 2 automation (`handleProductStatusChange`) is wired in **next to** the
existing Etsy call — never replacing it — at all three chokepoints that
change product status: `adminRevalidateProduct(s)`
(`app/actions/admin-products.ts`), PayPal `capture-order`, and the PayPal
webhook. Always best-effort/non-throwing (`void ...().catch(() => {})`), so
an eBay hiccup never blocks cache revalidation or a buyer's checkout
confirmation.

## Field mapping highlights (full table: `ebay-sync-plan/02-field-mapping.md`)

Same `products` → marketplace boundary as Etsy: `title_es`/`description_es`/
`tags_es`/`public_notes_es` never sync (eBay US listings are EN-only, no
per-listing translation write API); `tags` has no eBay equivalent (search
keywords live in title + aspects); `cost_basis`/`minimum_price`/
`internal_notes`/`private_price_label`/`melt_value`/`live_spot_snapshot`/
`acquisition_*` never leave the system (allowlist guarantee, test-asserted);
`sku` (the column) is unused — the eBay SKU key is `products.id` (Q11).
Condition is fixed: `USED_EXCELLENT` (id `3000`, "Pre-owned") + one standard
`conditionDescription` template for every item (Q5) — no per-item authoring.

## Build-time resolutions and known gaps

The numbered list below records the initial build-time uncertainty. Since that
first pass, live OAuth/webhook/status/relist and controlled write work has
verified several assumptions, and live Taxonomy calls pinned the categories
actually used by the current catalog. Remaining code-level
`TODO(ebay-verify)` items are the sandbox auth-host assumption, selected
allowed aspect values, multi-SKU price batching, and plan-level account
details. Historical reasoning is in `project-docs/CHANGELOG.md` under
2026-07-09 and 2026-07-10.

1. **Current catalog Fashion Jewelry leaves are pinned.**
   `EBAY_FASHION_CATEGORY_MAP` contains the live-verified Necklace/Pendant/
   Charm/Koma Clasp and Brooch leaves used by existing inventory. Unsupported
   future vermeil types still block at preflight rather than guessing. Fine
   Jewelry and antique-silver leaves are also pinned from live taxonomy work.
2. **Item-aspect values are not cross-checked** against eBay's live
   `getItemAspectsForCategory` SELECTION_ONLY allowed-value lists — a
   mismatch fails loudly at publish time (a 400), not silently, which is a
   materially safer failure mode than the Etsy build's "Gray" incident.
3. **`ebay_username` is always `null`** — the plan's OAuth scope list has no
   identity-lookup scope. The settings panel shows the connected date and
   token countdown instead.
4. **No per-product category-override route exists** (07-admin-ux.md
   mentions one; 08-database-schema.md's `ebay_listings` schema and
   09-api-routes.md's route table don't provide the column/route for it —
   treated the schema/route docs as authoritative).
5. **`bulkUpdatePriceQuantity` sends one SKU per call**, not a batch of up
   to 25 — the plan's own `rest-endpoints-used.md:57` flags the exact
   batching shape `TODO(ebay-verify)`.
6. ~~Account-deletion webhook signature verification unverified~~ —
   **RESOLVED 2026-07-09 (session 14, second addendum).** Confirmed live
   against the owner's real production keyset's "Send Test Notification":
   the `X-EBAY-SIGNATURE` header shape was correct as originally assumed,
   but two real bugs surfaced and were fixed — (a) eBay's digest is **SHA1**,
   not the originally-hardcoded SHA256 (now read from `getPublicKey`'s own
   `digest` field instead of assumed), and (b) the `key` field arrives as a
   single line with PEM markers but no internal line breaks, which
   Node's OpenSSL binding rejects outright — now always rebuilt into a
   properly line-wrapped PEM regardless of the raw string's shape
   (`buildPemFromRawKey()` in the route file). Both the GET challenge and
   POST signature verification are now confirmed working end to end. Full
   debugging trail: `project-docs/CHANGELOG.md` 2026-07-09 (session 14,
   second addendum).
7. **General eBay API host/header conventions** are pinned from
   well-established, stable Sell API knowledge, not a fresh OpenAPI fetch —
   spot-check the Sell Inventory/OAuth endpoints against real docs before
   the first live sync (this is the exact class of mistake — wrong header
   format, wrong host — that bit the Etsy build twice).
8. **Authenticity Guarantee threshold, current eBay fee schedule figures,
   Cert-ID-reset token survival, localhost RuName acceptance** — all
   flagged `TODO(ebay-verify)` by the plan itself and not resolvable
   without live account access; see `ebay-sync-plan/OWNER-SETUP.md`.

## Verification status

**Live-eBay verification began with Phase 0 (2026-07-09):**
the account-deletion webhook is confirmed working end to end against the
owner's real production keyset — the GET challenge validated immediately
(auto-enabled the previously-disabled production keyset — that alone
satisfies eBay's Q10 compliance gate) and "Send Test Notification" (the
POST signature-verify path) now succeeds with zero errors in Netlify's
function logs and no failure banner in the eBay portal, after fixing two
real bugs found via live debugging (SHA1 digest, malformed single-line PEM
— see the 2026-07-09 changelog). Since then OAuth, previews, controlled
publishes/updates, category and fulfillment-policy paths, and selected
status/relist reconciliation have also been exercised live. The full owner
write-path/idempotency matrix is still incomplete, so untested cases remain
explicit in `ebay-sync-plan/OWNER-SETUP.md` and `project-docs/TASKS.md`.

What IS verified (code-level, all builds/phases):

- `npx tsc --noEmit` — clean.
- `npm run lint` — clean (0 errors).
- `npm run build` — clean, all 17 new eBay routes registered correctly
  alongside the existing Etsy routes.
- `npx vitest run` — **238/238 tests pass**: 49 `mapping.ts` tests (title
  truncation incl. boundary cases, aspect mapping, Fine-vs-Fashion/vermeil
  routing, Coin/Bullion ineligibility, condition template, price+markup for
  both price modes, image URL absolutization for both URL shapes, the
  private-field allowlist guarantee, Q16 threshold routing and its effect
  on the content hash), 9 `sync.ts` tests (`shouldPushPrice` threshold
  logic, `drainQueueCore`'s exhaustion/seen-guard/time-budget/partial-item
  behavior with fake dependencies), 9 account-deletion webhook tests
  (challenge-hash algorithm + concatenation order + signature-failure
  paths), plus every pre-existing test (Etsy's 70 mapping + 14 sync + 21
  ring-size + 22 length + 22 images + 5 client tests, and all non-Etsy
  suites) — **zero regressions**.

**Keyset activation is done** (the Phase 0 item from
`ebay-sync-plan/14-verification-checklist.md`'s "Phase 0/1 verification"
list). Treat `ebay-sync-plan/OWNER-SETUP.md` as the detailed matrix, but use
the current status at the top of this file and `project-docs/TASKS.md` before
repeating a step; several originally untested paths are now complete.
