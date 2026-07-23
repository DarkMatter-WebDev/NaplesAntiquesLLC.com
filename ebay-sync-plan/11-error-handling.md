# 11 — Error Handling & Idempotency

> Planning only. Companion to the state machine in
> [03-sync-lifecycle.md](03-sync-lifecycle.md) and the log/table design in
> [08-database-schema.md](08-database-schema.md). Principles are inherited
> verbatim from the Etsy build (they survived production); the specifics are
> re-derived for eBay's error model.

## Principles (unchanged)

1. **Checkpoint before, verify after.** Every eBay write is preceded by a DB
   read of the checkpoint (skip if done) and followed by a DB write of the
   result. Crash windows between the two have a reconcile answer (below).
2. **Errors are states, not exceptions.** A failed sync leaves
   `ebay_listings.sync_state='error'` + `last_error` + a log row.
3. **Retry only what's safe.** Transport failures retry with backoff;
   semantic rejections never auto-retry.
4. **Partial success is honest success.** Warnings are first-class
   (`outcome='warning'`) — e.g. "published with 2 recommended aspects
   skipped (no matching allowed value)".

## eBay's error model (what the client parses)

Standard REST envelope on every non-2xx (and `warnings[]` on success):

```jsonc
{ "errors": [ { "errorId": 25002, "domain": "API_INVENTORY",
                "category": "REQUEST" | "BUSINESS" | "APPLICATION",
                "message": "…", "longMessage": "…",
                "parameters": [{ "name": "…", "value": "…" }] } ] }
```

Routing rule: `category` drives retryability — `APPLICATION` (eBay-side
fault) retries like a 5xx; `REQUEST`/`BUSINESS` are semantic (no retry).
`errorId` drives the operator message map. Cross-API IDs: 1001/1003 (bad
token → refresh once, then `needs_reauth`), 1100 (missing scope →
`needs_reauth` with reconnect hint), 2001 (429 rate limit), 25xxx
(Inventory-domain validation). `publishOffer`/`bulkPublishOffer` return
per-offer `errors[]`/`warnings[]` — bulk failures isolate per item, never
fail the batch (Etsy Q7 behavior preserved).

## Partial-failure playbook (crash-window reconciliation)

Simpler than Etsy's — every step's remote effect is discoverable by key:

| Scenario | Detection | Recovery |
| --- | --- | --- |
| Item PUT succeeded, DB write lost | `sync_state='pending'` but the SKU exists on eBay | None needed: the retry re-PUTs the identical full payload (converges). SKU = `products.id`, so there is **no duplicate-listing window at all** at this step — the eBay-side key is deterministic, unlike Etsy's server-assigned listing_id (this deletes Etsy's SKU-adoption guard problem by construction). |
| Offer created, `offer_id` not saved | retry's `createOffer` returns the documented "offer already exists" error for the SKU+marketplace+format triple | Catch that specific error → `getOffers?sku=` → adopt the existing `offerId`. One extra read, deterministic. |
| Published, `listing_id` not saved | `sync_state='offer_created'`/`review` but offer is live | `getOffer(offerId)` → `status='PUBLISHED'` + `listing.listingId` → adopt. `publishOffer` on an already-published offer errors distinctly → same adoption path. |
| Update pushed, hash not saved | Listing correct on eBay, hash stale | Next sync re-pushes an identical payload — harmless (full-replace idempotency), hash saved then. |
| Withdraw ran, product then deleted, mapping cascaded away | Orphaned live listing risk | Withdraw runs **before** delete in the guarded product-delete flow (hard gate — see [08](08-database-schema.md)); log loudly if a mapping with a live listing exists at delete time. Monthly audit catches strays ([14](14-verification-checklist.md)). |
| Phase 3 order ingested, product write failed | log row exists, no product change | `outcome='error'` + admin notification; owner resolves manually (human-in-the-loop for conflicts, same as Etsy Phase 3 design). |

## Retry strategy

