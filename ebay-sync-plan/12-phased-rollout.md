# 12 — Phased Rollout

> Planning only. Each phase ships alone, is verifiable alone, and has exit
> criteria. Nothing in a later phase is a prerequisite for an earlier one.
> Mirrors the Etsy rollout that worked (Phases 0–2 live; its Phase 3
> deliberately unbuilt).

## Phase 0 — Prerequisites (no sync code)

**Scope**

- ~~Owner answers [13-open-questions.md](13-open-questions.md)~~ — **done
  2026-07-09**, all 16 decided (incl. the non-defaults: coins/bullion
  excluded, selling limits confirmed a non-issue, and Q16's price-tiered
  express shipping added mid-session); see that file.
- ~~eBay Developers Program registration + Production/Sandbox keysets~~ —
  **done 2026-07-09**, confirmed live under the app "PostnSync" on the
  **owner's existing eBay account** (Q13); see
  [OWNER-SETUP.md](OWNER-SETUP.md) step 1.
- **Account-deletion notification endpoint** built + deployed + verified
  (challenge echo, test notification) → production keyset activates. This is
  the one piece of app code in Phase 0, and it's channel-independent
  plumbing ([15-compliance.md](15-compliance.md), [09](09-api-routes.md)).
  **Still needed** — the Production keyset is confirmed live but disabled
  pending this step.
- RuNames configured; Netlify env vars set (names in [04](04-oauth-and-secrets.md)).
- ~~Owner: seller-account readiness — business policies created in Seller
  Hub~~ — **done 2026-07-09**: all four policies (two shipping tiers per
  Q8a/Q16, one return per Q8b, one payment per Q8c) are live; see
  [OWNER-SETUP.md](OWNER-SETUP.md) step 7. (Selling limits already confirmed
  sufficient — Q14.)
- Developer: `OUT_OF_STOCK_CONTROL` opt-in (Q7) + inventory location
  ([06-account-prerequisites.md](06-account-prerequisites.md)).
- Developer: pin category map, aspect tables, condition IDs from live
  Taxonomy/Metadata calls; resolve every `TODO(ebay-verify)` in this plan
  (fee schedule, bulkUpdatePriceQuantity batching shape, Cert-ID-rotation
  token survival, localhost RuName rules, Authenticity Guarantee threshold).

**Exit criteria:** production keyset active; owner can create one manual
test listing end-to-end in Seller Hub (proves account standing + policies);
~~open questions answered~~ ✅ (2026-07-09); env vars set;
category/aspect/condition tables pinned with sources.

## Phase 1 — MVP: connect + single-product manual sync (review-first)

**Scope**

- Supabase migration (`ebay_connection`, `ebay_oauth_states`,
  `ebay_listings`, `ebay_sync_log`, claim RPC) — flagged loudly as a manual
  SQL step per project convention.
- `lib/ebay/` client + auth + mapping + sync (single product) + store.
- Routes: connect / callback / status / disconnect / settings /
  account-profiles / preview / sync / delist / listings / verify-listing.
- Admin: eBay Sync settings panel; per-product eBay chip + drawer section
  with **dry-run preview** and **Sync to eBay** stopping at the **review
  gate**, then an explicit **Publish on eBay** button; manual
  hide/withdraw/restore.
- Policy defaults: review-first (no auto-publish), no scheduled price push,
  no auto-delist — everything owner-triggered.
- Unit tests on `mapping.ts` (title truncation, aspects, condition,
  category eligibility, price+markup, allowlist guarantee) — the Etsy test
  suite's shape.

**Explicitly out:** bulk sync, scheduling, order ingest, Best Offer,
store categories.

