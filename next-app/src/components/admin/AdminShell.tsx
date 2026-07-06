'use client';

import { adminUpdateProductStatus, adminRevalidateProduct } from '@/app/actions/admin-products';
import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { copyTextToClipboard } from '@/lib/clipboard';
import {
  PRODUCT_METAL_VARIANTS,
  PRODUCT_METAL_TYPES,
  PRODUCT_JEWELRY_TYPES,
  PRODUCT_LINK_TYPES,
  getDefaultMetalVariant,
  formatProductItemYear,
  inferProductJewelryType,
  normalizeProductItemYear,
  normalizeProductJewelryType,
  normalizeProductLengthSizeValue,
  normalizeProductMetalType,
  normalizeProductLinkType,
  normalizeProductMetalVariant,
  normalizeProductTypeValue,
  productJewelryTypeLabel,
  hasAnyProductImagePadding,
  isProductImagePaddingCustomColor,
  normalizeProductImagePadding,
  normalizeProductImagePaddingMap,
  normalizeProductImagePaddingValue,
  productImagePaddingBackground,
  productImagePaddingForImage,
  productImagePaddingMapKey,
  productMetalTypeLabel,
  productSupportsLinkType,
  productMetalVariantLabel,
  type Product,
  type ProductImagePadding,
  type ProductImagePaddingMap,
  type ProductMetalType,
  type ProductMetalVariant,
  type ProductStatus,
  type SpotData,
} from '@/types/product';
import { calcSpotMeltValue, getDisplayPrice, getSpotMeltDisplayPrice, normalizeManualPriceLabel } from '@/lib/pricing';
import ComboboxInput from './ComboboxInput';
import AdminHeader from './AdminHeader';
import {
  DEFAULT_QUICK_FILL_AI_FORMAT_PROMPT,
  QUICK_FILL_PROMPT_STORAGE_KEY,
  ensureQuickFillPromptHasCurrentBrandRules,
} from '@/lib/admin-settings';
import { PRODUCT_IMAGES_BUCKET, uniqueProductImageStoragePaths } from '@/lib/product-image-storage';
import type { ProductAutofillDraft, ProductAutofillFields } from '@/lib/ai-product-schema';

// Quick Fill is removed from the editor UI for now. The parser and panel still
// live in this file behind the flag so it can be restored without a backup copy.
const SHOW_QUICK_FILL: boolean = false;

interface Props {
  initialProducts: Product[];
  userEmail: string;
  spotData: SpotData | null;
  locale: string;
  unreadMessagesCount: number;
}

const STATUSES: { value: ProductStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'available', label: 'Available' },
  { value: 'pending_payment', label: 'Pending Payment' },
  { value: 'sold', label: 'Sold' },
  { value: 'archived', label: 'Archived' },
];
const MAX_PRODUCT_IMAGE_COUNT = 20;
const MAX_PRODUCT_IMAGE_UPLOAD_BYTES = 25 * 1024 * 1024;
const LOCATIONS = [
  { value: 'showcase', label: 'Showcase' },
  { value: 'safe', label: 'Safe' },
  { value: 'offsite', label: 'Offsite' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'picked_up', label: 'Picked Up' },
];

function getQuickFillLinkType(value: string, allowCustom = false): string | null {
  const normalized = normalizeProductLinkType(value);
  if (normalized) return normalized;
  const trimmed = value.trim().replace(/\s+/g, ' ');
  return allowCustom && trimmed ? trimmed : null;
}

function getChainTypeFromTags(tags: string[] | null): string {
  const tag = (tags ?? []).find(t => t.startsWith('ct:'));
  return tag ? tag.slice(3) : '';
}

function getProductChainType(product: Product): string {
  return product.chain_type || getChainTypeFromTags(product.tags);
}

function getProductJewelryType(product: Product): string {
  return inferProductJewelryType(product);
}

function getProductMetalType(product: Product): ProductMetalType {
  return normalizeProductMetalType(product.metal_type, product.category);
}

function getProductLinkType(product: Product): string {
  const jewelryType = getProductJewelryType(product);
  if (!productSupportsLinkType(jewelryType)) return '';
  return getProductChainType(product);
}

const PREDEFINED_LENGTHS = [
  '16', '18', '20', '22', '24', '26', '28', '30',
  '7', '7.5', '8',
];

function getLengthFromTags(tags: string[] | null): string {
  const tag = (tags ?? []).find(t => t.startsWith('len:'));
  return tag ? tag.slice(4) : '';
}

function getProductLength(product: Product): string {
  return normalizeProductLengthSizeValue(product.length || getLengthFromTags(product.tags));
}

function formatItemYear(value: string | number | null | undefined): string {
  return formatProductItemYear(value) ?? '-';
}

// Columns added by later migrations that may not exist yet on an un-migrated
// database. If a save hits a missing one, we retry without all of them so the
// admin can keep saving before the migration is applied.
const OPTIONAL_PRODUCT_COLUMNS = ['item_year', 'public_notes_es'] as const;

function isMissingOptionalColumnError(error: { message?: string | null } | null | undefined) {
  const message = error?.message?.toLowerCase() ?? '';
  return OPTIONAL_PRODUCT_COLUMNS.some((column) => message.includes(column));
}

function withoutOptionalColumns<T extends Record<string, unknown>>(payload: T): T {
  const rest: Record<string, unknown> = { ...payload };
  for (const column of OPTIONAL_PRODUCT_COLUMNS) delete rest[column];
  return rest as T;
}

function getLengthSizeLabel(jewelryType: string | null | undefined): string {
  const normalized = normalizeProductJewelryType(jewelryType);
  if (normalized === 'Ring') return 'Size';
  if (normalized === 'Necklace' || normalized === 'Bracelet') return 'Length';
  return 'Height';
}

function productUsesLength(productType: string | null | undefined): boolean {
  const normalized = normalizeProductJewelryType(productType);
  return normalized === 'Necklace' || normalized === 'Bracelet';
}

function productUsesSize(productType: string | null | undefined): boolean {
  return normalizeProductJewelryType(productType) === 'Ring';
}

// Anything that is not a Necklace, Bracelet, or Ring uses the size field to store the
// item's height (e.g. a 1.5 in brooch, a 0.75 in pendant).
function productUsesHeight(productType: string | null | undefined): boolean {
  const normalized = normalizeProductJewelryType(productType);
  if (!normalized) return Boolean(String(productType ?? '').trim());
  return normalized !== 'Necklace' && normalized !== 'Bracelet' && normalized !== 'Ring';
}

function productUsesGender(productType: string | null | undefined): boolean {
  const normalized = normalizeProductJewelryType(productType);
  if (!normalized) return Boolean(String(productType ?? '').trim());
  return normalized === 'Necklace' ||
    normalized === 'Bracelet' ||
    normalized === 'Ring' ||
    normalized === 'Pendant' ||
    normalized === 'Earrings' ||
    normalized === 'Brooch' ||
    normalized === 'Cufflinks' ||
    normalized === 'Watch';
}

function normalizeProductStatus(status: Product['status'] | null | undefined): ProductStatus {
  const value = String(status ?? 'available').toLowerCase().replace(/\s+/g, '_');
  if (value === 'available') return 'available';
  if (value === 'sold') return 'sold';
  if (value === 'draft') return 'draft';
  if (value === 'pending_payment') return 'pending_payment';
  if (value === 'archived') return 'archived';
  return 'available';
}

function getStatusLabel(status: Product['status'] | null | undefined): string {
  const normalized = normalizeProductStatus(status);
  return STATUSES.find((item) => item.value === normalized)?.label ?? 'Available';
}

function getStatusTone(status: Product['status'] | null | undefined) {
  const normalized = normalizeProductStatus(status);
  if (normalized === 'available') return { bg: 'var(--color-primary)', fg: 'var(--color-on-primary)' };
  if (normalized === 'sold') return { bg: 'var(--color-on-surface)', fg: 'var(--color-surface)' };
  if (normalized === 'pending_payment') return { bg: '#8a5a00', fg: '#fff' };
  if (normalized === 'archived') return { bg: '#6b7280', fg: '#fff' };
  return { bg: 'var(--color-surface-container-high)', fg: 'var(--color-on-surface)' };
}

function getStatusRank(status: Product['status'] | null | undefined): number {
  const normalized = normalizeProductStatus(status);
  const ranks: Record<string, number> = {
    available: 0,
    pending_payment: 1,
    draft: 2,
    sold: 3,
    archived: 4,
  };
  return ranks[normalized] ?? 0;
}

function getProductMetal(product: Product): string {
  return product.metal || product.category;
}

function getProductMetalVariant(product: Product): ProductMetalVariant {
  return normalizeProductMetalVariant(product.metal_variant, product.category);
}

function getCategoryForMetalVariant(value: ProductMetalVariant | string): 'Gold' | 'Silver' {
  return PRODUCT_METAL_VARIANTS.Silver.some((variant) => variant.value === value)
    ? 'Silver'
    : 'Gold';
}

function getLegacyCategoryForMetalType(value: string | null | undefined, fallback: 'Gold' | 'Silver' = 'Gold'): 'Gold' | 'Silver' {
  const normalized = normalizeProductMetalType(value, fallback);
  if (normalized === 'Silver' || normalized === 'Platinum' || normalized === 'Palladium') return 'Silver';
  if (normalized === 'Gold') return 'Gold';
  return fallback;
}

function getProductWeight(product: Product): number | null {
  return product.gram_weight ?? product.weight_grams ?? null;
}

function getProductImages(product: Product): string[] {
  return product.image_urls?.length ? product.image_urls : product.images ?? [];
}

function parseInventoryNumber(value: string | number | null | undefined): number | null {
  if (value == null || value === '') return null;
  const numeric = Number(String(value).replace(/\D/g, ''));
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
}

function formatInventoryNumberDisplay(value: string | number | null | undefined): string {
  return parseInventoryNumber(value)?.toString() ?? '-';
}

function slugifyProductText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function buildGeneratedProductId(product: ReturnType<typeof emptyProduct>): string {
  const titleSlug = slugifyProductText(product.title) || 'product';
  const inventoryNumber = parseInventoryNumber(product.inventory_number);
  return inventoryNumber ? `${titleSlug}-${inventoryNumber}` : titleSlug;
}

function getDisplayedInventoryNumber(product: Product, products: Product[]): number | null {
  if (product.inventory_number) return product.inventory_number;
  const masterIndex = getMasterProductOrder(products).findIndex((item) => item.id === product.id);
  return masterIndex >= 0 ? masterIndex + 1 : null;
}

function getNextInventoryNumber(products: Product[], excludeId?: string): number {
  const usedNumbers = new Set<number>();
  const masterOrderedProducts = getMasterProductOrder(products);

  masterOrderedProducts.forEach((product, index) => {
    if (excludeId && product.id === excludeId) return;
    const displayedNumber = product.inventory_number ?? index + 1;
    if (displayedNumber > 0) usedNumbers.add(displayedNumber);
  });

  let candidate = 1;
  while (usedNumbers.has(candidate)) candidate += 1;
  return candidate;
}

function getInventoryNumberOwner(
  products: Product[],
  inventoryNumber: number | null,
  excludeId?: string,
): Product | null {
  if (!inventoryNumber) return null;
  return getMasterProductOrder(products).find((product, index) => {
    if (excludeId && product.id === excludeId) return false;
    return (parseInventoryNumber(product.inventory_number) ?? index + 1) === inventoryNumber;
  }) ?? null;
}

function getDuplicateInventoryNumberMessage(owner: Product, inventoryNumber: number): string {
  return `Inventory #${inventoryNumber} is already assigned to "${owner.title}". Choose a different inventory number before saving.`;
}

function ClearableField({
  children,
  onClear,
  show = true,
  disabled = false,
  multiline = false,
}: {
  children: React.ReactNode;
  onClear: () => void;
  show?: boolean;
  disabled?: boolean;
  multiline?: boolean;
}) {
  const fieldRef = useRef<HTMLDivElement>(null);
  const [hasSelect, setHasSelect] = useState(false);
  const [clearArmed, setClearArmed] = useState(false);

  useEffect(() => {
    setHasSelect(Boolean(fieldRef.current?.querySelector('select')));
  }, [children]);

  return (
    <div
      ref={fieldRef}
      className={`clearable-field${show ? ' clearable-field--active' : ''}${clearArmed ? ' clearable-field--clear-armed' : ''}${multiline ? ' clearable-field--multiline' : ''}`}
    >
      {children}
      {show && (
        <button
          type="button"
          className="clearable-field__button"
          aria-label={hasSelect && !clearArmed ? 'Show options' : 'Clear field'}
          title={hasSelect && !clearArmed ? 'Show options' : 'Clear field'}
          disabled={disabled}
          onMouseDown={(event) => event.preventDefault()}
          onClick={(event) => {
            const field = event.currentTarget.parentElement?.querySelector<HTMLElement>('input, select, textarea');
            if (hasSelect && !clearArmed) {
              setClearArmed(true);
              window.setTimeout(() => {
                field?.focus();
                if (field instanceof HTMLSelectElement) {
                  const selectField = field as HTMLSelectElement & { showPicker?: () => void };
                  if (selectField.showPicker) {
                    selectField.showPicker();
                  } else {
                    selectField.click();
                  }
                }
              }, 0);
              return;
            }
            onClear();
            setClearArmed(false);
            window.setTimeout(() => {
              field?.focus();
            }, 0);
          }}
        >
          {hasSelect && !clearArmed ? 'v' : 'x'}
        </button>
      )}
    </div>
  );
}

const CHAIN_KEYWORDS: Record<string, string[]> = {
  'cuban-link':     ['cuban'],
  'figaro-link':    ['figaro'],
  'rope-chain':     ['rope'],
  'anchor-link':    ['anchor', 'gucci'],
  'oval-link':      ['oval link'],
  'byzantine-link': ['byzantine'],
  'box-link':       ['box link'],
};

const PRICE_MODES = [
  { value: 'spot-multiplier', label: 'Spot × Multiplier' },
  { value: 'manual', label: 'Manual / Fixed' },
] as const;

const GOLD_FILTER_PURITY_OPTIONS = [['18', '18K'], ['14', '14K'], ['10', '10K']];
const SILVER_FILTER_PURITY_OPTIONS = [['925', '925 Sterling']];

type SortKey =
  | 'inventoryNumber'
  | 'image'
  | 'title'
  | 'brand'
  | 'category'
  | 'metalVariant'
  | 'gender'
  | 'jewelryType'
  | 'chainType'
  | 'length'
  | 'itemYear'
  | 'location'
  | 'featured'
  | 'purity'
  | 'weight'
  | 'melt'
  | 'mode'
  | 'currentPrice'
  | 'status';

type SortDirection = 'asc' | 'desc';
type ImageTarget = { url: string; index: number };
type CropRect = { x: number; y: number; width: number; height: number };
type CropDragMode = 'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
type BrowserEyeDropper = { open: () => Promise<{ sRGBHex: string }> };
type WindowWithEyeDropper = Window & { EyeDropper?: new () => BrowserEyeDropper };
type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type WindowWithSpeechRecognition = Window & {
  SpeechRecognition?: new () => BrowserSpeechRecognition;
  webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
};
const FULL_IMAGE_CROP: CropRect = { x: 0, y: 0, width: 100, height: 100 };
const IMAGE_PADDING_OPTIONS: { value: ProductImagePadding; label: string; description: string }[] = [
  { value: 'none', label: 'No Padding', description: 'Use the normal site image frame.' },
  { value: 'white', label: 'White Padding', description: 'Fill side padding with white.' },
  { value: 'black', label: 'Black Padding', description: 'Fill side padding with black.' },
];
type QuickFillField =
  | 'title'
  | 'titleEs'
  | 'brand'
  | 'productType'
  | 'metalType'
  | 'category'
  | 'metalVariant'
  | 'status'
  | 'jewelryType'
  | 'chainType'
  | 'length'
  | 'itemYear'
  | 'location'
  | 'priceMode'
  | 'priceLabel'
  | 'purity'
  | 'weight'
  | 'gender'
  | 'multiplier'
  | 'description'
  | 'descriptionEs'
  | 'publicNotes'
  | 'publicNotesEs';

const QUICK_FILL_FORM_ORDER: QuickFillField[] = [
  'title',
  'titleEs',
  'productType',
  'brand',
  'metalType',
  'category',
  'purity',
  'weight',
  'chainType',
  'length',
  'itemYear',
  'priceMode',
  'multiplier',
  'priceLabel',
  'location',
  'status',
  'gender',
  'description',
  'descriptionEs',
  'publicNotes',
  'publicNotesEs',
];

const AI_PRODUCT_FIELD_LABELS: Record<keyof ProductAutofillFields, string> = {
  title: 'Title (English)',
  product_type: 'Product Type',
  brand: 'Brand',
  metal_type: 'Metal Type',
  metal_variant: 'Metal Color',
  gender: 'Gender',
  chain_type: 'Link Type',
  length: 'Length / Size',
  price_mode: 'Price Mode',
  purity: 'Purity',
  weight_grams: 'Weight (g)',
  item_year: 'Date (Year Made)',
  pricing_multiplier: 'Multiplier',
  asking_price: 'Price Label',
  manual_price_label: 'Price Label',
  description: 'Description (EN)',
  public_notes: 'Notes (EN)',
};

const PRODUCT_TABLE_COLUMNS: { label: string; sortKey: SortKey | null; widthClass?: string; responsiveClass?: string }[] = [
  { label: 'Inv #', sortKey: 'inventoryNumber', widthClass: 'w-[54px]' },
  { label: 'Image', sortKey: 'image', widthClass: 'w-16' },
  { label: 'Title', sortKey: 'title', widthClass: 'w-[210px]' },
  { label: 'Brand', sortKey: 'brand', widthClass: 'w-[92px]' },
  { label: 'Metal Color', sortKey: 'metalVariant', widthClass: 'w-[104px]' },
  { label: 'Type', sortKey: 'jewelryType', widthClass: 'w-[78px]' },
  { label: 'Link Type', sortKey: 'chainType', widthClass: 'w-[118px]', responsiveClass: 'hidden 2xl:table-cell' },
  { label: 'Size', sortKey: 'length', widthClass: 'w-[72px]' },
  { label: 'Date', sortKey: 'itemYear', widthClass: 'w-[92px]' },
  { label: 'Featured', sortKey: 'featured', widthClass: 'w-[72px]' },
  { label: 'Purity', sortKey: 'purity', widthClass: 'w-[64px]' },
  { label: 'Weight', sortKey: 'weight', widthClass: 'w-[76px]' },
  { label: 'Melt', sortKey: 'melt', widthClass: 'w-[84px]' },
  { label: 'Mode', sortKey: 'mode', widthClass: 'w-[94px]' },
  { label: 'Price', sortKey: 'currentPrice', widthClass: 'w-[92px]' },
  { label: 'Status', sortKey: 'status', widthClass: 'w-[92px]' },
  { label: '', sortKey: null, widthClass: 'w-[44px]', responsiveClass: 'max-md:w-[28px] max-md:min-w-[28px] max-md:max-w-[28px]' },
];

// Shared styling for a single item inside the row Actions dropdown menu.
const ROW_ACTION_MENU_ITEM_CLASS = 'px-3 py-2 text-left text-xs font-bold uppercase tracking-wide whitespace-nowrap transition-colors hover:bg-[var(--color-surface-container)]';

function getMasterProductOrder(products: Product[]): Product[] {
  return [...products].sort((a, b) => {
    const statusCompared = getStatusRank(a.status) - getStatusRank(b.status);
    if (statusCompared) return statusCompared;
    return (a.sort_order ?? 0) - (b.sort_order ?? 0);
  });
}

function emptyProduct(): Omit<Product, 'created_at' | 'updated_at'> {
  return {
    id: '',
    category: 'Gold',
    metal_type: '',
    metal_variant: '',
    title: '',
    title_es: '',
    price_label: null,
    manual_price_label: null,
    price_mode: 'spot-multiplier',
    purity: null,
    weight_grams: null,
    inventory_number: null,
    sku: null,
    slug: null,
    metal: '',
    gram_weight: null,
    stone_details: null,
    brand: null,
    product_type: '',
    jewelry_type: '',
    chain_type: null,
    length: null,
    pricing_multiplier: null,
    status: 'available',
    location: 'showcase',
    images: [],
    image_urls: [],
    // New listings default to white side padding; the admin can change it
    // per-photo (or product-wide) from the image padding chooser.
    image_padding: 'white',
    image_padding_by_image: {},
    description: '',
    description_es: '',
    details: [],
    details_es: [],
    tags: [],
    tags_es: [],
    private_price_label: null,
    gender: '',
    item_year: null,
    cost_basis: null,
    melt_value: null,
    asking_price: null,
    minimum_price: null,
    live_spot_snapshot: null,
    acquisition_date: null,
    acquisition_source: null,
    internal_notes: null,
    public_notes: null,
    public_notes_es: null,
    featured: false,
    sort_order: 0,
  };
}

function parseDisplayPrice(value: string): number | null {
  const numeric = Number(value.replace(/[^0-9.-]+/g, ''));
  return Number.isFinite(numeric) ? numeric : null;
}

function getSortValue(
  product: Product,
  key: SortKey,
  spotData: SpotData | null,
  inventoryNumbers: Map<string, number>,
): string | number | null {
  switch (key) {
    case 'inventoryNumber':
      return product.inventory_number || inventoryNumbers.get(product.id) || null;
    case 'image':
      return getProductImages(product)[0] ? 1 : 0;
    case 'title':
      return product.title;
    case 'brand':
      return product.brand ?? '';
    case 'category':
      return productMetalTypeLabel(product.metal_type, product.category);
    case 'metalVariant':
      return productMetalVariantLabel(product.metal_variant, product.category);
    case 'gender':
      return product.gender ?? 'Unisex';
    case 'jewelryType':
      return productJewelryTypeLabel(getProductJewelryType(product));
    case 'chainType':
      return getProductLinkType(product);
    case 'length':
      return getProductLength(product);
    case 'itemYear':
      return product.item_year != null ? String(product.item_year) : '';
    case 'location':
      return product.location ?? 'showcase';
    case 'featured':
      return product.featured ? 1 : 0;
    case 'purity':
      return product.purity;
    case 'weight':
      return getProductWeight(product);
    case 'melt':
      return calcSpotMeltValue(product, spotData);
    case 'mode':
      return product.price_mode === 'manual' ? 'Manual' : `Spot ${product.pricing_multiplier ?? ''}`;
    case 'currentPrice':
      return parseDisplayPrice(getDisplayPrice(product, spotData));
    case 'status':
      return getStatusLabel(product.status);
  }
}

function compareSortValues(a: string | number | null, b: string | number | null): number {
  if (a == null || a === '') return b == null || b === '' ? 0 : 1;
  if (b == null || b === '') return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

function foldExtraDetailsIntoInternalNotes(product: ReturnType<typeof emptyProduct>): string | null {
  const currentNotes = product.internal_notes?.trim() ?? '';
  const extraDetails = [...(product.details ?? []), ...(product.details_es ?? [])]
    .map((detail) => detail.trim())
    .filter(Boolean);

  if (extraDetails.length === 0) return currentNotes || null;

  const extraBlock = ['Former extra notes:', ...extraDetails.map((detail) => `- ${detail}`)].join('\n');
  if (currentNotes.includes(extraBlock)) return currentNotes;
  return [currentNotes, extraBlock].filter(Boolean).join('\n\n');
}

function splitQuickFillColumns(line: string, keepEmpty = false): string[] {
  const columns: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];
    if (char === '"' && inQuotes && nextChar === '"') {
      current += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === ',' && !inQuotes) {
      const value = current.trim();
      if (keepEmpty || value) columns.push(value);
      current = '';
      continue;
    }
    current += char;
  }

  const value = current.trim();
  if (keepEmpty || value) columns.push(value);
  return columns;
}

