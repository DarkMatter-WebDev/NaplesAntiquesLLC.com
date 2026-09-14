'use client';

import { useEffect, useState } from 'react';
import EtsyCategoryDropdown, { type EtsyCategoryLeaf } from './EtsyCategoryDropdown';
import {
  EbayAspectRows,
  FIELD_LABEL,
  PencilButton,
  lengthDisplay,
  lengthLabel,
  useProductFieldEditor,
  type EditorKey,
} from './ProductFieldInlineEditor';
import { AppIcon } from '@/components/AppIcon';
import type { ProductFieldEditPatch, ReviewProductFields } from '@/lib/product-field-edits';
import { normalizeProductJewelryType } from '@/types/product';

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
  // "Length saved · preflight refreshed" — one notice slot shared by every
  // save in the window (fields, category, tags), replaced by the next one.
  const [notice, setNotice] = useState<string | null>(null);
  // Etsy "additional tags": null = show the saved value, a string = an edit in progress.
  const [extraTagsInput, setExtraTagsInput] = useState<string | null>(null);
  const [savingTags, setSavingTags] = useState(false);
  const [tagsError, setTagsError] = useState<string | null>(null);

  const currentProductId = productIds[index] ?? null;
  const name = marketplace === 'etsy' ? 'Etsy' : 'eBay';
  const preview = previewState?.productId === currentProductId ? previewState.data : null;
  const loadError = loadErrorState?.productId === currentProductId ? loadErrorState.message : null;
  const finished = currentProductId === null;
  const fields = preview?.productFields ?? null;
  const productType = fields?.product_type ?? preview?.productType ?? null;
  const fieldEditor = useProductFieldEditor({
    marketplace,
    productId: currentProductId,
    fields,
    productType,
    disabled: submitting || savingCategory || savingTags,
    onOpen: () => setCategoryPickerOpen(false),
    onSaved: (patch, key) => {
      if (currentProductId) onProductEdited?.(currentProductId, patch);
      setNotice(`${FIELD_LABEL[key]} saved · preflight refreshed.`);
      reloadPreview();
    },
  });
  const busy = submitting || savingCategory || fieldEditor.saving || savingTags;

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
    fieldEditor.close();
    setNotice(null);
    setExtraTagsInput(null);
    setTagsError(null);
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
    fieldEditor.close();
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

  async function saveTags() {
    if (marketplace !== 'etsy' || !currentProductId || extraTagsInput === null || busy) return;
    const tags = extraTagsInput.split(',').map((tag) => tag.trim()).filter(Boolean);
    setSavingTags(true);
    setTagsError(null);
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
      setTagsError(caught instanceof Error ? caught.message : 'Could not save the tags.');
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
            {fieldEditor.pencil(key, label)}
          </span>
          {note && derivedNote(note)}
          {fieldEditor.inlineEditor(key)}
        </dd>
      </div>
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
                        <PencilButton label="Change Etsy category" onClick={() => void openCategoryPicker()} disabled={busy} />
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
                        {tagsError && (
                          <p className="mt-1 text-xs" role="alert" style={{ color: 'var(--color-error)' }}>{tagsError}</p>
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
                      <dd>
                        <EbayAspectRows aspects={preview.payload.aspects ?? {}} fields={fields} productType={productType} editor={fieldEditor} />
                      </dd>
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
