import crypto from 'node:crypto';
import type { Product, SpotData } from '@/types/product';
import { inferProductJewelryType, normalizeProductLengthSizeValue, normalizeProductQuantity } from '@/types/product';
import { calcSpotPriceValue, parseManualPriceLabelValue } from '@/lib/pricing';
import { getSiteUrl } from '@/lib/order-email-branding';

// Pure allowlist mapper: Product -> eBay InventoryItem + Offer fields. Mirrors
// the SHAPE of next-app/src/lib/etsy/mapping.ts (allowlist-by-construction,
// Pick<Product, ...>-typed sub-mappers, pinned-not-guessed taxonomy, content
// hash for change detection) — copied, never imported, per BUILD-PROMPT.md
// hard rule 9. See ebay-sync-plan/02-field-mapping.md.

// ALLOWLIST, not blocklist: every function below only ever reads named
// Product fields into a fresh object. Private fields (cost_basis,
// minimum_price, internal_notes, private_price_label, melt_value,
// live_spot_snapshot, acquisition_date, acquisition_source) are never
// referenced anywhere in this file, so they structurally cannot leak into a
// payload — see __tests__/mapping.test.ts for the guarantee test.
export const EBAY_FORBIDDEN_PRODUCT_FIELDS = [
  'cost_basis',
  'minimum_price',
  'internal_notes',
  'private_price_label',
  'melt_value',
  'live_spot_snapshot',
  'acquisition_date',
  'acquisition_source',
] as const;

// ---------------------------------------------------------------------------
// Title — 80 chars (tighter than Etsy's 140), word-boundary truncation, no
// "at most one &" rule (that's an Etsy-specific quirk; eBay allows normal
// punctuation).
// ---------------------------------------------------------------------------
const TITLE_MAX_LENGTH = 80;

export function mapTitle(title: string | null | undefined): string {
  const collapsed = (title ?? '').trim().replace(/\s+/g, ' ');
  if (collapsed.length <= TITLE_MAX_LENGTH) return collapsed;
  const cut = collapsed.slice(0, TITLE_MAX_LENGTH);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trim();
}

// ---------------------------------------------------------------------------
// SKU — Q11: ebay_sku = products.id verbatim.
// ---------------------------------------------------------------------------
export function mapSku(product: Pick<Product, 'id'>): string {
  return product.id;
}

// ---------------------------------------------------------------------------
// Condition — Q5: USED_EXCELLENT (legacy condition id 3000, "Pre-owned") + one
// standard template for every item, never per-item authoring.
//
// The Sell Inventory API's `condition` field on createOrReplaceInventoryItem
// takes the ConditionEnum string name (e.g. "USED_EXCELLENT"), NOT the
// numeric condition id from the older Trading API. Sending "3000" produces
// eBay error 2004 "Could not serialize field [condition]" — confirmed live
// 2026-07-09 against the production inventory_item endpoint.
// ---------------------------------------------------------------------------
export const EBAY_CONDITION_ID = 'USED_EXCELLENT';
export const EBAY_CONDITION_DESCRIPTION =
  'Estate piece in excellent pre-owned condition. Please review photos for detail.';

// ---------------------------------------------------------------------------
// Description — body copy + a composed spec block. Basic HTML only (no
// active content, no external links — eBay policy). Capped at 4,000 chars.
// ---------------------------------------------------------------------------
function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const DESCRIPTION_MAX_LENGTH = 4000;

