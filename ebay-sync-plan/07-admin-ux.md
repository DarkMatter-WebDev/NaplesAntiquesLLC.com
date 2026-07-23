# 07 — Admin UX

> Planning only. Deliberately a **twin of the shipped Etsy admin surfaces**
> (`EtsySettingsPanel.tsx`, `EtsyProductPanel.tsx`, `EtsyBulkSyncModal.tsx`,
> per-row chips fed by one bulk local-DB read) so the owner learns nothing
> new. Same conventions: settings panels at `/admin/settings`, inventory work
> in Product Admin (`AdminShell.tsx`), English-only admin UI (existing
> convention), admin gating via the established profile check.

## Surfaces

### 1. `/admin/settings` → new **"eBay Sync"** panel (`EbaySettingsPanel.tsx`)

Connection block:

- **Not connected:** explainer + **Connect eBay** button (OAuth,
  [04-oauth-and-secrets.md](04-oauth-and-secrets.md)) + the prerequisite
  checklist ([06-account-prerequisites.md](06-account-prerequisites.md)) with
  live checkmarks where testable (policies found, location exists,
  business-policy opt-in active).
- **Connected:** account username, token health ("connected · renews
  automatically · **reconnect needed by <date>**" — the 18-month refresh
  expiry is shown here, a countdown Etsy didn't need), scopes, **Disconnect**
  (confirm dialog; explains listings stay on eBay).
- **Needs re-auth:** prominent amber banner + **Reconnect** (mirrored on the
  Product Admin page, same as the Etsy banner).

Defaults block (visible once connected):

- Dropdowns for default **shipping policy**, **payment policy**, **return
  policy** (fetched from the Account API) and the inventory-location display.
- **Selling-limit readout** from `getPrivileges` (items/month, $/month) —
  informational (the owner confirmed limits comfortably hold the catalog,
  Q14; the readout stays visible as a safety net).
- **Two shipping-policy dropdowns (added Q16, 2026-07-09):** "Standard
  shipping policy" (default: NEJ Insured Flat Rate) and "Express shipping
  policy (high-value items)" (default: NEJ Express High-Value), plus a
  "High-value threshold" $ input (seeded $1000, admin-editable) that
  controls which policy a listing's price routes to. Both pickers are
  fetched from the same `account-profiles` shipping-policy list as the
  standard one — no separate API surface needed.
- Sync policy controls (owner-editable, defaults = the Q decisions of
  2026-07-09, [13-open-questions.md](13-open-questions.md)): **review-first**
  (Q1; auto-publish is the Phase 2 trust toggle); **eBay price markup %**
  (admin-variable per Q2, seeded 15%) with an explicit **Save** button + the
  stale-prices callout + **Push prices to eBay now** button — the exact
  interaction pattern the Etsy panel settled on (markup save marks prices
  stale, gold-highlighted push button clears it); daily price push on/off +
  1% threshold (Q3); sold-item handling default **quantity-zero** (Q7);
  Best Offer toggle default **off** (Q9).
- Recent activity list (from `ebay_sync_log`) with per-row Retry, same as
  Etsy.

### 2. Product Admin (`/admin`) → per-product eBay column + drawer section

- New **eBay** status chip per row: `Not listed · Ready to publish · Live ·
  Out of date · Hidden (sold) · Ended · Error · Ineligible`. Fed by one bulk
  `/api/admin/ebay/listings` fetch (local DB read, no eBay calls), refreshed
  on mount, after drawer actions, and when the bulk modal closes — the
  exact staleness fixes the Etsy chips needed (session 9), inherited on day
  one. Sits next to the Etsy chip; both chips share row real estate, so the
  build should check the row layout still breathes with two channel chips.
- Drawer "eBay" section (`EbayProductPanel.tsx`):
  - **Preview (dry-run)** — exactly what would be pushed: final 80-char
    title, composed description snippet, aspects table (Metal, Purity, Type,
    Length/Ring size…), condition, category path (+ `approximate` flag +
    override select), price incl. the eBay markup, **which shipping policy
    this item resolves to** (standard vs express, with the compared price
    and threshold shown — Q16), image list, **estimated fees**
    (`getListingFees` when an unpublished offer exists — a nicety Etsy
    couldn't offer), plus pre-flight results incl. policy-eligibility
    (Fine vs Fashion metal rule) and the selling-limit note. No eBay writes.
  - **Sync to eBay** — runs the step machine with inline progress. In
    review-first mode it stops at "Ready to publish" and shows **Publish on
    eBay** as a distinct, deliberately-clicked button (the listing goes
    PUBLIC immediately — the button copy says so).
  - **Sync updates / Push price** — content-hash update + lean price-only
    push, mirroring Etsy.
  - **Hide / End on eBay / Restore** where applicable (Q7 verbs).
  - Link out to the live listing (`https://www.ebay.com/itm/<listingId>`).
  - Gated behind "save this listing first" for unsaved new products (same as
    Etsy).

### 3. Bulk actions (Phase 2) (`EbayBulkSyncModal.tsx`)

- Toolbar action **"Sync all to eBay"** with the same free pre-flight summary
  ("N eligible · N ineligible · N up to date · N errors", expandable lists —
  Coin/Bullion items appear under "ineligible" with the Q6 reason). A
  "blocked by selling limit" bucket appears only if the cached limit ever
  says the batch won't fit (not expected — Q14). Then enqueue + drain with
  live progress and stop-after-current cancel, identical to the Etsy modal.
- Filter chip in the product table: "eBay: out of date / error / not listed".

### 4. Sync activity (log view)

- "Recent eBay activity" list in the settings panel (from `ebay_sync_log`):
  time, product, action, result; errors show the operator-friendly message
  with **Retry** ([11-error-handling.md](11-error-handling.md)). Forensic
  detail stays in the DB row.

## Owner-visible language rules (unchanged from Etsy)

- Plain English, action-first: "eBay rejected this item — the category
  requires a Metal Purity value. Set the purity and retry." Never raw JSON or
  HTTP jargon in the chip/toast layer.
- Every error state has a next step (Retry / Fix the item / Reconnect /
  Choose policies / Request a selling-limit increase).
- Dry-run is always available and always free — the trust-building tool,
  doubly important here because **publishing is live immediately** (no
  Etsy-style private draft to eyeball on the platform first).

## What the admin UI never shows

- Tokens, Client ID/Cert ID (server-only).
- No eBay-sourced catalog editing — the drawer's eBay section is
  status/actions only; product fields are edited in the normal form and
  pushed outward.
