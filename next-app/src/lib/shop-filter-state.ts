import { normalizeProductLengthSizeValue, PRODUCT_METAL_VARIANTS } from '@/types/product';

export type ShopItemGroup = 'jewelry' | 'everything-else';

export interface ShopFilterState {
  [key: string]: string | string[] | undefined;
  status?: string;
  itemGroup?: string;
  itemType?: string;
  chainType?: string;
  length?: string | string[];
  width?: string | string[];
  metal?: string;
  metalColor?: string;
  metalType?: string;
  purity?: string;
  gender?: string;
  q?: string;
  sort?: string;
}

export const SHOP_WIDTH_RANGE_OPTIONS = [
  { value: 'under-3', label: 'Under 3 mm', labelEs: 'Menos de 3 mm', min: 0, max: 3 },
  { value: '3-4.9', label: '3-4.9 mm', labelEs: '3-4.9 mm', min: 3, max: 5 },
  { value: '5-6.9', label: '5-6.9 mm', labelEs: '5-6.9 mm', min: 5, max: 7 },
  { value: '7-9.9', label: '7-9.9 mm', labelEs: '7-9.9 mm', min: 7, max: 10 },
  { value: '10-plus', label: '10 mm+', labelEs: '10 mm+', min: 10, max: null },
] as const;

const VALID_WIDTH_RANGES = new Set<string>(SHOP_WIDTH_RANGE_OPTIONS.map((option) => option.value));

/** Slug form of the wearable-jewelry split. Must stay in step with
 *  `PRODUCT_WEARABLE_JEWELRY_TYPES` in types/product.ts — a test asserts it. */
export const SHOP_JEWELRY_ITEM_TYPE_KEYS = [
  'necklace',
  'bracelet',
  'earrings',
  'ring',
  'pendant',
  'charm',
  'brooch',
  'cufflinks',
  'watch',
] as const;

const SHOP_JEWELRY_ITEM_TYPES = new Set<string>(SHOP_JEWELRY_ITEM_TYPE_KEYS);
const GOLD_METAL_COLORS = new Set<string>(PRODUCT_METAL_VARIANTS.Gold.map((variant) => variant.value));
const SILVER_METAL_COLORS = new Set<string>(PRODUCT_METAL_VARIANTS.Silver.map((variant) => variant.value));
const VALID_SORTS = new Set([
  'price-asc',
  'price-desc',
  'weight-asc',
  'weight-desc',
  'brand-asc',
  'brand-desc',
]);

export type ShopStatusFilter = 'available' | 'sold';

/** The public shop always displays exactly one inventory status. */
export function normalizeShopStatusFilter(value: string | undefined): ShopStatusFilter {
  return value?.trim().toLowerCase() === 'sold' ? 'sold' : 'available';
}

export function isShopJewelryItemType(itemType: string | undefined): boolean {
  return Boolean(itemType && SHOP_JEWELRY_ITEM_TYPES.has(itemType));
}

export function getExplicitShopItemGroup(value: string | undefined): ShopItemGroup | undefined {
  return value === 'jewelry' || value === 'everything-else' ? value : undefined;
}

export function shopItemTypeSupportsLinkType(itemType: string | undefined): boolean {
  return itemType === 'necklace' || itemType === 'bracelet';
}

export function normalizeShopWidthRanges(width: string | string[] | undefined): string[] {
  const values = Array.isArray(width) ? width : width ? [width] : [];
  return Array.from(new Set(
    values
      .flatMap((value) => value.split(','))
      .map((value) => value.trim())
      .filter((value) => VALID_WIDTH_RANGES.has(value)),
  ));
}

export function normalizeShopLengthInches(length: string | string[] | null | undefined): string[] {
  const values = Array.isArray(length) ? length : length ? [length] : [];
  return Array.from(new Set(
    values
      .flatMap((value) => value.split(','))
      .map((value) => Number(normalizeProductLengthSizeValue(value)))
      .filter((value) => Number.isFinite(value) && value > 0)
      .map(String),
  ));
}

export function productMatchesShopLengthInches(
  length: string | null | undefined,
  selectedLengths: string[],
): boolean {
  if (selectedLengths.length === 0) return true;
  const productLength = normalizeShopLengthInches(length)[0];
  return Boolean(productLength && selectedLengths.includes(productLength));
}

export function productMatchesShopWidthRanges(
  widthMm: number | string | null | undefined,
  selectedRanges: string[],
): boolean {
  if (selectedRanges.length === 0) return true;
  const width = typeof widthMm === 'number' ? widthMm : Number(widthMm);
  if (!Number.isFinite(width) || width <= 0) return false;

  return SHOP_WIDTH_RANGE_OPTIONS.some((option) => (
    selectedRanges.includes(option.value)
    && width >= option.min
    && (option.max == null || width < option.max)
  ));
}

