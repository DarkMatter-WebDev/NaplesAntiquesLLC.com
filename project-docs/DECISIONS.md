# Decisions Log

## 2026-07-08 (session 9, twentieth addendum) - Markup→price workflow made explicit + status chips refresh after a sync

**Context:** the owner changed the Etsy price markup, re-synced, and the live
Etsy prices didn't move — and separately noted the admin table's status chips go
stale after a sync.

**Diagnosis of (1) — not a save bug, a tool-choice bug.** Verified live against
Supabase: the markup persisted correctly (`etsy_connection.price_markup_pct =
10`; the settings route parses `Number(priceMarkupPct)`). The real issue: the
owner re-priced via **"Sync All to Etsy"**, but `enqueueAllEligible` *by design*
only queues items that are NOT already `active`/`draft_review` (it's for getting
new items up, not re-pricing live ones), so live listings are skipped. Changing
the markup only changes what *future* syncs compute; it does nothing to
already-pushed prices on its own. The correct tool already existed — **"Push
prices to Etsy now"** in Settings → Etsy Sync (`pushPricesBatch`: pushes every
`active`/`draft_review` listing whose freshly-computed price differs from
`last_pushed_price`, ignoring the daily-scheduler threshold) — but nothing tied
"I just changed the markup" to "now click that button."

**Decision — make the dependency visible rather than change the mechanics.**
Keeping "Sync All" skipping live items is correct (re-uploading images/details
for the whole catalog to change a price would be wasteful and slow). So instead:
- `EtsySettingsPanel` tracks a `pricesStale` flag — set true when the markup is
  saved to a value different from the last saved one, cleared when a price push
  completes. While set, a highlighted gold callout renders above the push button
  ("your live Etsy listings still show the old prices … click Push prices to
  Etsy now … Sync All intentionally skips already-live items"), and the push
  button itself switches from `outline-button` to `gold-button` to draw the eye.
- This is purely a discoverability/guardrail nudge; the underlying push logic is
  unchanged. `last_pushed_price` is null on all current live items, so the first
  push after deploy will (correctly) re-price all of them to the new markup.

**Decision for (2) — refresh chips locally, still no extra Etsy calls.** The
row chips come from `AdminShell`'s single `/api/admin/etsy/listings` read, which
is a **local DB query only** (confirmed nineteenth-addendum work; `getListingsMap`
does one `etsy_listings` select, no Etsy API). It was fetched once on mount and
never again, so it went stale after syncs. Extracted it into a `refreshEtsyChips`
`useCallback` (mount effect now just calls it) and re-invoke it at the two points
where state actually changes: when the bulk sync modal closes, and after any
per-item drawer action via a new optional `onSynced` prop on `EtsyProductPanel`
(fired in the `finally` of runSyncLoop / runAction / checkStatus / pushPriceOnly,
right after its own `loadPreview`). Deliberately NOT wired into `loadPreview`
itself (that also runs on mount/manual-refresh and would double-fetch). Net: zero
additional Etsy API traffic — the same cheap local read, just re-run when the
data could have changed.

**Verification:** `npx tsc --noEmit`, `npm run lint`, `npx vitest run`
(154/154), `npm run build` all pass. No schema/migration change; no owner action
beyond deploy. Files: `next-app/src/components/admin/EtsySettingsPanel.tsx`,
`next-app/src/components/admin/AdminShell.tsx`,
`next-app/src/components/admin/EtsyProductPanel.tsx`.

## 2026-07-08 (session 9, nineteenth addendum) - Bulk "Check Etsy status of all" + recover items stuck in 'error'

**Context:** the owner forgot to set the Etsy env vars in Netlify, so a "Sync
All" errored all 55 non-terminal items ("no API key"). After redeploying with
the vars set, those 55 sat in `sync_state='error'`, which the eligibility
summary buckets separately (`0 eligible · 55 errors`) and START disables at
`eligible===0` — so there was no way to recover them from the bulk UI. The
items are actually fine on Etsy (drafts); the error was a transient config
issue.

**Fix — a bulk reconciliation + making errors retryable:**
1. **`reconcileSyncStateFromEtsy(current, etsyState)` (pure, `sync.ts`)** — maps
   Etsy's reported state onto our sync_state, and crucially now CLEARS a stale
   `'error'`: an errored row that Etsy shows as a draft returns to
   `draft_review` (active→active, inactive/sold_out/expired→delisted). Extracted
   so both the per-item and bulk checks share it; `checkListingStatus` was
   refactored onto it (and now also clears the error + `last_error`/`error_count`).
2. **`checkAllListingStatuses()` + `/api/admin/etsy/verify-all`** — reconciles
   EVERY linked listing against Etsy (read-only GET per listing, no content
   re-pushed; 404 → reset to not-listed; a connection-level failure stops with a
   clear message). One call handles the catalog under the route's 60s budget.
3. **`EtsyBulkSyncModal`** — a **"Check Etsy statuses"** button on the summary
   (with a hint shown when errors>0), which runs the bulk check then refreshes
   the counts so reconciled errors move to "up to date." Also **enabled START
   when there are errors** (not just `eligible>0`) so error items can be
   re-synced too (`enqueueAllEligible` already enqueues them; the seventeenth
   addendum makes them re-sync as updates).

**Two recovery paths, both now available:** *Check Etsy statuses* (read-only,
recommended for stale errors — the 55 → draft_review with zero Etsy writes) or
*Start* (re-sync/update). Reconciliation is the light default.

**Verification:** `npx tsc --noEmit` (clean), `npx vitest run` (154/154 — 4 new
`reconcileSyncStateFromEtsy` tests incl. the error→draft_review recovery and
keeping finer in-pipeline states), `npm run lint` (0 problems), `npm run build`
(succeeded; `/api/admin/etsy/verify-all` in the manifest). Bulk/UI paths are
I/O and not unit-tested directly, per this module's precedent. **Owner action:**
deploy, open "Sync All to Etsy", click **Check Etsy statuses** — the 55 errored
items reconcile to their real Etsy state and clear.

## 2026-07-08 (session 9, eighteenth addendum) - Bulk sync: surface the real drain error + contain per-item throws

**Problem:** after the seventeenth-addendum deploy, "Sync All" failed with a
generic **"Batch sync failed."** Root of the OPACITY: `EtsyBulkSyncModal`'s
drain loop did `throw new Error('Batch sync failed.')` on any non-OK response,
ignoring the route's `{ error: <real message> }` — the same diagnostic gap as
the earlier SKU/"&" 400s. Root of the FRAGILITY: `runSyncStep` catches its own
step errors (inside its try), but a throw from the pre-flight setup that runs
BEFORE that try — `fetchSpotData` / `ensureFreshAccessToken` /
`buildMappedPayload` — is uncaught, so it propagates through `drainQueueCore` →
`drainQueue` → the route's catch → a 500 that fails the ENTIRE batch (and isn't
written to `etsy_sync_log`, which is why the failure left no trace).

**Fix:**
- **Client (`EtsyBulkSyncModal`):** the drain loop now throws
  `data?.error || 'Batch sync failed.'` — the server's real message reaches the
  owner.
- **Drain (`drainQueue`):** wraps each item's `runSyncStep`. A per-item throw
  is contained — the item is marked `error` + logged, and the drain continues,
  so one bad listing can't sink the batch. A CONNECTION-level error
  (`isConnectionLevelEtsyError`: EtsyApiError 401/invalid_grant/auth_expired/
  oauth_token_failed, or a message about reconnect/refresh token/shop id)
  rethrows, so the batch stops with an actionable "reconnect Etsy" message
  rather than marking the whole catalog errored.

**Cause of the specific failure NOT confirmed:** verified live the OAuth token
was still valid (expiry 20:21 UTC, failure earlier), the pre-Etsy path
(`buildPreflightChecks` + `buildMappedPayload`) throws for none of the 55
pending items, and `etsy_sync_log` had only `ok` rows around the failure. So it
was an uncaught throw somewhere in the Etsy-calling path, or a transient /
Netlify-function-level blip not visible from here. The two fixes make the next
occurrence self-explanatory (visible message) and non-fatal (contained), which
is the right posture regardless of the exact trigger.

**Verification:** `npx tsc --noEmit` (clean), `npx vitest run` (150/150 — the
drain wrapper is I/O and not unit-tested directly, per this module's precedent;
`drainQueueCore` and its seen-guard remain covered), `npm run lint` (0
problems), `npm run build` (succeeded). **Owner action:** re-run "Sync All" and
report the now-specific error if it recurs.

## 2026-07-08 (session 9, seventeenth addendum) - 🔴 Fixed a bulk "Sync All" runaway (unbounded API calls) on already-synced items

**Bug (owner-reported):** the bulk "Sync all to Etsy" progress read "Processed
79 of 55 · 55 remaining" and kept climbing (120+ before the owner closed it),
with "remaining" pinned at the total — i.e. it was re-processing the same items
endlessly, burning Etsy's rate budget.

**Root cause:** `enqueueAllEligible` resets every eligible non-(active/
draft_review) item to `sync_state='pending'` — including items already on Etsy
(with an `etsy_listing_id`). The drain then calls `runSyncStep(id, 'publish')`,
but for a `'pending'` item that ALREADY has a listing_id, every publish step is
gated out: step 1 (create) needs no listing_id, step 2 (images) needs
`draft_created`/`error`, step 3 (inventory) needs `images_synced`. So it
returned `done:true` while leaving the item `'pending'` — never advancing. The
claim RPC (`claim_next_pending_etsy_listing`, `supabase/etsy-sync.sql`) claims
`sync_state='pending'` ordered by `updated_at`, bumping it on claim, so each
8-second drain pass re-claimed the same stuck items over and over; the client
loop (no stall guard) polled forever, inflating "processed" without bound.

**Fix — three layers:**
1. **Root cause (`sync.ts` `runSyncStep`):** a `'pending'` item that already
   has a listing_id is a re-sync of an existing listing → compute
   `effectiveMode = 'update'` and use it to gate steps 2-4, and broaden step 4
   to transition such an item to a terminal state (`draft_review`/`active`). It
   now pushes the current mapping via the UPDATE path — image DIFF (NOT a
   re-upload — answers the owner's prior question: re-syncing does not re-push
   unchanged photos), inventory, properties, copy — and leaves the queue.
2. **Server safety net (`drainQueueCore`):** a per-pass `seen` set — if an item
   is re-claimed after already being processed this pass (didn't leave the
   queue), stop the pass instead of cycling. Bounds the damage of any FUTURE
   non-advancing item to one pass.
3. **Client safety net (`EtsyBulkSyncModal`):** stall detection — if
   `remaining` stays identical for 5 consecutive polls, stop with a clear
   message (a legit slow multi-photo item keeps it flat for ≤3 polls).

**No manual data cleanup needed / no migration.** The ~55 rows currently stuck
in `'pending'` (with listing_ids) will be processed correctly by the first
drain AFTER this deploys — the fixed `runSyncStep` re-pushes their current
content and moves them to `draft_review`. **Until deployed, don't re-run "Sync
All"** (the live/Netlify code still has the bug and will loop again); those
items also show as "Not listed" in the admin until that post-deploy sync
corrects them.

**Verification:** `npx tsc --noEmit` (clean), `npx vitest run` (150/150 — new
`drainQueueCore` seen-guard test simulating a re-claimed stuck item; existing
drain tests still green), `npm run lint` (0 problems), `npm run build`
(succeeded). The root-cause path (live-DB + Etsy) isn't unit-tested directly,
per this module's precedent; the pure orchestration guard is. **Owner action:**
deploy, then run "Sync All" once — it should now finish (processed ≈ items, not
climbing) and the stuck items land in draft_review.

## 2026-07-08 (session 9, sixteenth addendum) - Pre-flight warning for title↔product_type mismatches

**Decision:** Owner accepted the follow-up offered in the fifteenth addendum —
a non-blocking pre-flight warning so a mistyped `product_type` (which silently
mis-categorizes an item) is caught in the dry-run before syncing, not spotted
later on Etsy.

**Implementation (`mapping.ts`):** `titleImpliedJewelryType(title)` returns the
type a title implies **only when exactly one** mainstream keyword appears —
zero (e.g. "Berry Spoon") or two-plus ("Necklace and Bracelet Set", "Pendant
Necklace") return null, so sets/ambiguous titles never fire. `buildPreflightChecks`
adds a `type_title_mismatch` check (`ok: true` → renders as an amber warning,
never blocks) when the implied type and the actual `product_type` fall in
different **groups**. Types are grouped so intra-group swaps don't nag:
`neck` = Necklace/Pendant/Charm, plus `wrist`/`ring`/`ears`/`pin`/`cuff`/`watch`.
So a "bracelet" title on a Necklace warns; a "Pendant" title on a Charm (the
owner's Mickey item) does not; and granular silver types (Spoon/Tray/etc.,
which normalize to no group) never warn.

Deliberately a WARNING, not a block or an auto-correction: `product_type` is
owner-controlled data used app-wide; the tool's job is to surface the likely
mistake, not silently override it (title parsing is too coarse to trust as
truth). Word boundaries guard the obvious traps (`\bring\b` doesn't match
"earring").

**Verification:** `npx tsc --noEmit` (clean), `npx vitest run` (149/149 — 8 new
tests: the helper's single/zero/multi-keyword behavior incl. the earring↔ring
guard, and the pre-flight check firing on the live bracelet-as-Necklace case,
staying silent on matches / within-group swaps / sets / granular silver types),
`npm run lint` (0 problems), `npm run build` (succeeded). Not demoable live now
(the two real mismatches were already corrected), but it's exercised by the
per-product preview + bulk eligibility routes for any future mistype.

## 2026-07-08 (session 9, fifteenth addendum) - Data fix: bracelets mislabeled as "Necklace"; left the mapping alone

**Decision:** Owner reported a Cuban-curb-link bracelet syncing to Etsy under
Necklaces > Chains with "necklace" tags. Diagnosis: the mapping is correct —
the item's `product_type` was literally `Necklace` (a data-entry error), and
`product_type` is the single source of truth for categorization across the
whole app (shop filters, Etsy category, Etsy tags). So the fix is to correct
the DATA, not to add title-parsing overrides to the mapping (that would fix
Etsy but leave the item mis-filed in the on-site shop, and title parsing
false-positives on sets/incidental mentions).

Audited all 75 products for title↔type mismatches: 5 total. **2 unambiguous**
(bracelets typed as Necklace) → corrected `product_type`+`jewelry_type` to
`Bracelet` via a direct service-role UPDATE:
`vintage-tiffany-...-cuban-curb-link-bracelet-26`,
`italian-14k-yellow-gold-figaro-link-bracelet-25`. **3 left alone** as
legitimate owner choices: a "Mickey Mouse … Pendant" typed `Charm` (Charm vs
Pendant is a judgment call — owner's), and two "Koma Clasp" items (the owner's
deliberate granular type, intentionally mapped to Brooches).

Direct DB write (not the admin form) → bypasses the app's instant
revalidation; the shop catches up via ISR (~5 min), and the Etsy drafts update
when the owner clicks Sync Updates (`setListingCopy` sends `taxonomy_id`, so
the category — not just tags — moves to Bracelet).

**Verified downstream (live):** the corrected Tiffany bracelet now resolves to
`resolveTaxonomy('Bracelet')` = 1196 "Jewelry > Bracelets > Chain & Link
Bracelets" (exact) and `mapTags` yields "cuban link bracelet" / "solid gold
bracelet" / etc. No code changed — no build/test impact. **Considered but not
built:** a pre-flight WARNING when a title strongly implies a different type
than `product_type` (would catch future mistypes before they sync) — offered
to the owner as a follow-up rather than added unprompted.

## 2026-07-08 (session 9, fourteenth addendum) - Site-wide default for the customer trade-in price (% over/under spot)

**Decision:** Owner wanted to set the "Own gold or silver? … pay as little as
___" trade-in line to something other than the spot melt value for ALL items
at once, while keeping the existing per-item override to fine-tune individuals.

**Design:** the only universal setting that works across items with different
melt values is a **signed percent over/under melt** (a flat dollar amount can't
apply catalog-wide) — which also mirrors the existing per-item `percent`
override mode. Stored on the single-row `shop_settings` table
(`special_price_default_enabled` + `special_price_default_percent`, the percent
signed so negative = below spot). New
`resolveAdvertisedTradeInPrice(product, meltValue, siteDefault)` in
`types/product.ts` resolves the full precedence in one place: **per-item
override wins → else the site-wide default → else the plain melt value.** The
scrap-value box (the real computed value) is untouched — only the marketing
trade-in line changes.

**Where:** new **Customer Trade-in Price** panel in Admin → Settings
(`AdminSpecialPricePanel.tsx`), a checkbox + signed-percent input + dirty-aware
Save with a live "$1,000 melt → $X" example. The `shop_settings` admin route
was widened to a partial patch (GET returns both settings; PUT accepts either
`showSoldItems` or the new fields) — the existing Shop Visibility toggle still
works unchanged. `shop-settings.ts` gained `fetchSpecialPriceDefault` /
`saveSpecialPriceDefault`, both **degrading to `{enabled:false, percent:null}`**
on any error (incl. the columns not existing pre-migration). The public
product page (`shop/[id]/page.tsx`) fetches the default and feeds it to the new
resolver.

**Propagation:** the list-view cache (`shop-catalog` tag) is busted on save;
individual product pages are time-revalidated (ISR, ~5 min) like the spot
values they already show — so a change appears within ~5 minutes, consistent
with existing spot-price behavior. Not made instant (revalidating every product
path is heavy and unnecessary for a pricing knob).

**🔴 PENDING MANUAL STEP:** run `supabase/shop-special-price-default-2026-07.sql`
in Supabase (adds the two columns). Verified live that the columns don't exist
yet, so **until it runs the feature is simply off** and every page shows the
plain melt value (confirmed live: `/en/shop/10k-cuban-link-chain-01` renders
its melt value `$6,545` unchanged). The canonical `supabase/shop-settings.sql`
was also updated for fresh installs.

**Verification:** `npx tsc --noEmit` (clean), `npx vitest run` (141/141 — 5 new
`resolveAdvertisedTradeInPrice` tests: precedence, positive/negative/zero
percent, null-melt, per-item-wins), `npm run lint` (0 problems), `npm run
build` (succeeded). Live: confirmed the new columns 400 (degradation path) and
a real product page still renders its melt-value trade-in line. **Admin panel
not driven** (needs a login the preview lacks) — compiles + type-checks. Owner
action: run the SQL, then Admin → Settings → Customer Trade-in Price → enable +
set a % → Save, and confirm a product page updates within ~5 min.

## 2026-07-08 (session 9, thirteenth addendum) - Etsy sync: explicit Save on the markup + dedicated "Push prices now" (bulk + per-item)

Two related owner asks about re-pricing.

**1. Save button for the Etsy price markup.** The markup field auto-saved
on blur (like the other settings). Since it re-prices the whole catalog, the
owner wanted a deliberate commit. `EtsySettingsPanel.tsx`: the markup is now a
controlled field with an explicit **Save** button that's disabled until the
value changes. Implemented with a no-effect derived pattern (`markupInput`
is `null` until typed → the field shows the saved value; `saveSettings` now
returns a success boolean so the field resets only on a confirmed save) —
avoids the `react-hooks/set-state-in-effect` rule this codebase enforces, and
never clobbers an in-progress edit when another setting triggers a status
reload.

**2. "Re-sync everything" is the WRONG tool for prices — added a dedicated
price push.** Investigated the owner's question and found: the bulk "Sync All
to Etsy" (`enqueueAllEligible`) deliberately **skips** already-active/
draft_review listings (sync.ts) — so it never re-prices what's already up. The
only existing ways to update a live listing's price were per-item "Sync
Updates" (a full, heavy update — images/properties/copy, one at a time) or the
daily scheduled push (cron-only + threshold-gated, so a ~1.85% markup bump can
fall under the threshold and never fire). Owner chose "All + per-item", so:
- **`pushPricesBatch()` (sync.ts) + `/api/admin/etsy/push-prices`**: re-sends
  the current price of every live listing whose price differs from
  `last_pushed_price`, via the lean `price-only` path (`updateListingInventory`
  only — no image/property work), **ignoring the threshold** (a markup change
  is deliberate, not spot-drift noise). Batched (8/call) + resumable so it
  can't time out; the client polls until `done`. Idempotent (a listing already
  at the right price is skipped) and stall-guarded (a persistently-failing item
  can't spin forever — same repeated-`remaining` guard as the product panel's
  sync loop).
- **"Push prices to Etsy now"** button in Etsy Sync settings (drives the batch
  poll with live progress) and a per-item **"Push price"** button in each
  product's Etsy drawer (a one-shot `price-only` sync — that mode returns in a
  single call, no polling).

**Verification:** `npx tsc --noEmit` (clean), `npx vitest run` (136/136 — the
new batch/UI paths are I/O-bound and not unit-tested, matching the precedent
that `runScheduledPricePush` / `runSyncStep` aren't either; the pure price
comparison reuses the already-tested `shouldPushPrice` sibling logic), `npm run
lint` (0 problems), `npm run build` (succeeded, `/api/admin/etsy/push-prices`
in the manifest). **Not yet exercised live** — owner action: change the markup
→ Save → "Push prices to Etsy now" and confirm live prices update; or "Push
price" on a single listing.

## 2026-07-08 (session 9, twelfth addendum) - Etsy sync: two live 400s were a title rule ("&" once), plus made Etsy field-errors legible

**Decision:** After the eleventh-addendum fix, the owner bulk-synced — most
succeeded, **two failed with "Etsy request failed (400)."** The generic
message hid the cause, so I read `etsy_sync_log.detail` directly (service-role
REST): both were the *same* real error, and NOT category-related —

```
{ path: "/title/0", type: "too_many_invalid_characters",
  message: "& can only be use once" }
```

**Etsy allows the "&" character at most once in a listing title.** Both items
had two: "…Pierced Scroll **&** Foliate … Sterling **&** England…" and "Gran
**&** Laglye … Grape **&** Scroll…". The jewelry items that synced had 0–1.
This is a pre-existing title gap, unrelated to the taxonomy work.

