# 06 — Etsy Shop Prerequisites (one-time setup)

> Planning only. These are Etsy-side objects that must exist **before any
> listing can be activated**. Their IDs are stored once in `etsy_connection`
> defaults ([08-database-schema.md](08-database-schema.md)) and attached to
> every listing.

## What's required to activate a physical listing

| Object | Required? | Create via | Recommendation |
| --- | --- | --- | --- |
| Shop itself (onboarded, payments/billing set up) | Yes | Etsy UI only | Owner completes Etsy's own shop onboarding manually. The API cannot create a shop. |
| Shipping profile (`shipping_profile_id`) | Yes | API (`createShopShippingProfile`) or Etsy UI | **Manual first-time setup in Etsy UI**, then our app *reads* profiles via `getShopShippingProfiles` and the owner picks the default in `/admin/settings`. Shipping decisions (carrier, price, handling time, insured shipping for gold) are business decisions the Etsy UI explains better than an API payload we'd hardcode. |
| Return policy (`return_policy_id`) | Yes (region-dependent) | API (`createShopReturnPolicy`) or UI | Same: manual in UI (align with the site's `/returns-refunds` policy), read + pick in our admin. |
| Readiness state / processing time (`readiness_state_id`) | Yes | API or UI | Same: manual in UI ("ships in 1–2 business days" etc.), read + pick. |
| Shop sections (`shop_section_id`) | Optional | API (`createShopSection`) or UI | **API-create on demand**: our sync maps `product_type` → section name (Chains & Necklaces, Bracelets, Rings, …); if a section doesn't exist yet, create it once and cache the ID. Sections are cosmetic, low-risk, and per-type automation saves clicking. |
| Payment/billing onboarding | Yes | Etsy UI only | Owner task; blocks activation until done. |

Rationale for "manual create, API read": shipping/returns/readiness carry
legal and money consequences, exist as a handful of records created exactly
once, and the Etsy UI validates region-specific requirements we'd otherwise
have to re-implement. The integration's job is to **discover and attach**
them, and to hard-fail pre-flight with a clear message ("No shipping profile
selected — create one on Etsy, then choose it in Settings") when missing.

## Taxonomy strategy

- Fetch `getSellerTaxonomyNodes` once during development; select **leaf**
  `taxonomy_id`s for each `product_type` we sell and pin the map in
  `lib/etsy/mapping.ts` (with the node names in comments for auditability):

| `product_type` | Likely Etsy leaf (verify IDs at build time) |
| --- | --- |
| Necklace (+ `chain_type` set) | Jewelry > Necklaces > Chain Necklaces |
| Necklace (other) | Jewelry > Necklaces (appropriate leaf) |
| Bracelet | Jewelry > Bracelets > Chain & Link Bracelets |
| Ring | Jewelry > Rings (band/statement leaf per item) |
| Pendant / Charm | Jewelry > Necklaces > Pendants / Charms |
| Earrings | Jewelry > Earrings (leaf) |
| Brooch | Jewelry > Brooches |
| Cufflinks | Jewelry > Cufflinks & Tie Clips |
| Watch | Watches (leaf by style) |
| Coin / Bullion | Collectibles-side nodes — **included per Q7 decision (owner accepts policy risk)**; best-effort mapping, and an Etsy rejection surfaces as a per-item error without blocking the batch |
| Silverware | Home & Living > Kitchen & Dining (flatware leaves) |
| Other / unmapped | Sync blocked with pre-flight error; owner assigns a type first |

- Taxonomy nodes shift occasionally; the map is code-reviewed data, and an
  unknown `product_type` fails pre-flight rather than guessing.
- Per-leaf properties (`getPropertiesByTaxonomyId`) are fetched at build time
  for the pinned leaves to wire the best-effort property push
  ([02-field-mapping.md](02-field-mapping.md) §E).

## Domestic & Global Pricing caveat (GitHub issue #977)

If the shop enables Etsy's **Domestic & Global Pricing** (regional price
tiers), the v3 inventory API is known to be limited: it may expose only one
price and can overwrite regional tiers, and variation-structure changes are
blocked. Since our sync *is* an inventory-price writer, the plan is:

- **Owner keeps Domestic & Global Pricing OFF** for this shop (single USD
  price, as on the site). **Confirmed by owner 2026-07-08**
  ([13-open-questions.md](13-open-questions.md) Q6).
- Pre-flight/status check: if the API response shape ever indicates regional
  pricing is active, pause price pushes and surface an admin warning instead
  of silently clobbering tiers.

## Setup checklist (owner + developer, in order)

1. Owner: complete Etsy shop onboarding (billing, payments) — Etsy UI.
2. Owner: create shipping profile, return policy, processing/readiness
   profile — Etsy UI.
3. Owner: confirm Domestic & Global Pricing is off.
4. Wait for `naples-estate-jewelry-sync` app approval (currently pending).
5. Developer: register redirect URIs on the app ([04-oauth-and-secrets.md](04-oauth-and-secrets.md)).
6. Owner: **Connect Etsy** in `/admin/settings` (OAuth).
7. Admin settings panel: pick default shipping profile / return policy /
   readiness state from the fetched lists; stored in `etsy_connection`.
8. Developer: pin taxonomy map + verify `when_made` enum values against the
   live OpenAPI spec.
9. First dry-run ([14-verification-checklist.md](14-verification-checklist.md)).
