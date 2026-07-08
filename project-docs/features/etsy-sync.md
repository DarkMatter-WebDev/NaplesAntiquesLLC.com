# Feature: Etsy Sync

> Status: **Phase 1 + Phase 2 built and core pipeline live-verified**
> (OAuth connect, DB migration, and a first real draft sync all confirmed
> live 2026-07-08 — see "Verification status" below for exactly what is and
> isn't confirmed yet). Built 2026-07-08 per `etsy-sync-plan/BUILD-PROMPT.md`,
> following the 17-doc plan in `etsy-sync-plan/` as the source of truth.
> Phase 3 (Etsy order webhooks) is out of scope and not built. **Before doing
> anything live, read `etsy-sync-plan/OWNER-SETUP.md`** — it has the complete
> ordered owner checklist; this doc is technical reference, not a runbook.

## What this is

A one-way push of the Naples Estate Jewelry catalog (Supabase `products`,
which stays the sole source of truth) to the owner's Etsy shop as a secondary,
admin-driven sales channel. Nothing on Etsy is ever authoritative for catalog
data; the only planned Etsy → us data flow (order events) is Phase 3, which is
explicitly out of scope for this build.

## Module layout

```text
next-app/src/lib/etsy/
  client.ts   fetch wrapper: x-api-key + bearer auth, ~4 req/s throttle,
              429/5xx backoff (1s/2s/4s), typed EtsyApiError with an
              operator-facing message per etsy-sync-plan/11-error-handling.md
  auth.ts     OAuth 2.0 + PKCE (connect/callback), AES-256-GCM token
              encryption (key: ETSY_TOKEN_ENC_KEY, SHA-256-derived so any
              non-empty string works), refresh-on-demand with rotation and a
              conditional-update race guard
  mapping.ts  PURE functions, unit-tested: Product -> Etsy payload. Title
              truncation (140 char, word boundary) + "&"-once rule (Etsy
              allows one "&" per title; the rest become "and" — live 400 fix,
              DECISIONS.md session 9 twelfth addendum), tags (13 x 20 chars,
              WORD-BOUNDARY truncation — never chops a word mid-way, see
              DECISIONS.md 2026-07-08 session 9 seventh addendum;
              jt:/ct:/len: prefix stripping, composed buyer-searchable
              phrases, paired vintage/antique category tags — jewelry-level
              + metal-specific, always all-or-nothing per pair), materials,
              when_made buckets + vintage fallback,
              price flattening + 8% markup + $0.20 floor, taxonomy
              resolution (ETSY_TAXONOMY_MAP coarse types + an
              ETSY_KEYWORD_TAXONOMY fallback that maps granular silver
              holloware/flatware/serveware types — "Berry Spoon", "Coffee
              Pot", "Koma Clasp", … — to real Etsy leaves so they're no
              longer stuck ineligible; DECISIONS.md session 9 eleventh
              addendum), pre-flight checks (incl. a non-blocking
              title↔product_type mismatch warning via titleImpliedJewelryType
              — DECISIONS.md session 9 sixteenth addendum), content-hash. Also
              mapProperties(): structured category properties (Material,
              Gold purity/solidity) — see "Structured category properties"
              below for what's covered and what's deliberately never
              guessed. Allowlist-based: only ever reads named Product fields
              into a fresh object, so cost_basis/minimum_price/
              internal_notes/etc. cannot structurally leak into a payload.
  images.ts   Supabase Storage / legacy /assets fetch (resolveImageUrl()
              resolves a relative path against getSiteUrl() first — Node's
              fetch() has no implicit origin like a browser does; see
              DECISIONS.md 2026-07-08 session 9 fourth addendum) -> sharp
              WebP->JPEG transcode (quality 90, flattened to white for
              alpha, format sniffed from bytes not extension, resized
              down-only to 2400px) -> multipart upload; pure image-diff
              planning (planImageDiff) and crash-window reconciliation.
              computeUploadWarnings() checks against Etsy's own photo
              guidance (both-dimensions 2000px, first-photo 635px, 1MB file
              size) — non-blocking, see DECISIONS.md 2026-07-08 (session 6)
  sync.ts     the step machine (pending -> draft_created -> images_synced ->
              inventory_synced -> active|draft_review), Phase 2 bulk queue
              (enqueue/drain), content-hash out-of-date scan, scheduled price
              push, handleProductStatusChange() (auto-delist/relist hook),
              and pushListingProperties() (best-effort structured-property
              push, part of the inventory step, never blocks the sync) —
              also calls length-experiment.ts's attemptLengthSync() unless
              ETSY_SYNC_BRACELET_LENGTH=false and ring-size-experiment.ts's
              attemptRingSizeSync() unless ETSY_SYNC_RING_SIZE=false (both ON
              by default as of session 9)
  length-experiment.ts
              Wearable length (2026-07-08 session 7, generalized session 9
              beyond Bracelet to every length-bearing category — Necklace/
              Pendant/Charm/Earrings/Brooch/Cufflinks/Watch/Coin/Bullion/
              Silverware) — a dynamic discover-write-verify cycle, see
              "Structured category properties" below. Live-resolves the
              real property/scale/value ids every time (never hardcoded),
              and reads every write back to verify before calling it a
              success.
  ring-size-experiment.ts
              Ring size ONLY (2026-07-08 session 9) — a genuinely different,
              enumerated property (real possible_values, e.g. "7 1/2",
              scoped to a region scale). Same write-then-verify discipline
              as length-experiment.ts, but never uses a placeholder — only a
              real, matched chart entry, or reports unsupported for that
              value. See "Structured category properties" below.
  store.ts    typed access to the five etsy_* tables (service-role only)
```

## Structured category properties (mapProperties, 2026-07-08 sessions 3 & 5)

Etsy's own listing editor shows "Suggested:" chips for several category
attributes (Material, Gold purity, Gemstone, Bracelet width/length,
Adjustable) when a seller edits a listing by hand. The v3 API has **no
endpoint that returns those UI suggestions** (confirmed by a full spec
search — only `allow_suggested_title`/`suggested_title` exists, a title
suggestion, not attributes). `mapProperties()` in `mapping.ts` pushes the
same *kind* of values ourselves via `updateListingProperty`
(`client.ts`), computed from data already on the product record, via a new
best-effort sub-step in `sync.ts`'s inventory step
(`pushListingProperties()` — per-property try/catch, a failure becomes a
`warnings[]` entry, never a thrown error).

Covers every `ETSY_TAXONOMY_MAP` product type, not just Bracelet:

| Property | Applies to | Notes |
| --- | --- | --- |
| Material (`148789511893`) | every product type | same id/value vocabulary across every pinned category — **confirmed correct on the owner's live listing** (session 5) |
| Gold solidity (`570246213608`) / Gold purity (`570246213609`) | every jewelry category **except** Cufflinks, Coin/Bullion, Silverware | those 3 categories have no such property on their taxonomy node at all — pushing either would 400. **Confirmed correct live** (session 5: "Solid gold"/"14k" both landed right) |

**Never guessed** (no source column anywhere in the product schema):
Gemstone, Bracelet/Pendant width, Adjustable, Jewelry closure type, Watch
band material. Fabricating any of these on a live listing for a business
priced on real melt value/purity would be worse than leaving Etsy's own
manual "Suggested" chip for the seller to fill in by hand.

### Length (`length-experiment.ts`, not `mapProperties()`)

Session 5 removed a hardcoded guess (`value_ids` mirroring the scale_id)
after it returned HTTP 200 but silently stored **"Gray"** (a color from
Etsy's shared global value vocabulary, completely unrelated to the Length
property) instead of "7.75" — proof that a wrong guess here corrupts the
live listing rather than failing safely into a warning, unlike every other
property above. Session 7 rebuilt it as a dynamic discover-write-verify
cycle: nothing is ever hardcoded (property id, scale id, and — where
applicable — value id are all resolved fresh from a live
`getPropertiesByTaxonomyId` call every time), `value_ids` is never derived
from the length number, and every write is immediately read back and
compared before being treated as a success.

**🟢 Confirmed working live (session 8):** `value_ids: ['']` — an
empty-string placeholder, never a guessed number — causes Etsy to
auto-generate and assign its own real, shop-scoped `value_id` for the custom
length value. Read back via `getListingProperties` (the "General Release"
list endpoint — the singular `getListingProperty` this originally used is a
non-production stub per its own spec description, "Development in progress,
will only return a 501"; that mistake caused a false-alarm 404 before the
fix) and independently verified correct: property "Length", scale "Inches",
value "7.75".

**🟡 Generalized (session 9) to every length-bearing category** — Necklace,
Bracelet, Pendant, Charm, Earrings, Brooch, Cufflinks, Watch, Coin, Bullion,
Silverware (Ring excluded — see Ring size below). The mechanism never
depended on Bracelet specifically, only the gating did. **ON by default in
the regular sync pipeline as of session 9 (seventh addendum)** — the owner
confirmed it works and asked for automatic pushing, so it now runs on every
length-bearing sync with no env var needed; set
`ETSY_SYNC_BRACELET_LENGTH=false` to disable it (env var name kept as-is to
avoid a rename). Every write still goes through discover→write→read-back→
verify, so a bad value fails closed into a warning. The computed length that
will push is shown in the dry-run preview (Length row) for review before
syncing — the old manual "Test Length" button was removed (session 9, ninth
addendum) as redundant once length auto-syncs. Full story:
`project-docs/DECISIONS.md` 2026-07-08 (sessions 7-9).

### Ring size (`ring-size-experiment.ts`, session 9)

A fundamentally different kind of property than Length: Etsy's "Ring size"
is a **real enumerated chart** (230 possible_values confirmed live for
taxonomy 1240) — fraction-notation sizes ("6", "6 1/2", "7 1/4"...), each
scoped to a region scale (US/CA, UK/AU, FR, DE). **UK/AU uses letter
notation entirely** ("A", "A 1/2", "B"...) for physically different sizes
than the same-looking US/CA number (confirmed via `equal_to`
cross-references) — real proof scale-scoping isn't optional caution here.

Because every standard size already has a real, discoverable `value_id`,
this **never needs Length's empty-string placeholder** — `buildRingSizePayload`
only ever uses a genuine possible_values match (scoped to the US/CA scale)
or returns `null` (unsupported for that specific value) when none exists,
never a guess or a fallback. Source data is the same `products.length`
field Length uses, parsed via the same dual-format acceptance already
established in `types/product.ts`. Runs only through the regular sync
pipeline (`attemptRingSizeSync`), ON by default unless
`ETSY_SYNC_RING_SIZE=false`; the computed size that will push is shown in the
dry-run preview (Ring size row) for review before syncing.

**🟢 Confirmed working live (session 9, addendum):** size 10.5 → "10 1/2" →
matched real chart entry `value_id 1604` (never invented) → written → read
back and independently verified correct (property "Ring size", scale
"US/CA", value "10 1/2"). Ran against a manually-overridden taxonomy leaf
("Multi-Stone Rings"), not the automatic guess — stronger proof the dynamic
discovery genuinely works per-listing, not just for one hardcoded default.
**ON by default in the regular sync pipeline as of session 9 (eighth
addendum)** — the owner asked for it to auto-push (same as Length); it now
runs on every Ring sync with no env var needed. Set `ETSY_SYNC_RING_SIZE=false`
to disable it. `buildRingSizePayload` only ever uses a real matched chart
value (never a guess/placeholder), and every write is read back and verified,
so a bad size fails closed into a warning. Full detail:
`project-docs/DECISIONS.md` 2026-07-08 (session 9, addendum + eighth addendum).

## Database (`supabase/etsy-sync.sql` — written, NOT yet applied)

Five additive tables, RLS-enabled with **no** anon/authenticated policies
(service-role only, same trust model as `webhook_events`):

- `etsy_connection` — single row (`id=1`): OAuth tokens (encrypted),
  shop id/name, shop defaults (shipping profile/return policy/readiness
  state), and sync policy (`auto_activate`, `auto_delist_on_sold`,
  `price_push_enabled`, `price_push_threshold_pct`, `price_markup_pct`).
- `etsy_oauth_states` — transient PKCE handshake rows (10-min TTL,
  opportunistically purged).
- `etsy_listings` — `product_id` (PK, FK to `products`, cascade) ↔
  `etsy_listing_id`, `sync_state` (the state machine), `content_hash`,
  `last_pushed_price`, `taxonomy_id`, `last_error`, `error_count`.
- `etsy_listing_images` — per-image checkpoint: `source_url`/`source_key`
  (change-detection identity), `etsy_listing_image_id`, `rank`,
  `bytes_sha256`.
- `etsy_sync_log` — audit/dead-letter: action, outcome, redacted message/detail.
- `claim_next_pending_etsy_listing()` — a `FOR UPDATE SKIP LOCKED` RPC so two
  concurrent "Sync all" drains can never grab the same product. Claims
  `sync_state='pending'` only. NOTE: a re-enqueued item that already exists on
  Etsy lands in `'pending'` WITH a listing_id; `runSyncStep` detects this
  (`effectiveMode='update'`) and runs the update path so it advances to a
  terminal state instead of being re-claimed forever — plus a `drainQueueCore`
  seen-guard + client stall guard bound any future non-advancing item. See
  DECISIONS.md 2026-07-08 (session 9, seventeenth addendum) — the bulk-sync
  runaway fix.

## API routes (`/api/admin/etsy/*`, admin-gated, service-role client)

| Route | Method | Purpose |
| --- | --- | --- |
| `connect` | GET | Start OAuth (PKCE), redirect to Etsy consent |
| `callback` | GET | Code exchange, resolve shop, persist connection |
| `status` | GET | Connection status, defaults, policy, recent activity log |
| `disconnect` | POST | Clear stored tokens (listings on Etsy untouched) |
| `settings` | PUT | Save shop defaults + sync policy |
| `shop-profiles` | GET | Proxy-read shipping profiles/return policies/readiness states |
| `preview` | POST | Dry-run: pre-flight + mapped payload, zero Etsy calls |
| `sync` | POST | One bounded step-machine invocation (`publish`\|`update`\|`price-only`) |
| `sync-batch` | POST | Phase 2: `enqueue` \| `enqueue-all-eligible` \| `drain` |
| `delist` | POST | Deactivate or reactivate a linked listing |
| `listings` | GET | Bulk `product_id -> sync_state` map (product table chip) |
| `eligibility-summary` | GET | Bulk pre-flight counts for the "Sync All" confirm screen |
| `verify-listing` | POST | Reconcile ONE listing's local state with Etsy's real state (read-only; clears a stale error, resets a 404 to not-listed) |
| `verify-all` | POST | Bulk reconcile ALL linked listings (`checkAllListingStatuses`) — the "Check Etsy statuses" button; read-only, no content re-push. See DECISIONS.md session 9 nineteenth addendum |
| `price-push` | POST | Phase 2 scheduled price push — secret-header-guarded, not admin-session-gated |
| `push-prices` | POST | Manual "Push prices now" — one bounded batch of the price-only push across live listings whose price drifted (ignores the daily threshold); client polls until done. See DECISIONS.md session 9 thirteenth addendum |

`/api/webhooks/etsy` (Phase 3, order ingest) is **not built** — the plan
documents `webhook_events` reuse for it but explicitly scopes it out of this
build.

## Admin UX

- **`/admin/settings` → Etsy Sync panel** (`EtsySettingsPanel.tsx`):
  connect/disconnect, shipping/return/readiness dropdowns, sync-policy
  toggles (auto-activate, auto-delist, price push + threshold), the markup %
  with an explicit **Save** button (it re-prices the whole catalog, so it
  commits deliberately, not on blur), a **Push prices to Etsy now** button
  (batched price-only re-push across all live listings, ignores the daily
  threshold), recent activity log, and the required Etsy trademark
  attribution line. Saving a *new* markup value marks prices stale and shows a
  highlighted callout above the push button (button turns gold) — because
  "Sync All" skips already-live items, "Push prices to Etsy now" is the tool
  that actually applies a markup change to live listings; the callout clears
  once the push completes (session 9, twentieth addendum).
- **Product Admin table** — a per-row Etsy status chip (Not listed / Draft /
  Needs review / Active / Out of date / Delisted / Error), fed by one bulk
  `/api/admin/etsy/listings` fetch (a local DB read, no Etsy API). Fetched on
  mount via a `refreshEtsyChips` callback, then re-run when the bulk sync modal
  closes and after any per-item drawer action (`onSynced` prop on
  `EtsyProductPanel`) so chips don't go stale after a sync (session 9,
  twentieth addendum).