export function filterAvailableShopItemTypeOptions<T extends { value: string }>(
  options: T[],
  presentItemTypes: Iterable<string>,
): T[] {
  const present = new Set(presentItemTypes);
  return options.filter((option) => present.has(option.value));
}

export function normalizeShopSearchQuery(value: string | undefined): string {
  return value?.trim().replace(/\s+/g, ' ') ?? '';
}

export function normalizeShopFilterState<T extends ShopFilterState>(rawFilters: T): T {
  const filters: ShopFilterState = { ...rawFilters };
  const query = normalizeShopSearchQuery(filters.q);
  if (query) {
    filters.q = query;
  } else {
    delete filters.q;
  }
  const itemType = filters.itemType?.trim();
  const rawItemGroup = getExplicitShopItemGroup(filters.itemGroup);

  if (!itemType || itemType === 'all') {
    delete filters.itemType;
  } else {
    filters.itemType = itemType;
    // A specific type is the narrower, user-visible choice. It must not stay
    // intersected with a category left in a shared or bookmarked URL.
    delete filters.itemGroup;
    if (rawItemGroup === 'everything-else') {
      delete filters.metal;
      delete filters.metalColor;
      delete filters.metalType;
      delete filters.purity;
    }
  }

  const itemGroup = getExplicitShopItemGroup(filters.itemGroup);
  if (itemGroup) {
    filters.itemGroup = itemGroup;
  } else {
    delete filters.itemGroup;
  }

  if (filters.itemGroup === 'everything-else') {
    filters.metal = 'silver';
    delete filters.gender;
  }

  if (filters.metal !== 'gold' && filters.metal !== 'silver') {
    delete filters.metal;
  }

  const selectedMetalColor = filters.metalColor ?? filters.metalType;
  if (selectedMetalColor) {
    const allowedColors = filters.metal === 'gold'
      ? GOLD_METAL_COLORS
      : filters.metal === 'silver'
        ? SILVER_METAL_COLORS
        : new Set([...GOLD_METAL_COLORS, ...SILVER_METAL_COLORS]);
    if (!allowedColors.has(selectedMetalColor)) {
      delete filters.metalColor;
      delete filters.metalType;
    }
  }

  if (filters.purity) {
    const purity = Number(filters.purity);
    const incompatible = !Number.isFinite(purity)
      || (filters.metal === 'gold' && purity > 24)
      || (filters.metal === 'silver' && purity <= 24);
    if (incompatible) delete filters.purity;
  }

  if (!shopItemTypeSupportsLinkType(filters.itemType)) {
    delete filters.chainType;
    delete filters.length;
    delete filters.width;
  } else {
    const widthRanges = normalizeShopWidthRanges(filters.width);
    if (widthRanges.length > 0) {
      filters.width = widthRanges.join(',');
    } else {
      delete filters.width;
    }
  }

  if (filters.sort && !VALID_SORTS.has(filters.sort)) {
    delete filters.sort;
  }

  return filters as T;
}

export function changeShopItemTypeParams(
  source: URLSearchParams,
  value: string,
  currentItemGroup: ShopItemGroup | undefined,
): URLSearchParams {
  const params = new URLSearchParams(source);
  if (value) {
    params.set('itemType', value);
  } else {
    params.delete('itemType');
  }

  params.delete('itemGroup');
  params.delete('chainType');
  params.delete('length');
  params.delete('width');
  params.delete('page');

  // Everything Else pins Silver while that category is active. Once a shopper
  // chooses a specific type, remove that category-owned constraint as well.
  if (currentItemGroup === 'everything-else') {
    params.delete('metal');
    params.delete('metalColor');
    params.delete('metalType');
    params.delete('purity');
  }

  return params;
}

export function changeShopItemGroupParams(
  source: URLSearchParams,
  value: ShopItemGroup,
  currentItemGroup: ShopItemGroup | undefined,
): URLSearchParams {
  const params = new URLSearchParams(source);
  params.delete('itemType');
  params.delete('chainType');
  params.delete('length');
  params.delete('width');
  params.delete('page');

  if (currentItemGroup === value) {
    params.delete('itemGroup');
    params.delete('metal');
    params.delete('metalColor');
    params.delete('metalType');
    params.delete('purity');
    if (currentItemGroup === 'everything-else') params.delete('gender');
    return params;
  }

  params.set('itemGroup', value);
  params.delete('metalColor');
  params.delete('metalType');
  params.delete('purity');
  if (value === 'jewelry') {
    params.delete('metal');
  } else {
    params.set('metal', 'silver');
    params.delete('gender');
  }

  return params;
}
