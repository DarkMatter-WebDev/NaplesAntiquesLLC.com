# 02 — Field Mapping: Supabase `products` → Etsy

> Planning only. Contract source: `next-app/src/types/product.ts` (our side)
> and the Etsy v3 OpenAPI spec (their side). All transforms live in one place:
> proposed `next-app/src/lib/etsy/mapping.ts`, pure and unit-testable, and the
> same functions drive the dry-run preview ([07-admin-ux.md](07-admin-ux.md)).

## A. Listing core (createDraftListing / updateListing)

| Our field(s) | Etsy field | Transform / notes |
| --- | --- | --- |
| `title` | `title` | EN only (see gap G1). Truncate to **140 chars** at a word boundary; Etsy also restricts some characters/ALL-CAPS patterns — normalize before push. |
| `description`, `public_notes`, `details[]`, `length`, `purity`, `gram_weight`/`weight_grams`, `brand`, `item_year` | `description` | Composed template: description body + a spec block ("Metal, Purity, Weight, Length/Size, Era, Inventory #"). Include a "sold on our site at spot-linked pricing" note only if owner wants cross-promo (Etsy restricts off-site links — avoid URLs; see [15-compliance.md](15-compliance.md)). |
| `tags`, `tags_es` | `tags` | EN tags only; strip internal prefixes (`jt:`, `len:` used by the app); max **13 tags, ≤20 chars each**, letters/numbers/spaces/hyphens; drop or split the rest. |
| `metal_variant`, `purity`, `metal_type` | `materials` | e.g. `yellow_gold` + `purity=10` → `["10k gold", "solid gold"]`; max 13 entries, plain words. |
| `product_type` (fallback `jewelry_type`, `inferProductJewelryType`) | `taxonomy_id` | Static leaf map (Necklace→ Jewelry>Necklaces>Chain Necklaces etc.), resolved once from `getSellerTaxonomyNodes` and pinned in code. See [06-shop-prerequisites.md](06-shop-prerequisites.md). |
| — (constant) | `who_made` | `someone_else` (estate pieces, made by others). |
| — (constant) | `is_supply` | `false` (finished jewelry). |
| `item_year` | `when_made` | Bucket mapping (see table C). Missing or post-2006 years fall back to `'1990s'` per the owner's attestation that all inventory is genuinely vintage ([13](13-open-questions.md) Q2) — every fallback use is flagged in the dry-run preview. |
| `gram_weight` ?? `weight_grams` | `item_weight` + `item_weight_unit: "g"` | Direct copy when present. |
| `status`, `quantity` | `state` (`active`/`inactive`) | Lifecycle-driven, not field-mapped — see [03-sync-lifecycle.md](03-sync-lifecycle.md). |
| `featured` / `product_type` | `shop_section_id` | Optional: map product types to shop sections (Chains, Rings, …) once sections exist ([06](06-shop-prerequisites.md)). |
| — (from `etsy_connection` defaults) | `shipping_profile_id`, `return_policy_id`, `readiness_state_id` | One-time shop setup values, required before activation. |

## B. Inventory (updateListingInventory)

Etsy inventory is `products[] → offerings[]`; ours are single-variant, so one
product with one offering.

| Our field(s) | Etsy field | Transform / notes |
| --- | --- | --- |
| `price_mode` + (`pricing_multiplier`, `purity`, `gram_weight`, live spot) or `manual_price_label`/`asking_price` | `offerings[0].price` | **Flattened at push time** via `calcSpotPriceValue` / `parseManualPriceLabelValue` (`src/lib/pricing.ts`). Spot items drift ⇒ scheduled re-push ([03](03-sync-lifecycle.md) §Update, [13](13-open-questions.md) Q4). Optional Etsy-fee markup factor is Q5. Round to 2 decimals; reject `< $0.20` (Etsy minimum). |
| `quantity` (via `normalizeProductQuantity`) | `offerings[0].quantity` | 1 for one-of-a-kind; push real count for multi-unit rows. `0`/sold handled by deactivation instead ([03](03-sync-lifecycle.md)). |
| `sku` (fallback `inventory_number` as `NEJ-{n}`) | `products[0].sku` | Key for Phase 3 receipt matching — must be non-empty and unique; pre-flight warns if missing. |

## C. `when_made` bucket mapping (from `item_year`)

Aligned with the era model in `next-app/src/lib/jewelry-eras.ts`, flattened to
Etsy's enum. **Verify exact enum values against the live OpenAPI spec at build
time** (`/openapi/generated/oas/3.0.0.json`) — buckets near the present have
shifted over the years (`before_2007` style values).