| Class | Examples | Policy |
| --- | --- | --- |
| Transient | 429 (`errorId 2001`), 500–503, network timeout, `category:APPLICATION` | In-invocation: up to 3 tries, exponential backoff + jitter (1s/2s/4s) — also the API-License-mandated "max two retries for infrastructure errors" is respected by capping automated cross-invocation retries. Across invocations: `error_count++`; admin Retry resumes from checkpoint; after 5 consecutive failed invocations, show "persistent failure — see log". |
| Semantic | 400/25xxx validation (missing aspect, bad category, image unreachable), `category:BUSINESS` (selling limit, policy violation) | No auto-retry. Map to operator message (table below), `sync_state='error'`. |
| Auth | 401 / 1001 / 1100, `invalid_grant` on refresh | Refresh once (1001); on failure mark connection `needs_reauth`, banner in admin. Product-level state stays `pending` (products are fine; the connection isn't). |
| Pre-flight | unmapped category, metal ineligible for Fine Jewelry, no images, price not computable, missing required aspect | Never reaches eBay. Shown in dry-run with a per-check message. |

## Error message mapping (operator-visible layer)

Raw eBay error bodies land in `ebay_sync_log.detail` (allowlisted fields,
redacted); the chip/toast/`last_error` layer shows mapped English with a
next step:

| eBay condition | Operator message |
| --- | --- |
| Selling limit exceeded (25002-family, limit text) | "eBay's monthly selling limit would be exceeded. Request an increase in Seller Hub (Help → Selling limits), then retry." |
| Required item specific missing/invalid at publish | "eBay requires a {aspect} value for this category. Set the item's {field} and retry." |
| Category/condition rejection | "eBay didn't accept the category or condition for this item type. Review the category override in the drawer." |
| Image unreachable/too small | "eBay couldn't load image {n}. Replace the photo (min 500px) and retry." |
| Missing business policy / location | "eBay needs shipping/payment/return policies and a location. Finish setup in Settings → eBay Sync." |
| Token expired/revoked/18-month expiry | "eBay connection expired — click Reconnect eBay." |
| Business-policy opt-in not active | "Your eBay account isn't opted into Business Policies yet (can take 24h). Try again later." |
| Fine-Jewelry eligibility (pre-flight) | "Plated/vermeil items can't be listed in eBay Fine Jewelry. This item will use the Fashion Jewelry category (or exclude it from eBay)." |

## Idempotency inventory (why each step is safe to repeat)

| Step | Idempotency mechanism |
| --- | --- |
| Pre-flight / dry-run | Read-only |
| `createOrReplaceInventoryItem` | Full-replace PUT keyed by deterministic SKU — repeats converge |
| `createOffer` | Uniqueness enforced by eBay (one offer per SKU+marketplace+format); "already exists" → adopt via `getOffers?sku=` |
| `publishOffer` | Checkpoint guard + "already published" → adopt via `getOffer` |
| `updateOffer` / `bulkUpdatePriceQuantity` | Full-state / absolute-value writes — repeats converge |
| Hide / withdraw / restore | State-targeting; repeat is a no-op or a distinct known error mapped to no-op |
| Account-deletion webhook | `webhook_events` unique `(provider, event_id)` |
| Order ingest (Phase 3) | `orderId` recorded before side effects; duplicate ⇒ skip |
| Queue drain | `sync_state` compare-and-set + claim RPC ([08](08-database-schema.md)) |

## Logging & observability

- Every step outcome → `ebay_sync_log` (action, outcome, message, allowlisted
  detail incl. eBay `errorId`s). **Redaction rule:** never log
  `Authorization` material; `detail` is built from an allowlist of response
  fields, not a raw dump (Etsy client rule).
- Surfaced in admin: per-product chip + tooltip, settings-panel activity
  list, re-auth banner, reconnect countdown. Nothing important lives only in
  Netlify function logs.
- `error_count` + `sync_state='error'` filter chip = the owner's worklist.
- Post-publish hygiene (Phase 2+): a periodic (or admin-button) Compliance
  API `getListingViolationsSummary` check for `ASPECTS_ADOPTION` drift —
  eBay adds required aspects over time, and listings valid at publish can
  fall out of compliance; violations surface as warnings in the activity
  list. (No Etsy analog existed; cheap and worth it here.)
