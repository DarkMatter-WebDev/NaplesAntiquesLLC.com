'use client';

import { useState, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Product, SpotData } from '@/types/product';
import { getDisplayPrice } from '@/lib/pricing';
import ComboboxInput from './ComboboxInput';

interface Props {
  initialProducts: Product[];
  userEmail: string;
  spotData: SpotData | null;
}

const CATEGORIES = ['Gold', 'Silver'] as const;
const STATUSES = ['Available', 'Sold'] as const;

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

const PREDEFINED_LENGTHS = [
  '16 in', '18 in', '20 in', '22 in', '24 in', '26 in', '28 in', '30 in',
  '7 in', '7.5 in', '8 in',
];

function getLengthFromTags(tags: string[] | null): string {
  const tag = (tags ?? []).find(t => t.startsWith('len:'));
  return tag ? tag.slice(4) : '';
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

const LENGTH_PATTERNS: Record<string, string[]> = {
  '22':       ['22 inch', '22"'],
  '23':       ['23 inch', '23"'],
  '24':       ['24 inch', '24"'],
  '25-plus':  ['25 inch', '25.5 inch', '26 inch', '27 inch', '27.5 inch', '28 inch', '29 inch'],
  '30':       ['30 inch', '30"'],
  'bracelet': ['bracelet'],
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
  | 'purity'
  | 'weight'
  | 'mode'
  | 'currentPrice'
  | 'status';

type SortDirection = 'asc' | 'desc';

const PRODUCT_TABLE_COLUMNS: { label: string; sortKey: SortKey | null }[] = [
  { label: 'Inv #', sortKey: 'inventoryNumber' },
  { label: 'Image', sortKey: 'image' },
  { label: 'Title', sortKey: 'title' },
  { label: 'Category', sortKey: 'category' },
  { label: 'Gender', sortKey: 'gender' },
  { label: 'Chain Type', sortKey: 'chainType' },
  { label: 'Length', sortKey: 'length' },
  { label: 'Purity', sortKey: 'purity' },
  { label: 'Weight', sortKey: 'weight' },
  { label: 'Mode', sortKey: 'mode' },
  { label: 'Current Price', sortKey: 'currentPrice' },
  { label: 'Status', sortKey: 'status' },
  { label: '', sortKey: null },
];

function getMasterProductOrder(products: Product[]): Product[] {
  return [...products].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'Available' ? -1 : 1;
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
    pricing_multiplier: 1.25,
    status: 'Available',
    images: [],
    description: '',
    description_es: '',
    details: [],
    details_es: [],
    tags: [],
    tags_es: [],
    private_price_label: null,
    gender: 'Unisex',
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
      return inventoryNumbers.get(product.id) ?? null;
    case 'image':
      return product.images?.[0] ? 1 : 0;
    case 'title':
      return product.title;
    case 'category':
      return product.category;
    case 'gender':
      return product.gender ?? 'Unisex';
    case 'chainType':
      return getChainTypeFromTags(product.tags);
    case 'length':
      return getLengthFromTags(product.tags);
    case 'purity':
      return product.purity;
    case 'weight':
      return product.weight_grams;
    case 'mode':
      return product.price_mode === 'manual' ? 'Manual' : `Spot ${product.pricing_multiplier ?? ''}`;
    case 'currentPrice':
      return parseDisplayPrice(getDisplayPrice(product, spotData));
    case 'status':
      return product.status;
  }
}

function compareSortValues(a: string | number | null, b: string | number | null): number {
  if (a == null || a === '') return b == null || b === '' ? 0 : 1;
  if (b == null || b === '') return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

export default function AdminShell({ initialProducts, userEmail, spotData }: Props) {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<ReturnType<typeof emptyProduct> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [filterMetal, setFilterMetal] = useState('');
  const [filterPurity, setFilterPurity] = useState('');
  const [filterChainType, setFilterChainType] = useState('');
  const [filterLength, setFilterLength] = useState('');
  const originalRef = useRef<ReturnType<typeof emptyProduct> | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [dragSrcIdx, setDragSrcIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [previewImg, setPreviewImg] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [sortOrderManual, setSortOrderManual] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection } | null>(null);
  const [draggedProductId, setDraggedProductId] = useState<string | null>(null);
  const [dragTargetProductId, setDragTargetProductId] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);
  const [chainTypeInput, setChainTypeInput] = useState('');
  const [lengthInput, setLengthInput] = useState('');
  const [quickEntry, setQuickEntry] = useState('');
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
    setSortOrderManual(false);
    setChainTypeInput('');
    setLengthInput('');
    setQuickEntry('');
    const autoOrder = products.length > 0
      ? Math.max(...products.map(p => p.sort_order ?? 0)) + 1
      : 1;
    setEditing({ ...emptyProduct(), sort_order: autoOrder });
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
    setChainTypeInput(getChainTypeFromTags(p.tags));
    setLengthInput(getLengthFromTags(p.tags));
    setFormErrors([]);
    setQuickEntry('');
    setEditing(copy);
    setIsNew(false);
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
      if (lower === 'available') { updates.status = 'Available'; applied.push('Status'); continue; }
      if (lower === 'sold')      { updates.status = 'Sold';      applied.push('Status'); continue; }

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
  }

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

      const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.webp`;
      const path = `products/${filename}`;

      const { error } = await supabase.storage
        .from('product-images')
        .upload(path, blob, { contentType: 'image/webp', upsert: false });

      if (error) {
        flash(`Upload failed: ${error.message}`, false);
        continue;
      }

      const { data } = supabase.storage.from('product-images').getPublicUrl(path);
      urls.push(data.publicUrl);
    }

    setEditing((prev) => prev ? { ...prev, images: [...prev.images, ...urls] } : prev);
    setUploading(false);
    if (urls.length) flash(`${urls.length} image(s) uploaded`);
  }, [editing, supabase]);

  function removeImage(idx: number) {
    setEditing((prev) => prev ? { ...prev, images: prev.images.filter((_, i) => i !== idx) } : prev);
  }

  // --- Quick status toggle (click badge in table) ---
  async function handleQuickStatus(product: Product) {
    const newStatus = product.status === 'Available' ? 'Sold' : 'Available';
    const { error } = await supabase.from('products').update({ status: newStatus }).eq('id', product.id);
    if (!error) {
      setProducts((prev) => prev.map((p) => p.id === product.id ? { ...p, status: newStatus } : p));
    }
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
      purity: editing.purity ?? null,
      weight_grams: editing.weight_grams ?? null,
      pricing_multiplier: editing.pricing_multiplier ?? null,
      tags: finalTags,
    };

    if (isNew) {
      const errs = validate(payload);
      if (errs.length) { setFormErrors(errs); setSaving(false); return; }
      setFormErrors([]);
      const { data, error } = await supabase.from('products').insert(payload).select().single();
      if (error) { flash(error.message, false); setSaving(false); return; }
      setProducts((prev) => [data ?? (payload as Product), ...prev]);
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
      setProducts((prev) => prev.map((p) => p.id === payload.id ? (payload as Product) : p));
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
    const { error } = await supabase.from('products').delete().eq('id', deleteTarget.id);
    if (error) { flash(error.message, false); return; }
    setProducts((prev) => prev.filter((p) => p.id !== deleteTarget.id));
    flash('Product deleted');
    setDeleteTarget(null);
  }

  const masterOrderedProducts = useMemo(() => getMasterProductOrder(products), [products]);

  // --- Filtered list ---
  const filtered = masterOrderedProducts.filter((p) => {
    if (search && !p.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterMetal === 'gold' && p.category !== 'Gold') return false;
    if (filterMetal === 'silver' && p.category !== 'Silver') return false;
    if (filterPurity && p.purity !== parseInt(filterPurity)) return false;
    if (filterChainType) {
      const kws = CHAIN_KEYWORDS[filterChainType];
      if (kws) {
        const txt = [p.title, ...(p.tags ?? [])].join(' ').toLowerCase();
        if (!kws.some(k => txt.includes(k))) return false;
      }
    }
    if (filterLength) {
      if (getLengthFromTags(p.tags) !== filterLength) return false;
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
    filterMetal ||
    filterPurity ||
    filterChainType ||
    filterLength
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

    if (draggedProduct.status !== targetProduct.status) {
      flash('Move items within Available or Sold. Change status first to move across groups.', false);
      resetRowDrag();
      return;
    }

    const statusGroup = masterOrderedProducts.filter((product) => product.status === draggedProduct.status);
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
  const available = products.filter((p) => p.status === 'Available').length;
  const sold = products.filter((p) => p.status === 'Sold').length;
  const goldCount = products.filter((p) => p.category === 'Gold').length;

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-background)' }}>

      {/* Top bar */}
      <header
        className="sticky top-0 z-40 border-b flex items-center justify-between px-4 md:px-8 py-3 gap-4"
        style={{ background: 'var(--color-background)', borderColor: 'var(--color-outline-variant)' }}
      >
        <div className="flex items-center gap-4 min-w-0">
          <Link href="/"
            className="text-xs font-bold uppercase tracking-widest flex-shrink-0"
            style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}>
            ← Site
          </Link>
          <span
            className="text-sm font-bold truncate"
            style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}>
            Product Admin
          </span>
          <Link href="/admin/inquiries"
            className="text-xs font-bold uppercase tracking-widest flex-shrink-0 hover:underline"
            style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}>
            Inquiries
          </Link>
        </div>
        <div className="flex items-center gap-3">
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
          <span className="text-xs hidden md:block truncate" style={{ color: 'var(--color-on-surface-variant)' }}>
            {userEmail}
          </span>
          <button
            type="button"
            onClick={handleSignOut}
            className="outline-button text-xs"
          >
            Sign Out
          </button>
        </div>
      </header>

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
            { label: 'Sold', value: sold },
            { label: 'Gold Items', value: goldCount },
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
                label: 'Metal', value: filterMetal, set: setFilterMetal,
                options: [['', 'All Metals'], ['gold', 'Gold'], ['silver', 'Silver']],
              },
              {
                label: 'Purity', value: filterPurity, set: setFilterPurity,
                options: [['', 'All Purities'], ['18', '18K'], ['14', '14K'], ['10', '10K'], ['925', '925 Sterling']],
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
            {(filterMetal || filterPurity || filterChainType || filterLength) && (
              <button
                type="button"
                onClick={() => { setFilterMetal(''); setFilterPurity(''); setFilterChainType(''); setFilterLength(''); }}
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
                  setFilterMetal('');
                  setFilterPurity('');
                  setFilterChainType('');
                  setFilterLength('');
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
                      #{inventoryNumbers.get(p.id) ?? '—'}
                    </td>
                    <td className="p-0">
                      {p.images?.[0] ? (
                        <div className="relative w-16 h-16">
                          <Image
                            src={p.images[0]}
                            alt={p.title}
                            fill
                            sizes="64px"
                            className="object-contain"
                            unoptimized={p.images[0].startsWith('/assets/')}
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
                      {getChainTypeFromTags(p.tags) || '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--color-on-surface-variant)' }}>
                      {getLengthFromTags(p.tags) || '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--color-on-surface-variant)' }}>
                      {p.purity
                        ? p.purity <= 24
                          ? `${p.purity}k`
                          : ({ 999:'99.9%', 950:'95%', 925:'92.5%', 900:'90%', 850:'85%', 800:'80%' } as Record<number,string>)[p.purity] ?? `${p.purity}`
                        : '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--color-on-surface-variant)' }}>
                      {p.weight_grams ? `${p.weight_grams}g` : '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                      {p.price_mode === 'manual' ? 'Manual' : `Spot ×${p.pricing_multiplier ?? '?'}`}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-semibold" style={{ color: 'var(--color-primary)' }}>
                      {getDisplayPrice(p, spotData)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleQuickStatus(p)}
                        title="Click to toggle Available / Sold"
                        className="text-[0.6rem] font-bold uppercase tracking-widest px-2 py-0.5 cursor-pointer hover:opacity-75 transition-opacity"
                        style={{
                          background: p.status === 'Available' ? 'var(--color-primary)' : 'var(--color-on-surface)',
                          color: p.status === 'Available' ? 'var(--color-on-primary)' : 'var(--color-surface)',
                          border: 'none',
                        }}>
                        {p.status}
                      </button>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex gap-2">
                        <button type="button" onClick={() => openEdit(p)}
                          className="text-xs font-bold uppercase tracking-wide hover:underline"
                          style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}>
                          Edit
                        </button>
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
                  Recognized tokens: <strong>Category</strong> (Gold / Silver) · <strong>Status</strong> (Available / Sold) ·&nbsp;
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
                    onChange={(e) => setEditing({ ...editing, category: e.target.value as 'Gold' | 'Silver', purity: null })}>
                    {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Status</label>
                  <select className="form-field w-full" value={editing.status}
                    onChange={(e) => setEditing({ ...editing, status: e.target.value as 'Available' | 'Sold' })}>
                    {STATUSES.map((s) => <option key={s}>{s}</option>)}
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

              {/* Extra notes + Sort Order side by side */}
              <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 14rem' }}>
                <div>
                  <label className="form-label">Extra notes about this item (optional)</label>
                  <input
                    className="form-field w-full"
                    placeholder="e.g. Lobster claw clasp, diamond-cut finish, estate piece…"
                    value={(editing.details ?? [])[0] ?? ''}
                    onChange={(e) => setEditing({ ...editing, details: e.target.value ? [e.target.value] : [] })}
                  />
                </div>
                <div>
                  <label className="form-label">Sort Order</label>
                  {isNew && !sortOrderManual ? (
                    <div className="flex items-center gap-2">
                      <span className="form-field flex-1 flex items-center text-sm select-none"
                        style={{ color: 'var(--color-on-surface-variant)', background: 'var(--color-surface-container-low)' }}>
                        {editing.sort_order} (auto)
                      </span>
                      <button type="button" onClick={() => setSortOrderManual(true)}
                        className="text-xs font-bold uppercase tracking-wide hover:underline flex-shrink-0"
                        style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}>
                        Set
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input type="number" className="form-field flex-1"
                        value={editing.sort_order}
                        onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} />
                      {isNew && (
                        <button type="button"
                          onClick={() => {
                            const autoOrder = products.length > 0 ? Math.max(...products.map(p => p.sort_order ?? 0)) + 1 : 1;
                            setEditing({ ...editing, sort_order: autoOrder });
                            setSortOrderManual(false);
                          }}
                          className="text-xs font-bold uppercase tracking-wide hover:underline flex-shrink-0"
                          style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}>
                          Auto
                        </button>
                      )}
                    </div>
                  )}
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
                      Drag to reorder · First image is the cover photo
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
                              onClick={() => setPreviewImg(img)}
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
                      title: `${editing.title} (Copy)`,
                      title_es: editing.title_es ? `${editing.title_es} (Copia)` : null,
                      sort_order: products.length > 0
                        ? Math.max(...products.map(p => p.sort_order ?? 0)) + 1
                        : 1,
                    };
                    originalRef.current = null;
                    setFormErrors([]);
                    setSortOrderManual(false);
                    setQuickEntry('');
                    setLengthInput(getLengthFromTags(editing.tags));
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
          <div className="relative max-w-3xl w-full max-h-[85vh] flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <img
              src={previewImg}
              alt="Preview"
              className="max-w-full max-h-[85vh] object-contain"
              style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.6)' }}
            />
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