export function mapDescription(
  product: Pick<
    Product,
    | 'description'
    | 'public_notes'
    | 'details'
    | 'length'
    | 'purity'
    | 'gram_weight'
    | 'weight_grams'
    | 'brand'
    | 'item_year'
    | 'stone_details'
    | 'product_type'
    | 'jewelry_type'
    | 'title'
    | 'title_es'
    | 'chain_type'
    | 'tags'
    | 'tags_es'
  >,
): string {
  const bodyParts = [product.description, product.public_notes, ...(product.details ?? [])]
    .map((part) => (part ?? '').trim())
    .filter(Boolean);
  const bodyHtml = bodyParts.length
    ? bodyParts.map((part) => `<p>${escapeHtml(part)}</p>`).join('')
    : '';

  const specLines: string[] = [];
  const weight = product.gram_weight ?? product.weight_grams;
  if (product.purity) specLines.push(`Purity: ${product.purity}`);
  if (weight) specLines.push(`Weight: ${weight}g`);

  const jewelryType = inferProductJewelryType(product);
  const lengthDisplay = normalizeProductLengthSizeValue(product.length);
  if (lengthDisplay) {
    specLines.push(jewelryType === 'Ring' ? `Ring size: ${lengthDisplay}` : `Length: ${lengthDisplay} in`);
  }
  if (product.item_year) specLines.push(`Era: ${product.item_year}`);
  if (product.brand) specLines.push(`Brand: ${product.brand}`);
  // stone_details is free text only, never parsed into a structured aspect
  // (no verified-safe source for that — same discipline as the Etsy build).
  if (product.stone_details) specLines.push(`Stone details: ${product.stone_details}`);

  const specHtml = specLines.length ? `<ul>${specLines.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>` : '';

  return `${bodyHtml}${specHtml}`.trim().slice(0, DESCRIPTION_MAX_LENGTH);
}

// ---------------------------------------------------------------------------
// Ring size / length — eBay's "Ring Size" and "Chain Length" aspects are
// plain free-text-friendly values (no pinned SELECTION_ONLY chart in this
// build — see the aspect-values note below), so this only needs to format a
// decimal, not resolve it against a fraction chart the way the Etsy build's
// ring-size-experiment.ts does. Re-implemented locally (not imported from
// lib/etsy/*) per BUILD-PROMPT.md hard rule 9.
// ---------------------------------------------------------------------------
function parseRingSizeValue(length: string | null | undefined): number | null {
  const trimmed = length?.trim() ?? '';
  if (!trimmed) return null;
  const bare = trimmed.match(/^(\d+(?:\.\d+)?)$/);
  if (bare) return Number(bare[1]);
  const prefixed = trimmed.match(/^size\s*:?\s*(\d+(?:\.\d+)?)$/i);
  return prefixed ? Number(prefixed[1]) : null;
}

function ringSizeDisplay(size: number): string {
  return Number.isInteger(size) ? String(size) : String(Math.round(size * 4) / 4);
}

