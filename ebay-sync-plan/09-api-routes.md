# 09 — Proposed Next.js Route Handlers

> Planning only. All under `next-app/src/app/api/`, TypeScript route
> handlers, following the shipped `/api/admin/etsy/*` family exactly.
> Every `/api/admin/ebay/*` route: verify the signed-in Supabase user is an
> admin (same gate as the Etsy routes) → then act with the service-role
> client. JSON in/out; errors as `{ error: { code, message } }` with
> operator-friendly `message`.

## Route map

| Route | Method | Auth | Purpose |
| --- | --- | --- | --- |
| `/api/admin/ebay/connect` | GET | admin | Start OAuth: create state row, 302 to eBay consent ([04](04-oauth-and-secrets.md)) |
| `/api/admin/ebay/callback` | GET | admin + `state` | Code exchange (≤299s window), persist `ebay_connection`, redirect to `/admin/settings?ebay=connected` |
| `/api/admin/ebay/status` | GET | admin | Connection status, token/reconnect countdown, defaults, policy flags, selling-limit snapshot, prerequisite checklist, recent activity |
| `/api/admin/ebay/disconnect` | POST | admin | Clear stored tokens (confirm in UI first; listings untouched) |
| `/api/admin/ebay/settings` | PUT | admin | Save defaults + sync policy (policy IDs, location key, auto-publish, markup, price-push, sold-handling, best-offer) |
| `/api/admin/ebay/account-profiles` | GET | admin | Proxy-read fulfillment/payment/return policies (+ location) for the settings dropdowns (Etsy's `shop-profiles` twin) |
| `/api/admin/ebay/preview` | POST | admin | **Dry-run**: `{ productId }` → mapped item+offer payloads + pre-flight results (+ fees if an unpublished offer exists). No eBay writes. |
| `/api/admin/ebay/sync` | POST | admin | Run sync steps for one product with a time budget; resumable. Modes: `publish` \| `update` \| `price-only` \| `publish-live` (the explicit review→published step) |
| `/api/admin/ebay/sync-batch` | POST | admin | Phase 2: `enqueue` \| `enqueue-all-eligible` \| `drain` |
| `/api/admin/ebay/delist` | POST | admin | Hide (quantity-zero) / withdraw / restore a linked listing per Q7 verbs |
| `/api/admin/ebay/listings` | GET | admin | Bulk `product_id → sync_state` map (product table chips; local DB read) |
| `/api/admin/ebay/eligibility-summary` | GET | admin | Bulk pre-flight counts for the "Sync All" confirm screen (incl. the selling-limit bucket) |
| `/api/admin/ebay/verify-listing` | POST | admin | Reconcile ONE listing's local state with eBay's real state (read-only `getOffer`/`getListing`-class calls; clears stale errors) |
| `/api/admin/ebay/verify-all` | POST | admin | Bulk reconcile (the "Check eBay statuses" button — the Etsy verify-all twin) |
| `/api/admin/ebay/price-push` | POST | `x-cron-secret` header (`EBAY_CRON_SECRET`) | Phase 2 scheduled price push — trigger-agnostic like Etsy's |
| `/api/admin/ebay/push-prices` | POST | admin | Manual "Push prices now" — bounded batches, client polls until done (Etsy twin) |
| `/api/webhooks/ebay-account-deletion` | GET + POST | eBay challenge / signature | **Phase 0 compliance endpoint** ([15-compliance.md](15-compliance.md)): GET answers the challenge echo; POST verifies `x-ebay-signature`, records via `webhook_events`, acks 200 |
| `/api/admin/ebay/orders-poll` | POST | `x-cron-secret` | Phase 3: `getOrders` cursor poll → SKU match → site-sale semantics ([03](03-sync-lifecycle.md) Flow 4) |

## Key request/response shapes

### `POST /api/admin/ebay/preview`

```jsonc
// req
{ "productId": "…" }
// res 200
{
  "eligible": false,
  "preflight": [
    { "check": "category",      "ok": true, "value": "Fine Necklaces & Pendants (261993)", "approximate": false },
    { "check": "metal_purity",  "ok": false, "message": "Fine Jewelry requires a Metal Purity — set the item's purity" },
    { "check": "images",        "ok": true, "value": 7 },
    { "check": "price",         "ok": true, "value": 1425.60 },
    { "check": "selling_limit", "ok": true, "warning": "Monthly $ limit headroom estimate: $3,200" }
  ],
  "payload": {                     // what WOULD be pushed (mapper output)
    "title": "…(≤80 chars)…",
    "aspects": { "Metal": ["Yellow Gold"], "Metal Purity": ["14k"], "Chain Length": ["21 in"] },
    "condition": "USED_EXCELLENT (Pre-owned)",
    "conditionDescription": "…",
    "categoryId": "261993",
    "price": 1425.60, "quantity": 1,
    "imageUrls": [ "https://…/products/….webp" ],
    "descriptionPreview": "…first 500 chars…"
  },
  "fees": null                     // populated from getListingFees once an unpublished offer exists
}
```

### `POST /api/admin/ebay/sync`

```jsonc
// req
{ "productId": "…", "mode": "publish" }   // 'publish' | 'update' | 'price-only' | 'publish-live'
// res 200 — bounded work done, call again (rare here; most publishes finish in one call)
{ "done": false, "syncState": "offer_created", "progress": { "step": "publish" }, "nextHint": "call again" }
// res 200 — finished at the review gate (default Phase 1 policy)
{ "done": true, "syncState": "review",
  "message": "Ready to publish — review the preview, then click Publish on eBay (goes live immediately)." }
// res 200 — published
{ "done": true, "syncState": "published", "listingId": "1234567890",
  "listingUrl": "https://www.ebay.com/itm/1234567890", "warnings": [] }
// res 200 — failed (HTTP 200; failure is a domain state, surfaced in body + ebay_listings.last_error)
{ "done": true, "syncState": "error",
  "error": { "code": "ebay_selling_limit",
             "message": "eBay's monthly selling limit would be exceeded. Request an increase in Seller Hub, then retry." } }
```

The **client loop** (admin drawer) keeps POSTing while `done: false`, same
contract as the Etsy drawer — even though eBay publishes usually complete in
one invocation, the loop makes bulk drain and any slow path uniform.

### `POST /api/admin/ebay/sync-batch` (Phase 2)

Identical envelope to Etsy's (`enqueue` / `enqueue-all-eligible` / `drain`,
`{ done, remaining, current, results }`), backed by
`claim_next_pending_ebay_listing()` ([08-database-schema.md](08-database-schema.md)).

