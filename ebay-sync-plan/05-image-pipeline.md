# 05 — Image Handling (URL handoff — no upload pipeline)

> Planning only. The single biggest simplification vs the Etsy build: eBay's
> Inventory API takes `product.imageUrls[]` — an array of externally
> accessible HTTPS URLs — and **eBay itself fetches and copies them to eBay
> Picture Services (EPS)** at listing time. Our server never downloads,
> transcodes, or uploads a single image byte.

## Source of truth for images (unchanged from Etsy)

- `products.image_urls[]` (preferred; `images[]` is the legacy mirror — the
  admin save path writes both).
- Two URL shapes exist today:
  - **Supabase Storage public URLs** (bucket `product-images`, path
    `products/…`) — already public HTTPS: usable verbatim.
  - **Legacy local paths** `/assets/...` — resolved to
    `https://naplesestatejewelry.co/assets/...` via the same
    `resolveImageUrl()`-against-`getSiteUrl()` logic the Etsy build needed
    (Node fetch has no implicit origin; here it's eBay's fetcher that needs
    the absolute URL, so relative paths must still be absolutized).
- Array order is display order; **index 0 = first `imageUrls` entry = the
  eBay gallery (primary) image** — same photo the shop card treats as
  primary.

## Why the WebP problem disappears

Etsy accepts only JPEG/PNG/GIF, forcing a sharp-based WebP→JPEG transcode
pipeline. **EPS accepts WebP directly** (documented accepted formats include
JPG, PNG, GIF, BMP, TIFF, AVIF, HEIC, and WEBP), so the entire catalog's
WebP assets pass through untouched.

## eBay image constraints (validate in pre-flight, no processing)

| Constraint | Value | Our exposure |
| --- | --- | --- |
| Protocol | HTTPS only | Both URL shapes are HTTPS after absolutization ✅ |
| Max images per listing | 24 | Catalog max is ~10 — never hit ✅ |
| Min size | 500px longest side (1600px recommended for zoom) | New uploads cap at ~2048px longest edge (project optimization default) ✅; a few small legacy images may warn — **pre-flight warns, never blocks** (mirrors the Etsy `computeUploadWarnings` approach) |
| Max file size | 12MB | Site images are ≤ ~400KB WebP ✅ |
| Reachability | eBay must be able to GET the URL at publish/revise time | Pre-flight optionally HEADs each URL (cheap, our own origin) to catch stale 404 rows before eBay does |

`image_padding` / `image_padding_by_image` are **not** applied — eBay shows
the raw photo, same accepted trade-off as Etsy ([02](02-field-mapping.md) §A).

## Change detection & updates

The Etsy build's key insight carries over verbatim: **the app never mutates
image bytes at a URL** — crop/replace in Product Admin uploads a *new*
Storage object and repoints the row. So **URL-list identity (values + order)
is a complete change signal**, and it simply participates in the overall
`content_hash` ([03-sync-lifecycle.md](03-sync-lifecycle.md)):

| Diff | Action | Cost |
| --- | --- | --- |
| Any change to the `image_urls` array (add / remove / reorder / replace) | re-`createOrReplaceInventoryItem` with the new full `imageUrls` list — the live listing revises automatically | **1 call total**, regardless of how many images changed |
| No change | hash unchanged → nothing | 0 |

No per-image mapping table, no rank bookkeeping, no crash-window image
reconciliation — `ebay_listing_images` (the analog of `etsy_listing_images`)
**does not exist** in this design ([08-database-schema.md](08-database-schema.md)).

Because eBay copies to EPS, a *deleted* Storage object doesn't break an
already-published listing (EPS holds its own copy) — but it would break the
next full item PUT (eBay re-fetches on revise). The existing Storage-GC
reference-scan rule applies: **`ebay_listings` content (via `products.image_urls`)
adds no new GC reference set** since we only ever reference live product
URLs, but the GC docs should note that revising an eBay listing re-reads
current `image_urls` (already guaranteed fresh by definition).

## Fallback path (only if URL ingestion ever fails)

If eBay's fetcher is ever blocked from our origin (CDN rules, bot
protection) or a format edge case appears, the documented fallback is the
**Media API** (`apim.ebay.com/commerce/media/v1_beta`):
`createImageFromUrl` (eBay pulls) or `createImageFromFile` (we push
multipart) → `getImage` returns an EPS URL to use in `imageUrls`. Quotas are
generous (1M/day, 50 POSTs/5s). EPS URLs unused in any listing for 30+ days
are purged — only relevant to the fallback path, where upload should happen
in the same sync step as the item PUT. **Not built in MVP**; recorded so a
blocked-fetch failure has a known escape hatch instead of a redesign.

## Failure modes

| Failure | Handling (detail in [11-error-handling.md](11-error-handling.md)) |
| --- | --- |
| Source URL 404 (stale row) | Pre-flight HEAD warns; if eBay rejects at publish (image fetch failure surfaces as a publish error), map to "Image N unreachable — fix the product photos and retry". Never silently drop an image (owner sees exactly what would be pushed in dry-run). |
| Image below 500px | Publish error from eBay → mapped message; pre-flight warned beforehand. |
| eBay ingestion slow/flaky | It's inside eBay's publish call — our retry/backoff on the publish step covers it. |
| >24 images | Impossible today; pre-flight caps and warns if it ever happens. |
