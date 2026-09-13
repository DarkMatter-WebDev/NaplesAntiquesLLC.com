'use client';

import { useEffect, useState, type ReactNode } from 'react';
import ComboboxInput from './ComboboxInput';
import EtsyCategoryDropdown, { type EtsyCategoryLeaf } from './EtsyCategoryDropdown';
import { AppIcon } from '@/components/AppIcon';
import type { EditableProductField, ProductFieldEditPatch, ReviewProductFields } from '@/lib/product-field-edits';
import {
  PRODUCT_JEWELRY_TYPES,
  PRODUCT_LINK_TYPES,
  PRODUCT_METAL_VARIANTS,
  normalizeProductJewelryType,
  parseLengthInches,
  productSupportsLinkType,
} from '@/types/product';

type Marketplace = 'etsy' | 'ebay';

interface PreflightCheck {
  check: string;
  ok: boolean;
  message?: string;
}

interface ReviewPreview {
  eligible: boolean;
  preflight: PreflightCheck[];
  payload: {
    title: string;
    price: number | null;
    priceBeforeMarkup: number | null;
    quantity: number;
    images: unknown[];
    tags?: string[];
    materials?: string[];
    taxonomyId?: number | null;
    taxonomyPath?: string | null;
    taxonomyIsOverride?: boolean;
    whenMade?: string;
    whenMadeUsedFallback?: boolean;
    categoryPath?: string | null;
    categoryIsApproximate?: boolean;
    conditionDescription?: string;
    aspects?: Record<string, string[]>;
    shippingTier?: 'standard' | 'express' | 'tiered';
  };
  productType?: string | null;
  structuredProperties?: { length: string | null; ringSize: string | null };
  listing?: {
    syncState: string;
    etsyListingId?: number | null;
    ebayListingId?: string | null;
    ebayOfferId?: string | null;
    lastError?: string | null;
  } | null;
  extraTags?: string[];
  productFields?: ReviewProductFields;
  priceMarkupPct?: number;
}

interface SyncStepResult {
  done: boolean;
  syncState: string;
  progress?: { step: string; uploaded?: number; total?: number };
  warnings?: string[];
  error?: { code?: string; message?: string } | string;
}

interface Props {
  marketplace: Marketplace;
  productIds: string[];
  onBack: () => void;
  onClose: (completed?: boolean) => void;
  /** A field was saved to the product from the review window — lets the admin table merge it without a reload. */
  onProductEdited?: (productId: string, patch: ProductFieldEditPatch) => void;
}

/**
 * Which inline editor a row opens. `metal` is the Etsy Materials row: metal
 * colour and purity together, since the mapped materials come from both.
 */
type EditorKey = EditableProductField | 'metal';

const iconStyle = {
  lineHeight: 1,
};

function responseError(data: unknown, fallback: string): string {
  if (data && typeof data === 'object' && 'error' in data) {
    const error = (data as { error?: unknown }).error;
    if (typeof error === 'string' && error) return error;
    if (error && typeof error === 'object' && 'message' in error) {
      const message = (error as { message?: unknown }).message;
      if (typeof message === 'string' && message) return message;
    }
  }
  return fallback;
}

function checkLabel(value: string): string {
  const spaced = value.replace(/[_-]+/g, ' ').trim();
  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : 'Check';
}

function syncMode(marketplace: Marketplace, preview: ReviewPreview): 'publish' | 'update' {
  if (marketplace === 'etsy') {
    return preview.listing?.etsyListingId ? 'update' : 'publish';
  }
  const state = preview.listing?.syncState;
  return state && ['review', 'published', 'out_of_date', 'hidden_oos'].includes(state)
    ? 'update'
    : 'publish';
}

function mergeWarnings(current: string[], incoming: string[] | undefined): string[] {
  return Array.from(new Set([...current, ...(incoming ?? [])]));
}

/** The listing editor's own label for the `length` column, by product type. */
function lengthLabel(productType: string | null | undefined): string {
  const normalized = normalizeProductJewelryType(productType);
  if (normalized === 'Ring') return 'Ring size';
  if (normalized === 'Necklace' || normalized === 'Bracelet') return 'Length';
  return 'Height';
}

/** Display text for the stored length, in the words the product page uses. */
function lengthDisplay(raw: string | null | undefined, productType: string | null | undefined): string {
  const value = raw?.trim();
  if (!value) return '—';
  if (normalizeProductJewelryType(productType) === 'Ring') return `Size ${value.replace(/^size:\s*/i, '')}`;
  const inches = parseLengthInches(value);
  return inches != null ? `${inches} in` : value;
}

