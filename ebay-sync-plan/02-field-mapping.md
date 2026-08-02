# 02 — Field Mapping: Supabase `products` → eBay

> Planning only. Contract source: `next-app/src/types/product.ts` (our side)
> and the Sell Inventory API v1 contract (their side; limits below are from
> eBay's published OpenAPI contract and doc pages — re-verify at build time).
> All transforms live in one place: proposed `next-app/src/lib/ebay/mapping.ts`,
> pure and unit-testable, and the same functions drive the dry-run preview
> ([07-admin-ux.md](07-admin-ux.md)). The mapper is **allowlist-based** like
> the shipped Etsy mapper: it only ever copies named public fields into a
> fresh object, so private fields structurally cannot leak (§F).

eBay splits a listing across two objects; the mapper emits both:

- **`InventoryItem`** (`PUT /sell/inventory/v1/inventory_item/{sku}`) —
  product facts: title, description, images, aspects, condition, quantity.
- **`Offer`** (`POST/PUT /sell/inventory/v1/offer`) — commercial terms:
  marketplace, format, category, price, policies, location.

## A. InventoryItem (`createOrReplaceInventoryItem`)

| Our field(s) | eBay field | Transform / notes |
| --- | --- | --- |
| `title` | `product.title` | EN only. Truncate to **80 chars** at a word boundary (much tighter than Etsy's 140 — reuse the Etsy word-boundary truncation with a new limit; unit-test boundary cases). No Etsy-style "&"-once rule; eBay allows normal punctuation. |
| `description`, `public_notes`, `details[]`, `length`, `purity`, `gram_weight`/`weight_grams`, `brand`, `item_year`, `stone_details` | `product.description` | Composed template: description body + spec block ("Metal, Purity, Weight, Length/Size, Era, Inventory #"). **Max 4,000 chars**; basic HTML allowed (`<b> <br> <ol> <ul> <li>`, table tags), no active content. **No external links / contact info** — eBay policy, same rule the Etsy template already follows. The offer's `listingDescription` (500k cap) is set to the same composed value so the live listing never falls back unexpectedly. Note: eBay derives an ~800-char mobile summary from the top of the description — lead with the body copy, put the spec block after. |
| `image_urls[]` (fallback `images[]`) | `product.imageUrls[]` | Direct URL handoff — **no transcode, no upload**. WebP accepted. HTTPS required. Cap **24** (ours max ~10, fine). Index 0 = first URL = gallery image. Legacy `/assets/...` paths resolve against `getSiteUrl()` exactly like `etsy/images.ts` does. Detail: [05-image-pipeline.md](05-image-pipeline.md). |
| `metal_variant`, `purity`, `metal_type`, `product_type`, `brand`, `length`, `chain_type` | `product.aspects` | Item specifics as `{ "AspectName": ["value"] }`. See §C — the eBay equivalent of Etsy's structured-property push, but **in the same payload** (no extra API calls, no discover-write-verify cycle needed). Aspect name ≤40 chars, value ≤50 chars. |
| `brand` | `product.brand` + aspect `Brand` | `brand` when present, else aspect value `"Unbranded"` (the conventional eBay value; most estate pieces are unbranded). No `mpn`/GTIN: jewelry categories don't require them — **verify per pinned category at build time**; if any category demands a UPC, the conventional `"Does not apply"` value is the fallback (community-established, flag in dry-run). |
| — (constant / per-type) | `condition` | `USED_EXCELLENT` (condition ID **3000**, displays as **"Pre-owned"** in jewelry categories). Coin/Bullion categories use a different enum set (Graded/Ungraded + condition descriptors) — see §D and [13-open-questions.md](13-open-questions.md) Q5/Q6. |
| — (standard template) | `conditionDescription` | ≤1,000 chars. **Decided (Q5): one standard template for all items** (e.g. "Estate piece in excellent pre-owned condition. Please review photos for detail." — final wording confirmed in the dry-run at build time), not per-item authoring. Ignored (warning) if condition were a NEW value — ours is Pre-owned. |
| `quantity` (via `normalizeProductQuantity`) | `availability.shipToLocationAvailability.quantity` | 1 for one-of-a-kind; real count for multi-unit rows. Sold → quantity 0 (+ Out-of-Stock Control) or withdraw — lifecycle-driven, [03](03-sync-lifecycle.md). |
| `gram_weight` ?? `weight_grams` | `packageWeightAndSize.weight` | **Omitted (Q8a decided flat-rate shipping** — no package weights/dimensions needed in payloads; item gram weight still appears in aspects/description). |
| `status`, `quantity` | (offer publish state / quantity) | Lifecycle-driven, not field-mapped — see [03-sync-lifecycle.md](03-sync-lifecycle.md). |

`createOrReplaceInventoryItem` is a **full replace** (fields not sent are
wiped). That's harmless for us — the mapper regenerates the complete payload
from `products` every time, which is also what makes repeated PUTs idempotent.
Same for `updateOffer`. Requires `Content-Language: en-US` header.

## B. Offer (`createOffer` / `updateOffer`)

| Our field(s) | eBay field | Transform / notes |
| --- | --- | --- |
| — (constant) | `marketplaceId` | `EBAY_US` |
| — (constant) | `format` | `FIXED_PRICE` |
| — (constant) | `listingDuration` | `GTC` (the only value for fixed-price; auto-renews monthly) |
| `price_mode` + (`pricing_multiplier`, `purity`, `gram_weight`, live spot) or `manual_price_label`/`asking_price` | `pricingSummary.price` (`{value, currency:"USD"}`) | **Flattened at push time** via `calcSpotPriceValue` / `parseManualPriceLabelValue` (`src/lib/pricing.ts`) — identical to Etsy — then the **eBay markup %** (separate setting from Etsy's 8%; eBay's final value fee is ~13–15%, see [10](10-rate-limits-and-quotas.md) §Fees and Q2). Round to 2 decimals. No meaningful platform floor (unlike Etsy's $0.20). Site pricing never touched. |
| `quantity` | `availableQuantity` | Effective live quantity = min(offer, item availability); push the same number to both. |
| `product_type` (fallback `jewelry_type`) | `categoryId` | Static leaf map pinned at build time (see §D and [06](06-account-prerequisites.md)). Unknown type fails pre-flight, same as Etsy. |
| composed description (same as A) | `listingDescription` | Explicitly set (required anyway when calling `updateOffer` on a published offer). |
| — (from `ebay_connection` defaults) | `listingPolicies.fulfillmentPolicyId` | **Dynamic, decided Q16 (2026-07-09):** the mapped/flattened price (below) is compared against `ebay_connection.high_value_shipping_threshold` (admin-editable, seeded $1000) — over threshold uses `express_fulfillment_policy_id` (live: "NEJ Express High-Value"), otherwise the standard `fulfillment_policy_id` (live: "NEJ Insured Flat Rate"). Pure mapping-time branch, no extra API call; participates in the content hash so a price crossing the threshold triggers an update push ([03](03-sync-lifecycle.md)). |
| — (from `ebay_connection` defaults) | `listingPolicies.paymentPolicyId` / `returnPolicyId` | One-time account setup values, required before publish ([06](06-account-prerequisites.md)). `bestOfferTerms` omitted — Best Offer decided OFF (Q9). |
| — (from `ebay_connection`) | `merchantLocationKey` | The single WAREHOUSE location created at setup. |
| — | `quantityLimitPerBuyer`, `storeCategoryNames`, `tax`, `charity`, `lotSize` | Not used. Store categories need an eBay Store subscription (Q12); eBay collects US marketplace-facilitator tax itself. |

## C. Aspects (item specifics) — the Etsy-properties equivalent, but easier

Aspect requirements come from Taxonomy `getItemAspectsForCategory` per leaf:
each aspect declares `aspectRequired`, `aspectUsage`
(REQUIRED/RECOMMENDED/OPTIONAL), `aspectMode` (**FREE_TEXT** vs
**SELECTION_ONLY**), cardinality, and allowed values. **Required aspects are
enforced at `publishOffer` time** — so pre-flight validates against a pinned
per-category aspect table (fetched at build time, refreshed if publish errors
suggest drift).

Planned mappings (final list depends on the pinned categories' actual
metadata — everything here is flagged `TODO(ebay-verify)` until pulled live):

| Our field | Aspect (typical fine-jewelry leaves) | Transform |
| --- | --- | --- |
| `metal_variant` (+ `metal_type` fallback) | `Metal` | `yellow_gold` → "Yellow Gold", `white_gold` → "White Gold", `silver` → "Sterling Silver", `platinum` → "Platinum", `vermeil` → "Vermeil" (category eligibility caveat — §D). **Required** in fine jewelry since eBay's 2022 jewelry policy update. |
| `purity` | `Metal Purity` | `10` → "10k", `14` → "14k", `18` → "18k"; silver → "925" where the value list wants fineness. **Required** in fine jewelry. SELECTION_ONLY expected — map onto the pinned allowed values; no match → pre-flight error, never a guess. |
| `product_type` / `chain_type` | `Type` / `Chain Type` / `Style` | Best-effort from the pinned value lists (e.g. "Chain", "Cuban Link"). RECOMMENDED-tier — a miss is a warning, not a block. |
| `brand` | `Brand` | Brand or "Unbranded". |
| `length` (necklace/bracelet/chain, via `normalizeProductLengthSizeValue`) | `Chain Length` / `Length` | Numeric inches + unit per the aspect's expected format. Rings: `Ring Size` aspect from the same dual-semantic `length` field, branching exactly like `productLengthSizeDisplay` — the Etsy build's ring/length branching logic is directly reusable. |
| `item_year` | `Year Manufactured` / decade-style aspects where offered | Optional, best-effort. **No vintage gate exists on eBay** — a missing year blocks nothing (Etsy's Q2 problem does not exist here). |
| `gram_weight` | `Total Weight`-style aspects where offered | (Bullion's `Precious Metal Content per Unit` vocabulary no longer applies — coins/bullion are excluded per Q6.) |
| `stone_details` | `Main Stone` etc. | **Never guessed** — same discipline as the Etsy build: no structured stone/width/closure values are fabricated for a business priced on real melt value. Free-text stone info stays in the description. |

Aspects ride inside the `createOrReplaceInventoryItem` payload — one call,
no per-property API round-trips, no Etsy-style "Gray bug" risk (a
SELECTION_ONLY mismatch is rejected loudly at publish, not silently stored
wrong). Validation strategy: pre-flight checks required aspects are present
and SELECTION_ONLY values match the pinned lists; publish-time `25xxx`
errors mapped to operator messages ([11-error-handling.md](11-error-handling.md)).

## D. Category strategy (per `product_type`)

Pinned at build time from `getCategorySuggestions` (tree `0` for EBAY_US),
names + IDs in code comments, exactly like `ETSY_TAXONOMY_MAP`. Candidate
leaves from research (IDs read from eBay's own browse URLs — **verify via the
Taxonomy API at build time**, eBay restructures periodically):

| `product_type` | Likely EBAY_US leaf | Notes |
| --- | --- | --- |
| Necklace / Pendant / Charm | Fine Necklaces & Pendants (**261993**) or a leaf below it | Fine vs Fashion split — see eligibility note below |
| Ring | Fine Rings (**261994**) or leaf | |
| Earrings | Fine Earrings (**261990**) | |
| Bracelet | Fine Bracelets & Charms (**261988**) | |
| Brooch / Cufflinks | Fine-jewelry leaves under 4196 (or Vintage & Antique Fine Jewelry, 12595) | The Vintage & Antique subtree is an alternative home for estate pieces — Q4 |
| Watch | Watches subtree (Jewelry & Watches, 281) | Watch-specific aspects; possibly Authenticity Guarantee territory |
| Coin / Bullion | — **EXCLUDED (Q6 decision, 2026-07-09)** | Pre-flight marks them ineligible ("not synced to eBay per owner decision") — never an error, never mapped. The coin condition regime (Graded/Ungraded + descriptors, <$2,500 ungraded cap) and bullion policy handling are out of scope. |
| Silverware | Antiques > Silver / Home & Living flatware leaves — **INCLUDED (Q6b)** | Same "no generic leaf" fuzziness the Etsy build hit; `approximate: true` flags + dry-run visibility, plus a keyword-fallback map like `ETSY_KEYWORD_TAXONOMY` if granular types need it |
| Other / unmapped | — | Pre-flight error; owner assigns a type first (same as Etsy) |

**Fine Jewelry eligibility (eBay jewelry policy):** base metal must be solid
sterling (925+), gold (9K+), palladium (500+) or platinum-group (850+);
**plated/vermeil items are not allowed in Fine Jewelry** and belong in
Fashion Jewelry. Consequence: `metal_variant='vermeil'` items map to Fashion
Jewelry leaves (or are excluded) — owner decision Q4. Pre-flight enforces
this (metal/purity → allowed subtree), because a policy-violating listing
risks removal and account defects.

## E. Fields intentionally NOT synced

| Field(s) | Why |
| --- | --- |
| `title_es`, `description_es`, `tags_es`, `public_notes_es`, `details_es` | EBAY_US is EN-only; eBay has no per-listing translation write API equivalent worth carrying. Site stays the bilingual channel. |
| `tags` | **eBay has no tags.** Search keywords live in the title + aspects; the mapper's title/aspect quality replaces Etsy's 13-tag pipeline entirely. (`jt:`/`ct:`/`len:` internal prefixes are consumed as data inputs, never emitted.) |
| `cost_basis`, `minimum_price`, `acquisition_*`, `internal_notes`, `private_price_label`, `melt_value`, `live_spot_snapshot` | Private/admin-only. **Must never leave our system.** Allowlist mapper + the same unit test the Etsy build has. (If Best Offer auto-decline is ever enabled, `minimum_price` would inform a server-side threshold — but that value goes into offer settings, never into listing content; deferred with Q9.) |
| `location`, `sort_order`, `featured`, `image_padding*`, `show_spot_price`, `special_price_override_*` | Site-display concerns with no eBay counterpart. |
| `slug`, `id` (as content) | Internal identity. `products.id` is used **as the SKU key** (identity, not content — mirrors how `etsy_listings` keys the mapping; Q11). |
| `pricing_multiplier`, `price_mode`, spot inputs | eBay gets the flattened price only. |
| `sku` (the column) | Same decision as the Etsy build (which dropped SKU push): the column is nullable and not needed — the eBay SKU key comes from `products.id`. Q11 confirms. |

## F. Allowlist guarantee

Identical mechanism to `etsy/mapping.ts`: the mapper builds payloads by
reading an explicit list of named fields into fresh objects — there is no
spread of the `Product` row anywhere — and a unit test asserts the serialized
payloads never contain `cost_basis`, `minimum_price`, `internal_notes`,
`private_price_label`, `melt_value`, `acquisition_date`,
`acquisition_source`, or `live_spot_snapshot` values.

## G. Gaps summary

- **G1 — Bilingual:** eBay side is EN-only; no listing-translation path
  planned (site remains the ES channel).
- **G2 — Spot pricing:** no live formula on eBay; concrete price pushed on a
  schedule/threshold via `bulkUpdatePriceQuantity` (Q3). eBay price is stale
  between pushes by design, same accepted trade-off as Etsy.
- **G3 — 80-char titles:** the site's long descriptive titles lose more
  detail than on Etsy (140). Word-boundary truncation + dry-run preview of
  the exact final title; aspects carry the structured facts search needs.
- **G4 — Coins/Bullion (RESOLVED by Q6 decision):** excluded from eBay
  entirely — the graded/ungraded descriptor regime, $2,500 ungraded cap, and
  bullion photo/content rules never apply. Pre-flight ineligibility, not a
  gap.
- **G5 — Trade-in / melt-value marketing:** site-only; eBay buyers see a
  plain price (identical to Etsy G5).
- **G6 — Authenticity Guarantee:** fine jewelry above eBay's program
  threshold routes through eBay's authentication flow (affects shipping
  workflow, not the API payload). Threshold and current mechanics:
  `TODO(ebay-verify)` at build time; surfaced as a dry-run note on high-value
  items ([15-compliance.md](15-compliance.md)).