function normalizeQuickFillFieldName(value: string): QuickFillField | null {
  const normalized = value.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
  if (['title', 'title english', 'title en', 'english title', 'title (english)'].includes(normalized)) return 'title';
  if (['title spanish', 'title es', 'spanish title', 'title (spanish)'].includes(normalized)) return 'titleEs';
  if (
    normalized === 'brand' ||
    normalized === 'brand name' ||
    normalized === 'maker' ||
    normalized === 'maker name' ||
    normalized === 'designer' ||
    normalized === 'designer name' ||
    normalized === 'manufacturer' ||
    normalized === 'manufacturer name'
  ) return 'brand';
  if (normalized === 'product type' || normalized === 'item type' || normalized === 'jewelry type') return 'productType';
  if (normalized === 'metal type' || normalized === 'material' || normalized === 'primary metal') return 'metalType';
  if (normalized === 'category' || normalized === 'metal') return 'category';
  if (normalized === 'metal color' || normalized === 'gold color' || normalized === 'silver color' || normalized === 'metal subtype' || normalized === 'metal variant' || normalized === 'gold type' || normalized === 'silver type') return 'metalVariant';
  if (normalized === 'status') return 'status';
  if (normalized === 'link type' || normalized === 'chain type' || normalized === 'chain' || normalized === 'link style' || normalized === 'type') return 'chainType';
  if (normalized === 'length' || normalized === 'size' || normalized === 'ring size') return 'length';
  if (normalized === 'year' || normalized === 'year made' || normalized === 'date made' || normalized === 'made' || normalized === 'circa' || normalized === 'date' || normalized === 'item year' || normalized === 'item date') return 'itemYear';
  if (normalized === 'location') return 'location';
  if (normalized === 'price mode' || normalized === 'pricing mode' || normalized === 'mode') return 'priceMode';
  if (
    normalized === 'asking price' ||
    normalized === 'ask price' ||
    normalized === 'price' ||
    normalized === 'manual price' ||
    normalized === 'price label' ||
    normalized === 'manual price label'
  ) return 'priceLabel';
  if (normalized === 'purity' || normalized === 'karat' || normalized === 'karats') return 'purity';
  if (normalized === 'weight' || normalized === 'weight g' || normalized === 'grams' || normalized === 'gram weight') return 'weight';
  if (normalized === 'gender') return 'gender';
  if (normalized === 'multiplier' || normalized === 'pricing multiplier') return 'multiplier';
  if (['description', 'description english', 'description en', 'description (en)', 'description (english)', 'english description'].includes(normalized)) return 'description';
  if (['description spanish', 'description es', 'description (es)', 'description (spanish)', 'spanish description'].includes(normalized)) return 'descriptionEs';
  if (normalized === 'public notes' || normalized === 'public note' || normalized === 'notes en' || normalized === 'notes english' || normalized === 'notes (en)' || normalized === 'english notes') return 'publicNotes';
  if (normalized === 'notes es' || normalized === 'notes spanish' || normalized === 'spanish notes' || normalized === 'notes (es)' || normalized === 'public notes es' || normalized === 'public notes spanish') return 'publicNotesEs';
  return null;
}

function getQuickFillTokens(input: string): string[] {
  const lines = input.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length >= 2) {
    const headers = splitQuickFillColumns(lines[0]);
    const fields = headers.map(normalizeQuickFillFieldName);
    if (fields.length > 0 && fields.every(Boolean)) {
      const values = splitQuickFillColumns(lines[1], true);
      return values
        .map((value, index) => fields[index] ? `${headers[index]}:${value}` : value)
        .filter(Boolean);
    }
  }

  return splitQuickFillColumns(input.replace(/\r?\n/g, ','), false)
    .map((token) => token.trim())
    .filter((token) => token && !/^\.+$/.test(token));
}

function getQuickFillFormOrderTokens(input: string): string[] {
  const lines = input.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const row = lines.length >= 2 ? lines[1] : lines.join(' ');
  return splitQuickFillColumns(row, true).map((token) => token.trim());
}

