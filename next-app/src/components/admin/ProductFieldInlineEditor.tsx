'use client';

import { useState, type ReactNode } from 'react';
import ComboboxInput from './ComboboxInput';
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

/**
 * The pencil + inline editor for product-backed preflight rows, shared by
 * every Etsy/eBay preflight surface: the "Review before submitting" window
 * (`SelectedMarketplaceReviewFlow`) and the Etsy/eBay panels in the listing
 * editor drawer and on the Manage Etsy/eBay pages (`EtsyProductPanel`,
 * `EbayProductPanel`). Every save goes through `PUT /api/admin/products/fields`
 * — the one write path (DECISIONS.md → "Review-window edits write to the
 * product") — and the host re-runs its preflight in `onSaved`.
 */

export type FieldEditorMarketplace = 'etsy' | 'ebay';

/**
 * Which inline editor a row opens. `metal` is the Etsy Materials row: metal
 * colour and purity together, since the mapped materials come from both.
 */
export type EditorKey = EditableProductField | 'metal';

export const FIELD_LABEL: Record<EditorKey, string> = {
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

/** eBay aspect name → the product field that feeds it (fixed aspects have none). */
export const EBAY_ASPECT_FIELD: Record<string, EditorKey | null> = {
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

/** The listing editor's own label for the `length` column, by product type. */
export function lengthLabel(productType: string | null | undefined): string {
  const normalized = normalizeProductJewelryType(productType);
  if (normalized === 'Ring') return 'Ring size';
  if (normalized === 'Necklace' || normalized === 'Bracelet') return 'Length';
  return 'Height';
}

/** Display text for the stored length, in the words the product page uses. */
export function lengthDisplay(raw: string | null | undefined, productType: string | null | undefined): string {
  const value = raw?.trim();
  if (!value) return '—';
  if (normalizeProductJewelryType(productType) === 'Ring') return `Size ${value.replace(/^size:\s*/i, '')}`;
  const inches = parseLengthInches(value);
  return inches != null ? `${inches} in` : value;
}

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

/** The small round gold pencil used on every editable preflight row. `label` is the full accessible name. */
export function PencilButton({ label, onClick, disabled = false }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border transition-colors hover:bg-white disabled:opacity-40"
      style={{ borderColor: 'color-mix(in srgb, var(--color-primary) 45%, transparent)', color: 'var(--color-primary)', background: 'rgba(255,255,255,0.8)' }}
      aria-label={label}
      title={label}
    >
      <AppIcon name="edit" style={{ ...iconStyle, fontSize: '12px', width: 12, height: 12 }} aria-hidden="true" />
    </button>
  );
}

interface FieldEditorOptions {
  marketplace: FieldEditorMarketplace;
  /** The product the rows describe; an open editor hides itself when this changes. */
  productId: string | null;
  /** Stored values from the preview route (`productFields`); no pencils without them. */
  fields: ReviewProductFields | null;
  productType: string | null;
  /** Host work in progress (a sync, another save) — pencils wait for it. */
  disabled?: boolean;
  /** Runs before an editor opens, e.g. to close the host's category picker. */
  onOpen?: () => void;
  /** The product row changed: merge the patch and re-run the preflight. */
  onSaved: (patch: ProductFieldEditPatch, key: EditorKey) => void | Promise<void>;
}

export interface ProductFieldEditor {
  editorKey: EditorKey | null;
  saving: boolean;
  close: () => void;
  pencil: (key: EditorKey, label: string) => ReactNode;
  inlineEditor: (key: EditorKey) => ReactNode;
}

/** One inline editor at a time per host. */
export function useProductFieldEditor({
  marketplace,
  productId,
  fields,
  productType,
  disabled = false,
  onOpen,
  onSaved,
}: FieldEditorOptions): ProductFieldEditor {
  // `draft` holds the text of every input the editor shows (the Materials editor has two).
  const [editor, setEditor] = useState<{ productId: string; key: EditorKey; draft: Record<string, string> } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = editor && editor.productId === productId ? editor : null;
  const editorKey = active?.key ?? null;
  const name = marketplace === 'etsy' ? 'Etsy' : 'eBay';

  function close() {
    setEditor(null);
    setError(null);
  }

  function open(key: EditorKey) {
    if (!fields || !productId || disabled || saving) return;
    onOpen?.();
    setError(null);
    const text = (value: string | number | null | undefined) => (value == null ? '' : String(value));
    const draft: Record<string, string> =
      key === 'metal'
        ? { metal_variant: text(fields.metal_variant), purity: text(fields.purity) }
        : { [key]: text(fields[key]) };
    setEditor({ productId, key, draft });
  }

  function setDraft(field: string, value: string) {
    setEditor((current) => (current ? { ...current, draft: { ...current.draft, [field]: value } } : current));
  }

  /** Write the edited field(s) to the product, then hand the patch to the host. */
  async function save() {
    if (!active || !productId || disabled || saving) return;
    const key = active.key;
    const body: Record<string, string | null> = {};
    for (const [field, value] of Object.entries(active.draft)) {
      body[field] = value.trim() === '' ? null : value.trim();
    }
    setSaving(true);
    setError(null);
    let patch: ProductFieldEditPatch | null = null;
    try {
      const response = await fetch('/api/admin/products/fields', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ productId, fields: body }),
      });
      const data = (await response.json().catch(() => null)) as { patch?: ProductFieldEditPatch } | null;
      if (!response.ok) throw new Error(responseError(data, 'Could not save that change.'));
      patch = data?.patch ?? {};
      setEditor(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save that change.');
    } finally {
      setSaving(false);
    }
    if (patch) await onSaved(patch, key);
  }

  function pencil(key: EditorKey, label: string) {
    if (!fields) return null;
    return <PencilButton label={`Edit ${label}`} onClick={() => open(key)} disabled={disabled || saving || editorKey === key} />;
  }

  function editorBox(children: ReactNode) {
    return (
      <div
        className="mt-1 flex flex-col gap-2 border p-3"
        style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') close();
          if (event.key === 'Enter' && (event.target as HTMLElement).tagName === 'INPUT') { event.preventDefault(); void save(); }
        }}
      >
        {children}
        {error && (
          <p className="text-xs" role="alert" style={{ color: 'var(--color-error)' }}>{error}</p>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={close} disabled={saving} className="outline-button text-xs">
            Cancel
          </button>
          <button type="button" onClick={() => void save()} disabled={saving || disabled} className="gold-button text-xs">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    );
  }

  /** The editor for `key`, or null when a different row (or nothing) is being edited. */
  function inlineEditor(key: EditorKey) {
    if (!active || active.key !== key || !fields) return null;
    const draft = active.draft;
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

  return { editorKey, saving, close, pencil, inlineEditor };
}

