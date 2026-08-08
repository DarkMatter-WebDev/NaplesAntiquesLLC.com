# Feature: Deep Field Gallery Product Sync

## Summary

A **one-way, server-side push** of the product catalog from Naples Estate
Jewelry (NEJ) to **Deep Field Gallery**, a separate site with its own database
and Supabase project.

- **NEJ pushes; Deep Field pulls nothing.** NEJ POSTs product payloads to a
  Deep Field HTTP receiver and never touches the Deep Field database, storage,
  or SQL.
- **Credential boundary is one shared bearer token.** NEJ holds no Deep Field
  Supabase key; Deep Field holds no NEJ key. Neither side's service role crosses
  the line.
- **Fire-and-forget.** Every call site is best-effort and non-throwing. A Deep
  Field outage must never fail a customer's payment or block an admin save.
- **Inert until configured.** With `DEEPFIELD_SYNC_URL` / `DEEPFIELD_SYNC_TOKEN`
  unset, `syncProductsToDeepField` returns immediately and nothing is sent.

Deep Field owns its own database writes, image copying, pricing validation, and
audit/storage verification.

## Key Files

- `next-app/src/lib/deepfield/payload.ts` — pure, I/O-free payload construction:
  the field allow-list, image URL absolutization, and price resolution. Unit
  tested in `src/lib/__tests__/deepfield-payload.test.ts`.
- `next-app/src/lib/deepfield/sync.ts` — transport. Service-role read, batching,
  the POST, and the non-throwing `queueDeepFieldSync` entry point.

## Call Sites (the three chokepoints)

Every path that can change product state fires the sync:

| Location | Covers |
|---|---|
| `src/app/actions/admin-products.ts` → `adminRevalidateProducts` | bulk status changes, order flows |
| `src/app/actions/admin-products.ts` → `adminRevalidateProduct` | single create/edit/archive/delete |
| `src/app/api/paypal/capture-order/route.ts` | checkout sold-flip |
| `src/app/api/paypal/webhook/route.ts` | sold-flip backstop when the browser never confirms |

The checkout hooks are **not** redundant with the admin ones. The sold flip
happens inside the `capture_paypal_order` Postgres function, so no application
code observes it — `adminRevalidateProduct(s)` is never called on that path.
Hooking only the admin chokepoint would leave Deep Field showing sold items as
available. This mirrors exactly how Etsy and eBay already hook in.

Verified against the schema: with the no-reservation checkout, **only**
`capture_paypal_order` writes product `status`/`quantity`. Denials, cancels, and
refunds do not touch `products`, so they need no hook. A refund that should
re-list an item goes through the admin status change, which is covered.

## Payload Contract

**Durable key is `products.id`.** Never `sku` — `sku = "21"` is on two different
products. `inventory_number` is genuinely unique if a secondary key is wanted.

**53 catalog fields + 5 derived price fields.** The field list is an
**allow-list** (`DEEPFIELD_PRODUCT_FIELDS`), so a column added to `products`
later is excluded by default rather than silently shipped to another company.

Never sent, enforced twice — absent from the allow-list, and asserted against
`DEEPFIELD_FORBIDDEN_FIELDS` which throws rather than leaks:

`cost_basis`, `minimum_price`, `private_price_label`, `live_spot_snapshot`,
`acquisition_date`, `acquisition_source`, `internal_notes`, `reserved_until`,
`reserved_order_id`.

Also excluded: **`price_label`** — a dead legacy column. Nothing renders it and
every save writes null, but stale values survive on ~19 rows including `"$0.00"`
on a product that sells for $450. Sending it invites a wrong price downstream.

Archived products are never pushed — `archived` is NEJ's soft-delete.

## Pricing (the part that must not diverge)

Deep Field computes spot pricing **on its own side**; NEJ ships both the inputs
and a fallback snapshot.

Resolution order, matching the storefront exactly (`src/lib/pricing.ts` is
imported rather than reimplemented, so the two cannot drift):

1. **Sold lock** — a non-available product with `sold_price` is frozen there.
2. **Manual** — parse `manual_price_label`.
3. **Spot multiplier** — `meltValue × pricing_multiplier`, where
   `meltValue = grams × purityFraction × (spotPerOz / 31.1034768)`.

Roughly **60 of 128** products are spot-multiplier with *no stored price of any
kind* — the price exists only as a render-time computation. `pricing_multiplier`,
`purity`, `gram_weight`, `weight_grams`, `category`, and `price_mode` are all
shipped so Deep Field can compute live.

Derived fields (namespaced `nej_` so they are never confused with columns):
`nej_price_usd`, `nej_price_source` (`spot|manual|sold_lock`),
`nej_melt_value_usd`, `nej_spot_snapshot`, `nej_price_unavailable_reason`.

