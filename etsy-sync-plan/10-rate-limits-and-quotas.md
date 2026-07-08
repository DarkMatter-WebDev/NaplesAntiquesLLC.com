# 10 — Rate Limits, Quotas & Cost Model

> Planning only. App limits today: **5 requests/second, 5,000 requests per
> sliding 24h window** (personal app, pending approval).

## Calls per product

### Initial publish

| Step | Calls |
| --- | --- |
| `createDraftListing` | 1 |
| `uploadListingImage` × K images | K (catalog avg ≈ 6.7, max 10) |
| `updateListingInventory` | 1 |
| `updateListingProperty` (best-effort, 1–3 per type) | ~2 |
| `updateListing` (activate) | 0–1 (0 in draft-for-review mode) |
| **Total** | **≈ K + 5 → ~12 for an average product** |

### Incremental update

| Change | Calls |
| --- | --- |
| Price and/or quantity only | 1 (`updateListingInventory`) |
| Copy/attributes | 1–4 |
| Image add/remove | 1 per added + 1 per removed |
| Delist / relist | 1 |

## Catalog math (48 products, 321 images today)

| Operation | Calls | % of 5K QPD |
| --- | --- | --- |
| **Full initial publish** (48 × ~12) | **~570** | ~11% |
| Daily spot price push, worst case (all spot items repriced) | ≤ 48 | ~1% |
| Daily price push, typical (1% threshold, quiet metal day) | 0–10 | ~0.2% |
| One product fully re-imaged | ~15 | ~0.3% |
| Order ingest per Etsy sale (webhook is inbound; receipt fetch + writes) | ~2 | ~0% |

Verdict: **quota is a non-issue at this catalog size.** Even a
publish-everything day plus price push uses ~12% of QPD. The binding
constraints are **5 QPS** and **Netlify function time**, not the daily quota.

## QPS handling (client-side, in `lib/etsy/client.ts`)

- Token-bucket throttle capped at **4 req/s** (headroom below 5) shared per
  invocation; sync steps are sequential anyway, so this mostly guards
  accidental parallelism.
- Concurrency rule: the step machine processes **one product at a time** and
  **one image at a time**. Bulk mode is a drained queue, not a fan-out.
  (Admin double-click / two tabs is the realistic parallel-caller risk; a
  cheap DB guard — `sync_state` transition as compare-and-set — makes the
  second caller a no-op.)
- Read Etsy's rate-limit response headers (`x-limit-per-second`,
  `x-remaining-this-second`, daily equivalents — verify exact names in the
  OpenAPI spec) and log remaining-daily into `etsy_sync_log.detail`
  periodically so quota pressure is observable before it bites.

## Backoff on 429 / 5xx

| Response | Action |
| --- | --- |
| 429 | Exponential backoff with jitter: 1s → 2s → 4s (max 3 in-invocation retries); if still limited, checkpoint and return `done: false` — the client loop naturally spaces the next attempt. |
| 500/502/503 | Same backoff; these are retry-safe for our idempotent steps (image upload duplicates handled by reconcile-on-resume, [05-image-pipeline.md](05-image-pipeline.md)). |
| 400/403/404/409 | **No retry** — semantic errors go straight to `error` state with the mapped message ([11-error-handling.md](11-error-handling.md)). |

## Netlify function-time budget (the real limit)

- Standard function timeout ~10s (extendable to ~26s): each `sync` invocation
  self-limits to **~8s of work** — roughly 3–4 image
  fetch+transcode+uploads — then checkpoints and returns `done: false`.
- Full catalog publish ≈ 570 calls at ~1–2s each ≈ **15–25 minutes of
  wall-clock**, spread over ~150 short invocations driven by the admin page
  staying open. Acceptable for a one-time (or rare) operation; if it ever
  isn't, Netlify Background Functions (15-minute limit) are the upgrade path
  without changing the step machine.

## Etsy money costs (not API, but belongs in the model)

| Fee | Amount | Impact |
| --- | --- | --- |
| Listing fee | $0.20 per listing | Full catalog ≈ **$9.60** one-time |
| Renewal | $0.20 per listing per 4 months (auto-renew) | ≈ $29/year for 48 listings; slow-moving estate pieces renew repeatedly — worth watching |
| Transaction fee | ~6.5% of item+shipping | Motivates the optional Etsy price markup ([13-open-questions.md](13-open-questions.md) Q5) |
| Payment processing | ~3% + $0.25 (US) | Same |

## When to request higher limits

Not needed at this scale. Reconsider only if: catalog grows ~10× (500+
products with images), sync frequency becomes hourly-full-catalog, or Etsy
tightens personal-app quotas. Etsy grants higher limits on request once the
app is approved and demonstrably well-behaved — the throttle + logging above
is also the evidence trail for that request.