/**
 * eBay aspects, one line each, with a pencil where a product field feeds the
 * value — plus the rows the mapper skipped because the field is empty, which
 * are still worth a pencil.
 */
export function EbayAspectRows({
  aspects,
  fields,
  productType,
  editor,
}: {
  aspects: Record<string, string[]>;
  fields: ReviewProductFields | null;
  productType: string | null;
  editor: ProductFieldEditor;
}) {
  const rows: { label: string; value: string; key: EditorKey | null; fixed?: boolean }[] = [];
  for (const [label, values] of Object.entries(aspects)) {
    const key = Object.prototype.hasOwnProperty.call(EBAY_ASPECT_FIELD, label) ? EBAY_ASPECT_FIELD[label] : null;
    rows.push({ label, value: values.join(', '), key, fixed: label === 'Style' });
  }
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
  if (rows.length === 0) return <span>-</span>;
  return (
    <ul className="m-0 grid list-none gap-x-5 gap-y-1.5 p-0 sm:grid-cols-2">
      {rows.map((row) => (
        <li key={row.label} className={editor.editorKey && row.key === editor.editorKey ? 'sm:col-span-2' : undefined}>
          <span className="inline-flex flex-wrap items-center gap-2">
            <span>{row.label}</span>
            <span className="font-semibold" style={{ color: row.fixed ? 'var(--color-on-surface-variant)' : 'var(--color-on-surface)' }}>{row.value}</span>
            {row.key ? editor.pencil(row.key, row.label) : row.fixed ? <span className="text-[0.65rem] italic opacity-75">fixed</span> : null}
          </span>
          {row.key ? editor.inlineEditor(row.key) : null}
        </li>
      ))}
    </ul>
  );
}
