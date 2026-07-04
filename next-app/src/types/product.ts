export type ProductStatus =
  | 'draft'
  | 'available'
  | 'reserved'
  | 'pending_payment'
  | 'sold'
  | 'archived'
  | 'Available'
  | 'Sold';

export type ProductLocation =
  | 'showcase'
  | 'safe'
  | 'offsite'
  | 'shipped'
  | 'picked_up';

export type ProductMetalVariant =
  | 'yellow_gold'
  | 'white_gold'
  | 'rose_gold'
  | 'tricolor_gold'
  | 'bicolor_gold'
  | 'silver'
  | 'vermeil'
  | 'platinum';

export type ProductMetalType =
  | 'Gold'
  | 'Silver'
  | 'Platinum'
  | 'Palladium'
  | 'Mixed Metal'
  | 'Non-Metal'
  | 'Other';

export type ProductJewelryType =
  | 'Necklace'
  | 'Bracelet'
  | 'Ring'
  | 'Pendant'
  | 'Charm'
  | 'Earrings'
  | 'Brooch'
  | 'Cufflinks'
  | 'Watch'
  | 'Coin'
  | 'Bullion'
  | 'Silverware'
  | 'Other';

export type ProductImagePadding = 'none' | 'white' | 'black';
export type ProductImagePaddingMap = Record<string, ProductImagePadding | string | null | undefined>;
const PRODUCT_IMAGE_PADDING_HEX_PATTERN = /^#[0-9a-f]{6}$/i;

export interface Product {
  id: string;
  category: 'Gold' | 'Silver';
  metal_type: ProductMetalType | string | null;
  metal_variant: ProductMetalVariant | string | null;
  title: string;
  title_es: string | null;
  price_label: string | null;
  manual_price_label: string | null;
  price_mode: 'spot-multiplier' | 'manual';
  purity: number | null;
  weight_grams: number | null;
  inventory_number: number | null;
  sku: string | null;
  slug: string | null;
  metal: string | null;
  gram_weight: number | null;
  stone_details: string | null;
  brand: string | null;
  product_type: ProductJewelryType | string | null;
  jewelry_type: ProductJewelryType | string | null;
  chain_type: string | null;
  length: string | null;
  pricing_multiplier: number | null;
  status: ProductStatus;
  location: ProductLocation | string | null;
  images: string[];
  image_urls: string[];
  image_padding: ProductImagePadding | string | null;
  image_padding_by_image: ProductImagePaddingMap | null;
  description: string | null;
  description_es: string | null;
  details: string[];
  details_es: string[];
  tags: string[];
  tags_es: string[];
  private_price_label: string | null;
  gender: string | null;
  item_year: number | null;
  cost_basis: number | null;
  melt_value: number | null;
  asking_price: number | null;
  minimum_price: number | null;
  live_spot_snapshot: Record<string, unknown> | null;
  acquisition_date: string | null;
  acquisition_source: string | null;
  internal_notes: string | null;
  public_notes: string | null;
  public_notes_es: string | null;
  featured: boolean | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export function normalizeProductImagePadding(value: string | null | undefined): ProductImagePadding {
  const normalized = String(value ?? '').trim().toLowerCase().replace(/[_\s-]+/g, '_');
  if (normalized === 'white') return 'white';
  if (normalized === 'black') return 'black';
  return 'none';
}

export function normalizeProductImagePaddingValue(value: string | null | undefined): ProductImagePadding | string {
  const raw = String(value ?? '').trim();
  if (PRODUCT_IMAGE_PADDING_HEX_PATTERN.test(raw)) return raw.toLowerCase();
  return normalizeProductImagePadding(raw);
}

export function isProductImagePaddingCustomColor(value: string | null | undefined): boolean {
  return PRODUCT_IMAGE_PADDING_HEX_PATTERN.test(String(value ?? '').trim());
}

export function hasProductImagePadding(value: string | null | undefined): boolean {
  return normalizeProductImagePaddingValue(value) !== 'none';
}

export function productImagePaddingBackground(value: string | null | undefined): string {
  const normalized = normalizeProductImagePaddingValue(value);
  if (isProductImagePaddingCustomColor(normalized)) return normalized;
  if (normalized === 'white') return '#ffffff';
  if (normalized === 'black') return '#000000';
  return 'var(--color-surface-container)';
}

export function normalizeProductImagePaddingMap(value: unknown): ProductImagePaddingMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([key, padding]) => [key, normalizeProductImagePaddingValue(String(padding ?? 'none'))])
      .filter(([key]) => key.trim().length > 0),
  );
}

