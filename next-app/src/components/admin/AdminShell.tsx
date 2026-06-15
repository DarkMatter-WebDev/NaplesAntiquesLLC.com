'use client';

import { useState, useCallback, useMemo, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Product, ProductStatus, SpotData } from '@/types/product';
import { getDisplayPrice } from '@/lib/pricing';
import ComboboxInput from './ComboboxInput';
import AdminHeader from './AdminHeader';

interface Props {
  initialProducts: Product[];
  userEmail: string;
  spotData: SpotData | null;
  locale: string;
  unreadMessagesCount: number;
}

const CATEGORIES = ['Gold', 'Silver'] as const;
const STATUSES: { value: ProductStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'available', label: 'Available' },
  { value: 'reserved', label: 'Reserved' },
  { value: 'pending_payment', label: 'Pending Payment' },
  { value: 'sold', label: 'Sold' },
  { value: 'archived', label: 'Archived' },
];
const LOCATIONS = [
  { value: 'showcase', label: 'Showcase' },
  { value: 'safe', label: 'Safe' },
  { value: 'offsite', label: 'Offsite' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'picked_up', label: 'Picked Up' },
];

const PREDEFINED_CHAIN_TYPES = [
  'Cuban link',
  'Figaro link',
  'Rope chain',
  'Anchor / Gucci link',
  'Oval link',
  'Byzantine link',
  'Box link',
  'Bracelet',
  'Ring',
  'Pendant',
  'Earrings',
  'Other',
];

function getChainTypeFromTags(tags: string[] | null): string {
  const tag = (tags ?? []).find(t => t.startsWith('ct:'));
  return tag ? tag.slice(3) : '';
}

function getProductChainType(product: Product): string {
  return product.chain_type || getChainTypeFromTags(product.tags);
}

const PREDEFINED_LENGTHS = [
  '16 in', '18 in', '20 in', '22 in', '24 in', '26 in', '28 in', '30 in',
  '7 in', '7.5 in', '8 in',
];

function getLengthFromTags(tags: string[] | null): string {
  const tag = (tags ?? []).find(t => t.startsWith('len:'));
  return tag ? tag.slice(4) : '';
}

function getProductLength(product: Product): string {
  return product.length || getLengthFromTags(product.tags);
}

function normalizeProductStatus(status: Product['status'] | null | undefined): ProductStatus {
  const value = String(status ?? 'available').toLowerCase().replace(/\s+/g, '_');
  if (value === 'available') return 'available';
  if (value === 'sold') return 'sold';
  if (value === 'draft') return 'draft';
  if (value === 'reserved') return 'reserved';
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
  if (normalized === 'reserved' || normalized === 'pending_payment') return { bg: '#8a5a00', fg: '#fff' };
  if (normalized === 'archived') return { bg: '#6b7280', fg: '#fff' };
  return { bg: 'var(--color-surface-container-high)', fg: 'var(--color-on-surface)' };
}

function getStatusRank(status: Product['status'] | null | undefined): number {
  const normalized = normalizeProductStatus(status);
  const ranks: Record<string, number> = {
    available: 0,
    reserved: 1,
    pending_payment: 2,
    draft: 3,
    sold: 4,
    archived: 5,
  };
  return ranks[normalized] ?? 0;
}