export default function AdminShell({ initialProducts, userEmail, spotData, locale, unreadMessagesCount }: Props) {
  const router = useRouter();
  const adminBasePath = locale === 'es' ? '/es/admin' : '/admin';
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<ReturnType<typeof emptyProduct> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [quickAddMode, setQuickAddMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  // Fixed-viewport coordinates for the open row action menu. The menu renders as
  // position: fixed (escaping the table's overflow-x-auto clip) and flips above
  // the trigger when there isn't enough room below, so bottom rows stay usable.
  const [actionMenuPos, setActionMenuPos] = useState<
    { right: number; top?: number; bottom?: number; maxHeight: number } | null
  >(null);

  const toggleActionMenu = useCallback((id: string, trigger: HTMLElement) => {
    setActionMenuId((current) => {
      if (current === id) {
        setActionMenuPos(null);
        return null;
      }
      const rect = trigger.getBoundingClientRect();
      const gap = 4;
      const margin = 8;
      const spaceBelow = window.innerHeight - rect.bottom - margin;
      const spaceAbove = rect.top - margin;
      const openUp = spaceBelow < 260 && spaceAbove > spaceBelow;
      const maxHeight = Math.max(160, (openUp ? spaceAbove : spaceBelow) - gap);
      const right = Math.max(margin, window.innerWidth - rect.right);
      setActionMenuPos(
        openUp
          ? { right, bottom: window.innerHeight - rect.top + gap, maxHeight }
          : { right, top: rect.bottom + gap, maxHeight },
      );
      return id;
    });
  }, []);

  // The action menu is anchored to the trigger's viewport position, so close it
  // if the user scrolls (incl. the table's horizontal scroll) or resizes.
  useEffect(() => {
    if (!actionMenuId) return;
    const close = () => { setActionMenuId(null); setActionMenuPos(null); };
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [actionMenuId]);

  // Confirmation gate for the listing editor's close/cancel/save actions.
  const [editorConfirm, setEditorConfirm] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => void;
  } | null>(null);
  // Mobile-only collapse state for the editor's blocks (no effect on desktop).
  const [openEditorSections, setOpenEditorSections] = useState<{ photos: boolean; ai: boolean; details: boolean }>({
    photos: false,
    ai: false,
    details: false,
  });
  const toggleEditorSection = (key: 'photos' | 'ai' | 'details') =>
    setOpenEditorSections((current) => ({ ...current, [key]: !current[key] }));
  // Heads-up dialog shown before the Smart Assistant starts listening.
  const [showMicPrompt, setShowMicPrompt] = useState(false);
  const [imagePaddingTarget, setImagePaddingTarget] = useState<Product | null>(null);
  const [imagePaddingTargetIndex, setImagePaddingTargetIndex] = useState(0);
  const imagePaddingTargetIndexRef = useRef(0);
  const [imagePaddingCustomColor, setImagePaddingCustomColor] = useState('#ffffff');
  const [imagePaddingNotice, setImagePaddingNotice] = useState<{ text: string; ok: boolean } | null>(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterMetal, setFilterMetal] = useState('');
  const [filterMetalVariant, setFilterMetalVariant] = useState('');
  const [filterPurity, setFilterPurity] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterBrand, setFilterBrand] = useState('');
  const [filterGender, setFilterGender] = useState('');
  const [filterJewelryType, setFilterJewelryType] = useState('');
  const [filterChainType, setFilterChainType] = useState('');
  const [filterLength, setFilterLength] = useState('');
  const [filterLocation, setFilterLocation] = useState('');
  const [filterFeatured, setFilterFeatured] = useState('');
  const [showTableFilters, setShowTableFilters] = useState(false);
  const originalRef = useRef<ReturnType<typeof emptyProduct> | null>(null);
  const [uploading, setUploading] = useState(false);
  const [sessionUploadedImageUrls, setSessionUploadedImageUrls] = useState<Set<string>>(() => new Set());
  const [dragOver, setDragOver] = useState(false);
  const [dragSrcIdx, setDragSrcIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [previewImg, setPreviewImg] = useState<ImageTarget | null>(null);
  const [cropTarget, setCropTarget] = useState<ImageTarget | null>(null);
  const [cropRect, setCropRect] = useState<CropRect>(FULL_IMAGE_CROP);
  const [cropping, setCropping] = useState(false);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection } | null>(null);
  const [draggedProductId, setDraggedProductId] = useState<string | null>(null);
  const [dragTargetProductId, setDragTargetProductId] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);
  const [chainTypeInput, setChainTypeInput] = useState('');
  const [jewelryTypeInput, setJewelryTypeInput] = useState('Necklace');
  const [lengthInput, setLengthInput] = useState('');
  const [quickEntry, setQuickEntry] = useState('');
  const [quickFillPrompt, setQuickFillPrompt] = useState(DEFAULT_QUICK_FILL_AI_FORMAT_PROMPT);
  const [quickFillNotice, setQuickFillNotice] = useState<{ text: string; ok: boolean } | null>(null);
  const quickFillNoticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const quickFillPromptTextRef = useRef<HTMLTextAreaElement | null>(null);
  const [showQuickFillPrompt, setShowQuickFillPrompt] = useState(false);
  const [aiTranscript, setAiTranscript] = useState('');
  const [aiInterimText, setAiInterimText] = useState('');
  const [aiDraft, setAiDraft] = useState<ProductAutofillDraft | null>(null);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiRecording, setAiRecording] = useState(false);
  const aiRecordingRef = useRef(false);
  const aiRecognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const [aiNotice, setAiNotice] = useState<{ text: string; ok: boolean } | null>(null);
  const [aiUndoSnapshot, setAiUndoSnapshot] = useState<{
    editing: ReturnType<typeof emptyProduct>;
    jewelryTypeInput: string;
    chainTypeInput: string;
    lengthInput: string;
  } | null>(null);
  const [showAdvancedIds, setShowAdvancedIds] = useState(false);
  const [inventoryNumberManual, setInventoryNumberManual] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // --- Editor undo history -------------------------------------------------
  // Snapshots of the editable state (editing + the derived type/link/length
  // inputs that live outside `editing`), captured as the user edits. Rapid
  // changes within a short window coalesce into a single undo step so typing
  // doesn't produce one step per keystroke.
  type EditorUndoSnapshot = {
    editing: ReturnType<typeof emptyProduct>;
    jewelryTypeInput: string;
    chainTypeInput: string;
    lengthInput: string;
  };
  const undoStackRef = useRef<EditorUndoSnapshot[]>([]);
  const lastEditorSnapshotRef = useRef<EditorUndoSnapshot | null>(null);
  const lastUndoCaptureAtRef = useRef(0);
  const skipUndoCaptureRef = useRef(false);
  const [canUndoEdit, setCanUndoEdit] = useState(false);

  useEffect(() => {
    if (!editing) {
      undoStackRef.current = [];
      lastEditorSnapshotRef.current = null;
      lastUndoCaptureAtRef.current = 0;
      // Reset the (rendered) undo-availability flag when the editor closes. This
      // effect synchronizes derived undo state with the editor inputs, so the
      // set-state-in-effect flag is a false positive.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCanUndoEdit(false);
      return;
    }
    const current: EditorUndoSnapshot = { editing, jewelryTypeInput, chainTypeInput, lengthInput };
    if (lastEditorSnapshotRef.current === null) {
      lastEditorSnapshotRef.current = current; // baseline captured on open — no history yet
      return;
    }
    if (skipUndoCaptureRef.current) {
      skipUndoCaptureRef.current = false; // this change came from an undo/reset, don't record it
      lastEditorSnapshotRef.current = current;
      return;
    }
    const prev = lastEditorSnapshotRef.current;
    if (
      prev.editing === editing &&
      prev.jewelryTypeInput === jewelryTypeInput &&
      prev.chainTypeInput === chainTypeInput &&
      prev.lengthInput === lengthInput
    ) return;
    const now = Date.now();
    const coalesce = undoStackRef.current.length > 0 && now - lastUndoCaptureAtRef.current < 600;
    if (!coalesce) {
      undoStackRef.current.push(prev);
      setCanUndoEdit(true);
    }
    lastEditorSnapshotRef.current = current;
    lastUndoCaptureAtRef.current = now;
  }, [editing, jewelryTypeInput, chainTypeInput, lengthInput]);

  function resetUndoHistory() {
    undoStackRef.current = [];
    lastEditorSnapshotRef.current = null;
    lastUndoCaptureAtRef.current = 0;
    setCanUndoEdit(false);
  }

  function undoEdit() {
    const snapshot = undoStackRef.current.pop();
    if (!snapshot) return;
    skipUndoCaptureRef.current = true;
    lastUndoCaptureAtRef.current = 0;
    setEditing(snapshot.editing);
    setJewelryTypeInput(snapshot.jewelryTypeInput);
    setChainTypeInput(snapshot.chainTypeInput);
    setLengthInput(snapshot.lengthInput);
    setCanUndoEdit(undoStackRef.current.length > 0);
  }
  const productTypeOptions = useMemo(() => {
    const base = PRODUCT_JEWELRY_TYPES.map((type) => type.value);
    const extras = [
      jewelryTypeInput,
      editing?.product_type,
      editing?.jewelry_type,
      ...products.flatMap((product) => [product.product_type, product.jewelry_type, getProductJewelryType(product)]),
    ]
      .map((value) => normalizeProductTypeValue(value))
      .filter((value): value is string => Boolean(value));
    const seen = new Set<string>();
    const ordered = [...base, ...extras.sort((a, b) => a.localeCompare(b))].filter((value) => {
      const key = value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return ordered;
  }, [editing?.jewelry_type, editing?.product_type, jewelryTypeInput, products]);

  const flash = (text: string, ok = true) => {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 3500);
  };

  const showQuickFillNotice = (text: string, ok = true) => {
    if (quickFillNoticeTimer.current) clearTimeout(quickFillNoticeTimer.current);
    setQuickFillNotice({ text, ok });
    quickFillNoticeTimer.current = setTimeout(() => setQuickFillNotice(null), 5000);
  };

  function openImagePaddingChooser(product: Product) {
    const firstImage = getProductImages(product)[0] ?? null;
    const paddingValue = productImagePaddingForImage(product.image_padding, product.image_padding_by_image, firstImage, 0);
    const fallbackColor = productImagePaddingBackground(paddingValue) === '#000000' ? '#000000' : '#ffffff';
    setImagePaddingCustomColor(isProductImagePaddingCustomColor(paddingValue) ? paddingValue : fallbackColor);
    setImagePaddingNotice(null);
    imagePaddingTargetIndexRef.current = 0;
    setImagePaddingTargetIndex(0);
    setImagePaddingTarget(product);
  }

  useEffect(() => {
    const loadStoredPrompt = () => {
      const storedPrompt = window.localStorage.getItem(QUICK_FILL_PROMPT_STORAGE_KEY)?.trim();
      setQuickFillPrompt(ensureQuickFillPromptHasCurrentBrandRules(storedPrompt || DEFAULT_QUICK_FILL_AI_FORMAT_PROMPT));
    };

    loadStoredPrompt();
    window.addEventListener('storage', loadStoredPrompt);
    window.addEventListener('focus', loadStoredPrompt);
    return () => {
      window.removeEventListener('storage', loadStoredPrompt);
      window.removeEventListener('focus', loadStoredPrompt);
    };
  }, []);

  const copyQuickFillPrompt = async () => {
    const copied = await copyTextToClipboard(quickFillPrompt);
    if (!copied) {
      setShowQuickFillPrompt(true);
      window.setTimeout(() => {
        quickFillPromptTextRef.current?.focus();
        quickFillPromptTextRef.current?.select();
      }, 50);
    }
    showQuickFillNotice(
      copied
        ? 'AI formatting prompt copied.'
        : 'Clipboard access was blocked. Prompt text is open and selected for manual copy.',
      copied,
    );
  };

  const supabase = createClient();

  // --- Sign out ---
  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  }

  // --- Open add/edit modal ---
  function openAdd() {
    openAddFromProducts(products);
  }

  function openAddFromProducts(sourceProducts: Product[]) {
    originalRef.current = null;
    setSessionUploadedImageUrls(new Set());
    setFormErrors([]);
    setJewelryTypeInput('');
    setChainTypeInput('');
    setLengthInput('');
    setQuickEntry('');
    setQuickFillNotice(null);
    setQuickAddMode(false);
    setShowAdvancedIds(false);
    setOpenEditorSections({ photos: false, ai: false, details: false });
    // Reset the Smart Listing Assistant so the next item starts completely fresh
    // (transcript, generated draft, notices, undo snapshot, and any active recording).
    stopAiRecording();
    setAiTranscript('');
    setAiInterimText('');
    setAiDraft(null);
    setAiUndoSnapshot(null);
    setAiNotice(null);
    setAiGenerating(false);
    const autoOrder = sourceProducts.length > 0
      ? Math.max(...sourceProducts.map(p => p.sort_order ?? 0)) + 1
      : 1;
    setInventoryNumberManual(false);
    setEditing({ ...emptyProduct(), inventory_number: getNextInventoryNumber(sourceProducts), sort_order: autoOrder });
    setIsNew(true);
  }

  function validate(e: ReturnType<typeof emptyProduct>, excludeId?: string): string[] {
    const errs: string[] = [];
    if (!e.title.trim()) errs.push('Title (English) is required.');
    const inventoryNumber = parseInventoryNumber(e.inventory_number);
    if (!inventoryNumber) {
      errs.push('Inventory # is required.');
    } else {
      const duplicateOwner = getInventoryNumberOwner(products, inventoryNumber, excludeId);
      if (duplicateOwner) errs.push(getDuplicateInventoryNumberMessage(duplicateOwner, inventoryNumber));
    }
    if (e.price_mode === 'spot-multiplier') {
      if (!e.purity) errs.push('Purity is required for spot-price mode.');
      if (!e.weight_grams) errs.push('Weight is required for spot-price mode.');
      if (!e.pricing_multiplier) errs.push('Multiplier is required for spot-price mode.');
    }
    if (e.price_mode === 'manual' && !e.manual_price_label?.trim()) {
      errs.push('Price label is required for manual price mode.');
    }
    return errs;
  }

  function openEdit(p: Product) {
    const nextProductType = getProductJewelryType(p);
    const nextMetalType = getProductMetalType(p);
    const copy = {
      ...p,
      product_type: p.product_type ?? nextProductType,
      jewelry_type: p.jewelry_type ?? nextProductType,
      metal_type: p.metal_type ?? nextMetalType,
    };
    originalRef.current = copy;
    setSessionUploadedImageUrls(new Set());
    setJewelryTypeInput(nextProductType);
    setChainTypeInput(productSupportsLinkType(nextProductType) ? getProductLinkType(p) : '');
    setLengthInput(getProductLength(p));
    setFormErrors([]);
    setQuickEntry('');
    setQuickFillNotice(null);
    setQuickAddMode(false);
    setShowAdvancedIds(false);
    setOpenEditorSections({ photos: false, ai: false, details: false });
    setInventoryNumberManual(false);
    const autoInventoryNumber =
      copy.inventory_number ??
      getDisplayedInventoryNumber(copy, products) ??
      getNextInventoryNumber(products, copy.id);
    setEditing({ ...copy, inventory_number: autoInventoryNumber });
    setIsNew(false);
  }

  function getAutoInventoryNumber() {
    if (!editing) return getNextInventoryNumber(products);
    const originalNumber = parseInventoryNumber(originalRef.current?.inventory_number);
    if (!isNew && originalNumber) return originalNumber;
    if (!isNew && originalRef.current) {
      return getDisplayedInventoryNumber(originalRef.current as Product, products) ?? getNextInventoryNumber(products, editing.id || undefined);
    }
    return getNextInventoryNumber(products, editing.id || undefined);
  }

  function setManualInventoryNumber(checked: boolean) {
    setInventoryNumberManual(checked);
    if (!checked && editing) {
      setEditing({ ...editing, inventory_number: getAutoInventoryNumber() });
    }
  }

  function applyQuickEntry() {
    if (!editing || !quickEntry.trim()) return;
    const tokens = getQuickFillTokens(quickEntry);
    const updates: Partial<ReturnType<typeof emptyProduct>> = {};
    let newJewelryType = jewelryTypeInput;
    let newChainType = chainTypeInput;
    let newLength = lengthInput;
    let categoryWasUpdated = false;
    let metalVariantWasUpdated = false;
    let purityWasUpdated = false;
    const applied: string[] = [];
    const notApplied: string[] = [];

    const clearTokenValue = (field: QuickFillField) => {
      if (field === 'title') { updates.title = ''; applied.push('Title (English)'); return true; }
      if (field === 'titleEs') { updates.title_es = ''; applied.push('Title (Spanish)'); return true; }
      if (field === 'brand') { updates.brand = null; applied.push('Brand'); return true; }
      if (field === 'description') { updates.description = ''; applied.push('Description (EN)'); return true; }
      if (field === 'descriptionEs') { updates.description_es = ''; applied.push('Description (ES)'); return true; }
      if (field === 'publicNotes') { updates.public_notes = ''; applied.push('Notes (EN)'); return true; }
      if (field === 'publicNotesEs') { updates.public_notes_es = ''; applied.push('Notes (ES)'); return true; }
      if (field === 'productType') {
        newJewelryType = 'Other';
        updates.product_type = 'Other';
        updates.jewelry_type = 'Other';
        newChainType = '';
        newLength = '';
        applied.push('Product Type');
        return true;
      }
      if (field === 'chainType') { newChainType = ''; applied.push('Link Type'); return true; }
      if (field === 'length') { newLength = ''; applied.push(getLengthSizeLabel(newJewelryType)); return true; }
      if (field === 'itemYear') { updates.item_year = null; applied.push('Date'); return true; }
      if (field === 'priceLabel') {
        updates.asking_price = null;
        updates.manual_price_label = null;
        applied.push('Price Label');
        return true;
      }
      if (field === 'purity') {
        updates.purity = null;
        purityWasUpdated = true;
        applied.push('Purity');
        return true;
      }
      if (field === 'weight') {
        updates.weight_grams = null;
        applied.push('Weight');
        return true;
      }
      if (field === 'multiplier') {
        updates.pricing_multiplier = null;
        applied.push('Multiplier');
        return true;
      }
      if (field === 'metalVariant') {
        updates.metal_variant = getDefaultMetalVariant(updates.category ?? editing.category);
        metalVariantWasUpdated = true;
        applied.push('Metal Color');
        return true;
      }
      if (field === 'metalType') {
        updates.metal_type = editing.category;
        updates.metal = editing.category;
        applied.push('Metal Type');
        return true;
      }
      return false;
    };

    const applyTokenValue = (rawValue: string, field: QuickFillField | null = null) => {
      const value = rawValue.replace(/\.{3,}$/g, '').trim();
      if (!value) return field ? clearTokenValue(field) : false;
      const lower = value.toLowerCase();

      if (field === 'title') {
        updates.title = value;
        applied.push('Title (English)');
        return true;
      }
      if (field === 'titleEs') {
        updates.title_es = value;
        applied.push('Title (Spanish)');
        return true;
      }
      if (field === 'brand') {
        updates.brand = value;
        applied.push('Brand');
        return true;
      }
      if (field === 'description') {
        updates.description = value;
        applied.push('Description (EN)');
        return true;
      }
      if (field === 'descriptionEs') {
        updates.description_es = value;
        applied.push('Description (ES)');
        return true;
      }
      if (field === 'publicNotes') {
        updates.public_notes = value;
        applied.push('Notes (EN)');
        return true;
      }
      if (field === 'publicNotesEs') {
        updates.public_notes_es = value;
        applied.push('Notes (ES)');
        return true;
      }
      if (field === 'itemYear') {
        const itemYear = normalizeProductItemYear(value);
        if (!itemYear) return false;
        updates.item_year = itemYear;
        applied.push('Date');
        return true;
      }

      if (!field || field === 'productType') {
        const matchedJewelryType = normalizeProductJewelryType(value);
        if (matchedJewelryType) {
          newJewelryType = matchedJewelryType;
          updates.product_type = matchedJewelryType;
          updates.jewelry_type = matchedJewelryType;
          if (!productSupportsLinkType(matchedJewelryType)) newChainType = '';
          if (!productUsesLength(matchedJewelryType) && !productUsesSize(matchedJewelryType) && !productUsesHeight(matchedJewelryType)) newLength = '';
          applied.push('Product Type');
          return true;
        }
        const customProductType = field === 'productType' ? normalizeProductTypeValue(value) : null;
        if (customProductType) {
          newJewelryType = customProductType;
          updates.product_type = customProductType;
          updates.jewelry_type = customProductType;
          newChainType = '';
          if (!productUsesLength(customProductType) && !productUsesSize(customProductType) && !productUsesHeight(customProductType)) newLength = '';
          applied.push('Product Type');
          return true;
        }
      }

      if ((!field || field === 'metalType') && PRODUCT_METAL_TYPES.some((type) => type.value.toLowerCase() === lower || type.label.toLowerCase() === lower || type.labelEs.toLowerCase() === lower)) {
        const nextMetalType = normalizeProductMetalType(value, editing.category);
        updates.metal_type = nextMetalType;
        updates.metal = nextMetalType;
        if (nextMetalType === 'Gold' || nextMetalType === 'Silver') {
          updates.category = nextMetalType;
          if (!metalVariantWasUpdated) updates.metal_variant = getDefaultMetalVariant(nextMetalType);
          categoryWasUpdated = true;
        }
        applied.push('Metal Type');
        return true;
      }

      if ((!field || field === 'category') && lower === 'gold') {
        updates.category = 'Gold';
        updates.metal = 'Gold';
        updates.metal_type = 'Gold';
        if (!metalVariantWasUpdated) updates.metal_variant = getDefaultMetalVariant('Gold');
        categoryWasUpdated = true;
        applied.push('Category');
        return true;
      }
      if ((!field || field === 'category') && lower === 'silver') {
        updates.category = 'Silver';
        updates.metal = 'Silver';
        updates.metal_type = 'Silver';
        if (!metalVariantWasUpdated) updates.metal_variant = getDefaultMetalVariant('Silver');
        categoryWasUpdated = true;
        applied.push('Category');
        return true;
      }

      if (!field || field === 'metalVariant') {
        const variantValue = lower.replace(/[-\s]+/g, '_');
        const variantOptions = [...PRODUCT_METAL_VARIANTS.Gold, ...PRODUCT_METAL_VARIANTS.Silver];
        const matchedVariant = variantOptions.find((variant) => (
          variant.value === variantValue ||
          variant.label.toLowerCase() === lower ||
          variant.labelEs.toLowerCase() === lower ||
          (variant.value === 'tricolor_gold' && lower === 'tri color gold') ||
          (variant.value === 'tricolor_gold' && lower === 'tri-color gold') ||
          (variant.value === 'tricolor_gold' && lower === 'tricolor') ||
          (variant.value === 'bicolor_gold' && lower === 'bi color gold') ||
          (variant.value === 'bicolor_gold' && lower === 'bi-color gold') ||
          (variant.value === 'bicolor_gold' && lower === 'bicolor') ||
          (variant.value === 'yellow_gold' && lower === 'yellow') ||
          (variant.value === 'white_gold' && lower === 'white') ||
          (variant.value === 'rose_gold' && lower === 'rose')
        ));
        if (matchedVariant) {
          const nextCategory = PRODUCT_METAL_VARIANTS.Silver.some((variant) => variant.value === matchedVariant.value)
            ? 'Silver'
            : 'Gold';
          updates.category = nextCategory;
          updates.metal = nextCategory;
          updates.metal_type = nextCategory;
          updates.metal_variant = matchedVariant.value;
          categoryWasUpdated = true;
          metalVariantWasUpdated = true;
          applied.push('Metal Color');
          return true;
        }
      }

      if (!field || field === 'gender') {
        if (lower === 'unisex') { updates.gender = 'Unisex'; applied.push('Gender'); return true; }
        if (lower === 'men' || lower === 'mens' || lower === 'male') { updates.gender = 'Men'; applied.push('Gender'); return true; }
        if (lower === 'women' || lower === 'womens' || lower === "women's" || lower === 'female') { updates.gender = 'Women'; applied.push('Gender'); return true; }
      }

      if (!field || field === 'status') {
        if (lower === 'draft') { updates.status = 'draft'; applied.push('Status'); return true; }
        if (lower === 'available') { updates.status = 'available'; applied.push('Status'); return true; }
        if (lower === 'pending payment' || lower === 'pending_payment') { updates.status = 'pending_payment'; applied.push('Status'); return true; }
        if (lower === 'sold') { updates.status = 'sold'; applied.push('Status'); return true; }
        if (lower === 'archived') { updates.status = 'archived'; applied.push('Status'); return true; }
      }

      if (!field || field === 'location') {
        const matchedLocation = LOCATIONS.find((location) => {
          const normalizedValue = lower.replace(/\s+/g, '_');
          return lower === location.label.toLowerCase() || normalizedValue === location.value;
        });
        if (matchedLocation) {
          updates.location = matchedLocation.value;
          applied.push('Location');
          return true;
        }
      }

      if (!field || field === 'priceMode') {
        if (lower === 'spot' || lower === 'spot-multiplier' || lower === 'spot multiplier') {
          updates.price_mode = 'spot-multiplier'; applied.push('Price Mode'); return true;
        }
        if (lower === 'manual' || lower === 'fixed' || lower === 'manual fixed price') {
          updates.price_mode = 'manual'; applied.push('Price Mode'); return true;
        }
      }

      if (field === 'priceLabel' || (!field && /^\$\s*\d/.test(value))) {
        updates.price_mode = 'manual';
        updates.asking_price = null;
        updates.manual_price_label = normalizeManualPriceLabel(value) ?? value;
        applied.push('Price Label');
        return true;
      }

      const purityMatch = lower.match(/^(\d+)\s*k?$/);
      if ((!field || field === 'purity') && purityMatch) {
        const val = parseInt(purityMatch[1]);
        if ((val >= 1 && val <= 24) || (val >= 100 && val <= 1000)) {
          updates.purity = val;
          purityWasUpdated = true;
          applied.push('Purity');
          return true;
        }
      }

      const weightMatch = lower.match(field === 'weight' ? /^(\d+(?:\.\d+)?)\s*(?:g(?:rams?)?)?$/ : /^(\d+(?:\.\d+)?)\s*g(rams?)?$/);
      if ((!field || field === 'weight') && weightMatch) {
        updates.weight_grams = parseFloat(weightMatch[1]);
        applied.push('Weight');
        return true;
      }

      const multA = lower.match(/^(\d+(?:\.\d+)?)\s*x$/);
      const multB = lower.match(/^x\s*(\d+(?:\.\d+)?)$/);
      const multC = field === 'multiplier' ? lower.match(/^(\d+(?:\.\d+)?)$/) : null;
      if ((!field || field === 'multiplier') && multA) { updates.pricing_multiplier = parseFloat(multA[1]); applied.push('Multiplier'); return true; }
      if ((!field || field === 'multiplier') && multB) { updates.pricing_multiplier = parseFloat(multB[1]); applied.push('Multiplier'); return true; }
      if (field === 'multiplier' && multC) { updates.pricing_multiplier = parseFloat(multC[1]); applied.push('Multiplier'); return true; }

      if (!field || field === 'chainType') {
        const matchedChain = getQuickFillLinkType(value, field === 'chainType');
        if (matchedChain) {
          newChainType = matchedChain;
          if (!productSupportsLinkType(newJewelryType)) {
            newJewelryType = 'Necklace';
            updates.product_type = 'Necklace';
            updates.jewelry_type = 'Necklace';
            applied.push('Product Type');
          }
          applied.push('Link Type');
          return true;
        }
      }

      const lenMatch = lower.match(field === 'length' ? /^(\d+(?:\.\d+)?)\s*(?:(?:in(?:ch(?:es?)?)?)|")?$/ : /^(\d+(?:\.\d+)?)\s*(?:in(?:ch(?:es?)?)?|")$/);
      if ((!field || field === 'length') && lenMatch) {
        newLength = normalizeProductLengthSizeValue(lenMatch[0]);
        applied.push(getLengthSizeLabel(newJewelryType));
        return true;
      }
      if (field === 'length') {
        newLength = normalizeProductLengthSizeValue(value);
        applied.push(getLengthSizeLabel(newJewelryType));
        return true;
      }

      return false;
    };

    for (const tok of tokens) {
      const cleanedToken = tok.replace(/\.{3,}$/g, '').trim();
      const keyedMatch = cleanedToken.match(/^([^:]+):(.*)$/);
      const field = keyedMatch ? normalizeQuickFillFieldName(keyedMatch[1]) : null;
      const value = keyedMatch ? keyedMatch[2].trim() : cleanedToken;

      if (!applyTokenValue(value, field)) {
        notApplied.push(cleanedToken);
      }
    }

    const hasExplicitFields = tokens.some((token) => {
        const keyedMatch = token.match(/^([^:]+):(.*)$/);
        return keyedMatch ? normalizeQuickFillFieldName(keyedMatch[1]) !== null : false;
      });

    if (notApplied.length > 0 && !hasExplicitFields) {
      const orderedUpdates: Partial<ReturnType<typeof emptyProduct>> = {};
      let orderedJewelryType = jewelryTypeInput;
      let orderedChainType = chainTypeInput;
      let orderedLength = lengthInput;
      let orderedCategoryWasUpdated = false;
      let orderedMetalVariantWasUpdated = false;
      let orderedPurityWasUpdated = false;
      const orderedApplied: string[] = [];
      const orderedNotApplied: string[] = [];

      const previous = {
        updates: { ...updates },
        jewelryType: newJewelryType,
        chainType: newChainType,
        length: newLength,
        categoryWasUpdated,
        metalVariantWasUpdated,
        purityWasUpdated,
        applied: [...applied],
      };

      Object.keys(updates).forEach((key) => {
        delete updates[key as keyof typeof updates];
      });
      newJewelryType = orderedJewelryType;
      newChainType = orderedChainType;
      newLength = orderedLength;
      categoryWasUpdated = false;
      metalVariantWasUpdated = false;
      purityWasUpdated = false;
      applied.length = 0;

      getQuickFillFormOrderTokens(quickEntry).forEach((token, index) => {
        const field = QUICK_FILL_FORM_ORDER[index];
        const value = token.replace(/\.{3,}$/g, '').trim();
        if (!field) {
          orderedNotApplied.push(value);
          return;
        }
        if (!applyTokenValue(value, field)) {
          orderedNotApplied.push(value);
        }
      });

      Object.assign(orderedUpdates, updates);
      orderedJewelryType = newJewelryType;
      orderedChainType = newChainType;
      orderedLength = newLength;
      orderedCategoryWasUpdated = categoryWasUpdated;
      orderedMetalVariantWasUpdated = metalVariantWasUpdated;
      orderedPurityWasUpdated = purityWasUpdated;
      orderedApplied.push(...applied);

      Object.keys(updates).forEach((key) => {
        delete updates[key as keyof typeof updates];
      });

      if (orderedApplied.length > previous.applied.length && orderedNotApplied.length < notApplied.length) {
        Object.assign(updates, orderedUpdates);
        newJewelryType = orderedJewelryType;
        newChainType = orderedChainType;
        newLength = orderedLength;
        categoryWasUpdated = orderedCategoryWasUpdated;
        metalVariantWasUpdated = orderedMetalVariantWasUpdated;
        purityWasUpdated = orderedPurityWasUpdated;
        applied.length = 0;
        applied.push(...orderedApplied);
        notApplied.length = 0;
        notApplied.push(...orderedNotApplied);
      } else {
        Object.assign(updates, previous.updates);
        newJewelryType = previous.jewelryType;
        newChainType = previous.chainType;
        newLength = previous.length;
        categoryWasUpdated = previous.categoryWasUpdated;
        metalVariantWasUpdated = previous.metalVariantWasUpdated;
        purityWasUpdated = previous.purityWasUpdated;
        applied.length = 0;
        applied.push(...previous.applied);
      }
    }

    if (categoryWasUpdated && !purityWasUpdated && updates.category !== editing.category) {
      updates.purity = null;
    }

    if (metalVariantWasUpdated && updates.metal_variant) {
      const nextCategory = getCategoryForMetalVariant(updates.metal_variant);
      updates.category = nextCategory;
      updates.metal = nextCategory;
      updates.metal_type = nextCategory;
    }

    if (!productSupportsLinkType(newJewelryType)) {
      newChainType = '';
    }
    if (!productUsesLength(newJewelryType) && !productUsesSize(newJewelryType) && !productUsesHeight(newJewelryType)) {
      newLength = '';
    }

    if (applied.length) {
      setEditing({ ...editing, ...updates });
      setJewelryTypeInput(newJewelryType);
      setChainTypeInput(newChainType);
      setLengthInput(newLength);
      setQuickEntry('');
    }

    if (applied.length && notApplied.length) {
      showQuickFillNotice(`Applied: ${applied.join(', ')}. Not applied: ${notApplied.map((item) => `"${item}"`).join(', ')}.`);
    } else if (applied.length) {
      showQuickFillNotice(`Applied: ${applied.join(', ')}`);
    } else if (notApplied.length) {
      showQuickFillNotice(`Not applied: ${notApplied.map((item) => `"${item}"`).join(', ')}. No fields were changed.`, false);
    } else {
      showQuickFillNotice('No recognized fields in that string.', false);
    }
  }

  function showAiNotice(text: string, ok = true) {
    setAiNotice({ text, ok });
    window.setTimeout(() => setAiNotice(null), 5000);
  }

  function appendAiTranscript(text: string) {
    const cleaned = text.trim();
    if (!cleaned) return;
    setAiTranscript((current) => [current.trim(), cleaned].filter(Boolean).join(' '));
  }

  function startAiRecording() {
    if (typeof window === 'undefined') return;
    const SpeechRecognitionCtor = (window as WindowWithSpeechRecognition).SpeechRecognition
      ?? (window as WindowWithSpeechRecognition).webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      showAiNotice('Voice recording is not supported in this browser. You can still type the description.', false);
      return;
    }

    aiRecognitionRef.current?.stop();
    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.onresult = (event) => {
      let finalText = '';
      let interimText = '';
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (result.isFinal) {
          finalText += ` ${result[0].transcript}`;
        } else {
          interimText += ` ${result[0].transcript}`;
        }
      }
      if (finalText) appendAiTranscript(finalText);
      setAiInterimText(interimText.trim());
    };
    recognition.onerror = (event) => {
      // Fatal errors: mic permission denied — stop recording and tell the user.
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        aiRecordingRef.current = false;
        setAiRecording(false);
        showAiNotice('Microphone access was denied. Check your browser permissions and try again.', false);
        return;
      }
      // Non-fatal errors (no-speech, network, aborted, etc.): onend fires next
      // and will restart automatically — no notice needed.
    };
    recognition.onend = () => {
      if (!aiRecordingRef.current) return;
      // Clear interim text during the brief gap while we restart the session.
      setAiInterimText('');
      window.setTimeout(() => {
        // User may have clicked Stop during the delay — check again.
        if (!aiRecordingRef.current) return;
        try {
          recognition.start();
        } catch {
          // start() failed (browser mid-transition). Retry once after a longer pause.
          window.setTimeout(() => {
            if (!aiRecordingRef.current) return;
            try {
              recognition.start();
            } catch {
              // Both retries failed — recording is truly dead. Surface it.
              aiRecordingRef.current = false;
              setAiRecording(false);
              showAiNotice('Recording stopped unexpectedly. Tap the mic to start again.', false);
            }
          }, 1000);
        }
      }, 300);
    };
    aiRecognitionRef.current = recognition;
    aiRecordingRef.current = true;
    setAiRecording(true);
    try {
      recognition.start();
    } catch {
      aiRecordingRef.current = false;
      setAiRecording(false);
      showAiNotice('Voice recording could not start. You can still type the description.', false);
    }
  }

  function stopAiRecording() {
    aiRecordingRef.current = false;
    setAiRecording(false);
    setAiInterimText('');
    aiRecognitionRef.current?.stop();
  }

  async function generateAiDraft() {
    if (!editing) return;
    const transcript = [aiTranscript, aiInterimText].filter(Boolean).join(' ').trim();
    if ((editing.images?.length ?? 0) === 0) {
      showAiNotice('Add at least one photo to generate a listing.', false);
      return;
    }

    setAiGenerating(true);
    setAiDraft(null);
    setAiUndoSnapshot(null);
    try {
      const response = await fetch('/api/admin/ai-product-fill', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          transcript,
          images: editing.images ?? [],
          mode: 'fast',
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? 'AI listing generation failed.');
      const draft = data.draft as ProductAutofillDraft;
      setAiDraft(draft);
      applyAiDraftToForm(draft);
    } catch (error) {
      showAiNotice(error instanceof Error ? error.message : 'AI listing generation failed.', false);
    } finally {
      setAiGenerating(false);
    }
  }

  function applyAiDraftToForm(draft: ProductAutofillDraft) {
    if (!editing) return;
    const fields = draft.fields;
    const nextEditing = { ...editing };
    let nextJewelryType = jewelryTypeInput;
    let nextChainType = chainTypeInput;
    let nextLength = lengthInput;
    const applied: string[] = [];

    // AI owns these catalog fields: any non-null draft value overwrites the form.
    // No dirty-field protection — "Undo AI Fill" is the safety net.
    const setField = <K extends keyof ProductAutofillFields>(
      draftKey: K,
      label: string,
      apply: (value: NonNullable<ProductAutofillFields[K]>) => void,
    ) => {
      const value = fields[draftKey];
      if (value == null || value === '') return;
      apply(value as NonNullable<ProductAutofillFields[K]>);
      applied.push(label);
    };

    setAiUndoSnapshot({
      editing: { ...editing },
      jewelryTypeInput,
      chainTypeInput,
      lengthInput,
    });

    setField('title', 'Title (English)', (value) => { nextEditing.title = value; });
    setField('brand', 'Brand', (value) => { nextEditing.brand = value; });
    setField('description', 'Description (EN)', (value) => { nextEditing.description = value; });
    setField('public_notes', 'Notes (EN)', (value) => { nextEditing.public_notes = value; });
    setField('gender', 'Gender', (value) => { nextEditing.gender = value; });
    setField('price_mode', 'Price Mode', (value) => { nextEditing.price_mode = value; });
    setField('purity', 'Purity', (value) => { nextEditing.purity = value; });
    setField('weight_grams', 'Weight', (value) => { nextEditing.weight_grams = value; });
    setField('item_year', 'Date (Year Made)', (value) => { nextEditing.item_year = value; });
    setField('pricing_multiplier', 'Multiplier', (value) => { nextEditing.pricing_multiplier = value; });
    setField('asking_price', 'Price Label', (value) => {
      nextEditing.asking_price = null;
      nextEditing.price_mode = 'manual';
      nextEditing.manual_price_label = nextEditing.manual_price_label ?? normalizeManualPriceLabel(String(value));
    });
    setField('manual_price_label', 'Price Label', (value) => {
      nextEditing.asking_price = null;
      nextEditing.price_mode = 'manual';
      nextEditing.manual_price_label = normalizeManualPriceLabel(value);
    });
    setField('metal_type', 'Metal Type', (value) => {
      const nextCategory = getLegacyCategoryForMetalType(value, nextEditing.category);
      nextEditing.metal_type = value;
      nextEditing.metal = value;
      nextEditing.category = nextCategory;
      nextEditing.metal_variant = getDefaultMetalVariant(nextCategory);
    });
    setField('metal_variant', 'Metal Color', (value) => {
      const nextCategory = getCategoryForMetalVariant(value);
      nextEditing.category = nextCategory;
      nextEditing.metal = nextCategory;
      nextEditing.metal_type = nextCategory;
      nextEditing.metal_variant = value;
    });
    setField('product_type', 'Product Type', (value) => {
      nextJewelryType = value;
      nextEditing.product_type = value;
      nextEditing.jewelry_type = value;
      if (!productSupportsLinkType(value)) nextChainType = '';
      if (!productUsesLength(value) && !productUsesSize(value) && !productUsesHeight(value)) nextLength = '';
    });
    setField('chain_type', 'Link Type', (value) => {
      if (!productSupportsLinkType(nextJewelryType)) nextJewelryType = 'Necklace';
      nextChainType = value;
      nextEditing.product_type = nextJewelryType;
      nextEditing.jewelry_type = nextJewelryType;
    });
    setField('length', getLengthSizeLabel(nextJewelryType), (value) => { nextLength = normalizeProductLengthSizeValue(value); });

    if (applied.length === 0) {
      showAiNotice('No AI values to apply. Generate a listing first.', false);
      setAiUndoSnapshot(null);
      return;
    }

    setEditing(nextEditing);
    setJewelryTypeInput(nextJewelryType);
    setChainTypeInput(productSupportsLinkType(nextJewelryType) ? nextChainType : '');
    setLengthInput(productUsesLength(nextJewelryType) || productUsesSize(nextJewelryType) || productUsesHeight(nextJewelryType) ? nextLength : '');
    showAiNotice(`Applied AI fields: ${applied.join(', ')}.`);
  }

  function undoAiFill() {
    if (!aiUndoSnapshot) return;
    skipUndoCaptureRef.current = true;
    setEditing(aiUndoSnapshot.editing);
    setJewelryTypeInput(aiUndoSnapshot.jewelryTypeInput);
    setChainTypeInput(aiUndoSnapshot.chainTypeInput);
    setLengthInput(aiUndoSnapshot.lengthInput);
    setAiUndoSnapshot(null);
    setAiDraft(null);
    showAiNotice('AI fill undone.');
  }

  function closeModal() {
    setEditorConfirm(null);
    setShowMicPrompt(false);
    setEditing(null);
    setQuickAddMode(false);
    setSessionUploadedImageUrls(new Set());
    setPreviewImg(null);
    setCropTarget(null);
    setQuickFillNotice(null);
    stopAiRecording();
    setAiNotice(null);
    setAiDraft(null);
    setAiUndoSnapshot(null);
  }

  // Cancel reverts everything. Clean up only the photos uploaded during this
  // editing session that were never saved to the product; keep the product's
  // original photos and any image shared with another listing.
  async function discardEditorDraft() {
    const orphanUploads = [...sessionUploadedImageUrls];
    const keepImages = originalRef.current
      ? [...(originalRef.current.images ?? []), ...(originalRef.current.image_urls ?? [])]
      : [];
    const sourceId = originalRef.current?.id ?? null;
    closeModal();
    if (orphanUploads.length > 0) {
      await deleteProductImagesIfUnused(orphanUploads, sourceId, products, keepImages);
    }
  }

  // The editor never closes from an outside click; closing or saving always
  // routes through a confirmation step.
  function requestCloseEditor() {
    setEditorConfirm({
      title: 'Close this listing?',
      message: 'Any unsaved changes will be lost.',
      confirmLabel: 'Close',
      onConfirm: () => { setEditorConfirm(null); void discardEditorDraft(); },
    });
  }
  function requestSaveEditor(afterSave: 'stay' | 'another' | 'close') {
    setEditorConfirm({
      title: 'Save this listing?',
      message: 'Your changes will be saved to the catalog.',
      confirmLabel: 'Save',
      onConfirm: () => { setEditorConfirm(null); void handleSave(afterSave); },
    });
  }

  const uploadImageBlob = useCallback(async (blob: Blob): Promise<string | null> => {
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.webp`;
    const path = `products/${filename}`;

    const { error } = await supabase.storage
      .from(PRODUCT_IMAGES_BUCKET)
      .upload(path, blob, { contentType: 'image/webp', cacheControl: '31536000', upsert: false });

    if (error) {
      flash(`Upload failed: ${error.message}`, false);
      return null;
    }

    const { data } = supabase.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  }, [supabase]);

  const deleteImagePaths = useCallback(async (paths: string[]) => {
    if (paths.length === 0) return true;
    const { error } = await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove(paths);
    if (error) {
      flash(`Image cleanup failed: ${error.message}`, false);
      return false;
    }
    return true;
  }, [supabase]);

  const deleteProductImagesIfUnused = useCallback(async (
    urls: Iterable<string | null | undefined>,
    sourceProductId: string | null,
    nextProducts: Product[],
    currentProductImages: string[] = [],
  ) => {
    const currentPaths = new Set(uniqueProductImageStoragePaths(currentProductImages));
    const candidatePaths = uniqueProductImageStoragePaths(urls).filter((path) => !currentPaths.has(path));
    if (candidatePaths.length === 0) return;

    const referencedPaths = new Set<string>();
    nextProducts.forEach((product) => {
      if (sourceProductId && product.id === sourceProductId) return;
      uniqueProductImageStoragePaths([...(product.images ?? []), ...(product.image_urls ?? [])])
        .forEach((path) => referencedPaths.add(path));
    });

    const deletablePaths = candidatePaths.filter((path) => !referencedPaths.has(path));
    await deleteImagePaths(deletablePaths);
  }, [deleteImagePaths]);

  // --- Image upload ---
  const handleImageUpload = useCallback(async (files: FileList) => {
    if (!editing) return;
    const availableSlots = Math.max(0, MAX_PRODUCT_IMAGE_COUNT - editing.images.length);
    if (availableSlots <= 0) {
      flash(`Maximum ${MAX_PRODUCT_IMAGE_COUNT} photos per product. Remove a photo before uploading another.`, false);
      return;
    }
    const acceptedFiles = Array.from(files).slice(0, availableSlots);
    const rejectedForCount = files.length - acceptedFiles.length;
    const oversizedFiles = acceptedFiles.filter((file) => file.size > MAX_PRODUCT_IMAGE_UPLOAD_BYTES);
    const uploadFiles = acceptedFiles.filter((file) => file.size <= MAX_PRODUCT_IMAGE_UPLOAD_BYTES);
    if (rejectedForCount > 0) {
      flash(`Only ${availableSlots} more photo(s) allowed. ${rejectedForCount} file(s) were skipped.`, false);
    }
    if (oversizedFiles.length > 0) {
      flash(`Skipped ${oversizedFiles.length} oversized file(s). Each image must be 25 MB or less.`, false);
    }
    if (uploadFiles.length === 0) return;
    setUploading(true);

    const [firstFile, ...restFiles] = uploadFiles;

    async function processAndUpload(file: File): Promise<string | null> {
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement('canvas');
      const MAX = 2048;
      const scale = Math.min(1, MAX / Math.max(bitmap.width, bitmap.height));
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob>((res) =>
        canvas.toBlob((b) => res(b!), 'image/webp', 0.85)
      );
      return uploadImageBlob(blob);
    }

    let successCount = 0;

    // Add a freshly-uploaded photo to the editor, defaulting it to WHITE side
    // padding. New products already default their product-level padding to white
    // (nothing to pin). Existing products may use a different padding, so the new
    // photo gets a per-photo white entry — the new upload defaults to white without
    // changing the product's other photos. The admin can still change it after.
    const addUploadedImage = (prev: NonNullable<typeof editing>, url: string) => {
      const productLevelIsWhite = normalizeProductImagePaddingValue(prev.image_padding) === 'white';
      return {
        ...prev,
        images: [...prev.images, url],
        image_padding_by_image: productLevelIsWhite
          ? prev.image_padding_by_image
          : { ...(prev.image_padding_by_image ?? {}), [url]: 'white' as const },
      };
    };

    // Upload the first photo and add it to state immediately so the AI assistant
    // becomes available while the remaining photos continue uploading in the background.
    const firstUrl = await processAndUpload(firstFile);
    if (firstUrl) {
      successCount++;
      setSessionUploadedImageUrls((current) => new Set(current).add(firstUrl));
      setEditing((prev) => prev ? addUploadedImage(prev, firstUrl) : prev);
    }

    for (const file of restFiles) {
      const url = await processAndUpload(file);
      if (url) {
        successCount++;
        setSessionUploadedImageUrls((current) => new Set(current).add(url));
        setEditing((prev) => prev ? addUploadedImage(prev, url) : prev);
      }
    }

    setUploading(false);
    if (successCount) flash(`${successCount} image(s) uploaded`);
  }, [editing, uploadImageBlob]);

  async function saveCroppedImage() {
    if (!editing || !cropTarget) return;
    const isFullImageCrop =
      cropRect.x === FULL_IMAGE_CROP.x &&
      cropRect.y === FULL_IMAGE_CROP.y &&
      cropRect.width === FULL_IMAGE_CROP.width &&
      cropRect.height === FULL_IMAGE_CROP.height;

    if (isFullImageCrop) {
      setCropTarget(null);
      flash('No crop changes applied');
      return;
    }

    setCropping(true);

    try {
      const image = new window.Image();
      image.crossOrigin = 'anonymous';
      image.src = cropTarget.url;
      await image.decode();

      const sx = Math.round((cropRect.x / 100) * image.naturalWidth);
      const sy = Math.round((cropRect.y / 100) * image.naturalHeight);
      const sw = Math.round((cropRect.width / 100) * image.naturalWidth);
      const sh = Math.round((cropRect.height / 100) * image.naturalHeight);
      const MAX = 2048;
      const scale = Math.min(1, MAX / Math.max(sw, sh));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(sw * scale));
      canvas.height = Math.max(1, Math.round(sh * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Crop canvas is unavailable.');

      ctx.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Could not create cropped image.')), 'image/webp', 0.9)
      );
      const croppedUrl = await uploadImageBlob(blob);
      if (!croppedUrl) return;

      setEditing((prev) => {
        if (!prev) return prev;
        const images = [...prev.images];
        images[cropTarget.index] = croppedUrl;
        const imageUrls = prev.image_urls?.length ? [...prev.image_urls] : [];
        if (imageUrls.length) imageUrls[cropTarget.index] = croppedUrl;
        return { ...prev, images, image_urls: imageUrls.length ? imageUrls : images };
      });
      setSessionUploadedImageUrls((current) => {
        const next = new Set(current);
        next.add(croppedUrl);
        return next;
      });
      // The replaced image is left in storage until the user saves (pruned then)
      // or cancels (cleaned up) — cropping is not a destructive write before Save.
      setPreviewImg({ url: croppedUrl, index: cropTarget.index });
      setCropTarget(null);
      flash('Cropped image saved');
    } catch {
      flash('Crop failed. Try a newly uploaded image if this photo is from an older source.', false);
    } finally {
      setCropping(false);
    }
  }

  function updateCropRect(patch: Partial<CropRect>) {
    setCropRect((current) => {
      const width = Math.min(100, Math.max(10, patch.width ?? current.width));
      const height = Math.min(100, Math.max(10, patch.height ?? current.height));
      const x = Math.min(100 - width, Math.max(0, patch.x ?? current.x));
      const y = Math.min(100 - height, Math.max(0, patch.y ?? current.y));
      return { x, y, width, height };
    });
  }

  function startCropDrag(event: React.PointerEvent<HTMLElement>, mode: CropDragMode) {
    event.preventDefault();
    event.stopPropagation();
    const cropArea = event.currentTarget.closest('[data-crop-area="true"]') as HTMLElement | null;
    if (!cropArea) return;
    const bounds = cropArea.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    const startRect = cropRect;

    event.currentTarget.setPointerCapture(event.pointerId);

    const onPointerMove = (moveEvent: PointerEvent) => {
      const dx = ((moveEvent.clientX - startX) / bounds.width) * 100;
      const dy = ((moveEvent.clientY - startY) / bounds.height) * 100;
      const next = { ...startRect };

      if (mode.includes('e')) next.width = startRect.width + dx;
      if (mode.includes('s')) next.height = startRect.height + dy;
      if (mode.includes('w')) {
        next.x = startRect.x + dx;
        next.width = startRect.width - dx;
      }
      if (mode.includes('n')) {
        next.y = startRect.y + dy;
        next.height = startRect.height - dy;
      }
      if (mode === 'move') {
        next.x = startRect.x + dx;
        next.y = startRect.y + dy;
      }

      updateCropRect(next);
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  }

  function removeImage(idx: number) {
    // Stage the removal in the draft only. Storage cleanup is deferred until the
    // user saves (the removed image is pruned then) or cancels (session uploads
    // are cleaned up), so no photo is deleted from storage before Save is clicked.
    setEditing((prev) => prev ? {
      ...prev,
      images: prev.images.filter((_, i) => i !== idx),
      image_urls: (prev.image_urls?.length ? prev.image_urls : prev.images).filter((_, i) => i !== idx),
    } : prev);
  }

  function moveImage(idx: number, direction: -1 | 1) {
    moveImageToIndex(idx, idx + direction);
  }

  function moveImageToIndex(idx: number, nextIndex: number) {
    setEditing((prev) => {
      if (!prev) return prev;
      if (nextIndex < 0 || nextIndex >= prev.images.length || nextIndex === idx) return prev;
      const images = [...prev.images];
      const [moved] = images.splice(idx, 1);
      images.splice(nextIndex, 0, moved);
      return { ...prev, images, image_urls: images };
    });
  }

  async function updateProductStatus(product: Product, status: ProductStatus) {
    const result = await adminUpdateProductStatus(product.id, status);
    if (!result.error) {
      setProducts((prev) => prev.map((p) => p.id === product.id ? { ...p, status } : p));
      flash(`${product.title} marked ${getStatusLabel(status)}`);
      return;
    }
    flash(result.error, false);
  }

  async function updateProductImagePadding(product: Product, imagePadding: ProductImagePadding | string, imageIndex = imagePaddingTargetIndex) {
    const paddingValue = normalizeProductImagePaddingValue(imagePadding);
    const images = getProductImages(product);
    const image = images[imageIndex] ?? null;
    const key = productImagePaddingMapKey(image, imageIndex);
    const nextMap = {
      ...normalizeProductImagePaddingMap(product.image_padding_by_image),
      [key]: paddingValue,
    };
    const { error } = await supabase
      .from('products')
      .update({ image_padding_by_image: nextMap })
      .eq('id', product.id);

    if (!error) {
      const nextProduct = { ...product, image_padding_by_image: nextMap };
      setProducts((prev) => prev.map((p) => p.id === product.id ? { ...p, image_padding_by_image: nextMap } : p));
      setImagePaddingTarget(nextProduct);
      const builtInLabel = IMAGE_PADDING_OPTIONS.find((option) => option.value === paddingValue)?.label;
      flash(`Photo ${imageIndex + 1} padding set to ${builtInLabel ?? paddingValue}`);
      return true;
    }

    const message = error.message.includes('image_padding_by_image')
      ? 'Per-photo padding needs the updated Supabase image-padding SQL. Run supabase/product-image-padding.sql, then try again.'
      : error.message.includes('products_image_padding_check')
      ? 'Custom padding colors need the updated Supabase image-padding SQL. Run supabase/product-image-padding.sql, then try again.'
      : error.message;
    setImagePaddingNotice({ text: message, ok: false });
    flash(message, false);
    return false;
  }

  async function applyImagePaddingToAll(product: Product, paddingValue: ProductImagePadding | string) {
    const normalized = normalizeProductImagePaddingValue(paddingValue);
    const images = getProductImages(product);
    const nextMap: ProductImagePaddingMap = {};
    images.forEach((image, index) => {
      nextMap[productImagePaddingMapKey(image, index)] = normalized;
    });
    const { error } = await supabase
      .from('products')
      .update({ image_padding_by_image: nextMap })
      .eq('id', product.id);

    if (!error) {
      const nextProduct = { ...product, image_padding_by_image: nextMap };
      setProducts((prev) => prev.map((p) => p.id === product.id ? { ...p, image_padding_by_image: nextMap } : p));
      setImagePaddingTarget(nextProduct);
      const builtInLabel = IMAGE_PADDING_OPTIONS.find((option) => option.value === normalized)?.label;
      flash(`Padding set to ${builtInLabel ?? normalized} for all ${images.length} photos`);
      return true;
    }

    const message = error.message.includes('image_padding_by_image')
      ? 'Per-photo padding needs the updated Supabase image-padding SQL. Run supabase/product-image-padding.sql, then try again.'
      : error.message.includes('products_image_padding_check')
      ? 'Custom padding colors need the updated Supabase image-padding SQL. Run supabase/product-image-padding.sql, then try again.'
      : error.message;
    setImagePaddingNotice({ text: message, ok: false });
    flash(message, false);
    return false;
  }

  async function pickImagePaddingColorFromScreen() {
    if (!imagePaddingTarget) return;
    const selectedProduct = imagePaddingTarget;
    const selectedIndex = imagePaddingTargetIndexRef.current;
    const EyeDropper = (window as WindowWithEyeDropper).EyeDropper;
    if (!EyeDropper) {
      setImagePaddingNotice({
        text: 'This browser does not support screen color picking. Use the color swatch instead.',
        ok: false,
      });
      return;
    }

    try {
      const result = await new EyeDropper().open();
      const color = result.sRGBHex.toLowerCase();
      setImagePaddingCustomColor(color);
      const saved = await updateProductImagePadding(selectedProduct, color, selectedIndex);
      if (saved) setImagePaddingNotice({ text: `Photo ${selectedIndex + 1} padding set to ${color}.`, ok: true });
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        setImagePaddingNotice(null);
        return;
      }
      setImagePaddingNotice({
        text: error instanceof Error ? error.message : 'Color picking was cancelled.',
        ok: false,
      });
    }
  }

  function duplicateProduct(product: Product) {
    const copyId = `${product.id}-copy-${Date.now()}`;
    const copy = {
      ...product,
      id: copyId,
      inventory_number: getNextInventoryNumber(products),
      sku: null,
      slug: copyId,
      title: `${product.title} (Copy)`,
      title_es: product.title_es ? `${product.title_es} (Copia)` : null,
      status: 'draft' as ProductStatus,
      sort_order: products.length > 0 ? Math.max(...products.map(p => p.sort_order ?? 0)) + 1 : 1,
    };
    originalRef.current = null;
    setFormErrors([]);
    setQuickEntry('');
    setQuickAddMode(false);
    setShowAdvancedIds(false);
    setOpenEditorSections({ photos: false, ai: false, details: false });
    setInventoryNumberManual(false);
    const nextProductType = getProductJewelryType(product);
    setJewelryTypeInput(nextProductType);
    setChainTypeInput(productSupportsLinkType(nextProductType) ? getProductLinkType(product) : '');
    setLengthInput(getProductLength(product));
    setEditing(copy);
    setIsNew(true);
  }

  // --- Save product ---
  async function handleSave(afterSave: 'stay' | 'another' | 'close' = 'close') {
    if (!editing) return;
    setSaving(true);

    // English now / Spanish on save: the listing AI generates English only, so fill any
    // missing Spanish title/description by translating the English at save time.
    let nextTitleEs = editing.title_es ?? null;
    let nextDescriptionEs = editing.description_es ?? null;
    let nextPublicNotesEs = editing.public_notes_es ?? null;
    const needTitleEs = !!editing.title?.trim() && !editing.title_es?.trim();
    const needDescriptionEs = !!editing.description?.trim() && !editing.description_es?.trim();
    const needNotesEs = !!editing.public_notes?.trim() && !editing.public_notes_es?.trim();
    if (isNew && (needTitleEs || needDescriptionEs || needNotesEs)) {
      try {
        const res = await fetch('/api/admin/translate', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            title: needTitleEs ? editing.title : '',
            description: needDescriptionEs ? editing.description : '',
            notes: needNotesEs ? editing.public_notes : '',
          }),
        });
        const data = await res.json().catch(() => null);
        if (res.ok && data) {
          if (needTitleEs && data.title_es) nextTitleEs = data.title_es;
          if (needDescriptionEs && data.description_es) nextDescriptionEs = data.description_es;
          if (needNotesEs && data.notes_es) nextPublicNotesEs = data.notes_es;
        }
      } catch {
        // Non-blocking: if translation fails, the save proceeds with existing ES values.
      }
    }

    // Build tags with updated jt:, ct:, and len: entries
    const normalizedJewelryType = normalizeProductTypeValue(jewelryTypeInput) ?? 'Other';
    const supportsLinkType = productSupportsLinkType(normalizedJewelryType);
    const supportsLength = productUsesLength(normalizedJewelryType);
    const supportsSize = productUsesSize(normalizedJewelryType);
    const supportsHeight = productUsesHeight(normalizedJewelryType);
    const normalizedLinkType = supportsLinkType ? chainTypeInput.trim() : '';
    const normalizedLength = supportsLength || supportsSize || supportsHeight ? normalizeProductLengthSizeValue(lengthInput) : '';
    const normalizedMetalType = normalizeProductMetalType(editing.metal_type, editing.category);
    const legacyCategory = getLegacyCategoryForMetalType(normalizedMetalType, editing.category);
    const baseTags = (editing.tags ?? []).filter(t => !t.startsWith('jt:') && !t.startsWith('ct:') && !t.startsWith('len:'));
    const withJewelryType = normalizedJewelryType ? [...baseTags, `jt:${normalizedJewelryType}`] : baseTags;
    const withChain = normalizedLinkType ? [...withJewelryType, `ct:${normalizedLinkType}`] : withJewelryType;
    const finalTags = normalizedLength ? [...withChain, `len:${normalizedLength}`] : withChain;
    const normalizedManualPriceLabel = normalizeManualPriceLabel(editing.manual_price_label);
    const effectivePriceMode: Product['price_mode'] =
      quickAddMode || editing.price_mode === 'manual' || normalizedManualPriceLabel
        ? 'manual'
        : 'spot-multiplier';

    const payload = {
      ...editing,
      id: editing.id || buildGeneratedProductId(editing),
      slug: editing.slug || editing.id || slugifyProductText(editing.title),
      inventory_number: parseInventoryNumber(editing.inventory_number),
      sku: editing.sku?.trim() || (editing.inventory_number ? String(editing.inventory_number) : null),
      category: legacyCategory,
      metal: normalizedMetalType,
      metal_type: normalizedMetalType,
      metal_variant: normalizeProductMetalVariant(editing.metal_variant, legacyCategory),
      purity: editing.purity ?? null,
      weight_grams: editing.weight_grams ?? null,
      gram_weight: editing.gram_weight ?? editing.weight_grams ?? null,
      brand: editing.brand?.trim() || null,
      product_type: normalizedJewelryType,
      jewelry_type: normalizedJewelryType,
      chain_type: normalizedLinkType || null,
      length: normalizedLength || null,
      price_mode: effectivePriceMode,
      pricing_multiplier: effectivePriceMode === 'manual' ? null : editing.pricing_multiplier ?? null,
      manual_price_label: effectivePriceMode === 'manual' ? normalizedManualPriceLabel : null,
      asking_price: null,
      status: normalizeProductStatus(editing.status),
      location: editing.location || 'showcase',
      item_year: normalizeProductItemYear(editing.item_year),
      image_urls: editing.images,
      image_padding: normalizeProductImagePaddingValue(editing.image_padding),
      image_padding_by_image: normalizeProductImagePaddingMap(editing.image_padding_by_image),
      tags: finalTags,
      details: [],
      details_es: [],
      title_es: nextTitleEs,
      description_es: nextDescriptionEs,
      public_notes_es: nextPublicNotesEs,
      internal_notes: foldExtraDetailsIntoInternalNotes(editing),
    };
    const originalProductId = originalRef.current?.id ?? payload.id;
    const originalImageUrls = originalRef.current
      ? [...(originalRef.current.images ?? []), ...(originalRef.current.image_urls ?? [])]
      : [];
    const errs = validate(payload, isNew ? undefined : originalProductId);
    if (errs.length) { setFormErrors(errs); setSaving(false); return; }
    setFormErrors([]);

    let nextProducts = products;
    let savedId: string | undefined;

    if (isNew) {
      // Don't use .select() on insert — `authenticated` no longer has SELECT on
      // internal product columns (cost_basis, minimum_price, internal_notes, …),
      // so returning the row would fail. `payload` already holds everything the
      // form entered, including the generated id, so use it optimistically (the
      // full row reloads via the service role on the next page load). (CODE-D04)
      let { error } = await supabase.from('products').insert(payload);
      if (isMissingOptionalColumnError(error)) {
        const retry = await supabase.from('products').insert(withoutOptionalColumns(payload));
        error = retry.error;
      }
      if (error) { flash(error.message, false); setSaving(false); return; }
      const savedProduct = payload as unknown as Product;
      savedId = savedProduct.id;
      nextProducts = [savedProduct, ...products];
      setProducts(nextProducts);
    } else {
      // Skip the network call entirely if nothing changed.
      if (JSON.stringify(payload) === JSON.stringify(originalRef.current)) {
        setSaving(false);
        if (afterSave === 'close') closeModal();
        else if (afterSave === 'another') openAdd();
        return;
      }
      // Don't use .select().single() on update — RLS may allow UPDATE but not SELECT,
      // causing PGRST116 and blocking the modal from closing.
      let { error } = await supabase.from('products').update(payload).eq('id', originalProductId);
      if (isMissingOptionalColumnError(error)) {
        const retry = await supabase.from('products').update(withoutOptionalColumns(payload)).eq('id', originalProductId);
        error = retry.error;
      }
      if (error) { flash(error.message, false); setSaving(false); return; }
      savedId = originalProductId;
      nextProducts = products.map((p) => p.id === originalProductId ? (payload as unknown as Product) : p);
      setProducts(nextProducts);
    }

    // Reconcile storage on commit: delete every image this listing no longer
    // references — photos removed from the draft (originalImageUrls) and any
    // session uploads that didn't make it into the saved set — while keeping the
    // saved images and anything shared with other listings.
    const cleanupCandidates = [...originalImageUrls, ...sessionUploadedImageUrls];
    if (cleanupCandidates.length > 0) {
      await deleteProductImagesIfUnused(
        cleanupCandidates,
        originalProductId,
        nextProducts,
        [...(payload.images ?? []), ...(payload.image_urls ?? [])],
      );
    }
    setSessionUploadedImageUrls(new Set());

    flash(isNew ? 'Product added' : 'Product saved');
    setSaving(false);
    if (savedId) void adminRevalidateProduct(savedId);

    if (afterSave === 'close') {
      closeModal();
    } else if (afterSave === 'another') {
      openAddFromProducts(nextProducts);
    } else {
      // 'stay' — update originalRef so no-op check is correct on next save
      originalRef.current = payload as ReturnType<typeof emptyProduct>;
      if (isNew) {
        setIsNew(false);
        setEditing(payload as ReturnType<typeof emptyProduct>);
      }
    }
  }

  // --- Delete product ---
  async function handleDelete() {
    if (!deleteTarget) return;

    const { count, error: orderLookupError } = await supabase
      .from('order_items')
      .select('id', { count: 'exact', head: true })
      .eq('product_id', deleteTarget.id);

    if (orderLookupError && orderLookupError.code !== '42P01') {
      flash(orderLookupError.message, false);
      return;
    }

    if ((count ?? 0) > 0) {
      const { error } = await supabase.from('products').update({ status: 'archived' }).eq('id', deleteTarget.id);
      if (error) { flash(error.message, false); return; }
      void adminRevalidateProduct(deleteTarget.id);
      setProducts((prev) => prev.map((p) => p.id === deleteTarget.id ? { ...p, status: 'archived' } : p));
      flash('Product has order history, so it was archived instead of deleted.');
      setDeleteTarget(null);
      return;
    }

    const deleteImageUrls = [...(deleteTarget.images ?? []), ...(deleteTarget.image_urls ?? [])];
    const { error } = await supabase.from('products').delete().eq('id', deleteTarget.id);
    if (error) { flash(error.message, false); return; }
    void adminRevalidateProduct(deleteTarget.id);
    const nextProducts = products.filter((p) => p.id !== deleteTarget.id);
    setProducts(nextProducts);
    await deleteProductImagesIfUnused(deleteImageUrls, deleteTarget.id, nextProducts);
    flash('Product deleted');
    setDeleteTarget(null);
  }

  const masterOrderedProducts = useMemo(() => getMasterProductOrder(products), [products]);

  // --- Filtered list ---
  const filtered = masterOrderedProducts.filter((p) => {
    const searchText = [
      p.title,
      p.brand,
      p.id,
      p.inventory_number,
      p.sku,
      getProductMetal(p),
      p.category,
      productMetalTypeLabel(p.metal_type, p.category),
      productMetalVariantLabel(p.metal_variant, p.category),
      productJewelryTypeLabel(getProductJewelryType(p)),
      p.purity ? `${p.purity}` : '',
      getProductLinkType(p),
      getProductLength(p),
    ].filter(Boolean).join(' ').toLowerCase();
    if (search && !searchText.includes(search.toLowerCase())) return false;
    if (filterStatus && normalizeProductStatus(p.status) !== filterStatus) return false;
    if (filterMetal === 'gold' && getProductMetalType(p) !== 'Gold') return false;
    if (filterMetal === 'silver' && getProductMetalType(p) !== 'Silver') return false;
    if (filterMetalVariant && getProductMetalVariant(p) !== filterMetalVariant) return false;
    if (filterCategory && getProductMetalType(p) !== filterCategory) return false;
    if (filterBrand && p.brand !== filterBrand) return false;
    if (filterGender && String(p.gender ?? '').toLowerCase() !== filterGender) return false;
    if (filterPurity && p.purity !== parseInt(filterPurity)) return false;
    if (filterLocation && (p.location ?? 'showcase') !== filterLocation) return false;
    if (filterFeatured === 'featured' && !p.featured) return false;
    if (filterFeatured === 'not-featured' && p.featured) return false;
    if (filterJewelryType && getProductJewelryType(p) !== filterJewelryType) return false;
    if (filterChainType) {
      const kws = CHAIN_KEYWORDS[filterChainType];
      if (kws) {
        const txt = [getProductLinkType(p), ...(p.tags ?? [])].join(' ').toLowerCase();
        if (!kws.some(k => txt.includes(k))) return false;
      } else if (getProductLinkType(p) !== filterChainType) {
        return false;
      }
    }
    if (filterLength) {
      if (getProductLength(p) !== filterLength) return false;
    }
    return true;
  });

  const inventoryNumbers = useMemo(() => {
    return new Map(masterOrderedProducts.map((product, index) => [product.id, index + 1]));
  }, [masterOrderedProducts]);

  const sortedProducts = useMemo(() => {
    if (!sortConfig) return filtered;
    return filtered
      .map((product, index) => ({ product, index }))
      .sort((a, b) => {
        const compared = compareSortValues(
          getSortValue(a.product, sortConfig.key, spotData, inventoryNumbers),
          getSortValue(b.product, sortConfig.key, spotData, inventoryNumbers),
        );
        const stableCompared = compared || a.index - b.index;
        return sortConfig.direction === 'asc' ? stableCompared : -stableCompared;
      })
      .map(({ product }) => product);
  }, [filtered, inventoryNumbers, sortConfig, spotData]);

  function toggleSort(key: SortKey) {
    setSortConfig((current) => {
      if (!current || current.key !== key) return { key, direction: 'asc' };
      return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
    });
  }

  const hasActiveTableFilters = !!(
    search ||
    filterStatus ||
    filterMetal ||
    filterMetalVariant ||
    filterPurity ||
    filterCategory ||
    filterBrand ||
    filterGender ||
    filterJewelryType ||
    filterChainType ||
    filterLength ||
    filterLocation ||
    filterFeatured
  );
  const activeDropdownFilterCount = [
    filterStatus,
    filterMetal,
    filterMetalVariant,
    filterPurity,
    filterCategory,
    filterBrand,
    filterGender,
    filterJewelryType,
    filterChainType,
    filterLength,
    filterLocation,
    filterFeatured,
  ].filter(Boolean).length;
  const canDragReorder = !sortConfig && !hasActiveTableFilters && !reordering;
  const selectedFilterProductType = normalizeProductJewelryType(filterJewelryType);
  const adminSilverwareOnlyMetal = selectedFilterProductType === 'Silverware';
  const adminPurityOptions = filterMetal === 'silver' || filterCategory === 'Silver'
    ? SILVER_FILTER_PURITY_OPTIONS
    : filterMetal === 'gold' || filterCategory === 'Gold'
      ? GOLD_FILTER_PURITY_OPTIONS
      : [...GOLD_FILTER_PURITY_OPTIONS, ...SILVER_FILTER_PURITY_OPTIONS];
  const visibleAdminPurity = adminPurityOptions.some(([value]) => value === filterPurity) ? filterPurity : '';
  const showAdminLinkTypeFilter = productSupportsLinkType(selectedFilterProductType);
  const showAdminSizeFilter = productUsesSize(selectedFilterProductType);
  const scopedLengthSizeOptions = selectedFilterProductType === 'Necklace'
    ? [
        ['', 'All Lengths'],
        ['16', '16 in'],
        ['18', '18 in'],
        ['20', '20 in'],
        ['22', '22 in'],
        ['24', '24 in'],
        ['26', '26 in'],
        ['28', '28 in'],
        ['30', '30 in'],
      ]
    : selectedFilterProductType === 'Bracelet'
      ? [
        ['', 'All Lengths'],
        ['7', '7 in (bracelet)'],
        ['7.5', '7.5 in (bracelet)'],
        ['8', '8 in (bracelet)'],
      ]
    : showAdminSizeFilter
      ? [
          ['', 'All Sizes'],
          ['4', 'Size 4'],
          ['4.5', 'Size 4.5'],
          ['5', 'Size 5'],
          ['5.5', 'Size 5.5'],
          ['6', 'Size 6'],
          ['6.5', 'Size 6.5'],
          ['7', 'Size 7'],
          ['7.5', 'Size 7.5'],
          ['8', 'Size 8'],
          ['8.5', 'Size 8.5'],
          ['9', 'Size 9'],
          ['9.5', 'Size 9.5'],
          ['10', 'Size 10'],
          ['10.5', 'Size 10.5'],
          ['11', 'Size 11'],
          ['11.5', 'Size 11.5'],
          ['12', 'Size 12'],
          ['12.5', 'Size 12.5'],
          ['13', 'Size 13'],
        ]
      : [];

  function resetRowDrag() {
    setDraggedProductId(null);
    setDragTargetProductId(null);
  }

  async function handleProductDrop(targetProduct: Product) {
    if (!draggedProductId || draggedProductId === targetProduct.id || !canDragReorder) {
      resetRowDrag();
      return;
    }

    const draggedProduct = products.find((product) => product.id === draggedProductId);
    if (!draggedProduct) {
      resetRowDrag();
      return;
    }

    if (normalizeProductStatus(draggedProduct.status) !== normalizeProductStatus(targetProduct.status)) {
      flash('Move items within the same status group. Change status first to move across groups.', false);
      resetRowDrag();
      return;
    }

    const statusGroup = masterOrderedProducts.filter((product) => normalizeProductStatus(product.status) === normalizeProductStatus(draggedProduct.status));
    const fromIndex = statusGroup.findIndex((product) => product.id === draggedProduct.id);
    const toIndex = statusGroup.findIndex((product) => product.id === targetProduct.id);
    if (fromIndex < 0 || toIndex < 0) {
      resetRowDrag();
      return;
    }

    const reorderedGroup = [...statusGroup];
    const [moved] = reorderedGroup.splice(fromIndex, 1);
    reorderedGroup.splice(toIndex, 0, moved);
    const orderById = new Map(reorderedGroup.map((product, index) => [product.id, index + 1]));

    setReordering(true);
    const { error } = await supabase
      .from('products')
      .upsert(
        reorderedGroup.map((product, index) => ({ id: product.id, sort_order: index + 1 })),
        { onConflict: 'id' },
      );
    if (error) {
      flash(`Reorder failed: ${error.message}`, false);
      setReordering(false);
      resetRowDrag();
      return;
    }

    setProducts((prev) =>
      prev.map((product) =>
        orderById.has(product.id)
          ? { ...product, sort_order: orderById.get(product.id)! }
          : product
      )
    );
    flash('Inventory order saved');
    setReordering(false);
    resetRowDrag();
  }

  const total = products.length;
  const available = products.filter((p) => normalizeProductStatus(p.status) === 'available').length;
  const sold = products.filter((p) => normalizeProductStatus(p.status) === 'sold').length;
  const existingBrandOptions = Array.from(new Set(products.map((product) => product.brand?.trim()).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b));

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-background)' }}>

      <AdminHeader
        adminBasePath={adminBasePath}
        active="products"
        unreadMessagesCount={unreadMessagesCount}
        userEmail={userEmail}
        rightContent={(
          <>
          {spotData && (
            <span className="text-xs hidden md:flex items-center gap-2 flex-shrink-0"
              style={{ fontFamily: 'var(--font-label)' }}>
              <span className="font-bold" style={{ color: 'var(--color-primary)' }}>
                Au ${spotData.goldPerTroyOz.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
              {spotData.silverPerTroyOz && (
                <span className="font-bold" style={{ color: 'var(--color-on-surface-variant)' }}>
                  Ag ${spotData.silverPerTroyOz.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              )}
              <span className="text-[0.58rem] font-normal" style={{ color: 'var(--color-on-surface-variant)' }}>
                /oz {spotData.source === 'fallback' ? '(ref)' : '(live)'}
              </span>
            </span>
          )}
          <button
            type="button"
            onClick={handleSignOut}
            className="outline-button text-xs"
          >
            Sign Out
          </button>
          </>
        )}
      />

      <div className="max-w-[1700px] 2xl:max-w-[2200px] mx-auto px-4 md:px-8 2xl:px-10 py-8">

        {/* Flash message */}
        {msg && (
          <div
            className="mb-6 px-4 py-3 text-sm font-medium"
            style={{
              background: msg.ok ? 'color-mix(in srgb, var(--color-primary) 12%, transparent)' : 'color-mix(in srgb, var(--color-error) 12%, transparent)',
              color: msg.ok ? 'var(--color-primary)' : 'var(--color-error)',
              border: `1px solid ${msg.ok ? 'color-mix(in srgb, var(--color-primary) 30%, transparent)' : 'color-mix(in srgb, var(--color-error) 30%, transparent)'}`,
            }}
          >
            {msg.text}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Total', value: total },
            { label: 'Available', value: available },
            { label: 'Sold', value: sold },
          ].map(({ label, value }) => (
            <div key={label}
              className="border p-4"
              style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
              <p className="text-2xl font-bold" style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}>{value}</p>
              <p className="text-xs uppercase tracking-wide mt-1" style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}>{label}</p>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex flex-col gap-3 mb-5">
          <div className="flex items-center gap-3 flex-wrap">
            <input
              type="search"
              placeholder="Search products…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="form-field flex-1 min-w-48"
            />
            <button type="button" onClick={openAdd} className="gold-button text-sm flex-shrink-0">
              + Add Product
            </button>
            <button
              type="button"
              onClick={() => setShowTableFilters((current) => !current)}
              className="outline-button inline-flex items-center gap-2 text-sm flex-shrink-0"
              aria-expanded={showTableFilters}
              aria-controls="admin-product-table-filters"
              aria-label="Filters"
            >
              <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: '17px', lineHeight: 1 }}>
                filter_list
              </span>
              Filters{activeDropdownFilterCount > 0 ? ` (${activeDropdownFilterCount})` : ''}
            </button>
            <span className="text-xs ml-auto"
              style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}>
              {filtered.length} / {products.length}
            </span>
          </div>

          {/* Filter dropdowns */}
          {showTableFilters && (
          <div
            id="admin-product-table-filters"
            className="flex flex-wrap gap-2 items-end border px-3 py-3"
            style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}
          >
            {[
              {
                label: 'Gender', value: filterGender, set: setFilterGender,
                options: [['', 'All Genders'], ['unisex', 'Unisex'], ['men', 'Men'], ['women', 'Women']],
              },
              {
                label: 'Product Type', value: filterJewelryType, set: (value: string) => {
                  setFilterJewelryType(value);
                  setFilterChainType('');
                  setFilterLength('');
                  if (value === 'Silverware') {
                    setFilterMetal('silver');
                    setFilterCategory('Silver');
                    if (!SILVER_FILTER_PURITY_OPTIONS.some(([optionValue]) => optionValue === filterPurity)) {
                      setFilterPurity('');
                    }
                    if (!PRODUCT_METAL_VARIANTS.Silver.some((variant) => variant.value === filterMetalVariant)) {
                      setFilterMetalVariant('');
                    }
                  }
                },
                options: [['', 'All Product Types'], ...productTypeOptions.map((value) => [value, productJewelryTypeLabel(value)])],
              },
              {
                label: 'Brand', value: filterBrand, set: setFilterBrand,
                options: [['', 'All Brands'], ...existingBrandOptions.map((brand) => [brand, brand])],
              },
              {
                label: 'Metal', value: filterMetal, set: (value: string) => {
                  setFilterMetal(value);
                  if (value === 'silver' && !SILVER_FILTER_PURITY_OPTIONS.some(([optionValue]) => optionValue === filterPurity)) {
                    setFilterPurity('');
                  }
                  if (value === 'gold' && !GOLD_FILTER_PURITY_OPTIONS.some(([optionValue]) => optionValue === filterPurity)) {
                    setFilterPurity('');
                  }
                },
                options: adminSilverwareOnlyMetal
                  ? [['silver', 'Silver']]
                  : [['', 'All Metals'], ['gold', 'Gold'], ['silver', 'Silver']],
              },
              {
                label: 'Metal Type', value: filterCategory, set: (value: string) => {
                  setFilterCategory(value);
                  if (value === 'Silver' && !SILVER_FILTER_PURITY_OPTIONS.some(([optionValue]) => optionValue === filterPurity)) {
                    setFilterPurity('');
                  }
                  if (value === 'Gold' && !GOLD_FILTER_PURITY_OPTIONS.some(([optionValue]) => optionValue === filterPurity)) {
                    setFilterPurity('');
                  }
                },
                options: [['', 'All Metal Types'], ...PRODUCT_METAL_TYPES.map((metalType) => [metalType.value, metalType.label])],
              },
              {
                label: 'Metal Color', value: filterMetalVariant, set: setFilterMetalVariant,
                options: [
                  ['', 'All Colors'],
                  ...PRODUCT_METAL_VARIANTS.Gold.map((variant) => [variant.value, variant.label]),
                  ...PRODUCT_METAL_VARIANTS.Silver.map((variant) => [variant.value, variant.label]),
                ],
              },
              {
                label: 'Purity', value: visibleAdminPurity, set: setFilterPurity,
                options: [['', 'All Purities'], ...adminPurityOptions],
              },
              ...(showAdminLinkTypeFilter ? [
                {
                  label: 'Link Type', value: filterChainType, set: setFilterChainType,
                  options: [
                    ['', 'All Link Types'],
                    ['cuban-link', 'Cuban link'],
                    ['figaro-link', 'Figaro link'],
                    ['rope-chain', 'Rope chain'],
                    ['anchor-link', 'Anchor / Gucci'],
                    ['oval-link', 'Oval link'],
                    ['byzantine-link', 'Byzantine'],
                    ['box-link', 'Box link'],
                  ],
                },
              ] : []),
              ...(scopedLengthSizeOptions.length > 0 ? [
                {
                  label: showAdminSizeFilter ? 'Size' : 'Length',
                  value: filterLength,
                  set: (value: string) => setFilterLength(normalizeProductLengthSizeValue(value)),
                  options: scopedLengthSizeOptions,
                },
              ] : []),
              {
                label: 'Status', value: filterStatus, set: setFilterStatus,
                options: [['', 'All Statuses'], ...STATUSES.map((status) => [status.value, status.label])],
              },
              {
                label: 'Location', value: filterLocation, set: setFilterLocation,
                options: [['', 'All Locations'], ...LOCATIONS.map((location) => [location.value, location.label])],
              },
              {
                label: 'Featured', value: filterFeatured, set: setFilterFeatured,
                options: [['', 'All Items'], ['featured', 'Featured'], ['not-featured', 'Not Featured']],
              },
            ].map(({ label, value, set, options }) => (
              <div key={label} className="flex flex-col gap-0.5">
                <span className="text-[0.58rem] font-bold uppercase tracking-[0.14em]"
                  style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}>
                  {label}
                </span>
                <select
                  value={value}
                  onChange={(e) => (set as (v: string) => void)(e.target.value)}
                  className="form-field text-xs"
                  style={{ minWidth: 130 }}
                >
                  {options.map(([val, lbl]) => (
                    <option key={val} value={val}>{lbl}</option>
                  ))}
                </select>
              </div>
            ))}

            {/* Clear filters */}
            {(filterStatus || filterMetal || filterMetalVariant || filterPurity || filterCategory || filterBrand || filterGender || filterJewelryType || filterChainType || filterLength || filterLocation || filterFeatured) && (
              <button
                type="button"
                onClick={() => {
                  setFilterStatus('');
                  setFilterMetal('');
                  setFilterMetalVariant('');
                  setFilterPurity('');
                  setFilterCategory('');
                  setFilterBrand('');
                  setFilterGender('');
                  setFilterJewelryType('');
                  setFilterChainType('');
                  setFilterLength('');
                  setFilterLocation('');
                  setFilterFeatured('');
                }}
                className="text-xs font-bold uppercase tracking-wide hover:underline self-end pb-1"
                style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}
              >
                Clear
              </button>
            )}

          </div>
          )}
        </div>

        {/* Product table */}
        <div className="border" style={{ borderColor: 'var(--color-outline-variant)' }}>
          <div
            className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2 text-xs"
            style={{
              borderColor: 'var(--color-outline-variant)',
              color: 'var(--color-on-surface-variant)',
              fontFamily: 'var(--font-label)',
            }}
          >
            <span>Drag the grip in the master list to reorder gallery inventory numbers.</span>
            {!canDragReorder && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setFilterStatus('');
                  setFilterMetal('');
                  setFilterMetalVariant('');
                  setFilterPurity('');
                  setFilterCategory('');
                  setFilterBrand('');
                  setFilterGender('');
                  setFilterJewelryType('');
                  setFilterChainType('');
                  setFilterLength('');
                  setFilterLocation('');
                  setFilterFeatured('');
                  setSortConfig(null);
                }}
                className="font-bold uppercase tracking-wide hover:underline"
                style={{ color: 'var(--color-primary)' }}
              >
                Reset view to drag reorder
              </button>
            )}
            {reordering && (
              <span className="font-bold uppercase tracking-wide" style={{ color: 'var(--color-primary)' }}>
                Saving order...
              </span>
            )}
          </div>
          <div className="overflow-x-auto pb-24">
            <table className="w-max min-w-[1680px] 2xl:min-w-[1960px] text-sm">
              <thead>
                <tr className="border-b text-left" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-low)' }}>
                  <th
                    className="px-3 py-3 max-md:px-1 text-xs font-bold uppercase tracking-wide whitespace-nowrap"
                    style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}
                  >
                    <span className="max-md:hidden">Order</span>
                  </th>
                  {PRODUCT_TABLE_COLUMNS.map(({ label, sortKey, widthClass, responsiveClass }) => {
                    const active = sortConfig?.key === sortKey;
                    const isActionsColumn = !sortKey;
                    return (
                      <th
                        key={label || 'actions'}
                        aria-sort={active ? (sortConfig.direction === 'asc' ? 'ascending' : 'descending') : undefined}
                        className={`px-2 py-3 text-xs font-bold uppercase tracking-wide whitespace-nowrap ${widthClass ?? ''}${responsiveClass ? ` ${responsiveClass}` : ''}${label === 'Brand' ? ' border-l text-center' : ''}${isActionsColumn ? ' sticky right-0 z-10' : ''}`}
                        style={{
                          color: 'var(--color-on-surface-variant)',
                          fontFamily: 'var(--font-label)',
                          borderColor: label === 'Brand' ? 'var(--color-outline-variant)' : undefined,
                          background: isActionsColumn ? 'var(--color-surface-container-low)' : undefined,
                        }}
                      >
                        {sortKey ? (
                          <button
                            type="button"
                            onClick={() => toggleSort(sortKey)}
                            className={`flex items-center gap-1 uppercase tracking-wide hover:opacity-75${label === 'Brand' ? ' mx-auto justify-center' : ''}`}
                            style={{ fontFamily: 'var(--font-label)' }}
                          >
                            <span>{label}</span>
                            <span
                              aria-hidden="true"
                              className="text-[0.65rem]"
                              style={{ color: active ? 'var(--color-primary)' : 'var(--color-on-surface-variant)' }}
                            >
                              {active ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '↕'}
                            </span>
                          </button>
                        ) : label}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {sortedProducts.map((p) => (
                  <tr key={p.id}
                    draggable={canDragReorder}
                    onDragStart={(e) => {
                      if (!canDragReorder) return;
                      setDraggedProductId(p.id);
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', p.id);
                    }}
                    onDragOver={(e) => {
                      if (!canDragReorder || !draggedProductId || draggedProductId === p.id) return;
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      setDragTargetProductId(p.id);
                    }}
                    onDragLeave={() => {
                      if (dragTargetProductId === p.id) setDragTargetProductId(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      handleProductDrop(p);
                    }}
                    onDragEnd={resetRowDrag}
                    className="border-b hover:bg-[color:var(--color-surface-container-low)] transition-colors"
                    style={{
                      borderColor: dragTargetProductId === p.id ? 'var(--color-primary)' : 'var(--color-outline-variant)',
                      background: dragTargetProductId === p.id
                        ? 'color-mix(in srgb, var(--color-primary) 8%, transparent)'
                        : undefined,
                    }}>
                    <td className="px-2 py-3 max-md:px-0.5 max-md:w-[36px] whitespace-nowrap w-[52px]">
                      <span
                        className="material-symbols-outlined inline-flex h-8 w-8 items-center justify-center"
                        aria-hidden="true"
                        style={{
                          color: canDragReorder ? 'var(--color-primary)' : 'var(--color-outline-variant)',
                          cursor: canDragReorder ? 'grab' : 'not-allowed',
                          fontSize: '20px',
                          userSelect: 'none',
                        }}
                      >
                        drag_indicator
                      </span>
                    </td>
                    <td className="px-2 py-3 max-md:px-1 whitespace-nowrap w-[54px] font-bold text-xs" style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}>
                      {formatInventoryNumberDisplay(p.inventory_number ?? inventoryNumbers.get(p.id))}
                    </td>
                    <td className="p-0">
                      {getProductImages(p)[0] ? (
                        <div
                          className="relative w-16 h-16 overflow-hidden"
                          style={{ background: productImagePaddingBackground(productImagePaddingForImage(p.image_padding, p.image_padding_by_image, getProductImages(p)[0], 0)) }}
                        >
                          <Image
                            src={getProductImages(p)[0]}
                            alt={p.title}
                            fill
                            sizes="64px"
                            className="object-contain object-center"
                            unoptimized={getProductImages(p)[0].startsWith('/assets/')}
                          />
                        </div>
                      ) : (
                        <div className="w-16 h-16 flex items-center justify-center text-xl"
                          style={{ background: 'var(--color-surface-container)' }}>📷</div>
                      )}
                    </td>
                    <td className="px-2 py-3 font-medium w-[210px] max-w-[210px]" style={{ color: 'var(--color-on-surface)' }}>
                      <span className="line-clamp-2">{p.title}</span>
                    </td>
                    <td
                      className="border-l px-2 py-3 whitespace-nowrap w-[92px] max-w-[92px]"
                      style={{ color: 'var(--color-on-surface-variant)', borderColor: 'var(--color-outline-variant)' }}
                    >
                      <span className="block truncate text-center">{p.brand || '-'}</span>
                    </td>
                    <td className="px-2 py-3 whitespace-nowrap" style={{ color: 'var(--color-on-surface-variant)' }}>
                      {productMetalVariantLabel(p.metal_variant, p.category)}
                    </td>
                    <td className="px-2 py-3 whitespace-nowrap" style={{ color: 'var(--color-on-surface-variant)' }}>
                      {productJewelryTypeLabel(getProductJewelryType(p))}
                    </td>
                    <td className="hidden px-2 py-3 w-[118px] max-w-[118px] 2xl:table-cell" style={{ color: 'var(--color-on-surface-variant)' }}>
                      <span className="block truncate">{getProductLinkType(p) || '-'}</span>
                    </td>
                    <td className="px-2 py-3 whitespace-nowrap" style={{ color: 'var(--color-on-surface-variant)' }}>
                      {getProductLength(p) || '-'}
                    </td>
                    <td className="px-2 py-3 whitespace-nowrap text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                      {formatItemYear(p.item_year)}
                    </td>
                    <td className="px-2 py-3 whitespace-nowrap text-xs" style={{ color: p.featured ? 'var(--color-primary)' : 'var(--color-on-surface-variant)' }}>
                      {p.featured ? 'Yes' : 'No'}
                    </td>
                    <td className="px-2 py-3 whitespace-nowrap" style={{ color: 'var(--color-on-surface-variant)' }}>
                      {p.purity
                        ? p.purity <= 24
                          ? `${p.purity}k`
                          : ({ 999:'99.9%', 950:'95%', 925:'92.5%', 900:'90%', 850:'85%', 800:'80%' } as Record<number,string>)[p.purity] ?? `${p.purity}`
                        : '-'}
                    </td>
                    <td className="px-2 py-3 whitespace-nowrap" style={{ color: 'var(--color-on-surface-variant)' }}>
                      {getProductWeight(p) ? `${getProductWeight(p)}g` : '-'}
                    </td>
                    <td className="px-2 py-3 whitespace-nowrap font-semibold" style={{ color: 'var(--color-on-surface-variant)' }}>
                      {getSpotMeltDisplayPrice(p, spotData)}
                    </td>
                    <td className="px-2 py-3 whitespace-nowrap text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                      {p.price_mode === 'manual' ? 'Manual' : `Spot ×${p.pricing_multiplier ?? '?'}`}
                    </td>
                    <td className="px-2 py-3 whitespace-nowrap font-semibold" style={{ color: 'var(--color-primary)' }}>
                      {getDisplayPrice(p, spotData)}
                    </td>
                    <td className="px-2 py-3 whitespace-nowrap">
                      <span
                        className="inline-flex text-[0.6rem] font-bold uppercase tracking-widest px-2 py-0.5"
                        style={{
                          background: getStatusTone(p.status).bg,
                          color: getStatusTone(p.status).fg,
                          border: 'none',
                        }}>
                        {getStatusLabel(p.status)}
                      </span>
                    </td>
                    <td className={`sticky right-0 px-1 max-md:px-0 py-3 w-[44px] min-w-[44px] max-w-[44px] max-md:w-[28px] max-md:min-w-[28px] max-md:max-w-[28px] ${actionMenuId === p.id ? 'z-30' : 'z-10'}`} style={{ background: dragTargetProductId === p.id ? 'color-mix(in srgb, var(--color-primary) 8%, var(--color-surface-container-lowest))' : 'var(--color-surface-container-lowest)' }}>
                      <div className="relative flex justify-end">
                        <button
                          type="button"
                          onClick={(e) => toggleActionMenu(p.id, e.currentTarget)}
                          className="flex items-center justify-center rounded p-0.5 hover:bg-black/5"
                          style={{ color: 'var(--color-primary)' }}
                          aria-haspopup="menu"
                          aria-expanded={actionMenuId === p.id}
                          aria-label="Actions"
                        >
                          <span className="material-symbols-outlined text-xl leading-none" aria-hidden="true">
                            {actionMenuId === p.id ? 'arrow_drop_up' : 'arrow_drop_down'}
                          </span>
                        </button>
                        {actionMenuId === p.id && actionMenuPos && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => { setActionMenuId(null); setActionMenuPos(null); }} aria-hidden="true" />
                            <div
                              role="menu"
                              className="fixed z-50 flex min-w-[150px] flex-col overflow-hidden rounded-md border shadow-lg"
                              style={{
                                right: actionMenuPos.right,
                                ...(actionMenuPos.top != null ? { top: actionMenuPos.top } : { bottom: actionMenuPos.bottom }),
                                maxHeight: actionMenuPos.maxHeight,
                                overflowY: 'auto',
                                borderColor: 'var(--color-outline-variant)',
                                background: 'var(--color-surface-container-lowest)',
                                fontFamily: 'var(--font-label)',
                              }}
                            >
                              <Link
                                href={`${locale === 'es' ? '/es' : ''}/shop/${p.id}?returnTo=admin`}
                                onClick={() => setActionMenuId(null)}
                                className={ROW_ACTION_MENU_ITEM_CLASS}
                                style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}
                              >
                                View
                              </Link>
                              <button type="button" onClick={() => { setActionMenuId(null); openEdit(p); }}
                                className={ROW_ACTION_MENU_ITEM_CLASS}
                                style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}>
                                Edit
                              </button>
                              <button type="button" onClick={() => { setActionMenuId(null); duplicateProduct(p); }}
                                className={ROW_ACTION_MENU_ITEM_CLASS}
                                style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}>
                                Duplicate
                              </button>
                              <button type="button" onClick={() => { setActionMenuId(null); openImagePaddingChooser(p); }}
                                className={ROW_ACTION_MENU_ITEM_CLASS}
                                style={{
                                  color: hasAnyProductImagePadding(p.image_padding, p.image_padding_by_image) ? '#0f7a4f' : '#7a4a1f',
                                  fontFamily: 'var(--font-label)',
                                }}>
                                Pad
                              </button>
                              {normalizeProductStatus(p.status) !== 'available' && (
                                <button type="button" onClick={() => { setActionMenuId(null); updateProductStatus(p, 'available'); }}
                                  className={ROW_ACTION_MENU_ITEM_CLASS}
                                  style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}>
                                  Available
                                </button>
                              )}
                              {normalizeProductStatus(p.status) !== 'sold' && (
                                <button type="button" onClick={() => { setActionMenuId(null); updateProductStatus(p, 'sold'); }}
                                  className={ROW_ACTION_MENU_ITEM_CLASS}
                                  style={{ color: 'var(--color-on-surface)', fontFamily: 'var(--font-label)' }}>
                                  Sold
                                </button>
                              )}
                              {normalizeProductStatus(p.status) !== 'archived' && (
                                <button type="button" onClick={() => { setActionMenuId(null); updateProductStatus(p, 'archived'); }}
                                  className={ROW_ACTION_MENU_ITEM_CLASS}
                                  style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}>
                                  Archive
                                </button>
                              )}
                              <button type="button" onClick={() => { setActionMenuId(null); setDeleteTarget(p); }}
                                className={ROW_ACTION_MENU_ITEM_CLASS}
                                style={{ color: 'var(--color-error)', fontFamily: 'var(--font-label)' }}>
                                Delete
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {sortedProducts.length === 0 && (
                  <tr>
                    <td colSpan={PRODUCT_TABLE_COLUMNS.length + 1} className="px-4 py-12 text-center text-sm"
                      style={{ color: 'var(--color-on-surface-variant)' }}>
                      No products found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Edit / Add Modal */}
      {editing && (
        <div
          className="fixed inset-0 z-50 flex md:items-start md:justify-center md:overflow-y-auto md:py-8 md:px-4"
          style={{ background: 'rgba(0,0,0,0.5)' }}
        >
          <div
            className="w-full h-dvh md:h-auto md:max-w-5xl border flex flex-col overflow-hidden product-editor-modal md:rounded-[8px]"
            style={{ background: '#f7f8fc', borderColor: '#d9deef' }}
          >
            {/* Modal header */}
            <div className="flex items-start justify-between px-7 py-5 border-b"
              style={{ borderColor: '#dfe3f0', background: '#fbfbff' }}>
              <div>
                <p className="text-[0.66rem] font-bold uppercase tracking-[0.24em]" style={{ color: '#7a7391', fontFamily: 'var(--font-label)' }}>
                  Dashboard
                </p>
                <h2 className="mt-2 text-3xl font-bold" style={{ fontFamily: 'var(--font-headline)', color: '#111827', letterSpacing: 0 }}>
                  {isNew ? 'New listing' : 'Edit listing'}
                </h2>
              </div>
              <button type="button" onClick={requestCloseEditor}
                className="text-sm font-bold uppercase tracking-wide"
                style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}>
                ✕ Close
              </button>
            </div>

            <div className="product-editor-body p-4 md:p-7 flex flex-col gap-4 md:gap-5 overflow-y-auto flex-1 min-h-0">

              {/* Photos */}
              <div
                className="product-editor-panel product-editor-photos-panel"
                style={{ background: '#edf6ff', borderColor: '#cddff5' }}
                data-collapsed={openEditorSections.photos ? 'false' : 'true'}
              >
                <div className="editor-collapse-header flex items-start gap-3" role="button" tabIndex={0}
                  aria-expanded={openEditorSections.photos}
                  onClick={() => toggleEditorSection('photos')}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleEditorSection('photos'); } }}>
                  <div className="product-editor-icon" style={{ background: '#ffe2ee', color: '#db2777' }}>
                    <span className="material-symbols-outlined" aria-hidden="true">photo_camera</span>
                  </div>
                  <div>
                    <h3 className="product-editor-section-title">Photos</h3>
                    <p className={`product-editor-section-copy${openEditorSections.photos ? '' : ' hidden'}`}>Add clear photos. The first image is the cover image and gives the AI assistant visual context.</p>
                  </div>
                  <span className="ml-auto self-center" aria-hidden="true">
                    <span className="material-symbols-outlined" style={{ color: '#db2777' }}>
                      {openEditorSections.photos ? 'expand_less' : 'expand_more'}
                    </span>
                  </span>
                </div>
                <label
                  className="product-photo-dropzone"
                  style={{
                    borderColor: dragOver ? '#d8b13f' : '#c8d0ec',
                    color: dragOver ? '#8a6d00' : '#1f2937',
                    background: dragOver ? 'rgba(216,177,63,0.08)' : 'rgba(255,255,255,0.72)',
                  }}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragEnter={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    if (e.dataTransfer.files.length) handleImageUpload(e.dataTransfer.files);
                  }}
                >
                  <input type="file" accept="image/*" multiple className="sr-only"
                    onChange={(e) => e.target.files && handleImageUpload(e.target.files)} />
                  <span className="product-photo-dropzone-icon material-symbols-outlined" aria-hidden="true">add_photo_alternate</span>
                  <strong>{uploading ? 'Uploading...' : 'Drag and drop, or click to choose from library'}</strong>
                  <span>{editing.images.length}/20 photos · JPG, PNG, WebP · compressed automatically</span>
                </label>
                <label className="product-photo-take-button">
                  <input type="file" accept="image/*" capture="environment" className="sr-only"
                    onChange={(e) => e.target.files && handleImageUpload(e.target.files)} />
                  <span className="material-symbols-outlined" aria-hidden="true">photo_camera</span>
                  Take photos
                </label>

                {/* Uploaded photo gallery — click to preview & crop, drag to reorder */}
                {editing.images.length > 0 && (
                  <div>
                    <p className="text-[0.62rem] mb-2" style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}>
                      {editing.images.length} {editing.images.length === 1 ? 'photo' : 'photos'} · Click to preview &amp; crop · Drag to reorder · First is the cover
                    </p>
                    <div className="product-photo-gallery">
                      {editing.images.map((img, i) => (
                        <div
                          key={img + i}
                          draggable
                          onDragStart={() => setDragSrcIdx(i)}
                          onDragEnter={(e) => { e.preventDefault(); setDragOverIdx(i); }}
                          onDragOver={(e) => { e.preventDefault(); setDragOverIdx(i); }}
                          onDragLeave={() => setDragOverIdx(null)}
                          onDrop={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (dragSrcIdx === null || dragSrcIdx === i) { setDragSrcIdx(null); setDragOverIdx(null); return; }
                            moveImageToIndex(dragSrcIdx, i);
                            setDragSrcIdx(null);
                            setDragOverIdx(null);
                          }}
                          onDragEnd={() => { setDragSrcIdx(null); setDragOverIdx(null); }}
                          onClick={(e) => {
                            if ((e.target as HTMLElement).closest('button')) return;
                            setPreviewImg({ url: img, index: i });
                          }}
                          className="product-photo-thumb group"
                          style={{
                            opacity: dragSrcIdx === i ? 0.4 : 1,
                            outline: dragOverIdx === i && dragSrcIdx !== i ? '2px solid var(--color-primary)' : undefined,
                            outlineOffset: '2px',
                          }}
                        >
                          {i === 0 && <div className="product-photo-cover-badge">Cover</div>}
                          <Image src={img} alt="" fill sizes="120px" className="object-cover"
                            unoptimized={img.startsWith('/assets/')} />
                          {editing.images.length > 1 && (
                            <div className="product-photo-reorder-controls" aria-label={`Reorder photo ${i + 1}`}>
                              <button
                                type="button"
                                onClick={() => moveImage(i, -1)}
                                className="product-photo-reorder-button"
                                disabled={i === 0}
                                title="Move earlier"
                                aria-label={`Move photo ${i + 1} earlier`}
                              >
                                <span className="material-symbols-outlined" aria-hidden="true">chevron_left</span>
                              </button>
                              <span className="product-photo-order-count">{i + 1}</span>
                              <button
                                type="button"
                                onClick={() => moveImage(i, 1)}
                                className="product-photo-reorder-button"
                                disabled={i === editing.images.length - 1}
                                title="Move later"
                                aria-label={`Move photo ${i + 1} later`}
                              >
                                <span className="material-symbols-outlined" aria-hidden="true">chevron_right</span>
                              </button>
                            </div>
                          )}
                          <div className="product-photo-thumb-overlay">
                            <button
                              type="button"
                              onClick={() => setPreviewImg({ url: img, index: i })}
                              className="product-photo-thumb-action"
                              title="Preview & crop"
                              aria-label="Preview and crop"
                            >
                              <span className="material-symbols-outlined" aria-hidden="true">crop</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => removeImage(i)}
                              className="product-photo-thumb-action is-danger"
                              title="Remove"
                              aria-label="Remove photo"
                            >
                              <span className="material-symbols-outlined" aria-hidden="true">delete</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* AI Listing Assistant */}
              <div
                className="product-editor-panel relative overflow-hidden"
                style={{ background: '#fff1f7', borderColor: '#f5c5d6' }}
                data-collapsed={openEditorSections.ai ? 'false' : 'true'}
              >
                {aiRecording && (
                  <div className="ai-recording-pop" role="status">
                    <span className="ai-recording-orb">
                      <span className="material-symbols-outlined" aria-hidden="true">mic</span>
                    </span>
                    <span className="ai-recording-bars" aria-hidden="true">
                      <span></span><span></span><span></span><span></span>
                    </span>
                    Recording
                  </div>
                )}
                <div className="editor-collapse-header flex flex-wrap items-start justify-between gap-3" role="button" tabIndex={0}
                  aria-expanded={openEditorSections.ai}
                  onClick={() => toggleEditorSection('ai')}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleEditorSection('ai'); } }}>
                  <div className="flex items-start gap-3">
                    <div className="product-editor-icon" style={{ background: '#8b7cf6', color: '#ffffff' }}>
                      <span className="material-symbols-outlined" aria-hidden="true">auto_awesome</span>
                    </div>
                    <div>
                      <h3 className="product-editor-section-title">Smart listing assistant</h3>
                      <p className={`product-editor-section-copy${openEditorSections.ai ? '' : ' hidden'}`}>
                        Add photos, describe the item, and AI fills in the form below automatically. You can undo right after.
                      </p>
                    </div>
                  </div>
                  <span className="self-center" aria-hidden="true">
                    <span className="material-symbols-outlined" style={{ color: '#8b7cf6' }}>
                      {openEditorSections.ai ? 'expand_less' : 'expand_more'}
                    </span>
                  </span>
                </div>

                {editing.images.length === 0 ? (
                  <div
                    className="px-4 py-3 text-sm"
                    style={{
                      border: '1px solid #f4b7aa',
                      background: '#fff8f5',
                      color: '#b42318',
                      borderRadius: '8px',
                    }}
                  >
                    Add at least one photo above to generate a listing.
                  </div>
                ) : !aiTranscript.trim() ? (
                  <div
                    className="px-4 py-3 text-sm"
                    style={{
                      border: '1px solid #e7c98a',
                      background: '#fffaf0',
                      color: '#8a6d1a',
                      borderRadius: '8px',
                    }}
                  >
                    Photo-only results may be less accurate. Please review all fields carefully before saving.
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={() => { if (aiRecording) { stopAiRecording(); } else { setShowMicPrompt(true); } }}
                  className={aiRecording ? 'ai-talk-button ai-talk-button-recording' : 'ai-talk-button'}
                >
                  <span className="material-symbols-outlined" aria-hidden="true">{aiRecording ? 'stop_circle' : 'mic'}</span>
                  {aiRecording ? 'Listening... tap to stop' : "Let's begin - tap here to talk"}
                </button>

                <textarea
                  className="form-field w-full text-sm min-h-[96px]"
                  placeholder="Speak or type: marked 14K, 25.3 grams, Omega watch, light wear, box clasp, 7.5 inch bracelet..."
                  value={[aiTranscript, aiInterimText].filter(Boolean).join(' ')}
                  onChange={(event) => { setAiTranscript(event.target.value); setAiInterimText(''); }}
                />

                <button
                  type="button"
                  onClick={generateAiDraft}
                  disabled={aiGenerating || editing.images.length === 0}
                  className="gold-button text-xs disabled:opacity-50 w-full justify-center"
                >
                  {aiGenerating ? 'Generating...' : 'Generate Listing'}
                </button>

                {aiNotice && (
                  <div
                    className="px-3 py-2 text-xs font-medium"
                    role="status"
                    style={{
                      background: aiNotice.ok ? 'color-mix(in srgb, #166534 10%, transparent)' : 'color-mix(in srgb, var(--color-error) 10%, transparent)',
                      border: `1px solid ${aiNotice.ok ? 'color-mix(in srgb, #166534 30%, transparent)' : 'color-mix(in srgb, var(--color-error) 28%, transparent)'}`,
                      color: aiNotice.ok ? '#166534' : 'var(--color-error)',
                      fontFamily: 'var(--font-label)',
                    }}
                  >
                    {aiNotice.text}
                  </div>
                )}

                {aiDraft && (
                  <div className="grid gap-3 border p-3" style={{ borderColor: 'var(--color-outline-variant)', background: 'rgba(255,255,255,0.62)' }}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <strong className="text-xs uppercase tracking-wide" style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}>
                        AI Filled These Fields
                      </strong>
                    </div>

                    <div className="grid md:grid-cols-2 gap-2">
                      {Object.entries(aiDraft.fields)
                        .filter(([, value]) => value !== null && value !== '')
                        .map(([key, value]) => (
                          <div
                            key={key}
                            className="p-2 border text-xs"
                            style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}
                          >
                            <span className="block font-bold uppercase tracking-wide mb-1" style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}>
                              {AI_PRODUCT_FIELD_LABELS[key as keyof ProductAutofillFields] ?? key}
                            </span>
                            <span style={{ color: 'var(--color-on-surface)' }}>{String(value)}</span>
                            {aiDraft.confidence?.[key as keyof ProductAutofillFields] && (
                              <span className="block mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>
                                Confidence: {aiDraft.confidence[key as keyof ProductAutofillFields]}
                              </span>
                            )}
                          </div>
                        ))}
                    </div>

                    {(aiDraft.warnings.length > 0 || aiDraft.uncertainties.length > 0) && (
                      <div className="text-xs leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>
                        {aiDraft.warnings.length > 0 && <p><strong>Warnings:</strong> {aiDraft.warnings.join(' ')}</p>}
                        {aiDraft.uncertainties.length > 0 && <p><strong>Uncertain:</strong> {aiDraft.uncertainties.join(' ')}</p>}
                      </div>
                    )}

                    <div className="flex flex-wrap justify-end gap-2">
                      {aiUndoSnapshot && (
                        <button type="button" onClick={undoAiFill} className="outline-button text-xs">
                          Undo AI Fill
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Quick Fill — removed from UI. Flip SHOW_QUICK_FILL to restore. */}
              {SHOW_QUICK_FILL && (
              <div
                className="product-editor-panel product-editor-quick-panel"
                style={{
                  background: '#fffaf0',
                  borderColor: '#ead9af',
                }}
              >
                <div className="flex items-start gap-3">
                  <div className="product-editor-icon" style={{ background: '#f7e7bd', color: '#806000' }}>
                    <span className="material-symbols-outlined" aria-hidden="true">keyboard</span>
                  </div>
                  <div>
                    <h3 className="product-editor-section-title">Quick Fill</h3>
                    <p className="product-editor-section-copy">Paste structured field text from the formatting prompt, then apply it to the form.</p>
                  </div>
                </div>
                <div className="flex gap-2 items-start">
                  <textarea
                    className="form-field flex-1 text-sm min-h-[44px]"
                    placeholder="Title English:..., Brand:Omega, Jewelry Type:Watch, Metal Color:Bicolor Gold, Status:Available, Purity:14k, Weight:25.3g"
                    rows={2}
                    value={quickEntry}
                    onChange={(e) => setQuickEntry(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); applyQuickEntry(); } }}
                  />
                  <button
                    type="button"
                    onClick={applyQuickEntry}
                    className="gold-button text-xs flex-shrink-0"
                  >
                    Apply
                  </button>
                </div>
                {quickFillNotice && (
                  <div
                    className="px-3 py-2 text-xs font-medium"
                    role="status"
                    style={{
                      background: quickFillNotice.ok ? 'color-mix(in srgb, #166534 10%, transparent)' : 'color-mix(in srgb, var(--color-error) 10%, transparent)',
                      border: `1px solid ${quickFillNotice.ok ? 'color-mix(in srgb, #166534 30%, transparent)' : 'color-mix(in srgb, var(--color-error) 28%, transparent)'}`,
                      color: quickFillNotice.ok ? '#166534' : 'var(--color-error)',
                      fontFamily: 'var(--font-label)',
                    }}
                  >
                    {quickFillNotice.text}
                  </div>
                )}
                <div
                  className="text-[0.62rem] leading-relaxed p-3"
                  style={{
                    color: 'var(--color-on-surface-variant)',
                    fontFamily: 'var(--font-label)',
                    background: 'color-mix(in srgb, var(--color-surface) 70%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--color-outline-variant) 75%, transparent)',
                  }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="font-bold uppercase tracking-wide" style={{ color: 'var(--color-primary)' }}>
                      Prompt for AI formatting
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={copyQuickFillPrompt}
                        className="outline-button text-[0.58rem] px-2 py-1"
                      >
                        Copy Prompt
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowQuickFillPrompt(true)}
                        className="outline-button text-[0.58rem] px-2 py-1"
                      >
                        View AI Prompt
                      </button>
                    </div>
                  </div>
                </div>
                <p className="text-[0.6rem] leading-relaxed hidden" style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}>
                  Paste comma values, Field:Value pairs, or a two-line CSV header/value list. Labeled fields can be in any order; unlabeled CSV rows use the form order. Only include what differs from the defaults.
                  Recognized tokens: <strong>Category</strong> (Gold / Silver) · <strong>Status</strong> (Draft / Available / Pending Payment / Sold / Archived) ·&nbsp;
                  <strong>Jewelry Type</strong> (Necklace / Bracelet / Ring / Pendant / Earrings / Watch) ·&nbsp;
                  <strong>Link Type</strong> (Cuban link / Figaro link / Rope chain / etc.) ·&nbsp;
                  <strong>Length/Size</strong> (22in / 7.5in / ring size 7) ·&nbsp;
                  <strong>Price Mode</strong> (Spot / Manual) ·&nbsp;
                  <strong>Purity</strong> (18k / 14k / 10k / 925) ·&nbsp;
                  <strong>Weight</strong> (25.3g) ·&nbsp;
                  <strong>Multiplier</strong> (1.25x). Field labels can also target Title English, Title Spanish, Location, Price Label, Description English, Description Spanish, Notes (EN), and Notes (ES).
                </p>
              </div>
              )}

              {/* AI Listing Assistant */}
              <div
                className="hidden"
                style={{
                  background: '#fff1f7',
                  borderColor: '#f5c5d6',
                }}
              >
                {aiRecording && (
                  <div className="ai-recording-pop" role="status">
                    <span className="ai-recording-orb">
                      <span className="material-symbols-outlined" aria-hidden="true">mic</span>
                    </span>
                    <span className="ai-recording-bars" aria-hidden="true">
                      <span></span><span></span><span></span><span></span>
                    </span>
                    Recording
                  </div>
                )}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="product-editor-icon" style={{ background: '#8b7cf6', color: '#ffffff' }}>
                      <span className="material-symbols-outlined" aria-hidden="true">auto_awesome</span>
                    </div>
                    <div>
                      <h3 className="product-editor-section-title">Smart listing assistant</h3>
                      <p className={`product-editor-section-copy${openEditorSections.ai ? '' : ' hidden'}`}>
                        Add photos, describe the item, and AI fills in the form below automatically. You can undo right after.
                      </p>
                    </div>
                  </div>
                </div>

                {editing.images.length === 0 ? (
                  <div
                    className="px-4 py-3 text-sm"
                    style={{
                      border: '1px solid #f4b7aa',
                      background: '#fff8f5',
                      color: '#b42318',
                      borderRadius: '8px',
                    }}
                  >
                    Add at least one photo above to generate a listing.
                  </div>
                ) : !aiTranscript.trim() ? (
                  <div
                    className="px-4 py-3 text-sm"
                    style={{
                      border: '1px solid #e7c98a',
                      background: '#fffaf0',
                      color: '#8a6d1a',
                      borderRadius: '8px',
                    }}
                  >
                    Photo-only results may be less accurate. Please review all fields carefully before saving.
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={() => { if (aiRecording) { stopAiRecording(); } else { setShowMicPrompt(true); } }}
                  className={aiRecording ? 'ai-talk-button ai-talk-button-recording' : 'ai-talk-button'}
                >
                  <span className="material-symbols-outlined" aria-hidden="true">{aiRecording ? 'stop_circle' : 'mic'}</span>
                  {aiRecording ? 'Listening... tap to stop' : "Let's begin - tap here to talk"}
                </button>

                <textarea
                  className="form-field w-full text-sm min-h-[96px]"
                  placeholder="Speak or type: marked 14K, 25.3 grams, Omega watch, light wear, box clasp, 7.5 inch bracelet..."
                  value={[aiTranscript, aiInterimText].filter(Boolean).join(' ')}
                  onChange={(event) => { setAiTranscript(event.target.value); setAiInterimText(''); }}
                />

                <button
                  type="button"
                  onClick={generateAiDraft}
                  disabled={aiGenerating || editing.images.length === 0}
                  className="gold-button text-xs disabled:opacity-50 w-full justify-center"
                >
                  {aiGenerating ? 'Generating...' : 'Generate Listing'}
                </button>

                {aiNotice && (
                  <div
                    className="px-3 py-2 text-xs font-medium"
                    role="status"
                    style={{
                      background: aiNotice.ok ? 'color-mix(in srgb, #166534 10%, transparent)' : 'color-mix(in srgb, var(--color-error) 10%, transparent)',
                      border: `1px solid ${aiNotice.ok ? 'color-mix(in srgb, #166534 30%, transparent)' : 'color-mix(in srgb, var(--color-error) 28%, transparent)'}`,
                      color: aiNotice.ok ? '#166534' : 'var(--color-error)',
                      fontFamily: 'var(--font-label)',
                    }}
                  >
                    {aiNotice.text}
                  </div>
                )}

                {aiDraft && (
                  <div className="grid gap-3 border p-3" style={{ borderColor: 'var(--color-outline-variant)', background: 'rgba(255,255,255,0.62)' }}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <strong className="text-xs uppercase tracking-wide" style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}>
                        AI Filled These Fields
                      </strong>
                    </div>

                    <div className="grid md:grid-cols-2 gap-2">
                      {Object.entries(aiDraft.fields)
                        .filter(([, value]) => value !== null && value !== '')
                        .map(([key, value]) => (
                          <div
                            key={key}
                            className="p-2 border text-xs"
                            style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}
                          >
                            <span className="block font-bold uppercase tracking-wide mb-1" style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}>
                              {AI_PRODUCT_FIELD_LABELS[key as keyof ProductAutofillFields] ?? key}
                            </span>
                            <span style={{ color: 'var(--color-on-surface)' }}>{String(value)}</span>
                            {aiDraft.confidence?.[key as keyof ProductAutofillFields] && (
                              <span className="block mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>
                                Confidence: {aiDraft.confidence[key as keyof ProductAutofillFields]}
                              </span>
                            )}
                          </div>
                        ))}
                    </div>

                    {(aiDraft.warnings.length > 0 || aiDraft.uncertainties.length > 0) && (
                      <div className="text-xs leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>
                        {aiDraft.warnings.length > 0 && <p><strong>Warnings:</strong> {aiDraft.warnings.join(' ')}</p>}
                        {aiDraft.uncertainties.length > 0 && <p><strong>Uncertain:</strong> {aiDraft.uncertainties.join(' ')}</p>}
                      </div>
                    )}

                    <div className="flex flex-wrap justify-end gap-2">
                      {aiUndoSnapshot && (
                        <button type="button" onClick={undoAiFill} className="outline-button text-xs">
                          Undo AI Fill
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Listing details — modern card matching the panels above */}
              <div className="product-editor-panel product-editor-fields-panel" data-collapsed={openEditorSections.details ? 'false' : 'true'}>
                <div className="editor-collapse-header flex items-start gap-3" role="button" tabIndex={0}
                  aria-expanded={openEditorSections.details}
                  onClick={() => toggleEditorSection('details')}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleEditorSection('details'); } }}>
                  <div className="product-editor-icon" style={{ background: 'rgba(212, 175, 55, 0.18)', color: '#a9760a' }}>
                    <span className="material-symbols-outlined" aria-hidden="true">edit_note</span>
                  </div>
                  <div>
                    <h3 className="product-editor-section-title">Listing details</h3>
                    <p className={`product-editor-section-copy${openEditorSections.details ? '' : ' hidden'}`}>Review and fine-tune everything before saving.</p>
                  </div>
                  <span className="ml-auto self-center" aria-hidden="true">
                    <span className="material-symbols-outlined" style={{ color: '#a9760a' }}>
                      {openEditorSections.details ? 'expand_less' : 'expand_more'}
                    </span>
                  </span>
                </div>

              <div className="grid md:grid-cols-[minmax(0,1fr)_auto] gap-4 items-start">
                <div>
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <label className="form-label mb-0">Inventory #</label>
                    <label className="flex items-center gap-1.5 text-[0.68rem] font-bold uppercase tracking-wide" style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}>
                      <input
                        type="checkbox"
                        checked={inventoryNumberManual}
                        onChange={(e) => setManualInventoryNumber(e.target.checked)}
                        style={{ accentColor: 'var(--color-primary)' }}
                      />
                      Manual
                    </label>
                  </div>
                  <ClearableField
                    onClear={() => setEditing({ ...editing, inventory_number: null })}
                    show={inventoryNumberManual && !!editing.inventory_number}
                    disabled={!inventoryNumberManual}
                  >
                    <input
                      type="number"
                      min="1"
                      step="1"
                      inputMode="numeric"
                      className="form-field w-full"
                      disabled={!inventoryNumberManual}
                      value={editing.inventory_number ?? ''}
                      onChange={(e) => setEditing({ ...editing, inventory_number: parseInventoryNumber(e.target.value) })}
                      style={!inventoryNumberManual ? { background: 'var(--color-surface-container-low)', color: 'var(--color-on-surface-variant)' } : undefined}
                    />
                  </ClearableField>
                  {!inventoryNumberManual && (
                    <p className="mt-1 text-[0.68rem]" style={{ color: 'var(--color-on-surface-variant)' }}>
                      Auto-filled with the next available inventory number.
                    </p>
                  )}
                  {(() => {
                    const inventoryNumber = parseInventoryNumber(editing.inventory_number);
                    const duplicateOwner = getInventoryNumberOwner(products, inventoryNumber, isNew ? undefined : editing.id);
                    if (!inventoryNumber || !duplicateOwner) return null;
                    return (
                      <p className="mt-1 text-[0.68rem] font-semibold" style={{ color: 'var(--color-error)' }}>
                        {getDuplicateInventoryNumberMessage(duplicateOwner, inventoryNumber)}
                      </p>
                    );
                  })()}
                </div>
                <button
                  type="button"
                  onClick={() => setShowAdvancedIds((current) => !current)}
                  className="outline-button text-xs h-10 md:mt-[1.55rem]"
                >
                  {showAdvancedIds ? 'Hide' : (isNew ? 'SKU / Slug' : 'SKU / Slug / ID')}
                </button>
              </div>

              {showAdvancedIds && (
                <div
                  className="grid md:grid-cols-2 gap-4 p-4 border"
                  style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}
                >
                  {!isNew && (
                    <div className="md:col-span-2">
                      <label className="form-label">ID (slug, auto-generated if blank)</label>
                      <ClearableField onClear={() => setEditing({ ...editing, id: '' })} show={!!editing.id}>
                        <input className="form-field w-full" placeholder="my-product-slug"
                          value={editing.id}
                          onChange={(e) => setEditing({ ...editing, id: e.target.value })} />
                      </ClearableField>
                    </div>
                  )}
                  <div>
                    <label className="form-label">SKU</label>
                    <ClearableField onClear={() => setEditing({ ...editing, sku: '' })} show={!!editing.sku}>
                      <input className="form-field w-full" value={editing.sku ?? ''}
                        onChange={(e) => setEditing({ ...editing, sku: e.target.value })} />
                    </ClearableField>
                  </div>
                  <div>
                    <label className="form-label">Public Slug</label>
                    <ClearableField onClear={() => setEditing({ ...editing, slug: '' })} show={!!editing.slug}>
                      <input className="form-field w-full" value={editing.slug ?? ''}
                        onChange={(e) => setEditing({ ...editing, slug: e.target.value })} />
                    </ClearableField>
                  </div>
                </div>
              )}

              {/* Title */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Title (English)</label>
                  <ClearableField onClear={() => setEditing({ ...editing, title: '' })} show={!!editing.title} multiline>
                    <textarea rows={2} className="form-field w-full resize-y" value={editing.title}
                      onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
                  </ClearableField>
                </div>
                <div>
                  <label className="form-label">Title (Spanish)</label>
                  <ClearableField onClear={() => setEditing({ ...editing, title_es: '' })} show={!!editing.title_es}>
                    <input className="form-field w-full" value={editing.title_es ?? ''}
                      onChange={(e) => setEditing({ ...editing, title_es: e.target.value })} />
                  </ClearableField>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="form-label">Product Type</label>
                  <ClearableField
                    onClear={() => {
                      setJewelryTypeInput('Other');
                      setEditing({ ...editing, product_type: 'Other', jewelry_type: 'Other' });
                      setChainTypeInput('');
                      setLengthInput('');
                    }}
                    show={jewelryTypeInput !== 'Other'}
                  >
                    <ComboboxInput
                      value={jewelryTypeInput}
                      onChange={(value) => {
                        const nextProductType = normalizeProductTypeValue(value) ?? 'Other';
                        setJewelryTypeInput(nextProductType);
                        setEditing({ ...editing, product_type: nextProductType, jewelry_type: nextProductType });
                        if (!productSupportsLinkType(nextProductType)) setChainTypeInput('');
                        if (!productUsesLength(nextProductType) && !productUsesSize(nextProductType) && !productUsesHeight(nextProductType)) setLengthInput('');
                      }}
                      options={productTypeOptions}
                      placeholder="e.g. Necklace, Cufflinks, Tie Clip..."
                    />
                  </ClearableField>
                </div>
                <div>
                  <label className="form-label">Date (Year Made)</label>
                  <ClearableField onClear={() => setEditing({ ...editing, item_year: null })} show={editing.item_year != null}>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={2200}
                      step={1}
                      placeholder="e.g. 1930"
                      className="form-field w-full"
                      value={editing.item_year ?? ''}
                      onChange={(e) => setEditing({ ...editing, item_year: normalizeProductItemYear(e.target.value) })}
                    />
                  </ClearableField>
                </div>
                <div>
                  <label className="form-label">Brand</label>
                  <ClearableField onClear={() => setEditing({ ...editing, brand: '' })} show={!!editing.brand}>
                    <input
                      type="text"
                      className="form-field w-full"
                      value={editing.brand ?? ''}
                      onChange={(e) => setEditing({ ...editing, brand: e.target.value })}
                      placeholder="e.g. David Yurman, Tiffany & Co., Cartier..."
                    />
                  </ClearableField>
                </div>
              </div>

              {/* Metal hierarchy */}
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="form-label">Metal Type</label>
                  <ClearableField
                    onClear={() => setEditing({
                      ...editing,
                      metal_type: '',
                      metal: '',
                      metal_variant: '',
                      purity: null,
                    })}
                    show={!!editing.metal_type}
                  >
                    <select className="form-field w-full" value={editing.metal_type ? normalizeProductMetalType(editing.metal_type, editing.category) : ''}
                      onChange={(e) => {
                        if (!e.target.value) {
                          setEditing({ ...editing, metal_type: '', metal: '', metal_variant: '', purity: null });
                          return;
                        }
                        const nextMetalType = normalizeProductMetalType(e.target.value, editing.category);
                        const nextCategory = getLegacyCategoryForMetalType(nextMetalType, editing.category);
                        setEditing({
                          ...editing,
                          metal_type: nextMetalType,
                          metal: nextMetalType,
                          category: nextCategory,
                          metal_variant: getDefaultMetalVariant(nextCategory),
                          purity: null,
                        });
                      }}>
                      <option value="">— Select —</option>
                      {PRODUCT_METAL_TYPES.map((metalType) => (
                        <option key={metalType.value} value={metalType.value}>{metalType.label}</option>
                      ))}
                    </select>
                  </ClearableField>
                </div>
                <div>
                  <label className="form-label">Metal Color</label>
                  <ClearableField
                    onClear={() => setEditing({ ...editing, metal_variant: '' })}
                    show={!!editing.metal_variant}
                  >
                    <select
                      className="form-field w-full"
                      value={editing.metal_variant ? normalizeProductMetalVariant(editing.metal_variant, getLegacyCategoryForMetalType(editing.metal_type, editing.category)) : ''}
                      onChange={(e) => setEditing({ ...editing, metal_variant: e.target.value })}
                    >
                      <option value="">— Select —</option>
                      {PRODUCT_METAL_VARIANTS[getLegacyCategoryForMetalType(editing.metal_type, editing.category)].map((variant) => (
                        <option key={variant.value} value={variant.value}>{variant.label}</option>
                      ))}
                    </select>
                  </ClearableField>
                </div>
              </div>

              {/* Conditional product detail fields */}
              <div className="grid md:grid-cols-2 gap-4">
                {(() => {
                  const canUseLinkType = productSupportsLinkType(jewelryTypeInput);
                  return canUseLinkType ? (
                    <div>
                      <label className="form-label">Link Type</label>
                      <ComboboxInput
                        value={chainTypeInput}
                        onChange={setChainTypeInput}
                        options={[...PRODUCT_LINK_TYPES]}
                        placeholder="e.g. Cuban link, Rope chain..."
                      />
                    </div>
                  ) : null;
                })()}
                {(() => {
                  const lengthSizeLabel = getLengthSizeLabel(jewelryTypeInput);
                  const usesHeight = productUsesHeight(jewelryTypeInput);
                  const canUseLengthOrSize = productUsesLength(jewelryTypeInput) || productUsesSize(jewelryTypeInput) || usesHeight;
                  if (!canUseLengthOrSize) return null;
                  const placeholder = usesHeight
                    ? 'height in inches, e.g. 1.5, 0.75...'
                    : lengthSizeLabel === 'Size'
                      ? 'e.g. 6.5, 7, 8...'
                      : 'e.g. 22, 24, 7.5...';
                  return (
                    <div>
                      <label className="form-label">{lengthSizeLabel}</label>
                      <ComboboxInput
                        value={lengthInput}
                        onChange={(value) => setLengthInput(normalizeProductLengthSizeValue(value))}
                        options={usesHeight ? [] : PREDEFINED_LENGTHS}
                        placeholder={placeholder}
                      />
                    </div>
                  );
                })()}
              </div>

              {isNew && (
                <label className="inline-flex w-fit items-center gap-2 text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}>
                  <input
                    type="checkbox"
                    checked={quickAddMode}
                    onChange={(event) => {
                      const checked = event.target.checked;
                      setQuickAddMode(checked);
                      if (checked) {
                        setEditing({
                          ...editing,
                          price_mode: 'manual',
                          pricing_multiplier: null,
                          asking_price: null,
                        });
                      }
                    }}
                  />
                  Quick add
                </label>
              )}

              {/* Pricing — Mode · Purity · Weight · Multiplier/Price Label (2-up on mobile, 4-up on desktop) */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="form-label">Price Mode</label>
                  <ClearableField
                    onClear={() => setEditing({ ...editing, price_mode: 'spot-multiplier', manual_price_label: null, asking_price: null })}
                    show={editing.price_mode !== 'spot-multiplier'}
                  >
                    <select className="form-field w-full" value={editing.price_mode}
                      onChange={(e) => {
                        const nextMode = e.target.value as 'spot-multiplier' | 'manual';
                        setQuickAddMode(false);
                        setEditing({
                          ...editing,
                          price_mode: nextMode,
                          ...(nextMode === 'spot-multiplier' ? { manual_price_label: null, asking_price: null } : {}),
                        });
                      }}>
                      {PRICE_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                  </ClearableField>
                </div>
                <div>
                  <label className="form-label">{getLegacyCategoryForMetalType(editing.metal_type, editing.category) === 'Silver' ? 'Purity (/1000)' : 'Purity (k)'}</label>
                  {getLegacyCategoryForMetalType(editing.metal_type, editing.category) === 'Silver' ? (
                    <ClearableField onClear={() => setEditing({ ...editing, purity: null })} show={!!editing.purity}>
                    <input
                      type="number"
                      list="silver-purity-presets"
                      min={100}
                      max={1000}
                      step={1}
                      className="form-field w-full"
                      placeholder="925 sterling · 900 · 800 (parts per 1000)"
                      value={editing.purity ?? ''}
                      onChange={(e) => setEditing({ ...editing, purity: e.target.value ? Number(e.target.value) : null })}
                    />
                    <datalist id="silver-purity-presets">
                      <option value="999">99.9% fine</option>
                      <option value="958">95.8% Britannia</option>
                      <option value="950">95%</option>
                      <option value="925">92.5% Sterling</option>
                      <option value="900">90% Coin</option>
                      <option value="850">85%</option>
                      <option value="835">83.5%</option>
                      <option value="830">83%</option>
                      <option value="800">80%</option>
                    </datalist>
                    </ClearableField>
                  ) : (
                    <ClearableField onClear={() => setEditing({ ...editing, purity: null })} show={!!editing.purity}>
                    <input type="number" className="form-field w-full" placeholder="18"
                      value={editing.purity ?? ''}
                      onChange={(e) => setEditing({ ...editing, purity: e.target.value ? Number(e.target.value) : null })} />
                    </ClearableField>
                  )}
                </div>
                <div>
                  <label className="form-label">Weight (g)</label>
                  <ClearableField onClear={() => setEditing({ ...editing, weight_grams: null })} show={!!editing.weight_grams}>
                  <input type="number" step="0.01" className="form-field w-full"
                    value={editing.weight_grams ?? ''}
                    onChange={(e) => setEditing({ ...editing, weight_grams: e.target.value ? Number(e.target.value) : null })} />
                  </ClearableField>
                </div>
                <div>
                  {editing.price_mode === 'spot-multiplier' ? (
                    <>
                      <label className="form-label">Multiplier</label>
                      <ClearableField onClear={() => setEditing({ ...editing, pricing_multiplier: null })} show={!!editing.pricing_multiplier}>
                      <input type="number" step="0.01" className="form-field w-full" placeholder="e.g. 1.25"
                        value={editing.pricing_multiplier ?? ''}
                        onChange={(e) => setEditing({ ...editing, pricing_multiplier: e.target.value ? Number(e.target.value) : null })} />
                      </ClearableField>
                    </>
                  ) : (
                    <>
                      <label className="form-label">Price Label</label>
                      <ClearableField onClear={() => setEditing({ ...editing, asking_price: null, manual_price_label: '' })} show={!!editing.manual_price_label}>
                      <input className="form-field w-full" placeholder="$1,200"
                        value={editing.manual_price_label ?? ''}
                        onChange={(e) => {
                          const nextValue = e.target.value;
                          setEditing((current) => current ? ({
                            ...current,
                            asking_price: null,
                            price_mode: 'manual',
                            manual_price_label: normalizeManualPriceLabel(nextValue),
                          }) : current);
                        }}
                        onBlur={(e) => {
                          const normalized = normalizeManualPriceLabel(e.currentTarget.value);
                          setEditing((current) => current ? ({
                            ...current,
                            asking_price: null,
                            price_mode: 'manual',
                            manual_price_label: normalized,
                          }) : current);
                        }} />
                      </ClearableField>
                    </>
                  )}
                </div>
              </div>

              <div className="grid md:grid-cols-4 gap-4">
                <div>
                  <label className="form-label">Location</label>
                  <ClearableField onClear={() => setEditing({ ...editing, location: 'showcase' })} show={(editing.location ?? 'showcase') !== 'showcase'}>
                  <select className="form-field w-full" value={editing.location ?? 'showcase'}
                    onChange={(e) => setEditing({ ...editing, location: e.target.value })}>
                    {LOCATIONS.map((location) => <option key={location.value} value={location.value}>{location.label}</option>)}
                  </select>
                  </ClearableField>
                </div>
                <div>
                  <label className="form-label">Status</label>
                  <ClearableField onClear={() => setEditing({ ...editing, status: 'available' })} show={normalizeProductStatus(editing.status) !== 'available'}>
                  <select className="form-field w-full" value={editing.status}
                    onChange={(e) => setEditing({ ...editing, status: e.target.value as ProductStatus })}>
                    {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                  </ClearableField>
                </div>
                {productUsesGender(jewelryTypeInput) && (
                  <div>
                    <label className="form-label">Gender</label>
                    <ClearableField onClear={() => setEditing({ ...editing, gender: '' })} show={!!editing.gender}>
                    <select className="form-field w-full" value={editing.gender ?? ''}
                      onChange={(e) => setEditing({ ...editing, gender: e.target.value })}>
                      <option value="">— Select —</option>
                      <option value="Unisex">Unisex</option>
                      <option value="Men">Men</option>
                      <option value="Women">Women</option>
                    </select>
                    </ClearableField>
                  </div>
                )}
                <label className="flex items-end gap-2 text-sm pb-2" style={{ color: 'var(--color-on-surface-variant)' }}>
                  <input
                    type="checkbox"
                    checked={editing.featured === true}
                    onChange={(e) => setEditing({ ...editing, featured: e.target.checked })}
                    style={{ accentColor: 'var(--color-primary)' }}
                  />
                  Featured in shop
                </label>
              </div>

              {/* Description */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Description (EN)</label>
                  <ClearableField onClear={() => setEditing({ ...editing, description: '' })} show={!!editing.description} multiline>
                  <textarea rows={4} className="form-field w-full resize-y"
                    value={editing.description ?? ''}
                    onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
                  </ClearableField>
                </div>
                <div>
                  <label className="form-label">Description (ES)</label>
                  <ClearableField onClear={() => setEditing({ ...editing, description_es: '' })} show={!!editing.description_es} multiline>
                  <textarea rows={4} className="form-field w-full resize-y"
                    value={editing.description_es ?? ''}
                    onChange={(e) => setEditing({ ...editing, description_es: e.target.value })} />
                  </ClearableField>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Notes (EN)</label>
                  <ClearableField onClear={() => setEditing({ ...editing, public_notes: '' })} show={!!editing.public_notes} multiline>
                  <textarea rows={3} className="form-field w-full resize-y"
                    value={editing.public_notes ?? ''}
                    onChange={(e) => setEditing({ ...editing, public_notes: e.target.value })} />
                  </ClearableField>
                </div>
                <div>
                  <label className="form-label">Notes (ES)</label>
                  <ClearableField onClear={() => setEditing({ ...editing, public_notes_es: '' })} show={!!editing.public_notes_es} multiline>
                  <textarea rows={3} className="form-field w-full resize-y"
                    value={editing.public_notes_es ?? ''}
                    onChange={(e) => setEditing({ ...editing, public_notes_es: e.target.value })} />
                  </ClearableField>
                </div>
              </div>
              </div>

            </div>

            {/* Validation errors */}
            {formErrors.length > 0 && (
              <div
                className="px-6 py-3 border-t text-xs flex flex-col gap-1"
                style={{
                  borderColor: 'var(--color-outline-variant)',
                  background: 'color-mix(in srgb, var(--color-error) 8%, transparent)',
                  color: 'var(--color-error)',
                  fontFamily: 'var(--font-label)',
                }}
              >
                {formErrors.map((e, i) => <span key={i}>· {e}</span>)}
              </div>
            )}

            {/* Modal footer — 2-up grid on mobile (so nothing overflows), single row on desktop */}
            <div className="grid grid-cols-2 gap-2 px-3 py-4 border-t [&>button]:w-full md:flex md:items-center md:gap-1.5 md:[&>button]:w-auto"
              style={{ borderColor: 'var(--color-outline-variant)', paddingBottom: 'max(1rem, calc(1rem + env(safe-area-inset-bottom, 0px)))' }}>
              {/* Clone — edit mode only, pushed to the left */}
              {!isNew && (
                <button
                  type="button"
                  onClick={() => {
                    if (!editing) return;
                    const clone = {
                      ...editing,
                      id: '',
                      inventory_number: getNextInventoryNumber(products),
                      sku: null,
                      slug: null,
                      title: `${editing.title} (Copy)`,
                      title_es: editing.title_es ? `${editing.title_es} (Copia)` : null,
                      status: 'draft' as ProductStatus,
                      sort_order: products.length > 0
                        ? Math.max(...products.map(p => p.sort_order ?? 0)) + 1
                        : 1,
                    };
                    originalRef.current = null;
                    setFormErrors([]);
                    setQuickEntry('');
                    setQuickAddMode(false);
                    setInventoryNumberManual(false);
                    setLengthInput(getProductLength(editing as Product));
                    setEditing(clone);
                    setIsNew(true);
                    resetUndoHistory();
                  }}
                  className="outline-button text-sm"
                >
                  Clone
                </button>
              )}
              <button
                type="button"
                onClick={undoEdit}
                disabled={!canUndoEdit || saving}
                className="outline-button text-sm disabled:opacity-40 flex items-center justify-center gap-1.5"
                title="Undo the last change"
              >
                <span className="material-symbols-outlined text-base leading-none" aria-hidden="true">undo</span>
                Undo
              </button>
              <button type="button" onClick={requestCloseEditor} className="outline-button text-sm">
                Cancel
              </button>
              <button type="button" onClick={() => requestSaveEditor('stay')} disabled={saving} className="outline-button text-sm disabled:opacity-50">
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button type="button" onClick={() => requestSaveEditor('another')} disabled={saving} className="outline-button text-sm disabled:opacity-50">
                Save + Add Another
              </button>
              <button type="button" onClick={() => requestSaveEditor('close')} disabled={saving} className="gold-button gold-button-gradient text-sm disabled:opacity-50">
                {saving ? 'Saving…' : 'Save and Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Fill AI prompt viewer — archived with the Quick Fill section. */}
      {SHOW_QUICK_FILL && showQuickFillPrompt && (
        <div
          className="fixed inset-0 z-[65] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.58)' }}
          onClick={() => setShowQuickFillPrompt(false)}
        >
          <div
            className="w-full max-w-3xl max-h-[82vh] border p-5 flex flex-col gap-4"
            style={{ background: 'var(--color-background)', borderColor: 'var(--color-outline-variant)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-bold" style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}>
                AI Formatting Prompt
              </h2>
              <button
                type="button"
                onClick={() => setShowQuickFillPrompt(false)}
                className="text-sm font-bold uppercase tracking-wide"
                style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}
              >
                Close
              </button>
            </div>
            <textarea
              ref={quickFillPromptTextRef}
              readOnly
              value={quickFillPrompt}
              className="form-field w-full min-h-[52vh] whitespace-pre-wrap overflow-auto p-4 text-xs leading-relaxed"
              style={{
                color: 'var(--color-on-surface-variant)',
                fontFamily: 'var(--font-body)',
                background: 'var(--color-surface-container-lowest)',
                border: '1px solid var(--color-outline-variant)',
              }}
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={copyQuickFillPrompt} className="outline-button text-sm">
                Copy Prompt
              </button>
              <button type="button" onClick={() => setShowQuickFillPrompt(false)} className="gold-button text-sm">
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image preview lightbox */}
      {previewImg && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.85)' }}
          onClick={() => setPreviewImg(null)}
        >
          <div className="relative max-w-3xl w-full max-h-[85vh] flex flex-col items-center justify-center gap-3" onClick={(e) => e.stopPropagation()}>
            <div className="relative h-[78vh] max-h-[78vh] w-full">
              <Image
                src={previewImg.url}
                alt="Preview"
                fill
                sizes="(max-width: 768px) 92vw, 768px"
                className="object-contain"
                style={{ filter: 'drop-shadow(0 8px 40px rgba(0,0,0,0.6))' }}
                unoptimized
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setCropRect(FULL_IMAGE_CROP);
                  setCropTarget(previewImg);
                }}
                className="gold-button text-xs"
              >
                Crop
              </button>
              <button type="button" onClick={() => setPreviewImg(null)} className="outline-button text-xs">
                Close
              </button>
            </div>
            <button
              type="button"
              onClick={() => setPreviewImg(null)}
              className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center text-white font-bold text-sm"
              style={{ background: 'rgba(0,0,0,0.6)' }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Image crop editor */}
      {cropTarget && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.88)' }}
          onClick={() => setCropTarget(null)}
        >
          <div
            className="w-full max-w-4xl border p-4 flex flex-col gap-4"
            style={{ background: 'var(--color-background)', borderColor: 'var(--color-outline-variant)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-bold" style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}>
                Crop Photo
              </h2>
              <button
                type="button"
                onClick={() => setCropTarget(null)}
                className="text-sm font-bold uppercase tracking-wide"
                style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}
              >
                × Close
              </button>
            </div>

            <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
              Drag inside the crop box to move it. Drag an edge or corner to resize it.
            </p>

            <div className="flex justify-center overflow-auto max-h-[62vh]">
              <div className="relative inline-block select-none touch-none" data-crop-area="true">
                <Image
                  src={cropTarget.url}
                  alt="Crop preview"
                  width={1200}
                  height={900}
                  className="block max-h-[60vh] w-auto max-w-full object-contain"
                  draggable={false}
                  unoptimized
                />
                <div
                  className="absolute touch-none"
                  data-crop-box="true"
                  style={{
                    left: `${cropRect.x}%`,
                    top: `${cropRect.y}%`,
                    width: `${cropRect.width}%`,
                    height: `${cropRect.height}%`,
                    border: '2px solid var(--color-primary)',
                    boxShadow: '0 0 0 1px rgba(255,255,255,0.7)',
                    cursor: 'move',
                  }}
                  onPointerDown={(e) => startCropDrag(e, 'move')}
                >
                  {([
                    ['n', 'top-0 left-3 right-3 h-3 -translate-y-1/2 cursor-ns-resize'],
                    ['s', 'bottom-0 left-3 right-3 h-3 translate-y-1/2 cursor-ns-resize'],
                    ['w', 'left-0 top-3 bottom-3 w-3 -translate-x-1/2 cursor-ew-resize'],
                    ['e', 'right-0 top-3 bottom-3 w-3 translate-x-1/2 cursor-ew-resize'],
                    ['nw', 'left-0 top-0 w-4 h-4 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize'],
                    ['ne', 'right-0 top-0 w-4 h-4 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize'],
                    ['sw', 'left-0 bottom-0 w-4 h-4 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize'],
                    ['se', 'right-0 bottom-0 w-4 h-4 translate-x-1/2 translate-y-1/2 cursor-nwse-resize'],
                  ] as [CropDragMode, string][]).map(([mode, className]) => (
                    <div
                      key={mode}
                      className={`absolute ${className}`}
                      onPointerDown={(e) => startCropDrag(e, mode)}
                    />
                  ))}
                </div>
             </div>
            </div>

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setCropTarget(null)} className="outline-button text-sm">
                Cancel
              </button>
              <button type="button" onClick={saveCroppedImage} disabled={cropping} className="gold-button text-sm disabled:opacity-50">
                {cropping ? 'Saving Crop…' : 'Save Crop'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image padding chooser */}
      {imagePaddingTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setImagePaddingTarget(null)}
        >
          <div
            className="w-full max-w-2xl border p-5 flex flex-col gap-4"
            style={{ background: 'var(--color-background)', borderColor: 'var(--color-outline-variant)' }}
            onClick={(event) => event.stopPropagation()}
          >
            <div>
              <h2 className="text-lg font-bold" style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}>
                Image Padding
              </h2>
              <p className="mt-1 text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
                Choose the frame color behind each contained product photo.
              </p>
            </div>
            {(() => {
              const images = getProductImages(imagePaddingTarget);
              const selectedImage = images[imagePaddingTargetIndex] ?? null;
              const currentPaddingValue = productImagePaddingForImage(
                imagePaddingTarget.image_padding,
                imagePaddingTarget.image_padding_by_image,
                selectedImage,
                imagePaddingTargetIndex,
              );
              const customActive = isProductImagePaddingCustomColor(currentPaddingValue);
              const validCustomColor = isProductImagePaddingCustomColor(imagePaddingCustomColor) ? imagePaddingCustomColor : '#ffffff';
              return (
                <>
                  {images.length > 1 && (
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                      {images.map((image, index) => {
                        const imagePadding = productImagePaddingForImage(
                          imagePaddingTarget.image_padding,
                          imagePaddingTarget.image_padding_by_image,
                          image,
                          index,
                        );
                        const active = index === imagePaddingTargetIndex;

                        return (
                          <button
                            key={`${image}-${index}`}
                            type="button"
                            onClick={() => {
                              imagePaddingTargetIndexRef.current = index;
                              setImagePaddingTargetIndex(index);
                              const nextColor = productImagePaddingBackground(imagePadding) === '#000000' ? '#000000' : '#ffffff';
                              setImagePaddingCustomColor(isProductImagePaddingCustomColor(imagePadding) ? imagePadding : nextColor);
                              setImagePaddingNotice(null);
                            }}
                            className="border p-1 text-left transition-colors"
                            style={{
                              borderColor: active ? 'var(--color-primary)' : 'var(--color-outline-variant)',
                              background: active ? 'rgba(194, 155, 45, 0.1)' : 'var(--color-surface-container-lowest)',
                            }}
                            aria-pressed={active}
                          >
                            <div
                              className="relative aspect-square overflow-hidden"
                              style={{ background: productImagePaddingBackground(imagePadding) }}
                            >
                              <Image
                                src={image}
                                alt={`${imagePaddingTarget.title} photo ${index + 1}`}
                                fill
                                sizes="104px"
                                className="object-contain object-center"
                                unoptimized={image.startsWith('/assets/')}
                              />
                            </div>
                            <span className="mt-1 block text-[0.62rem] font-bold uppercase tracking-wide" style={{ color: active ? 'var(--color-primary)' : 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}>
                              Photo {index + 1}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <div
                    className="grid grid-cols-[136px_1fr] gap-4 border p-3"
                    style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}
                  >
                    <div
                      className="relative h-32 w-32 overflow-hidden border"
                      style={{
                        borderColor: 'var(--color-outline-variant)',
                        background: customActive ? validCustomColor : productImagePaddingBackground(currentPaddingValue),
                      }}
                    >
                      {selectedImage ? (
                        <Image
                          src={selectedImage}
                          alt={`${imagePaddingTarget.title} photo ${imagePaddingTargetIndex + 1} preview`}
                          fill
                          sizes="128px"
                          className="object-contain object-center"
                          unoptimized={selectedImage.startsWith('/assets/')}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs uppercase tracking-widest opacity-50">No Photo</div>
                      )}
                    </div>
                    <div className="flex flex-col justify-center gap-2 text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
                      <span className="font-bold" style={{ color: 'var(--color-on-surface)' }}>
                        Photo {imagePaddingTargetIndex + 1} preview
                      </span>
                      <span>
                        Select a photo above, then use the eyedropper to sample a color or choose a standard padding option.
                      </span>
                    </div>
                  </div>
                </>
              );
            })()}
            <div className="grid gap-2">
              {IMAGE_PADDING_OPTIONS.map((option) => {
                const currentImage = getProductImages(imagePaddingTarget)[imagePaddingTargetIndex] ?? null;
                const currentPaddingValue = productImagePaddingForImage(
                  imagePaddingTarget.image_padding,
                  imagePaddingTarget.image_padding_by_image,
                  currentImage,
                  imagePaddingTargetIndex,
                );
                const active = normalizeProductImagePadding(currentPaddingValue) === option.value && !isProductImagePaddingCustomColor(currentPaddingValue);
                const isBlackOption = option.value === 'black';
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => updateProductImagePadding(imagePaddingTarget, option.value, imagePaddingTargetIndex)}
                    className="border px-4 py-3 text-left transition-colors"
                    style={{
                      borderColor: active ? 'var(--color-primary)' : isBlackOption ? '#111111' : 'var(--color-outline-variant)',
                      background: isBlackOption ? '#050505' : active ? 'rgba(194, 155, 45, 0.1)' : 'var(--color-surface-container-lowest)',
                    }}
                  >
                    <span
                      className="block text-sm font-bold uppercase tracking-wide"
                      style={{
                        color: isBlackOption ? '#ffffff' : active ? 'var(--color-primary)' : 'var(--color-on-surface)',
                        fontFamily: 'var(--font-label)',
                      }}
                    >
                      {option.label}
                    </span>
                    <span
                      className="mt-1 block text-xs"
                      style={{ color: isBlackOption ? 'rgba(255,255,255,0.78)' : 'var(--color-on-surface-variant)' }}
                    >
                      {option.description}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="border p-4" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
              <button
                type="button"
                onClick={pickImagePaddingColorFromScreen}
                className="outline-button inline-flex w-full items-center justify-center gap-2 text-xs"
              >
                <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: '16px', lineHeight: 1 }}>
                  colorize
                </span>
                Pick From Selected Photo
              </button>
              {imagePaddingNotice && (
                <p className="mt-3 text-xs" style={{ color: imagePaddingNotice.ok ? 'var(--color-primary)' : 'var(--color-error)' }}>
                  {imagePaddingNotice.text}
                </p>
              )}
            </div>
            <div className="flex items-center justify-between gap-3">
              {(() => {
                const allImages = getProductImages(imagePaddingTarget);
                if (allImages.length <= 1) return <span />;
                const selImage = allImages[imagePaddingTargetIndex] ?? null;
                const curPad = productImagePaddingForImage(
                  imagePaddingTarget.image_padding,
                  imagePaddingTarget.image_padding_by_image,
                  selImage,
                  imagePaddingTargetIndex,
                );
                return (
                  <button
                    type="button"
                    onClick={() => applyImagePaddingToAll(imagePaddingTarget, curPad)}
                    className="outline-button text-sm"
                  >
                    Apply to All Photos
                  </button>
                );
              })()}
              <button type="button" onClick={() => setImagePaddingTarget(null)} className="gold-button text-sm">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.5)' }}
        >
          <div
            className="w-full max-w-sm border p-6 flex flex-col gap-4"
            style={{ background: 'var(--color-background)', borderColor: 'var(--color-outline-variant)' }}
          >
            <h2 className="text-lg font-bold" style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}>
              Delete product?
            </h2>
            <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
              &ldquo;{deleteTarget.title}&rdquo; will be permanently removed.
            </p>
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => setDeleteTarget(null)} className="outline-button text-sm">
                Cancel
              </button>
              <button type="button" onClick={handleDelete}
                className="text-sm font-bold px-4 py-2"
                style={{ background: 'var(--color-error)', color: '#fff', fontFamily: 'var(--font-label)' }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation gate for the listing editor's close / cancel / save actions */}
      {editing && editorConfirm && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.55)' }}
        >
          <div
            className="w-full max-w-sm border p-6 flex flex-col gap-4"
            style={{ background: 'var(--color-background)', borderColor: 'var(--color-outline-variant)' }}
          >
            <h2 className="text-lg font-bold" style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}>
              {editorConfirm.title}
            </h2>
            <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
              {editorConfirm.message}
            </p>
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => setEditorConfirm(null)} className="outline-button text-sm">
                Keep editing
              </button>
              <button type="button" onClick={editorConfirm.onConfirm} className="gold-button gold-button-gradient text-sm">
                {editorConfirm.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Heads-up before the Smart Assistant starts listening */}
      {editing && showMicPrompt && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.55)' }}
        >
          <div
            className="w-full max-w-sm border p-6 flex flex-col gap-4"
            style={{ background: 'var(--color-background)', borderColor: 'var(--color-outline-variant)' }}
          >
            <h2 className="text-lg font-bold" style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}>
              Before you start talking
            </h2>
            <div className="flex flex-col gap-3 text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
              <p className="flex gap-2">
                <span className="material-symbols-outlined text-[1.1rem] leading-5" aria-hidden="true" style={{ color: 'var(--color-primary)' }}>mic</span>
                <span>Your browser may pop up a request for microphone access — be sure to tap <strong>Allow</strong> (or Approve) so the assistant can hear you.</span>
              </p>
              <p className="flex gap-2">
                <span className="material-symbols-outlined text-[1.1rem] leading-5" aria-hidden="true" style={{ color: 'var(--color-primary)' }}>visibility</span>
                <span>Once you begin, watch the text box below — your words will appear after a few moments. That&rsquo;s how you know it&rsquo;s working.</span>
              </p>
            </div>
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => setShowMicPrompt(false)} className="outline-button text-sm">
                Cancel
              </button>
              <button type="button" onClick={() => { setShowMicPrompt(false); startAiRecording(); }} className="gold-button gold-button-gradient text-sm">
                Start recording
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
