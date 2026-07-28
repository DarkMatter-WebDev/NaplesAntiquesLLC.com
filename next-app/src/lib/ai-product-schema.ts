import {
  PRODUCT_JEWELRY_TYPES,
  PRODUCT_METAL_TYPES,
  PRODUCT_METAL_VARIANTS,
  normalizeProductItemYear,
  normalizeProductLengthSizeValue,
  normalizeProductMetalType,
  normalizeProductMetalVariant,
  normalizeProductTypeValue,
  normalizeProductWidthMm,
  type Product,
  type ProductMetalType,
  type ProductMetalVariant,
} from '@/types/product';

export type ProductAutofillConfidence = 'low' | 'medium' | 'high';

export type ProductAutofillFields = {
  title: string | null;
  product_type: string | null;
  brand: string | null;
  metal_type: ProductMetalType | null;
  metal_variant: ProductMetalVariant | null;
  gender: 'Unisex' | 'Men' | 'Women' | null;
  chain_type: string | null;
  length: string | null;
  width_mm: number | null;
  price_mode: 'spot-multiplier' | 'manual' | null;
  purity: number | null;
  weight_grams: number | null;
  item_year: number | null;
  pricing_multiplier: number | null;
  asking_price: number | null;
  manual_price_label: string | null;
  show_spot_price: boolean | null;
  quantity: number | null;
  description: string | null;
  public_notes: string | null;
};

export type ProductAutofillReviewReason =
  | 'changes-existing-value'
  | 'sensitive-field'
  | 'low-confidence'
  | 'medium-confidence'
  | 'missing-confidence';

export type ProductAutofillProposedChange = {
  field: keyof ProductAutofillFields;
  current_value: ProductAutofillFields[keyof ProductAutofillFields];
  proposed_value: ProductAutofillFields[keyof ProductAutofillFields];
  confidence: ProductAutofillConfidence | null;
  reasons: ProductAutofillReviewReason[];
  question: string;
};

export type ProductAutofillReview = {
  auto_apply_fields: (keyof ProductAutofillFields)[];
  pending_changes: ProductAutofillProposedChange[];
};

export type ProductAutofillDraft = {
  fields: ProductAutofillFields;
  warnings: string[];
  uncertainties: string[];
  confidence: Partial<Record<keyof ProductAutofillFields, ProductAutofillConfidence>>;
  assistant_message: string | null;
  follow_up_questions: string[];
  review?: ProductAutofillReview;
};

export type ProductAutofillProviderResult = Omit<
  Partial<ProductAutofillDraft>,
  'fields' | 'warnings' | 'uncertainties' | 'confidence' | 'assistant_message' | 'follow_up_questions' | 'review'
> & {
  fields?: Partial<Record<keyof ProductAutofillFields, unknown>>;
  warnings?: unknown;
  uncertainties?: unknown;
  confidence?: unknown;
  assistant_message?: unknown;
  follow_up_questions?: unknown;
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
  'width_mm',
  'price_mode',
  'purity',
  'weight_grams',
  'item_year',
  'pricing_multiplier',
  'asking_price',
  'manual_price_label',
  'show_spot_price',
  'quantity',
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
  width_mm: null,
  price_mode: null,
  purity: null,
  weight_grams: null,
  item_year: null,
  pricing_multiplier: null,
  asking_price: null,
  manual_price_label: null,
  show_spot_price: null,
  quantity: null,
  description: null,
  public_notes: null,
};

export const PRODUCT_AUTOFILL_FIELD_LABELS: Record<keyof ProductAutofillFields, string> = {
  title: 'Title (English)',
  product_type: 'Product Type',
  brand: 'Brand',
  metal_type: 'Metal Type',
  metal_variant: 'Metal Color',
  gender: 'Gender',
  chain_type: 'Link Type',
  length: 'Length / Size',
  width_mm: 'Width (mm)',
  price_mode: 'Price Mode',
  purity: 'Purity',
  weight_grams: 'Weight (g)',
  item_year: 'Date (Year Made)',
  pricing_multiplier: 'Multiplier',
  asking_price: 'Asking Price',
  manual_price_label: 'Price Label',
  show_spot_price: 'Show Spot/Melt Value',
  quantity: 'Quantity',
  description: 'Description (English)',
  public_notes: 'Notes (English)',
};

