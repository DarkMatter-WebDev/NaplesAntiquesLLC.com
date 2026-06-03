# Image optimization — 3 groups

One preset per group in **XnConvert**. Goal: smaller files, **no visible change**.  
Shop listings (Group 3) stay **same pixel dimensions, same format (PNG), lossless only**.

## Status

| Group | Folder | Files | You |
|-------|--------|------|-----|
| 1 Branding | `assets/images/branding/` | 2 | Done |
| 2 Pages | `assets/images/pages/` | 15 | 2A done (10 JPEGs) — finish rest in one run below |
| 3 Shop listings | `assets/images/shop/` | 116 | **Careful run** — settings below |

## Output folders (use every time)

Save each group to:

- `optimized-output/group1-branding/`
- `optimized-output/group2-pages/`
- `optimized-output/group3-shop/`

Then deploy back to the live paths:

```powershell
cd C:\Users\rcman\OneDrive\Documents\EstateJewelry
powershell -File tools/deploy-optimized-images.ps1 -Group 3
```

(Dry run first: add `-WhatIf`.)

---

## Group 1 — Branding (done)

Logos: **PNG max** or **WebP lossless**, no resize. Already completed.

---

## Group 2 — Pages (one run for everything left)

**Input:** All files in `assets/images/pages/` (or remaining copies in `all-site-images` whose names contain `pages`).

### Actions

1. **Resize** → Fit into **2400 × 2400**, **Reduce only**, resample **Lanczos**.
2. Nothing else.

### Output

| Setting | Value |
|---------|--------|
| Format | **WebP** |
| WebP settings | **Quality 90**, not lossless, method **6** |
| Filename | `{Filename}.webp` → outputs `gold.webp`, etc. |
| Destination | `optimized-output/group2-pages/` |

**After deploy:** Site paths must use `.webp` for those files (we can batch-update HTML + `shop-products.js` only for pages, not shop).

If you already replaced JPEGs in place as `.jpg`, skip re-processing those; only run files still `.png`/`.jpeg`.

---

## Group 3 — Shop listings (strict — no visual change)

**Input:** All of `assets/images/shop/*.png` and `*.jpg` (116 files).

### Actions

**[0/0] — do not add resize, sharpen, blur, or color changes.**

### Output

| Setting | Value |
|---------|--------|
| Format | **PNG** (for `.png`) / **JPEG** (for `.jpg`) — **same as original**, not WebP |
| PNG settings | **Compression level: max (9)** |
| JPEG settings | **Quality: 92** (only for the 2 `.jpg` shop files) |
| Filename | `{Filename}` — **no `_result` suffix** |
| Destination | `optimized-output/group3-shop/` |
| Keep if larger | **On** |

This is **lossless PNG** / high-JPEG only — listing photos look identical on the site; only file size changes.

**Do not** use WebP lossy or resize on shop images.

### Check (2 minutes)

1. Open one chain PNG before/after in XnConvert or browser at **100% zoom**.
2. Deploy Group 3, hard-refresh **Shop** and one **product** page.
3. Confirm gallery and detail images match prior look.

---

## Optional: “good enough” single preset (not for shop)

Do **not** use this on `assets/images/shop/`. Acceptable for non-listing assets only: WebP quality **88**, resize **1600** long edge, reduce only.

---

## Deploy script

`tools/deploy-optimized-images.ps1` copies optimized files onto `assets/images/...` using the same relative path as the source file, with backups under `optimized-output/backups/`.

```powershell
powershell -File tools/deploy-optimized-images.ps1 -Group 2
powershell -File tools/deploy-optimized-images.ps1 -Group 3
```

## Regenerate staging copies

```powershell
# Rebuild all-site-images/ after live assets change
powershell -File tools/copy-all-site-images.ps1
```
