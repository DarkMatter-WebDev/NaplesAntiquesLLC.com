# 13 — Open Questions → DECIDED (owner, 2026-07-08)

> All 11 questions were answered by the owner on **2026-07-08**. The original
> reasoning is kept below each decision for context. Docs affected by
> non-default answers (Q2, Q7, Q8) have been updated in place.
> **No former blockers remain** — the Etsy app was approved 2026-07-08, so
> the only outstanding gate is the Phase 0 shop setup
> ([12-phased-rollout.md](12-phased-rollout.md)).

## Q1 — Auto-activate on Etsy, or draft-for-review?

**✅ Decision: draft-for-review.** Sync creates private drafts; the owner
reviews on Etsy (or via our admin) and activates. May flip to auto-activate
via the settings toggle once mapping is trusted (Phase 2).
*Context:* drafts cost nothing until published; auto-activate risk is a
mapping bug going public unreviewed.

## Q2 — Vintage eligibility for items labeled newer than 20 years (was 🔴 blocker)

**✅ Decision: owner attests ALL inventory is genuinely vintage — year labels
are what's wrong, not the items.** No item is blocked. At **push time only**
(database untouched, site Era/Year filter unaffected):

- `item_year` > 2006 (i.e. newer than the 20-year cutoff) **or missing** →
  `when_made: '1990s'` (the "default to 1999" rule).
- `item_year` ≤ 2006 → normal bucket mapping
  ([02-field-mapping.md](02-field-mapping.md) §C).
- The dry-run preview **flags every item that used the fallback** so real
  years can be corrected in Product Admin over time (fixing the year fixes
  the Etsy bucket on the next sync).

Compliance note: the fallback rests on the owner's attestation that these
pieces are genuinely 20+ years old ([15-compliance.md](15-compliance.md)).

## Q3 — Bilingual listings on Etsy (ES translations)?

**✅ Decision: English only for now.** Etsy's per-listing translation API can
be added later from `title_es`/`description_es` without rework; Etsy
machine-translates for buyers meanwhile.

## Q4 — Spot-price push frequency and threshold?

**✅ Decision: daily at a fixed hour, push only when |Δ| ≥ 1%** of the last
pushed price. Threshold/hour/on-off stay admin-editable settings. Etsy prices
lag the site by up to a day by design.

## Q5 — Price parity or Etsy-fee markup?

**✅ Decision: ~8% markup on Etsy** (`price_markup_pct = 8`, editable).
Applied only to the pushed Etsy price; site pricing untouched. Covers Etsy's
~6.5% transaction + ~3% processing + listing fees; the site stays the
visibly cheaper channel.

## Q6 — Domestic & Global Pricing (was 🔴 blocker)

**✅ Decision: confirmed — stays OFF.** Single USD price per listing. The app
still warns and pauses price pushes if it ever detects regional pricing
turned on (GitHub #977 API hazard, [06-shop-prerequisites.md](06-shop-prerequisites.md)).

## Q7 — Which products are Etsy-eligible?

**✅ Decision: everything `available` syncs — including Coin and Bullion.**
(Recommendation was jewelry-only; owner chose full catalog.) Consequences
baked into the plan:

- Coin/Bullion get best-effort taxonomy mapping
  ([06-shop-prerequisites.md](06-shop-prerequisites.md)); if Etsy rejects one
  at listing time (policy or taxonomy), it surfaces as a normal per-item
  error/warning — it never blocks the rest of a batch.
- Residual risk (owner-accepted): Etsy restricts some precious-metal/currency
  items; a rejected category stays site-only.
- No price ceiling. A per-product "Exclude from Etsy" flag remains a cheap
  later addition if ever wanted.

## Q8 — Existing manual listings on Etsy?

**✅ Decision: shop has a few unrelated old items — none of the site's
jewelry.** So: **no adopt/ignore reconciliation UI is built.** The sync only
ever operates on listings recorded in `etsy_listings` (its own creations), so
manual listings are structurally untouchable; the monthly audit
([14-verification-checklist.md](14-verification-checklist.md)) treats those
known manual items as expected strays, and the SKU-adoption guard
([11-error-handling.md](11-error-handling.md)) still protects against future
crash-window duplicates.

## Q9 — Delete vs deactivate when a product leaves the site?

**✅ Decision: deactivate, never auto-delete.** `deleteListing` remains an
explicit admin-confirmed action only.

## Q10 — Etsy sales before Phase 3 exists?

**✅ Decision: manual is fine short-term.** Owner marks Etsy-sold items sold
in Product Admin when Etsy notifies them (same as any offline sale). Phase 3
stays optional/deprioritized until volume argues otherwise.

## Q11 — Shipping/returns policy content on Etsy

**✅ Decision: mirror the site's policies** (`/shipping`,
`/returns-refunds`) when creating the shipping profile and return policy in
the Etsy UI during Phase 0 setup ([06-shop-prerequisites.md](06-shop-prerequisites.md)).