- **Product edit drawer → Etsy section** (`EtsyProductPanel.tsx`): dry-run
  preview (pre-flight checklist + mapped title/price/tags/materials/
  when_made/category/photo count, plus the computed Length or Ring size that
  will auto-push on sync — session 9, ninth addendum, which replaced the old
  separate "Test Length"/"Test Ring Size" manual buttons), Sync to Etsy /
  Sync Updates with inline step progress, Deactivate/Reactivate on Etsy, a
  link to the live listing, and a per-item **Push price** button (lean
  price-only re-push for that one listing). Gated behind "save this listing
  first" for unsaved new products.
- **Toolbar → "Sync All to Etsy"** (`EtsyBulkSyncModal.tsx`, Phase 2): a free
  pre-flight summary ("N eligible · N ineligible · N up to date · N errors",
  with an expandable ineligibility sample list) before confirming, then
  enqueue + drain with live progress and a "stop after current item" cancel.

None of the admin UI is localized via next-intl — matches the rest of
`AdminShell.tsx`/`AdminSettingsPanel.tsx`, which are English-only by existing
convention.

## Lifecycle summary

Pre-flight (no Etsy calls) → create draft → upload images (checkpointed,
~4/invocation to stay inside a Netlify function's time budget) → set
inventory (price/qty) → activate or hold as `draft_review` (Q1 default:
draft-for-review, no auto-activate). Every step reads its DB checkpoint
first and is safe to repeat. **SKU is deliberately never pushed to Etsy**
(removed 2026-07-08, session 9, fifth addendum — Etsy's 32-char cap
rejected this catalog's longer slugs, and the owner has no use for it on
Etsy's side); this also means the SKU-adoption crash-recovery guard that
used to prevent a duplicate draft if a prior invocation died between
creating the Etsy draft and saving `etsy_listing_id` no longer applies — see
DECISIONS.md for the accepted trade-off.

Phase 2 adds: incremental updates via content-hash diff,
bulk enqueue/drain, auto-delist/relist wired into
`adminRevalidateProduct(s)`/PayPal capture/webhook, and a daily scheduled
price push gated by a ≥1%-of-last-pushed-price threshold (Q4).

## Field mapping highlights (full table: `etsy-sync-plan/02-field-mapping.md`)

- **Vintage fallback (Q2):** `item_year` more than 20 years old maps to its
  real decade bucket; missing or newer than the cutoff pushes as `1990s`
  (owner-attested fallback), flagged (never blocking) in the dry-run. Cutoff
  is a rolling `currentYear - 20` in UTC, not a frozen year.
- **Price (Q5):** flattened via `calcSpotPriceValue`/`parseManualPriceLabelValue`
  (`lib/pricing.ts`), then an 8%-default Etsy-fee markup (admin-editable),
  rounded to 2 decimals, rejected under Etsy's $0.20 minimum. Site pricing is
  never touched.
- **Allowlist guarantee:** `cost_basis`, `minimum_price`, `internal_notes`,
  `private_price_label`, `melt_value`, `live_spot_snapshot`,
  `acquisition_date`, `acquisition_source` can never appear in a payload —
  enforced structurally (the mapper only ever reads named fields) and by a
  unit test.
- **Eligibility (Q7):** everything `available` syncs, including Coin/Bullion;
  a per-item Etsy rejection is a warning, never a batch-blocking failure.

## Build-time resolutions and known gaps

See `project-docs/DECISIONS.md` (2026-07-08, "Etsy sync build-time
resolutions" and "even later — two real auth bugs found and fixed") for the
full list and reasoning. Headline items:

- **`when_made` enum confirmed** against the live OpenAPI spec (19 values,
  pinned verbatim in `mapping.ts`) — more precise than the plan's original
  guess for the 2000–2006 bucket.
- **Two real auth bugs found and fixed from a full local spec copy:** the
  `x-api-key` header must be `keystring:shared_secret` (not the keystring
  alone — the plan and the first build pass got this wrong, and it broke
  every single API call with `"Shared secret is required in x-api-key
  header"`), and the API host is `openapi.etsy.com`, not `api.etsy.com`.
  **`ETSY_SHARED_SECRET` is now required from day one**, not Phase-3-only.
  Fixed in `next-app/src/lib/etsy/client.ts`/`auth.ts`. **Not yet re-verified
  live** with the corrected format.
- **Taxonomy leaf IDs are now pinned** (2026-07-08, real
  `getSellerTaxonomyNodes` call — the fix above, confirmed live). 6 of 12
  product types are exact category matches; 6 are marked
  `approximate: true` in `ETSY_TAXONOMY_MAP` because Etsy has no generic/
  plain leaf for that product type (e.g. no "chain necklace" or "bullion"
  category exists at all) — the dry-run preview flags these non-blockingly
  so the owner can review/override the pick. Pre-flight no longer blocks on
  this.
- **Two `TODO(etsy-verify)` items remain** (down from four — the readiness-
  state endpoint path and the image-rerank question were both confirmed
  against the full spec): image upload size/format caps, and rate-limit
  response header names. Neither appears anywhere in the machine-readable
  spec, likely prose-only (seller-help docs).
- **The daily price-push trigger is not wired** — the route
  (`POST /api/admin/etsy/price-push`, `x-cron-secret` header) exists and is
  trigger-agnostic; scheduling it (a Netlify Scheduled Function or any
  external cron) is a short owner/developer task.

## Verification status

**Done, confirmed live (across this session, 2026-07-08):** `supabase/etsy-sync.sql`
ran successfully; **Connect Etsy** OAuth round-trip succeeded on the first
real attempt (verified directly against Supabase, not just "no error
shown"); taxonomy IDs are pinned from a real `getSellerTaxonomyNodes` call;
a first real draft synced end-to-end (bracelet
`heavy-italian-14k-yellow-gold-cuban-link-bracelet-53-91g-21`, now
`draft_review` on Etsy) after fixing two real bugs found only by driving a
live sync (missing `readiness_state_id`, a retry-from-error state-machine
gap — see DECISIONS.md "session 2"). `npx tsc --noEmit`, `npm run lint`
(0 problems), `npm run build` all pass. **69 unit tests pass** (`npm run
test`) covering mapping rules (title/tags/materials/properties/when_made/
price/allowlist), image transcode, image-diff planning, price-push
threshold logic, and the bulk-drain orchestration loop.

**Not yet verified live:** the new structured-properties push
(`mapProperties`/`updateListingProperty`, session 3 — see above; safe either
way since it's non-blocking), token refresh, the scheduled price push,
delist/relist, resume-after-interrupt, and a dry-run across more than one
product. Full remaining checklist:
`etsy-sync-plan/14-verification-checklist.md`.

**Owner/developer next steps:** click **Sync Updates** on the bracelet (or
any product) to confirm the properties push landed correctly (see
CURRENT_STATUS.md 2026-07-08 session 3 for exactly what to look for), then
continue down `etsy-sync-plan/14-verification-checklist.md`'s remaining
Phase 1 items.
