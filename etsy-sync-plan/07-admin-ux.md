# 07 — Admin UX

> Planning only. Follows existing admin patterns: settings panels live at
> `/admin/settings` (like "Store Carousel Hero" and "AI Listing Assistant
> Prompt"), inventory work happens in Product Admin (`AdminShell.tsx`), admin
> gating via the established admin profile check.

## Surfaces

### 1. `/admin/settings` → new **"Etsy Sync"** panel

Connection block:

- **Not connected:** explainer + **Connect Etsy** button (starts OAuth,
  [04-oauth-and-secrets.md](04-oauth-and-secrets.md)). Shows the required
  Etsy-side prerequisites as a checklist ([06-shop-prerequisites.md](06-shop-prerequisites.md)).
- **Connected:** shop name, shop ID, token health ("connected · auto-renews"),
  scopes, **Disconnect** (confirm dialog; explains listings stay on Etsy).
- **Needs re-auth:** prominent amber banner + **Reconnect** (also mirrored as
  a banner on the Product Admin page so it can't be missed).

Defaults block (visible once connected):

- Dropdowns for default **shipping profile**, **return policy**,
  **readiness state** (fetched from Etsy), section-mapping toggle.
- Sync policy controls (owner-editable, defaults per
  [13-open-questions.md](13-open-questions.md)): auto-activate vs
  draft-for-review; daily price push on/off + threshold %; auto-delist on
  sold on/off (Phase 2).
- Etsy trademark attribution line displayed on this panel
  ([15-compliance.md](15-compliance.md)).

### 2. Product Admin (`/admin`) → per-product Etsy column + drawer section

- New **Etsy** status chip per row: `Not listed · Draft on Etsy · Active ·
  Out of date · Needs delist · Error · Ineligible`. Chip tooltip = last sync
  time or error summary; click opens the drawer's Etsy section.
- Drawer "Etsy" section for the open product:
  - **Preview (dry-run)** — renders exactly what would be pushed (title,
    truncated tags, materials, price incl. the 8% Etsy markup, `when_made`,
    taxonomy path, image list) plus pre-flight results, **without any Etsy
    write**. Items using the `1990s` year fallback carry a visible flag
    ("Year missing/mislabeled — pushed as 1990s; set the real year to fix"),
    and remaining ineligible items say why (e.g. no image, no price).
  - **Sync to Etsy / Sync updates** — runs the step machine with inline
    progress ("Uploading image 3 of 7…"), driven by repeated route calls
    ([03-sync-lifecycle.md](03-sync-lifecycle.md)).
  - **Deactivate on Etsy / Reactivate** where applicable.
  - Link out to the live/draft listing on etsy.com.

### 3. Bulk actions (Phase 2)

- Toolbar action **"Sync all to Etsy"** with a pre-flight summary first:
  "32 eligible · 9 ineligible (no year) · 4 already up to date · 3 errors" —
  expandable lists per bucket, then confirm. Progress bar with per-product
  results as the queue drains; cancel stops after the in-flight product.
- Filter chip in the product table: "Etsy: out of date / error / not listed".

### 4. Sync activity (log view)

- Small "Recent Etsy activity" list (from `etsy_sync_log`) in the settings
  panel: time, product, action, result. Errors show the operator-friendly
  message with a **Retry** button ([11-error-handling.md](11-error-handling.md)).
  Full forensic detail stays in the DB row.

## Owner-visible language rules

- Plain English, action-first: "Etsy rejected the price (must be at least
  $0.20)" — never raw JSON or HTTP jargon in the chip/toast layer.
- Every error state has a next step (Retry / Fix item year / Reconnect /
  Choose a shipping profile).
- Dry-run is always available and always free (no writes, minimal reads) —
  it's the trust-building tool for the first weeks.

## What the admin UI never shows

- Tokens, keystring, shared secret (server-only).
- No Etsy-sourced catalog editing — the drawer's Etsy section is
  status/actions only; product fields are edited in the normal form and
  pushed outward.
