# Shipping Tiers Plan (IMPLEMENTED 2026-07-30)

> **Status: the checkout portion AND the Etsy/eBay extension are implemented**
> (see `CHANGELOG.md` 2026-07-30 entries). `next-app/src/lib/
> checkout-shipping.ts` carries the tier tables; the standard method's
> buyer-facing label is "Insured Shipping" / "Envío asegurado" (it is
> Registered Mail, not Priority, at $5,000+).
>
> **Marketplace extension (built, awaiting owner provisioning):** one Etsy
> shipping profile / eBay FLAT_RATE fulfillment policy per distinct tier fee
> ($19/$25/$29/$35/$59/$99/$165 — the two $99 checkout bands share one
> marketplace object), named "NEJ Insured Shipping $N", created idempotently
> by the "Provision tiered shipping" actions in Settings → Etsy Sync /
> eBay Sync and mapped in the `marketplace_shipping_profiles` table
> (`supabase/marketplace-shipping-tiers-2026-07.sql`, **not yet applied**).
> Listing resolution: eBay prefers the tier policy and keeps it in the
> content hash (boundary crossings flag out_of_date); Etsy applies the tier
> profile at draft creation and reconciles it on update/price paths (PATCH
> only on real change). Every path falls back to the legacy single
> default profile/policy until provisioned. Owner runbook is in `TASKS.md`.
> Phase 2 (Parcel Pro / JM Shipping / FedEx DVA) remains deferred. The
> planning content below is retained as the rationale and cost basis.

> Planning/audit document, revised **2026-07-30 v2** after owner direction:
> tiers must charge the full expected shipping cost **plus a cushion** (no
> out-of-pocket), ShipStation/USPS commercial pricing is the cost baseline,
> the usual package is a small Priority flat-rate box (ships from ZIP
> 34116, Naples FL), no free-shipping threshold, and specialty accounts
> (Parcel Pro / JM Shipping / FedEx Declared Value Advantage) are deferred
> to a later phase. Nothing here is implemented; the live catalog remains
> `next-app/src/lib/checkout-shipping.ts` (Local Pickup $0, Priority
> Insured $45, Express Overnight Insured $75).

## Why the current structure fails

Live inventory audit (2026-07-30, 90 available items): cheapest $49,
most expensive $34,999, median $599. The flat $45 fee is 92% of the
cheapest item's price, under-recovers insurance above ~$2,500, and cannot
fully insure the six $5,000+ items because USPS Priority/Express insurance
caps at $5,000.

| Band | Items |
|---|---|
| Under $100 | 14 |
| $100–$249 | 16 |
| $250–$499 | 10 |
| $500–$999 | 20 |
| $1,000–$2,499 | 18 |
| $2,500–$4,999 | 6 |
| $5,000–$9,999 | 4 |
| $10,000+ | 2 (Rolexes $23,995 / $34,999) |

## Verified rates (July 2026)

**Postage (ShipStation commercial where available):**

- Priority Mail small flat-rate box: **$11.20 commercial** ($12.65 retail).
- Priority Mail Express flat-rate envelope $31.11 / padded $31.70
  commercial; zone-priced Express boxes from 34116 can reach ~$50 to far
  zones. Express includes signature.
- Signature Confirmation add-on: $3.95 ($9.70 adult).
- Registered Mail is **retail/counter only** — it cannot be printed through
  ShipStation.

**Insurance (USPS carrier insurance — the schedule that matters):**

- $100 included on Priority and Express; additional coverage purchasable
  only to **$5,000**: up to $8.95 at $600 declared, then $8.95 + $1.50 per
  $100 (≈$14.95 @ $1,000 · $37.45 @ $2,500 · $74.95 @ $5,000).
- Registered Mail: $40.50 through $5,000 declared + $3.10 per $1,000 above,
  to $50,000 (USPS Notice 123). Chain-of-custody, signature service
  inherent, 2–10 business days, no guaranteed date.

**⚠️ Coverage traps confirmed during research:**

1. **ShipStation's built-in insurance (Shipsurance / ParcelGuard) excludes
   jewelry and watches.** Claims on jewelry insured that way are denied.
   For jewelry the insurance selected in ShipStation must be **USPS carrier
   insurance**, at the USPS schedule above.
2. **Standard FedEx caps jewelry/watch liability at $1,000** regardless of
   declared value paid. Shipping a $3,000 watch on ordinary FedEx with
   declared value gives $1,000 recovery at best. The exception (Declared
   Value Advantage, to $100K) is a contract program for business accounts
   shipping jewelry ~2–3×/week — bundled into the deferred Phase 2 with
   Parcel Pro / JM Shipping.

## Proposed tiers v2 (no-out-of-pocket + cushion)

Keyed to the order's merchandise subtotal. Buyers only ever see the fee for
their own order, so the tier count costs nothing in UX. Worst-case cost =
top of band, commercial small flat-rate box postage, USPS carrier
insurance, $3.95 signature (kept in every Priority band as conservatism;
Express and Registered include signature).

**Standard Insured** (USPS Priority; USPS Registered Mail at $5,000+):

