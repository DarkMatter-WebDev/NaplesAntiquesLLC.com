# 13 — Open Questions → DECIDED (owner, 2026-07-09)

> Q1–Q15 (plus two sub-questions) were answered by the owner on
> **2026-07-09**, the same day the plan was written. **Q16 was added later
> the same day**, mid-session, after Phase 0 Seller Hub setup was already
> underway live. The original reasoning is kept below each decision for
> context. Docs affected by non-default answers (Q6 — coins/bullion
> excluded; Q14 — selling limits confirmed a non-issue; Q16 — new feature)
> have been updated in place. **Remaining gate before build:** the build
> itself — Phase 0's manual setup (`OWNER-SETUP.md` steps 1 and 7) is
> already done live against the real eBay account.

## Q1 — Publish immediately, or review-first?

**✅ Decision: review-first.** Sync prepares everything (inventory item +
unpublished offer + fee estimate) and stops at "Ready to publish"; the owner
reviews the dry-run preview and clicks an explicit **Publish on eBay** button
per item. May flip to auto-publish via the settings toggle once mapping is
trusted (Phase 2) — same trust path as Etsy's draft-for-review →
auto-activate.
*Context:* eBay has **no draft state** — `publishOffer` is live and buyable
immediately, and unpublished Inventory-API offers aren't visible in Seller
Hub, so our preview is the only review surface.

## Q2 — eBay price markup

**✅ Decision: admin-variable markup, changeable anytime in
`/admin/settings` — exactly like the (updated) Etsy implementation** (markup
field + explicit Save + stale-prices callout + "Push prices to eBay now"
button). Seeded default **15%** so the first sync roughly covers eBay's
~13–15% + ~$0.30 final value fee; the owner tunes it from there. Applied
only to the pushed eBay price; site pricing untouched; the site stays the
visibly cheapest channel.

## Q3 — Spot-price push frequency and threshold?

**✅ Decision: same as Etsy** — daily at a fixed hour, push only when |Δ| ≥
1% of the last pushed price; threshold/hour/on-off admin-editable. One
mental model across both channels; eBay prices lag the site by up to a day
by design. Mechanism: `bulkUpdatePriceQuantity`
([03-sync-lifecycle.md](03-sync-lifecycle.md)).

## Q4 — Where do vermeil / plated items go?

**✅ Decision: Fashion Jewelry.** eBay's jewelry policy bars plated/vermeil
from Fine Jewelry (solid 925+/9K+/850+ only); `metal_variant='vermeil'`
items route automatically to Fashion Jewelry leaves, clearly shown in the
dry-run. All solid gold/sterling/platinum pieces map to Fine Jewelry.

**✅ Q4b sub-decision: modern Fine Jewelry leaves** (Fine Necklaces &
Pendants / Fine Rings / Fine Earrings / Fine Bracelets & Charms), not the
Vintage & Antique subtree — highest-traffic categories; `item_year` rides as
an aspect + description detail. Revisit if placement disappoints.

## Q5 — Condition value and wording

**✅ Decision: all jewelry pushes as `USED_EXCELLENT` (condition ID 3000,
displays "Pre-owned") with one standard `conditionDescription` template**,
e.g. "Estate piece in excellent pre-owned condition. Please review photos
for detail." (final wording confirmed at build time in the dry-run). No
per-item condition authoring.

## Q6 — Are Coin and Bullion items eBay-eligible? (non-default answer)

**✅ Decision: NO — jewelry (and watches and silverware) only; Coin and
Bullion stay site/Etsy-only.** (Recommendation was include-best-effort,
mirroring Etsy Q7; owner chose the narrower catalog for eBay.) Consequences
baked into the plan:

- Pre-flight marks `product_type` Coin/Bullion **ineligible** with a clear
  reason ("Coins and bullion are not synced to eBay per owner decision");
  they count in the bulk pre-flight's "ineligible" bucket, never as errors.
- The entire coin condition regime (Graded/Ungraded + condition
  descriptors), the $2,500 ungraded price cap, and the bullion
  photo/fineness/mint policy handling are **out of scope** — noted as
  historical context only in [02-field-mapping.md](02-field-mapping.md) and
  [15-compliance.md](15-compliance.md).
- A cheap per-product "Include on eBay anyway" override is NOT built;
  reversing this decision later means updating the eligibility rule + the
  category map (small, isolated change in `mapping.ts`).

**✅ Q6b sub-decision: Silverware/Sterling IS included.** "Jewelry only"
means: every `available` product **except Coin and Bullion**. Silverware
maps to eBay's silver/flatware categories with the same `approximate: true`
dry-run flagging the Etsy build used.

## Q7 — Sold on site → hide (quantity 0) or end (withdraw)?

**✅ Decision: quantity-zero + Out-of-Stock Control.** Sold items go hidden
(listing ID, watchers, history preserved; instant revival on
restock/cancel). `withdrawOffer` remains the verb for archived/deleted
products. The `OUT_OF_STOCK_CONTROL` program opt-in is a Phase 0 setup step
([06-account-prerequisites.md](06-account-prerequisites.md)).

## Q8 — Business-policy content

**✅ Decisions (all three parts):**

- **Q8a Shipping: flat-rate, insured + signature confirmation, 1–2 business
  day handling.** No package weights/dimensions in payloads. Signature/
  tracking on high-value items is also what eBay seller protection hinges
  on.