**Exit criteria:** owner connects the account from `/admin/settings`;
dry-run on 5+ products spanning cases (spot-priced chain, manual-priced
item, ring with size-in-`length`, vermeil item showing Fashion Jewelry
routing per Q4, a coin/bullion item showing clean Q6 ineligibility, a
silverware item per Q6b, **and one item priced over $1000 showing it
resolves to the "NEJ Express High-Value" policy instead of the standard
one per Q16**) shows correct payloads; **one real
product published end-to-end** and verified live on ebay.com (photos in
order, price/aspects/condition right); a sold-on-site item hidden/withdrawn
with one click; error paths demonstrated (missing purity blocked at
pre-flight with a clear message; a selling-limit rejection mapped
readably); `npm run build` + `npm run lint` + tests clean; docs updated
(`project-docs/` + a new `features/ebay-sync.md` distilled from this
folder).

## Phase 2 — Bulk + automation

**Scope**

- Bulk queue + drain (`sync-batch`), pre-flight summary UI (incl. the
  selling-limit bucket), progress, cancel; "eBay: out of date / error"
  product filters; verify-all reconciliation button.
- Content-hash incremental updates ("Sync updates" per product and for all
  out-of-date).
- **Auto-hide/withdraw on sold/archived** hooked into the existing
  product-status chokepoints **next to the Etsy calls** (PayPal
  `capture-order`, `adminUpdateProductStatus`, `adminRevalidateProduct(s)`
  call sites) + restore on return-to-available.
- **Scheduled spot price push** (daily, threshold-gated,
  `bulkUpdatePriceQuantity`) via the same scheduling mechanism the Etsy
  price push uses (one scheduler, two channel invocations — decide at build
  time whether one Netlify Scheduled Function calls both).
- Compliance sweep (`getListingViolationsSummary`) surfacing
  `ASPECTS_ADOPTION` drift as warnings.
- Log retention housekeeping.

**Exit criteria:** full eligible catalog (everything `available` except
Coin/Bullion — Q6) published in one supervised "Sync all" session with zero
duplicate listings (SKU audit via `getOffers`/listing count); a product
edit propagates via "Sync
updates" only where the hash changed; a PayPal sale on the site
hides/withdraws the eBay listing without human action (verified live);
price push observed changing an eBay price after a >1% spot move and
skipping on a quiet day; a full week of unattended operation with no
`error`-state surprises on either channel.

## Phase 3 — Optional: eBay order ingest (polling)

> **Q15 decision (2026-07-09): deferred — manual is fine.** The owner marks
> eBay-sold items sold in Product Admin (the Phase 2 hooks then auto-hide
> them on both channels). This phase stays specced but unscheduled until
> volume argues otherwise — same posture as the Etsy plan's Phase 3, which
> was never built.

**Scope**

- Re-consent adding `sell.fulfillment.readonly`.
- `orders-poll` route (cron-secret-guarded) + cursor in `ebay_connection`;
  SKU match; site-sale semantics (qty−1 / sold / revalidate); conflict →
  admin notification ([03-sync-lifecycle.md](03-sync-lifecycle.md) Flow 4).
- Admin notification surface for "Sold on eBay" and conflicts.

**Explicitly out (Phase 4 candidates):** eBay orders in our `orders` table /
unified invoicing; tracking upload (`createShippingFulfillment`);
ORDER_CONFIRMATION push notifications as a latency optimization; Best Offer
automation; Promoted Listings.

**Exit criteria:** a real (cheap-item) eBay sale flips the product to `sold`
on the site within one poll interval and drops it from `/shop`; the
double-sale conflict path produces the admin notification (simulate by
marking the item sold on-site first, then replaying the poll); duplicate
poll runs proven idempotent.

## Sequencing rationale

- **Review-first before automation** — even more important than on Etsy,
  because publish is public immediately; the mapping earns trust with the
  owner's eyeballs on real live listings before anything acts unattended.
- **Delist automation (Phase 2) lands before order ingest (Phase 3)** — the
  costly failure is overselling a one-of-a-kind piece on eBay after a site
  sale; eBay buyers can pay instantly (immediatePay), so the hide hook has
  more value than faster order awareness.
- Each phase's Supabase changes are additive; no destructive migrations
  anywhere in the plan.
- The Etsy channel is untouched until Phase 2's chokepoint hooks, and even
  then only by adding a sibling call — both channels remain independently
  disableable.