export function productImagePaddingMapKey(image: string | null | undefined, index: number): string {
  return image?.trim() || String(index);
}

export function productImagePaddingForImage(
  fallback: string | null | undefined,
  map: ProductImagePaddingMap | null | undefined,
  image: string | null | undefined,
  index: number,
): ProductImagePadding | string {
  const normalizedMap = normalizeProductImagePaddingMap(map);
  const key = productImagePaddingMapKey(image, index);
  if (Object.prototype.hasOwnProperty.call(normalizedMap, key)) {
    return normalizeProductImagePaddingValue(normalizedMap[key]);
  }
  if (Object.prototype.hasOwnProperty.call(normalizedMap, String(index))) {
    return normalizeProductImagePaddingValue(normalizedMap[String(index)]);
  }
  return normalizeProductImagePaddingValue(fallback);
}

export function hasAnyProductImagePadding(
  fallback: string | null | undefined,
  map: ProductImagePaddingMap | null | undefined,
): boolean {
  return hasProductImagePadding(fallback)
    || Object.values(normalizeProductImagePaddingMap(map)).some((value) => hasProductImagePadding(value));
}

export interface SpotData {
  goldPerTroyOz: number;
  silverPerTroyOz: number | null;
  fetchedAt: number;
  source: 'api' | 'fallback';
}

// The year the physical jewelry item was made (e.g. 1930), not the date the
// listing was created. Accepts a number or a numeric string and validates a
// sane range; anything else normalizes to null.
export function normalizeProductItemYear(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const cleaned = String(value).trim();
  if (!cleaned || !/^\d{1,4}$/.test(cleaned)) return null;
  const year = Number(cleaned);
  if (!Number.isInteger(year) || year < 1 || year > 2200) return null;
  return year;
}

export function formatProductItemYear(value: string | number | null | undefined): string | null {
  const normalized = normalizeProductItemYear(value);
  return normalized === null ? null : String(normalized);
}

export function normalizeProductStatus(status: ProductStatus | null | undefined): ProductStatus {
  const value = String(status ?? 'available').toLowerCase().replace(/\s+/g, '_');
  if (value === 'draft') return 'draft';
  if (value === 'reserved') return 'reserved';
  if (value === 'pending_payment') return 'pending_payment';
  if (value === 'sold') return 'sold';
  if (value === 'archived') return 'archived';
  return 'available';
}

export function isProductSold(status: ProductStatus | null | undefined): boolean {
  return normalizeProductStatus(status) === 'sold';
}

export function isProductPurchasable(status: ProductStatus | null | undefined): boolean {
  return normalizeProductStatus(status) === 'available';
}

export const PUBLIC_SHOP_PRODUCT_STATUSES = ['available', 'sold', 'Available', 'Sold'] as const;

// Statuses shown when the admin has turned OFF "show sold items" — available only.
export const AVAILABLE_ONLY_SHOP_PRODUCT_STATUSES = ['available', 'Available'] as const;

export function isProductVisibleInShop(status: ProductStatus | null | undefined): boolean {
  const normalized = normalizeProductStatus(status);
  return normalized === 'available' || normalized === 'sold';
}