const SENSITIVE_REVIEW_FIELDS = new Set<keyof ProductAutofillFields>([
  'chain_type',
  'length',
  'width_mm',
  'price_mode',
  'purity',
  'weight_grams',
  'pricing_multiplier',
  'asking_price',
  'manual_price_label',
  'show_spot_price',
]);

export const PRODUCT_AUTOFILL_SCHEMA = {
  name: 'product_listing_draft',
  description: 'Nullable catalog fields for a Naples Estate Jewelry product listing. Product type may be one of the common values or a concise new item form when the item does not fit the list. Do not return operational fields (status, location) — they are not AI-controlled.',
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

function cleanAssistantMessage(value: unknown): string | null {
  const cleaned = cleanString(value, 1200);
  if (!cleaned) return null;
  return cleaned
    .replace(/\*\*/g, '')
    .replace(/__+/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\s+-\s+(?=[A-Z0-9])/g, '\n')
    .trim();
}

function addRequiredFollowUpQuestions(
  fields: ProductAutofillFields,
  questions: string[],
): string[] {
  const next = [...questions];
  const add = (question: string) => {
    if (!next.some((item) => item.toLowerCase() === question.toLowerCase())) next.push(question);
  };

  if (!fields.title) add('What title or identifying details should be used for this item?');
  if (!fields.product_type) add('What type of item is this?');
  if (fields.price_mode === 'spot-multiplier') {
    if (fields.purity == null) add('What purity or hallmark does the item have?');
    if (fields.weight_grams == null) add('What is the item’s weight in grams?');
  }
  if (fields.price_mode === 'manual' && !fields.manual_price_label && fields.asking_price == null) {
    add('What price should be shown for this item?');
  }

  return next.slice(0, 12);
}

const SELLER_ATTRIBUTION_PATTERNS: RegExp[] = [
  /\b(?:the\s+)?seller\s+(?:suggests?|recommends?|believes?|thinks?|says?|states?|reports?|describes?|identifies?|calls?|mentions?)\b[^.!?\r\n]*(?:[.!?]|$)/gi,
  /\baccording\s+to\s+(?:the\s+)?seller\b[^.!?\r\n]*(?:[.!?]|$)/gi,
  /\b(?:seller|owner)[-'\s](?:suggested|recommended|believed|thought|stated|reported|described|identified)\b[^.!?\r\n]*(?:[.!?]|$)/gi,
];

export function sanitizeBuyerFacingText(value: string | null): { value: string | null; removed: string[] } {
  if (!value) return { value: null, removed: [] };

  const removed: string[] = [];
  let cleaned = value;
  for (const pattern of SELLER_ATTRIBUTION_PATTERNS) {
    cleaned = cleaned.replace(pattern, (match) => {
      const suggestion = match.trim();
      if (suggestion) removed.push(suggestion);
      return ' ';
    });
  }

  cleaned = cleaned
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;:])/g, '$1')
    .trim();

  if (removed.length > 0) {
    cleaned = cleaned.replace(/^[\s,.;:]+|[\s,.;:]+$/g, '').trim();
  }

  return { value: cleaned || null, removed };
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

function cleanBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
    return null;
  }
  const normalized = cleanString(value, MAX_SHORT_TEXT_LENGTH)?.toLowerCase();
  if (!normalized) return null;
  if (['true', 'yes', 'show', 'shown', 'visible'].includes(normalized)) return true;
  if (['false', 'no', 'hide', 'hidden', 'do not show', "don't show"].includes(normalized)) return false;
  return null;
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
  // Accept bare numbers, karat marks ("14K", "18K"), plumb-gold suffix ("14KP"),
  // karat-spelled-out ("14KT", "14 karat"), and millesimal fineness ("925", "800/1000").
  const match = raw.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(?:k(?:[pt])?|karat|%|\/1000)?$/);
  const numeric = match ? Number(match[1]) : Number(raw);
  if (!Number.isFinite(numeric)) return null;
  // Gold karat (1–24) or silver/metal millesimal fineness as parts per 1000
  // (e.g. 800, 830, 835, 900, 925, 950, 999). Anything else is rejected.
  if (numeric >= 1 && numeric <= 24) return Math.round(numeric);
  if (numeric >= 100 && numeric <= 1000) return Math.round(numeric);
  return null;
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