### `GET/POST /api/webhooks/ebay-account-deletion` (Phase 0)

- **GET** `?challenge_code=…` → respond 200 `application/json`
  `{"challengeResponse": "<hex sha256(challengeCode + EBAY_VERIFICATION_TOKEN + endpointUrl)>"}`
  (hash order is mandated; endpoint URL string must match what's registered).
- **POST** (a deletion notification) → verify `x-ebay-signature` (Base64
  header → `kid` → Notification API `getPublicKey`, cached ~1h → ECDSA
  verify; 412 on failure) → insert `(provider='ebay', event_id=notificationId)`
  into `webhook_events` (duplicate ⇒ 200 and stop) → **ack 200 immediately**.
  Action needed on our side is minimal by design: we store no eBay buyer
  data, so the handler logs to `ebay_sync_log` (`action='account_deletion'`)
  and, if the deleted user ever matches our own connected seller account,
  clears the connection. Unacked notifications are re-sent and 24h of
  failures marks the endpoint down — this route must stay fast and
  dependency-light.

## Module layout behind the routes

```text
next-app/src/lib/ebay/
  client.ts     // fetch wrapper: bearer auth, Content-Language, error-envelope parsing,
                // throttle + 429/5xx backoff, typed EbayApiError, redacted logging
  auth.ts       // authorize URL (RuName), code exchange, single-flight refresh,
                // AES-GCM encrypt/decrypt, app-token (client-credentials) cache for Taxonomy reads
  mapping.ts    // Product -> InventoryItem + Offer payloads; category map; aspect tables;
                // condition; pre-flight checks; content-hash  (pure, unit-tested)
  sync.ts       // step machine + time-budgeted runner + queue drain + price-only mode
                // + handleProductStatusChange() eBay hook (Phase 2)
  store.ts      // typed access to ebay_connection / ebay_oauth_states / ebay_listings / ebay_sync_log
```

Routes stay thin (auth gate + parse + call `sync.ts`/`auth.ts` + shape the
response) — exactly how the Etsy routes lean on `lib/etsy/`.
