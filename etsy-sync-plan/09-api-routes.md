# 09 — Proposed Next.js Route Handlers

> Planning only. All under `next-app/src/app/api/`, TypeScript route
> handlers, following the PayPal family and `/api/admin/*` conventions.
> Every `/api/admin/etsy/*` route: verify signed-in Supabase user is admin
> (same gate as `/api/admin/ai-settings`) → then act with the service-role
> client. JSON in/out; errors as `{ error: { code, message } }` with
> operator-friendly `message`.

## Route map

| Route | Method | Auth | Purpose |
| --- | --- | --- | --- |
| `/api/admin/etsy/connect` | GET | admin | Start OAuth: create state+PKCE row, 302 to Etsy consent ([04](04-oauth-and-secrets.md)) |
| `/api/admin/etsy/callback` | GET | admin + `state` | Code exchange, resolve shop, persist `etsy_connection`, redirect to `/admin/settings?etsy=connected` |
| `/api/admin/etsy/status` | GET | admin | Connection status, shop info, defaults, policy flags, prerequisite checklist |
| `/api/admin/etsy/disconnect` | POST | admin | Clear tokens (confirm in UI first) |
| `/api/admin/etsy/settings` | PUT | admin | Save defaults + sync policy (shipping/return/readiness IDs, auto-activate, price-push settings) |
| `/api/admin/etsy/shop-profiles` | GET | admin | Proxy-read shipping profiles / return policies / readiness states for the settings dropdowns |
| `/api/admin/etsy/preview` | POST | admin | **Dry-run**: `{ productId }` → mapped payload + pre-flight results. No Etsy writes. |
| `/api/admin/etsy/sync` | POST | admin | Run sync steps for one product with a time budget; resumable |
| `/api/admin/etsy/sync-batch` | POST | admin | Phase 2: enqueue many / drain queue with time budget |
| `/api/admin/etsy/delist` | POST | admin | Deactivate (or reactivate) a linked listing |
| `/api/webhooks/etsy` | POST | Etsy signature | Phase 3: order events; idempotent via `webhook_events` |

Scheduled price push (Phase 2) is an invocation concern, not a new public
route: a Netlify Scheduled Function (or an external cron hitting a
secret-token-guarded internal route) that calls the same `sync` engine in
price-only mode — decide at implementation time; the engine is trigger-
agnostic ([03-sync-lifecycle.md](03-sync-lifecycle.md)).

## Key request/response shapes

### `POST /api/admin/etsy/preview`

```jsonc
// req
{ "productId": "uuid" }
// res 200
{
  "eligible": false,
  "preflight": [
    { "check": "item_year",  "ok": false, "message": "No item year set — Etsy requires vintage (20+ years)" },
    { "check": "images",     "ok": true  },
    { "check": "price",      "ok": true, "value": 1234.00 }
  ],
  "payload": {                     // what WOULD be pushed (mapper output)
    "title": "…", "tags": ["…"], "materials": ["…"],
    "whenMade": "1980s", "taxonomyPath": "Jewelry > Necklaces > Chain Necklaces",
    "price": 1234.00, "quantity": 1,
    "images": [ { "sourceUrl": "…", "rank": 1, "action": "upload" } ]
  }
}
```

### `POST /api/admin/etsy/sync`

```jsonc
// req
{ "productId": "uuid", "mode": "publish" }   // 'publish' | 'update' | 'price-only'
// res 200 — bounded work done, call again
{
  "done": false,
  "syncState": "draft_created",
  "progress": { "step": "images", "uploaded": 3, "total": 7 },
  "nextHint": "call again"
}
// res 200 — finished
{ "done": true, "syncState": "draft_review", "listingId": 123456789,
  "listingUrl": "https://www.etsy.com/listing/123456789", "warnings": ["Image 5 source returned 404 — skipped"] }
// res 200 — failed (HTTP 200; failure is a domain state, surfaced in body + etsy_listings.last_error)
{ "done": true, "syncState": "error",
  "error": { "code": "etsy_price_min", "message": "Etsy rejected the price (must be at least $0.20)" } }
```

The **client loop** (admin drawer) keeps POSTing while `done: false` — this is
the Netlify-timeout workaround: each invocation does ≤ ~8s of work
([03-sync-lifecycle.md](03-sync-lifecycle.md)). Route also re-checks the
time budget between images.

### `POST /api/admin/etsy/sync-batch` (Phase 2)

```jsonc
// req — enqueue
{ "action": "enqueue", "productIds": ["…"] }        // or { "action": "enqueue-all-eligible" }
// req — drain
{ "action": "drain" }
// res
{ "done": false, "remaining": 31,
  "current": { "productId": "…", "step": "images", "uploaded": 2, "total": 6 },
  "results": [ { "productId": "…", "syncState": "active" } ] }
```

### `POST /api/webhooks/etsy` (Phase 3)

- Verify Etsy's webhook signature (shared secret / webhook secret per Etsy
  docs at build time); reject on mismatch (401).
- Insert `(provider='etsy', event_id)` into `webhook_events`; duplicate ⇒
  200 immediately (idempotent, PayPal-webhook pattern).
- `order.paid` ⇒ fetch receipt (`getShopReceipt`), match transactions to
  products via `etsy_listings.etsy_listing_id` + `sku` cross-check, apply the
  site-sale semantics (qty−1 / `sold`), `revalidateTag('shop-catalog',
  { expire: 0 })`, log. Conflict ⇒ admin notification.
- Always 200 fast; heavy work is small here (one receipt), but if Etsy's
  delivery timeout demands it, ACK-then-process can be added later.

## Module layout behind the routes

```text
next-app/src/lib/etsy/
  client.ts     // fetch wrapper: x-api-key + bearer, 5 QPS throttle, 429/5xx backoff, typed EtsyError
  auth.ts       // PKCE helpers, token exchange/refresh/rotation, encrypt/decrypt, connection store
  mapping.ts    // Product -> Etsy payloads; taxonomy map; when_made buckets; pre-flight checks
  images.ts     // fetch bytes, transcode WebP->JPEG, upload, reconcile etsy_listing_images
  sync.ts       // step machine + time-budgeted runner + queue drain + price-only mode
  store.ts      // typed access to etsy_connection / etsy_listings / etsy_listing_images / etsy_sync_log
```

Routes stay thin (auth gate + parse + call `sync.ts`/`auth.ts` + shape the
response), mirroring how the PayPal routes lean on `src/lib/paypal.ts`.