**Two fixes:**
1. **`mapTitle` (`mapping.ts`)** now keeps the first "&" and spells the rest as
   "and" (done before the 140-char cap since "and" is longer). Verified against
   the two real titles: both drop from 2 "&" to 1, the maker name ("Gran &
   Laglye") and first descriptive pair stay intact.
2. **`extractEtsyMessage` (`client.ts`)** — the real reason was captured in the
   log `detail` but never reached the UI, because Etsy returns field-validation
   errors as a numeric-keyed object (`{ "0": { path, message } }`), not the
   simple `{ error: "…" }` the mapper read. Now it parses both shapes, so a
   title/tag/field rejection surfaces as e.g. "Etsy rejected the request:
   title: & can only be used once" instead of a useless "Etsy request failed
   (400)." A real diagnostic gap — this same blindness is what made the earlier
   SKU-length and this "&" error both show as bare 400s at first.

**Verification:** live sync-log read pinpointed the cause; the two real titles
now map to ≤1 "&" (confirmed against live data); `npx tsc --noEmit` (clean),
`npx vitest run` (136/136 — 7 new: mapTitle "&"-once cases + a new
`client.test.ts` covering `extractEtsyMessage` against the exact captured Etsy
body), `npm run lint` (0 problems), `npm run build` (succeeded). **Owner
action:** re-sync those two silver pieces (Serving Spoon + Oval Gallery Tray) —
they should now publish; any future field rejection will show its real reason.

## 2026-07-08 (session 9, eleventh addendum) - Etsy sync: unblocked the 22 "ineligible" silver items via a granular product-type → taxonomy keyword fallback

**Decision:** Owner's bulk "Sync all to Etsy" screen showed **22 ineligible**
items — all sterling/silver serving pieces. Investigated by running the real
`buildPreflightChecks` against the live catalog (74 available products): **all
22 failed on the `taxonomy` check and nothing else.** Root cause: the owner
enters *granular* product types (`Berry Spoon`, `Cold Meat Fork`, `Coffee
Pot`, `Salt Cellar`, `Koma Clasp`, `Tray`, `Napkin Ring`, `Decanter Label`,
`Tazza Set`, …) but `ETSY_TAXONOMY_MAP` only has ~13 coarse
`ProductJewelryType` keys — anything unmapped → `resolveTaxonomy` returns null
→ blocked.

**Fix (`next-app/src/lib/etsy/mapping.ts`):** added `ETSY_KEYWORD_TAXONOMY`, an
ordered keyword→leaf fallback consulted only when the coarse map misses. Every
target is a REAL Etsy leaf id fetched live from `seller-taxonomy/nodes` (same
"never guess an id" discipline as the "Gray" incident):
- Flatware (spoon/fork/knife/ladle/server/tongs/…) → **1048** Flatware &
  Silverware — *exact*.
- Trays → **2537**; platters/tazza → **2538**; coffee/tea pots → **1932**
  Teapots; salt cellars → **1050**; gravy boats → **2639**; sugar bowls →
  **2641**; creamers → **2642**; bowls/dishes → **1044** — flagged
  *approximate*.
- Bhutanese **Koma** clasps / garment hooks → **1201** Brooches (they're worn
  adornments, not tableware) — *approximate*.
- Napkin rings / decanter labels (no dedicated Etsy leaf) → 1048 *approximate*.

Deliberately **Etsy-scoped** — it lives in the taxonomy resolver, NOT in
`normalizeProductJewelryType` (which is app-wide: shop filters, pricing, AI
autofill). The owner keeps their granular product types; only the Etsy category
is derived. Re-ran the live pre-flight after the change: **0 ineligible, all 74
now eligible.** Approximate fits show "Closest match — review" in the dry-run
and the owner can override per item with the existing category picker.

**Also:** the bulk modal's "Why some items are ineligible" list now shows the
*reason* per item (first failing check's message), not just the title — so a
future unmapped type is self-explanatory instead of a mystery
(`eligibility-summary` route + `EtsyBulkSyncModal.tsx`).

**Verification:** live pre-flight re-run (0 blocked, down from 22); `npx tsc
--noEmit` (clean), `npx vitest run` (129/129 — 5 new tests: flatware→1048
exact, holloware→approximate leaves, Koma→Brooch, coarse types undisturbed,
and an unmappable type still returns null), `npm run lint` (0 problems), `npm
run build` (succeeded). **Not yet synced live** — owner action: reopen "Sync
all to Etsy" (should now read ~70 eligible / 0 ineligible) and spot-check a few
categories in the per-item preview, overriding any approximate holloware fit
that isn't right.

## 2026-07-08 (session 9, tenth addendum) - Etsy sync: Check Etsy Status now reconciles draft→active; "View on Etsy" points at shop-manager pages

Two owner-reported issues after successfully activating a listing on Etsy.

**1. "Check Etsy Status" didn't update the chip.** Owner activated a draft
directly on etsy.com, came back, clicked Check Etsy Status — the toast said
success but the chip stayed "Draft on Etsy — needs review." Root cause:
`checkListingStatus()` in `next-app/src/lib/etsy/sync.ts` only *reported*
Etsy's real state when the listing still existed (it only wrote back on the
404/deleted case). So a draft→active transition on Etsy was never persisted.
Fixed: when the listing still exists, it now maps Etsy's coarse state onto our
row and writes it when changed — `active` → sync_state `active` +
listing_state `active`; `inactive`/`sold_out` → `delisted`/`inactive`;
`expired` → `delisted`/`ended`; `draft` → keeps our finer draft-family
sync_state (draft_created/images_synced/inventory_synced/draft_review), only
stepping back to `draft_review` if we'd wrongly recorded it active/delisted.
Unrecognized states are still report-only (no clobber). A no-op (already in
sync) writes nothing and logs nothing. The client already reloads the
listings map after a status check, so the chip now flips to "Active on Etsy"
immediately.

**2. "View on Etsy" went to the public listing URL.** It linked to
`etsy.com/listing/<id>`, which doesn't work for a draft (drafts aren't
public) and isn't where the owner wants to land anyway. Per the owner's
request it now points at their shop-manager listing views
(`EtsyProductPanel.tsx`): an **active** listing →
`https://www.etsy.com/your/shops/me/tools/listings?ref=seller-platform-mcnav`;
anything else (draft/inactive/unknown) → the same with
`&state=draft&sort=update_date`. Decision is driven by `listing_state`, which
fix #1 now keeps accurate — so after a status check flips a listing to active,
the link switches to the active view too. (The unrendered `listingUrl` field
still returned in sync results was left as-is — it's not shown anywhere.)

**Verification:** `npx tsc --noEmit` (clean), `npx vitest run` (124/124 — no
test covers `checkListingStatus`, which needs a live Etsy connection, matching
the module's existing precedent), `npm run lint` (0 problems), `npm run build`
(succeeded). **Not verified live** — owner action: activate a draft on Etsy,
click Check Etsy Status, confirm the chip flips to "Active on Etsy" and "View
on Etsy" opens the active-listings manager view.

## 2026-07-08 (session 9, ninth addendum) - Etsy sync: removed the manual "Test Length/Ring size" windows, folded both into the dry-run preview

**Decision:** Owner: *"remove the 'manual test' windows.. and fold the
length / size / etc fields into the dry-run preview and let user see/approve
that way."* Now that length and ring size both auto-push on sync (seventh +
eighth addenda), the separate manual "Test Length" / "Test Ring Size"
buttons — scaffolding from the investigation phase — were redundant. The
owner reviews and approves the value the normal way: it shows in the
dry-run, they click Sync.

**UI (`EtsyProductPanel.tsx`):** removed both manual-test sections (inputs,
Test buttons, JSON read-back result boxes) and all their state/handlers.
Added a **Length** row (for length-bearing types) and a **Ring size** row
(for Rings) to the existing dry-run preview grid, each showing the computed
value that will push (e.g. "7.75 in · pushes on sync", "10 1/2 (US/CA) ·
pushes on sync") or "No length set — nothing to push" when the source field
is empty.

**Preview route (`preview/route.ts`):** computes those two strings with the
existing PURE parsers (`parseWearableLengthInches`, `parseRingSize` +
`decimalToRingSizeFraction`) — **no Etsy calls**, keeping the dry-run's "no
reads, no writes" guarantee. The real property-id/scale discovery and
read-back verification still happen at sync time. Gating matches sync.ts
exactly (verified the `ProductJewelryType` union is closed at 13 values, so
"not Ring/Other/null" == the LENGTH_BEARING set).

**Dead-code cleanup:** with the manual UI gone, the two API routes
(`/api/admin/etsy/length-experiment`, `/api/admin/etsy/ring-size-experiment`)
and the two manual entry-point functions (`runLengthExperiment`,
`runRingSizeExperiment`, incl. their active-listing safety rail — irrelevant
now that these only run through the normal sync path) had no callers, so
they were deleted along with their now-unused imports. The automatic core
(`attemptLengthSync` / `attemptRingSizeSync`) and all pure functions are
untouched — only the manual wrappers went.

**Verification:** `npx tsc --noEmit` (clean — after a `npm run build` to
regenerate the stale `.next/types` route validator that still referenced the
deleted routes), `npx vitest run` (124/124 — tests only import the pure
functions, which are unchanged), `npm run lint` (0 problems), `npm run build`
(succeeded, manifest confirms both experiment routes gone). Also restarted
the dev server to clear a stale Turbopack/OneDrive compiled chunk still
referencing removed state (the project's known cache quirk — source verified
to have zero references). **Not visually verified in-browser** — the admin
panel needs a login the preview session doesn't have; the production build
compiling + type-checking the component is the available proof. **Owner
action:** open any product's Etsy drawer and confirm the Length/Ring size now
appear in the preview (no separate test box), then sync.

## 2026-07-08 (session 9, eighth addendum) - Etsy sync: Ring size now auto-on too

**Decision:** Owner: *"make ring size automatic too, we can also re-disable
it later on like bracelet and necklace if we need to."* Mirrored the Length
change from the seventh addendum exactly: `next-app/src/lib/etsy/sync.ts`'s
ring-size step changed from `process.env.ETSY_SYNC_RING_SIZE === 'true'`
(opt-in) to `!== 'false'` (on by default, opt-OUT). Ring size now pushes
automatically on every Ring sync with no Netlify change; set
`ETSY_SYNC_RING_SIZE=false` to disable. Safe for the same reasons: it's an
enumerated property whose `buildRingSizePayload` only ever uses a real
matched size-chart value (never a guess or placeholder), and every write is
read back and verified, so a wrong/absent size fails closed into a warning.

Now length and ring size are both default-on, each behind its own
independent disable flag. **Verification:** `npx tsc --noEmit` (clean),
`npx vitest run` (124/124, unchanged — the flag default isn't unit-tested,
same as Length's, since it needs a live DB + Etsy connection), `npm run lint`
(0 problems), `npm run build` (succeeded). **Not yet re-verified live** —
owner action: sync a Ring and confirm the size lands automatically.

## 2026-07-08 (session 9, seventh addendum) - Etsy sync: length auto-on, vintage/antique tags, word-boundary tag truncation

Three owner requests after confirming a live necklace sync worked end to end.

**1. Length now pushes automatically (no Netlify flag needed).** Owner:
*"length works now, so set that true too to auto set it."* Since I have no
Netlify access, I flipped the gate in code instead of asking them to set an
env var: `next-app/src/lib/etsy/sync.ts`'s length step changed from
`process.env.ETSY_SYNC_BRACELET_LENGTH === 'true'` (opt-in) to
`!== 'false'` (on by default, opt-OUT). Once this deploys, every
length-bearing sync pushes wearable length with no config change; setting
`ETSY_SYNC_BRACELET_LENGTH=false` disables it. Safe because every length
write still goes through the discover→write→read-back→verify cycle, so a bad
value fails closed into a warning, never silent corruption (the whole point
of the session 7-8 rebuild). **Ring size was left opt-in** (`ETSY_SYNC_RING_SIZE
=== 'true'`, still off) — the owner only asked about length; ring size is a
one-line change away whenever they want it.

**2. Vintage/antique tags on every item.** Owner wants "vintage jewelry" /
"antique jewelry" and metal-specific "vintage sterling" / "antique sterling"
type tags "where appropriate," with the explicit rule *"if using vintage,
also use antique too."* Implemented in `mapTags()`: after "estate jewelry",
every item now gets a jewelry-level pair (vintage jewelry + antique jewelry)
and, when the metal is known, a metal-specific pair ("sterling" for silver,
the metal word otherwise → vintage/antique gold/platinum/palladium). Two
deliberate design points:
- **Pairs are atomic** (`addVintageAntiquePair` only adds both if both fit
  the 13-tag cap) so the owner's "always paired" rule holds even when the tag
  budget runs out mid-pair — a lone "vintage X" is never emitted.
- **Unconditional**, because this whole catalog is attested vintage/estate
  (Q2). Noted for the owner: "antique" is technically 100+ years vs.
  "vintage" 20+, so on a genuinely 1990s piece "antique" is a keyword stretch
  — but it's a free-text search tag (not the accurate `when_made` field,
  which is still set correctly), it was explicitly requested, and buyers
  search both terms loosely. These on-brand tags are placed just after
  "estate jewelry" so they outrank generic single words (e.g. standalone
  "bracelet" now yields its slot on a tag-heavy gold listing — it still
  appears inside the compound tags).

**3. No more mid-word tag truncation.** The live screenshot showed a tag
"solid silver bracele" — "solid silver bracelet" (21 chars) hard-sliced to
Etsy's 20-char limit, chopping "bracelet" mid-word. New
`clampTagToWordBoundary()` cuts an over-long tag at the last space instead
("solid silver"), applied to every tag via `add()`. A single word longer
than 20 chars (rare, no space to fall back to) is still hard-cut — nothing
better is possible there.

**Verification:** `npx tsc --noEmit` (clean), `npx vitest run` (124/124 — 4
new mapTags tests: the word-boundary regression, silver + gold vintage/antique
pairs, and the "never a lone vintage without antique" atomic-pair invariant;
plus the existing single-word test updated to note "bracelet" now yields to
the category tags), `npm run lint` (0 problems), `npm run build` (succeeded).
**Not yet re-verified live** — owner action: re-sync a listing and confirm
(a) the tags now include vintage/antique with no chopped words, and (b)
length lands automatically without any Netlify change.

## 2026-07-08 (session 9, sixth addendum) - Etsy sync: Necklace product type now auto-maps to "Chains", not "Pendant Necklaces"

**Decision:** Owner reviewed Etsy's full Necklaces subcategory list and
noted this catalog is predominantly chain-style necklaces (Cuban links,
rope, etc.), so the automatic category for the **Necklace** product type
should be **"Chains"**, not the old "Pendant Necklaces" closest-match guess.

**Real id, not a guess (project's standing discipline):** fetched Etsy's
live `seller-taxonomy/nodes` tree (read-only, api-key only — no OAuth token,
no decryption) and read the Necklaces (1217) children directly. **Chains =
1221.** Cross-checked two siblings against ids already pinned in the code —
Pendant Necklaces = 1229 ✓, Charm Necklaces = 1222 ✓ — confirming this is
the exact same taxonomy version, so 1221 is trustworthy.

**Verified the switch doesn't break structured properties:** fetched
`nodes/1221/properties` live and diffed against the cached Pendant (1229)
dump. Chains carries the same **Material multi (148789511893)**, **Gold
solidity (570246213608)**, **Gold purity (570246213609)**, and **Length
(47626759838)** property ids this app pushes — so `mapProperties()` and the
length-experiment behave identically. (Bonus: Chains has a dedicated "Chain
style" property Pendant lacks, reinforcing it's the better fit.)

**Dropped `approximate: true` for Necklace.** The distinct **Pendant**
product type already routes to Pendant Necklaces (1229), so a plain
"Necklace" genuinely *means* a chain here — it's the intended category, not
a fallback. Removing the flag also removes the "Closest match — review"
badge and the pre-flight nag for necklaces, which is exactly the
"make it automatic" outcome the owner asked for. `next-app/src/lib/etsy/mapping.ts`
change: `Necklace: { taxonomyId: 1221, path: 'Jewelry > Necklaces > Chains' }`.

**Does NOT retro-fix already-synced necklaces.** This only changes what
*future* syncs (and re-syncs) send. A necklace already on Etsy under Pendant
Necklaces won't move to Chains until it's re-synced (its content-hash
doesn't include taxonomy, so a plain "Sync Updates" may not even detect this
as a change — the category can also just be corrected on etsy.com directly,
or via the app's "Choose exact category" override + Sync). Not urgent, not a
correctness bug — flagged so it isn't mistaken for automatic.

**Verification:** `npx tsc --noEmit` (clean), `npx vitest run` (120/120 — 2
new regression tests: Necklace → 1221 non-approximate, and Pendant stays on
1229), `npm run lint` (0 problems), `npm run build` (succeeded). **Not yet
re-verified live** — owner action: sync a necklace and confirm it lands
under Necklaces › Chains on Etsy (no "review" badge in the dry-run preview
anymore).

## 2026-07-08 (session 9, fifth addendum) - Etsy sync: stopped pushing SKU to Etsy at the owner's explicit request

**Decision:** With the image-path fix in place (previous entry), the same
necklace sync progressed further and hit a new, unrelated error: `Etsy
rejected the request: There was a problem with /sku : cannot be more than
32 characters`. The product's `sku` field holds its own slug/id
(`14k-heavy-diamond-cut-cuban-link-chain-necklace-01`, 51 characters) —
Etsy's structured inventory SKU field caps at 32. Owner's response was
direct: *"i dont need to upload sku to etsy at all (its no use to me)."*

**Fix:** `updateListingInventory` in `next-app/src/lib/etsy/sync.ts` no
longer sends a `sku` key at all in the inventory PUT (previously
`sku: params.payload.sku`) — this is the actual fix for the reported error,
and it's permanent regardless of how long a future product's `sku`/slug is.

**Accepted, disclosed trade-off:** this project's original design
(`etsy-sync-plan/11-error-handling.md`) used the pushed SKU for a narrow
crash-recovery guard — `findExistingDraftBySku()` — that let a retry adopt
an existing Etsy draft if a prior sync died in the brief window between
Etsy accepting `createDraftListing` and our own DB write of
`etsy_listing_id`. Once SKU is never pushed, that lookup can never match
anything again (Etsy-side SKU is now always blank), so leaving the function
in place would just burn API calls (1 list + up to 25 inventory GETs) on
every single publish for zero benefit — removed outright rather than left
as dead weight. **Residual risk:** if a sync ever dies in that exact narrow
window again, the retry will create a second draft listing on Etsy instead
of adopting the orphaned one — low-severity (an easily-spotted extra draft,
not live/active-listing corruption or data loss), and the owner's
instruction was clear enough to act on directly rather than pause and ask.
The plan's Phase 3 (unbuilt) also mentioned SKU as a secondary cross-check
for webhook receipt matching, alongside `etsy_listing_id` as the primary
key — not a blocker for Phase 3 whenever it's built, just one fewer
belt-and-suspenders check.

**Deliberately left unchanged** (still legitimately useful, not part of
the reported bug): `mapSku()` and `MappedEtsyPayload.sku` still compute the
same value, used for (1) the buyer-facing "Inventory #: …" line in the
pushed description text (no length constraint there) and (2) the
content-hash out-of-date detector. The admin dry-run preview's "SKU" cell
in `EtsyProductPanel.tsx` was removed, though — it implied the value gets
pushed to Etsy, which was exactly the (correct) assumption that led to the
owner's request, so leaving it would keep the same confusion alive after
the underlying behavior changed.

**Verification:** `npx tsc --noEmit` (clean), `npx vitest run` (118/118 —
no test exercised the removed crash-recovery lookup directly, matching this
module's existing precedent that live-DB/live-Etsy-only functions aren't
unit tested), `npm run lint` (0 problems), `npm run build` (succeeded, full
route manifest unchanged). **Not yet re-verified live** — owner action:
retry the necklace sync once more; this should clear both the image-path
error and this SKU error in the same click.

## 2026-07-08 (session 9, fourth addendum) - Etsy sync: fixed the real cause the circuit breaker surfaced — relative legacy image paths

**Decision:** Owner retried the necklace sync after the third-addendum
circuit-breaker fix. It failed fast (as designed) with a real, specific
reason instead of looping forever:

```
Image upload stalled after 5 attempts with no progress. Image skipped
(source unreadable) — Failed to parse URL from
/assets/images/shop/shop-14k-heavy-diamond-cut-cuban-chain-04.webp
```

**Root cause:** this product has at least one image stored as a relative,
same-origin path (`/assets/images/...`, a legacy convention from before this
product's photos were migrated to Supabase Storage) rather than a full
`https://…supabase.co/storage/...` URL. `fetchImageBytes` in
`next-app/src/lib/etsy/images.ts` passed the URL straight to Node's
server-side `fetch()`. Unlike a browser, Node has no implicit page origin to
resolve a relative path against, so `fetch('/assets/...')` throws
`Failed to parse URL` immediately — every attempt, no exceptions. This was a
pre-existing gap in the original build: the file's own header comment always
claimed to support both "Supabase Storage" and "public/assets" sources, but
the code only ever handled absolute URLs.

**Fix:** added `resolveImageUrl(url)` to `images.ts` — passes an
already-absolute (`http://`/`https://`) URL through untouched; for anything
else, prepends the app's canonical site URL (reusing the existing
`getSiteUrl()` helper from `next-app/src/lib/order-email-branding.ts`, which
resolves `NEXT_PUBLIC_SITE_URL` with a `https://naplesestatejewelry.co`
fallback). `fetchImageBytes` now calls `resolveImageUrl` before fetching, and
uses the resolved URL in its error message so any future failure is
immediately diagnosable.

No database change and no manual reset is needed to retry: `runSyncStep`'s
existing retry-from-`'error'` gating already re-enters the image step, and
the circuit breaker's own zero-progress branch resets `error_count` back to
0 the moment any image in a batch succeeds.

**Verification:** `npx tsc --noEmit` (clean), `npx vitest run
src/lib/etsy/__tests__/images.test.ts` (22/22, incl. 4 new regression tests
covering: absolute https/http URLs pass through untouched, the exact live
failing path resolves against `getSiteUrl()`, and a relative path missing
its leading slash still resolves correctly), full suite `npx vitest run`
(118/118), `npm run lint` (clean), `npm run build` (succeeded). **Not yet
re-verified live** — needs the owner to retry the necklace sync once more;
this should be the actual resolution of the original "hung up syncing"
report, assuming no other image on this product has a distinct problem.

## 2026-07-08 (session 9, third addendum) - Etsy sync: found and fixed a real infinite-retry loop during image sync

**Decision:** Owner tried testing Length on a Necklace and got "hung up
syncing" — the UI showed "Uploading image 4 of 8…" indefinitely. Two
distinct, real bugs were found and fixed, plus one unrelated cosmetic issue:

1. **Stale dev-server cache** (cosmetic, not a source bug): the browser hit
   `ReferenceError: isBracelet is not defined` — a variable renamed to
   `isLengthBearing` in the session-9 generalization. Confirmed the actual
   source file has zero remaining references; this was Turbopack serving a
   stale compiled chunk (this project's known, documented Windows/OneDrive
   cache issue). Fixed by restarting the dev server.
2. **The real bug: an unbounded retry loop.** Direct Supabase check: the
   necklace's `etsy_listings` row sat at `sync_state: 'draft_created'` with
   **zero rows** in `etsy_listing_images` despite 100+ identical
   `POST /api/admin/etsy/sync` calls (confirmed via dev-server access log,
   each returning 200 in ~1s, forever). Root cause: `sync.ts`'s image step
   catches every per-image upload failure and downgrades it to a warning
   string (by design, so one bad photo doesn't block the whole sync) — but
   nothing ever distinguished "some images succeeded, keep going" from
   "every image in this batch failed, we are stuck." `planImageDiff` kept
   re-planning the exact same doomed batch every invocation, forever.
3. **Compounding bug: warnings were invisible the whole time.**
   `EtsyProductPanel.tsx`'s `runSyncLoop` only read `data.warnings` after
   `data.done` became `true` — during the `done: false` polling phase (i.e.
   the entire duration of this incident), any warning explaining *why* an
   image failed was silently discarded. The user had no way to see the
   actual error even by watching closely.

**Fix, two independent layers (defense in depth):**
- **Server (`sync.ts`):** the image step now tracks `succeeded` (real
  upload/delete/re-rank successes) separately from `batch.length` (ops
  merely attempted) — progress reporting is now honest. When a batch with
  more ops still queued makes **zero** real progress, it increments the
  existing `etsy_listings.error_count` column (the same one the top-level
  catch-all already uses for the same "give up after repeated failure"
  concept) and, after `IMAGE_STALL_LIMIT` (5) consecutive zero-progress
  batches, flips `sync_state` to `'error'` with a clear message instead of
  ever looping again. A batch with *some* successes resets the counter — a
  slow-but-working sync is never penalized, only a fully-stuck one.
- **Client (`EtsyProductPanel.tsx`):** `runSyncLoop` now shows warnings live
  during polling (not just at the end), and independently tracks whether
  the exact same `progress` value repeats — after 5 identical polls in a
  row, it stops and tells the user rather than looping forever. This is a
  second, independent guard: even if a future bug reintroduces a
  server-side stall, the interactive UI won't hammer Etsy's API forever
  again.

**Reason:** The pre-existing "downgrade a bad image to a warning, keep
going" design is correct and intentional (matches this project's stated Q7
philosophy — a per-item Etsy rejection is a warning, never a batch-blocking
failure) for the case where SOME images succeed. It was never designed for
the case where NONE do, and nothing detected that distinction. Combined with
warnings being invisible mid-poll, a genuinely failing image became silent,
unbounded API hammering instead of a fast, clear failure — a real
production risk (burns Etsy's rate-limit budget for no benefit), not just a
UX inconvenience.

**Not yet known:** why this specific necklace's images are failing to
upload at all (a real, separate question) — the fix makes the failure fast
and visible instead of infinite and silent, but doesn't diagnose the root
cause of THIS image's failure. Next retry will surface the actual warning
text, which should explain it.

**Verification:** `npx tsc --noEmit`, `npm run lint` (0 problems), 114 unit
tests pass (no existing test touched this code path directly — `runSyncStep`
has always required live DB + Etsy connection to exercise meaningfully, same
as documented for the rest of sync.ts). `npm run build` passes. **Not yet
re-verified live** — needs the owner to retry the necklace sync (safe
either way now: it will either succeed, or fail fast with a real reason
after at most 5 attempts instead of running indefinitely).

## 2026-07-08 (session 9, addendum) - Etsy sync: Ring size CONFIRMED WORKING live

**Decision:** Owner clicked **Test Ring Size** (10.5) on a real draft ring
listing ("Vintage 10K Yellow Gold Diamond Ring," category manually
overridden to "Multi-Stone Rings" — not the automatic `ETSY_TAXONOMY_MAP`
guess). Result: **success, independently verified.**

```json
{
  "propertyId": 54142602013, "scaleId": 20,
  "valueIds": [1604], "values": ["10 1/2"],
  "readback": {
    "propertyId": 54142602013, "propertyName": "Ring size",
    "scaleId": 20, "scaleName": "US/CA",
    "valueIds": [1604], "values": ["10 1/2"]
  }
}
```

Independently re-checked outside the app: `10.5` → `decimalToRingSizeFraction`
→ `"10 1/2"` → matched real chart entry `value_id 1604` (found by
`buildRingSizePayload`, never invented) → written → read back via
`getListingProperties` → `verifyRingSizeReadback` confirms all three checks
(property name "Ring size" matches, scale "US/CA" matches, value parses back
to exactly `10.5`). Not a repeat of the "Gray" false-positive: value_id 1604
was discovered from Etsy's own live chart data for this specific listing's
taxonomy, not fabricated or derived from the size number.

Notably ran against a **manually-overridden taxonomy** ("Multi-Stone
Rings"), not our own automatic guess ("Statement Rings," `taxonomy_id`
1240) — a stronger proof than testing the default path alone, since it
confirms `fetchTaxonomyProperties`/`findRingSizeProperty` genuinely resolve
against whatever taxonomy_id a listing actually has, live, every time,
rather than only working for the one category this was developed against.

Updated `ring-size-experiment.ts`'s module comment and the admin UI copy
(`EtsyProductPanel.tsx`) from "Experimental" to "confirmed working live,"
matching the same language shift Length got after its session 8
confirmation.

**Reason:** Same standard as every other property confirmed this session —
a 200 is never enough on its own; this is independently re-verified by
`verifyRingSizeReadback`'s own logic, not just eyeballed.

**Current status:** Ring size can now be pushed correctly, live-verified.
`ETSY_SYNC_RING_SIZE` is still unset in Netlify — the code path is proven,
turning it on for regular syncs is the owner's call
(`etsy-sync-plan/OWNER-SETUP.md`). Still outstanding: confirming the Length
generalization (this addendum's sibling task) on a non-Bracelet category —
unaffected by and unrelated to this result.

**Verification:** Live, owner-run, independently checked against
`verifyRingSizeReadback`'s logic (not just eyeballed). `npx tsc --noEmit`,
`npm run lint` (0 problems), 114 unit tests still pass — no code changes
beyond the "confirmed working" comment/copy updates (no logic changed).

## 2026-07-08 (session 9) - Etsy sync: generalized Length beyond Bracelet, built Ring size from scratch

**Decision:** Owner asked to generalize the proven Length mechanism (session
8) to other categories, naming Ring size and Necklace length specifically.
Two different pieces of work resulted, because they turned out to be
genuinely different kinds of properties:

**1. Length — trivial generalization, zero new risk.** `findLengthProperty`/
`buildLengthPropertyPayload`/`verifyLengthReadback` never actually depended
on Bracelet — they dynamically scan whatever properties are fetched for the
listing's own taxonomy_id. Only the *gating* (sync.ts's flag condition, the
admin UI's visibility check) was Bracelet-only. Renamed
`attemptBraceletLengthSync`/`runBraceletLengthExperiment` →
`attemptLengthSync`/`runLengthExperiment` (route renamed
`bracelet-length-experiment` → `length-experiment` to match) and widened the
gate to `LENGTH_BEARING_PRODUCT_TYPES` — every category confirmed (session
3 research) to carry a buyer-facing length property: Necklace, Bracelet,
Pendant, Charm, Earrings, Brooch, Cufflinks, Watch, Coin, Bullion,
Silverware. Ring is deliberately excluded (see below). The
`ETSY_SYNC_BRACELET_LENGTH` env var name is kept as-is rather than renamed,
to avoid an unnecessary Netlify config change for the owner.

**2. Ring size — new module, `ring-size-experiment.ts`.** Fetched
`getPropertiesByTaxonomyId(1240)` (Ring) live and found this is a
**fundamentally different kind of property** than Length:
- **Real enumerated `possible_values`** (230 total) — sizes are named in
  fraction notation ("6", "6 1/2", "7 1/4"...), never decimals, each scoped
  to a region scale: US/CA (`scale_id 20`), UK/AU (21), FR (22), DE (23).
- **UK/AU uses letter notation entirely** ("A", "A 1/2", "B"...) for
  physically different sizes than the same-looking US/CA number — confirmed
  live via `equal_to` cross-references (UK/AU "A" maps to US/CA "1/2").
  Real proof that scale-scoping isn't hypothetical caution here; getting it
  wrong would silently push the wrong physical size.
- Because every standard size already has a real, discoverable `value_id`,
  **this never needs Length's empty-string placeholder trick** — a target
  size either matches a real chart entry (safe, ideal case) or it doesn't,
  in which case `buildRingSizePayload` returns `null` (unsupported for that
  specific value) rather than falling back to anything invented.
- `parseRingSize()` reuses the same source field as Length
  (`products.length`) and the same dual-format acceptance already
  established in `types/product.ts`'s `normalizeProductLengthSizeValue`
  (bare decimal, or the defensive "Size: N" form) — no new source-data
  concept introduced.
- Same write → read-back → verify discipline, same two-entry-point split
  (manual `runRingSizeExperiment`, hard-refuses on active listings; regular
  pipeline via new `ETSY_SYNC_RING_SIZE` flag, off by default) as Length.
  New route `POST /api/admin/etsy/ring-size-experiment`; new "Test Ring
  Size" admin section (Ring products only).

**Admin UI cleanup:** the "is this a Bracelet?" check used to
pattern-match `taxonomyPath` text (`.includes('Bracelets')`), which doesn't
scale cleanly across 11 different category paths spanning 4 different
top-level Etsy departments (Jewelry/Accessories/Art & Collectibles/Home &
Living). Added a `productType` field to `/api/admin/etsy/preview`'s
response (the server already resolves this via
`normalizeProductJewelryType`) so the client checks an authoritative signal
instead of guessing from display text.

**Reason:** Investigating before building surfaced that "apply the same fix"
wasn't quite accurate for Ring size — the underlying property is a
different shape (enumerated vs. continuous), so it needed its own discovery/
payload/verify logic, not a parameterized reuse of Length's. Building it
this way keeps each independently readable and avoids forcing an
abstraction over two cases that differ exactly where it matters (how a
missing match is handled: Length has a known-safe fallback, Ring size does
not and must not invent one).

**Verification:** `npx tsc --noEmit`, `npm run lint` (0 problems), `npm run
build` all pass. **114 unit tests pass** (up from 93) — 21 new tests in
`ring-size-experiment.test.ts` using the real live-fetched chart data
(US/CA sizes 6 through 8, plus the UK/AU letter-notation entries), covering
fraction conversion (including the round-up-to-next-whole edge case), the
never-guess guarantee (an unmatched size returns `null`, confirmed
distinctly from Length's placeholder behavior), and scale-scoped discovery.
**Not yet run live** — needs the owner to click "Test Ring Size" on a draft
Ring listing, and "Test Length" on a Necklace/Earrings/etc. draft to confirm
the generalization holds outside Bracelet specifically.

## 2026-07-08 (session 8, third addendum) - Etsy sync: Bracelet length CONFIRMED WORKING — value_ids: [''] is the correct mechanism

**Decision:** Owner re-ran **Test Bracelet Length** (7.75in) after the
read-back fix above. Result: **success, independently verified.**

```json
{
  "propertyId": 47626759838, "scaleId": 5,
  "valueIds": [""], "values": ["7.75"],
  "readback": {
    "propertyId": 47626759838, "propertyName": "Length",
    "scaleId": 5, "scaleName": "Inches",
    "valueIds": [52788369096], "values": ["7.75"]
  }
}
```

`verifyLengthReadback` independently confirmed all three checks: property
name matches `/length/i` ("Length"), scale name matches `/^inch(es)?$/i`
("Inches"), and the value parses to exactly `7.75` — none of which is a
coincidence or a repeat of the "Gray" false-positive (that incident's
readback would have been a mismatch under this same logic, by design).
Etsy's own response shows it **auto-generated and assigned a real,
shop-scoped `value_id` (`52788369096`) for this custom length value** —
confirming the mechanism suspected from research earlier this session
("the system converts [a value_id] to your shop's unique ID, creating one
if it's not already in the system"). We never chose or derived that
number — Etsy did, in response to the empty-string placeholder.

**This closes out the investigation the owner opened at the start of
session 7.** Bracelet length can now be pushed correctly, live-verified, via
the exact mechanism the owner's original rules demanded: no hardcoded ids,
no guessed value_id, write-then-read-back-then-verify, fails closed on any
mismatch. Updated code comments in `length-experiment.ts` (both the module
header and `buildLengthPropertyPayload`'s doc comment) from "reasoned safe,
unconfirmed" to "confirmed live." Updated the admin UI copy in
`EtsyProductPanel.tsx` from "isn't auto-synced yet (past guess corrupted a
listing)" to "confirmed working live — not yet auto-synced on every
listing" (the distinction now is purely "proven but manual" vs. "proven and
automatic," not "unproven").

**Reason:** A hard-won, well-earned confirmation — this took a rebuilt
safety design (session 7), a real live rejection that proved the design
works (session 8 first test), a caught-and-fixed bug in the verification
mechanism itself (session 8 second test), and finally a genuine success
independently confirmed by our own fail-closed logic, not just Etsy's HTTP
status code.

**What's still true and unchanged:** Materials/Gold solidity/Gold purity
remain separately confirmed correct (session 5). Scope stays deliberately
Bracelet-only — this mechanism is very likely generalizable to
Necklace/Earrings/etc.'s own length-ish properties (same underlying
Etsy behavior), but that generalization was not asked for and is not built.
`ETSY_SYNC_BRACELET_LENGTH` is still unset in Netlify — the code path is
proven, but turning on automatic pushing for every regular sync is the
owner's call to make when ready (see `etsy-sync-plan/OWNER-SETUP.md`).

**Verification:** Live, owner-run, independently checked by
`verifyLengthReadback`'s own logic (not just eyeballed) — genuinely the
strongest verification standard available short of Etsy's own UI screenshot
(which the owner can still do by loading the listing on etsy.com, exactly
as they did for Materials/Gold purity/solidity in session 5). No further
code changes needed for this to be considered done; only a Netlify env var
flip remains, at the owner's discretion.

## 2026-07-08 (session 8, second addendum) - Etsy sync: read-back verification was built on a non-production Etsy endpoint — fixed

**Decision:** Owner re-synced the bracelet (fresh draft, `etsy_listing_id`
4534569547, reached `draft_review` — confirmed via Supabase: `create_draft`/
`set_inventory`/`update` all logged `ok`) and re-ran **Test Bracelet Length**
(7.75in, the `value_ids: ['']` variant). Result: `Etsy could not find the
referenced listing/resource` — a 404. Given the listing was confirmed to
genuinely exist and be fully synced, this did NOT add up as a "bad listing
id" problem, so it was investigated rather than taken at face value (exactly
the "never silently continue on ambiguity" principle this whole feature
exists to uphold).

**Root cause found:** `getListingProperty` (`client.ts`, the singular
`GET /v3/application/listings/{listing_id}/properties/{property_id}` used
for read-back verification) is not actually usable — its own spec
description says **"Development for this endpoint is in progress. It will
only return a 501 response."** This detail was missed when the endpoint was
first found in session 5/7's research (its response *schema* was recorded
accurately; its release-readiness note was not checked). In practice it
produced a 404 rather than the documented 501, but either way: **this
endpoint was never going to work**, in production or not.

Practical consequence: every previous "Test Bracelet Length" run either
failed at the WRITE step (missing value_ids — never reached read-back) or,
in this most recent run, may have had its WRITE succeed and only the
BROKEN READ-BACK step fail — meaning it's possible `value_ids: ['']`
already wrote something (correct or not) to the live bracelet draft that
was never actually verified. This is exactly the ambiguity rule 6 was meant
to prevent, caused by the verification mechanism itself being unsound, not
by an unclear result.

**Fix:** Replaced the broken singular endpoint with `getListingProperties`
(plural, `GET /v3/application/shops/{shop_id}/listings/{listing_id}/properties`
— "General Release, ready for production use" per the same spec) in
`client.ts`; `length-experiment.ts`'s read-back now fetches the full
property list and finds the matching entry (or falls back to an empty
representation if absent, which `verifyLengthReadback` already correctly
flags as a mismatch). Also split the write and read-back into separate
try/catch blocks so a future failure states clearly which phase broke — a
write failure means nothing changed; a read-back failure means the write
may have succeeded and is simply unconfirmed, a meaningfully different and
more serious case that must never be reported the same way.

**Reason:** A spec listing an endpoint is not the same as that endpoint
being production-ready — Etsy's own "General Release / ready for production
use" vs. "Feedback only / Development in progress" badges are exactly the
signal that was under-checked the first time. Re-verifying a definitive-looking
result rather than accepting it at face value is what caught this before it
could compound into a second silently-wrong conclusion.

**Verification:** `npx tsc --noEmit`, `npm run lint` (0 problems), 93 unit
tests pass (the pure `verifyLengthReadback`/`buildLengthPropertyPayload`
tests are unaffected — they test logic, not the fetch mechanism). **Not yet
re-run live** — needs the owner to click "Test Bracelet Length" again for a
real, trustworthy answer this time. Because the write is idempotent (the
same value either way), re-running is safe regardless of whether the prior
run's write silently succeeded or not.

## 2026-07-08 (session 8) - Etsy sync: live-tested the rebuilt Bracelet length experiment — confirmed the safety design works, and Bracelet length is genuinely unsupported for now

**Decision:** Owner clicked **Test Bracelet Length** (7.75 in) on the real
bracelet draft. Result: `Etsy rejected the request: Missing input parameter:
[value_ids]` — an HTTP 400, caught cleanly by the existing try/catch, shown
as a clear error, **zero data written, zero corruption**. This is exactly
the outcome the session 7 rebuild was designed to produce: an empty
`value_ids` (the only thing our client can distinguish from "omitted" once
serialized as repeated form keys — see length-experiment.ts's comment) is
rejected loudly instead of being silently misresolved like the "Gray"
incident. The rebuild's core promise — never trust a 200, and never let an
unproven guess corrupt live data — held on the very first live test.

Followed the owner's own rule 4 to the letter: "If Etsy still rejects it,
stop and mark Bracelet length as unsupported until we can obtain the correct
generated value ID." Researched further anyway (without acting unilaterally)
since the owner separately said "do not permanently assume length is
impossible" — found genuine corroborating evidence this is a known Etsy API
gap (a GitHub discussion citing the same class of `value_ids` confusion for
non-enumerated properties), plus one more untested variant mentioned in
passing (`value_ids: ['']` — one key with an empty *string*, distinct from
zero keys) that neither the owner's rules nor any Etsy documentation
confirms. Flagged this to the owner rather than trying it — it goes beyond
what was explicitly pre-authorized, even though reasoned to be low-risk (an
empty string can't resolve to an unrelated real value the way a guessed
number could).

Also fixed a minor UI redundancy the screenshot surfaced: the experiment's
result was shown twice (top notice banner + the dedicated result box).
`EtsyProductPanel.tsx`'s `runLengthExperiment` now only writes to the
inline result box (persistent, meant to be read/studied) — the top banner
stays reserved for the other, simpler actions (Sync/Deactivate/Refresh/Check
Status).

**Reason:** A live, unambiguous result — loud rejection, no data touched —
is exactly the "safe to conclude" signal the whole session-7 rebuild was
built to produce. Confirmed, not just designed-to-be-safe.

**Current status:** Bracelet length stays unsupported and
`ETSY_SYNC_BRACELET_LENGTH` stays unset. The manual experiment
infrastructure stays in place (it isn't dangerous — it fails safely — so
there's no reason to remove it the way the session-5 hardcoded-guess code
was removed). Next possible step, if the owner wants it: try
`value_ids: ['']`, or open a support ticket with Etsy asking directly how a
free-numeric attribute's `value_id` is meant to be obtained for a listing
property with an empty `possible_values` list.

**Verification:** Live click-through by the owner, `attempted: true,
success: false` surfaced with the exact Etsy error text, no listing data
changed (confirmed by the error being a rejection, not a write). No code
changes beyond the UI redundancy fix (`npx tsc --noEmit`, `npm run lint` —
both clean).

**Addendum (same session):** owner chose to try `value_ids: ['']`.
Implemented: `updateListingProperty`'s `valueIds` param widened from
`number[]` to `(number | '')[]` (client.ts) — a narrow, precise escape
hatch, not a general loosening (existing `number[]` callers, e.g.
Material/Gold-purity/solidity, remain unaffected and unchanged).
`buildLengthPropertyPayload`'s fallback changed from `[]` to `['']` (the
`[]` case is no longer attempted at all going forward — it's now a
confirmed-failing case, not worth re-testing every time). Updated the 3
affected unit tests in `length-experiment.test.ts` to expect `['']`;
`npx tsc --noEmit`, `npm run lint` (0 problems), **93 unit tests still
pass**. **Not yet run live** — needs the owner to click "Test Bracelet
Length" again.

## 2026-07-08 (session 7) - Etsy sync: rebuilt Bracelet length as a dynamic discover-write-verify cycle, gated off by default

**Decision:** Rebuilt Bracelet length syncing from scratch per the owner's
explicit rules, after session 5 removed it entirely (a hardcoded
`value_ids: [scale_id]` guess returned HTTP 200 but Etsy silently stored
"Gray" instead of "7.75"). New module `next-app/src/lib/etsy/length-experiment.ts`:

- **`findLengthProperty(properties)`** — scans a LIVE `fetchTaxonomyProperties`
  response (new client.ts call, `GET /v3/application/seller-taxonomy/nodes/{id}/properties`)
  for a name-matching, `supports_attributes`-true property, then finds its
  Inches scale by NAME within that property's own `scales` array. No
  property id, scale id, or value id is ever hardcoded — both are unit-tested
  using fixtures built from the real live data recorded in session 3/5
  (Bracelet's Length property id `47626759838` with Inches `scale_id: 5`;
  Silverware's unrelated generic Length property id `506` with Inches
  `scale_id: 350` — deliberately different numbers, proving the resolution
  is genuinely dynamic, not a disguised constant).
- **`buildLengthPropertyPayload(match, inches)`** — uses a real
  `possible_values` entry's `value_id` if one names the target length;
  otherwise `value_ids` is left as an empty array. Never derives a value id
  from the length number or the scale id — the literal bug being fixed. A
  dedicated regression test passes `inches: 5` (same number as the real
  scale_id) and asserts `valueIds` is still `[]`, never `[5]`.
- **`verifyLengthReadback(readback, expectedInches)`** — the new
  `getListingProperty` client call (`GET /v3/application/listings/{id}/properties/{propertyId}`)
  reads the property back after every write; this compares it against intent
  and fails closed on anything ambiguous (wrong property name, wrong scale,
  unparsable/mismatched value). A dedicated regression test replays the
  actual "Gray" incident as a readback and confirms it's flagged as a
  mismatch, not accepted.
- **`attemptBraceletLengthSync`** chains discover → build payload → write →
  read back → verify, returning a rich result (never just a boolean) —
  reusable by both paths below.
- **Two entry points, two different safety postures:**
  1. `runBraceletLengthExperiment(productId, inches)` — manual, admin-triggered
     only (`POST /api/admin/etsy/bracelet-length-experiment`, a new "Test
     Bracelet Length" section in `EtsyProductPanel.tsx`, shown only for
     Bracelet products). Hard-refuses to run against an `active` (live,
     buyer-visible) listing — the owner's explicit "test only on a draft
     first" rule, enforced in code, not just documented.
  2. The regular sync pipeline (`sync.ts`'s `pushListingProperties`) calls
     the SAME core function, but only when `ETSY_SYNC_BRACELET_LENGTH=true`
     (unset/false by default) AND the product is a Bracelet — this is the
     "once proven, use it for real" path, deliberately without the
     active-listing restriction (by the time an owner sets this flag,
     they've already proven it via path 1). A verification mismatch here
     becomes a `warnings[]` entry, same non-blocking philosophy as every
     other property push — **never** silently marked as succeeded.
- Scope is deliberately Bracelet-only (not re-generalized to every category
  this time) — `findLengthProperty`'s block comment notes it would also
  match another category's differently-purposed "Length" property (e.g.
  Ring's generic Length property, id 506, which isn't what a buyer means by
  a ring's length) if called for it; staying Bracelet-only at the sync.ts
  call site is what keeps that safe.

**Reason:** Every rule the owner specified maps directly to a distinct
failure mode from the session 5 incident: hardcoded ids (rule 1) is exactly
what produced `value_ids: [5]`; a guessed value derived from the length
number (rule 2) is the same bug restated; trusting HTTP 200 alone (implicit
throughout) is why the bug shipped silently in the first place. The
two-entry-point design resolves an apparent tension in the rules — "test on
a draft first" (a process discipline for the unproven phase) vs. "this
becomes the normal sync path once proven" (which must eventually work
regardless of listing state) — by putting the draft-only restriction on the
manual investigation trigger specifically, not on the shared write/verify
logic itself.

**Verification:** `npx tsc --noEmit`, `npm run lint` (0 problems), `npm run
build` all pass. **93 unit tests pass** (up from 71) — 22 new tests in
`length-experiment.test.ts` covering: correct dynamic resolution for two
different real categories, both never-guess regression tests (`value_ids`
never `[5]` or any inches-derived number), the "Gray" incident replayed
against `verifyLengthReadback` and confirmed as a failure, and every
`parseWearableLengthInches` edge case. **Not yet run live** — the manual
"Test Bracelet Length" experiment needs the owner's own admin session to
click (same limitation as every other live-Etsy-touching change this
session); `ETSY_SYNC_BRACELET_LENGTH` stays unset until that succeeds.
`etsy-sync-plan/OWNER-SETUP.md` updated with the new (optional, off-by-default)
env var.

## 2026-07-08 (session 6) - Etsy sync: image pipeline now checks against Etsy's own photo guidance

**Decision:** Owner supplied Etsy's seller-help photo guidance verbatim
("width and height at least 2000px", "first photo at least 635px or it may
rank lower in search", "images over 1MB may not finish uploading") and asked
whether our pipeline matches it. `next-app/src/lib/etsy/images.ts` already
had a 2000px warning, but it checked only the **longest** edge — a
2400x1200 photo would have passed even though its short side is well under
2000, which is what Etsy's wording actually requires (both sides). There was
no check at all for the first-photo 635px floor or the 1MB file-size
guidance. Three changes, all non-blocking (warnings only, matching the
existing philosophy — never fails a sync):

1. **2000px check now requires the shortest edge to clear it**, not the
   longest — `RECOMMENDED_MIN_EDGE_PX`.
2. **New first-photo-only check** (`FIRST_PHOTO_MIN_EDGE_PX = 635`) — rank 1
   specifically, since Etsy calls this out as search-ranking-affecting, a
   stricter/different concern than the general 2000px recommendation.
3. **New file-size warning** (`RECOMMENDED_MAX_UPLOAD_BYTES = 1MB`) after
   transcoding.
4. **Resize-down cap added** (`UPLOAD_RESIZE_MAX_EDGE_PX = 2400`, `fit:
   'inside'`, `withoutEnlargement: true` — never upscales, same rule as
   before): oversized sources (a modern phone photo easily exceeds
   4000px) are capped down before JPEG encoding, comfortably above the
   2000px floor while controlling file size/transcode time. This can't fix
   an already-too-small or already-too-rectangular source (resizing only
   ever shrinks), but removes unnecessary bloat from oversized ones, which
   directly helps with the 1MB guidance too.

The warning-computation logic was extracted into a pure `computeUploadWarnings()`
function specifically so it stays unit-testable without needing a live Etsy
connection (`uploadListingImage` itself isn't unit tested, same as
`runSyncStep`/`runDelist` — it needs live I/O to exercise meaningfully).

**Reason:** All three of Etsy's tips are about buyer-facing photo quality and
search ranking, not sync mechanics — cheap, safe wins to close now rather
than defer, since they're pure warning-surface improvements with no risk of
writing wrong data (unlike the Length property bug above). Not addressed
(explicitly deferred, needs a product decision, not built): (a) blocking or
warning at **photo intake time** (the site's own admin upload flow) when a
newly-uploaded product photo is under Etsy's thresholds, so a listing is
never even *created* with a photo problem; (b) a catalog-wide audit of
**existing** product photos already below these thresholds. Both are real,
reasonable follow-ups but are scoped differently (intake UX / a new report,
not the sync pipeline) and weren't asked for.

**Verification:** `npx tsc --noEmit`, `npm run lint` (0 problems), `npm run
build` all pass. **71 unit tests pass** (up from 64) — new
`describe('computeUploadWarnings', ...)` block plus a resize-cap test
(3000x3000 source → confirms output capped at 2400x2400, aspect preserved,
no upscale). Not yet exercised against a live Etsy upload this session.

## 2026-07-08 (session 5) - Etsy sync: removed the Length category-property push — confirmed live it silently corrupts data instead of failing safely

**Decision:** The owner's live listing (bracelet) showed Materials "Yellow
gold", Gold solidity "Solid gold", and Gold purity "14k" all correct —
confirming those three property pushes work exactly as designed. But
**Bracelet length showed the literal text "Gray"** instead of "7.75",
with Etsy's own "Suggested: 7.75 Inches" chip visible right below it,
unused. Removed the Length property push entirely from `mapProperties()`
(`next-app/src/lib/etsy/mapping.ts`) rather than try a second guess.

**Reason:** This is a materially different failure mode than every other
open question this session. Every previous wrong guess (readiness_state_id,
x-api-key format, who_made/is_supply) failed LOUDLY — Etsy rejected the
request with a 4xx and an error message, caught by the existing
per-property try/catch and surfaced as a harmless `warnings[]` entry, exactly
as designed. The Length guess (`value_ids: [scale_id]`) did the opposite: **Etsy
returned 200 and silently stored the wrong value.** Value ids are apparently
drawn from one shared global vocabulary across all of Etsy's properties (already
suspected from "Gold filled" = value_id `140` appearing in both Material-multi
and Gold-solidity's possible-value lists) — passing `5` (our own Bracelet-length
Inches scale_id) got resolved as whatever value_id `5` means in a totally
unrelated property, apparently a color ("Gray"). Researched further
(`developer.etsy.com/documentation/tutorials/listings/`): Etsy's own tutorial
example for a scale-based property (`Height`, `scale_id: 5`) shows
`value_ids: [18156809190]` — an opaque, large number that is neither the
scale_id nor anything derivable from listing data, with **no documented
explanation of where it comes from or how to obtain/generate it**. Since
`possible_values` is confirmed empty for every scale-based property we pinned
(Length/Width/Diameter/Dimensions across all 10 taxonomy nodes), there's no
lookup table to resolve it from either. Guessing again risks writing a second
wrong-but-silently-accepted value to a real listing — an unacceptable risk for
a business priced on real melt value/purity, where every listed fact should be
either correct or absent, never confidently wrong.

Fully removed rather than left disabled-but-present: `LENGTH_PROPERTY_BY_PRODUCT_TYPE`,
`LengthPropertySpec`, and `parseLengthInches` are deleted from `mapping.ts` (not
commented out), and the corresponding tests in `mapping.test.ts` were rewritten —
Length's three property ids (`47626759838`, `102448162796`, `506`) folded into
the existing "never guessed" test alongside Gemstone/width/Adjustable/Closure/
Ring size/Watch band material. The research (which property id + scale id
belongs to which category family) is preserved here and in `features/etsy-sync.md`
in case the real value_id mechanism is ever confirmed and this is worth
revisiting.

**Owner action needed:** the live bracelet listing currently has "Gray" in its
Bracelet length field. Fix it directly in Etsy's editor — clear the field and
either type `7.75` or click the **"Suggested: + 7.75 Inches"** chip Etsy already
shows right below it (visible in the screenshot that surfaced this bug). No
code path in this app will touch that field going forward.

**Verification:** `npx tsc --noEmit`, `npm run lint` (0 problems), `npm run
build` all pass. **64 unit tests pass** (down from 69 — 5 Length-specific
tests removed as no longer applicable, not because coverage regressed).
Materials/Gold solidity/Gold purity are now considered live-confirmed correct
(owner's screenshot), not just unit-tested.

## 2026-07-08 (session 4) - Etsy sync: fixed a real update-mode bug (who_made/is_supply), added manual Etsy-side reconciliation

**Decision:** Two follow-ups from live testing of the properties feature above:

1. **`setListingCopy` (the `mode: 'update'` PATCH) sent `when_made` without
   `who_made`/`is_supply`.** Etsy rejected it live: `"Cannot update 'when_made'
   without 'who_made' and without 'is_supply' and vice versa"` — this
   endpoint treats the three as a linked group; `createDraftListing` already
   sent all three together, but the copy-refresh PATCH only re-sent
   `when_made` alone. Fixed by adding `who_made`/`is_supply` (already
   computed on `MappedEtsyPayload`, just not passed through here) to that
   call in `next-app/src/lib/etsy/sync.ts`.
2. **The owner deleted a draft directly on etsy.com to remake it cleanly,
   and the admin panel kept showing "Draft on Etsy" — our DB has no way to
   learn about an out-of-band deletion on its own.** Added a manual
   reconciliation path: new `checkListingStatus()` in `sync.ts` GETs the
   real listing; Etsy hard-deletes draft listings (unlike deactivating an
   active one, which just flips state), so a 404 reliably means "really
   gone," and the local row resets to not-listed (`etsy_listing_id` cleared,
   `sync_state` back to `'pending'`) so **Sync to Etsy** (a fresh publish)
   reappears instead of **Sync Updates**/**Deactivate**, which assume a
   still-existing listing. New route `POST /api/admin/etsy/verify-listing`;
   new **Check Etsy Status** button in `EtsyProductPanel.tsx` (only shown
   once a listing is linked), reusing the existing notice-banner pattern.
   Deliberately narrow: when the listing DOES still exist, this only
   reports Etsy's real state string and does not force-overwrite our own
   `sync_state`, which also encodes pipeline progress (e.g.
   `'inventory_synced'`) that Etsy's coarser
   draft/active/inactive/sold_out/expired can't represent — a full two-way
   reconciliation engine was not what was asked for and risks collapsing
   that finer state incorrectly.

**Reason:** Both are real gaps only a live click ever surfaces, same as the
readiness_state_id/x-api-key/retry-from-error bugs earlier this session —
no amount of static spec-reading catches an endpoint-specific field-grouping
rule, and no amount of our own DB state can detect a change made entirely
outside our app. The reconciliation feature's scope (GET + reset-on-404
only) matches exactly what was asked ("show that the draft is gone")
without guessing at broader Etsy-side drift this session has no evidence of.

**Verification:** `npx tsc --noEmit`, `npm run lint` (0 problems), `npm run
build` all pass; 69 existing unit tests still pass (neither change is unit
tested directly — both need a live DB + live Etsy connection to exercise
meaningfully, same as `runSyncStep`/`runDelist`/`runReactivate`, which have
no dedicated tests either, only their pure helpers do). **Not yet verified
live** — cannot click through the admin panel without the owner's session;
both fixes are narrow and match Etsy's exact live error text / the exact
symptom described, but need a real click to confirm.

## 2026-07-08 (session 3) - Etsy sync: push structured category properties ourselves instead of Etsy's UI-only "Suggested" chips

**Decision:** After the first live draft synced, the owner noticed Etsy's own
listing editor shows "Suggested:" chips under several fields (Material, Gold
purity, Gemstone, Bracelet width/length, Adjustable) when editing a listing by
hand, and asked whether we could auto-accept those via the API. A full search
of the live OpenAPI spec found no such endpoint — the only "suggestion"
surface in v3 is `allow_suggested_title`/`suggested_title` (title only, not
attributes). Instead of Etsy's suggestions, this pushes the same *kind* of
values ourselves via `updateListingProperty`, computed from data already on
the product record — new `mapProperties()` in `mapping.ts`, wired into
`sync.ts`'s existing inventory step as an additive, best-effort sub-step.

Per the owner's explicit follow-up ("apply to any product type, including
sterling categories like spoons"), this is generalized across every
`ETSY_TAXONOMY_MAP` entry, not just Bracelet. Fetched
`getPropertiesByTaxonomyId` live for all 10 unique pinned taxonomy ids and
found:
- **Material** (id `148789511893`) and its value vocabulary (Gold `5261`,
  Yellow/White/Rose gold, Silver `246`, Sterling silver `5113`, Platinum
  `208`, Palladium `2536`) is identical across every pinned category.
- **Gold solidity** (`570246213608`) / **Gold purity** (`570246213609`) exist
  on every jewelry category *except* Cufflinks, Coin/Bullion, and Silverware
  — confirmed live, not assumed; pushing either on those three would 400.
- The length-equivalent property is NOT one global id: Bracelet/Necklace/
  Pendant/Charm share `47626759838`; Earrings/Brooch use a distinct "Small
  jewelry length" id `102448162796`; everything else (Cufflinks/Watch/Coin/
  Bullion/Silverware) falls back to the generic Length property `506`. Each
  family has its **own** Inches `scale_id` (5, 5, and 350 respectively — not
  interchangeable, confirmed live per family, not assumed to match).
- **Ring has no length-like property at all** — it has "Ring size" instead
  (`54142602013`, a 230-value per-country US/CA/UK/AU/FR/DE chart), which has
  no source field in our schema to map from. Deliberately left unmapped.

**What is intentionally never set:** Gemstone, Bracelet/Pendant width,
Adjustable, Jewelry closure type, Ring size, Watch band material — none has a
source column anywhere in the product schema (confirmed by re-reading the
full `ProductAutofillFields`/`Product` shape). Guessing any of these would be
fabricating a fact on a live listing for a business priced on real melt
value/purity, which is worse than leaving Etsy's own manual "Suggested" chip
for the seller to confirm by hand.

**One wire-format detail is NOT independently spec-confirmed:** scale-only
properties (Length) have no enumerated `possible_values` to pick a `value_id`
from. The spec's only hint ("a value_id that is valid for a scale_id")
suggests mirroring the scale_id itself as the value_id — implemented that
way, but never live-tested (see Verification). If wrong, it fails safely: every
property push in `sync.ts`'s new `pushListingProperties()` is wrapped in a
per-property try/catch that turns a failure into a `warnings[]` entry, never
a thrown error — Material/Gold purity/solidity (fully enumerated, zero
ambiguity) are unaffected even if Length's guess is wrong.

**Reason:** The owner's question implied real, buyer-facing gaps in existing
listings (Material/Gold purity/Bracelet length showing as unfilled
"Suggested" chips rather than real values) — worth closing since we already
hold the underlying data. The generalization request (spoons/Silverware
etc.) surfaced that the length-property id is genuinely category-dependent
(3 distinct ids + 2 distinct non-Inches scale-id namespaces), which a
Bracelet-only implementation would have silently gotten wrong for every other
category the moment it was reused without re-verifying against that
category's own property list.

**Verification:** `npx tsc --noEmit`, `npm run lint` (0 problems), `npm run
build` all pass. 69 unit tests pass (up from 56), including one full
`describe('mapProperties', ...)` block covering Bracelet (the real regression
product), Necklace/Pendant/Charm (shared length id), Earrings/Brooch
(distinct length id), Ring (no length pushed), Silverware (materials only, no
gold purity/solidity, generic length id — the spoon case explicitly asked
for), Cufflinks/Coin/Bullion (no gold purity/solidity even when metal_type is
Gold), Watch (keeps gold purity/solidity, generic length id), vermeil
(Gold solidity resolves to "Gold vermeil" not "Solid gold"), and the
never-guess list (Gemstone/width/Adjustable/Closure/Ring size/Watch band
material always absent). **Not yet verified live** — a sandboxed attempt to
decrypt the stored OAuth token and call Etsy directly from an ad-hoc script
was correctly blocked (bypasses the real app's request path); the actual
`updateListingProperty` PUT call itself has never hit the live API. Because
every property push is non-blocking, the safe next step is simply clicking
**Sync Updates** on the real bracelet listing (or any product) from the
admin's own logged-in session and reading the resulting notice — success
shows no property-related warning; a wrong Length guess shows
`Category property 47626759838 skipped — <Etsy's real error>`, which would
immediately tell us the correct wire format to switch to. See
`etsy-sync-plan/OWNER-SETUP.md` and `project-docs/features/etsy-sync.md`.

## 2026-07-08 (session 2) - Etsy sync: two real bugs found on the first live sync attempt

**Decision:** The owner's first real "Sync to Etsy" attempt (bracelet
`heavy-italian-14k-yellow-gold-cuban-link-bracelet-53-91g-21`) surfaced two
bugs, both fixed:

1. **`updateListingInventory` was missing `readiness_state_id`.** Etsy
   rejected the call with `"All offerings need readiness state"`. The full
   local OpenAPI spec's request schema for this operation requires
   `readiness_state_id` on **every offering object**, not just at
   listing-create time — confirmed from the `required` array on the
   offering schema (`price`, `quantity`, `is_enabled`, `readiness_state_id`
   all required). Also added the `legacy=true` query param the same
   operation's own docs say is needed to enable processing-profile fields at
   all. Fixed in `next-app/src/lib/etsy/sync.ts`'s `updateListingInventory`,
   now passed `connection.readiness_state_id` from the caller.
2. **The step machine couldn't cleanly retry after an error.** Once
   `etsy_listings.sync_state` flips to `'error'`, the images/inventory/
   activate step conditions only matched specific *prior success* states
   (`'draft_created'`, `'images_synced'`) — so retrying (via "Sync Updates",
   `mode: 'update'`) would call `updateListingInventory` again (that
   condition already included `mode === 'update'`), but the *transition
   after* a successful retry never fired, because it separately gated on
   `sync_state === 'images_synced'` — which was never reached from `'error'`.
   The net effect: even a fully successful retry would report back
   `syncState: 'error'` (stale), never actually advancing to
   `'inventory_synced'`/`'draft_review'`. Fixed by treating `'error'` as a
   valid entry point for the images step (and its exit transition to
   `'images_synced'`) — every step in this machine is designed to be
   idempotent already (per `etsy-sync-plan/11-error-handling.md`), so
   re-running images/inventory/activate on a retry is always safe, just
   sometimes a harmless no-op.

**Reason:** Both bugs were only discoverable by actually driving a real sync
against the live API — no amount of static spec-reading or unit testing of
the pure `mapping.ts` functions would have caught either (the first needed
the exact request-body schema; the second is a live-only state-transition
edge case in `sync.ts`, which has no unit tests of its own — only its pure
helpers `shouldPushPrice`/`drainQueueCore` are tested, since `runSyncStep`
itself requires a live DB + live Etsy connection to exercise meaningfully).

**Verification:** `npx tsc --noEmit`, `npm run lint`, `npm run build`, and
all 52 unit tests pass. Confirmed via direct Supabase REST query (service
role) that the failing attempt logged exactly as expected
(`etsy_sync_log` id 2 `create_draft`/`ok`, id 3 `sync_step`/`error` with the
readiness-state message; `etsy_listings` row stuck at `sync_state: 'error'`
with a real `etsy_listing_id` already assigned). **Not yet confirmed** that
a retry now succeeds end-to-end — that's the immediate next live test.

## 2026-07-08 (final) - Etsy sync: fixed a real products.id type bug found running the live migration

**Decision:** The owner ran `supabase/etsy-sync.sql` in the live Supabase SQL
Editor and hit `ERROR 42804: foreign key constraint "etsy_listings_product_id_fkey"
cannot be implemented ... Key columns "product_id" and "id" are of incompatible
types: uuid and text`. The migration had declared `product_id` as `uuid` on
all three tables that reference `products.id` (`etsy_listings`,
`etsy_listing_images`, `etsy_sync_log`), plus the queue-claim RPC's `returns
uuid`. **`products.id` is actually `text`** (confirmed directly from
`supabase/products.sql` line 8: `id text primary key`, with no DB-side
default — the app generates it) — this had never been directly verified
against the canonical schema file; it was inferred from the TypeScript
`Product.id: string` type and the fact that most *other* tables in this app
(`orders`, `webhook_events`, etc.) do use real `uuid` primary keys, which
turned out not to hold for `products` specifically. Every other table that
references `products.id` elsewhere in `supabase/` (`sales-workflow.sql`)
already uses `product_id text references public.products (id)` — the
established, correct pattern this migration should have matched from the
start. Fixed all four spots in `supabase/etsy-sync.sql`.

**Reason:** A live `CREATE TABLE ... REFERENCES` statement is authoritative
about the real column type in a way no amount of inference from TypeScript
types or sibling-table conventions can substitute for. No TypeScript changes
were needed — `product_id`/`productId` was always handled as an opaque
string throughout `lib/etsy/*` and never validated/generated as a UUID, so
the bug was confined entirely to the SQL migration.

**Verification:** The migration is additive with `create table if not
exists` throughout, so re-running the corrected script after a partial
failure is safe — whatever committed before the error (`etsy_connection`,
possibly `etsy_oauth_states`) is skipped, and it picks up cleanly from
`etsy_listings` onward. Not yet confirmed the corrected script runs clean
end-to-end (owner re-running it is the next step).

## 2026-07-08 (latest) - Etsy sync: taxonomy IDs pinned from a real live call; 6 of 12 are judgment-call approximations

**Decision:** With the auth bugs fixed (previous entry), a real
`GET /v3/application/seller-taxonomy/nodes` call succeeded (3065 nodes
returned) and every `ETSY_TAXONOMY_MAP` entry in
`next-app/src/lib/etsy/mapping.ts` was pinned to a real leaf `taxonomy_id`,
replacing the placeholder `null`s. This was the build's single biggest
remaining gap (pre-flight blocked every product on it) — it's now resolved.

Six product types had an exact-match Etsy leaf (Bracelet → "Chain & Link
Bracelets", Brooch, Cufflinks, Coin, Silverware, Pendant). **Six did not** —
Etsy's real taxonomy has no generic/plain leaf for a plain chain necklace,
a plain ring, a plain pair of earrings, a standalone finished charm, a
gender-unspecified watch, or bullion/bars/ingots at all (confirmed by
keyword-searching all 3065 nodes, not an oversight). For those six, the
closest reasonable leaf was picked and marked `approximate: true`:

| Type | Picked | Reasoning |
| --- | --- | --- |
| Necklace | Pendant Necklaces | Most commonly-used generic bucket among Beaded/Bib/Cameo/Charm/Choker/Crystal/Lariat/Monogram/Multi-Strand/Tassel-specific siblings |
| Ring | Statement Rings | Same reasoning among Fraternal/Midi/Multi-Stone/Signet/Solitaire/Stackable/Triplet/Wedding-specific siblings |
| Charm | Charm Necklaces | Etsy's "Charms" node is a craft-supply component category, not finished jewelry |
| Earrings | Stud Earrings | Single most common earring style, among Chandelier/Clip-On/Cluster/Cuff/Dangle/Gauge/Hoop/Screw-Back/Threader siblings |
| Watch | Unisex Wrist Watches | Avoids assuming gender absent per-item data (siblings: Men's/Women's) |
| Bullion | Coins & Money (same as Coin) | No dedicated bullion/bar/ingot leaf exists anywhere in the taxonomy |

The dry-run preview's pre-flight now surfaces a non-blocking "using X as the
closest available category" message for all six, so the owner can override
any of them in `ETSY_TAXONOMY_MAP` later if real sales data suggests a
different fit is better (e.g. if most rings are actually solitaires).

**Reason:** The plan's own hard rule required real taxonomy IDs rather than
guessed placeholders (a wrong ID risks silently misfiling a listing with no
sandbox to catch it). A real API call was now possible (auth fixed) and the
owner authorized retrying it, so the "unpinned, blocks everything" state was
resolved rather than left as a standing gap.

**Alternatives considered:** Leaving the six ambiguous ones unpinned/blocked
until the owner explicitly picks — rejected as unnecessarily conservative
now that real category options are known and documented; a clearly-flagged,
reversible judgment call unblocks real usage today while remaining easy to
revisit. Reusing the exact same "Necklace" pick for "Pendant" — kept
intentionally, since a Pendant product genuinely is a necklace with a focal
piece on Etsy's site structure.

**Verification:** `npx tsc --noEmit`, `npm run lint`, `npm run build`, 48
unit tests all still pass. The taxonomy fetch itself was a real, successful
live API call (see previous entry) — the pinned IDs are real Etsy data, not
guessed. Not yet verified: whether Etsy's `createDraftListing` actually
accepts each of these 12 IDs without rejection (first real dry-run/publish
per `OWNER-SETUP.md` step 8 will confirm).

## 2026-07-08 (even later) - Etsy sync: two real auth bugs found and fixed via the full local OpenAPI spec

**Decision:** The owner supplied a full local copy of the Etsy OpenAPI v3 spec
(too large for the earlier in-session web fetch, which had silently
truncated). Grepping it surfaced two bugs that would have made **every**
Etsy API call fail, plus resolved 2 of the 4 remaining `TODO(etsy-verify)`
items:

1. **`x-api-key` header format was wrong.** The spec's own
   `components.securitySchemes.api_key.description` states: "Every request to
   a v3 API endpoint must include this data in the format
   `keystring:shared_secret`." The build (and the plan's
   `04-oauth-and-secrets.md`, which treated the shared secret as Phase-3-only
   for webhook verification) had sent the keystring alone. Confirmed live:
   every call — including endpoints that shouldn't need any shop-level
   auth — failed with `"Shared secret is required in x-api-key header"`
   until the header was corrected to `keystring:secret`. **Fixed:**
   `next-app/src/lib/etsy/client.ts` now has `requireEtsyApiKeyHeader()`
   (returns the combined value, used for the actual header) alongside
   `requireEtsyApiKey()` (keystring alone, used only for the OAuth `client_id`
   parameter, which must NOT include the secret). `etsyConfigured()` now
   requires both `ETSY_API_KEY` and `ETSY_SHARED_SECRET`. **This promotes
   `ETSY_SHARED_SECRET` from "Phase 3 only" to required from day one** — see
   the updated `etsy-sync-plan/OWNER-SETUP.md`.
2. **API host was wrong.** The spec's `oauth2.flows.authorizationCode.tokenUrl`
   is `https://openapi.etsy.com/v3/public/oauth/token` — the plan (and this
   build) had used `https://api.etsy.com` throughout. **Fixed:**
   `ETSY_API_BASE` in `client.ts`.
3. **Readiness-state endpoint path was already correct**, confirmed against
   `getShopReadinessStateDefinitions` in the spec — no change needed there.
   Its **response field names were wrong**, though: the code guessed a
   `name` field that doesn't exist; the real schema
   (`ShopProcessingProfile`) has `readiness_state` (enum
   `ready_to_ship`/`made_to_order`) and `processing_days_display_label`
   (e.g. "3 - 5 days"). Fixed in `shop-profiles/route.ts` and
   `EtsySettingsPanel.tsx`.
4. **Confirmed there is no rank-only image reorder endpoint** — the only
   operation at the per-image resource path is `deleteListingImage` (DELETE).
   The plan's assumed delete+re-upload fallback for reordering is therefore
   the genuine floor, not an unverified guess. Comment updated in
   `next-app/src/lib/etsy/images.ts`.
5. **Confirmed correct, no change needed:** `getSellerTaxonomyNodes` path,
   `uploadListingImage` path/params (including that `rank` 1 = left-most and
   an `overwrite` flag exists for replacing an image at a rank — still no
   bytes-free rank change), `ShopShippingProfile.title`,
   `ShopReturnPolicy.accepts_returns`/`accepts_exchanges`.
6. **Still genuinely unresolved** (not present anywhere in the full spec,
   not a truncation artifact this time): image upload size/dimension caps,
   and rate-limit response header names. Both remain `TODO(etsy-verify)`
   placeholders; likely documented only in prose (seller-help articles),
   not the machine-readable spec.

**Reason:** The owner asked to pin taxonomy IDs and supplied real API
credentials for a live test; the first live call's error
(`"Shared secret is required in x-api-key header"`) was the actual symptom of
bug #1, not a real "you need OAuth" error. Rather than keep guessing against
the live API (credential attempts aren't free and the user had asked to pause
on that), the owner then supplied a full local spec file, which resolved the
root cause definitively via the spec's own documented behavior — a strictly
better source than the earlier truncated web-fetch attempts.

**Verification:** `npx tsc --noEmit`, `npm run lint`, `npm run build`, and all
48 unit tests pass after these fixes. **Not yet re-verified live** — the
corrected `keystring:secret` format has not been re-tried against the real
API in this session; that's the natural next step once given the go-ahead.

## 2026-07-08 (later) - Etsy sync build-time resolutions (implementing etsy-sync-plan/BUILD-PROMPT.md)

**Decision:** Built Phase 1 + Phase 2 of the Etsy sync plan exactly as
specified, with the following build-time interpretations/resolutions where the
plan explicitly allowed judgment calls or where a live-spec check surfaced new
information:

1. **`when_made` enum — confirmed, not guessed.** Fetched the live OpenAPI spec
   (`https://www.etsy.com/openapi/generated/oas/3.0.0.json`) and got the
   verbatim 19-value enum. The plan (`02-field-mapping.md`) had guessed a
   "before_2007 family" bucket for years 2000–2006; the live spec instead has
   a discrete `2000_2006` value coexisting with `before_2007` in the same
   enum (no deprecation notice). Used the more precise `2000_2006` for that
   range. Pinned in `next-app/src/lib/etsy/mapping.ts`.
2. **Vintage cutoff is a rolling 20-year window, not a frozen 2006.** The plan
   text says "`item_year` > 2006 (i.e. newer than the 20-year cutoff)" —
   read as `currentYear - 20`, which equals 2006 only because it was written
   in 2026. Implemented as `vintageCutoffYear(now) = now.getUTCFullYear() - 20`
   so it stays correct in future years rather than silently going stale.
3. **Four items the live spec fetch could not resolve** (response truncated
   before reaching them) are pinned with a best-guess default and a
   `TODO(etsy-verify)` code comment, per the plan's explicit fallback
   instruction for exactly this situation: image upload size/format caps
   (`images.ts`, conservative 20MB placeholder), rate-limit response header
   names (`client.ts`, read defensively — absence is a no-op, never fatal),
   the readiness-state list endpoint path (`shop-profiles/route.ts`, degrades
   to an empty list + admin message on 404 rather than failing the route),
   and whether Etsy has a rank-only image reorder endpoint (`images.ts`,
   falls back to the plan's documented delete+re-upload approach).
4. **Taxonomy leaf IDs are deliberately left unpinned (`null`).** These
   require a live, authenticated `getSellerTaxonomyNodes` call — not just an
   unauthenticated spec fetch — and no `ETSY_API_KEY` exists in this build
   environment. Pinning a guessed numeric ID risked silently misfiling a
   listing into the wrong Etsy category; instead, pre-flight in `mapping.ts`
   **blocks every product** with a clear "category id not yet pinned" message
   until a developer fills in `ETSY_TAXONOMY_MAP` post-connect. This is the
   single biggest gap between "code-complete" and "usable" — see
   `etsy-sync-plan/OWNER-SETUP.md`.
5. **Pre-flight's `item_year` check is non-blocking**, matching the dated,
   decisive Q2 answer ("no item is blocked on age") over an earlier
   illustrative (pre-Q2) example payload in `09-api-routes.md` that showed
   `item_year` as a blocking check — the newer, explicit decision wins.
6. **Added a bulk-status route, an eligibility-summary route, and a
   secret-guarded price-push route** beyond `09-api-routes.md`'s named list.
   None contradict a decision; they're plumbing the documented admin UX
   (per-row status chips, the "32 eligible · 9 ineligible…" bulk summary, and
   a trigger target for the Phase 2 scheduled price push) actually needed,
   which that doc's route table didn't itemize down to that level.
7. **The daily price-push *trigger* (which cron fires the route) is not
   wired.** The plan explicitly left "Netlify Scheduled Function vs. an
   external cron hitting a secret-token-guarded route" as a build-time
   choice. Built only the guarded route
   (`POST /api/admin/etsy/price-push`, header `x-cron-secret`) — introducing
   a new Netlify Functions deployment target untestable in this environment
   felt riskier than shipping the route and leaving trigger wiring (a
   five-minute task, several options) on the owner checklist.
8. **Added `sharp` (explicit dependency) and `vitest` (new test runner)** —
   `sharp` was already resolved transitively; `vitest` didn't exist in this
   project before (no test runner existed) and the BUILD-PROMPT required real
   unit tests, so the lightest-weight, most standard option was added.
9. **WebP test fixtures are generated in-memory via `sharp` inside the test
   file**, not committed as binary files, to keep the repo pristine per
   `AGENTS.md` while still exercising the real encode/decode path.

**Reason:** BUILD-PROMPT.md's hard rule #8 explicitly sanctions exactly these
kinds of build-time judgment calls ("exact `when_made` enum strings, image
size/format caps, rate-limit header names, readiness-state endpoint path,
whether image re-rank needs re-upload, and taxonomy leaf IDs") and requires
recording what was assumed vs. confirmed rather than silently guessing.

**Alternatives considered:** Guessing a plausible taxonomy ID per product type
— rejected as too risky (a wrong id can misfile or reject a listing
unpredictably, with no sandbox to catch it before a real listing goes out).
Building a real Netlify Scheduled Function for the price push — deferred; the
guarded-route approach ships the actual sync logic without adding an
unverifiable second deployment primitive in one pass.

## 2026-07-08 (latest) - Etsy sync: all 11 planning questions decided by owner

**Decision:** The owner answered every open question in
`etsy-sync-plan/13-open-questions.md` (full decisions + reasoning live there;
this is the summary). Highlights: **draft-for-review** on Etsy (no
auto-activate initially); **owner-attested vintage fallback** — items with
`item_year` > 2006 or missing push as `when_made: '1990s'` in the Etsy
payload only (DB/site untouched, flagged in dry-run) because the owner
attests all inventory is genuinely vintage and the year labels are the error;
**EN-only** listings; **daily ≥1%-threshold** spot-price push; **8% Etsy
price markup** (site prices unchanged); **Domestic & Global Pricing stays
OFF** (confirmed); **everything available is eligible incl. coins/bullion**
(owner accepts Etsy policy risk; rejections surface per-item);
**no reconciliation UI** needed (shop has only a few unrelated manual
listings); **deactivate, never auto-delete**; **manual handling of Etsy
sales** until/unless Phase 3; Etsy shipping/returns will **mirror the site's
policies**.

**Why:** These were the blocking inputs for the Etsy sync architecture plan
(`etsy-sync-plan/`, written same day). Q2 (vintage rule) and Q6 (regional
pricing) were hard blockers; both are now resolved.

**Status:** Still planning-only — no code/SQL/config implemented. Remaining
gates: Etsy app approval (`naples-estate-jewelry-sync`, pending personal
approval) and Phase 0 shop setup per `etsy-sync-plan/12-phased-rollout.md`.

## 2026-07-07 - Self-host + subset Material Symbols instead of the Google Fonts <link>

**Decision:** The Material Symbols icon font is now self-hosted as a **subset**
woff2 committed to `next-app/public/assets/fonts/material-symbols-subset-v358.woff2`
(~58KB), declared via an inline `@font-face` in `globals.css` and `preload`ed in
`[locale]/layout.tsx`. The render-blocking third-party
`<link rel="stylesheet" href="fonts.googleapis.com/...">` and both Google
preconnects were removed.

**Why:** The external stylesheet sat on the critical render path and delayed
first paint on high-latency mobile. Worse, the full variable font is **2.33MB**;
with `font-display: block` it routinely blew past the ~3s block window and then
fell back to showing each icon's **ligature name as raw text** ("shopping_bag",
"chevron_right") — the "rendering going wrong" the user reported. A 65KB subset
loads inside the block window, so icons render cleanly.

**Key subtlety (why the naive subset failed):** Material Symbols is a *ligature*
font — pyftsubset keeps a ligature if its component **letter** glyphs survive, and
the icon set collectively uses every letter, so `--text` retained all ~6,600
glyphs (2.27MB, no savings). The working approach resolves each used icon name to
its exact ligature **target glyph** and subsets by explicit glyph set with layout
closure OFF, keeping the FILL/opsz/wght axes so `fontVariationSettings` (fill
toggle, thin weights) still work.

**To regenerate after adding/removing icons** (needs `pip install fonttools brotli`):

Run `python scripts/regenerate-material-symbols-subset.py` from `next-app/`.
The script downloads nothing — place a full `material-symbols-full-v357.woff2`
next to the subset first (URL is inside the Google CSS response for
`Material+Symbols+Outlined:opsz,wght,FILL@20..48,100..700,0..1&display=block`),
then delete the full font before shipping.

Icon extraction must include **multiline JSX element text** (e.g. `drag_indicator`
on its own line inside a `<span class="material-symbols-outlined">`) — quoted-
string-only scans miss those and the ligature falls back to raw text. The script
also catches `icon:` fields, ternaries inside `{…}` icon spans, and quoted
literals, then filters candidates to names that resolve to real GSUB ligatures
(unwraps ExtensionSubst wrappers; Material Symbols ligatures live behind lookup
type 7 → 4, not at the top level).

Manual steps if regenerating by hand:

1. Download the full variable woff2 (the URL is inside the CSS that this returns,
   fetched with a modern browser UA):
   `https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL@20..48,100..700,0..1&display=block`
2. Collect every icon-name literal from `next-app/src` + `next-app/carousel`
   (element text inside `material-symbols-outlined` spans — including multiline —
   `icon:` fields, ternaries in `{…}` expressions, and quoted literals).
3. Resolve each name to its GSUB ligature target glyph and write the kept glyph
   names (icon glyphs + their component letters) to a file.
4. Subset (keeps ligatures + variable axes, no closure re-expansion):
   `python -m fontTools.subset full.woff2 --glyphs-file=keep.txt --layout-features+=liga,dlig,clig,calt,rlig --no-layout-closure --flavor=woff2 --output-file=material-symbols-subset-vNNN.woff2`
5. Bump the versioned filename, update the `@font-face` src + the `preload` href,
   and verify every used icon still resolves in the new subset before shipping.

## 2026-07-07 - Quantity Phase 2: unit price stays the snapshot, quantity is a separate column; capture decrements atomically under the existing lock

**Decision:** For multi-unit purchases, `order_items.price_snapshot` keeps its
existing meaning — the price of **one** unit — and a new `order_items.quantity`
column holds the count; every line total is `price_snapshot * quantity`. This
avoids reinterpreting a column that live orders, invoices, emails, and refund
math already depend on, and keeps unit price visible on receipts.

**Capture-time stock decrement reuses the existing row-lock, not a new
mechanism:** `capture_paypal_order` already took a `FOR UPDATE` lock on the
order's product rows to serialize concurrent captures of a one-of-one item.
Phase 2 keeps that exact lock and simply changes what happens inside it: check
that every line still has `quantity >= oi.quantity` (and status `available`),
then `products.quantity = greatest(quantity - oi.quantity, 0)` and flip to
`sold` only at 0. So the concurrency guarantee is unchanged; "oversell" is now
the generalization of the old "already sold" conflict, surfaced through the
same `item_conflict` return flag and admin-refund path.

**Cart `count` now means total units, and `add()` increments instead of
no-opping:** the header badge counts units (sum of `purchaseQuantity`), and
re-adding an item in the cart raises its quantity (capped at stock) rather than
being ignored — the natural behavior once a line can hold more than one unit.
`normalizeCartItem()` clamps `purchaseQuantity` to `1..stockQuantity` on every
load so stale localStorage carts (from before this field existed, or after
stock dropped) self-heal instead of sending an impossible quantity to checkout.

**Quantity UI only appears when `stockQuantity > 1`:** the stepper is hidden
for one-of-a-kind items (the overwhelming majority of inventory), so the
storefront/cart/checkout look identical to before for them; the shared
`QuantityStepper` lives in `OrderSummary.tsx` and is reused by the detail page,
cart drawer, and checkout summary to keep clamp/label behavior identical.

**Order-reading pages fold `quantity` into the existing `item_year_snapshot`
fallback tier:** rather than add a new combinatorial set of "columns without
quantity" variants to every order query, `quantity` is stripped alongside
`item_year_snapshot` whenever a missing-column error mentions either. A DB
missing `quantity` predates this migration, and stripping both together keeps
the fallback matrix from exploding; the transient cost (item_year also dropped
from display until the migration runs) is acceptable on internal admin/account
pages and disappears the moment the migration is applied.

## 2026-07-07 (earlier) - Quantity is a real stock count (not a cosmetic label), shipped in two phases; status auto-sync is one-directional

**Decision:** When asked to "add the ability to list multiple quantity of the
same item," the user was offered two designs — an informational-only "3 in
stock" label with no effect on purchasability, vs. a real stock count that
drives availability (item stays purchasable until quantity hits 0, decrements
atomically per paid order, lets a buyer choose a quantity). The user chose the
**real stock count**. Given the size of that request (it touches the live
PayPal capture RPC, checkout math, and the cart model), it was then split into
two phases at the user's explicit direction:

- **Phase 1 (this pass):** `products.quantity` column, admin New/Edit Item
  field (default 1), AI listing-assistant autofill, `isProductPurchasable()`
  gated on quantity, and storefront "N in stock" display.
- **Phase 2 (deferred, tracked in TASKS.md):** buyer-facing quantity selection
  in the cart/checkout, and atomic per-unit stock decrement in the PayPal
  capture RPC.

**Reason for the phase split:** the payment-capture path is the single most
sensitive piece of code in the app (it's what stands between "buyer paid" and
"product marked sold," with existing race-condition handling for concurrent
buyers on a one-of-one item). Bundling a rewrite of that RPC into the same
change as a purely additive admin/display field would make the diff much
harder to review and would block shipping the low-risk half (which is most of
the user's stated ask — "add the field... AI fills it in... add to new/edit
item") behind the high-risk half.

**`isProductPurchasable()` design — additive, not a breaking signature
change:** rather than requiring every call site to pass a `Product` object,
the function kept its original `status` first argument and gained an
*optional* second `quantity` argument. A missing/undefined quantity
normalizes to `1` (via the new `normalizeProductQuantity()`), so every
pre-existing call site continues to compile and behave identically without
being touched; only call sites that have live quantity data available
(shop cards, product detail, checkout pricing, admin orders) were updated to
pass it, making the stock gate take effect. The wishlist drawer's stored
item snapshot has no live quantity data (same pre-existing limitation as its
`status` staleness) and was intentionally left alone rather than plumbing a
new field through a feature that doesn't refresh live product state anyway.

**Status auto-sync is one-directional (quantity → 0 forces `sold`; quantity
restocked above 0 never auto-restores `available`):** the admin save handler
force-flips `status` to `sold` the moment a saved quantity reaches 0, so the
storefront/admin table never show a "0 in stock, Available" contradiction.
The reverse was deliberately NOT implemented — an admin who manually marks an
item Sold (e.g. correcting a mistaken listing, or intentionally pulling stock
without deleting it) shouldn't have that decision silently undone just
because they later edit the quantity field back to a positive number for
some unrelated reason. Restocking an item that's marked Sold requires
explicitly flipping Status back via the dropdown that sits right next to it.

**CartItem quantity naming — `stockQuantity`, not `quantity`:** deliberately
avoided naming the new "units in stock" field on `CartItem` just `quantity`,
reserving that name for Phase 2's "how many of this the buyer is buying" —
so the two concepts (available stock vs. requested purchase count) can never
collide once Phase 2 introduces the latter.

## 2026-07-07 (a bit earlier) - Trade-in line override is a separate flat amount, not a scrap-value edit

**Decision:** The new "Override customer special pricing" admin control only
replaces the number shown on the product page's "Own gold or silver? Put it
toward this piece and pay as little as ___" trade-in line. It does **not**
touch the "Scrap value / Based on spot" box above it, which keeps showing the
real value computed from `weight × purity × spot`. Implemented as two new
nullable/boolean columns (`special_price_override_enabled`,
`special_price_override_amount`) rather than repurposing an existing pricing
field, and gated in `types/product.ts` via `getSpecialPriceOverrideAmount()`
so an enabled-but-blank/zero/negative amount silently falls back to the
computed scrap value instead of ever rendering `$0`.

**Reason:** The user's request was specifically to let an admin advertise a
custom, possibly rounder/more attractive trade-in price on that one line
(e.g. "$300" instead of a literal $287.42 melt calculation) without lying
about the item's actual computed scrap value elsewhere on the same page. Two
different numbers, both true in their own context (one is "what we compute
this melts for," the other is "what we're offering as a floor if you trade
metal toward this piece") — collapsing them into one field would either
overwrite the real melt value with a marketing number or require a second
source of truth for "actual" scrap value, both worse than two clearly-named
columns.

**Alternatives considered:** (1) Reuse `manual_price_label`'s
presence-implies-override pattern (single nullable text field, no separate
boolean) — rejected: that field is a full price *label* (can be non-numeric
prose), whereas this needs a raw currency amount to run through the existing
`formatUsdPrice()` pipeline identically to the computed value, and the user
explicitly asked for a checkbox + number combo rather than "type something to
override, clear it to reset." (2) Let the override also apply to the
scrap-value box itself — rejected: would make the box lie about the item's
real melt value, and the user's wording ("override *that* special price")
scoped the ask to the trade-in line specifically.

**Scope/safety:** Visibility of the trade-in line now depends on
`tradeInValue` (override amount OR computed scrap value) rather than requiring
a computed scrap value specifically — so an admin can enable the override and
show this promotional line even on an item missing weight/purity data. The
`show_spot_price` per-item toggle and `isPurchasable` status gate still apply
unchanged, keeping the line's other visibility rules intact. Follows the same
optional-column retry/fallback and anon/authenticated grant pattern already
established by `show_spot_price` (see `product-show-spot-price-2026-07.sql`)
so this ships safely ahead of the SQL migration running live.

## 2026-07-07 (later still) - Filter the React 19 "script tag" console warning rather than rewrite the anti-flash script

**Decision:** Keep the blocking inline `<script dangerouslySetInnerHTML>` in
`shop/(list)/page.tsx` (mutates `<main>` via `document.currentScript` before
paint to skip the shop hero's entry-reveal replay on a repeat visit) exactly
as-is, and add a small client component
(`components/shop/ScriptTagWarningGuard.tsx`) whose module-scope side effect
patches `console.error` to drop only the one exact known-false-positive
message text React 19 logs for it on hydration.

**Reason:** React 19 logs "Encountered a script tag while rendering React
component..." for ANY literal `<script>` JSX host element, not just ones that
are actually broken. Confirmed via `facebook/react#34008` and, more directly,
`shadcn-ui/ui#10104` — the *exact* same warning, for the *exact* same
technique (`next-themes`' theme-flash-prevention script), which the
shadcn-ui/next-themes maintainers themselves describe as "a false positive
for this use case" and whose own docs now recommend this same console-filter
workaround. The script provably still runs correctly (verified live:
`shop-repeat-visit` class applies, sessionStorage flag sets) — nothing is
actually broken, only a dev console message.

**Alternatives considered:** (1) Rewrite to use a client-side
`useLayoutEffect` instead of a raw script — rejected: layout effects only run
after hydration/JS-bundle-load, which is after the browser's first paint of
server-rendered HTML, reintroducing the exact animation-replay flash this
script exists to prevent. (2) `next/script` with `strategy="beforeInteractive"`
— rejected: Next.js collects `beforeInteractive` scripts into `<head>` rather
than leaving them in place in `<body>`, which breaks
`document.currentScript.parentElement`'s dependency on being inline,
immediately after `<main>` opens. (3) The `type="application/json"`-on-client
/real-type-on-server attribute-swap trick some `next-themes` users adopted —
rejected: relies on an undocumented internal React function
(`isScriptDataBlock`) that could change behavior in a future patch release,
and trades one warning for a *different* one (a server/client `type`
attribute mismatch) unless additionally suppressed — no simpler than the
console filter, but more fragile.

**Scope/safety:** The filter matches only the exact known message prefix
(`args[0].startsWith(...)`), so it can never mask an unrelated error, is
dev-only (`NODE_ENV === 'development'`; production React doesn't emit this
warning at all), and is idempotent (guarded by a flag on `window` so repeated
module evaluation/HMR doesn't stack wrappers). Should this exact pattern be
needed elsewhere in the app later, reuse the same guard component rather than
duplicating the patch.

## 2026-07-07 (later) - Relocate the Turbopack dev cache off OneDrive via NTFS junctions, not by moving the project

**Decision:** Keep `next-app/` physically inside the OneDrive-synced project
folder (per the existing source-of-truth rule), but make `next-app/.next` an
NTFS directory junction pointing to
`%LOCALAPPDATA%\dev-cache\NaplesEstateJewelry\next-app\.next` (a per-machine,
non-synced local folder), with a matching `node_modules` junction at the same
local location pointing back to the real `next-app/node_modules`. Also added a
`predev` script (`scripts/dev-cache-guard.mjs`) that clears the Turbopack
cache subfolder if it's ever left in an obviously-corrupted "bookkeeping
files, no data files" state.

**Reason:** Turbopack's dev cache is a RocksDB-style store that corrupts when
another process holds a file lock on it mid-write; OneDrive's background sync
does exactly that on Windows, and this had already produced sticky 500s
requiring a manual `.next` delete in at least one earlier session (2026-07-05,
"Dev-infra" note). Confirmed against a live upstream bug
(vercel/next.js#95495) whose fix only ships starting in Next.js `16.3`
canary/preview builds — not stable, not appropriate to adopt for this
project's pinned `16.2.9` yet. Relocating just the disposable, already-`.gitignore`d
`.next` folder onto local (non-synced) disk removes OneDrive from the picture
entirely without moving the project or touching source/docs.

**Alternatives considered:** (1) Wait for Next.js 16.3 stable — rejected for
now, no ETA and canary is unsuitable for this project's toolchain. (2) Move
`node_modules` off OneDrive too (not just `.next`) — deferred; the corruption
was specifically in the `.next` dev cache, `node_modules` churns far less
often post-install, and minimizing the number of junctions keeps the setup
easier to reason about. Can revisit if OneDrive sync load on `node_modules`
itself becomes a problem. (3) Pause OneDrive sync manually during dev sessions
— rejected as a manual, easy-to-forget workaround rather than a fix.

**Gotcha found while implementing:** a junction-only move of `.next` broke
`next dev` entirely (`Cannot find module 'react/jsx-runtime'` on every route)
because Node resolves the chunk files' *real* path (through the junction)
before walking up for `node_modules`, and that upward walk from
`%LOCALAPPDATA%\...` never reaches the real `next-app/node_modules` in
OneDrive. Fixed by adding the second `node_modules` junction alongside the
relocated `.next`, so the upward walk finds a `node_modules` entry at the
right directory level. Anyone relocating other Next.js/Turbopack cache
directories off-tree should expect the same requirement.

**Scope note:** Both junctions are local filesystem state only — `.next` and
`node_modules` are already `.gitignore`d, so this has no effect on the git
repo copy, the wholesale-copy-to-GitHub workflow, or the Netlify build (fresh
checkout, no junctions involved).

## 2026-07-07 - Shop loading spinner via useTransition, not loading.tsx

**Decision:** Show pending state for shop filter/sort/view/year/pagination
navigations with a shared client-side `useTransition` context
(`ShopNavigationProvider`/`useShopNavigation()` in
`components/shop/ShopNavigationProgress.tsx`) plus `next/link`'s
`useLinkStatus()` for the `<Link>`-based pagination controls, rendering a small
spinner overlay on the results panel while any of them are pending. Every
control that changes the URL now calls the shared `push()` instead of calling
`useRouter().push()` itself.

**Reason:** `/shop` already has a full-page `loading.tsx` skeleton, but it only
fires for genuinely new navigations into the route — a same-route search-param
change (the normal case for every filter/sort/pagination control here) keeps
showing the last-rendered page/grid while React fetches the new RSC payload in
the background (this is the intended React 18 "keep showing old content during
a transition" behavior, not a bug), which is exactly what the owner reported as
the page looking "frozen" for a beat. `useTransition`'s `isPending` is the
correct, minimal-footprint signal for "a navigation triggered by this control is
in flight," independent of whether that navigation is a fresh route or a
param-only refresh.

**Alternatives considered:** (1) Route this through `loading.tsx`/Suspense
instead — rejected; as above, it doesn't fire for same-route search-param
updates, which is the entire use case here. (2) Give every filter/sort/
pagination control its own local `useTransition`/spinner — rejected; the
spinner needs to be visible over the product grid regardless of which control
(dropdown, sort, page link, per-page select) triggered the change, so the
pending state has to be shared across all of them. (3) Skip pagination's
`<Link>` elements and convert them to buttons calling the shared `push()` so
they'd share `useTransition` directly — rejected to keep pagination as real,
crawlable `<a href>` links (SEO/deep-linking); `useLinkStatus()` + a tiny bridge
component gets the same shared-spinner behavior without giving that up. (4) No
debounce on the spinner — rejected; would flash on every instant/prefetched
navigation. Settled on a 150ms show-delay with immediate hide on completion.

## 2026-07-06 (even later) - Shop filter facets always show every option

**Decision:** The gallery's Brand and Item Type dropdowns always list every value
present anywhere in the public catalog, regardless of which other filters
(brand/metal/purity/status/etc.) are currently active. They remain scoped by the
Jewelry-vs-Sterling-Silver category tab (a structural split of the store, not an
ad-hoc filter), and Metal Color/Purity remain scoped by the selected Metal (gold
vs silver — invalid combinations otherwise), but no dropdown's own available
options shrink because of a value picked in another (or the same) dropdown.

**Reason:** The owner reported that selecting Brand = "Taxco" then reopening the
Brand dropdown only showed "Taxco" and "All brands" — every other brand vanished
until the filter was cleared back to "All" first. The owner explicitly asked for
free movement among choices, generalized to every dropdown, not just Brand.

**Alternatives considered:** (1) Classic faceted-narrowing (à la Amazon: each
dropdown reflects what's available given every *other* active filter, excluding
its own) — rejected; the owner explicitly asked for full, unrestricted lists
everywhere, not smarter narrowing. (2) Keep computing facets from the DB-filtered
result set but union in the currently selected value if missing — rejected as a
partial fix that still hides every *other* unselected option. (3) Fetch the full
catalog unconditionally on every request — rejected in favor of reusing the same
cached unfiltered read when no filters are active, avoiding an extra DB round trip
in the common (unfiltered) case.

## 2026-07-06 (later) - Per-item toggle to hide melt/scrap value, not a pricing-mode change

**Decision:** Add a new, independent `products.show_spot_price` boolean (default
`true`) that only controls whether the product page's melt/scrap-value + "based on
spot $/oz" callout (and the paired store-credit line) is shown. It does not touch
`price_mode`/`pricing_multiplier` or how the item's actual selling price is computed.
When off, the callout is replaced with a short note explaining the item isn't 100%
precious metal.

**Reason:** The store already has a `price_mode` of `spot-multiplier` vs `manual`
for how an item's *selling price* is computed. But regardless of that mode, the
product detail page always shows a melt/scrap-value estimate whenever weight+purity
are filled in — including for manually-priced items that keep weight/purity for
internal reference. For mixed-metal/gemstone pieces, that melt estimate (computed
off the full item weight) overstates real scrap value and could mislead buyers. The
owner confirmed (2026-07-06) the fix should be a small explanatory note in place of
the box, not a change to the item's actual price or pricing mode.

**Alternatives considered:** (1) Reuse `price_mode === 'manual'` as the signal to
hide the box — rejected because manual-priced items may legitimately still want to
show an accurate melt value, and spot-multiplier items may need the box hidden too;
the two concerns are orthogonal. (2) Hide the box outright with no explanation —
rejected per owner request for a small asterisk-style note instead. (3) Also change
the computed selling price when the toggle is off — rejected; the owner only asked
to address the melt-value disclosure, and changing price computation would need a
separate, explicit decision.

## 2026-07-06 - Remove manual Reserved item status

**Decision:** Remove the manual **Reserved** product status from the active app. Product
Admin no longer shows a Reserved metric, status option, quick-fill token, or row action.
Legacy stored `reserved` values normalize to `available` in the app layer. Manual
admin-created unpaid orders continue to move products to `pending_payment`; sold,
archived, draft, and available remain as the active product lifecycle statuses.

**Reason:** The owner wants the reservation feature gone from item management. The
remaining lifecycle states cover the actual workflows without exposing a separate
manual hold status.

**Alternatives considered:** (1) Keep `reserved` as a hidden/internal status - rejected
because it leaves behavior and copy around the removed feature. (2) Add a destructive DB
migration to rewrite/drop old reservation columns immediately - deferred because the
request is satisfied in app behavior and destructive live data/schema changes should be
handled as an explicit SQL step if later needed.

## 2026-07-06 - Orders badge tracks unseen active orders

**Decision:** The admin **Orders** nav badge now counts active order rows created after
the current admin/browser last viewed the active Orders area. Viewing `/admin/orders`
or an order detail page stores a local last-seen timestamp and clears the badge. Orders
in the Recycle Bin (`orders.deleted_at is not null`) do not count toward the badge.

**Reason:** The prior badge counted `payment_status='paid'` +
`fulfillment_status='pending'`, so it behaved like a fulfillment workload counter and
could show stale numbers unrelated to visible active orders, especially after the
Orders Recycle Bin was added. The owner wants the tab label to work like a notification:
show new orders that have not been seen, then disappear once they are seen.

**Alternatives considered:** (1) Keep the old fulfillment count - rejected because it
does not answer "new/unseen" and can disagree with the active Orders list. (2) Add a
new database read-state column/table - deferred as heavier than needed for the current
single-admin workflow. (3) Put orders back into the Messages unread system - rejected
because prior project direction separated order awareness from the Messages inbox.

## 2026-07-06 - Manual fixed price entry uses Price Label, not Asking Price

**Decision:** The admin New Item/Edit Item form no longer exposes an **Asking Price**
field. For `price_mode='manual'`, the single visible source of truth is
`manual_price_label` ("Price Label"). Admin saves clear `asking_price` to `null`; quick
fill and AI values that previously targeted asking price now populate the price label.
Bare numeric labels are accepted and normalized by shared pricing helpers (`1` -> `$1`,
`1200` -> `$1,200`) so shop display, cart, checkout, and order snapshots parse the same
value. New Item also has a **Quick add** checkbox that sets manual fixed pricing and
lets admins create a minimum viable listing with title + price without entering
spot-pricing inputs. Checkout snapshot pricing parses the price label first, with
`asking_price` retained only as a legacy fallback for older rows that have no label.

**Reason:** Maintaining both fields created duplicated manual-price entry and allowed a
hidden stale asking price to override the visible label. The owner wants manual fixed
pricing to be controlled by the label the admin actually sees. Admins also need to list
a simple fixed-price item quickly without accidentally creating an unpriceable
spot-multiplier product.

**Alternatives considered:** (1) Keep both fields but disable asking price - rejected
because it still leaves two concepts in the form. (2) Drop all legacy `asking_price`
handling immediately - rejected because older rows may still rely on it until edited.
The chosen path consolidates new/edit flows while preserving old data safely. (3) Let
Quick add save items with no price - rejected because those products would still
produce dash totals in cart/checkout; Quick add skips spot gates, not the price itself.

## 2026-07-05 - Admins may explicitly restore inventory from completed orders

**Decision:** Order detail has an explicit **Restore item to inventory** action that
marks the linked product rows `available` without changing the order's payment/order
status. The Recycle Bin delete confirmation also offers a second explicit path,
**Move to Recycle Bin and return to inventory**, which restores linked products before
soft-deleting the order. Paid/completed orders are allowed through these explicit admin
paths.

**Reason:** The business may have more than one of the same item or may need to re-list
inventory even though a previous order remains a valid completed sale record. Inventory
state and sales/payment history are related but not always identical; the admin needs a
deliberate override that preserves the order record while re-opening the item for sale.

**Alternatives considered:** (1) Continue blocking paid orders from inventory return -
rejected because it prevents legitimate re-listing when another matching item exists.
(2) Automatically return inventory whenever an order is deleted - rejected because it
can unintentionally re-list sold inventory. The chosen design makes record deletion and
inventory return two separate, visible choices.

## 2026-07-05 - Generate invoice rows at order creation; update status on payment

**Decision:** Create an `invoices` row as soon as an order is placed, even before
payment is captured. New PayPal checkout orders and new manual admin orders generate a
draft invoice through the shared idempotent `upsertOrderInvoice` helper. When a PayPal
capture succeeds, the same helper updates the existing invoice to `paid` instead of
creating a duplicate. Admin order detail exposes a Generate/Refresh Invoice action for
older orders that predate this rule or otherwise lack an invoice row.

**Reason:** An order can exist before payment, but the admin still needs a stable
invoice document/number immediately and a recovery path for legacy gaps. Idempotent
upsert keeps PayPal retries, webhook/capture backstops, and manual refreshes safe.
Updating the existing row on payment avoids the bug where a pre-created draft invoice
would prevent the later paid invoice status from being written.

**Alternatives considered:** (1) Generate invoices only on paid capture - rejected
because unpaid/manual orders and abandoned-but-valid order records have no invoice for
admin follow-up. (2) Generate only from the admin detail page - rejected because normal
orders should not require a manual second step. (3) Insert a new paid invoice on capture
with a different number - rejected because one order should have one stable invoice
number.

> Running log of important technical, design, and business decisions. Newest at
> the top. Use the format below for every entry.
>
> ```
> ## YYYY-MM-DD — Short title
> **Decision:** ...
> **Reason:** ...
> **Alternatives considered:** ...
> ```

## 2026-07-05 — Orders delete to a Recycle Bin via `orders.deleted_at`

**Decision:** Add a soft-delete Recycle Bin for admin orders using a nullable
`orders.deleted_at` column. `/admin/orders` shows only active rows (`deleted_at is
null`), `/admin/orders?view=trash` shows deleted rows, Restore clears `deleted_at`, and
Delete Forever still hard-deletes from the bin after confirmation. Restoring an order
record does not automatically change product inventory statuses.

**Reason:** Order records are sales/accounting history, so accidental hard deletes are
too costly. A simple timestamp keeps recovery cheap, preserves order items and email
history, and matches the existing admin Messages recycle-bin mental model while avoiding
inventory surprises on restore.

**Alternatives considered:** (1) Keep hard delete and rely on caution — rejected because
the owner explicitly wants recovery. (2) Use `order_status='cancelled'` as the bin —
rejected because cancelled is a real business state, not a deletion marker. (3) Auto-
restore inventory statuses when restoring an order — rejected for now because inventory
may have changed after deletion; the app restores the record only and leaves inventory
review to the admin.

## 2026-07-05 — `shop/(list)/` route group to give product pages a real 404

**Decision:** Put the shop-list page and its loading skeleton in a `shop/(list)/`
route group, keep `shop/[id]/page.tsx` with **no** `loading.tsx`, and add an early
`notFound()` in the product `generateMetadata`. This makes unknown/hidden
`/shop/[id]` URLs return a genuine HTTP 404 while `/shop` keeps its streamed
loading skeleton.

**Reason:** A `loading.tsx` creates a Suspense/streaming boundary that commits a
200 shell before the page body's `notFound()` runs, so bad product URLs were
soft-404s (200). The boundary that mattered was the **ancestor** `shop/loading.tsx`
(it wraps `[id]` too), so removing only `shop/[id]/loading.tsx` didn't help — both
had to leave `[id]`'s ancestry. A route group `()` doesn't change the URL but scopes
`(list)/loading.tsx` to the list segment only, so it no longer wraps `[id]`. Verified
empirically in this Next 16 (Turbopack) setup: `notFound()` in `generateMetadata`
alone did **not** flip the status while a boundary was present; removing the boundary
did.

**Alternatives considered:** (1) Remove both loading files — works but loses the
shop-list skeleton on the main commerce page. (2) `dynamicParams = false` — gives a
clean 404 but a newly-added product would 404 until a rebuild, breaking the live
admin→shop workflow. (3) Keep the soft-404 as a `noindex` 200 (the prior behavior) —
SEO-safe but not a real 404. The route group keeps the skeleton, real 404s, and live
inventory. Cost: the product-detail page loses its own loading skeleton (acceptable;
client nav shows the prior page until ready). A future option is an in-page `<Suspense>`
on the product page (existence check before the boundary) to restore that skeleton.

## 2026-07-03 — Auto-send receipt on payment; one paid-aware invoice/receipt email

**Decision:** When a PayPal order is captured (becomes paid), automatically email the
buyer their **receipt** from the `capture-order` route — best-effort (a send/log
failure never fails the capture) and only on the fresh capture (an already-paid order
short-circuits earlier in the route, so no duplicate receipt). Use **one** email
builder (`buildInvoiceEmailContent`) that is **paid-aware**: a paid order renders as a
"Receipt" (subject/header wording, a "PAID IN FULL" badge, "Total Paid", paid intro/
note); an unpaid order renders as an "Invoice". Both the admin *Email Invoice/Receipt*
button and the auto-send go through a shared `lib/order-invoice-mailer.ts`
(`sendOrderInvoiceEmail`: fetch order+items → build content → Resend → log to
`order_emails` with `email_type` `'receipt'|'invoice'`). Auto-sends record with a null
`sent_by` (the history shows "Sent automatically"); admin sends record the admin.

**Reason:** The customer's "order placed" moment online is the capture (payment
succeeds), so that's the natural trigger and it's always a paid receipt there. A single
paid-aware builder keeps one source of truth for the document and means the admin
"resend" button automatically produces the right wording. Best-effort send/log keeps
the payment path reliable — the money is already captured, so nothing about the email
may block it. The shared mailer removes the duplicated fetch/build/send/log that
otherwise lived in the admin route.

**Terminology:** paid = "Receipt", unpaid = "Invoice" (the owner was fine calling it a
receipt when paid). The stored `invoices` row + INV-number are unchanged; only the
customer-facing email wording switches on payment status.

**Alternatives considered:** (1) Send on order *creation* (`create_paypal_order`) —
rejected: the order is unpaid then (it'd be an invoice for a not-yet-paid order and
could fire on abandoned checkouts). (2) Also send from the webhook backstop capture —
deferred: the client capture covers the normal path; adding webhook send needs the
same idempotency guard and can be added later if backstop-only captures need it.
(3) Two separate builders (invoice vs receipt) — rejected: one paid-aware builder is
less to maintain and keeps the admin preview and the sent email identical.

## 2026-07-03 — Per-order email history: dedicated `order_emails` table, best-effort logging

**Decision:** Record every admin-sent email from the order detail page (invoice +
fulfillment-update) in a new **`order_emails`** table (order_id FK, email_type,
recipient, subject, status, sent_by/sent_by_email, created_at) and render it in an
**Email History** card under the Summary block on `/admin/orders/[id]`. The two email
routes insert the row **after** a successful Resend send, **best-effort** — a logging
failure (including the table not being migrated) is caught and never fails the email
or the request. Reads/writes run as the authenticated admin (cookie server client)
gated by RLS via the existing `is_admin_user()` helper. The client panel prepends each
just-sent email optimistically so the history updates without a reload; the server
record is the source of truth on next load.

**Reason:** A dedicated table matches the app's one-table-per-concern convention and
keeps email history queryable per order (indexed on `(order_id, created_at)`) without
overloading `admin_notifications` (the message center) or stuffing a JSON blob on
`orders`. Best-effort logging keeps the primary action (sending the email) reliable
and makes the feature safe to ship before the migration is applied. Attributing the
insert to the authenticated admin (not service role) gives a natural `sent_by` and
needs only a simple admin RLS policy.

**Alternatives considered:** (1) A `jsonb` column on `orders` — simpler migration but
unqueryable, races on concurrent writes, and bloats the order row. (2) Reuse
`admin_notifications` — wrong surface (that's the message inbox) and mixes concerns.
(3) Fail the request if logging fails — rejected: the email already went out, so the
send must report success regardless. (4) Service-role insert — avoids an RLS policy
but loses easy `sent_by` attribution; the admin cookie client already runs these
routes.

## 2026-07-03 — Admin "show sold items in shop" toggle: own single-row table + service-role writes

**Decision:** Add an admin setting to show/hide SOLD products in the public shop
gallery, stored in a **new single-row `shop_settings` table** (`show_sold_items
boolean default true`) rather than reusing an existing settings table. Public shop
reads it with the cookie-free anon client (RLS `select using(true)` + anon grant);
writes go **only** through the admin API route (`/api/admin/shop-settings`,
`requireAdmin`-gated) using the **service-role client**, so no admin RLS write policy
/ `is_app_admin()` dependency is needed. The shop's cached catalog read
(`unstable_cache`, tag `shop-catalog`) reads the setting inside the cached function;
the PUT route busts the `shop-catalog` tag so a toggle takes effect promptly.
Available items are always shown; only `sold` is gated. Default and all failure paths
degrade to **showing** sold (historical behavior), so the site is unchanged until the
migration is applied and the admin opts to hide.

**Reason:** Matches the app's established one-table-per-concern settings pattern
(`ai_settings`, `carousel_settings`, `marketing_settings`) and its "service-role write
behind a `requireAdmin` gate" convention (used by marketing/contact routes), which
avoids adding an RLS write policy. Reading inside the cached function keeps the shop's
single-DB-round-trip caching intact; tag invalidation on write is the same mechanism
product writes already use. Defaulting to show-sold means the feature is additive and
safe pre-migration.

**Alternatives considered:** (1) Add a column to `carousel_settings` — rejected:
semantically unrelated, and its admin-write policy is email-based (`is_carousel_admin`).
(2) Read the setting outside the cache and key the cache by it — cleaner cache
correctness but adds an uncached per-request DB read on a cached public page; the
tag-bust approach avoids that. (3) A client-side filter only — rejected: sold rows
would still ship to the browser and appear in facet counts; filtering at the query is
correct. (4) Drop `sold` from `PUBLIC_SHOP_PRODUCT_STATUSES` globally — rejected: the
product **detail** page and admin previews still legitimately render sold items.

## 2026-07-03 — Checkout inventory: no reservation, whoever pays first gets the item

**Decision:** Remove the 30-minute inventory reservation from PayPal checkout
entirely. Products stay `available` all the way through the PayPal window — no hold,
no `reserved` status set by checkout — so any number of buyers can check out the
same one-of-one piece at once. The sale is decided at **capture**:
`capture_paypal_order` row-locks the product rows and, if the item was already
`sold` by a first buyer, returns `item_conflict=true`, flags the losing order
`failed` with a "manual PayPal refund required" note, and does not sell; the winning
capture flips the products to `sold`. `create_paypal_order` replaces
`reserve_paypal_order` in the create path (order + items, no hold). The old
`reserve_paypal_order` hold and `release_expired_paypal_reservations` sweep are
dropped (`supabase/no-reservation-checkout.sql`), and `apply_paypal_order_event`'s
`denied` branch no longer releases a reservation. The vestigial
`reserved_until`/`reserved_order_id` columns are left in place (always null) to
avoid a destructive schema change.

**Reason:** The owner wants the simplest possible model — first to complete checkout
gets the item — with no timed holds that take a piece off the market for someone who
may never pay. Reservations added real complexity (a hold RPC, an expiry sweep, a
`reserved` lifecycle state, cache-busting on release) to defend against a rare
double-sale; recomputing the winner at capture with a row lock defends the same case
without holding inventory. The trade-off is that two buyers can occasionally both pay
for the same one-of-one within seconds — the loser is captured and refunded manually,
which the owner accepts as rare and cheaper than the reservation machinery.

**Scope:** This is the automatic **checkout** reservation only. The manual admin
**Reserved** product status (an indefinite merchandising hold the owner sets by hand)
is unrelated and unchanged, as is the admin-created-order flow that moves products to
`pending_payment`.

**Alternatives considered:** (1) Keep the 30-min hold — rejected by the owner as
taking items off the market and adding complexity. (2) Reserve only for a very short
window — still a hold + expiry sweep; same category of complexity. (3) Auto-refund
the losing buyer on `item_conflict` instead of flagging for manual refund — deferred;
the conflict is rare and a human refund is safer than an automatic money movement for
now (could be automated later).

**Supersedes:** the "Inventory model" portion of the 2026-06-29 "PayPal is the
checkout payment processor" decision below (the server-side authoritative-pricing and
capture-verification portions of that decision still stand).

## 2026-07-03 — PayPal: capture on approve, drop the confirm-on-return + resume flow

**Decision:** Capture the PayPal payment in the Buttons `onApprove` callback (the
moment the buyer hits **Pay Now** in the PayPal window), and on return to our tab
send the buyer straight to the existing "Order Received" confirmation. Removed the
2026-07-02 machinery that split approval from capture: the intermediate "Confirm
Your Order" review screen, the client-side capture-on-confirm button, the
sessionStorage hand-off record (`nej-paypal-pending`), the
`GET /api/paypal/order-status` resume route, and `getPayPalOrder()` in
`lib/paypal.ts`. `PayPalCheckoutButton` lost its `onApproved` hand-off prop and now
always captures in `onApprove`. The in-memory order-id reuse (cancel-then-retry
without double-reserving, in the same tab) is kept.

**Reason:** The owner wanted the standard, simplest PayPal UX — the sale finalizes
in the PayPal window and the customer just sees a confirmation when they come back,
with no extra "confirm to complete" step on our site. The 2026-07-02 confirm screen
existed to let a mobile tab-eviction be resumed, but it added a second click to
complete every purchase and a fair amount of state/route surface; the owner judged
the extra step worse than the rare eviction edge case.

**Trade-off / backstops:** If a mobile OS evicts the tab after approval but before
the `onApprove` capture fetch completes, the client can no longer resume and finish
the capture. Because nothing is reserved (see the 2026-07-03 no-reservation
decision above), that just leaves the item available — the buyer can retry or
another buyer can purchase it — and the `PAYMENT.CAPTURE.COMPLETED` webhook still
reconciles any capture that did land. An approved-but-uncaptured PayPal order also
voids on its own.

**Alternatives considered:** (1) Keep the confirm screen but auto-click it on
return — still leaves the resume route + sessionStorage surface and a UI flash; the
owner wanted it gone. (2) Keep the resume route as a silent reconciliation on mount
(no visible confirm screen) — rejected as unneeded now that the webhook already
reconciles capture server-side. (3) Leave `onApproved` on the button as an unused
option — rejected to avoid dead reachable code (AGENTS.md: no stray/dead artifacts).

**Supersedes:** the 2026-07-02 "PayPal approval-return hardening (reload/eviction
resume)" work (the stale-total reuse fix from that same day still stands).

## 2026-07-02 — Project-docs cleanup: CHANGELOG.md is the one full-history log

**Decision:** `CURRENT_STATUS.md`'s "What Was Recently Completed" section and
`TASKS.md`'s "Completed" section were trimmed from a near-complete duplicate
of the entire project history (both had grown to 1700-2300+ lines, mirroring
`CHANGELOG.md` back to 2026-06-13) down to a handful of recent highlights
plus a pointer to `CHANGELOG.md`. `TASKS.md`'s Backlog also had its full
PayPal go-live checklist replaced with a pointer to the 🔴 HANDOFF section in
`CURRENT_STATUS.md` (the single more-detailed, more-current copy), and ~15
"apply supabase/X.sql" items for 2026-06-15→06-20 migrations were removed
where the corresponding features are confirmed live (see the note left in
`TASKS.md` Backlog for the list and how to re-add one if it turns out wrong).
Several `DECISIONS.md` entries describing now-replaced approaches (static
site, Jotform/Netlify Forms, code-based catalog, `/es/` static pages,
`item_date`) were annotated **⚠️ Superseded** with a pointer to the
superseding entry, rather than deleted — this is a decisions *log*, so
history stays but a reader no longer mistakes it for current guidance.

**Reason:** Requested project-wide documentation refresh. Three files
carrying the same history meant every session paid the cost of reading (or
skipping) thousands of duplicate lines, and the duplication had already
drifted — e.g. `TASKS.md`'s PayPal checklist still described "set the 4 env
vars" as an open investigation after `CURRENT_STATUS.md` had already
diagnosed the exact credential-mismatch root cause on 2026-06-30.

**Alternatives considered:** Leave the duplication and just append new
entries each session (status quo — guarantees the copies re-diverge); delete
history outright instead of trimming-with-pointer (loses the record;
`CHANGELOG.md` is deliberately kept as the single canonical full history so
nothing is actually lost).

## 2026-06-30 — PayPal: id, secret, and PAYPAL_ENV must form one consistent set

**Decision:** The three PayPal credential variables (`PAYPAL_CLIENT_ID`,
`PAYPAL_CLIENT_SECRET`, `PAYPAL_ENV`) must always come from the **same PayPal app and
environment** — mixing them (id from app A, secret from app B, or `PAYPAL_ENV=sandbox`
with live creds) causes `401 invalid_client` from PayPal's token endpoint. The server
route catches this and returns 502, which the client surfaces as "Something went wrong
with PayPal. Please try again." The symptom gives no hint that credentials are mismatched.

**Root-cause incident (2026-06-30):** After the first successful Netlify deploy (fixing
the secrets-scan issue), PayPal checkout failed on the live site with the above error.
Diagnosis: the live checkout page served `PAYPAL_CLIENT_ID = AcSsWn15M34…` (Netlify's
stored value), but the verified working sandbox creds in `.env.local` use
`PAYPAL_CLIENT_ID = AbscNftOUog…`. These are **different PayPal apps.** Netlify's
`PAYPAL_CLIENT_SECRET` was the secret for the `AcSsWn15M34` app; the server was trying
to authenticate as that app, which the sandbox rejected. The DB side (inventory reserve
RPC) succeeded; only the PayPal API call failed.

**Rule for go-live (and any future credential rotation):** change all 4 PayPal vars
together in one Netlify update — never update id without updating secret (and vice
versa), and always match `PAYPAL_ENV` to the app's environment:
- Sandbox: `PAYPAL_ENV=sandbox` + sandbox id + sandbox secret + sandbox `PAYPAL_WEBHOOK_ID`
- Live: `PAYPAL_ENV=live` + live id + live secret + live `PAYPAL_WEBHOOK_ID`

**Reason:** `lib/paypal.ts → getAccessToken()` uses Basic auth `clientId:clientSecret` —
if those two belong to different apps, PayPal returns 401 regardless of which endpoint
is hit. There is no way to detect this from the client-side error.

**Alternatives considered:** Check the id/secret pairing at server startup — impractical;
we'd need to call the token endpoint on cold boot. Add a `/api/paypal/check-config` admin
probe — useful but optional; the diagnostic curl in CURRENT_STATUS.md does the same.

## 2026-06-30 — Netlify secrets scan: omit PAYPAL_CLIENT_ID (public by design)

**Decision:** Add `PAYPAL_CLIENT_ID` to `SECRETS_SCAN_OMIT_KEYS` in root
`netlify.toml` (alongside the `NEXT_PUBLIC_*` keys). The PayPal **client id** is a
public identifier — it ships to the browser inside the PayPal JS SDK URL, so it
necessarily appears in the built `checkout.html`/`.rsc` output. Netlify's secrets
scanner flagged it and failed the deploy; omitting the key tells the scanner it is
intentionally public. `PAYPAL_CLIENT_SECRET` is **not** omitted and was not found
in build output (it stays server-side); it must never be added to this list.

**Reason:** The deploy failed with "Secret env var PAYPAL_CLIENT_ID's value
detected" across the checkout HTML/RSC. The client id is public per PayPal's design
(it's how the browser SDK is initialized), so the correct fix is to whitelist that
one key in the scanner, not to remove it from the build. This mirrors how the
project already handles the public Supabase URL/anon key and site URL.

**Alternatives considered:** (1) `SECRETS_SCAN_OMIT_PATHS` to exclude the checkout
build files — rejected: broader than needed and would suppress scanning of other
secrets in those files. (2) `SECRETS_SCAN_ENABLED=false` — rejected: disables the
safety net entirely. (3) Rename it `NEXT_PUBLIC_PAYPAL_CLIENT_ID` — rejected: the
project deliberately delivers the id via a server prop (see the 2026-06-29 PayPal
decision); the omit-key is the targeted fix without changing that contract.

## 2026-06-30 — Paid orders notify on the Orders tab, not the Messages center

> **Superseded 2026-07-06 for badge count semantics.** Paid orders still surface with
> Orders rather than Messages, but the nav badge now counts unseen active orders since
> the admin last viewed Orders, not paid/pending-fulfillment orders.

**Decision:** A paid PayPal order no longer writes an `admin_notifications` row.
It surfaces as a count badge on the admin **Orders** nav (`AdminOrdersLink`,
counting `payment_status='paid'` + `fulfillment_status='pending'` orders), which
self-clears as orders are fulfilled. The Messages center is reserved for contact
messages and inquiries. Separately, the customer's shipping address (already
stored on the order) is now rendered on the order detail page and the invoice email.

**Reason:** The owner wanted incoming orders to appear with the orders, not mixed
into the message inbox. A derived count (vs. an unread-notification row) needs no
read-state machinery and reflects real fulfillment work. `capture_paypal_order`
dropped its notification insert (idempotent migration re-run).

**Alternatives considered:** (1) Keep writing order notifications but filter
`type='order'` out of Messages and mark-read on Orders view — more moving parts
(per-page unread counts + read-marking). (2) Email the owner on capture — not done
yet; could be added alongside the badge.

## 2026-07-03 — Checkout: address always shown in Contact Details, required only for shipping

**Decision:** The buyer's address fields (street, apt, city, state, ZIP, country)
now always render inside the **Contact Details** panel, directly under Email —
regardless of the delivery method. They are **required/enforced only when a shipping
method other than local pickup is selected** (`needsShipping`): when shipping, the
labels show `*`, the inputs are `required`, and `payReady`/`missingFieldLabels` block
payment until street+city+state+ZIP are filled; for local pickup the same fields are
shown with an "Optional for local pickup" hint, no `*`, and never block payment. The
address the buyer types is **always** sent in the create-order payload (captured as a
contact record on the order via `buildAddressObject`); the server still only
*requires* a complete address when the shipping method needs one.

**Reason:** The owner wants to collect the customer's address as part of their
contact information on every order (useful contact/record data), while only forcing a
complete address when it's actually needed for delivery.

**Supersedes** the 2026-06-30 decision below (address block in the left review
column, rendered only when shipping is selected).

## 2026-06-30 — Checkout layout: shipping selector on the Order Summary, address under it

> ⚠️ **Superseded 2026-07-03** — the address now lives in the Contact Details panel
> and is always shown (required only for shipping); see the entry above. The
> delivery-method `<select>` staying on the Order Summary's "Shipping" row still
> holds.

**Decision:** The delivery-method picker lives on the Order Summary's "Shipping"
row as an inline `<select>`; the Shipping Address block sits in the left review
column directly under the Order Summary (matching its width) and renders only when
a shipping method is selected. The PayPal/card buttons render up front and validate
contact (and, when shipping, address) fields in PayPal's `onClick` before opening.

**Reason:** Iterated with the owner toward a conventional, compact layout — three
radio cards ate too much vertical space, and grouping the shipping method + address
with the order review reads cleaner than splitting them across columns.

**Alternatives considered:** delivery method as radio cards in the form (rejected:
too tall); a separate delivery-method field in the form (rejected: redundant with
the summary's Shipping row).

## 2026-06-29 — PayPal is the checkout payment processor; amounts computed server-side

**Decision:** Wire PayPal (JS SDK on the client, Orders API v2 on the server) into
the existing `/checkout` page as the final payment step, **replacing** the old
manual "Submit Order" (unpaid contact-to-buy) button. The browser never sends
prices: `POST /api/paypal/create-order` recomputes the authoritative subtotal/tax/
shipping/total from the DB (shared `lib/checkout-pricing.ts`, reused by the legacy
`/api/checkout/order` route), creates the internal order, reserves inventory, then
creates the PayPal order. `POST /api/paypal/capture-order` captures server-side,
verifies the captured amount+currency equal the internal order, then marks the
order paid (`payment_status='paid'`, `order_status='completed'` — same state as the
admin "Mark Paid" action) and the products `sold`. A signed PayPal webhook
(`/api/paypal/webhook`) is the idempotent backstop (logged in `webhook_events`).
The PayPal client id is read server-side in `checkout/page.tsx` and passed as a
prop (it ships to the browser inside the SDK URL, but is not a `NEXT_PUBLIC_*`
var). On success the existing inline "Order Received" confirmation is reused.

**Reason:** Estate pieces are one-of-one, so trusting client amounts or skipping a
reservation would risk underpayment or double-sale. Recomputing server-side and
reserving with a row-locking RPC closes both. Mirroring the admin "Mark Paid"
status keeps the admin orders UI consistent. Reusing the existing order RPC
pattern, Supabase service client, and the Resend webhook's verify/idempotency
shape kept the change additive rather than a checkout rebuild.

**Inventory model:** ⚠️ **Superseded 2026-07-03** — see "Checkout inventory: no
reservation, whoever pays first gets the item" at the top of this log. Reservation
was removed; the description below is the original 30-minute-hold design, kept as
history. *`reserve_paypal_order` (SECURITY DEFINER) `SELECT … FOR UPDATE` locks the
product rows, releases any expired holds, verifies each item is `available`, creates
the order + items, and flips products to `reserved` with a 30-minute `reserved_until`.
Concurrent buyers serialize on the lock; the loser gets "no longer available".
`release_expired_paypal_reservations` frees lapsed holds (called inline and exposable
to a cron). The public shop already hides `reserved` items, so a hold removes the
piece from the storefront immediately.*

**Amount mismatch:** if a capture's amount/currency doesn't match the order, the
money is captured but the order is **not** auto-fulfilled — it's set to
`payment_status='pending'` with an admin notification for manual review.

**Alternatives considered:** (1) Put PayPal on the placeholder `/payment` page —
rejected: the live checkout is `/checkout`; `/payment` has no order linkage. (2)
Keep the manual unpaid-order button alongside PayPal — rejected by the owner
(two order-creation paths on one page invites double orders). (3) Trust the
client cart total / set products `sold` at order creation — rejected: enables
underpayment and overselling one-of-one stock. (4) `NEXT_PUBLIC_PAYPAL_CLIENT_ID`
— avoided; the id is delivered via a server prop instead. (5) Add the
`@paypal/react-paypal-js` dependency — rejected: the script-tag SDK + fetch
against the REST API needs no new npm packages.

## 2026-06-25 — Lead forms post to /api/inquire, not Netlify Forms

**Decision:** Fix the silently-failing `/contact` (submit-item) and
`/free-evaluation` forms by submitting them via `fetch` to the existing
`/api/inquire` route (Resend + Supabase `inquiries` + `/admin/inquiries`),
instead of Netlify Forms. `/api/inquire` now branches on content-type: JSON keeps
the original product-inquiry contract (InquiryForm, unchanged); multipart handles
the lead forms with required photo uploads. Photos upload server-side via the
service-role client to the `product-images` bucket under `inquiries/…` and are
recorded in `inquiries.uploaded_image_urls` (the column the Storage-GC reference
scan already tracks), with graceful fallback to message text if the column is
absent. Did **not** create `public/__forms.html`.

**Reason:** Netlify's form detector only parses static HTML at deploy time, so it
never sees client-rendered React forms — submissions were lost while the UI faked
success. The project already has a proven Resend+Supabase inquiry pipeline, so
reusing it is more reliable, fully testable locally, keeps all leads in one admin
inbox, and (unlike `application/x-www-form-urlencoded`) preserves the required
photo uploads. Server-side upload via service role avoids needing an anonymous
Storage policy.

**Alternatives considered:** (1) Netlify Forms with multipart `FormData` —
rejected: unverifiable without a deploy, AJAX file uploads to Netlify are
unreliable, and it splits leads across a second inbox. (2) Netlify Forms with
urlencoded exactly as first specified — rejected: cannot carry the photos, which
are the point of these forms. (3) A brand-new `/api/inquiries` POST route —
rejected: `/api/inquire` already exists with the email logic to reuse.

## 2026-06-25 — Ship CSP in Report-Only first; consolidate to one netlify.toml

**Decision:** Add the security headers and Content-Security-Policy via the **root**
`netlify.toml` `[[headers]]` (deleting the duplicate `next-app/netlify.toml`), and
deploy the CSP as `Content-Security-Policy-Report-Only` before enforcing. Caching
is immutable 1y for `/_next/static/*` and `/assets/*` with a short
`must-revalidate` catch-all; 410 `force` redirects block common probe paths.

**Reason:** Two netlify.toml files invite config drift; the root file is the one
Netlify reads (`base = "next-app"`). A CSP tight enough to matter can break inline
scripts/styles, Google Fonts, or Supabase calls; Report-Only logs violations
without breaking the site so the policy can be validated against real pages first.

**Alternatives considered:** (1) Enforce CSP immediately — rejected: high risk of
breaking the icon font / inline JSON-LD / Supabase before real-traffic validation.
(2) Keep both toml files — rejected: drift risk. (3) Use a `public/_headers` file —
equivalent, but `[[headers]]` keeps headers, redirects, and caching in one file.

## 2026-06-25 — Unified admin inbox: inquiries also post to the message center

**Decision:** Every inquiry submission (`/api/inquire` — Free Evaluation, Submit
Your Item, product inquiry) writes an `admin_notifications` row (`type: 'inquiry'`,
photos attached) in addition to its `inquiries` row, so the message center
(`/admin/messages`) is a single inbox for all incoming submissions (lead forms,
"Message Us Directly" messages, and order notifications). Inquiries still also live
in `/admin/inquiries` (their status workflow) and still email the owner. A shared
`lib/admin-notify.ts` (`createAdminNotification`) does the insert; it is best-effort
(a failure never fails the submission) and reused by `/api/contact-message`.

**Reason:** The owner wanted one place to see everything coming in. Layering a
notification on top of the existing `inquiries` record (rather than moving inquiries
into `admin_notifications`) keeps the inquiry status workflow intact while giving the
message center full coverage, including the unread badge.

**Alternatives considered:** (1) Replace the `inquiries` table with
`admin_notifications` — rejected: loses the inquiry status workflow and the
`/admin/inquiries` management view. (2) A DB trigger that mirrors inquiries into
notifications — rejected: harder to attach the already-uploaded photo URLs and to
keep best-effort/non-blocking semantics; the app-layer helper is simpler and shared
with the message form.

## 2026-06-25 — Public lead inserts run as anon; service role is for Storage + admin tables only

**Decision:** `/api/inquire` inserts inquiry rows using the **anon** client
(`createPublicClient()`), not the service-role client. The service-role client is
reserved for the Storage photo upload (RLS bypass) and for writing RLS-restricted
admin tables. For `admin_notifications` (no public-insert path), the service role is
kept but must be granted INSERT explicitly (`service-role-insert-grants.sql`).

**Reason:** `inquiries` is designed for public submission — it has a `with check
(true)` insert policy and `grant insert … to anon`. The service role bypasses RLS
but, in Postgres, still needs a table-level INSERT grant, which it didn't have here
(grants were scoped to anon/authenticated). The route's `db = service ?? createClient()`
preferred the service role once a service key existed, producing 42501 "permission
denied for table inquiries". Inserting as anon matches the table's intended access
and needs no new grant. Using anon (cookie-free) instead of the cookie-based server
client also avoids the `authenticated` role, which likewise lacks the INSERT grant —
so logged-in submitters work too.

**Alternatives considered:** (1) `GRANT INSERT ON inquiries TO service_role` and keep
inserting as service — works, but adds a migration for a table that already supports
anon insert by design. (2) Keep the cookie-based server client — rejected: a
logged-in submitter runs as `authenticated`, which has no INSERT grant. For
`admin_notifications` there is no anon path, so the grant (or a SECURITY DEFINER RPC)
is unavoidable; chose the grant for simplicity.

## 2026-06-25 — Surface customer photos in the admin panel (inquiries + messages)

**Decision:** Show uploaded customer photos as thumbnails in the admin panel.
Inquiries already store photo URLs in `inquiries.uploaded_image_urls`, so
`/admin/inquiries` now selects and renders them. For the "Message Us Directly"
form, added optional photo upload: the route uploads to the existing
`product-images` Storage bucket under a new `messages/` prefix and stores the URL
strings in a new `admin_notifications.image_urls` (jsonb) column, which
`/admin/messages` renders. Thumbnails use `next/image` with `unoptimized` (admin-
only, avoids image-domain config and the `no-img-element` lint rule) and link to
the full-size image.

**Reason:** Photo bytes stay in Storage and rows store only URL strings (the
project's standard). Reusing the `product-images` bucket avoids a new bucket +
policies. Because this is a **new upload destination**, the column was added to the
Storage GC reference scan (`/api/admin/storage-gc`) so message photos are never
deleted as orphans (per the GC reference-set rule).

**Alternatives considered:** (1) A separate Storage bucket for messages — rejected
as unnecessary; the prefix is enough. (2) Stuffing photo URLs into the notification
`body` text — rejected: they wouldn't render as images (kept only as a degraded
fallback when the `image_urls` column is missing pre-migration). (3) Raw `<img>` —
rejected: trips the `no-img-element` lint rule.

**Dependency:** run `supabase/admin-notifications-image-urls.sql`. Reads and writes
degrade gracefully before it's applied (messages page falls back to no-photos; the
route falls back to keeping photo links in the body text).

## 2026-06-25 — "Message Us Directly" contact form posts to the admin message center

**Decision:** Add a public "Message Us Directly" form below the hero on `/contact`
(name, email, optional phone, large message) that delivers straight into the admin
message center. The new `/api/contact-message` route inserts a `type: 'message'`
row into `admin_notifications` using the **service-role** client (server-side), and
also sends a best-effort owner email (reply-to the sender) as a backup. The new
`MessageUsForm` is rendered above the existing "Submit Your Item" (`ContactForm`)
in the non-inquiry contact view.

**Reason:** `admin_notifications` RLS allows only admins to read/update — there is
no public insert. The existing contact flow already depends on the service-role
client (for inquiry photo uploads), so a server-side service-role insert reaches
the message center with **no new SQL migration**, and keeps the key off the
browser. The email backup means a message is never lost if the service role or the
`admin_notifications` table is unavailable.

**Alternatives considered:** (1) A `SECURITY DEFINER` RPC granted to anon (like
`create_checkout_order`) — architecturally clean and service-role-free, but adds a
new migration the owner must run; rejected for friction since service-role is
already required here. (2) Insert into the `inquiries` table and surface it under
Messages — rejected: the owner specifically wanted it in the message center, and
inquiries are a separate lead/intake concept. (3) Email only — rejected: the
request was explicitly to land it in admin messages.

**Dependencies:** `SUPABASE_SERVICE_ROLE_KEY` and the `admin_notifications` table
(`admin-notifications-checkout.sql`). If the table isn't present, the insert fails
and only the owner email fires (the form still reports success).

## 2026-06-25 — Product listing notes are bilingual; "Internal Notes" replaced by "Notes (ES)"

**Decision:** Make the product listing's public notes bilingual, matching the
title/description EN/ES pattern. The add/edit listing form's two notes fields are
now **Notes (EN)** (`products.public_notes`, unchanged column) and **Notes (ES)**
(new `products.public_notes_es` column), which replaces the old admin-only
**Internal Notes** form field. The Spanish (/es) product detail page shows
`public_notes_es` when present, falling back to the English `public_notes` (like
`description_es` → `description`). Notes (ES) auto-translates from Notes (EN) on
save via the existing translate flow, and is also manually editable.

**Scope:** products only. The legacy `products.internal_notes` column is kept (it
still preserves folded legacy `details` on save) but is no longer surfaced in the
UI; no internal-notes data is migrated into the public field, so previously-private
notes are never exposed. The separate admin `internal_notes` on **orders /
inquiries / profiles** is intentionally left unchanged — those are unrelated
admin-only fields (e.g. checkout auto-writes an English admin string into
`orders.internal_notes`), so relabeling them "Notes (ES)" would be wrong and would
ripple through the checkout RPC.

**Reason:** The goal was to show a Spanish version of the public notes on the ES
product pages. Repurposing the rarely-used Internal Notes form slot into the public
Spanish note delivers that with the established EN/ES localization pattern. Reads
(product detail) and writes (admin save) degrade gracefully before the migration is
applied (generalized missing-optional-column fallback covering `item_year` and
`public_notes_es`).

**Alternatives considered:** (1) Rename `internal_notes` → notes_es on every table —
rejected after finding it's semantically wrong and checkout-affecting for
orders/inquiries/profiles. (2) Drop `products.internal_notes` — rejected to avoid a
destructive migration and to keep the legacy `details` fold working. (3) Keep notes
English-only — rejected; the owner wants Spanish notes on the ES pages.

## 2026-06-25 — AI listing prompt is a single editable value, not default+override

**Decision:** Present and treat the AI listing-assistant prompt as **one** prompt
that the admin edits in `/admin/settings`. The saved value in `ai_settings` IS the
prompt; the code constant `PRODUCT_EXTRACTION_SYSTEM_PROMPT` is only its **built-in
starting value**, used until an edit is saved (and recoverable via a "Restore
Built-In" action). Removed the "Custom vs Default" badge and the
`isCustom`/`defaultPrompt`/"override" framing from the API (`/api/admin/ai-settings`
now returns `systemPrompt` + `builtInPrompt`), the store
(`fetchStoredSystemPrompt`/`saveSystemPrompt`), and the panel UI.

**Reason:** The owner wants a single prompt they can edit so the edit permanently
becomes the prompt — not a default layered under a separate override. The previous
framing (NULL = default, set = override; "Custom"/"Default" badge) implied two
prompts and could show a stored value that diverged from "the implemented prompt."
The underlying mechanism is unchanged (saved value wins, blank clears it); only the
model, naming, and UI were collapsed to one prompt.

**Alternatives considered:** (1) Keep the default+override duality as-is — rejected:
the owner explicitly wants one prompt. (2) Remove the `ai_settings` table and make
the code constant the only source — rejected: that would lose runtime editability
without a deploy, which is the whole point of the editable prompt. (3) Drop the
"Restore Built-In" action entirely — rejected: keeping a recovery path to the
shipped baseline operates on the same single value and avoids a footgun.

**Refines:** the 2026-06-18 "Store the editable AI prompt in an admin-only
`ai_settings` table" decision — same table and persistence, single-prompt framing.

## 2026-06-25 — Detect duplicate sign-up via Supabase's empty-identities signal

**Decision:** On the Create Account form, detect an already-registered email
client-side from the `supabase.auth.signUp` response — a returned user whose
`identities` array is empty means the email already belongs to a **confirmed**
account (Supabase's anti-enumeration obfuscation when "Confirm email" is on) —
with a fallback that also treats an explicit "already registered" error as a
duplicate. On a hit, show an in-form notice with a **Reset Password** button
(`resetPasswordForEmail` → emailed recovery link) and a Go to Sign In link.
Password recovery is handled by a new dual-mode `/account/reset-password` page
(request-email vs. set-new-password when a recovery session is present).

**Reason:** Keeps the existing fully client-side auth flow (only the anon key
ships to the browser) — no new server route or service-role lookup, and no email
enumeration endpoint. The empty-`identities` check is Supabase's documented way
to detect a duplicate without a privileged query, and it does not send a second
confirmation email to the real owner of an existing confirmed account.

**Alternatives considered:** (1) A server route using the service-role key to
look up the email before signup — rejected: adds a privileged, enumerable
endpoint for a check the signUp response already encodes. (2) Rely only on the
"already registered" error — rejected: that error is only returned when email
confirmation is disabled; with confirmation on (this project), the empty-identities
signal is required. (3) Reuse the in-app `updateUser` password change only —
rejected: that needs an existing session, which a locked-out user does not have,
so an emailed recovery link is necessary.

**Caveat:** An existing but **unconfirmed** account is not flagged (Supabase
resends its confirmation instead), which is acceptable. Live verification of the
duplicate notice + reset email is pending (see TASKS) and depends on the Supabase
redirect-URL allowlist including `…/account/reset-password`.

## 2026-06-25 — Shop list view as a separate component behind a URL param

**Decision:** Add the gallery/list view choice as a `view=list` URL search param
(defaulting to gallery), and render list mode with a brand-new `ProductListRow`
component selected inside `ShopProductGrid`, rather than adding a layout mode to
the existing `ProductCard`. The gallery `ProductCard` and grid markup/CSS are
left completely untouched.

**Reason:** The requirement was explicitly "do not change how the gallery cards
look and are arranged." A separate list component guarantees the gallery path is
byte-identical and isolates the list-only CSS, while the URL param keeps the
choice shareable, back-button safe, and consistent with the existing `sort`
control pattern. List CSS lives once in `ShopProductGrid`'s list branch.

**Alternatives considered:** (1) Add a `layout="list"` prop to `ProductCard` and
branch its JSX/CSS — rejected: the card already carries a large reveal/hover/mobile
`<style>` block, and conditionally restructuring it risked regressing the gallery
look. (2) Persist the choice in localStorage instead of the URL — rejected: not
shareable and would flash the default on first server render.

## 2026-06-24 — Cache the shop catalog read instead of making /shop static

**Decision:** Keep `/shop` as dynamic SSR for now, but wrap the expensive catalog
read (the column-narrowed product scan + total-inventory count) in
`unstable_cache`, keyed by the DB-level filter set (`status`, `purity`,
`metalColor`, `metal`, `brand`). Also cap the upstream metal-price fetch with a
1.5s `AbortSignal.timeout`, and let next/image optimize the header logo (drop
`unoptimized`).

**Reason:** The cold-load slowness came from two things every external visitor
paid for: a full-table product scan and a render-blocking live call to
`api.gold-api.com`. Caching the catalog lets concurrent cold visitors share one
DB round trip per 300s window; the fetch timeout stops a slow upstream from
holding TTFB hostage. These are low-risk and preserve the existing faceted
filtering exactly (verified: `metal=gold` still returns 47/54 vs 48/54 bare).

**Alternatives considered:** (1) Make bare `/shop` fully static/ISR — higher
value but requires extracting filtering/faceting/pagination out of the server
component (the page awaits `searchParams`), which is a larger refactor logged in
TASKS. (2) DB-side `.range()` pagination — deferred for the same reason: facets
and live spot-price sorting are computed over the full row set today. (3) Leave
the metal fetch unbounded — rejected; it was the single worst-case TTFB spike.

**Decision:** Anonymous public data reads should use a cookie-free Supabase
client, and the proxy should refresh Supabase sessions only on routes that
actually need user state (`account`, `admin`, `checkout`, and `payment`). The
localized layout should seed `next-intl` with static locale params so public
marketing/legal/service pages can prerender.

**Reason:** Reading request cookies for anonymous product/marketing pages was
forcing request-time rendering without adding personalization. Cart and wishlist
badges are already client/local-storage driven, so public HTML can be cached
independently from logged-in account/admin flows.

**Alternatives considered:** Keep the cookie-backed server client everywhere,
or try to force all shop routes static immediately. The first preserves
unnecessary dynamic rendering; the second would require a larger shop filtering
refactor because `/shop` currently combines URL params, live spot pricing,
derived item groups, and pagination on the server.

## 2026-06-22 - De-duplicate repeated shop card styles before deeper shop rewrites

**Decision:** Render the modern product-card and card-cart-button CSS once per
shop grid instead of once per product card, while leaving the current
server-filtered shop behavior intact.

**Reason:** Production probes showed `/shop` was compressed but very large.
Repeated inline card styles were an immediate payload bottleneck that could be
removed without changing visible behavior or the product data contract.

**Alternatives considered:** Reduce the default product count per page or remove
multi-image card behavior. Those would alter storefront behavior. A larger
client-filtered cached shell remains a backlog item.

## 2026-06-22 - Customer-facing reveal gates fail open

**Decision:** Homepage hero and shop card reveal animations should wait briefly
for data, fonts, and images, but must reveal after a bounded fallback even if a
load event stalls or is missed.

**Reason:** The reveal animation is polish, while the hero and product grid are
core content. A failed readiness signal should not leave customer-facing
sections at opacity 0.

**Alternatives considered:** Remove reveal animations entirely, or keep waiting
for every readiness promise to settle. Removing the animations would discard the
intended polish, while strict waiting already caused invisible hero/shop states
in local preview.

**Update (2026-06-22):** Homepage carousel fallback photos are now a hard
fallback, not a temporary visible state. The hero waits longer for the live
curated selection, and if fallback has already been revealed, late live results
are ignored for that page load to avoid a visible product-image swap.

## 2026-06-22 - Standardize responsive layout primitives

**Decision:** Add shared responsive layout components/classes for containers,
sections, stacks, grids, card grids, form grids, tables, hero sections, and
responsive typography instead of continuing to tune every page with one-off
fixed-width Tailwind combinations.

**Reason:** The site has many public, shop, checkout, account, and admin
surfaces that need consistent behavior from 320px through ultrawide desktop.
Shared clamp/minmax/container patterns reduce drift, prevent accidental
horizontal overflow, and give future pages a standard mobile-first structure.

**Alternatives considered:** Patch only the pages that visibly overflowed, or
hide horizontal overflow globally. One-off fixes would keep the layout system
fragile, while blanket hiding could mask real clipped controls and tables.

## 2026-06-21 - Duplicate Clear Filters controls share one clear-all path

**Decision:** The top and bottom Clear Filters controls in the shop filter
panel use the same `clearAll()` behavior and only render as active controls
when filters are applied.

**Reason:** The top control improves ergonomics for filtered browsing while
keeping URL state, pagination reset, and visible behavior identical to the
existing clear link.

**Alternatives considered:** Add a separate top-only clear implementation;
rejected because it could drift from the existing bottom control.

## 2026-06-21 - Share shop sort state across sidebar and gallery controls

**Decision:** The left filter-menu Sort dropdown and the gallery-top Sort
dropdown use the same `ShopSortSelect` client control and the same URL-backed
`sort` parameter.

**Reason:** Shoppers expect a visible sort control above product grids, while
the existing filter menu still needs to expose sorting alongside other filters.
Sharing one control keeps labels, behavior, pagination reset, and selected
state synchronized.

**Alternatives considered:** Build a separate gallery-only sort menu; rejected
because duplicate option lists would drift. Remove Sort from the left filter
menu; rejected because the owner asked for the gallery dropdown in addition to
the existing sort button.

## 2026-06-21 - Public shop shows only available/sold products

**Decision:** Treat `available` and `sold` as the only statuses visible in the
public storefront. Draft, reserved, pending-payment, and archived products are
excluded from `/shop` queries, public counts, filter option derivation, and
normal shopper product-detail access. Admin/account return links may still
preview detail pages for operational context.

**Reason:** Draft and reserved inventory should not be discoverable by shoppers,
while sold items can remain visible as historical/merchandising examples and
available items remain purchasable.

**Alternatives considered:** Hide only draft/reserved and leave archived items
visible; rejected because archived is also not a public merchandising state.
Block admin detail previews too; rejected because the admin table uses the
public detail route as a convenient preview surface.

## 2026-06-20 - Shop era/year filter: standard estate eras, hide blank years

**Decision:** The shop's Era/Year slider uses the standard non-overlapping
estate-jewelry eras from 1837 to the current year — Victorian (1837), Edwardian
(1901), Art Deco (1915), Retro (1935), Mid-Century (1950), Modern (1970),
Contemporary (2000). At full span it shows all items; once narrowed it shows
only items whose `item_year` is in range and hides items with no year.

**Reason:** Owner chose year-only provenance and the common estate vocabulary so
buyers can shop by period. Hiding blank-year items on narrow is standard filter
behavior; full-span-shows-all keeps the catalog complete by default while years
are still being backfilled.

**Alternatives considered:** Include Georgian (1714) — rejected as a long sparse
early stretch; 20th-century-only span — rejected as too narrow for estate stock;
always keep blank-year items visible — rejected as imprecise once years exist.

**Update (2026-06-20):** Made the era display multi-level so overlapping
movements can coexist with the contiguous primary row, rendered in stacked rows
above it (one level per row so they never collide). All rows use the same
line-based band styling (no pill); overlapping bands add small end-cap ticks at
their exact edges since they don't align to the primary tick marks. Each era
title is clickable and snaps the range to that era; the `level` field in
`jewelry-eras.ts` allows more overlapping eras later.

**Update (2026-06-20, revision):** Owner trimmed the scheme to a single
overlapping era — **Art Nouveau (1890–1910)**. Belle Époque, Arts & Crafts, and
Georgian were removed (Georgian had extended the floor to 1714); the slider's
left bound is back to 1837. The left end is now labeled "1837 & earlier" and
imposes **no** lower filter limit, so the floor handle captures pre-Victorian
pieces. A bound is only enforced when its handle sits strictly inside the full
span (`yearLowerLimit` / `yearUpperLimit` in `shop/page.tsx`).

## 2026-06-20 - Item Date is a year (`item_year`), not a calendar date

**Decision:** Replace the `products.item_date` (`date`) column and its
`order_items.item_date_snapshot` with `products.item_year` (`smallint`, range
1-2200) and `order_items.item_year_snapshot`. The Product Admin "Date" field is
now a 4-digit year input ("Date (Year Made)", e.g. 1930). Internally the field
stays "Date"; buyer-facing it is labeled "Ca." (circa) in both locales, so
customers see "Ca. 1930" on cards, the detail spec, cart, checkout, and invoice.
Migration `supabase/product-item-year.sql` drops the old column (clearing the
values).

**Reason:** The field describes when the physical piece was made, which for
estate/antique jewelry is a year, not a precise calendar day. The prior `date`
column had also been backfilled with each listing's `created_at`, so every
product appeared to show its listing-creation date. A year integer matches how
the owner enters provenance and removes the meaningless month/day.

**Alternatives considered:** Free-text era ("circa 1930", "Victorian") — more
flexible but unsortable and unvalidated; year + "circa" flag — more structure
than needed right now. Owner chose year-only.

## 2026-06-20 - Store item Date separately from audit/acquisition dates

> ⚠️ **Superseded later the same day** by "Item Date is a year (`item_year`),
> not a calendar date" above — `item_date` was replaced by `item_year`. The
> separate-from-audit-dates reasoning below still holds.

**Decision:** Add nullable `products.item_date` for the item's Date, meaning
the date the piece was created, and snapshot it as
`order_items.item_date_snapshot` for orders/invoices. Keep it separate from
Postgres row `created_at` and the older internal `acquisition_date`.

**Reason:** Admins need an intake/edit field that describes the item itself and
can appear site-wide. Row `created_at` only records when the database row was
created, while `acquisition_date` describes business intake history and was
previously removed from the active product form.

**Alternatives considered:** Reuse `created_at`, which would conflate item
history with database audit timing; or revive `acquisition_date`, which would
mix customer-facing item metadata with internal buying workflow.

---

## 2026-06-20 - Keep this folder repo-ready without git operations

**Decision:** Treat `C:\Users\rcman\OneDrive\Documents\NaplesEstateJewelry.co`
as the single source-of-truth project folder. Its contents should be exactly
what belongs in the repository copy; future agents must not run git operations
here, must clean up generated artifacts, and must keep ignore rules current for
build output, caches, logs, and secrets.

**Reason:** The human periodically wipes the separate GitHub repo folder and
copies this folder wholesale into it. Any stray archive, temp file, log, or stale
artifact left here can be copied into the repo; git deltas are irrelevant to
that workflow.

**Alternatives considered:** Manage this working folder like a normal git
checkout or produce transfer manifests for later copying. Both were rejected
because the operating model is a wholesale folder replacement handled by the
human outside this project folder.

---

## 2026-06-20 - Product image cleanup must be dry-run-first and reference-aware

**Decision:** Clean product images from Supabase Storage only when the app can
prove the object path is no longer referenced by the current product, other
products, order item snapshots, or inquiry upload URLs. Bulk orphan cleanup is
admin-only and dry-run-first from `/admin/settings`, with objects younger than
24 hours skipped.

**Reason:** Product images are live inventory assets. Reference-aware deletion
prevents shared photos or saved product images from disappearing, while the
24-hour cutoff gives abandoned uploads and interrupted form sessions a recovery
window before GC.

**Alternatives considered:** Delete every replaced URL immediately, or run an
automatic background sweep. Immediate deletion risks breaking a product when an
admin cancels after crop/replace, and automatic sweeps are harder to audit for
valuable inventory photos.

---

## 2026-06-20 - Remove verified stale local artifacts

**Decision:** Keep current docs and active app files as the source of truth, and
delete redundant local artifacts once traced: loose root image references, the
standalone email-marketing handoff, and the unused `AdminShell` Quick Fill
archive copy. Runtime logs are junk but may need to wait until the preview
process releases them; they must remain ignored.

**Reason:** These files were adding dirty-tree noise or stale guidance after the
current Next/Supabase docs and public assets already covered the useful
information. Removing them reduces confusion for future agents.

**Alternatives considered:** Keep the files as informal backups, or move them
into another archive folder. That would preserve more clutter and duplicate
older guidance without improving recovery because the active code, public
assets, and memory docs already contain the current state.

---

## 2026-06-20 - Product images store bytes outside product rows

**Decision:** Product image bytes should live in Supabase Storage for uploaded
inventory photos, or in `next-app/public/assets` for legacy/local site assets.
The `products` table should store only URL/path references plus display
metadata such as image padding.

**Reason:** Keeping binary image payloads out of Postgres keeps product rows
small, avoids bloating database backups/API responses, and matches the current
admin upload flow, public rendering path, and Supabase Storage bucket policy.

**Alternatives considered:** Store base64/data-URI image payloads directly in
`products.images` or move all images into the app bundle. Inline payloads would
make rows and API responses heavy; app-bundled inventory photos make live
inventory edits require file/deploy work instead of storage-backed admin
uploads.

---

## 2026-06-19 - Product types may be custom catalog values

**Decision:** Keep a curated shared product type list for common choices such
as Cufflinks, but allow admins and AI fill to save concise new product type
strings when the item form is clear and not already listed. Public shop Item
Type filters derive additional options from visible inventory.

**Reason:** Forcing unlisted forms into Other hides real inventory from useful
filters and can keep items from appearing in expected shop browsing paths.
Custom values preserve the catalog signal while still keeping common types
standardized.

**Alternatives considered:** Require every new item type to be added in code
before it can be used. That keeps the taxonomy tighter, but it slows intake and
caused Cufflinks to be misclassified as Other.

---

## 2026-06-19 - Use `/shop` as the only storefront entry route

**Decision:** Remove the intermediate `/store` category chooser and the
dedicated `/silver-tableware` route. Header Shop, the Shop dropdown Store item,
and homepage shopping CTAs should point directly to `/shop`.

**Reason:** The extra category page and special tableware route added friction
and split the storefront. The owner wants the previous direct-shop flow back,
with one normal shop page as the browsing surface.

**Alternatives considered:** Keep `/store` as a chooser and keep
`/silver-tableware` as a category route. That was more segmented, but it made
the shopping path less direct.

---

## 2026-06-19 - Keep sterling tableware as a merchandising route, not a catalog lock

**Decision:** `/silver-tableware` should keep tableware-specific hero copy and
use a tableware-first Item Type dropdown order: Silverware / Sterling, Bullion,
Coins, Watches, Brooches, the remaining jewelry categories, and All items last.
Plain visits should default to Silverware / Sterling + Silver, while the route
still uses the full public shop catalog and allows shoppers to select any item
type, including an explicit All items choice.

**Reason:** The page is a useful entry point from Store for sterling
tableware, but shoppers who arrive there should be able to continue browsing
jewelry and other inventory without having to navigate back to the main shop.

**Alternatives considered:** Keep forcing the route to Silverware / Sterling and
Silver only. That was cleaner as a strict category page, but it blocked the
owner's desired cross-browsing behavior.

---

## 2026-06-19 - Give sterling tablewares a dedicated shop route

**Decision:** Add `/silver-tableware` as a separate modern shop route that
reuses the existing shop renderer but locks the catalog context to Silverware /
Sterling and Silver.

**Reason:** Sterling tablewares are a distinct shopping path from silver
jewelry. A dedicated URL gives the Store page a clean destination, keeps filter
clearing from drifting back into general jewelry inventory, and gives SEO and
future merchandising a clearer category page.

**Alternatives considered:** Link the Store tile to `/shop?itemType=silverware`
or add more product types under the main shop only. A query link works, but it
is less durable as a category destination and easier for shoppers to clear out
of accidentally.

---

## 2026-06-19 - Campaign analytics read from recorded Resend webhook events

**Decision:** Show admin campaign-history analytics by aggregating the local
`email_campaign_events` table that is populated by Resend webhooks.

**Reason:** Webhook records are the site's durable audit trail for Resend
delivery, open, click, bounce, and complaint events. Reading them on the admin
page keeps the table fast, avoids exposing provider credentials to the browser,
and avoids calling Resend for every history render.

**Alternatives considered:** Query Resend directly on each admin page load or
store analytics only as static campaign totals. Direct provider reads would add
latency and credential handling, while static totals would miss per-event
changes after the original send.

---

## 2026-06-19 - Email marketing uses opt-out model for account holders

**Decision:** Follow the email-marketing handoff recommendations:
newsletter subscribers remain explicit opt-in, while registered account holders
are eligible for marketing by default unless `profiles.marketing_opt_out = true`.
Every marketing send goes through one audience builder and includes an
unsubscribe link plus the admin-configured physical mailing address.

**Reason:** This matches the common US ecommerce retail pattern the owner chose,
keeps the local database as the consent source of truth, and keeps the UI
low-friction while preserving unsubscribe enforcement.

**Alternatives considered:** Keep opt-in only for account holders. That is lower
risk in stricter jurisdictions but was rejected for this deployment in favor of
the handoff's ecommerce-default recommendation.

---

---

## 2026-06-19 - Standardize public UI on the rounded shop radius scale

**Decision:** Public-facing site surfaces should use the rounded shop aesthetic:
`var(--radius-lg)`, `var(--radius-xl)`, `rounded-2xl`, or pill actions instead
of small 6px/8px legacy corners and sharp square cards. Admin-only utility
screens may remain denser and more utilitarian unless specifically redesigned.

**Reason:** The customer-facing experience should read as one modern luxury
retail site across marketing, selling, account, and shopping flows. The admin
surface has different density and workflow needs.

**Alternatives considered:** Leave small-radius controls in account/shop
because they were technically usable, or force every admin utility surface into
the same luxury styling immediately. The first kept visible visual drift; the
second would create a larger admin redesign outside the customer-facing request.

---

## 2026-06-19 - Use the shop aesthetic for contact and Sell pages

**Decision:** Bring the contact form family and primary Sell-category pages
into the same rounded, lighter visual system used by the shop: rounded cards,
soft borders/shadows, pill CTAs, and modern SVG/material icons instead of sharp
square panels and emoji-style glyphs.

**Reason:** The site should feel like a modern luxury ecommerce experience
across lead capture and sell-service education, not like separate legacy
templates. A shared visual language also makes future page cleanup easier.

**Alternatives considered:** Leave the Sell pages as darker, sharper service
pages, or redesign each page independently. The first kept the mismatch the
owner called out; the second would increase maintenance and visual drift.

---

## 2026-06-19 - Add a small-business compliance foundation without enterprise consent tooling

**Decision:** Add practical legal/policy pages, footer links, form disclosures,
account age/Terms/Privacy consent, an essential cookie/storage notice, and a
homepage-subscriber unsubscribe workflow. Treat the current site as a small
Florida business with ecommerce/order requests, accounts, auction guidance, and
possible future vendor workflows, but do not claim certifications or implement a
large enterprise consent-management platform.

**Reason:** The site collects real customer, account, inquiry, order, and
subscriber information, so it needs clear disclosures and acceptance records.
Source review found no active ad/behavioral tracking pixels, so a lightweight
essential-cookie notice and Cookie Preferences page is more accurate than a
full opt-in tracker manager.

**Alternatives considered:** Add only static placeholder legal pages, or add a
heavy CMP with analytics toggles. Placeholder pages would not satisfy the
actual data flows, while a large CMP would imply optional tracking systems that
are not present.

---

## 2026-06-18 - Float Store category choices over the hero image

**Decision:** Keep `/store` as a simple category chooser, but remove the
separate hero text and card sections in favor of two large square category
controls floating over the hero image. Estate Jewelry is an active link to
`/shop`; Sterling Silver Tablewares stays disabled until that inventory path is
ready.

**Reason:** The page is only choosing a shopping path, so letting the two
choices be the whole first-viewport interface keeps the page direct and makes
the category actions feel more prominent.

**Alternatives considered:** Keep the original full-width category header plus
large image cards below the hero, or add a separate floating card panel over the
image. The old structure felt too split for a two-choice page, and a large panel
would cover too much of the store image.

---

## 2026-06-18 - Carousel hero: windowed ring + two-block swept background

**Decision:** Make the home hero the 3D carousel and rebuild it as a **windowed
(infinite) ring** — render only `visibleCount` cards (admin-set, default 6 desktop /
4 mobile) on a tight radius and cycle the full list through them as cards pass the
hidden back. Drive the per-photo background as a **two-block sweep**: each photo is
a White or Black group, `groupByBackground()` orders them into one white arc + one
black arc, and the hero background is a per-frame horizontal gradient (seam projected
by `sin` of its net angle) painted **imperatively** to `section.style.background`.
The text theme flips via React state only when the centered color changes.

**Reason:** The ring radius is derived from item count (`cardSize / tan(180°/N)`),
so a long list pushes the camera far back. Windowing keeps the close, intimate feel
at any length while bounding the composited-layer cost. Two contiguous blocks give
exactly two seams (long solid fields, one clean sweep each) instead of the busy
left/right thrash that arbitrary per-photo colors would cause. Painting the gradient
imperatively avoids a React re-render every animation frame.

**Alternatives considered:** (1) Shrink the radius with all N cards on the ring —
rejected: cards pile on top of each other. (2) Uniform background fade triggered when
a photo reaches center — rejected: no anticipatory/directional sweep, and it lagged.
(3) Free per-photo colors (no blocks) — offered but rejected with the owner for the
thrashy result. (4) CSS `transition` on the section background — rejected: it lags
the per-frame sweep.

---

## 2026-06-18 - Carousel images via next/image with an off-screen preloader

**Decision:** Render carousel photos through `next/image` (`fill`, viewport-based
`sizes`, `quality 90`; `formats: ['image/avif','image/webp']`, `qualities:[75,90]`
in `next.config.ts`) and warm the next cycle's images with a hidden off-screen layer
that uses identical `sizes` so the browser fetches the exact same optimized variant
ahead of time. Pause the spin + rAF loop offscreen via `IntersectionObserver`.

**Reason:** Source images were already WebP but served raw at full resolution through
a plain `<img>`, so a ~1200px image decoded for a ~500px card. Right-sizing cuts
decode/GPU memory ~4–6× with no visible quality change — the real enabler for larger
lineups, especially on mobile. The preloader prevents pop-in when a card's photo
swaps at the hidden back; offscreen-pause makes item count nearly irrelevant to
scroll/battery once the hero is out of view.

**Alternatives considered:** (1) Keep raw `<img>` — rejected: full-res decode is the
mobile bottleneck. (2) Lossless re-encode — rejected: little benefit; sizing is the
lever and `quality 90` is already visually lossless. (3) No preload (rely on the
~half-revolution lead time) — kept as the safety net but added preloading per the
owner's request.

---

## 2026-06-18 - Carousel settings: separate desktop/mobile counts, resilient columns

**Decision:** Store ring size per breakpoint (`carousel_settings.visible_count` =
desktop, `visible_count_mobile` = mobile) and the per-photo background on
`carousel_selection.bg_color`. `HomeHero` picks desktop vs mobile via `matchMedia`.
All carousel reads/writes use **tiered fallbacks** so a not-yet-migrated optional
column degrades quietly (per-photo colors don't persist; mobile mirrors desktop)
instead of breaking the carousel or blocking a save.

**Reason:** Phones want a tighter ring than wide desktops. Tiered fallbacks let the
code ship and run before the owner has applied each Supabase migration, which has
repeatedly been the lag point — the live carousel must never break in the interim.

**Alternatives considered:** (1) One shared count — rejected: desktop/mobile want
different densities. (2) Hard-fail when a column is missing — rejected: it broke the
live hero / blocked saves before migrations were run.

---

## 2026-06-18 - Store the editable AI prompt in an admin-only `ai_settings` table

**Decision:** Make the live AI listing-assistant system prompt editable from
`/admin/settings` by storing an optional override in a single-row `ai_settings`
table (NULL = use the built-in default). The provider keeps
`PRODUCT_EXTRACTION_SYSTEM_PROMPT` as the exported default and accepts a
`systemPrompt` override; the fill route reads the override per request through
the server Supabase client and falls back to the default if the read fails. A
new `is_app_admin()` SECURITY DEFINER function (over `profiles.is_admin`) plus
RLS/GRANTs restrict read/write to admins, and the admin-gated
`/api/admin/ai-settings` route is the only edit path.

**Reason:** The Settings prompt editor was a leftover from the disabled Quick
Fill workflow and controlled nothing. Routing the real prompt through a table +
admin API lets the owner tune assistant behavior without a code deploy, while
the default-fallback keeps generation working before/if the table is absent.

**Alternatives considered:** (1) Keep the prompt hardcoded and require a code
change/deploy to edit it — rejected as too slow for an operator. (2) Store it in
browser localStorage like the old Quick Fill prompt — rejected because the
prompt is consumed server-side and must be shared across sessions/devices.
(3) Gate writes by email like the carousel's `is_carousel_admin()` — rejected
in favor of the more robust `profiles.is_admin` mechanism.

---

## 2026-06-18 - Use carousel selection/settings tables for Store hero curation

**Decision:** Build the Store Carousel Hero admin controls on top of the
supplied `carousel_selection` and `carousel_settings` helpers, while keeping
the previous hardcoded Store hero items as a storefront fallback until the
carousel tables are installed and populated.

**Reason:** The supplied widget already defines an ordered selection model,
background setting, show-price setting, and RLS-protected admin write path.
Using those keeps the admin form aligned with the handoff while the fallback
prevents the public Store hero from going blank during setup or empty
selection states.

**Alternatives considered:** Store carousel choices in browser local storage or
add fields directly to `products`. Local storage would not affect shoppers, and
product-level flags would mix hero curation with inventory metadata while still
needing a separate order/settings mechanism.

---

## 2026-06-18 - Store manual-order line discounts on order items

**Decision:** Add `order_items.discount` for per-line manual order discounts
and keep `orders.discount` as the aggregate total discount used for order and
invoice totals.

**Reason:** Line discounts need to travel with the immutable item snapshot so
the admin can edit existing orders and invoices can show original price,
line-level discount, and adjusted line total. Keeping the aggregate on
`orders.discount` preserves existing summary and invoice calculations.

**Alternatives considered:** Store only an order-level discount, or create a
separate invoice-only adjustment table. Order-level only cannot explain which
item was discounted; an invoice-only table would leave order totals and invoice
emails out of sync.

---

## 2026-06-18 - Use cards for mobile admin orders

**Decision:** Keep the dense Orders table for desktop admin work, but render
orders as stacked cards on mobile screens.

**Reason:** The table needs many columns for desktop scanning, but on phones it
forces horizontal scrolling and makes key order context hard to read. Cards let
mobile admins see order number, total, customer, items, statuses, and the View
Order action without sideways scrolling.

**Alternatives considered:** Keep the existing horizontal overflow table on all
screen sizes or hide lower-priority columns on mobile. Horizontal overflow was
awkward and visually clipped; hiding columns would remove important admin
context.

---

## 2026-06-17 - Store per-photo image padding overrides

**Decision:** Keep `products.image_padding` as the product-level fallback and
add `products.image_padding_by_image` as a JSON map keyed by image URL for
per-photo padding overrides.

**Reason:** Existing listings and cart/wishlist payloads already depend on the
single fallback value. A JSON override map lets admins tune individual photos
without breaking older products or requiring separate image records.

**Alternatives considered:** Replace `image_padding` with a structured value or
create a separate product-images table. Replacing the field would break current
displays and saved carts; a separate table is more normalized but too heavy for
the current hand-curated product image workflow.

---

## 2026-06-17 - Lead checkout with a full-width order review

**Decision:** Make checkout start with a full-width Order Summary before the
contact form, and let cart items carry optional product descriptions for richer
checkout/cart review.

**Reason:** High-value estate pieces need more confirmation context than a
compact sidebar can provide. Showing complete titles, prices, and brief
descriptions first helps customers review exactly what they are reserving
before entering contact details.

**Alternatives considered:** Keep the previous two-column checkout with the
summary in a narrow sidebar. That was compact, but it truncated item context and
made the customer form visually dominate the review step.

---

## 2026-06-17 - Scope purity filters by selected metal

**Decision:** In shop and Product Admin filters, Silver metal selections expose
only silver-designated purity options such as `925 Sterling`, while Gold keeps
karat options.

**Reason:** Karat purity labels do not apply to silver inventory and should not
be selectable once the Metal filter is explicitly Silver.

**Alternatives considered:** Leave all purity options visible and rely on
filter results to show no matches for invalid combinations. That made the UI
less clear and allowed contradictory filter states.

---

## 2026-06-17 - Restrict Silverware / Sterling filters to Silver

**Decision:** When Silverware / Sterling is selected in shop or Product Admin
filters, the Metal dropdown exposes only Silver.

**Reason:** Silverware / Sterling implies a silver catalog path, so offering
All Metals or Gold creates invalid filter combinations and unnecessary admin
cleanup.

**Alternatives considered:** Keep All/Gold visible while auto-selecting Silver.
That preserved broader manual control, but still allowed contradictory filter
states after a single extra click.

---

## 2026-06-17 - Treat Silverware as a Silver filter shortcut

**Decision:** When Silverware is selected as the shop Item Type or admin Product
Type filter, automatically set the broad Metal filter to Silver. In Product
Admin, also set Metal Type to Silver and clear incompatible gold-only Metal
Color selections.

**Reason:** Silverware inventory belongs in the silver browsing path, and the
filter UI should prevent a contradictory Silverware + Gold filter state.

**Alternatives considered:** Leave Silverware independent from Metal and rely on
admins/shoppers to choose Silver manually. That preserved total flexibility but
made an obviously implied filter require an extra step.

---

## 2026-06-17 - Keep admin product filters collapsed by default

**Decision:** Hide the full Product Admin table filter system behind a Filters
button by default, while keeping search, Add Product, and result count visible
in the toolbar.

**Reason:** The filter system is useful but visually heavy. Collapsing it keeps
the product table easier to scan during normal admin work while preserving quick
access and showing an active-filter count when filters are applied.

**Alternatives considered:** Leave the full filter row always visible. That made
all controls immediately available, but it consumed too much vertical space for
the common inventory-scanning workflow.

---

## 2026-06-17 - Align admin product filters with shop filtering

**Decision:** Order the main Product Admin table filters around the same
catalog hierarchy used on the shop: Gender, Product Type, Brand, Metal, Metal
Type, Metal Color, Purity, then product-type-scoped Link Type and Length/Size,
with admin-only Status, Location, and Featured controls after the catalog
filters.

**Reason:** Admins should manage inventory through the same taxonomy shoppers
use to browse it, while still having operational controls that do not belong on
the public shop.

**Alternatives considered:** Keep the previous operational-first order with
Status and Pricing Metal leading the row. That kept admin controls prominent but
made the filter row less consistent with the public shop and kept Link
Type/Length visible even when they did not apply.

---

## 2026-06-17 - Store length and size as bare numerics

**Decision:** Normalize Product Admin Length/Size values to bare numeric
strings, stripping inch-unit text from manual entries, Quick Fill values, and AI
listing drafts before they are displayed or saved.

**Reason:** The admin product table needs consistent scan-friendly Size values
such as `7.75`, regardless of whether an entry came in as `7.75 in`, `7.75in`,
`7.75 inches`, or `7.75"`. Buyer-facing surfaces can still add units when the
product type needs them.

**Alternatives considered:** Continue storing necklace/bracelet lengths with
`in` and strip units only in the admin table. Normalizing before save keeps the
database and tags cleaner and avoids future table/filter inconsistencies.

---

## 2026-06-16 - Isolate AI listing providers behind configuration

**Decision:** Build the integrated product listing assistant through a
provider-neutral internal API (`generateProductDraft`) and keep all provider
names, model names, API keys, request construction, response parsing, and
central prompt text inside `next-app/src/lib/ai-product-provider.ts`.

**Reason:** The store needs freedom to switch between OpenAI, Anthropic,
Google, or local/self-hosted models based on cost, speed, and accuracy without
rewriting admin UI, form population, database code, validation, or business
logic. Environment variables choose the active provider/model.

**Alternatives considered:** Call a specific AI provider directly from the
admin component or API route. That is faster to wire up initially, but it would
spread provider assumptions through the app and make future model changes
riskier than a config-only change.

---

## 2026-06-16 - Store custom image padding colors as hex metadata

**Decision:** Extend `products.image_padding` to accept six-digit hex colors
such as `#f2efe8` in addition to `none`, `white`, and `black`.

**Reason:** The admin needs to match photo side padding to colors sampled from
the first image without creating new image files or changing the rendering path.
Keeping the custom color in the existing display metadata field lets shop
cards, product detail galleries, and admin thumbnails share one helper.

**Alternatives considered:** Add separate `image_padding_color` and
`image_padding_mode` columns, or bake sampled colors into generated image
assets. Separate columns are more verbose for the current need, and baked-in
assets would make color changes destructive and harder to revise.

---

## 2026-06-16 - Store image padding as product display metadata

**Decision:** Add a per-product `image_padding` display preference with
`none`, `white`, and `black` values instead of modifying uploaded product image
files.

**Reason:** Some product photos are vertical and reveal the containing image
frame on shop cards and detail pages. A metadata setting lets admins choose the
best frame color per listing without destructively editing or duplicating image
assets.

**Alternatives considered:** Crop or re-export each photo with baked-in side
bars. That gives fixed control per file, but it is slower, destructive, and
harder to change if the same image needs a different presentation later.

---

## 2026-06-16 - Add Product Type and Metal Type additively

**Decision:** Add nullable `products.product_type` and `products.metal_type` as
the new inventory hierarchy while keeping `jewelry_type`, `category`,
`metal_variant`, and existing pricing/order fields in place.

**Reason:** The catalog is expanding beyond gold/silver jewelry into watches,
coins, bullion, loose stones, silverware, estate lots, and future categories.
An additive migration lets the admin UI move to Product Type first and Metal
Type second without breaking current shop pages, pricing, orders, invoices, or
legacy product rows.

**Alternatives considered:** Rename or repurpose `jewelry_type` and `category`
directly. That would be cleaner eventually, but it risks breaking live pricing
and product filters because `category` still powers Gold/Silver spot-pricing
logic.

---

## 2026-06-16 - Keep Quick Fill custom values as direct field values

**Decision:** Add `products.brand` as a real product field, but keep Quick Fill
custom Brand, Link Type, and Length/Size entries as direct free-text field
values instead of promoting them into permanent dropdown option lists.

**Reason:** Admins need flexibility to enter a specific maker, style, or
measurement without letting every one-off value expand the controlled option
menus and filters.

**Alternatives considered:** Automatically add every new Brand, Link Type, or
Length/Size value to future chooser lists. That would make repeated values easy
to select, but the option menus would drift and grow too quickly for a small,
curated inventory workflow.

---

## 2026-06-15 - Show spot basis on product detail pricing

**Decision:** Item detail pages show the raw scrap/melt value, the current
site-wide spot value per ounce used for that calculation, and a countdown to
the next five-minute price refresh.

**Reason:** Buyers can see not only the selling price and melt value, but also
the exact market baseline behind the calculation and when it will update next.

**Alternatives considered:** Keep showing only the scrap value. That was
simpler but did not explain which current spot value the item price was based
on or when the pricing context would refresh.

---

## 2026-06-15 - Separate Jewelry Type from Link Type

**Decision:** Add `products.jewelry_type` for the broad item form and keep the
existing `products.chain_type` as Link Type, scoped only to necklaces and
bracelets.

**Reason:** Necklace/bracelet/ring/pendant/earrings are merchandising item
types, while Cuban/Figaro/Rope/Byzantine/etc. describe link style. Separating
them prevents values like "Cuban link bracelet" from becoming one ambiguous
category and lets necklace and bracelet link filters remain distinct.

**Alternatives considered:** Keep using one combined Chain Type/Jewelry Type
field. That was simpler but kept mixing item form with link style and made
filtering less precise.

---

## 2026-06-15 - Model metal color/type as a product subtype

**Decision:** Keep `products.category` as the broad pricing category (`Gold` or
`Silver`) and add `products.metal_variant` for Yellow Gold, White Gold, Rose
Gold, Tricolor Gold, Bicolor Gold, Silver, and Vermeil. Bicolor Gold is stored
as a Gold subtype but appears under both broad Gold and Silver shop filters.

**Reason:** Pricing and melt-value logic depend on the broad metal category, but
admins and shoppers need a finer merchandising/filtering distinction. A subtype
field preserves current spot-pricing behavior while giving the catalog room to
separate gold colors and silver/vermeil.

**Alternatives considered:** Add every color/type as a top-level category. That
would make filters simple but would blur the pricing category and increase the
risk of breaking gold/silver spot calculations.

---

## 2026-06-15 - Checkout creates unpaid admin-follow-up orders

**Decision:** Public checkout creates an unpaid order, snapshots the cart into
`order_items`, moves products to `pending_payment`, inserts an admin
notification, and emails the configured order recipient.

**Reason:** The store does not have live card capture yet, but inventory still
needs to be held immediately and the owner needs a reliable order trail plus a
visible admin inbox item.

**Alternatives considered:** Keep checkout as a front-end confirmation only;
send only an email without writing an order; route directly to payment before
creating inventory holds. All three options risk missed orders or overselling
single-piece inventory.

---

## 2026-06-15 - Manual orders drive product lifecycle

**Decision:** Manual admin orders snapshot item details into `order_items` and
drive product status transitions from the order detail screen.

**Reason:** Sales history needs immutable item details, while the live product
record can continue changing for merchandising. Product lifecycle transitions
keep the public shop from selling the same item twice.

**Alternatives considered:** Leave order creation disconnected from product
status; update only live product records without order item snapshots. Both
options weaken sales history and inventory safety.

---

## 2026-06-15 - Add sales workflow schema additively

**Decision:** Introduce orders, order item snapshots, invoices, saved items, and
richer product lifecycle fields through additive Supabase SQL while keeping the
existing `products` table and admin component.

**Reason:** The store already has live inventory, product admin, checkout/cart,
and public product pages depending on the current product shape. Additive fields
let the site gain sales-processing behavior without a risky rewrite or data
cutover, and order item snapshots preserve the sold item details even if product
records change later.

**Alternatives considered:** Replace the product schema outright; build a
separate inventory table. Additive migration is safer for the current live shop
and keeps public routes compatible during rollout.

---

## 2026-06-15 - Admin users view reads profiles

**Decision:** Build the admin account-users table from Supabase `profiles`
instead of browser-side Auth admin APIs.

**Reason:** `profiles` is already the app-owned account/contact table, includes
the fields needed for the dashboard, and can be protected with an authenticated
admin RLS policy. Auth admin APIs require a service-role key and should not be
called from client code.

**Alternatives considered:** Add a service-role server client and list
`auth.users`; expose profile reads through a custom route handler. The profile
table keeps the feature aligned with existing account and checkout data.

---

## 2026-06-13 - Keep Auctions under Shop

**Decision:** Keep Auctions as a submenu option under the main Shop navigation,
alongside Store. Store links to `/shop`; Auctions links to `/auctions`.

**Reason:** Auctions is related to shopping/buying inventory but should not
compete as a top-level header destination.

**Alternatives considered:** Keep Auctions as a standalone top-level nav item;
rename the existing Shop route. A submenu keeps the header cleaner without
changing route URLs.

---

## 2026-06-13 - Treat root static site as legacy

**Decision:** Use `next-app/` as the current application surface and treat the
root static HTML/CSS/vanilla-JS site as legacy cleanup material.

**Reason:** Root `netlify.toml` builds from `next-app`, the Next build passes,
and the Next app owns the current app routes, Supabase-backed product catalog,
admin, inquiries, sitemap, robots, and metal-price API.

**Alternatives considered:** Keep both sites indefinitely; promote `next-app/`
to the repository root immediately. Promotion is cleaner long term but should
happen as a separate, deliberate move after legacy deletion is reviewed.

---

## 2026-06-12 — Lead form uses Netlify Forms

> ⚠️ **Superseded 2026-06-25** — Netlify Forms was found to silently fail on
> this client-rendered React app and was replaced by `/api/inquire`. See the
> 2026-06-25 "Lead forms post to /api/inquire, not Netlify Forms" entry above.

**Decision:** Replace the Jotform embed with static Netlify Forms on the English
and Spanish contact pages. Keep the `#submit-item` destination, use a large
square photo-upload target, open a details modal after photo selection, and let
Netlify handle submissions, uploaded photos, spam honeypot, and notifications.

**Reason:** This removes the third-party Jotform implementation while preserving
the seller lead workflow and photo upload requirement in the existing static
Netlify hosting model.

**Alternatives considered:** Keep Jotform; rebuild a custom serverless handler;
route photo submissions through text/email only.

---

## 2026-06-10 — Homepage announcement is compact and header-tucked

**Decision:** Add the monthly buying/evaluation announcement as a small fixed
banner on the EN/ES homepages, delayed one second and positioned below the fixed
site header with a higher header z-index.

**Reason:** The message gets attention on load without taking over the hero or
adding permanent layout height.

**Alternatives considered:** A large modal/popup; an inline hero notice; a
site-wide banner on every page.

---

## 2026-06-10 — Homepage hero video owns first paint

**Decision:** Do not use the old homepage still image as the `<video>` poster.
The hero video should preload normally and the still image should remain hidden
unless the visitor has `prefers-reduced-motion: reduce`.

**Reason:** The poster image can paint before the MP4 first frame is ready,
causing the retired hero image to flash during page load.

**Alternatives considered:** Generate a new poster from the video first frame;
keep the old poster and fade it out with JavaScript.

---

## 2026-06-01 — Spanish translation via separate `/es/` pages

> ⚠️ **Superseded by the Next.js rebuild (2026-06-13)** — there is no `/es/`
> static folder anymore; localization is `next-intl` App Router routes
> (`localePrefix: 'as-needed'`) under `next-app/src/app/[locale]`. The
> single-source-catalog and native-review intent below still holds. See
> `features/spanish-translation.md` for the current model.

**Decision:** Add a full Spanish version of the site as separate pages in a
`/es/` subdirectory, paired with English via `hreflang`, with a one-click EN/ES
header toggle. Spanish copy will be AI-drafted and reviewed by a native speaker
before publishing. Shop products stay single-source (add `*_es` fields, not a
duplicate catalog). Full plan in `features/spanish-translation.md`.

**Reason:** Separate, indexable Spanish URLs capture real Spanish-search leads in
Southwest Florida's large Spanish-speaking market, read professionally for a
luxury/trust brand, and fit the static + Netlify setup with no build step.

**Alternatives considered:** JS text-swap toggle (no Spanish SEO, flash of
untranslated text, heavy tagging); Google Translate widget / browser
auto-translate (inaccurate, unprofessional, no SEO value).

---

## 2026-06-01 — Lead form uses Jotform (recorded for the record)

> ⚠️ **Superseded 2026-06-12** by static Netlify Forms, itself **superseded
> 2026-06-25** by `/api/inquire`. See that entry above for the current model.

**Decision:** The "Submit Your Item" lead form is an embedded Jotform (form id
`261379265677068`) on `contact.html`. This was **already implemented and working
before this documentation session** — recorded here so future sessions don't
mistake it for unfinished. The earlier custom files (`submit-item-form.*`) are
legacy/unused.

**Reason:** Jotform provides hosted delivery, spam handling, and **photo
uploads** out of the box, with no custom backend to maintain.

**Alternatives considered:** Formspree (file uploads paid-only); FormSubmit;
finishing the custom form with a self-hosted handler.

---

## 2026-06-01 — Adopt a Markdown project-memory system

**Decision:** Maintain persistent project context in `project-docs/` (overview,
status, architecture, decisions, tasks, changelog, per-feature docs, meeting
notes, and a Dark Matter `CLIENTS.md`).

**Reason:** Preserve decisions and state across AI sessions / chat resets / new
contributors, and reduce repeated re-explanation. Documentation is treated as
part of the implementation, not optional.

**Alternatives considered:** A single README; an external wiki/Notion; relying on
chat history alone.

---

## 2026-06-01 — Add Dark Matter Web Services footer credit

**Decision:** Show a "Powered by Dark Matter Web Services" badge (linking to
`darkmatterwebdev.com`) in the footer of every page; bumped theme cache version
to `darkmatter-credit-20260601`.

**Reason:** Agency attribution + lightweight marketing for the builder.

**Alternatives considered:** No credit; text-only credit.

---

## (Earlier) — Reorganize assets and scripts with redirects

**Decision:** Move images under `assets/images/{branding,pages,shop}/` and group
scripts under `scripts/{shared,shop,account,forms}/`, adding 301 redirects in
`netlify.toml` from all legacy root URLs.

**Reason:** Cleaner repo structure without breaking previously published/indexed
URLs.

**Alternatives considered:** Leaving files at the root; breaking old URLs.

---

## (Earlier) — Keep the product catalog in code, not a database

> ⚠️ **Superseded by the Next.js rebuild (2026-06-13)** — the catalog moved
> to the Supabase `products` table (see `STRUCTURE.md` "Single sources of
> truth"). `window.SHOP_PRODUCTS` no longer exists.

**Decision:** Store products as a static `window.SHOP_PRODUCTS` array in
`scripts/shop/shop-products.js`. Supabase holds only customer-account data
(profiles, favorites, carts).

**Reason:** Small, hand-curated inventory; editing in code (with AI assistance)
is simpler than a CMS/DB and keeps the catalog versioned with the site. Avoids
the cost/complexity of Shopify or an admin dashboard.

**Alternatives considered:** Shopify; a custom admin + product table in Supabase;
a headless CMS.

---

## (Earlier) — Live gold-spot pricing via a Netlify Function

> ⚠️ **Superseded by the Next.js rebuild (2026-06-13)** — the fetch/cache
> logic moved to `next-app/src/lib/spot-price.ts`, exposed via
> `next-app/src/app/api/metal-prices/route.ts`. The design intent (server-side
> fetch, 5-min cache, fallback) carried over unchanged.

**Decision:** Compute shop prices from live gold spot. A Netlify Function
(`metal-prices.js`) fetches XAU from `gold-api.com`, caches 5 min, adds CORS and a
fallback; each product price = `meltValue × pricingMultiplier`.

**Reason:** Prices stay fair and current with the gold market automatically; the
upstream API key/endpoint and rate limits are hidden behind the function, and a
fallback keeps the shop usable if the API fails.

**Alternatives considered:** Hard-coded manual prices; calling the price API
directly from the browser; a paid pricing widget.

---

## (Earlier) — Supabase for customer accounts

**Decision:** Use Supabase (Postgres + Auth) for sign-in, profiles, favorites,
and saved carts, with RLS so users only see their own data. Ship only the anon
key to the browser.

**Reason:** Managed auth + Postgres + RLS with minimal backend code; fits a
static site without running our own server.

**Alternatives considered:** Firebase; a custom Node/Express backend; no accounts
(guest-only).

---

## (Earlier) — Static multi-page site with Tailwind CDN + PowerShell sync

> ⚠️ **Superseded 2026-06-13** — the site was rebuilt as the Next.js app in
> `next-app/` (React/TypeScript, Tailwind via PostCSS build, shared layout
> components instead of PowerShell sync). See `project-docs/LEGACY_REMOVAL_REPORT.md`
> and the "Docs updated for Next cleanup" changelog entry.

**Decision:** Build as plain HTML pages styled with Tailwind (CDN) + custom
editorial CSS, and keep shared header/theme consistent using PowerShell sync
scripts instead of a templating/build framework.

**Reason:** Maximum simplicity, speed, and SEO; no build pipeline to maintain;
easy to host anywhere static.

**Alternatives considered:** A framework (Next.js/Astro/11ty); a CMS; manual
per-page header edits.
