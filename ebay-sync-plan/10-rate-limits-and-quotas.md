# 10 — Rate Limits, Quotas, Selling Limits & Cost Model

> Planning only. eBay limits are **per application keyset per day** unless
> noted. Source: developer.ebay.com API call limits page + per-API overviews
> (2026 snapshots). Unlike Etsy (5 QPS / 5K per day), eBay's API quotas are
> effectively unlimited at this catalog's scale — the *real* constraints are
> different ones (below).

## Default daily API quotas vs our usage

| API | Default quota / day | Our worst-day usage |
| --- | --- | --- |
| Sell Inventory | **2,000,000** | ~250 calls (full catalog publish) — 0.0125% |
| Sell Account | 25,000 | ~5 (policy reads, privileges) |
| Commerce Taxonomy | **5,000** ⚠ tightest | ~0 at runtime — category/aspect data is pinned at build time and cached; only refreshed manually |
| Sell Metadata | 5,000 | same as Taxonomy — build-time/cached |
| Sell Fulfillment (order resource) | 100,000 | Phase 3 poll every 15 min ≈ 96/day |
| Commerce Media | 1,000,000 (+50 POSTs/5s) | 0 (fallback path only) |
| Commerce Notification | 10,000 | ~1/h max (public-key cache) |
| OAuth token minting | client-credentials 1,000 · auth-code 10,000 · **refresh 50,000** | a few dozen refreshes/day worst case; app token cached 2h |

Raising limits needs the (free) Application Growth Check — **not needed at
this scale, ever**, short of a 1000× catalog change.

## Calls per product

### Initial publish

| Step | Calls |
| --- | --- |
| `createOrReplaceInventoryItem` (title/desc/images/aspects/condition/qty in ONE payload) | 1 |
| `createOffer` | 1 |
| `getListingFees` (optional, feeds the dry-run fee readout) | 0–1 |
| `publishOffer` | 1 |
| **Total** | **3–4** (vs ~12 on Etsy — no image calls) |

### Incremental update

| Change | Calls |
| --- | --- |
| Price and/or quantity only | 1 (`bulkUpdatePriceQuantity`) |
| Copy/aspects/images/condition | 1 (item PUT — live listing auto-revises) |
| Category/policies/description | 1 (`updateOffer` full PUT) |
| Hide (qty 0) / restore | 1 |
| Withdraw / re-publish | 1 / 1 |

## Catalog math (~78 products as of 2026-07-09)

| Operation | Calls | % of 2M Inventory QPD |
| --- | --- | --- |
| **Full initial publish** (78 × ~3.5) | **~275** | ~0.014% |
| Daily spot price push, worst case (all spot items drifted) | ≤ 78 | ~0.004% |
| Daily price push, typical (1% threshold, quiet metal day) | 0–10 | ~0% |
| One product fully re-imaged | 1 | ~0% |
| Phase 3 order polling (every 15 min) | 96 (Fulfillment quota, separate) | — |

Verdict: **API quota is a non-issue by 4–5 orders of magnitude.** The
binding constraints are elsewhere:

## The constraints that actually bind

1. **Monthly selling limits — resolved for this account (Q13/Q14,
   2026-07-09).** Every seller account has a monthly cap on item count AND
   total listed dollar value, and this would be the binding constraint on a
   new account — but the owner's existing eBay account's limits
   **comfortably hold the full catalog**. Kept as safety nets:
   `getPrivileges` snapshot in the settings panel and pre-flight
   (informational), and a mapped operator message if eBay ever rejects on
   limits ([11-error-handling.md](11-error-handling.md)).
2. **250 revisions per listing per day.** Relevant only to pathological
   update loops; the content-hash gate + price threshold keep normal usage at
   ≤2 revisions/listing/day. The client logs cumulative revision counts to
   make a runaway visible early (Etsy-runaway lesson applied to a different
   cap).
3. **Netlify function time** — much softer than Etsy (no transcode): one
   publish ≈ 3–4 sequential HTTPS calls ≈ 2–5s. Bulk drain still batches with
   a time budget and returns `{done:false}` — pattern kept for uniformity.
4. **No rate-limit response headers exist** on eBay REST responses. On a 429
   (`errorId 2001`), back off exponentially; quota introspection, if ever
   wanted, is the Developer Analytics API `getRateLimits` (itself 5K/day) —
   logged occasionally into `ebay_sync_log.detail`, mirroring the Etsy
   quota-headroom logging.

## Throttle & backoff (client-side, in `lib/ebay/client.ts`)

- Modest token-bucket throttle (e.g. 3–4 req/s) — not required by a
  documented QPS cap, but it keeps bulk drains polite and mirrors the Etsy
  client's shape. Steps are sequential per product; bulk mode is a drained
  queue, not a fan-out (double-click/two-tab protection via the same
  `sync_state` compare-and-set).
- | Response | Action |
  | --- | --- |
  | 429 (`errorId 2001`) | Exponential backoff with jitter: 1s → 2s → 4s (max 3 in-invocation retries); if still limited, checkpoint and return `done:false`. |
  | 500/502/503 | Same backoff; steps are idempotent (full-replace PUTs, publish guarded by checkpoint). |
  | 400/403/404/409 + `BUSINESS`-category errors | **No retry** — semantic errors go straight to `error` state with the mapped message ([11-error-handling.md](11-error-handling.md)). |

## eBay money costs (not API, but belongs in the model)

Numbers below are the fee model to plan around — **exact current percentages
must be verified against eBay's live fee schedule at decision time
(`TODO(ebay-verify)`; www.ebay.com/help/selling/fees-credits-invoices)**:

| Fee | Ballpark | Impact |
| --- | --- | --- |
| Insertion fee | **$0** for this catalog — non-store sellers get ~250 zero-insertion-fee listings/month; GTC listings count against the allocation monthly | 78 listings ≪ 250 ⇒ effectively free to list (verify allocation terms) |
| Final value fee (Jewelry & Watches) | **~15%** of total sale up to a threshold, lower above it; Watches differ | This drove Q2's decision: an admin-variable eBay markup (seeded 15%, editable in settings) rather than reusing Etsy's 8% |
| Per-order fixed fee | ~$0.30/order | minor |
| Optional: eBay Store subscription | monthly fee; lowers FVF ~1–2 pts + more free listings + store categories | **Q12 decided: no Store initially**; re-run the math after real sales data |
| Optional: subtitle, secondary category, reserve | per-feature fees | not used by this plan |

Unlike Etsy there is **no per-listing renewal fee** (GTC renews free within
the monthly allocation) and **no $0.20-per-listing cost** to test with — but
a published test listing is publicly buyable, so tests use low-risk items
and the sandbox first ([14-verification-checklist.md](14-verification-checklist.md)).