| `item_year` | `when_made` |
| --- | --- |
| > 2006 **(treated as mislabeled — see decision note below)** | `1990s` (fallback, flagged in dry-run) |
| 2000–2006 | `2000s`-era bucket (`before_2007` family) |
| 1990–1999 | `1990s` |
| 1980–1989 | `1980s` |
| 1970–1979 | `1970s` |
| 1960–1969 | `1960s` |
| 1950–1959 | `1950s` |
| 1940–1949 | `1940s` |
| 1930–1939 | `1930s` |
| 1920–1929 | `1920s` |
| 1910–1919 | `1910s` |
| 1900–1909 | `1900s` |
| 1800–1899 | `1800s` |
| < 1800 | `before_1800`-family bucket |
| `null` | `1990s` (fallback, flagged in dry-run) |

**Vintage eligibility (decided — Q2):** Etsy allows only handmade, vintage
(**20+ years old**), or craft supplies; `who_made: someone_else` finished
jewelry must be vintage. The owner attests **all inventory is genuinely
vintage** and that any `item_year` after 2006 (or missing) is a data-entry
error, so those items push with the `1990s` fallback instead of being
blocked. The fallback lives **only in the Etsy payload** — `item_year` in the
database, the site's Era/Year filter, and product pages are untouched.
Correcting the real year in Product Admin fixes the Etsy bucket on the next
sync. Decision detail: [13-open-questions.md](13-open-questions.md) Q2.

## D. Images

| Our field | Etsy | Notes |
| --- | --- | --- |
| `image_urls[]` (fallback `images[]`) | `uploadListingImage` per entry, `rank` = array order | First entry = primary. Etsy caps **10 images/listing**; WebP must be transcoded (Etsy accepts JPEG/PNG/GIF). Full pipeline: [05-image-pipeline.md](05-image-pipeline.md). |
| `image_padding` / `image_padding_by_image` | — | Not portable; Etsy shows raw images. Acceptable (padding is a display nicety). If a padded look matters, bake padding into the transcoded JPEG later (out of MVP scope). |

## E. Category properties (updateListingProperty)

After the taxonomy leaf is chosen, `getPropertiesByTaxonomyId` tells us which
structured attributes exist (e.g. necklaces: length; rings: ring size; many:
metal/material scales). Best-effort per type:

| Our field | Etsy property (typical) | Notes |
| --- | --- | --- |
| `length` (necklace/bracelet, via `normalizeProductLengthSizeValue`) | Length property (inches scale) | Property/scale IDs differ per taxonomy node; resolve at build time and pin. |
| `length` (rings — stores ring size) | Ring size property | Same field, different semantic per `product_type` — mapper must branch like `productLengthSizeDisplay` does. |
| `metal_variant`/`purity` | Metal property | Where the node offers a metal attribute. |
| `chain_type` | — (no structured property) | Goes into title/tags/description instead. |

Property push is **best-effort**: a failed property call logs a warning but
doesn't fail the sync ([11-error-handling.md](11-error-handling.md)).

## F. Fields intentionally NOT synced

| Field(s) | Why |
| --- | --- |
| `title_es`, `description_es`, `tags_es`, `public_notes_es`, `details_es` | Etsy listings are single-language (+ optional `updateListingTranslation` — deferred; [13](13-open-questions.md) Q3). |
| `cost_basis`, `minimum_price`, `acquisition_*`, `internal_notes`, `private_price_label`, `melt_value`, `live_spot_snapshot` | Private/admin-only. **Must never leave our system.** Mapper is allowlist-based, not blocklist-based, to guarantee this. |
| `location`, `sort_order`, `featured`, `image_padding*`, `show_spot_price`, `special_price_override_*` | Site-display concerns with no Etsy counterpart (trade-in messaging is site-only). |
| `slug`, `id` | Internal identity; Etsy assigns its own IDs (kept in `etsy_listings`). |
| `pricing_multiplier`, `price_mode`, spot inputs | Etsy gets the flattened price only. |

## G. Gaps summary

- **G1 — Bilingual:** Etsy side is EN-only in MVP; ES exists via listing
  translations if wanted later (Q3).
- **G2 — Spot pricing:** no live formula on Etsy; concrete price pushed on a
  schedule/threshold (Q4). Etsy price is stale between pushes by design.
- **G3 — Vintage eligibility (resolved by Q2 decision):** owner-attested
  fallback — post-2006/missing years push as `1990s`, flagged in dry-run;
  nothing is blocked on age.
- **G4 — Ring size / chain length as structured attributes:** taxonomy-node
  specific; best-effort in MVP, spec block in description is the reliable
  carrier.
- **G5 — Trade-in / melt-value marketing:** site-only feature; Etsy buyers see
  a plain price.
- **G6 — WebP images:** transcode required ([05](05-image-pipeline.md)).
