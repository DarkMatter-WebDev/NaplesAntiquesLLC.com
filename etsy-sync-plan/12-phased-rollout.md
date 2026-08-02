# 12 — Phased Rollout

> Planning only. Each phase ships alone, is verifiable alone, and has exit
> criteria. Nothing in a later phase is a prerequisite for an earlier one.

## Phase 0 — Prerequisites (no app code)

**Scope**

- ~~Etsy app approval lands~~ — **✅ approved 2026-07-08**
  (`naples-estate-jewelry-sync`).
- Owner completes Etsy shop onboarding + shipping profile, return policy,
  readiness state in the Etsy UI; confirms Domestic & Global Pricing is OFF
  ([06-shop-prerequisites.md](06-shop-prerequisites.md)).
- ~~Owner answers [13-open-questions.md](13-open-questions.md)~~ — **done
  2026-07-08**, all 11 decided (incl. former blockers Q2 and Q6); see that
  file for the decisions.
- Developer: register redirect URIs; pull the live OpenAPI spec and verify
  `when_made` enums, image constraints, rate-limit header names; pin the
  taxonomy map.
- Set Netlify env vars (names in [04-oauth-and-secrets.md](04-oauth-and-secrets.md)).

**Exit criteria:** app approved; shop activatable by hand (owner can create
one manual test listing in the Etsy UI end-to-end); ~~open questions
answered~~ ✅ (2026-07-08); env vars set.

## Phase 1 — MVP: connect + single-product manual sync

**Scope**

- Supabase migration (`etsy_connection`, `etsy_oauth_states`,
  `etsy_listings`, `etsy_listing_images`, `etsy_sync_log`) — flagged loudly
  as a manual SQL step per project convention.
- `lib/etsy/` client + auth + mapping + images + sync (single product).
- Routes: connect / callback / status / disconnect / settings /
  shop-profiles / preview / sync / delist.
- Admin: Etsy Sync settings panel; per-product Etsy chip + drawer section
  with **dry-run preview** and **Sync to Etsy**; manual delist/reactivate
  buttons.
- Policy defaults: **draft-for-review** (no auto-activate), no scheduled
  price push, no auto-delist — everything owner-triggered.

**Explicitly out:** bulk sync, scheduling, webhooks, translations.

**Exit criteria:** owner connects the shop from `/admin/settings`; dry-run on
5+ products shows correct payloads; **one real product synced end-to-end**
(draft on Etsy with correct photos/price/attributes), owner reviews on Etsy
and activates; a sold-on-site item is delisted with one click; error path
demonstrated (e.g. a product with no images blocked at pre-flight with a
clear message, and a no-year product visibly flagged with the `1990s`
fallback); `npm run build` + `npm run lint` clean; docs updated
(`project-docs/` + a new `features/etsy-sync.md` distilled from this folder).

## Phase 2 — Bulk + automation

**Scope**

- Bulk queue + drain (`sync-batch`), pre-flight summary UI, progress,
  cancel; "Etsy: out of date / error" product filters.
- Content-hash incremental updates ("Sync updates" per product and for all
  out-of-date).
- **Auto-delist on sold/archived** hooked into the existing product-status
  chokepoints (PayPal capture, `adminUpdateProductStatus`,
  `adminRevalidateProduct(s)` call sites) + relist on return-to-available.
- **Scheduled spot price push** (daily, threshold-gated) via Netlify
  Scheduled Function; also keeps the refresh token warm.
- Log retention housekeeping; quota-headroom logging.

**Exit criteria:** full catalog published in one supervised "Sync all"
session with zero duplicate listings; a product edit (price, photo swap,
title) propagates via "Sync updates" only where the hash changed; a PayPal
sale on the site deactivates the Etsy listing without human action (verified
live); price push observed changing an Etsy price after a >1% spot move and
skipping on a quiet day; a full week of unattended operation with no
`error`-state surprises.

## Phase 3 — Optional: Etsy order ingest

**Scope**

- Re-consent with `transactions_r`; webhook registration
  (`order.paid`, `order.canceled`).
- `/api/webhooks/etsy`: signature verify, `webhook_events` idempotency,
  receipt fetch, SKU/listing match, site-sale semantics (qty−1 / sold /
  revalidate), conflict → admin notification.
- Admin notification surface for "Sold on Etsy" and "Conflict — sold in both
  places, refund one buyer".

**Explicitly out (Phase 4 candidates, only if ever wanted):** Etsy orders in
our `orders` table / unified invoicing; mark-shipped from our admin
(`transactions_w`); listing translations (ES); videos.

**Exit criteria:** a real (or $0.20-test-item) Etsy sale flips the product to
`sold` on the site within seconds and drops it from `/shop`; the double-sale
conflict path produces the admin notification (simulate by marking the item
sold on-site first, then replaying a receipt); duplicate webhook delivery
proven idempotent.

## Sequencing rationale

- Draft-for-review before automation: the field mapping earns trust with the
  owner's eyeballs on real listings before anything acts unattended.
- Delist automation (Phase 2) lands before order ingest (Phase 3): the
  costly failure is overselling a one-of-a-kind piece on Etsy after a site
  sale — automation there has more value than order ingest, which webhooks
  merely accelerate versus the Etsy app's own notifications.
- Each phase's Supabase changes are additive; no destructive migrations
  anywhere in the plan.
