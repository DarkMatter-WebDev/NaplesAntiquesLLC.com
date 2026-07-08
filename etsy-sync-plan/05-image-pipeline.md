# 05 — Image Pipeline

> Planning only. Etsy does not accept "fetch this URL" — our server must
> download the bytes and POST them as multipart binary to
> `uploadListingImage`, one call per image.

## Source of truth for images

- `products.image_urls[]` (preferred; `images[]` is the legacy mirror — the
  admin save path writes both, so `image_urls` is sufficient).
- Two URL shapes exist today:
  - **Supabase Storage public URLs** (bucket `product-images`, path
    `products/…`) — new uploads, already WebP, browser-compressed.
  - **Legacy local paths** `/assets/...` served from
    `next-app/public/assets/...` — also WebP after the 2026-06 PNG migration.
- Array order is display order; index 0 is the primary photo. Etsy `rank`
  mirrors the index (rank 1 = primary).

## The WebP problem

Etsy accepts **JPEG / PNG / GIF** for listing images — **not WebP** — and the
entire catalog is WebP. So the pipeline must transcode server-side:

```text
image_urls[i]
  → fetch bytes
      Storage URL → HTTPS GET of the public object
      /assets/…   → HTTPS GET of https://naplesestatejewelry.co/assets/…
                    (works identically in dev/prod; avoids fs coupling to the
                     serverless bundle, where public/ files are not on disk)
  → sniff format (don't trust extensions)
  → WebP/other → JPEG, quality ~90, sRGB
  → enforce Etsy constraints:
      longest edge ≥ ~2000px ideal (upscaling NOT recommended — flag small
      sources as warnings instead), max dimensions/file size per Etsy docs
      (verify exact caps in the OpenAPI/docs at build time; stay < 20MB)
  → POST uploadListingImage (multipart) with rank
  → record { product_id, listing_id, source_url, source_key,
             etsy_listing_image_id, rank } in etsy_listing_images
```

Transcoding library: `sharp` is the natural choice and is already part of the
Next/Netlify image stack; confirm it resolves inside Netlify functions at
implementation time (fallback: `jimp`, pure-JS, slower but dependency-free).
JPEG background for any WebP alpha: white.

`image_padding` / `image_padding_by_image` are **not** applied — Etsy shows
the raw photo. If the owner wants the padded look on Etsy later, the
transcoder can composite the padding color; out of MVP scope
([02-field-mapping.md](02-field-mapping.md) §D).

## Change detection & re-upload

Key insight: **the app never mutates image bytes at a URL** — crop/replace in
Product Admin uploads a *new* Storage object and repoints the row (old object
is GC'd). So **URL identity is a reliable change signal**; no byte-hashing of
remote objects needed.

Per sync, diff `products.image_urls` against `etsy_listing_images` rows for
that listing:

| Diff | Action | Cost |
| --- | --- | --- |
| URL present in product, no mapping row | fetch → transcode → `uploadListingImage` | 1 call |
| Mapping row exists, URL gone from product | `deleteListingImage` | 1 call |
| URL unchanged, index changed | re-rank. Etsy has no cheap reorder-only call for an existing image — plan: re-upload at new rank + delete old (2 calls/image), so the mapper should treat pure reorders as a low-priority change and batch them with other edits. **Verify at build time** whether `updateListing`/image endpoints allow rank updates without re-upload; if they do, this drops to 1 cheap call. | 1–2 calls |
| URL and index unchanged | nothing | 0 |

`source_key` (bucket path or asset path) is stored alongside the full URL so a
domain change doesn't read as "every image changed".

Additionally store a `bytes_sha256` computed **during upload** (we have the
bytes in hand anyway) — costs nothing, and gives a future escape hatch if a
URL-stable mutation path ever appears.

## Ordering & the primary image

- Upload sequentially in array order with explicit `rank` (1-based). Etsy's
  primary image = rank 1 = our index 0 (the same photo the shop card and
  carousel treat as primary).
- Sequential (not parallel) uploads: keeps us politely under 5 QPS, keeps
  memory flat (one decoded image at a time), and makes checkpoint/resume
  trivial ([03-sync-lifecycle.md](03-sync-lifecycle.md)).

## Per-image cost model

| Item | Cost |
| --- | --- |
| API calls | 1 per new/changed image (+1 per deletion) |
| Wall-clock per image | ~1–3s (fetch ~0.3s + transcode ~0.5–1.5s for multi-MP WebP + upload ~0.5–1s) |
| Catalog estimate | 48 products × ~6.7 images avg (321 entries) ≈ **~322 upload calls** for a full initial publish |

At ~2s/image, a full catalog image pass is ~11 minutes of processing — far
beyond one Netlify invocation, which is exactly why images are checkpointed
per-image and driven by repeated short invocations
([03-sync-lifecycle.md](03-sync-lifecycle.md), [10-rate-limits-and-quotas.md](10-rate-limits-and-quotas.md)).
Budget ≤ 3–4 images per invocation to stay safely inside a 10s function
timeout.

## Failure modes

| Failure | Handling (detail in [11-error-handling.md](11-error-handling.md)) |
| --- | --- |
| Source URL 404 (stale row) | Skip + record per-image error; sync completes with warning "listing live with N−1 images". |
| Transcode failure (corrupt file) | Same as 404. |
| Etsy 429 / 5xx mid-set | Backoff + retry; checkpointing means already-uploaded images are never re-sent. |
| >10 images on product | Etsy caps 10/listing: push first 10 by order, log a visible warning. |
| Timeout mid-image | The image without a mapping row is retried next invocation; `uploadListingImage` duplicates are possible in the crash window — on resume, list listing images once (`getListingImages`) and reconcile before re-uploading. |