| Order subtotal | Worst-case cost | Charge | Cushion |
|---|---|---|---|
| Under $100 | ~$15.15 | **$19** | ~25% |
| $100–$249 | ~$20.75 | **$25** | ~20% |
| $250–$599 | ~$24.10 | **$29** | ~20% |
| $600–$999 | ~$30.10 | **$35** | ~16% |
| $1,000–$2,499 | ~$52.60 | **$59** | ~12% |
| $2,500–$4,999 | ~$90.10 | **$99** | ~10% |
| $5,000–$14,999 | ~$84.15 (Registered, retail) | **$99** | ~18% |
| $15,000+ | ~$146.15 (Registered @ $34,999) | **$165** | ~13% |

Notes: the $5,000–$14,999 tier costs *less* than the $2,500–$4,999 tier
because Registered's insurance is far cheaper than Priority's — both are
priced $99 so no buyer-visible inversion exists. The $15,000+ charge covers
declared values to roughly $41K; re-verify if any future item exceeds
$40,000 (Registered's absolute cap is $50,000). Owner MAY voluntarily ship
a time-flexible $2,500–$4,999 order via Registered (~$56 cost) and keep the
difference as extra cushion.

**Express Overnight Insured** (USPS Priority Mail Express, padded
flat-rate envelope $31.70 commercial — owner confirmed 2026-07-30 that all
shipments fit it, normally with a thin box inside):

| Order subtotal | Worst-case cost | Charge | Cushion |
|---|---|---|---|
| Under $1,000 | ~$46.65 | **$55** | ~18% |
| $1,000–$2,499 | ~$69.15 | **$79** | ~14% |
| $2,500–$4,999 | ~$106.65 | **$119** | ~12% |
| $5,000+ | uninsurable (USPS $5,000 cap) | **not offered** | — |

Express charges still rise vs the current flat $75 above $2,500 because
that price loses money once insurance is priced honestly. Residual risk:
if a rare item cannot close the envelope flap and needs a zone-priced
Express box (~$50 to far zones), the tier cushion absorbs most of the
difference; the worst rare case is ≈$10 out of pocket on the lowest
Express tier.

**Packaging rules verified (USPS DMM):**

- A rigid thin box **inside a flat-rate envelope is allowed** up to 70 lbs,
  provided the flap closes within its normal folds. Tape may reinforce the
  flap/seams but must not extend or reconstruct the envelope; a bulging
  forced-shut envelope gets reclassified and re-priced as a parcel.
- **Registered Mail cannot use padded envelopes, Tyvek/plastic mailers, or
  glossy-coated packaging**, and self-sealing closures/plastic tape are not
  acceptable. $5,000+ shipments must use a plain sturdy box (or plain kraft
  envelope) sealed with water-activated kraft paper tape (≥60-lb basis) so
  postmarks can span every seam. Registered postage is then zone-priced
  Priority (~$12–15 retail for a light box), reflected in the Standard
  $5,000+ tier costs (worst cases ≈$86.50 at $14,999 and ≈$148.50 at
  $34,999 — charges unchanged).

**Local Pickup:** unchanged, $0.

**$5,000+ speed:** Registered Mail (2–10 days) is the only fully insured
option in the USPS-only phase. A faster insured option at $5,000+ —
Parcel Pro / JM Shipping over FedEx/UPS overnight, or FedEx Declared Value
Advantage — is Phase 2, pending owner account setup and quotes.

## Implementation impact (when approved — NOT started)

- `checkout-shipping.ts` stays the single catalog; fee lookup becomes
  value-aware (`getCheckoutShippingFee(method, merchandiseSubtotal)`).
  Consumers already funnel through it: `OrderSummary`, `CartDrawer`
  estimate, `checkout-pricing.ts#buildOrderDraft`, create-order route.
- `buildOrderDraft` must resolve the fee **after** computing the subtotal
  (currently resolves it before loading products).
- Express at $5,000+ must be hidden client-side and rejected server-side
  with a clear message (never silently substituted).
- Standard-tier fulfillment method switches at $5,000 (Priority →
  Registered); buyer-facing labels/ETAs must say "insured shipping,
  2–10 business days" style wording at $5,000+, in both locales.
- No DB migration: `shipping_method` stays `'pickup' | 'shipping'`; the
  charged fee still snapshots into `orders.shipping_fee`.
- FL tax (on merchandise + charged shipping), PayPal breakdown, and the
  create-order reuse/total-revalidation path consume the computed fee
  unchanged.
- Tests: tier boundaries ($99.99/$100, $4,999.99/$5,000), Express-over-cap
  rejection, and updated shipping/pricing suites.

## Remaining owner decisions

1. Approve/adjust the v2 tier boundaries and charges above (Express now
   priced on the padded flat-rate envelope per the owner's 2026-07-30
   packaging confirmation).
2. Accept the coverage/packaging rules operationally: never insure jewelry
   through ShipStation's ParcelGuard/Shipsurance; never declare more than
   $1,000 on standard FedEx for jewelry/watches; ship Registered ($5,000+)
   in plain boxes with kraft paper tape, never padded/flat-rate packaging.
3. Phase 2 (deferred): Parcel Pro / JM Shipping / FedEx Declared Value
   Advantage evaluation for cheaper high-value insurance and fast $5,000+
   shipping.