function getProductMetal(product: Product): string {
  return product.metal || product.category;
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

const CHAIN_KEYWORDS: Record<string, string[]> = {
  'cuban-link':     ['cuban'],
  'figaro-link':    ['figaro'],
  'rope-chain':     ['rope'],
  'anchor-link':    ['anchor', 'gucci'],
  'oval-link':      ['oval link'],
  'byzantine-link': ['byzantine'],
  'bracelet':       ['bracelet'],
  'ring':           ['ring'],
};

const PRICE_MODES = [
  { value: 'spot-multiplier', label: 'Spot × Multiplier' },
  { value: 'manual', label: 'Manual / Fixed' },
] as const;

type SortKey =
  | 'inventoryNumber'
  | 'image'
  | 'title'
  | 'category'
  | 'gender'
  | 'chainType'
  | 'length'
  | 'location'
  | 'featured'
  | 'purity'
  | 'weight'
  | 'mode'
  | 'currentPrice'
  | 'status';

type SortDirection = 'asc' | 'desc';
type ImageTarget = { url: string; index: number };
type CropRect = { x: number; y: number; width: number; height: number };
type CropDragMode = 'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
const FULL_IMAGE_CROP: CropRect = { x: 0, y: 0, width: 100, height: 100 };

const PRODUCT_TABLE_COLUMNS: { label: string; sortKey: SortKey | null }[] = [
  { label: 'Inv #', sortKey: 'inventoryNumber' },
  { label: 'Image', sortKey: 'image' },
  { label: 'Title', sortKey: 'title' },
  { label: 'Category', sortKey: 'category' },
  { label: 'Gender', sortKey: 'gender' },
  { label: 'Chain Type', sortKey: 'chainType' },
  { label: 'Length', sortKey: 'length' },
  { label: 'Location', sortKey: 'location' },
  { label: 'Featured', sortKey: 'featured' },
  { label: 'Purity', sortKey: 'purity' },
  { label: 'Weight', sortKey: 'weight' },
  { label: 'Mode', sortKey: 'mode' },
  { label: 'Current Price', sortKey: 'currentPrice' },
  { label: 'Status', sortKey: 'status' },
  { label: '', sortKey: null },
];

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
    metal: 'Gold',
    gram_weight: null,
    stone_details: null,
    chain_type: null,
    length: null,
    pricing_multiplier: 1.25,
    status: 'available',
    location: 'showcase',
    images: [],
    image_urls: [],
    description: '',
    description_es: '',
    details: [],
    details_es: [],
    tags: [],
    tags_es: [],
    private_price_label: null,
    gender: 'Unisex',
    cost_basis: null,
    melt_value: null,
    asking_price: null,
    minimum_price: null,
    live_spot_snapshot: null,
    acquisition_date: null,
    acquisition_source: null,
    internal_notes: null,
    public_notes: null,
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
    case 'category':
      return product.category;
    case 'gender':
      return product.gender ?? 'Unisex';
    case 'chainType':
      return getProductChainType(product);
    case 'length':
      return getProductLength(product);
    case 'location':
      return product.location ?? 'showcase';
    case 'featured':
      return product.featured ? 1 : 0;
    case 'purity':
      return product.purity;
    case 'weight':
      return getProductWeight(product);
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

function getProductImageStoragePath(url: string): string | null {
  const markers = [
    '/storage/v1/object/public/product-images/',
    '/storage/v1/object/sign/product-images/',
  ];
  const marker = markers.find((item) => url.includes(item));
  if (!marker) return null;
  const path = url.slice(url.indexOf(marker) + marker.length).split('?')[0];
  return path ? decodeURIComponent(path) : null;
}

export default function AdminShell({ initialProducts, userEmail, spotData, locale, unreadMessagesCount }: Props) {
  const router = useRouter();
  const adminBasePath = locale === 'es' ? '/es/admin' : '/admin';
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<ReturnType<typeof emptyProduct> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterMetal, setFilterMetal] = useState('');
  const [filterPurity, setFilterPurity] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterChainType, setFilterChainType] = useState('');
  const [filterLength, setFilterLength] = useState('');
  const [filterLocation, setFilterLocation] = useState('');
  const [filterFeatured, setFilterFeatured] = useState('');
  const originalRef = useRef<ReturnType<typeof emptyProduct> | null>(null);
  const [uploading, setUploading] = useState(false);
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
  const [lengthInput, setLengthInput] = useState('');
  const [quickEntry, setQuickEntry] = useState('');
  const [showAdvancedIds, setShowAdvancedIds] = useState(false);
  const [inventoryNumberManual, setInventoryNumberManual] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const flash = (text: string, ok = true) => {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 3500);
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
    originalRef.current = null;
    setFormErrors([]);
    setChainTypeInput('');
    setLengthInput('');
    setQuickEntry('');
    setShowAdvancedIds(false);
    const autoOrder = products.length > 0
      ? Math.max(...products.map(p => p.sort_order ?? 0)) + 1
      : 1;
    setInventoryNumberManual(false);
    setEditing({ ...emptyProduct(), inventory_number: getNextInventoryNumber(products), sort_order: autoOrder });
    setIsNew(true);
  }

  function validate(e: ReturnType<typeof emptyProduct>): string[] {
    const errs: string[] = [];
    if (!e.title.trim()) errs.push('Title (English) is required.');
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
    const copy = { ...p };
    originalRef.current = copy;
    setChainTypeInput(getProductChainType(p));
    setLengthInput(getProductLength(p));
    setFormErrors([]);
    setQuickEntry('');
    setShowAdvancedIds(!!(p.sku || p.slug));
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
    const tokens = quickEntry.split(',').map(t => t.trim()).filter(Boolean);
    const updates: Partial<ReturnType<typeof emptyProduct>> = {};
    let newChainType = chainTypeInput;
    let newLength = lengthInput;
    const applied: string[] = [];

    for (const tok of tokens) {
      const lower = tok.toLowerCase();

      // Category
      if (lower === 'gold')   { updates.category = 'Gold';   applied.push('Category'); continue; }
      if (lower === 'silver') { updates.category = 'Silver'; applied.push('Category'); continue; }

      // Gender
      if (lower === 'unisex')                    { updates.gender = 'Unisex'; applied.push('Gender'); continue; }
      if (lower === 'men' || lower === 'mens')   { updates.gender = 'Men';    applied.push('Gender'); continue; }
      if (lower === 'women' || lower === 'womens' || lower === "women's") { updates.gender = 'Women'; applied.push('Gender'); continue; }

      // Status
      if (lower === 'draft') { updates.status = 'draft'; applied.push('Status'); continue; }
      if (lower === 'available') { updates.status = 'available'; applied.push('Status'); continue; }
      if (lower === 'reserved') { updates.status = 'reserved'; applied.push('Status'); continue; }
      if (lower === 'pending payment' || lower === 'pending_payment') { updates.status = 'pending_payment'; applied.push('Status'); continue; }
      if (lower === 'sold') { updates.status = 'sold'; applied.push('Status'); continue; }
      if (lower === 'archived') { updates.status = 'archived'; applied.push('Status'); continue; }

      // Price mode
      if (lower === 'spot' || lower === 'spot-multiplier' || lower === 'spot multiplier') {
        updates.price_mode = 'spot-multiplier'; applied.push('Price Mode'); continue;
      }
      if (lower === 'manual' || lower === 'fixed') {
        updates.price_mode = 'manual'; applied.push('Price Mode'); continue;
      }

      // Purity: 18k / 14k / 10k / 925
      const purityMatch = lower.match(/^(\d+)\s*k?$/);
      if (purityMatch) {
        const val = parseInt(purityMatch[1]);
        if ([10, 14, 18, 24, 925].includes(val)) { updates.purity = val; applied.push('Purity'); continue; }
      }

      // Weight: 25.3g / 25.3grams
      const weightMatch = lower.match(/^(\d+\.?\d*)\s*g(rams?)?$/);
      if (weightMatch) { updates.weight_grams = parseFloat(weightMatch[1]); applied.push('Weight'); continue; }

      // Multiplier: 1.25x / x1.25 / ×1.25
      const multA = lower.match(/^(\d+\.?\d*)\s*[x×]$/);
      const multB = lower.match(/^[x×]\s*(\d+\.?\d*)$/);
      if (multA) { updates.pricing_multiplier = parseFloat(multA[1]); applied.push('Multiplier'); continue; }
      if (multB) { updates.pricing_multiplier = parseFloat(multB[1]); applied.push('Multiplier'); continue; }

      // Chain / jewelry type — exact then partial match against predefined list
      const exactChain = PREDEFINED_CHAIN_TYPES.find(ct => ct.toLowerCase() === lower);
      const partialChain = PREDEFINED_CHAIN_TYPES.find(ct => ct.toLowerCase().includes(lower) || lower.includes(ct.toLowerCase().split(' ')[0]));
      const matchedChain = exactChain ?? partialChain;
      if (matchedChain) { newChainType = matchedChain; applied.push('Chain Type'); continue; }

      // Length: "22in", "22 in", "22inch", "7.5in", '22"'
      const lenMatch = lower.match(/^(\d+(?:\.\d+)?)\s*(?:in(?:ch(?:es?)?)?|")$/);
      if (lenMatch) { newLength = `${lenMatch[1]} in`; applied.push('Length'); continue; }
    }

    setEditing({ ...editing, ...updates });
    setChainTypeInput(newChainType);
    setLengthInput(newLength);
    if (applied.length) {
      flash(`Applied: ${applied.join(', ')}`);
    } else {
      flash('No recognized fields in that string.', false);
    }
  }

  function closeModal() {
    setEditing(null);
    setPreviewImg(null);
    setCropTarget(null);
  }

  const uploadImageBlob = useCallback(async (blob: Blob): Promise<string | null> => {
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.webp`;
    const path = `products/${filename}`;

    const { error } = await supabase.storage
      .from('product-images')
      .upload(path, blob, { contentType: 'image/webp', upsert: false });

    if (error) {
      flash(`Upload failed: ${error.message}`, false);
      return null;
    }

    const { data } = supabase.storage.from('product-images').getPublicUrl(path);
    return data.publicUrl;
  }, [supabase]);

  const deleteUploadedImageIfUnused = useCallback(async (url: string, sourceIndex: number) => {
    const path = getProductImageStoragePath(url);
    if (!path || !editing) return;

    const currentProductStillUsesImage = [
      ...(editing.images ?? []).filter((_, index) => index !== sourceIndex),
      ...(editing.image_urls ?? []).filter((_, index) => index !== sourceIndex),
    ].includes(url);

    const anotherProductUsesImage = products.some((product) => {
      if (editing.id && product.id === editing.id) return false;
      return [...(product.images ?? []), ...(product.image_urls ?? [])].includes(url);
    });

    if (currentProductStillUsesImage || anotherProductUsesImage) return;

    const { error } = await supabase.storage.from('product-images').remove([path]);
    if (error) {
      flash(`Cropped image saved, but old file cleanup failed: ${error.message}`, false);
    }
  }, [editing, products, supabase]);

  // --- Image upload ---
  const handleImageUpload = useCallback(async (files: FileList) => {
    if (!editing) return;
    setUploading(true);

    const urls: string[] = [];
    for (const file of Array.from(files)) {
      // Compress to WebP via canvas
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement('canvas');
      const MAX = 1200;
      const scale = Math.min(1, MAX / Math.max(bitmap.width, bitmap.height));
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise<Blob>((res) =>
        canvas.toBlob((b) => res(b!), 'image/webp', 0.85)
      );

      const url = await uploadImageBlob(blob);
      if (url) urls.push(url);
    }

    setEditing((prev) => prev ? { ...prev, images: [...prev.images, ...urls] } : prev);
    setUploading(false);
    if (urls.length) flash(`${urls.length} image(s) uploaded`);
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
      const MAX = 1200;
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

      const oldUrl = cropTarget.url;
      setEditing((prev) => {
        if (!prev) return prev;
        const images = [...prev.images];
        images[cropTarget.index] = croppedUrl;
        const imageUrls = prev.image_urls?.length ? [...prev.image_urls] : [];
        if (imageUrls.length) imageUrls[cropTarget.index] = croppedUrl;
        return { ...prev, images, image_urls: imageUrls.length ? imageUrls : images };
      });
      await deleteUploadedImageIfUnused(oldUrl, cropTarget.index);
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
    setEditing((prev) => prev ? { ...prev, images: prev.images.filter((_, i) => i !== idx) } : prev);
  }

  async function updateProductStatus(product: Product, status: ProductStatus) {
    const { error } = await supabase.from('products').update({ status }).eq('id', product.id);
    if (!error) {
      setProducts((prev) => prev.map((p) => p.id === product.id ? { ...p, status } : p));
      flash(`${product.title} marked ${getStatusLabel(status)}`);
      return;
    }
    flash(error.message, false);
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
    setShowAdvancedIds(true);
    setInventoryNumberManual(false);
    setChainTypeInput(getProductChainType(product));
    setLengthInput(getProductLength(product));
    setEditing(copy);
    setIsNew(true);
  }

  // --- Save product ---
  async function handleSave(afterSave: 'stay' | 'another' | 'close' = 'close') {
    if (!editing) return;
    setSaving(true);

    // Build tags with updated ct: and len: entries
    const baseTags = (editing.tags ?? []).filter(t => !t.startsWith('ct:') && !t.startsWith('len:'));
    const withChain = chainTypeInput.trim() ? [...baseTags, `ct:${chainTypeInput.trim()}`] : baseTags;
    const finalTags = lengthInput.trim() ? [...withChain, `len:${lengthInput.trim()}`] : withChain;

    const payload = {
      ...editing,
      id: editing.id || editing.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now(),
      slug: editing.slug || editing.id || editing.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      inventory_number: parseInventoryNumber(editing.inventory_number),
      sku: editing.sku?.trim() || (editing.inventory_number ? String(editing.inventory_number) : null),
      metal: editing.metal || editing.category,
      purity: editing.purity ?? null,
      weight_grams: editing.weight_grams ?? null,
      gram_weight: editing.gram_weight ?? editing.weight_grams ?? null,
      chain_type: chainTypeInput.trim() || null,
      length: lengthInput.trim() || null,
      pricing_multiplier: editing.pricing_multiplier ?? null,
      status: normalizeProductStatus(editing.status),
      location: editing.location || 'showcase',
      image_urls: editing.images,
      tags: finalTags,
      details: [],
      details_es: [],
      internal_notes: foldExtraDetailsIntoInternalNotes(editing),
    };

    if (isNew) {
      const errs = validate(payload);
      if (errs.length) { setFormErrors(errs); setSaving(false); return; }
      setFormErrors([]);
      const { data, error } = await supabase.from('products').insert(payload).select().single();
      if (error) { flash(error.message, false); setSaving(false); return; }
      setProducts((prev) => [data ?? (payload as unknown as Product), ...prev]);
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
      const { error } = await supabase.from('products').update(payload).eq('id', payload.id);
      if (error) { flash(error.message, false); setSaving(false); return; }
      setProducts((prev) => prev.map((p) => p.id === payload.id ? (payload as unknown as Product) : p));
    }

    flash(isNew ? 'Product added' : 'Product saved');
    setSaving(false);

    if (afterSave === 'close') {
      closeModal();
    } else if (afterSave === 'another') {
      openAdd();
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
      setProducts((prev) => prev.map((p) => p.id === deleteTarget.id ? { ...p, status: 'archived' } : p));
      flash('Product has order history, so it was archived instead of deleted.');
      setDeleteTarget(null);
      return;
    }

    const { error } = await supabase.from('products').delete().eq('id', deleteTarget.id);
    if (error) { flash(error.message, false); return; }
    setProducts((prev) => prev.filter((p) => p.id !== deleteTarget.id));
    flash('Product deleted');
    setDeleteTarget(null);
  }

  const masterOrderedProducts = useMemo(() => getMasterProductOrder(products), [products]);

  // --- Filtered list ---
  const filtered = masterOrderedProducts.filter((p) => {
    const searchText = [
      p.title,
      p.id,
      p.inventory_number,
      p.sku,
      getProductMetal(p),
      p.category,
      p.purity ? `${p.purity}` : '',
      getProductChainType(p),
      getProductLength(p),
    ].filter(Boolean).join(' ').toLowerCase();
    if (search && !searchText.includes(search.toLowerCase())) return false;
    if (filterStatus && normalizeProductStatus(p.status) !== filterStatus) return false;
    if (filterMetal === 'gold' && getProductMetal(p).toLowerCase() !== 'gold') return false;
    if (filterMetal === 'silver' && getProductMetal(p).toLowerCase() !== 'silver') return false;
    if (filterCategory && p.category !== filterCategory) return false;
    if (filterPurity && p.purity !== parseInt(filterPurity)) return false;
    if (filterLocation && (p.location ?? 'showcase') !== filterLocation) return false;
    if (filterFeatured === 'featured' && !p.featured) return false;
    if (filterFeatured === 'not-featured' && p.featured) return false;
    if (filterChainType) {
      const kws = CHAIN_KEYWORDS[filterChainType];
      if (kws) {
        const txt = [p.title, getProductChainType(p), ...(p.tags ?? [])].join(' ').toLowerCase();
        if (!kws.some(k => txt.includes(k))) return false;
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
    filterPurity ||
    filterCategory ||
    filterChainType ||
    filterLength ||
    filterLocation ||
    filterFeatured
  );
  const canDragReorder = !sortConfig && !hasActiveTableFilters && !reordering;

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
    const results = await Promise.all(
      reorderedGroup.map((product, index) =>
        supabase.from('products').update({ sort_order: index + 1 }).eq('id', product.id)
      )
    );
    const failed = results.find((result) => result.error);
    if (failed?.error) {
      flash(`Reorder failed: ${failed.error.message}`, false);
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
  const reserved = products.filter((p) => normalizeProductStatus(p.status) === 'reserved').length;
  const sold = products.filter((p) => normalizeProductStatus(p.status) === 'sold').length;

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

      <div className="max-w-[1700px] mx-auto px-4 md:px-8 py-8">

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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total', value: total },
            { label: 'Available', value: available },
            { label: 'Reserved', value: reserved },
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
          </div>

          {/* Filter dropdowns */}
          <div className="flex flex-wrap gap-2 items-end">
            {[
              {
                label: 'Status', value: filterStatus, set: setFilterStatus,
                options: [['', 'All Statuses'], ...STATUSES.map((status) => [status.value, status.label])],
              },
              {
                label: 'Metal', value: filterMetal, set: setFilterMetal,
                options: [['', 'All Metals'], ['gold', 'Gold'], ['silver', 'Silver']],
              },
              {
                label: 'Category', value: filterCategory, set: setFilterCategory,
                options: [['', 'All Categories'], ...CATEGORIES.map((category) => [category, category])],
              },
              {
                label: 'Purity', value: filterPurity, set: setFilterPurity,
                options: [['', 'All Purities'], ['18', '18K'], ['14', '14K'], ['10', '10K'], ['925', '925 Sterling']],
              },
              {
                label: 'Location', value: filterLocation, set: setFilterLocation,
                options: [['', 'All Locations'], ...LOCATIONS.map((location) => [location.value, location.label])],
              },
              {
                label: 'Featured', value: filterFeatured, set: setFilterFeatured,
                options: [['', 'All Items'], ['featured', 'Featured'], ['not-featured', 'Not Featured']],
              },
              {
                label: 'Chain Type', value: filterChainType, set: setFilterChainType,
                options: [
                  ['', 'All Types'],
                  ['cuban-link', 'Cuban link'],
                  ['figaro-link', 'Figaro link'],
                  ['rope-chain', 'Rope chain'],
                  ['anchor-link', 'Anchor / Gucci'],
                  ['oval-link', 'Oval link'],
                  ['byzantine-link', 'Byzantine'],
                  ['bracelet', 'Bracelet'],
                  ['ring', 'Ring'],
                ],
              },
              {
                label: 'Length', value: filterLength, set: setFilterLength,
                options: [
                  ['', 'All Lengths'],
                  ['16 in', '16 in'],
                  ['18 in', '18 in'],
                  ['20 in', '20 in'],
                  ['22 in', '22 in'],
                  ['24 in', '24 in'],
                  ['26 in', '26 in'],
                  ['28 in', '28 in'],
                  ['30 in', '30 in'],
                  ['7 in', '7 in (bracelet)'],
                  ['7.5 in', '7.5 in (bracelet)'],
                  ['8 in', '8 in (bracelet)'],
                ],
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
            {(filterStatus || filterMetal || filterPurity || filterCategory || filterChainType || filterLength || filterLocation || filterFeatured) && (
              <button
                type="button"
                onClick={() => {
                  setFilterStatus('');
                  setFilterMetal('');
                  setFilterPurity('');
                  setFilterCategory('');
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

            <span className="text-xs self-end pb-1 ml-auto"
              style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}>
              {filtered.length} / {products.length}
            </span>
          </div>
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
                  setFilterPurity('');
                  setFilterCategory('');
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-low)' }}>
                  <th
                    className="px-4 py-3 text-xs font-bold uppercase tracking-wide whitespace-nowrap"
                    style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}
                  >
                    Order
                  </th>
                  {PRODUCT_TABLE_COLUMNS.map(({ label, sortKey }) => {
                    const active = sortConfig?.key === sortKey;
                    return (
                      <th
                        key={label || 'actions'}
                        aria-sort={active ? (sortConfig.direction === 'asc' ? 'ascending' : 'descending') : undefined}
                        className="px-4 py-3 text-xs font-bold uppercase tracking-wide whitespace-nowrap"
                        style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}
                      >
                        {sortKey ? (
                          <button
                            type="button"
                            onClick={() => toggleSort(sortKey)}
                            className="flex items-center gap-1 uppercase tracking-wide hover:opacity-75"
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
                    <td className="px-4 py-3 whitespace-nowrap">
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
                    <td className="px-4 py-3 whitespace-nowrap font-bold text-xs" style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}>
                      {p.inventory_number || `#${inventoryNumbers.get(p.id) ?? '-'}`}
                    </td>
                    <td className="p-0">
                      {getProductImages(p)[0] ? (
                        <div className="relative w-16 h-16">
                          <Image
                            src={getProductImages(p)[0]}
                            alt={p.title}
                            fill
                            sizes="64px"
                            className="object-contain"
                            unoptimized={getProductImages(p)[0].startsWith('/assets/')}
                          />
                        </div>
                      ) : (
                        <div className="w-16 h-16 flex items-center justify-center text-xl"
                          style={{ background: 'var(--color-surface-container)' }}>📷</div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium max-w-xs" style={{ color: 'var(--color-on-surface)' }}>
                      <span className="line-clamp-2">{p.title}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--color-on-surface-variant)' }}>{p.category}</td>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--color-on-surface-variant)' }}>{p.gender ?? 'Unisex'}</td>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--color-on-surface-variant)' }}>
                      {getProductChainType(p) || '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--color-on-surface-variant)' }}>
                      {getProductLength(p) || '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                      {LOCATIONS.find((location) => location.value === (p.location ?? 'showcase'))?.label ?? p.location ?? 'Showcase'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs" style={{ color: p.featured ? 'var(--color-primary)' : 'var(--color-on-surface-variant)' }}>
                      {p.featured ? 'Yes' : 'No'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--color-on-surface-variant)' }}>
                      {p.purity
                        ? p.purity <= 24
                          ? `${p.purity}k`
                          : ({ 999:'99.9%', 950:'95%', 925:'92.5%', 900:'90%', 850:'85%', 800:'80%' } as Record<number,string>)[p.purity] ?? `${p.purity}`
                        : '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--color-on-surface-variant)' }}>
                      {getProductWeight(p) ? `${getProductWeight(p)}g` : '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                      {p.price_mode === 'manual' ? 'Manual' : `Spot ×${p.pricing_multiplier ?? '?'}`}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-semibold" style={{ color: 'var(--color-primary)' }}>
                      {getDisplayPrice(p, spotData)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
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
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => openEdit(p)}
                          className="text-xs font-bold uppercase tracking-wide hover:underline"
                          style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}>
                          Edit
                        </button>
                        <button type="button" onClick={() => duplicateProduct(p)}
                          className="text-xs font-bold uppercase tracking-wide hover:underline"
                          style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}>
                          Duplicate
                        </button>
                        {normalizeProductStatus(p.status) !== 'available' && (
                          <button type="button" onClick={() => updateProductStatus(p, 'available')}
                            className="text-xs font-bold uppercase tracking-wide hover:underline"
                            style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}>
                            Available
                          </button>
                        )}
                        {normalizeProductStatus(p.status) !== 'reserved' && (
                          <button type="button" onClick={() => updateProductStatus(p, 'reserved')}
                            className="text-xs font-bold uppercase tracking-wide hover:underline"
                            style={{ color: '#8a5a00', fontFamily: 'var(--font-label)' }}>
                            Reserve
                          </button>
                        )}
                        {normalizeProductStatus(p.status) !== 'sold' && (
                          <button type="button" onClick={() => updateProductStatus(p, 'sold')}
                            className="text-xs font-bold uppercase tracking-wide hover:underline"
                            style={{ color: 'var(--color-on-surface)', fontFamily: 'var(--font-label)' }}>
                            Sold
                          </button>
                        )}
                        {normalizeProductStatus(p.status) !== 'archived' && (
                          <button type="button" onClick={() => updateProductStatus(p, 'archived')}
                            className="text-xs font-bold uppercase tracking-wide hover:underline"
                            style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}>
                            Archive
                          </button>
                        )}
                        <button type="button" onClick={() => setDeleteTarget(p)}
                          className="text-xs font-bold uppercase tracking-wide hover:underline"
                          style={{ color: 'var(--color-error)', fontFamily: 'var(--font-label)' }}>
                          Delete
                        </button>
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
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-8 px-4"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={(e) => e.target === e.currentTarget && closeModal()}
        >
          <div
            className="w-full max-w-4xl border flex flex-col"
            style={{ background: 'var(--color-background)', borderColor: 'var(--color-outline-variant)' }}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b"
              style={{ borderColor: 'var(--color-outline-variant)' }}>
              <h2 className="text-lg font-bold" style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}>
                {isNew ? 'Add Product' : 'Edit Product'}
              </h2>
              <button type="button" onClick={closeModal}
                className="text-sm font-bold uppercase tracking-wide"
                style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}>
                ✕ Close
              </button>
            </div>

            <div className="p-6 flex flex-col gap-5 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 14rem)' }}>

              {/* Quick Fill */}
              <div
                className="p-4 flex flex-col gap-2"
                style={{
                  background: 'color-mix(in srgb, var(--color-primary) 6%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--color-primary) 22%, transparent)',
                }}
              >
                <label className="form-label" style={{ marginBottom: 0 }}>Quick Fill</label>
                <div className="flex gap-2">
                  <input
                    className="form-field flex-1 text-sm"
                    placeholder="18k, 25.3g, Cuban link"
                    value={quickEntry}
                    onChange={(e) => setQuickEntry(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyQuickEntry(); } }}
                  />
                  <button
                    type="button"
                    onClick={applyQuickEntry}
                    className="gold-button text-xs flex-shrink-0"
                  >
                    Apply
                  </button>
                </div>
                <p className="text-[0.6rem] leading-relaxed" style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}>
                  Only include what differs from the defaults — omit anything already set correctly.
                  Recognized tokens: <strong>Category</strong> (Gold / Silver) · <strong>Status</strong> (Draft / Available / Reserved / Pending Payment / Sold / Archived) ·&nbsp;
                  <strong>Chain Type</strong> (Cuban link / Bracelet / Ring / etc.) ·&nbsp;
                  <strong>Length</strong> (22in / 7.5in) ·&nbsp;
                  <strong>Price Mode</strong> (Spot / Manual) ·&nbsp;
                  <strong>Purity</strong> (18k / 14k / 10k / 925) ·&nbsp;
                  <strong>Weight</strong> (25.3g) ·&nbsp;
                  <strong>Multiplier</strong> (1.25x)
                </p>
              </div>

              {/* ID (new only) */}
              {isNew && (
                <div>
                  <label className="form-label">ID (slug, auto-generated if blank)</label>
                  <input className="form-field w-full" placeholder="my-product-slug"
                    value={editing.id}
                    onChange={(e) => setEditing({ ...editing, id: e.target.value })} />
                </div>
              )}

              <div className="grid md:grid-cols-[minmax(0,1fr)_auto] gap-4 items-end">
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
                  {!inventoryNumberManual && (
                    <p className="mt-1 text-[0.68rem]" style={{ color: 'var(--color-on-surface-variant)' }}>
                      Auto-filled with the next available inventory number.
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setShowAdvancedIds((current) => !current)}
                  className="outline-button text-xs h-10"
                >
                  {showAdvancedIds ? 'Hide SKU' : 'SKU / Slug'}
                </button>
              </div>

              {showAdvancedIds && (
                <div
                  className="grid md:grid-cols-2 gap-4 p-4 border"
                  style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}
                >
                  <div>
                    <label className="form-label">SKU</label>
                    <input className="form-field w-full" value={editing.sku ?? ''}
                      onChange={(e) => setEditing({ ...editing, sku: e.target.value })} />
                  </div>
                  <div>
                    <label className="form-label">Public Slug</label>
                    <input className="form-field w-full" value={editing.slug ?? ''}
                      onChange={(e) => setEditing({ ...editing, slug: e.target.value })} />
                  </div>
                </div>
              )}

              {/* Title */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Title (English)</label>
                  <input className="form-field w-full" value={editing.title}
                    onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">Title (Spanish)</label>
                  <input className="form-field w-full" value={editing.title_es ?? ''}
                    onChange={(e) => setEditing({ ...editing, title_es: e.target.value })} />
                </div>
              </div>

              {/* Category + Status + Gender */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="form-label">Category</label>
                  <select className="form-field w-full" value={editing.category}
                    onChange={(e) => setEditing({ ...editing, category: e.target.value as 'Gold' | 'Silver', metal: e.target.value, purity: null })}>
                    {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Status</label>
                  <select className="form-field w-full" value={editing.status}
                    onChange={(e) => setEditing({ ...editing, status: e.target.value as ProductStatus })}>
                    {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Gender</label>
                  <select className="form-field w-full" value={editing.gender ?? 'Unisex'}
                    onChange={(e) => setEditing({ ...editing, gender: e.target.value })}>
                    <option value="Unisex">Unisex</option>
                    <option value="Men">Men</option>
                    <option value="Women">Women</option>
                  </select>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="form-label">Location</label>
                  <select className="form-field w-full" value={editing.location ?? 'showcase'}
                    onChange={(e) => setEditing({ ...editing, location: e.target.value })}>
                    {LOCATIONS.map((location) => <option key={location.value} value={location.value}>{location.label}</option>)}
                  </select>
                </div>
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

              {/* Chain Type + Length */}
              <div className="grid grid-cols-2 gap-4">
                {(() => {
                  const existingChainTypes = Array.from(
                    new Set(
                      products
                        .flatMap(p => (p.tags ?? []).filter(t => t.startsWith('ct:')).map(t => t.slice(3)))
                        .filter(Boolean)
                    )
                  );
                  const allOptions = Array.from(new Set([...PREDEFINED_CHAIN_TYPES, ...existingChainTypes]));
                  return (
                    <div>
                      <label className="form-label">Chain / Jewelry Type</label>
                      <ComboboxInput
                        value={chainTypeInput}
                        onChange={setChainTypeInput}
                        options={allOptions}
                        placeholder="e.g. Cuban link, Bracelet…"
                      />
                    </div>
                  );
                })()}
                {(() => {
                  const existingLengths = Array.from(new Set(
                    products.flatMap(p => (p.tags ?? []).filter(t => t.startsWith('len:')).map(t => t.slice(4))).filter(Boolean)
                  ));
                  const allOptions = Array.from(new Set([...PREDEFINED_LENGTHS, ...existingLengths]));
                  return (
                    <div>
                      <label className="form-label">Length</label>
                      <ComboboxInput
                        value={lengthInput}
                        onChange={setLengthInput}
                        options={allOptions}
                        placeholder="e.g. 22 in, 24 in, 7.5 in…"
                      />
                    </div>
                  );
                })()}
              </div>

              {/* Pricing — 4-col: Mode · Purity · Weight · Multiplier or Price Label */}
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="form-label">Price Mode</label>
                  <select className="form-field w-full" value={editing.price_mode}
                    onChange={(e) => setEditing({ ...editing, price_mode: e.target.value as 'spot-multiplier' | 'manual' })}>
                    {PRICE_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">{editing.category === 'Silver' ? 'Purity' : 'Purity (k)'}</label>
                  {editing.category === 'Silver' ? (
                    <select className="form-field w-full" value={editing.purity ?? ''}
                      onChange={(e) => setEditing({ ...editing, purity: e.target.value ? Number(e.target.value) : null })}>
                      <option value="">— select —</option>
                      <option value="999">99.9% fine</option>
                      <option value="950">95%</option>
                      <option value="925">92.5% Sterling</option>
                      <option value="900">90% Coin</option>
                      <option value="850">85%</option>
                      <option value="800">80%</option>
                    </select>
                  ) : (
                    <input type="number" className="form-field w-full" placeholder="18"
                      value={editing.purity ?? ''}
                      onChange={(e) => setEditing({ ...editing, purity: e.target.value ? Number(e.target.value) : null })} />
                  )}
                </div>
                <div>
                  <label className="form-label">Weight (g)</label>
                  <input type="number" step="0.01" className="form-field w-full"
                    value={editing.weight_grams ?? ''}
                    onChange={(e) => setEditing({ ...editing, weight_grams: e.target.value ? Number(e.target.value) : null })} />
                </div>
                <div>
                  {editing.price_mode === 'spot-multiplier' ? (
                    <>
                      <label className="form-label">Multiplier</label>
                      <input type="number" step="0.01" className="form-field w-full"
                        value={editing.pricing_multiplier ?? ''}
                        onChange={(e) => setEditing({ ...editing, pricing_multiplier: e.target.value ? Number(e.target.value) : null })} />
                    </>
                  ) : (
                    <>
                      <label className="form-label">Price Label</label>
                      <input className="form-field w-full" placeholder="$1,200"
                        value={editing.manual_price_label ?? ''}
                        onChange={(e) => setEditing({ ...editing, manual_price_label: e.target.value })} />
                    </>
                  )}
                </div>
              </div>

              <div className="grid md:grid-cols-4 gap-4">
                <div>
                  <label className="form-label">Asking Price</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-field w-full"
                    disabled={editing.price_mode !== 'manual'}
                    value={editing.asking_price ?? ''}
                    onChange={(e) => setEditing({ ...editing, asking_price: e.target.value ? Number(e.target.value) : null })}
                    style={editing.price_mode !== 'manual' ? { background: 'var(--color-surface-container-low)', color: 'var(--color-on-surface-variant)' } : undefined}
                  />
                </div>
              </div>

              {/* Description */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Description (EN)</label>
                  <textarea rows={4} className="form-field w-full resize-y"
                    value={editing.description ?? ''}
                    onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">Description (ES)</label>
                  <textarea rows={4} className="form-field w-full resize-y"
                    value={editing.description_es ?? ''}
                    onChange={(e) => setEditing({ ...editing, description_es: e.target.value })} />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Public Notes</label>
                  <textarea rows={3} className="form-field w-full resize-y"
                    value={editing.public_notes ?? ''}
                    onChange={(e) => setEditing({ ...editing, public_notes: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">Internal Notes</label>
                  <textarea rows={3} className="form-field w-full resize-y"
                    value={editing.internal_notes ?? ''}
                    onChange={(e) => setEditing({ ...editing, internal_notes: e.target.value })} />
                </div>
              </div>

              {/* Images */}
              <div>
                <label className="form-label">Images</label>
                <label
                  className="flex flex-col items-center justify-center border-2 border-dashed p-6 cursor-pointer text-sm transition-colors mb-3"
                  style={{
                    borderColor: dragOver ? 'var(--color-primary)' : 'var(--color-outline-variant)',
                    color: dragOver ? 'var(--color-primary)' : 'var(--color-on-surface-variant)',
                    background: dragOver ? 'color-mix(in srgb, var(--color-primary) 6%, transparent)' : undefined,
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
                  {uploading ? 'Uploading…' : 'Click or drag images here (compressed to WebP automatically)'}
                </label>
                {editing.images.length > 0 && (
                  <div>
                    <p className="text-[0.62rem] mb-2" style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}>
                      Click to preview or crop · Drag to reorder · First image is the cover photo
                    </p>
                    <div className="flex flex-wrap gap-2">
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
                            const imgs = [...editing.images];
                            const [moved] = imgs.splice(dragSrcIdx, 1);
                            imgs.splice(i, 0, moved);
                            setEditing({ ...editing, images: imgs });
                            setDragSrcIdx(null);
                            setDragOverIdx(null);
                          }}
                          onDragEnd={() => { setDragSrcIdx(null); setDragOverIdx(null); }}
                          onClick={(e) => {
                            if ((e.target as HTMLElement).closest('button')) return;
                            setPreviewImg({ url: img, index: i });
                          }}
                          className="relative w-16 h-16 group cursor-grab"
                          style={{
                            opacity: dragSrcIdx === i ? 0.4 : 1,
                            outline: dragOverIdx === i && dragSrcIdx !== i ? '2px solid var(--color-primary)' : undefined,
                            outlineOffset: '2px',
                          }}
                        >
                          {/* Cover badge */}
                          {i === 0 && (
                            <div
                              className="absolute bottom-0 left-0 right-0 z-20 text-center text-[0.45rem] font-bold uppercase tracking-wide leading-4"
                              style={{ background: 'var(--color-primary)', color: 'var(--color-on-primary)' }}
                            >
                              Cover
                            </div>
                          )}
                          <Image src={img} alt="" fill sizes="64px" className="object-contain"
                            unoptimized={img.startsWith('/assets/')} />
                          {/* Hover overlay: preview + remove */}
                          <div
                            className="absolute inset-0 z-10 flex flex-col opacity-0 group-hover:opacity-100 transition-opacity"
                            style={{ background: 'rgba(0,0,0,0.45)' }}
                          >
                            <button
                              type="button"
                              onClick={() => setPreviewImg({ url: img, index: i })}
                              className="flex-1 flex items-center justify-center text-white"
                              title="Preview"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>zoom_in</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => removeImage(i)}
                              className="h-5 flex items-center justify-center text-white text-[0.6rem] font-bold"
                              style={{ background: 'rgba(180,0,0,0.75)' }}
                              title="Remove"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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

            {/* Modal footer */}
            <div className="flex items-center gap-1.5 px-3 py-4 border-t"
              style={{ borderColor: 'var(--color-outline-variant)' }}>
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
                    setInventoryNumberManual(false);
                    setLengthInput(getProductLength(editing as Product));
                    setEditing(clone);
                    setIsNew(true);
                  }}
                  className="outline-button text-sm"
                >
                  Clone
                </button>
              )}
              <button type="button" onClick={closeModal} className="outline-button text-sm">
                Cancel
              </button>
              <button type="button" onClick={() => handleSave('stay')} disabled={saving} className="outline-button text-sm disabled:opacity-50">
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button type="button" onClick={() => handleSave('another')} disabled={saving} className="outline-button text-sm disabled:opacity-50">
                Save + Add Another
              </button>
              <button type="button" onClick={() => handleSave('close')} disabled={saving} className="gold-button text-sm disabled:opacity-50">
                {saving ? 'Saving…' : 'Save and Close'}
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
            <img
              src={previewImg.url}
              alt="Preview"
              className="max-w-full max-h-[78vh] object-contain"
              style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.6)' }}
            />
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
                <img
                  src={cropTarget.url}
                  alt="Crop preview"
                  className="block max-w-full max-h-[60vh] object-contain"
                  draggable={false}
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

    </div>
  );
}
