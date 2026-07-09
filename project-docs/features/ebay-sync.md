# Feature: eBay Sync

> Status: **code-complete, unverified live** (built 2026-07-09, session 14).
> Full plan: `ebay-sync-plan/` (18 docs). Owner checklist:
> `ebay-sync-plan/OWNER-SETUP.md`. Deliberately mirrors the shipped Etsy
> integration's shape — see `project-docs/features/etsy-sync.md` — but is a
> separate, independent module; neither channel depends on the other.

## What this is

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
  (`DECISIONS.md` 2026-07-08, seventeenth addendum).
- **`store.ts`** — typed access to `ebay_connection` / `ebay_oauth_states` /
  `ebay_listings` / `ebay_sync_log` (service-role only; same
  schema-not-migrated defensive pattern as `etsy/store.ts`).

## Database (`supabase/ebay-sync.sql` — written, NOT yet applied)

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
`verify-listing` (POST) · `verify-all` (POST) · `price-push` (POST,
`x-cron-secret` header, not admin-gated — a cron has no browser session) ·
`push-prices` (POST, admin-gated manual push).

Plus, outside `/api/admin/ebay/`: **`/api/webhooks/ebay-account-deletion`**
(Phase 0 compliance endpoint, not admin-gated — eBay calls it directly). GET
answers the challenge (`hex(sha256(challengeCode + EBAY_VERIFICATION_TOKEN +
endpointUrl))`, exact concatenation order, unit-tested). POST verifies
`X-EBAY-SIGNATURE`, records the notification in `webhook_events`
(`provider='ebay'`, unique on `(provider, event_id)`) for idempotency, and
acks 200. We store no eBay buyer data (no Phase 3), so the handler is close
to a no-op by design — see "Build-time resolutions" below for what's
unverified about the signature check specifically.

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

No eBay credentials or network access to `developer.ebay.com` were
available in the build environment (`WebFetch` timed out on every attempt),
so per `BUILD-PROMPT.md` hard rule 8, uncertain values are pinned as
best-supported guesses and marked `TODO(ebay-verify)` in code rather than
left unbuilt. Full reasoning for each: `project-docs/DECISIONS.md`
2026-07-09 (session 14). Summary:

1. **No Fashion Jewelry category id is pinned** (`EBAY_FASHION_CATEGORY_MAP`
   in `mapping.ts` is empty) — every vermeil item is blocked at pre-flight
   with a clear message until a developer pins real ids via a live
   `getCategorySuggestions` call. Fine Jewelry leaf ids (261993/261994/
   261990/261988/etc.) ARE pinned, from the plan's own candidate table, but
   are themselves still flagged `TODO(ebay-verify)` by the plan (eBay
   restructures its taxonomy periodically).
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
6. **Account-deletion webhook signature verification** (`X-EBAY-SIGNATURE`
   decoding + `getPublicKey` response shape) is implemented from the
   commonly-documented pattern, not a live-verified contract — the
   challenge-echo GET half (precisely specified by the plan) is exact and
   unit-tested. Spot-check the POST path against a real "Send Test
   Notification" before relying on it.
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

**No live-eBay verification was possible or attempted.** What IS verified:

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

Every live-eBay item from `ebay-sync-plan/14-verification-checklist.md`
(keyset activation, sandbox OAuth round-trip, first real publish,
idempotency drills, hide/restore, price push observation) is on
`ebay-sync-plan/OWNER-SETUP.md` as a post-setup step, explicitly marked
untested by this build.