export function productStatusLabel(status: ProductStatus | null | undefined): string {
  const normalized = normalizeProductStatus(status);
  if (normalized === 'pending_payment') return 'Pending Payment';
  return normalized.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

export const PRODUCT_METAL_VARIANTS: Record<'Gold' | 'Silver', { value: ProductMetalVariant; label: string; labelEs: string }[]> = {
  Gold: [
    { value: 'yellow_gold', label: 'Yellow Gold', labelEs: 'Oro amarillo' },
    { value: 'white_gold', label: 'White Gold', labelEs: 'Oro blanco' },
    { value: 'rose_gold', label: 'Rose Gold', labelEs: 'Oro rosa' },
    { value: 'tricolor_gold', label: 'Tricolor Gold', labelEs: 'Oro tricolor' },
    { value: 'bicolor_gold', label: 'Bicolor Gold', labelEs: 'Oro bicolor' },
  ],
  Silver: [
    { value: 'silver', label: 'Silver', labelEs: 'Plata' },
    { value: 'vermeil', label: 'Vermeil', labelEs: 'Vermeil' },
    { value: 'platinum', label: 'Platinum', labelEs: 'Platino' },
  ],
};

export const PRODUCT_METAL_TYPES: { value: ProductMetalType; label: string; labelEs: string }[] = [
  { value: 'Gold', label: 'Gold', labelEs: 'Oro' },
  { value: 'Silver', label: 'Silver', labelEs: 'Plata' },
  { value: 'Platinum', label: 'Platinum', labelEs: 'Platino' },
  { value: 'Palladium', label: 'Palladium', labelEs: 'Paladio' },
  { value: 'Mixed Metal', label: 'Mixed Metal', labelEs: 'Metal mixto' },
  { value: 'Non-Metal', label: 'Non-Metal', labelEs: 'No metal' },
  { value: 'Other', label: 'Other', labelEs: 'Otro' },
];

export const PRODUCT_JEWELRY_TYPES: { value: ProductJewelryType; label: string; labelEs: string }[] = [
  { value: 'Necklace', label: 'Necklace', labelEs: 'Collar' },
  { value: 'Bracelet', label: 'Bracelet', labelEs: 'Pulsera' },
  { value: 'Ring', label: 'Ring', labelEs: 'Anillo' },
  { value: 'Pendant', label: 'Pendant', labelEs: 'Dije' },
  { value: 'Charm', label: 'Charm', labelEs: 'Charm' },
  { value: 'Earrings', label: 'Earrings', labelEs: 'Aretes' },
  { value: 'Brooch', label: 'Brooch', labelEs: 'Broche' },
  { value: 'Cufflinks', label: 'Cufflinks', labelEs: 'Gemelos' },
  { value: 'Watch', label: 'Watch', labelEs: 'Reloj' },
  { value: 'Coin', label: 'Coin', labelEs: 'Moneda' },
  { value: 'Bullion', label: 'Bullion', labelEs: 'Lingote' },
  { value: 'Silverware', label: 'Silverware / Sterling', labelEs: 'Plateria / sterling' },
  { value: 'Other', label: 'Other', labelEs: 'Otro' },
];

export const PRODUCT_LINK_TYPES = [
  'Cuban link',
  'Figaro link',
  'Rope chain',
  'Anchor / Gucci link',
  'Oval link',
  'Byzantine link',
  'Box link',
  'Other',
] as const;

const JEWELRY_TYPE_KEYWORDS: Record<ProductJewelryType, string[]> = {
  Necklace: ['necklace', 'chain', 'collar', 'cadena'],
  Bracelet: ['bracelet', 'bangle', 'pulsera', 'esclava'],
  Ring: ['ring', 'band', 'anillo'],
  Pendant: ['pendant', 'dije'],
  Charm: ['charm', 'charms'],
  Earrings: ['earring', 'earrings', 'arete', 'aretes'],
  Brooch: ['brooch', 'pin', 'broche'],
  Cufflinks: ['cufflink', 'cufflinks', 'gemelo', 'gemelos'],
  Watch: ['watch', 'watches', 'wristwatch', 'wrist watch', 'timepiece', 'reloj'],
  Coin: ['coin', 'coins', 'moneda'],
  Bullion: ['bullion', 'bar', 'round', 'ingot', 'lingote'],
  Silverware: ['silverware', 'flatware', 'hollowware', 'plateria'],
  Other: ['other'],
};

export function normalizeProductJewelryType(value: string | null | undefined): ProductJewelryType | null {
  const normalized = String(value ?? '').trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
  if (!normalized) return null;
  const direct = PRODUCT_JEWELRY_TYPES.find((type) => type.value.toLowerCase() === normalized || type.label.toLowerCase() === normalized || type.labelEs.toLowerCase() === normalized);
  if (direct) return direct.value;
  if (normalized === 'necklaces' || normalized === 'chain' || normalized === 'chains') return 'Necklace';
  if (normalized === 'bracelets' || normalized === 'bangle') return 'Bracelet';
  if (normalized === 'rings' || normalized === 'band') return 'Ring';
  if (normalized === 'pendants') return 'Pendant';
  if (normalized === 'charms') return 'Charm';
  if (normalized === 'earring') return 'Earrings';
  if (normalized === 'brooches' || normalized === 'pin') return 'Brooch';
  if (normalized === 'cufflink' || normalized === 'cufflinks' || normalized === 'cuff links' || normalized === 'gemelo' || normalized === 'gemelos') return 'Cufflinks';
  if (normalized === 'watches' || normalized === 'wristwatch' || normalized === 'wrist watch' || normalized === 'timepiece' || normalized === 'timepieces') return 'Watch';
  if (normalized === 'coins') return 'Coin';
  if (normalized === 'bars' || normalized === 'round' || normalized === 'rounds' || normalized === 'ingot') return 'Bullion';
  if (normalized === 'flatware' || normalized === 'hollowware') return 'Silverware';
  return null;
}

export const normalizeProductType = normalizeProductJewelryType;

export function normalizeProductTypeValue(value: string | null | undefined): string | null {
  const cleaned = String(value ?? '').replace(/\u0000/g, '').trim().replace(/\s+/g, ' ');
  if (!cleaned) return null;
  return normalizeProductJewelryType(cleaned) ?? cleaned.slice(0, 80);
}

export function normalizeProductMetalType(value: string | null | undefined, fallback: Product['category'] = 'Gold'): ProductMetalType {
  const normalized = String(value ?? '').trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
  const direct = PRODUCT_METAL_TYPES.find((type) => type.value.toLowerCase() === normalized || type.label.toLowerCase() === normalized || type.labelEs.toLowerCase() === normalized);
  if (direct) return direct.value;
  if (normalized === 'mixed' || normalized === 'mixed metals') return 'Mixed Metal';
  if (normalized === 'non metal' || normalized === 'nonmetal' || normalized === 'none') return 'Non-Metal';
  return fallback;
}

export function getJewelryTypeFromTags(tags: string[] | null | undefined): string | null {
  const tag = (tags ?? []).find((item) => item.startsWith('jt:'));
  return normalizeProductTypeValue(tag?.slice(3));
}

export function inferProductJewelryType(product: Pick<Product, 'title' | 'title_es' | 'chain_type' | 'tags' | 'tags_es' | 'jewelry_type'> & { product_type?: string | null }): string {
  const direct = normalizeProductTypeValue(product.product_type) ?? normalizeProductTypeValue(product.jewelry_type) ?? getJewelryTypeFromTags(product.tags);
  if (direct && direct !== 'Other') return direct;
  const text = [product.title, product.title_es, product.chain_type, ...(product.tags ?? []), ...(product.tags_es ?? [])]
    .join(' ')
    .toLowerCase();
  for (const type of PRODUCT_JEWELRY_TYPES) {
    if (type.value === 'Other') continue;
    if (JEWELRY_TYPE_KEYWORDS[type.value].some((keyword) => text.includes(keyword))) return type.value;
  }
  return 'Other';
}

export function productJewelryTypeLabel(value: string | null | undefined, locale = 'en'): string {
  const cleaned = normalizeProductTypeValue(value) ?? 'Other';
  const normalized = normalizeProductJewelryType(cleaned);
  const option = PRODUCT_JEWELRY_TYPES.find((type) => type.value === normalized);
  return locale === 'es' ? option?.labelEs ?? cleaned : option?.label ?? cleaned;
}

export const productTypeLabel = productJewelryTypeLabel;

export function productMetalTypeLabel(value: string | null | undefined, category: Product['category'] = 'Gold', locale = 'en'): string {
  const normalized = normalizeProductMetalType(value, category);
  const option = PRODUCT_METAL_TYPES.find((type) => type.value === normalized);
  return locale === 'es' ? option?.labelEs ?? normalized : option?.label ?? normalized;
}

export function productSupportsLinkType(jewelryType: string | null | undefined): boolean {
  const normalized = normalizeProductJewelryType(jewelryType);
  return normalized === 'Necklace' || normalized === 'Bracelet';
}

export function normalizeProductLengthSizeValue(value: string | null | undefined): string {
  const raw = String(value ?? '').trim().replace(/\s+/g, ' ');
  if (!raw) return '';
  const numericMeasurement = raw.match(/^(\d+(?:\.\d+)?)\s*(?:in(?:ch(?:es?)?)?\.?|")?$/i);
  if (numericMeasurement) return numericMeasurement[1];
  const ringSize = raw.match(/^size\s*:?\s*(\d+(?:\.\d+)?)$/i);
  return ringSize ? ringSize[1] : raw;
}

export function productLengthSizeDisplay(
  product: Pick<Product, 'length' | 'tags' | 'jewelry_type' | 'product_type' | 'title' | 'title_es' | 'chain_type' | 'tags_es'>,
): string | null {
  const rawValue = product.length ?? (product.tags ?? []).find((tag) => tag.startsWith('len:'))?.slice(4) ?? null;
  const value = rawValue?.trim().replace(/\s+/g, ' ');
  if (!value) return null;

  if (inferProductJewelryType(product) === 'Ring') return `Size: ${value.replace(/^size:\s*/i, '')}`;

  const inchValue = value.match(/\d+(?:\.\d+)?/);
  return inchValue ? `${inchValue[0]} in` : value;
}

export function normalizeProductLinkType(value: string | null | undefined): string | null {
  const normalized = String(value ?? '').trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
  if (!normalized) return null;
  const matched = PRODUCT_LINK_TYPES.find((linkType) => {
    const link = linkType.toLowerCase();
    const shorthand = link.replace(/\s+(link|chain)$/i, '');
    return normalized === link || normalized === shorthand;
  });
  return matched ?? null;
}

export function getDefaultMetalVariant(category: Product['category']): ProductMetalVariant {
  return category === 'Silver' ? 'silver' : 'yellow_gold';
}

export function normalizeProductMetalVariant(
  value: string | null | undefined,
  category: Product['category'],
): ProductMetalVariant {
  const normalized = String(value ?? '').toLowerCase().trim().replace(/[-\s]+/g, '_');
  const allVariants = [...PRODUCT_METAL_VARIANTS.Gold, ...PRODUCT_METAL_VARIANTS.Silver].map((variant) => variant.value);
  if ((allVariants as string[]).includes(normalized)) return normalized as ProductMetalVariant;
  return getDefaultMetalVariant(category);
}

export function productMetalVariantLabel(
  value: string | null | undefined,
  category: Product['category'],
  locale = 'en',
): string {
  const normalized = normalizeProductMetalVariant(value, category);
  const option = [...PRODUCT_METAL_VARIANTS.Gold, ...PRODUCT_METAL_VARIANTS.Silver]
    .find((variant) => variant.value === normalized);
  if (!option) return category;
  return locale === 'es' ? option.labelEs : option.label;
}