// Only meaningful when the seller explicitly states they have more than one
// unit of the exact same item (e.g. "I have 3 of these", "listing a pair of
// identical rounds"). Reject 0/negative and anything absurdly large — those
// are almost certainly a misread of some other stated number (a price, a
// weight, a year) rather than a real multi-unit count.
function cleanQuantity(value: unknown): number | null {
  const numeric = cleanNumber(value, { min: 1, max: 500, decimals: 0 });
  return numeric != null ? Math.round(numeric) : null;
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
  const productType = normalizeProductTypeValue(cleanString(rawFields.product_type, MAX_SHORT_TEXT_LENGTH));
  const sellerSuggestions: string[] = [];
  const cleanBuyerField = (value: string | null) => {
    const sanitized = sanitizeBuyerFacingText(value);
    sellerSuggestions.push(...sanitized.removed);
    return sanitized.value;
  };
  const sanitizedTitle = sanitizeBuyerFacingText(cleanString(rawFields.title, MAX_SHORT_TEXT_LENGTH));
  sellerSuggestions.push(...sanitizedTitle.removed);

  const fields: ProductAutofillFields = {
    title: cleanTitle(sanitizedTitle.value),
    product_type: productType,
    brand: cleanString(rawFields.brand, MAX_SHORT_TEXT_LENGTH),
    metal_type: metalType,
    metal_variant: cleanMetalVariant(rawFields.metal_variant, fallbackCategory),
    gender: cleanGender(rawFields.gender),
    chain_type: cleanString(rawFields.chain_type, MAX_SHORT_TEXT_LENGTH),
    length: cleanLength(rawFields.length),
    width_mm: normalizeProductWidthMm(rawFields.width_mm as string | number | null | undefined),
    price_mode: cleanPriceMode(rawFields.price_mode),
    purity: cleanPurity(rawFields.purity),
    weight_grams: cleanNumber(rawFields.weight_grams, { min: 0.01, max: 100000, decimals: 2 }),
    item_year: normalizeProductItemYear(rawFields.item_year as string | number | null | undefined),
    pricing_multiplier: cleanNumber(rawFields.pricing_multiplier, { min: 0.01, max: 100, decimals: 3 }),
    asking_price: cleanNumber(rawFields.asking_price, { min: 0, max: MAX_PRICE, decimals: 2 }),
    manual_price_label: cleanString(rawFields.manual_price_label, MAX_SHORT_TEXT_LENGTH),
    show_spot_price: cleanBoolean(rawFields.show_spot_price),
    quantity: cleanQuantity(rawFields.quantity),
    description: cleanBuyerField(cleanString(rawFields.description)),
    public_notes: cleanBuyerField(cleanString(rawFields.public_notes)),
  };

  if (fields.product_type && fields.product_type !== 'Necklace' && fields.product_type !== 'Bracelet') {
    fields.chain_type = null;
    fields.width_mm = null;
  }
  // The size/length field carries the length for Necklace/Bracelet, the ring size for Ring,
  // and the item's height for every other form (e.g. a 1.5 in brooch, a 0.75 in pendant).
  // It is kept for all product types, so no clearing here.

  // Pricing default: when the draft carries no pricing signal at all — no mode,
  // no multiplier, no manual/asking price — fall back to the standard spot×1.5 so
  // every listing has a usable pricing method even if the model (or a custom/older
  // prompt) omitted it. A stated manual price or an explicit multiplier is left
  // untouched; a spot mode missing its multiplier is completed with the 1.5 default.
  const hasAnyPricingSignal =
    fields.price_mode != null ||
    fields.pricing_multiplier != null ||
    fields.asking_price != null ||
    fields.manual_price_label != null;
  if (!hasAnyPricingSignal) {
    fields.price_mode = 'spot-multiplier';
    fields.pricing_multiplier = 1.5;
  } else if (fields.price_mode === 'spot-multiplier' && fields.pricing_multiplier == null) {
    fields.pricing_multiplier = 1.5;
  }

  const followUpQuestions = addRequiredFollowUpQuestions(
    fields,
    cleanStringArray(input.follow_up_questions),
  );

  return {
    fields,
    warnings: cleanStringArray(input.warnings),
    uncertainties: cleanStringArray([...cleanStringArray(input.uncertainties), ...sellerSuggestions]).slice(0, 10),
    confidence: cleanConfidence(input.confidence),
    assistant_message: cleanAssistantMessage(input.assistant_message),
    follow_up_questions: followUpQuestions,
  };
}