- **Q8b Returns: 30-day returns, buyer pays return shipping** (chosen over
  strictly mirroring the site policy — helps eBay placement and buyer
  trust). The Seller Hub policy content should still be written consistently
  with the spirit of `/returns-refunds`.
- **Q8c Payment: immediate payment required ON** — mirrors the site's
  no-reservation "whoever pays first" checkout; no unpaid-item limbo on
  one-of-a-kind pieces.

## Q9 — Best Offer on or off?

**✅ Decision: OFF initially.** Fixed price only, like the site and Etsy.
Revisit after the channel proves out; if ever enabled, auto-decline below
`minimum_price` × markup (server-side only, never displayed) is the natural
wiring.

## Q10 — Account-deletion notifications: subscribe or opt out?

**✅ Decision: subscribe.** The Phase 0 endpoint
(`/api/webhooks/ebay-account-deletion`, challenge echo + signature verify +
ack) gets built — it's the production-keyset activation gate anyway, and it
removes the compliance cliff Phase 3 would otherwise create (the opt-out's
"not persisting eBay data" claim would age into falsehood).

## Q11 — SKU key on eBay

**✅ Decision: `ebay_sku = products.id`** (36-char stable unique text,
within eBay's 50-char cap). Deterministic eBay-side identity — duplicates
are structurally impossible, and no dependency on `inventory_number`
presence. Buyer-invisible; Seller Hub shows the technical ID, accepted.

## Q12 — eBay Store subscription?

**✅ Decision: no, not initially.** The free ~250 zero-insertion-fee
monthly allocation covers the catalog several times over. Re-run the
fee-savings math after real eBay sales data; subscribing later needs no code
change (`storeCategoryNames` stays unused until then).

## Q13 — Whose eBay account, and its standing?

**✅ Decision: the owner's existing eBay account**, which has **a few
unrelated active listings**. Developer-program registration and the OAuth
connection both live under it (same ownership pattern as the Etsy app).
Consequences:

- **No adopt/ignore reconciliation UI is built** (same as Etsy Q8): the sync
  only ever operates on listings recorded in `ebay_listings` (its own
  creations, keyed by its own SKUs), so manual listings are structurally
  untouchable; the monthly audit
  ([14-verification-checklist.md](14-verification-checklist.md)) treats them
  as expected strays.
- Established account = real selling history, which is also why Q14 landed
  the way it did.

## Q14 — Selling-limit strategy for the initial publish (non-default answer)

**✅ Decision: not a concern — the owner confirmed the account's monthly
limits can hold the full catalog easily.** No limit-increase request, no
publish-priority ordering. Kept as cheap safety nets anyway (they cost
nothing): the `getPrivileges` snapshot in the settings panel, the pre-flight
limit note, and the mapped operator message if eBay ever rejects on limits
([11-error-handling.md](11-error-handling.md)) — but the plan no longer
treats limits as a Phase 0 gate or bulk-publish constraint.

## Q15 — Phase 3 (eBay order ingest) — wanted at all?

**✅ Decision: defer — manual is fine** (same as Etsy Q10). The owner marks
eBay-sold items sold in Product Admin when eBay notifies them; the Phase 2
hooks then auto-hide the item on **both** eBay and Etsy. Phase 3 (15-minute
`getOrders` polling) stays specced and optional until volume argues
otherwise.

## Q16 — Added 2026-07-09: price-tiered express shipping for high-value items

**Context:** raised by the owner after Q1–Q15 were already decided and
Phase 0 Seller Hub setup was underway live. Not part of the original
research/plan — a genuine scope addition.

**✅ Decision: yes, build it.** Items whose computed eBay price exceeds an
**admin-editable threshold** (seeded **$1000**) use a **second shipping
policy** — `NEJ Express High-Value` (FedEx 2Day, $50 flat, 1 business day
handling) — instead of the standard `NEJ Insured Flat Rate` policy. Both
policies already exist live on the eBay account
([OWNER-SETUP.md](OWNER-SETUP.md) step 7).

**Architecture, confirmed with the owner:** eBay's Business Policies have
**no conditional/price-based logic** — a shipping policy is just a static
object. So the decision of *which* policy to attach happens entirely on
**our side**, in `lib/ebay/mapping.ts`, at the moment we build the offer
payload: compute the price (existing spot/manual flattening + markup) →
compare to the threshold → set
`offer.listingPolicies.fulfillmentPolicyId` to the express policy ID if
over threshold, else the standard policy ID. This is a pure mapping-time
branch, not a new API call — same shape as the existing category/aspect
resolution logic. Content-hash change detection ([03](03-sync-lifecycle.md))
must include the resolved policy ID so a price crossing the threshold
after initial publish triggers an update push.

**Storage:** two new `ebay_connection` columns —
`express_fulfillment_policy_id` (text) and
`high_value_shipping_threshold` (numeric, default `1000`) — both
admin-editable in Settings → eBay Sync, alongside the existing markup %
field. No shipping-cost dollar amounts are stored on our side; the $50 rate
lives entirely in the eBay-side policy object.

**Not decided / left as future refinement:** whether a third tier is ever
wanted (e.g., a $5000+ tier), and whether the threshold should also
consider the item's `product_type` (a $1000 ring vs. a $1000 necklace both
get the same treatment today — no type-based branching planned).