/** eBay aspect name → the product field that feeds it (fixed aspects have none). */
const EBAY_ASPECT_FIELD: Record<string, EditorKey | null> = {
  Metal: 'metal_variant',
  'Metal Purity': 'purity',
  Type: 'product_type',
  Brand: 'brand',
  'Year Manufactured': 'item_year',
  'Item Weight': 'weight_grams',
  'Main Stone': 'stone_details',
  Style: null,
  'Chain Type': 'chain_type',
  'Chain Length': 'length',
  'Ring Size': 'length',
};

const FIELD_LABEL: Record<EditorKey, string> = {
  quantity: 'Quantity',
  length: 'Length',
  brand: 'Brand',
  item_year: 'Year',
  weight_grams: 'Weight',
  stone_details: 'Main stone',
  chain_type: 'Chain type',
  purity: 'Purity',
  metal_variant: 'Metal',
  product_type: 'Type',
  metal: 'Metal & purity',
};

export default function SelectedMarketplaceReviewFlow({ marketplace, productIds, onBack, onClose, onProductEdited }: Props) {
  const [index, setIndex] = useState(0);
  const [completed, setCompleted] = useState(0);
  const [skipped, setSkipped] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [previewState, setPreviewState] = useState<{ productId: string; data: ReviewPreview } | null>(null);
  const [loadErrorState, setLoadErrorState] = useState<{ productId: string; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [progress, setProgress] = useState<SyncStepResult['progress'] | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [lastOutcome, setLastOutcome] = useState<{ title: string; warnings: string[] } | null>(null);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [taxonomyLeaves, setTaxonomyLeaves] = useState<EtsyCategoryLeaf[] | null>(null);
  const [loadingTaxonomy, setLoadingTaxonomy] = useState(false);
  const [savingCategory, setSavingCategory] = useState(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  // One inline editor at a time. `draft` holds the text of every input the
  // editor shows (the Materials editor has two).
  const [editor, setEditor] = useState<{ key: EditorKey; draft: Record<string, string> } | null>(null);
  const [savingField, setSavingField] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  // "Length saved · preflight refreshed" — one notice slot shared by every
  // save in the window (fields, category, tags), replaced by the next one.
  const [notice, setNotice] = useState<string | null>(null);
  // Etsy "additional tags": null = show the saved value, a string = an edit in progress.
  const [extraTagsInput, setExtraTagsInput] = useState<string | null>(null);
  const [savingTags, setSavingTags] = useState(false);

  const currentProductId = productIds[index] ?? null;
  const name = marketplace === 'etsy' ? 'Etsy' : 'eBay';
  const preview = previewState?.productId === currentProductId ? previewState.data : null;
  const loadError = loadErrorState?.productId === currentProductId ? loadErrorState.message : null;
  const finished = currentProductId === null;
  const busy = submitting || savingCategory || savingField || savingTags;

  useEffect(() => {
    if (!currentProductId) return;
    let cancelled = false;

    async function loadPreview() {
      try {
        const response = await fetch(`/api/admin/${marketplace}/preview`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ productId: currentProductId }),
        });
        const data = await response.json().catch(() => null);
        if (!response.ok || !data) {
          throw new Error(responseError(data, `Could not load the ${name} preflight.`));
        }
        if (!cancelled) {
          setPreviewState({ productId: currentProductId, data: data as ReviewPreview });
          setLoadErrorState(null);
        }
      } catch (caught) {
        if (!cancelled) {
          setLoadErrorState({
            productId: currentProductId,
            message: caught instanceof Error ? caught.message : `Could not load the ${name} preflight.`,
          });
        }
      }
    }

    void loadPreview();
    return () => {
      cancelled = true;
    };
  }, [attempt, currentProductId, marketplace, name]);

  function resetItemState() {
    setSubmitError(null);
    setProgress(null);
    setWarnings([]);
    setCategoryPickerOpen(false);
    setCategoryError(null);
    setEditor(null);
    setFieldError(null);
    setNotice(null);
    setExtraTagsInput(null);
  }

  function advance(skippedItem: boolean) {
    if (skippedItem) setSkipped((current) => current + 1);
    else setCompleted((current) => current + 1);
    resetItemState();
    setIndex((current) => current + 1);
  }

  /** Re-run the preflight for the current item (after a save, or on demand). */
  function reloadPreview() {
    setPreviewState(null);
    setLoadErrorState(null);
    setAttempt((current) => current + 1);
  }

  function retryPreview() {
    setNotice(null);
    reloadPreview();
  }

  async function openCategoryPicker() {
    if (marketplace !== 'etsy' || !preview) return;
    setEditor(null);
    setCategoryPickerOpen(true);
    setCategoryError(null);
    if (taxonomyLeaves || loadingTaxonomy) return;

    setLoadingTaxonomy(true);
    try {
      const response = await fetch('/api/admin/etsy/taxonomy');
      const data = (await response.json().catch(() => null)) as { leaves?: EtsyCategoryLeaf[] } | null;
      if (!response.ok || !Array.isArray(data?.leaves)) {
        throw new Error(responseError(data, 'Could not load Etsy categories.'));
      }
      setTaxonomyLeaves(data.leaves);
    } catch (caught) {
      setCategoryError(caught instanceof Error ? caught.message : 'Could not load Etsy categories.');
    } finally {
      setLoadingTaxonomy(false);
    }
  }

  async function saveCategory(taxonomyId: number | null, taxonomyPath: string | null) {
    if (marketplace !== 'etsy' || !currentProductId || busy) return;
    setSavingCategory(true);
    setCategoryError(null);
    try {
      const response = await fetch('/api/admin/etsy/category', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ productId: currentProductId, taxonomyId, taxonomyPath }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(responseError(data, 'Could not save the Etsy category.'));

      setCategoryPickerOpen(false);
      setNotice(taxonomyId ? 'Category saved · preflight refreshed.' : 'Automatic category restored · preflight refreshed.');
      reloadPreview();
    } catch (caught) {
      setCategoryError(caught instanceof Error ? caught.message : 'Could not save the Etsy category.');
    } finally {
      setSavingCategory(false);
    }
  }

  function openEditor(key: EditorKey) {
    const fields = preview?.productFields;
    if (!fields || busy) return;
    setCategoryPickerOpen(false);
    setFieldError(null);
    const text = (value: string | number | null | undefined) => (value == null ? '' : String(value));
    const draft: Record<string, string> =
      key === 'metal'
        ? { metal_variant: text(fields.metal_variant), purity: text(fields.purity) }
        : { [key]: text(fields[key]) };
    setEditor({ key, draft });
  }

  function setDraft(field: string, value: string) {
    setEditor((current) => (current ? { ...current, draft: { ...current.draft, [field]: value } } : current));
  }

  /** Write the edited field(s) to the product, then re-run the preflight. */
  async function saveEditor() {
    if (!editor || !currentProductId || busy) return;
    const fields: Record<string, string | null> = {};
    for (const [field, value] of Object.entries(editor.draft)) {
      fields[field] = value.trim() === '' ? null : value.trim();
    }
    setSavingField(true);
    setFieldError(null);
    try {
      const response = await fetch('/api/admin/products/fields', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ productId: currentProductId, fields }),
      });
      const data = (await response.json().catch(() => null)) as { patch?: ProductFieldEditPatch } | null;
      if (!response.ok) throw new Error(responseError(data, 'Could not save that change.'));
      if (data?.patch) onProductEdited?.(currentProductId, data.patch);
      setNotice(`${FIELD_LABEL[editor.key]} saved · preflight refreshed.`);
      setEditor(null);
      reloadPreview();
    } catch (caught) {
      setFieldError(caught instanceof Error ? caught.message : 'Could not save that change.');
    } finally {
      setSavingField(false);
    }
  }

  async function saveTags() {
    if (marketplace !== 'etsy' || !currentProductId || extraTagsInput === null || busy) return;
    const tags = extraTagsInput.split(',').map((tag) => tag.trim()).filter(Boolean);
    setSavingTags(true);
    setFieldError(null);
    try {
      const response = await fetch('/api/admin/etsy/tags', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ productId: currentProductId, tags }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(responseError(data, 'Could not save the tags.'));
      setExtraTagsInput(null);
      setNotice('Tags saved · preflight refreshed.');
      reloadPreview();
    } catch (caught) {
      setFieldError(caught instanceof Error ? caught.message : 'Could not save the tags.');
    } finally {
      setSavingTags(false);
    }
  }

  async function submitCurrent() {
    if (!currentProductId || !preview || !preview.eligible || busy) return;
    setSubmitting(true);
    setSubmitError(null);
    setWarnings([]);
    setProgress(null);
    const mode = syncMode(marketplace, preview);
    let lastSignature: string | null = null;
    let repeated = 0;
    let collectedWarnings: string[] = [];

    try {
      for (;;) {
        const response = await fetch(`/api/admin/${marketplace}/sync`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ productId: currentProductId, mode }),
        });
        const data = (await response.json().catch(() => null)) as SyncStepResult | null;
        if (!response.ok || !data) {
          throw new Error(responseError(data, `Could not submit this item to ${name}.`));
        }
        if (data.error) {
          throw new Error(typeof data.error === 'string' ? data.error : (data.error.message ?? `Could not submit this item to ${name}.`));
        }
        if (data.warnings?.length) {
          collectedWarnings = mergeWarnings(collectedWarnings, data.warnings);
          setWarnings(collectedWarnings);
        }
        if (data.progress) setProgress(data.progress);
        if (data.done) {
          setLastOutcome({ title: preview.payload.title, warnings: collectedWarnings });
          advance(false);
          break;
        }

        const signature = JSON.stringify(data.progress ?? data.syncState);
        repeated = signature === lastSignature ? repeated + 1 : 0;
        lastSignature = signature;
        if (repeated >= 5) {
          throw new Error(`This item stopped progressing on ${name}. Review it individually before retrying.`);
        }
      }
    } catch (caught) {
      setSubmitError(caught instanceof Error ? caught.message : `Could not submit this item to ${name}.`);
    } finally {
      setSubmitting(false);
    }
  }

  const mode = preview ? syncMode(marketplace, preview) : 'publish';
  const submitLabel = mode === 'update' ? `Submit ${name} updates` : `Submit to ${name}`;
  const fields = preview?.productFields ?? null;
  const productType = fields?.product_type ?? preview?.productType ?? null;
  const editorKey = editor?.key ?? null;

  // ---- inline editor pieces ------------------------------------------------

  function pencil(key: EditorKey, label: string) {
    if (!fields) return null;
    return (
      <button
        type="button"
        onClick={() => openEditor(key)}
        disabled={busy || editorKey === key}
        className="inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border transition-colors hover:bg-white disabled:opacity-40"
        style={{ borderColor: 'color-mix(in srgb, var(--color-primary) 45%, transparent)', color: 'var(--color-primary)', background: 'rgba(255,255,255,0.8)' }}
        aria-label={`Edit ${label}`}
        title={`Edit ${label}`}
      >
        <AppIcon name="edit" style={{ ...iconStyle, fontSize: '12px', width: 12, height: 12 }} aria-hidden="true" />
      </button>
    );
  }

  function editorActions() {
    return (
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" onClick={() => { setEditor(null); setFieldError(null); }} disabled={savingField} className="outline-button text-xs">
          Cancel
        </button>
        <button type="button" onClick={() => void saveEditor()} disabled={savingField} className="gold-button text-xs">
          {savingField ? 'Saving…' : 'Save'}
        </button>
      </div>
    );
  }

  function editorBox(children: ReactNode) {
    return (
      <div
        className="mt-1 flex flex-col gap-2 border p-3"
        style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') { setEditor(null); setFieldError(null); }
          if (event.key === 'Enter' && (event.target as HTMLElement).tagName === 'INPUT') { event.preventDefault(); void saveEditor(); }
        }}
      >
        {children}
        {fieldError && (
          <p className="text-xs" role="alert" style={{ color: 'var(--color-error)' }}>{fieldError}</p>
        )}
        {editorActions()}
      </div>
    );
  }

  /** The editor for `key`, or null when a different row is being edited. */
  function inlineEditor(key: EditorKey) {
    if (!editor || editor.key !== key || !fields) return null;
    const draft = editor.draft;
    const isSilver = fields.category === 'Silver';
    const purityInput = (
      <input
        type="number"
        className="form-field w-32"
        value={draft.purity ?? ''}
        onChange={(event) => setDraft('purity', event.target.value)}
        placeholder={isSilver ? '925' : '14'}
        min={isSilver ? 100 : 1}
        max={isSilver ? 1000 : 24}
        aria-label={isSilver ? 'Purity, parts per thousand' : 'Purity, karats'}
        autoFocus={key === 'purity'}
      />
    );
    const metalSelect = (
      <select
        className="form-field"
        value={draft.metal_variant ?? ''}
        onChange={(event) => setDraft('metal_variant', event.target.value)}
        aria-label="Metal"
        autoFocus={key === 'metal_variant' || key === 'metal'}
      >
        <option value="">Choose…</option>
        {PRODUCT_METAL_VARIANTS[isSilver ? 'Silver' : 'Gold'].map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    );

    switch (key) {
      case 'quantity':
        return editorBox(
          <input type="number" className="form-field w-28" min={0} max={999} step={1} value={draft.quantity ?? ''} onChange={(event) => setDraft('quantity', event.target.value)} aria-label="Quantity" autoFocus />,
        );
      case 'length': {
        const isRing = normalizeProductJewelryType(productType) === 'Ring';
        const inches = isRing ? null : parseLengthInches(draft.length ?? '');
        return editorBox(
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              className="form-field w-36"
              value={draft.length ?? ''}
              onChange={(event) => setDraft('length', event.target.value)}
              placeholder={isRing ? 'e.g. 7, 6.5' : 'e.g. 18.5, 470 mm, 47 cm'}
              aria-label={lengthLabel(productType)}
              autoFocus
            />
            {!isRing && (
              <span className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                {inches != null ? <>= <strong style={{ color: 'var(--color-on-surface)' }}>{inches} in</strong> · stored in inches; Etsy and eBay push inches</> : 'Inches unless you add mm or cm'}
              </span>
            )}
          </div>,
        );
      }
      case 'brand':
        return editorBox(
          <div className="flex flex-wrap items-center gap-2">
            <input type="text" className="form-field w-56" value={draft.brand ?? ''} onChange={(event) => setDraft('brand', event.target.value)} placeholder="Maker or brand" aria-label="Brand" autoFocus />
            {marketplace === 'ebay' && <span className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>Blank = &quot;Unbranded&quot; on eBay</span>}
          </div>,
        );
      case 'item_year':
        return editorBox(
          <div className="flex flex-wrap items-center gap-2">
            <input type="number" className="form-field w-28" min={1} max={2200} value={draft.item_year ?? ''} onChange={(event) => setDraft('item_year', event.target.value)} placeholder="1925" aria-label="Year made" autoFocus />
            <span className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>The year the piece was made · blank to clear</span>
          </div>,
        );
      case 'weight_grams':
        return editorBox(
          <div className="flex flex-wrap items-center gap-2">
            <input type="number" className="form-field w-32" step="0.01" min={0} value={draft.weight_grams ?? ''} onChange={(event) => setDraft('weight_grams', event.target.value)} placeholder="13.85" aria-label="Weight in grams" autoFocus />
            <span className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>grams</span>
          </div>,
        );
      case 'stone_details':
        return editorBox(
          <div className="flex flex-wrap items-center gap-2">
            <input type="text" className="form-field w-64" value={draft.stone_details ?? ''} onChange={(event) => setDraft('stone_details', event.target.value)} placeholder="e.g. Diamond, 0.25 ct" aria-label="Main stone" autoFocus />
            <span className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>Blank = &quot;No Stone&quot;</span>
          </div>,
        );
      case 'chain_type':
        return editorBox(
          <div className="w-64">
            <ComboboxInput value={draft.chain_type ?? ''} onChange={(value) => setDraft('chain_type', value)} options={[...PRODUCT_LINK_TYPES]} placeholder="e.g. Cuban link, Bead…" />
          </div>,
        );
      case 'purity':
        return editorBox(
          <div className="flex flex-wrap items-center gap-2">
            {purityInput}
            <span className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>{isSilver ? 'parts per thousand (925 = sterling)' : 'karats'}</span>
          </div>,
        );
      case 'metal_variant':
        return editorBox(metalSelect);
      case 'metal':
        return editorBox(
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>Metal {metalSelect}</label>
            <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>Purity {purityInput}</label>
          </div>,
        );
      case 'product_type':
        return editorBox(
          <div className="flex flex-wrap items-center gap-2">
            <select className="form-field" value={draft.product_type ?? ''} onChange={(event) => setDraft('product_type', event.target.value)} aria-label="Type" autoFocus>
              <option value="">Choose…</option>
              {PRODUCT_JEWELRY_TYPES.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <span className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>Also moves the {name} category</span>
          </div>,
        );
      default:
        return null;
    }
  }

  function derivedNote(text: string) {
    return <span className="mt-0.5 block text-[0.7rem] italic opacity-75">{text}</span>;
  }

  function priceNote() {
    if (!preview) return null;
    const base = preview.payload.priceBeforeMarkup;
    const pct = preview.priceMarkupPct;
    if (base == null || pct == null) return derivedNote('Change the price in the listing editor');
    return derivedNote(`Site price $${base.toFixed(2)} + ${pct}% ${name} markup · change the price in the listing editor`);
  }

  // The stored-value rows, shared by both marketplaces where they apply.
  function valueRow(key: EditorKey, label: string, display: string, note?: string) {
    return (
      <div>
        <dt className="form-label flex items-center gap-2">{label}</dt>
        <dd>
          <span className="inline-flex flex-wrap items-center gap-2">
            <span>{display}</span>
            {pencil(key, label)}
          </span>
          {note && derivedNote(note)}
          {inlineEditor(key)}
        </dd>
      </div>
    );
  }

  /** eBay aspects, one line each, with a pencil where a product field feeds the value. */
  function aspectList() {
    const aspects = preview?.payload.aspects ?? {};
    const rows: { label: string; value: string; key: EditorKey | null; fixed?: boolean }[] = [];
    for (const [label, values] of Object.entries(aspects)) {
      const key = Object.prototype.hasOwnProperty.call(EBAY_ASPECT_FIELD, label) ? EBAY_ASPECT_FIELD[label] : null;
      rows.push({ label, value: values.join(', '), key, fixed: label === 'Style' });
    }
    // Rows the mapper skipped because the field is empty — still worth a pencil.
    const present = new Set(rows.map((row) => row.label));
    const supportsChain = productSupportsLinkType(productType);
    const isRing = normalizeProductJewelryType(productType) === 'Ring';
    if (fields) {
      if (!present.has('Year Manufactured')) rows.push({ label: 'Year Manufactured', value: '—', key: 'item_year' });
      if (!present.has('Item Weight')) rows.push({ label: 'Item Weight', value: '—', key: 'weight_grams' });
      if (supportsChain && !present.has('Chain Type')) rows.push({ label: 'Chain Type', value: '—', key: 'chain_type' });
      const lengthAspect = isRing ? 'Ring Size' : 'Chain Length';
      if (!present.has('Ring Size') && !present.has('Chain Length') && productType && productType !== 'Other') {
        rows.push({ label: lengthAspect, value: '—', key: 'length' });
      }
    }
    if (rows.length === 0) return <dd>-</dd>;
    return (
      <dd>
        <ul className="m-0 grid list-none gap-x-5 gap-y-1.5 p-0 sm:grid-cols-2">
          {rows.map((row) => (
            <li key={row.label} className={editorKey && row.key === editorKey ? 'sm:col-span-2' : undefined}>
              <span className="inline-flex flex-wrap items-center gap-2">
                <span>{row.label}</span>
                <span className="font-semibold" style={{ color: row.fixed ? 'var(--color-on-surface-variant)' : 'var(--color-on-surface)' }}>{row.value}</span>
                {row.key ? pencil(row.key, row.label) : row.fixed ? <span className="text-[0.65rem] italic opacity-75">fixed</span> : null}
              </span>
              {row.key ? inlineEditor(row.key) : null}
            </li>
          ))}
        </ul>
      </dd>
    );
  }

  const savedExtraTags = (preview?.extraTags ?? []).join(', ');
  const extraTagsValue = extraTagsInput ?? savedExtraTags;
  const extraTagsDirty = extraTagsInput !== null && extraTagsInput.trim() !== savedExtraTags.trim();
  const extraTagSet = new Set((preview?.extraTags ?? []).map((tag) => tag.toLowerCase()));

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto whitespace-normal p-4 sm:items-center"
      style={{ background: 'rgba(0,0,0,0.52)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="selected-review-title"
    >
      <div
        className="flex min-w-0 w-full max-w-2xl max-h-[calc(100svh-2rem)] flex-col overflow-hidden border shadow-2xl [overflow-wrap:anywhere]"
        style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-background)' }}
      >
        <div className="flex items-start justify-between gap-4 border-b p-5 md:p-6" style={{ borderColor: 'var(--color-outline-variant)' }}>
          <div>
            <p className="text-[0.65rem] font-bold uppercase tracking-widest" style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}>
              {finished ? 'Review complete' : `Item ${index + 1} of ${productIds.length}`}
            </p>
            <h2 id="selected-review-title" className="mt-1 text-2xl font-bold" style={{ color: 'var(--color-on-surface)', fontFamily: 'var(--font-headline)' }}>
              {finished ? `${name} review finished` : `Review before submitting to ${name}`}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onClose(false)}
            disabled={busy}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-black/5 disabled:opacity-50"
            aria-label="Close review"
            title="Close"
          >
            <AppIcon name="close"  style={iconStyle} aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5 md:p-6">
          {lastOutcome && (
            <div
              className="mb-5 border p-3 text-sm"
              role="status"
              style={{
                borderColor: lastOutcome.warnings.length > 0 ? 'rgba(138, 100, 0, 0.34)' : 'color-mix(in srgb, var(--color-primary) 30%, transparent)',
                color: lastOutcome.warnings.length > 0 ? '#8a6400' : 'var(--color-primary)',
                background: lastOutcome.warnings.length > 0 ? 'rgba(181, 137, 12, 0.08)' : 'color-mix(in srgb, var(--color-primary) 8%, transparent)',
              }}
            >
              <p className="font-bold">{lastOutcome.title} submitted.</p>
              {lastOutcome.warnings.map((warning, warningIndex) => (
                <p key={`${warningIndex}:${warning}`} className="mt-1 text-xs">{warning}</p>
              ))}
            </div>
          )}
          {finished ? (
            <div>
              <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
                Finished reviewing all {productIds.length} selected products for {name}.
              </p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="border p-4" style={{ borderColor: 'var(--color-outline-variant)' }}>
                  <p className="text-2xl font-bold" style={{ fontFamily: 'var(--font-headline)' }}>{completed}</p>
                  <p className="form-label">Submitted</p>
                </div>
                <div className="border p-4" style={{ borderColor: 'var(--color-outline-variant)' }}>
                  <p className="text-2xl font-bold" style={{ fontFamily: 'var(--font-headline)' }}>{skipped}</p>
                  <p className="form-label">Skipped</p>
                </div>
              </div>
            </div>
          ) : !preview && !loadError ? (
            <div className="flex items-center gap-3 py-8" role="status" aria-live="polite">
              <AppIcon name="sync" className="animate-spin" style={{ ...iconStyle, color: 'var(--color-primary)' }} aria-hidden="true" />
              <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>Loading preflight...</p>
            </div>
          ) : loadError ? (
            <div className="border p-4 text-sm" style={{ borderColor: 'color-mix(in srgb, var(--color-error) 35%, transparent)', color: 'var(--color-error)', background: 'color-mix(in srgb, var(--color-error) 8%, transparent)' }}>
              {loadError}
            </div>
          ) : preview ? (
            <div className="flex flex-col gap-5">
              <div>
                <h3 className="text-xl font-bold" style={{ color: 'var(--color-on-surface)', fontFamily: 'var(--font-headline)' }}>
                  {preview.payload.title}
                </h3>
                <p className="mt-1 text-xs font-bold uppercase tracking-widest" style={{ color: preview.eligible ? 'var(--color-primary)' : 'var(--color-error)', fontFamily: 'var(--font-label)' }}>
                  {preview.eligible ? 'Ready to submit' : 'Preflight needs attention'}
                </p>
              </div>

              <div>
                <p className="form-label mb-2">Preflight</p>
                <ul className="flex flex-col gap-2">
                  {preview.preflight.map((check) => (
                    <li
                      key={check.check}
                      className="flex items-start gap-2 text-xs"
                      style={{ color: !check.ok ? 'var(--color-error)' : check.message ? '#8a6400' : 'var(--color-on-surface-variant)' }}
                    >
                      <AppIcon name={!check.ok ? 'error' : check.message ? 'warning' : 'check'} className="shrink-0" style={{ ...iconStyle, fontSize: '16px' }} aria-hidden="true" />
                      <span>{check.message ?? checkLabel(check.check)}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {notice && (
                <p
                  className="border p-3 text-xs"
                  role="status"
                  aria-live="polite"
                  style={{ borderColor: 'color-mix(in srgb, var(--color-primary) 30%, transparent)', color: 'var(--color-primary)', background: 'color-mix(in srgb, var(--color-primary) 8%, transparent)' }}
                >
                  {notice}
                </p>
              )}

              <dl className="grid gap-x-5 gap-y-3 border-y py-4 text-xs sm:grid-cols-2" style={{ borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface-variant)' }}>
                <div>
                  <dt className="form-label">Price</dt>
                  <dd>
                    {preview.payload.price != null ? `$${preview.payload.price.toFixed(2)}` : '-'}
                    {priceNote()}
                  </dd>
                </div>
                {valueRow('quantity', 'Quantity', String(preview.payload.quantity))}

                <div className="sm:col-span-2">
                  <dt className="form-label">Category</dt>
                  <dd>
                    <span className="inline-flex flex-wrap items-center gap-2">
                      <span>{preview.payload.taxonomyPath ?? preview.payload.categoryPath ?? '-'}</span>
                      {marketplace === 'etsy' && preview.payload.taxonomyIsOverride && (
                        <span className="text-[0.65rem] font-bold uppercase tracking-wide" style={{ color: 'var(--color-primary)' }}>
                          Manually selected
                        </span>
                      )}
                      {marketplace === 'etsy' && !categoryPickerOpen && (
                        <button
                          type="button"
                          onClick={() => void openCategoryPicker()}
                          disabled={busy}
                          className="inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border transition-colors hover:bg-white disabled:opacity-40"
                          style={{ borderColor: 'color-mix(in srgb, var(--color-primary) 45%, transparent)', color: 'var(--color-primary)', background: 'rgba(255,255,255,0.8)' }}
                          aria-label="Change Etsy category"
                          title="Change Etsy category"
                        >
                          <AppIcon name="edit" style={{ ...iconStyle, width: 12, height: 12 }} aria-hidden="true" />
                        </button>
                      )}
                      {marketplace === 'etsy' && !categoryPickerOpen && preview.payload.taxonomyIsOverride && (
                        <button type="button" onClick={() => void saveCategory(null, null)} disabled={busy} className="outline-button text-xs">
                          {savingCategory ? 'Saving…' : 'Reset to automatic'}
                        </button>
                      )}
                    </span>
                    {marketplace === 'ebay' && derivedNote('Pinned from Type and metal · change Type below to move it')}
                    {marketplace === 'etsy' && categoryPickerOpen && loadingTaxonomy && (
                      <p role="status" className="mt-2 text-xs">Loading Etsy categories…</p>
                    )}
                    {marketplace === 'etsy' && categoryPickerOpen && taxonomyLeaves && (
                      <EtsyCategoryDropdown
                        leaves={taxonomyLeaves}
                        selectedPath={preview.payload.taxonomyPath ?? null}
                        onSelect={(leaf) => void saveCategory(leaf.id, leaf.path)}
                        onCancel={() => setCategoryPickerOpen(false)}
                        disabled={savingCategory}
                      />
                    )}
                    {marketplace === 'etsy' && categoryError && (
                      <p className="mt-2 text-xs" role="alert" style={{ color: 'var(--color-error)' }}>{categoryError}</p>
                    )}
                  </dd>
                </div>

                <div>
                  <dt className="form-label">Photos</dt>
                  <dd>{preview.payload.images.length}{derivedNote('Managed in the listing editor')}</dd>
                </div>

                {marketplace === 'etsy' ? (
                  <>
                    {valueRow(
                      'item_year',
                      'When made',
                      preview.payload.whenMade ?? '-',
                      fields?.item_year ? `From the item year (${fields.item_year})` : 'No item year set — Etsy gets the vintage fallback',
                    )}
                    {valueRow('metal', 'Materials', preview.payload.materials?.join(', ') || '-', 'From metal and purity')}
                    {productType && productType !== 'Other' && (
                      valueRow(
                        'length',
                        lengthLabel(productType),
                        normalizeProductJewelryType(productType) === 'Ring'
                          ? (preview.structuredProperties?.ringSize ?? lengthDisplay(fields?.length, productType))
                          : (preview.structuredProperties?.length ?? lengthDisplay(fields?.length, productType)),
                      )
                    )}
                    <div className="sm:col-span-2">
                      <dt className="form-label">Tags</dt>
                      <dd>
                        <div className="flex flex-wrap gap-1.5">
                          {(preview.payload.tags ?? []).map((tag) => {
                            const own = extraTagSet.has(tag.toLowerCase());
                            return (
                              <span
                                key={tag}
                                className="rounded-full border px-2 py-0.5 text-[0.72rem]"
                                style={{ borderColor: own ? 'var(--color-primary)' : 'var(--color-outline-variant)', color: own ? 'var(--color-primary)' : undefined, background: 'white' }}
                              >
                                {tag}
                              </span>
                            );
                          })}
                          {(preview.payload.tags ?? []).length === 0 && <span>-</span>}
                        </div>
                        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                          <input
                            type="text"
                            value={extraTagsValue}
                            onChange={(event) => setExtraTagsInput(event.target.value)}
                            placeholder="Additional tags, comma-separated — they go first in the 13"
                            className="form-field flex-1"
                            disabled={busy}
                            aria-label="Additional Etsy tags"
                          />
                          <button type="button" onClick={() => void saveTags()} disabled={busy || !extraTagsDirty} className="gold-button text-xs disabled:opacity-50">
                            {savingTags ? 'Saving…' : 'Save tags'}
                          </button>
                        </div>
                        {derivedNote('Gold-outlined tags are yours; the rest are generated from the listing')}
                        {fieldError && !editor && (
                          <p className="mt-1 text-xs" role="alert" style={{ color: 'var(--color-error)' }}>{fieldError}</p>
                        )}
                      </dd>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <dt className="form-label">Condition</dt>
                      <dd>{preview.payload.conditionDescription ?? '-'}{derivedNote('One sentence for every listing, not per item')}</dd>
                    </div>
                    <div>
                      <dt className="form-label">Shipping</dt>
                      <dd>{preview.payload.shippingTier ?? '-'}{derivedNote('Insured tier chosen by price')}</dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="form-label">Aspects</dt>
                      {aspectList()}
                    </div>
                  </>
                )}
              </dl>

              {progress && (
                <p className="text-xs" role="status" aria-live="polite" style={{ color: 'var(--color-on-surface-variant)' }}>
                  {progress.step === 'images'
                    ? `Uploading image ${progress.uploaded ?? 0} of ${progress.total ?? '?'}...`
                    : `Working on ${progress.step}...`}
                </p>
              )}
              {warnings.length > 0 && (
                <ul className="flex flex-col gap-1 text-xs" style={{ color: '#8a6400' }}>
                  {warnings.map((warning, warningIndex) => (
                    <li key={`${warningIndex}:${warning}`}>{warning}</li>
                  ))}
                </ul>
              )}
              {submitError && (
                <div className="border p-3 text-sm" style={{ borderColor: 'color-mix(in srgb, var(--color-error) 35%, transparent)', color: 'var(--color-error)', background: 'color-mix(in srgb, var(--color-error) 8%, transparent)' }}>
                  {submitError}
                </div>
              )}
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t p-4 md:px-6" style={{ borderColor: 'var(--color-outline-variant)' }}>
          {finished ? (
            <button type="button" onClick={() => onClose(true)} className="gold-button text-sm">
              Done
            </button>
          ) : (
            <>
              {completed === 0 && skipped === 0 && (
                <button type="button" onClick={onBack} disabled={busy} className="outline-button text-sm">
                  Back
                </button>
              )}
              {loadError && (
                <button type="button" onClick={retryPreview} className="outline-button text-sm">
                  Try again
                </button>
              )}
              {(preview || loadError) && (
                <button type="button" onClick={() => advance(true)} disabled={busy} className="outline-button text-sm">
                  Skip item
                </button>
              )}
              {preview && (
                <>
                  <button type="button" onClick={retryPreview} disabled={busy} className="outline-button text-sm">
                    Refresh preflight
                  </button>
                  <button
                    type="button"
                    onClick={() => void submitCurrent()}
                    disabled={!preview.eligible || busy}
                    aria-busy={submitting}
                    className="gold-button text-sm disabled:opacity-50"
                  >
                    {submitting ? 'Submitting...' : submitLabel}
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