function parseWearableLengthInchesValue(length: string | null | undefined): number | null {
  const trimmed = length?.trim() ?? '';
  const match = trimmed.match(/^(\d+(?:\.\d+)?)\s*(?:in(?:ch(?:es?)?)?\.?|")?$/i);
  if (!match) return null;
  const value = Number(match[1]);
  return value > 0 && Number.isFinite(value) ? value : null;
}

// ---------------------------------------------------------------------------
// Aspects (item specifics) — best-effort key/value pairs from structured
// fields. TODO(ebay-verify): this build has no live Taxonomy access, so
// these values have NOT been cross-checked against each pinned category's
// real getItemAspectsForCategory allowed-value lists (SELECTION_ONLY
// aspects reject a non-matching value at publish time rather than silently
// storing it wrong — unlike Etsy's "Gray" incident, a bad aspect value here
// fails loudly, not silently). Resolve the live aspect tables before the
// first production publish and tighten this mapping if any value doesn't
// match (see OWNER-SETUP.md).
// ---------------------------------------------------------------------------
export type EbayAspects = Record<string, string[]>;

const METAL_ASPECT_LABELS: Record<string, string> = {
  yellow_gold: 'Yellow Gold',
  white_gold: 'White Gold',
  rose_gold: 'Rose Gold',
  tricolor_gold: 'Tricolor Gold',
  bicolor_gold: 'Two-Tone Gold',
  silver: 'Sterling Silver',
  vermeil: 'Vermeil',
  platinum: 'Platinum',
};

function purityAspectValue(product: Pick<Product, 'purity' | 'category'>): string | null {
  if (!product.purity) return null;
  return product.purity > 100 ? String(Math.round(product.purity)) : `${product.purity}k`;
}

export function mapAspects(
  product: Pick<
    Product,
    | 'metal_variant'
    | 'metal_type'
    | 'purity'
    | 'category'
    | 'brand'
    | 'product_type'
    | 'jewelry_type'
    | 'chain_type'
    | 'length'
    | 'item_year'
    | 'gram_weight'
    | 'weight_grams'
    | 'title'
    | 'title_es'
    | 'tags'
    | 'tags_es'
  >,
): EbayAspects {
  const aspects: EbayAspects = {};
  const jewelryType = inferProductJewelryType(product);

  const metalLabel = product.metal_variant ? METAL_ASPECT_LABELS[product.metal_variant] : null;
  if (metalLabel) aspects.Metal = [metalLabel];

  const purity = purityAspectValue(product);
  if (purity) aspects['Metal Purity'] = [purity];

  if (jewelryType && jewelryType !== 'Other') aspects.Type = [jewelryType];
  if (product.chain_type) aspects['Chain Type'] = [product.chain_type];
  aspects.Brand = [product.brand?.trim() || 'Unbranded'];

  const lengthValue = normalizeProductLengthSizeValue(product.length);
  if (lengthValue) {
    if (jewelryType === 'Ring') {
      const size = parseRingSizeValue(product.length);
      aspects['Ring Size'] = [size != null ? ringSizeDisplay(size) : lengthValue];
    } else {
      const inches = parseWearableLengthInchesValue(product.length);
      aspects['Chain Length'] = [inches != null ? `${inches} in` : lengthValue];
    }
  }

  if (product.item_year) aspects['Year Manufactured'] = [String(product.item_year)];

  const weight = product.gram_weight ?? product.weight_grams;
  if (weight) aspects['Item Weight'] = [`${weight} g`];

  return aspects;
}

// ---------------------------------------------------------------------------
// Category resolution — pinned candidate leaves from
// ebay-sync-plan/02-field-mapping.md §D (itself flagged TODO(ebay-verify) by
// the plan against a live getCategorySuggestions call; this build
// environment has neither eBay credentials nor network access to run one —
// see the final report). Coin/Bullion are excluded entirely (Q6).
// ---------------------------------------------------------------------------
export interface EbayCategoryMapping {
  categoryId: string;
  path: string;
  approximate?: boolean;
}

// Fine Jewelry leaves — solid-metal items (Q4b: modern leaves, not Vintage &
// Antique subtree).
const EBAY_FINE_CATEGORY_MAP: Partial<Record<string, EbayCategoryMapping>> = {
  Necklace: { categoryId: '261993', path: 'Jewelry & Watches > Fine Jewelry > Fine Necklaces & Pendants' },
  Pendant: { categoryId: '261993', path: 'Jewelry & Watches > Fine Jewelry > Fine Necklaces & Pendants' },
  Charm: { categoryId: '261993', path: 'Jewelry & Watches > Fine Jewelry > Fine Necklaces & Pendants', approximate: true },
  Ring: { categoryId: '261994', path: 'Jewelry & Watches > Fine Jewelry > Fine Rings' },
  Earrings: { categoryId: '261990', path: 'Jewelry & Watches > Fine Jewelry > Fine Earrings' },
  Bracelet: { categoryId: '261988', path: 'Jewelry & Watches > Fine Jewelry > Fine Bracelets & Charms' },
  Brooch: {
    categoryId: '12595',
    path: 'Jewelry & Watches > Vintage & Antique Jewelry > Fine Jewelry (Vintage & Antique)',
    approximate: true,
  },
  Cufflinks: { categoryId: '4196', path: 'Jewelry & Watches > Fine Jewelry (leaf not pinned)', approximate: true },
  Watch: { categoryId: '281', path: 'Jewelry & Watches > Watches, Parts & Accessories > Watches', approximate: true },
  Silverware: {
    categoryId: '1048',
    path: 'Antiques > Silver > Sterling Silver Flatware (leaf not pinned)',
    approximate: true,
  },
};

// eBay's jewelry policy bars plated/vermeil items from Fine Jewelry leaves
// (they require solid 925+/9K+/850+ base metal) — vermeil routes to Fashion
// Jewelry instead (Q4). NO Fashion Jewelry leaf id is pinned here: rather
// than fabricate a plausible-looking id with no way to verify it (the exact
// failure class behind the Etsy build's "Gray" incident — a guess that looks
// fine but is silently wrong), this is intentionally left empty. Pre-flight
// blocks vermeil items with a clear message until the owner/developer pins
// real ids via a live getCategorySuggestions call (see OWNER-SETUP.md).
// Run `npm run ebay:pin-fashion-categories` (needs EBAY_CLIENT_ID/
// EBAY_CLIENT_SECRET as env vars — an application token, no seller OAuth
// connection required) to look up real candidates and fill this in.
// TODO(ebay-verify): pin real Fashion Jewelry leaf ids, one per jewelry type.
const EBAY_FASHION_CATEGORY_MAP: Partial<Record<string, EbayCategoryMapping>> = {};

const COIN_BULLION_TYPES = new Set(['Coin', 'Bullion']);

export interface CategoryOverride {
  id: string;
  path: string;
}

export function resolveCategory(
  product: Pick<Product, 'product_type' | 'jewelry_type' | 'metal_variant' | 'title' | 'title_es' | 'chain_type' | 'tags' | 'tags_es'>,
  override?: CategoryOverride | null,
): EbayCategoryMapping | null {
  if (override) return { categoryId: override.id, path: override.path };

  const jewelryType = inferProductJewelryType(product);
  if (COIN_BULLION_TYPES.has(jewelryType)) return null;

  const isVermeil = product.metal_variant === 'vermeil';
  const map = isVermeil ? EBAY_FASHION_CATEGORY_MAP : EBAY_FINE_CATEGORY_MAP;
  return map[jewelryType] ?? null;
}

export function isEbayIneligibleProductType(jewelryType: string): boolean {
  return COIN_BULLION_TYPES.has(jewelryType);
}

// ---------------------------------------------------------------------------
// Price — flattened via the same helpers Etsy reuses (never reimplemented),
// then the eBay-specific admin-variable markup (Q2, seeded 15%) applied. No
// platform price floor (unlike Etsy's $0.20) — eBay has none.
// ---------------------------------------------------------------------------
export interface EbayPriceResult {
  price: number | null;
  basePrice: number | null;
  rejectedReason: string | null;
}

export function computeEbayPrice(product: Product, spotData: SpotData | null, markupPct: number): EbayPriceResult {
  const base =
    product.price_mode === 'manual'
      ? parseManualPriceLabelValue(product.manual_price_label) ?? (product.asking_price ?? null)
      : calcSpotPriceValue(product, spotData);

  if (base == null || !Number.isFinite(base) || base <= 0) {
    return {
      price: null,
      basePrice: null,
      rejectedReason: 'No computable price for this item — set a manual price or check spot pricing inputs.',
    };
  }

  const marked = base * (1 + (markupPct || 0) / 100);
  return {
    price: Math.round((marked + Number.EPSILON) * 100) / 100,
    basePrice: Math.round((base + Number.EPSILON) * 100) / 100,
    rejectedReason: null,
  };
}

// ---------------------------------------------------------------------------
// Q16 — price-tiered express shipping. Pure mapping-time branch: compare the
// flattened price against the admin-editable threshold (seeded $1000) and
// pick between the two live Business Policies. No new API call.
// ---------------------------------------------------------------------------
export interface EbayConnectionDefaults {
  fulfillment_policy_id: string | null;
  express_fulfillment_policy_id: string | null;
  high_value_shipping_threshold: number;
  payment_policy_id: string | null;
  return_policy_id: string | null;
  merchant_location_key: string | null;
  price_markup_pct: number;
  marketplace_id?: string | null;
  selling_limit_amount?: number | null;
  selling_limit_quantity?: number | null;
}

export interface FulfillmentPolicyResolution {
  policyId: string | null;
  tier: 'standard' | 'express';
}

export function resolveFulfillmentPolicyId(
  price: number | null,
  connection: EbayConnectionDefaults | null,
): FulfillmentPolicyResolution {
  if (!connection) return { policyId: null, tier: 'standard' };
  const threshold = connection.high_value_shipping_threshold ?? 1000;
  if (price != null && price > threshold && connection.express_fulfillment_policy_id) {
    return { policyId: connection.express_fulfillment_policy_id, tier: 'express' };
  }
  return { policyId: connection.fulfillment_policy_id ?? null, tier: 'standard' };
}

// ---------------------------------------------------------------------------
// Images — direct URL handoff, no transcode/upload (05-image-pipeline.md).
// Absolutizes legacy /assets/... paths against the site's canonical URL,
// same resolution rule the Etsy build needed for Node's origin-less fetch —
// here it's eBay's own fetcher that needs the absolute URL.
// ---------------------------------------------------------------------------
const EBAY_MAX_IMAGES = 24;

export function resolveEbayImageUrl(url: string): string {
  const trimmed = (url ?? '').trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const base = getSiteUrl();
  return `${base}${trimmed.startsWith('/') ? '' : '/'}${trimmed}`;
}

export function resolveImageUrls(product: Pick<Product, 'image_urls' | 'images'>): string[] {
  const source = product.image_urls?.length ? product.image_urls : (product.images ?? []);
  return source
    .map((url) => resolveEbayImageUrl(url))
    .filter((url) => url.length > 0)
    .slice(0, EBAY_MAX_IMAGES);
}

// ---------------------------------------------------------------------------
// Pre-flight checks — no eBay calls. Blocking checks gate the sync; ok:true
// informational checks (e.g. the selling-limit readout) never block.
// ---------------------------------------------------------------------------
export interface PreflightCheck {
  check: string;
  ok: boolean;
  message?: string;
  value?: unknown;
}

export function buildPreflightChecks(
  product: Product,
  connection: EbayConnectionDefaults | null,
  spotData: SpotData | null,
  categoryOverride?: CategoryOverride | null,
): PreflightCheck[] {
  const checks: PreflightCheck[] = [];

  checks.push({
    check: 'connected',
    ok: Boolean(connection),
    message: connection ? undefined : 'Connect eBay in Settings before syncing.',
  });

  const hasDefaults = Boolean(
    connection?.fulfillment_policy_id &&
      connection?.payment_policy_id &&
      connection?.return_policy_id &&
      connection?.merchant_location_key,
  );
  checks.push({
    check: 'account_defaults',
    ok: !connection || hasDefaults,
    message: connection && !hasDefaults ? 'eBay needs shipping/payment/return policies and a location. Finish setup in Settings → eBay Sync.' : undefined,
  });

  const jewelryType = inferProductJewelryType(product);
  const ineligible = isEbayIneligibleProductType(jewelryType);
  checks.push({
    check: 'eligibility',
    ok: !ineligible,
    message: ineligible ? 'Coins and bullion are not synced to eBay per owner decision.' : undefined,
  });

  checks.push({
    check: 'status',
    ok: product.status === 'available',
    message: product.status === 'available' ? undefined : 'Only available items can be published to eBay.',
  });

  const quantity = normalizeProductQuantity(product.quantity);
  checks.push({
    check: 'quantity',
    ok: quantity >= 1,
    message: quantity >= 1 ? undefined : 'This item has zero quantity.',
  });

  const priceResult = computeEbayPrice(product, spotData, connection?.price_markup_pct ?? 15);
  checks.push({
    check: 'price',
    ok: priceResult.price != null,
    message: priceResult.rejectedReason ?? undefined,
    value: priceResult.price ?? undefined,
  });

  const images = resolveImageUrls(product);
  checks.push({
    check: 'images',
    ok: images.length > 0,
    message: images.length > 0 ? undefined : 'Add at least one photo before syncing.',
    value: images.length,
  });

  if (!ineligible) {
    const category = resolveCategory(product, categoryOverride);
    checks.push({
      check: 'category',
      ok: Boolean(category),
      message: category
        ? category.approximate
          ? `Category "${category.path}" is an approximate/unpinned match — review before publishing.`
          : undefined
        : product.metal_variant === 'vermeil'
          ? "Plated/vermeil items route to Fashion Jewelry, but no Fashion Jewelry category id is pinned yet — resolve via eBay's Taxonomy API before publishing this item."
          : 'No eBay category is mapped for this product type yet.',
      value: category?.path,
    });

    checks.push({
      check: 'aspect_values_unverified',
      ok: true,
      message: "Aspect values (Metal, Metal Purity, etc.) haven't been cross-checked against eBay's live category value lists yet — review the preview before publishing.",
    });
  }

  if (connection?.selling_limit_amount != null || connection?.selling_limit_quantity != null) {
    checks.push({
      check: 'selling_limit',
      ok: true,
      message: `Monthly selling limit on file: ${connection.selling_limit_quantity ?? '—'} items / $${connection.selling_limit_amount ?? '—'}. Informational only.`,
    });
  }

  return checks;
}

export function isPreflightPassing(checks: PreflightCheck[]): boolean {
  return checks.every((check) => check.ok);
}

// ---------------------------------------------------------------------------
// Full mapped payload — the allowlist enforcement point. Only ever reads
// named fields into a fresh object; never spreads ...product.
// ---------------------------------------------------------------------------
export interface MappedEbayImage {
  url: string;
}

export interface MappedEbayPayload {
  sku: string;
  title: string;
  description: string;
  aspects: EbayAspects;
  conditionId: string;
  conditionDescription: string;
  categoryId: string | null;
  categoryPath: string | null;
  categoryIsApproximate: boolean;
  categoryIsOverride: boolean;
  price: number | null;
  priceBeforeMarkup: number | null;
  quantity: number;
  images: MappedEbayImage[];
  fulfillmentPolicyId: string | null;
  shippingTier: 'standard' | 'express';
  paymentPolicyId: string | null;
  returnPolicyId: string | null;
  merchantLocationKey: string | null;
  marketplaceId: string;
}

export function buildMappedPayload(
  product: Product,
  connection: EbayConnectionDefaults | null,
  spotData: SpotData | null,
  categoryOverride?: CategoryOverride | null,
): MappedEbayPayload {
  const category = resolveCategory(product, categoryOverride);
  const priceResult = computeEbayPrice(product, spotData, connection?.price_markup_pct ?? 15);
  const { policyId: fulfillmentPolicyId, tier } = resolveFulfillmentPolicyId(priceResult.price, connection);

  return {
    sku: mapSku(product),
    title: mapTitle(product.title),
    description: mapDescription(product),
    aspects: mapAspects(product),
    conditionId: EBAY_CONDITION_ID,
    conditionDescription: EBAY_CONDITION_DESCRIPTION,
    categoryId: category?.categoryId ?? null,
    categoryPath: category?.path ?? null,
    categoryIsApproximate: categoryOverride ? false : Boolean(category?.approximate),
    categoryIsOverride: Boolean(categoryOverride),
    price: priceResult.price,
    priceBeforeMarkup: priceResult.basePrice,
    quantity: normalizeProductQuantity(product.quantity),
    images: resolveImageUrls(product).map((url) => ({ url })),
    fulfillmentPolicyId,
    shippingTier: tier,
    paymentPolicyId: connection?.payment_policy_id ?? null,
    returnPolicyId: connection?.return_policy_id ?? null,
    merchantLocationKey: connection?.merchant_location_key ?? null,
    marketplaceId: connection?.marketplace_id ?? 'EBAY_US',
  };
}

// ---------------------------------------------------------------------------
// Content hash — cheap out-of-date detection with zero eBay reads. Includes
// the resolved fulfillment policy id (Q16) so a price crossing the
// high-value threshold triggers an update push, exactly like any other
// mapped-output change.
// ---------------------------------------------------------------------------
export function computeContentHash(payload: MappedEbayPayload): string {
  const stable = {
    title: payload.title,
    description: payload.description,
    aspects: payload.aspects,
    conditionId: payload.conditionId,
    conditionDescription: payload.conditionDescription,
    categoryId: payload.categoryId,
    price: payload.price,
    quantity: payload.quantity,
    images: payload.images.map((image) => image.url),
    fulfillmentPolicyId: payload.fulfillmentPolicyId,
    paymentPolicyId: payload.paymentPolicyId,
    returnPolicyId: payload.returnPolicyId,
    merchantLocationKey: payload.merchantLocationKey,
  };
  return crypto.createHash('sha256').update(JSON.stringify(stable)).digest('hex');
}