function hasReviewValue(value: ProductAutofillFields[keyof ProductAutofillFields]): boolean {
  return value !== null && value !== '';
}

function formatReviewValue(value: ProductAutofillFields[keyof ProductAutofillFields]): string {
  if (!hasReviewValue(value)) return 'blank';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  const text = String(value);
  return text.length > 90 ? `${text.slice(0, 87)}...` : text;
}

function addUniqueQuestion(questions: string[], question: string) {
  if (!questions.some((item) => item.toLowerCase() === question.toLowerCase())) questions.push(question);
}

function buildReviewQuestion(
  field: keyof ProductAutofillFields,
  currentValue: ProductAutofillFields[keyof ProductAutofillFields],
  proposedValue: ProductAutofillFields[keyof ProductAutofillFields],
): string {
  const label = PRODUCT_AUTOFILL_FIELD_LABELS[field];
  if (hasReviewValue(currentValue)) {
    return `Should I change ${label} from "${formatReviewValue(currentValue)}" to "${formatReviewValue(proposedValue)}"?`;
  }
  return `Can you confirm ${label} should be "${formatReviewValue(proposedValue)}"?`;
}

/**
 * Enforces the admin review boundary independently of model compliance.
 * Only high-confidence, non-sensitive values going into blank fields may be
 * applied automatically. Every overwrite, sensitive fact, or less-certain
 * value remains pending until the admin explicitly accepts it.
 */
export function reviewProductAutofillDraft(
  draft: ProductAutofillDraft,
  currentFields: ProductAutofillFields,
): ProductAutofillDraft {
  const autoApplyFields: (keyof ProductAutofillFields)[] = [];
  const pendingChanges: ProductAutofillProposedChange[] = [];
  const followUpQuestions = [...draft.follow_up_questions];

  for (const field of PRODUCT_AUTOFILL_FIELD_KEYS) {
    const proposedValue = draft.fields[field];
    if (!hasReviewValue(proposedValue)) continue;

    const currentValue = currentFields[field];
    const confidence = draft.confidence[field] ?? null;
    if (Object.is(currentValue, proposedValue)) {
      if (confidence !== 'high') {
        const confidenceLabel = confidence ? `${confidence} confidence` : 'no confidence rating';
        addUniqueQuestion(
          followUpQuestions,
          `Can you confirm the existing ${PRODUCT_AUTOFILL_FIELD_LABELS[field]} value "${formatReviewValue(currentValue)}"? The assistant returned ${confidenceLabel}.`,
        );
      }
      continue;
    }

    const reasons: ProductAutofillReviewReason[] = [];
    if (hasReviewValue(currentValue)) reasons.push('changes-existing-value');
    if (SENSITIVE_REVIEW_FIELDS.has(field)) reasons.push('sensitive-field');
    if (confidence === 'low') reasons.push('low-confidence');
    if (confidence === 'medium') reasons.push('medium-confidence');
    if (confidence === null) reasons.push('missing-confidence');

    if (reasons.length === 0) {
      autoApplyFields.push(field);
      continue;
    }

    const question = buildReviewQuestion(field, currentValue, proposedValue);
    pendingChanges.push({
      field,
      current_value: currentValue,
      proposed_value: proposedValue,
      confidence,
      reasons,
      question,
    });
    addUniqueQuestion(followUpQuestions, question);
  }

  for (const warning of draft.warnings) {
    addUniqueQuestion(
      followUpQuestions,
      `The assistant flagged this possible conflict: ${warning} Can you confirm how it should be handled?`,
    );
  }
  for (const uncertainty of draft.uncertainties) {
    addUniqueQuestion(
      followUpQuestions,
      `The assistant could not verify this: ${uncertainty} Can you clarify it?`,
    );
  }

  const reviewSummary = pendingChanges.length > 0
    ? `I left ${pendingChanges.length} proposed ${pendingChanges.length === 1 ? 'change' : 'changes'} for you to confirm before updating the form.`
    : null;

  return {
    ...draft,
    assistant_message: [draft.assistant_message, reviewSummary].filter(Boolean).join(' ') || null,
    follow_up_questions: followUpQuestions.slice(0, 24),
    review: {
      auto_apply_fields: autoApplyFields,
      pending_changes: pendingChanges,
    },
  };
}
