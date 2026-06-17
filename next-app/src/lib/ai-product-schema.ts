import {
  PRODUCT_JEWELRY_TYPES,
  PRODUCT_METAL_TYPES,
  PRODUCT_METAL_VARIANTS,
  normalizeProductJewelryType,
  normalizeProductLengthSizeValue,
  normalizeProductMetalType,
  normalizeProductMetalVariant,
  type Product,
  type ProductJewelryType,
  type ProductMetalType,
  type ProductMetalVariant,
} from '@/types/product';

export type ProductAutofillConfidence = 'low' | 'medium' | 'high';

export type ProductAutofillFields = {
  title: string | null;
  product_type: ProductJewelryType | null;
  brand: string | null;
  metal_type: ProductMetalType | null;
  metal_variant: ProductMetalVariant | null;
  gender: 'Unisex' | 'Men' | 'Women' | null;
  chain_type: string | null;
  length: string | null;
  price_mode: 'spot-multiplier' | 'manual' | null;
  purity: number | null;
  weight_grams: number | null;
  pricing_multiplier: number | null;
  asking_price: number | null;
  manual_price_label: string | null;
  description: string | null;
  public_notes: string | null;
};

export type ProductAutofillDraft = {
  fields: ProductAutofillFields;
  warnings: string[];
  uncertainties: string[];
  confidence: Partial<Record<keyof ProductAutofillFields, ProductAutofillConfidence>>;
};

export type ProductAutofillProviderResult = Partial<ProductAutofillDraft> & {
  fields?: Partial<Record<keyof ProductAutofillFields, unknown>>;
  warnings?: unknown;
  uncertainties?: unknown;
  confidence?: unknown;
};

export const PRODUCT_AUTOFILL_FIELD_KEYS = [
  'title',
  'product_type',
  'brand',
  'metal_type',
  'metal_variant',
  'gender',
  'chain_type',
  'length',
  'price_mode',
  'purity',
  'weight_grams',
  'pricing_multiplier',
  'asking_price',
  'manual_price_label',
  'description',
  'public_notes',
] as const satisfies readonly (keyof ProductAutofillFields)[];

export const EMPTY_PRODUCT_AUTOFILL_FIELDS: ProductAutofillFields = {
  title: null,
  product_type: null,
  brand: null,
  metal_type: null,
  metal_variant: null,
  gender: null,
  chain_type: null,
  length: null,
  price_mode: null,
  purity: null,
  weight_grams: null,
  pricing_multiplier: null,
  asking_price: null,
  manual_price_label: null,
  description: null,
  public_notes: null,
};

export const PRODUCT_AUTOFILL_SCHEMA = {
  name: 'product_listing_draft',
  description: 'Nullable catalog fields for a Naples Estate Jewelry product listing. Unknown or unsupported values must be null. Do not return operational fields (status, location) — they are not AI-controlled.',
  fields: PRODUCT_AUTOFILL_FIELD_KEYS,
  productTypes: PRODUCT_JEWELRY_TYPES.map((item) => item.value),
  metalTypes: PRODUCT_METAL_TYPES.map((item) => item.value),
  metalVariants: [...PRODUCT_METAL_VARIANTS.Gold, ...PRODUCT_METAL_VARIANTS.Silver].map((item) => item.value),
  genders: ['Unisex', 'Men', 'Women'],
  priceModes: ['spot-multiplier', 'manual'],
} as const;

const MAX_TEXT_LENGTH = 2400;
const MAX_SHORT_TEXT_LENGTH = 180;
const MAX_PRICE = 1_000_000;

function cleanString(value: unknown, maxLength = MAX_TEXT_LENGTH): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const cleaned = String(value).replace(/\u0000/g, '').trim();
  if (!cleaned) return null;
  return cleaned.slice(0, maxLength);
}

// Measured specs that live in their own fields must never appear in the title. The prompt
// forbids them, but enforce it here so a model slip (e.g. "13.44 g", "1.6 in", "size 7",
// "20 mm", "$1,200") can never reach the title. Karat/metal descriptors like "14K" or
// "18 carat gold" are intentionally preserved — they identify the item, not a spec field.
const TITLE_SPEC_PATTERNS: RegExp[] = [
  /\b\d+(?:\.\d+)?\s*(?:grams?|gms?|gr|g|dwt|ozt|oz)\b\.?/gi, // weight: 13.44 g, 2 dwt, 1.2 oz
  /\b\d+(?:\.\d+)?\s*(?:millimeters?|mm|centimeters?|cm)\b\.?/gi, // dimensions: 20 mm, 4.3 cm
  /\b\d+(?:\.\d+)?\s*(?:inch(?:es)?|in)\b\.?/gi, // length: 1.6 in, 7 inches
  /\d+(?:\.\d+)?\s*"/g, // length in inch-mark form: 18"
  /\b(?:sizes?|sz)\s*\d+(?:\.\d+)?\b/gi, // ring/bracelet size: size 7, sz 6.5
  /(?<![\dkK])\b(?:800|850|900|925|950|999)\b(?![\dkK])/g, // bare millesimal purity: 925
  /\$\s*\d[\d,]*(?:\.\d+)?\b/g, // price: $1,200
];