**Fail-closed on spot.** When live metal pricing is unavailable, a spot-priced
product ships a **null** price plus a reason — never a fallback-rate guess.
Shipping a fabricated number into another company's storefront is worse than
shipping none. Same rule `getMarketplaceSpotPriceError` already enforces for
Etsy/eBay. Manual and sold-locked prices are unaffected, so a spot outage
degrades rather than blocks.

## Images

- Absolute Supabase Storage URLs pass through untouched.
- Site-relative `/assets/...` paths (113 of 974 refs) are rewritten to
  `https://naplesestatejewelry.com/assets/...` and **percent-encoded per
  segment** — a few filenames contain spaces and parentheses.
- Already-absolute URLs are **never** re-encoded, or an escaped URL would
  double-escape.
- Deep Field copies the bytes into its own bucket. Hotlinking would break:
  NEJ hard-deletes storage objects once no NEJ product references them, and the
  storage-GC reference scan does not know Deep Field exists.

## Configuration

Server-only environment variables, set in Netlify. **No `NEXT_PUBLIC_` prefix** —
that is what keeps the token out of the browser bundle.

| Variable | Meaning |
|---|---|
| `DEEPFIELD_SYNC_URL` | receiver endpoint, e.g. `https://deepfieldgallery.com/api/integrations/naples/products` |
| `DEEPFIELD_SYNC_TOKEN` | shared bearer token issued by Deep Field |
| `DEEPFIELD_SYNC_DRY_RUN` | optional. `true` → send `dryRun: true, copyImages: false`; anything else → live |

**These belong to NEJ, not Deep Field.** NEJ is the sender and the only side that
reads them. Deep Field holds the same secret under its own name
(`NAPLES_PRODUCT_SYNC_SECRET`) and compares against it, so
`DEEPFIELD_SYNC_TOKEN` must carry that identical value.

URL and token unset → the sync no-ops. This is the safe default and is how the
code behaves until deliberately configured.

### Testing with production parity

`DEEPFIELD_SYNC_DRY_RUN=true` exercises the **entire** path — service-role read,
payload build, field-policy assert, batching, auth, HTTP round trip — while
telling the receiver to validate and discard. Verified against the live
receiver: dry run returns `imageCopyMode: "dry_run"` with `copiedImageCount: 0`
and `wouldCopyImageCount: 9`; live returns `"copied"` with the inverse.

Only the exact string `true` (any case) enables it. `1`, `yes`, and an empty
value all mean live — the flag fails toward normal behavior, so a typo cannot
silently disable a production sync.

**Why this exists:** local dev shares production's Supabase database, so an
admin save in dev is a real product change. Without the flag, pointing dev at
the live receiver to test the hooks would write real rows and copy real images
into the live gallery.

Recommended per environment:

| NEJ environment | `DEEPFIELD_SYNC_URL` | `DEEPFIELD_SYNC_DRY_RUN` |
|---|---|---|
| Netlify Production | production Deep Field | unset |
| Netlify Deploy Previews / Branch | production Deep Field | `true` |
| Local `.env.local` | `http://127.0.0.1:3000/...` | unset (local receiver, safe to write) |
| Local, pointed at production | production Deep Field | **`true` — mandatory** |

## Gotchas

- **Batch cap is 25**, enforced by the receiver. `BATCH_SIZE` must not exceed it.
- **A full batch takes minutes** because Deep Field copies every image before
  responding. Node's `fetch` (undici) has a hard **5-minute header timeout** that
  is not adjustable without the undici Agent API; the one-off import script hit
  `HeadersTimeoutError` on live requests the server was still processing. The
  in-app sync sets a 5-minute `AbortController` deliberately — it is
  fire-and-forget, so an abort costs nothing, and a hung socket should not leak.
- **Deletes leave no tombstone.** NEJ supports a hard delete, so a periodic
  full-id reconciliation is the only way Deep Field learns about removals.
  `updated_at` (maintained by a `BEFORE UPDATE` trigger, so it bumps on every
  write including the in-database sold flip) is a sound watermark for everything
  else.
- Do not add a `NEXT_PUBLIC_` variant of the token under any circumstances.

## Status

**Initial bulk import: complete.** 128 products / 974 images delivered to the
local Deep Field receiver in 6 batches, all HTTP 200, 0 failed, 128/128 ids
acknowledged with `destinationProductId === sourceProductId`. One transient
`502 Bad Gateway` on a single image was fixed by re-sending that product.

**Live hooks: code complete, unconfigured.** The env vars are not yet set, so
the hooks are inert. Nothing has been pushed to production Deep Field.
