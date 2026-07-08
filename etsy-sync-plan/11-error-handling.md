# 11 — Error Handling & Idempotency

> Planning only. Companion to the state machine in
> [03-sync-lifecycle.md](03-sync-lifecycle.md) and the log/table design in
> [08-database-schema.md](08-database-schema.md).

## Principles

1. **Checkpoint before, verify after.** Every Etsy write is preceded by a DB
   read of the checkpoint (skip if done) and followed by a DB write of the
   result. A crash between the Etsy write and the DB write is the only
   dangerous window — each step has a reconcile answer for it (below).
2. **Errors are states, not exceptions.** A failed sync leaves
   `etsy_listings.sync_state='error'` + `last_error` + a log row; nothing is
   half-hidden in a server log the owner can't see.
3. **Retry only what's safe.** Transport-level failures (429/5xx/network)
   retry with backoff; semantic rejections (400/403/409) never auto-retry —
   they need a data fix or a human.
4. **Partial success is honest success.** "Listing live with 6 of 7 images
   (image 5 source missing)" beats an all-or-nothing failure for a manual
   secondary channel — warnings are first-class (`outcome='warning'`).

## Partial-failure playbook (crash-window reconciliation)

| Scenario | Detection | Recovery |
| --- | --- | --- |
| Draft created on Etsy, DB write lost (timeout right after `createDraftListing`) | `sync_state='pending'` but a listing may exist | On retry, before creating: `getListingsByShop(state=draft)` filtered by SKU — if a draft with our SKU exists, adopt it (save `etsy_listing_id`) instead of creating a duplicate. SKU-presence pre-flight makes this reliable. |
| Some images uploaded, then failure | `etsy_listing_images` rows exist for uploaded ones | Resume uploads only missing `source_key`s. For the crash window (uploaded on Etsy, no DB row): `getListingImages` once on resume and reconcile by rank/count before uploading. |
| Inventory set, activate failed | `sync_state='inventory_synced'` | Retry is just the activate call — `updateListing {state}` is naturally idempotent. |
| Update pushed, hash not saved | Listing correct on Etsy, hash stale | Next sync re-pushes identical payload — harmless (idempotent PUT/PATCH semantics), hash saved then. |
| Delist ran, product then deleted, mapping cascaded away | Orphaned inactive listing on Etsy | Delist step runs *before* delete in the guarded product-delete flow; log loudly if a mapping exists at delete time. Periodic manual audit ([14-verification-checklist.md](14-verification-checklist.md)) catches strays. |
| Etsy sale webhook processed, product write failed | `webhook_events` row exists, no product change | Log `outcome='error'` + admin notification; owner resolves manually (Phase 3 keeps human-in-the-loop for conflicts anyway). |

## Retry strategy

| Class | Examples | Policy |
| --- | --- | --- |
| Transient | 429, 500–503, network timeout | In-invocation: up to 3 tries, exponential backoff + jitter (1s/2s/4s). Across invocations: `error_count++`; the admin Retry button resumes from checkpoint. After 5 consecutive failed *invocations*, stop suggesting retry and show "persistent failure — see log". |
| Semantic | 400 (bad payload), 403 (scope/policy), 409 (state conflict) | No auto-retry. Map Etsy's error body to an operator message (table below), `sync_state='error'`. |
| Auth | 401, `invalid_grant` on refresh | Mark connection `needs_reauth`, banner in admin ([04-oauth-and-secrets.md](04-oauth-and-secrets.md)). Product-level state stays `pending` (not `error`) — the products are fine, the connection isn't. |
| Pre-flight | missing year, no images, price < $0.20, unmapped type | Never reaches Etsy. Shown in dry-run and blocks sync with a per-check message. |

## Error message mapping (operator-visible layer)

Raw Etsy error bodies land in `etsy_sync_log.detail` (redacted); the chip /
toast / `last_error` layer shows mapped English with a next step, e.g.:

| Etsy condition | Operator message |
| --- | --- |
| Price below minimum | "Etsy rejected the price (must be at least $0.20). Fix the price and retry." |
| Missing shipping profile | "No shipping profile is set. Choose one in Settings → Etsy Sync." |
| Taxonomy/property rejection | "Etsy didn't accept the category attributes for this item type. The listing is live; attributes were skipped." (warning) |
| Token expired / revoked | "Etsy connection expired — click Reconnect Etsy." |
| Vintage policy (pre-flight) | "Etsy only allows vintage items (20+ years old). Set the item's year, or exclude it from Etsy." |

## Idempotency inventory (why each step is safe to repeat)

| Step | Idempotency mechanism |
| --- | --- |
| Pre-flight / dry-run | Read-only |
| `createDraftListing` | SKU-adoption check before create (above) |
| `uploadListingImage` | `etsy_listing_images` unique `(etsy_listing_id, source_key)` + reconcile-on-resume |
| `updateListingInventory` / `updateListingProperty` / `updateListing` | Full-state PUT/PATCH — repeat writes converge |
| Delist / relist | State-targeting PATCH — repeat is a no-op |
| Webhook ingest | `webhook_events` unique `(provider, event_id)` |
| Queue drain | `sync_state` compare-and-set — two drainers can't grab the same product |

## Logging & observability

- Every step outcome → `etsy_sync_log` (action, outcome, message, redacted
  detail incl. Etsy error code + remaining-quota headers).
- **Redaction rule:** the client never logs `Authorization`/token material;
  `detail` is built from an allowlist of response fields, not a raw dump.
- Surfaced in admin: per-product chip + tooltip, settings-panel activity
  list, re-auth banner. Nothing important lives only in Netlify function
  logs.
- `error_count` + `sync_state='error'` filter chip = the owner's worklist.