// Minor hardware and findings clutter the title without identifying the item — clasp type,
// jump rings, end links, closures. Strip them too. Each descriptor word is only consumed
// when immediately followed by "clasp"/"closure", so real item nouns (e.g. "Hook Earrings",
// "Box Link Necklace", "Toggle-Bar Necklace") are preserved.
const TITLE_TRIVIA_PATTERNS: RegExp[] = [
  /\s*(?:,\s*|with\s+|featuring\s+|and\s+(?:a\s+)?|w\/\s*)?(?:(?:lobster(?:\s+claw)?|spring[-\s]?ring|toggle|box|fold[-\s]?over|push|barrel|hook|fish[-\s]?hook|s[-\s]?hook|magnetic|screw|snap|bolt[-\s]?ring|bayonet|fishhook)\s+)?(?:clasps?|closures?|fastenings?)\b\.?/gi,
  /\s*(?:,\s*|with\s+|and\s+(?:a\s+)?)?(?:jump[-\s]?rings?|spring[-\s]?rings?|end[-\s]?links?|findings?)\b\.?/gi,
];

function cleanTitle(value: unknown): string | null {
  const raw = cleanString(value, MAX_SHORT_TEXT_LENGTH);
  if (!raw) return null;
  let out = raw;
  for (const pattern of TITLE_SPEC_PATTERNS) out = out.replace(pattern, ' ');
  for (const pattern of TITLE_TRIVIA_PATTERNS) out = out.replace(pattern, ' ');
  out = out
    // Drop connective words left dangling once their spec/finding was removed (e.g. "Ring With" / "weighing").
    .replace(/\s+(?:with|featuring|and|weigh(?:s|ing)?|measur(?:es|ing)|total(?:ing)?|approx(?:imately)?)\s*(?=$|[,.;:)\]])/gi, ' ')
    .replace(/\s{2,}/g, ' ') // collapse gaps left by removals
    .replace(/\s+([,.;:])/g, '$1') // tidy space before punctuation
    .replace(/[\s,;:.–—-]+$/g, '') // trailing separators/dashes
    .replace(/^[\s,;:.–—-]+/g, '') // leading separators/dashes
    .trim();
  return out || null;
}

function cleanStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => cleanString(item, 260)).filter((item): item is string => Boolean(item));
}

function cleanNumber(value: unknown, options: { min?: number; max?: number; decimals?: number } = {}): number | null {
  if (value == null) return null;
  // Guard against empty/whitespace strings: Number('') is 0, which would otherwise
  // pass a `min: 0` check and silently populate a field the model never set.
  const cleaned = typeof value === 'number' ? value : String(value).replace(/[$,\s]/g, '');
  if (cleaned === '') return null;
  const numeric = typeof cleaned === 'number' ? cleaned : Number(cleaned);
  if (!Number.isFinite(numeric)) return null;
  if (options.min != null && numeric < options.min) return null;
  if (options.max != null && numeric > options.max) return null;
  const multiplier = 10 ** (options.decimals ?? 2);
  return Math.round(numeric * multiplier) / multiplier;
}

function cleanGender(value: unknown): ProductAutofillFields['gender'] {
  const normalized = cleanString(value, MAX_SHORT_TEXT_LENGTH)?.toLowerCase();
  if (!normalized) return null;
  if (normalized === 'unisex') return 'Unisex';
  if (normalized === 'men' || normalized === 'mens' || normalized === "men's" || normalized === 'male') return 'Men';
  if (normalized === 'women' || normalized === 'womens' || normalized === "women's" || normalized === 'female' || normalized === 'ladies') return 'Women';
  return null;
}

function cleanPriceMode(value: unknown): ProductAutofillFields['price_mode'] {
  const normalized = cleanString(value, MAX_SHORT_TEXT_LENGTH)?.toLowerCase().replace(/[_-]+/g, ' ');
  if (!normalized) return null;
  if (normalized === 'spot' || normalized === 'spot multiplier' || normalized === 'spot x multiplier') return 'spot-multiplier';
  if (normalized === 'manual' || normalized === 'fixed' || normalized === 'manual fixed') return 'manual';
  return null;
}

function cleanPurity(value: unknown): number | null {
  const raw = cleanString(value, MAX_SHORT_TEXT_LENGTH);
  if (!raw) return null;
  const match = raw.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(?:k|karat|%)?$/);
  const numeric = match ? Number(match[1]) : Number(raw);
  if (!Number.isFinite(numeric)) return null;
  const allowed = [10, 14, 18, 22, 24, 800, 850, 900, 925, 950, 999];
  return allowed.includes(numeric) ? numeric : null;
}

function cleanMetalVariant(value: unknown, fallbackCategory: Product['category'] = 'Gold'): ProductMetalVariant | null {
  const raw = cleanString(value, MAX_SHORT_TEXT_LENGTH);
  if (!raw) return null;
  const normalized = normalizeProductMetalVariant(raw, fallbackCategory);
  const allValues = [...PRODUCT_METAL_VARIANTS.Gold, ...PRODUCT_METAL_VARIANTS.Silver].map((item) => item.value);
  return allValues.includes(normalized) ? normalized : null;
}

function cleanLength(value: unknown): string | null {
  const raw = cleanString(value, MAX_SHORT_TEXT_LENGTH);
  if (!raw) return null;
  // Accept only a single numeric value (optionally with an inch unit). Reject ranges
  // like "6 to 6.25 inches" and any free text — the field stores one measurement.
  const match = raw.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(?:in(?:ch(?:es?)?)?|")?$/);
  if (!match) return null;
  return normalizeProductLengthSizeValue(match[0]);
}

function cleanConfidence(value: unknown): ProductAutofillDraft['confidence'] {
  if (!value || typeof value !== 'object') return {};
  const confidence: ProductAutofillDraft['confidence'] = {};
  for (const key of PRODUCT_AUTOFILL_FIELD_KEYS) {
    const raw = (value as Record<string, unknown>)[key];
    if (raw === 'low' || raw === 'medium' || raw === 'high') confidence[key] = raw;
  }
  return confidence;
}

export function coerceProductAutofill(input: ProductAutofillProviderResult): ProductAutofillDraft {
  // Models sometimes return the fields flat at the top level instead of nested under `fields`.
  // Prefer a non-empty nested `fields` object; otherwise read from the top-level object.
  const nestedFields = input.fields;
  const rawFields = (
    nestedFields && typeof nestedFields === 'object' && !Array.isArray(nestedFields) && Object.keys(nestedFields).length > 0
      ? nestedFields
      : input
  ) as Partial<Record<keyof ProductAutofillFields, unknown>>;
  const fallbackMetalType = cleanString(rawFields.metal_type, MAX_SHORT_TEXT_LENGTH);
  const metalType = fallbackMetalType ? normalizeProductMetalType(fallbackMetalType, 'Gold') : null;
  const fallbackCategory: Product['category'] = metalType === 'Silver' || metalType === 'Platinum' || metalType === 'Palladium' ? 'Silver' : 'Gold';
  const productType = normalizeProductJewelryType(cleanString(rawFields.product_type, MAX_SHORT_TEXT_LENGTH));

  const fields: ProductAutofillFields = {
    title: cleanTitle(rawFields.title),
    product_type: productType,
    brand: cleanString(rawFields.brand, MAX_SHORT_TEXT_LENGTH),
    metal_type: metalType,
    metal_variant: cleanMetalVariant(rawFields.metal_variant, fallbackCategory),
    gender: cleanGender(rawFields.gender),
    chain_type: cleanString(rawFields.chain_type, MAX_SHORT_TEXT_LENGTH),
    length: cleanLength(rawFields.length),
    price_mode: cleanPriceMode(rawFields.price_mode),
    purity: cleanPurity(rawFields.purity),
    weight_grams: cleanNumber(rawFields.weight_grams, { min: 0.01, max: 100000, decimals: 2 }),
    pricing_multiplier: cleanNumber(rawFields.pricing_multiplier, { min: 0.01, max: 100, decimals: 3 }),
    asking_price: cleanNumber(rawFields.asking_price, { min: 0, max: MAX_PRICE, decimals: 2 }),
    manual_price_label: cleanString(rawFields.manual_price_label, MAX_SHORT_TEXT_LENGTH),
    description: cleanString(rawFields.description),
    public_notes: cleanString(rawFields.public_notes),
  };

  if (fields.product_type && fields.product_type !== 'Necklace' && fields.product_type !== 'Bracelet') {
    fields.chain_type = null;
  }
  if (fields.product_type && fields.product_type !== 'Necklace' && fields.product_type !== 'Bracelet' && fields.product_type !== 'Ring') {
    fields.length = null;
  }

  return {
    fields,
    warnings: cleanStringArray(input.warnings),
    uncertainties: cleanStringArray(input.uncertainties),
    confidence: cleanConfidence(input.confidence),
  };
}
