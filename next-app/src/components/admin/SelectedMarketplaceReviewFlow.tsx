'use client';

import { useEffect, useState } from 'react';
import ComboboxInput from './ComboboxInput';

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
    shippingTier?: 'standard' | 'express';
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
}

interface TaxonomyLeaf {
  id: number;
  path: string;
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
}

const iconStyle = {
  fontFamily: 'Material Symbols Outlined',
  fontWeight: 400,
  fontStyle: 'normal',
  lineHeight: 1,
  letterSpacing: 'normal',
  textTransform: 'none' as const,
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

export default function SelectedMarketplaceReviewFlow({ marketplace, productIds, onBack, onClose }: Props) {
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
  const [categoryInput, setCategoryInput] = useState('');
  const [taxonomyLeaves, setTaxonomyLeaves] = useState<TaxonomyLeaf[] | null>(null);
  const [loadingTaxonomy, setLoadingTaxonomy] = useState(false);
  const [savingCategory, setSavingCategory] = useState(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [categoryNotice, setCategoryNotice] = useState<string | null>(null);

  const currentProductId = productIds[index] ?? null;
  const name = marketplace === 'etsy' ? 'Etsy' : 'eBay';
  const preview = previewState?.productId === currentProductId ? previewState.data : null;
  const loadError = loadErrorState?.productId === currentProductId ? loadErrorState.message : null;
  const finished = currentProductId === null;

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

  function advance(skippedItem: boolean) {
    if (skippedItem) setSkipped((current) => current + 1);
    else setCompleted((current) => current + 1);
    setSubmitError(null);
    setProgress(null);
    setWarnings([]);
    setCategoryPickerOpen(false);
    setCategoryInput('');
    setCategoryError(null);
    setCategoryNotice(null);
    setIndex((current) => current + 1);
  }

  function retryPreview() {
    setPreviewState(null);
    setLoadErrorState(null);
    setAttempt((current) => current + 1);
  }

  async function openCategoryPicker() {
    if (marketplace !== 'etsy' || !preview) return;
    setCategoryPickerOpen(true);
    setCategoryInput(preview.payload.taxonomyPath ?? '');
    setCategoryError(null);
    setCategoryNotice(null);
    if (taxonomyLeaves || loadingTaxonomy) return;

    setLoadingTaxonomy(true);
    try {
      const response = await fetch('/api/admin/etsy/taxonomy');
      const data = (await response.json().catch(() => null)) as { leaves?: TaxonomyLeaf[] } | null;
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
    if (marketplace !== 'etsy' || !currentProductId || savingCategory || submitting) return;
    setSavingCategory(true);
    setCategoryError(null);
    setCategoryNotice(null);
    try {
      const response = await fetch('/api/admin/etsy/category', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ productId: currentProductId, taxonomyId, taxonomyPath }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(responseError(data, 'Could not save the Etsy category.'));

      setCategoryPickerOpen(false);
      setCategoryNotice(taxonomyId ? 'Category saved. Preflight refreshed.' : 'Automatic category restored. Preflight refreshed.');
      setPreviewState(null);
      setLoadErrorState(null);
      setAttempt((current) => current + 1);
    } catch (caught) {
      setCategoryError(caught instanceof Error ? caught.message : 'Could not save the Etsy category.');
    } finally {
      setSavingCategory(false);
    }
  }

  function confirmCategorySelection() {
    const match = taxonomyLeaves?.find((leaf) => leaf.path === categoryInput);
    if (!match) {
      setCategoryError('Pick an exact category from the list.');
      return;
    }
    void saveCategory(match.id, match.path);
  }

  async function submitCurrent() {
    if (!currentProductId || !preview || !preview.eligible || submitting) return;
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

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto whitespace-normal p-4 sm:items-center"
      style={{ background: 'rgba(0,0,0,0.52)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="selected-review-title"
    >
      <div
        className="flex min-w-0 w-full max-w-2xl max-h-[calc(100dvh-2rem)] flex-col overflow-hidden border shadow-2xl [overflow-wrap:anywhere]"
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
            disabled={submitting || savingCategory}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-black/5 disabled:opacity-50"
            aria-label="Close review"
            title="Close"
          >
            <span className="material-symbols-outlined" style={iconStyle} aria-hidden="true">close</span>
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
              <span className="material-symbols-outlined animate-spin" style={{ ...iconStyle, color: 'var(--color-primary)' }} aria-hidden="true">sync</span>
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
                      <span className="material-symbols-outlined shrink-0" style={{ ...iconStyle, fontSize: '16px' }} aria-hidden="true">
                        {!check.ok ? 'error' : check.message ? 'warning' : 'check'}
                      </span>
                      <span>{check.message ?? checkLabel(check.check)}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <dl className="grid gap-x-5 gap-y-3 border-y py-4 text-xs sm:grid-cols-2" style={{ borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface-variant)' }}>
                <div>
                  <dt className="form-label">Price</dt>
                  <dd>{preview.payload.price != null ? `$${preview.payload.price.toFixed(2)}` : '-'}</dd>
                </div>
                <div>
                  <dt className="form-label">Quantity</dt>
                  <dd>{preview.payload.quantity}</dd>
                </div>
                <div className={marketplace === 'etsy' ? 'sm:col-span-2' : undefined}>
                  <dt className="form-label">Category</dt>
                  <dd>
                    {preview.payload.taxonomyPath ?? preview.payload.categoryPath ?? '-'}
                    {marketplace === 'etsy' && preview.payload.taxonomyIsOverride && (
                      <span className="ml-2 text-[0.65rem] font-bold uppercase tracking-wide" style={{ color: 'var(--color-primary)' }}>
                        Manually selected
                      </span>
                    )}
                  </dd>
                  {marketplace === 'etsy' && !categoryPickerOpen && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button type="button" onClick={() => void openCategoryPicker()} disabled={savingCategory || submitting} className="outline-button text-xs">
                        Choose exact category
                      </button>
                      {preview.payload.taxonomyIsOverride && (
                        <button type="button" onClick={() => void saveCategory(null, null)} disabled={savingCategory || submitting} className="outline-button text-xs">
                          {savingCategory ? 'Saving...' : 'Reset to automatic'}
                        </button>
                      )}
                    </div>
                  )}
                  {marketplace === 'etsy' && categoryPickerOpen && (
                    <div className="mt-2 flex flex-col gap-2 border p-3" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
                      {loadingTaxonomy && <p role="status" className="text-xs">Loading Etsy categories...</p>}
                      {taxonomyLeaves && (
                        <ComboboxInput
                          value={categoryInput}
                          onChange={setCategoryInput}
                          options={taxonomyLeaves.map((leaf) => leaf.path)}
                          placeholder="Type to search Etsy categories..."
                          disabled={savingCategory}
                        />
                      )}
                      <div className="flex flex-wrap justify-end gap-2">
                        <button type="button" onClick={() => setCategoryPickerOpen(false)} disabled={savingCategory} className="outline-button text-xs">
                          Cancel
                        </button>
                        <button type="button" onClick={confirmCategorySelection} disabled={savingCategory || !taxonomyLeaves} className="gold-button text-xs">
                          {savingCategory ? 'Saving...' : 'Use this category'}
                        </button>
                      </div>
                    </div>
                  )}
                  {marketplace === 'etsy' && categoryError && (
                    <p className="mt-2 text-xs" role="alert" style={{ color: 'var(--color-error)' }}>{categoryError}</p>
                  )}
                  {marketplace === 'etsy' && categoryNotice && (
                    <p className="mt-2 text-xs" role="status" style={{ color: 'var(--color-primary)' }}>{categoryNotice}</p>
                  )}
                </div>
                <div>
                  <dt className="form-label">Photos</dt>
                  <dd>{preview.payload.images.length}</dd>
                </div>
                {marketplace === 'etsy' ? (
                  <>
                    <div>
                      <dt className="form-label">When made</dt>
                      <dd>{preview.payload.whenMade ?? '-'}</dd>
                    </div>
                    <div>
                      <dt className="form-label">Materials</dt>
                      <dd>{preview.payload.materials?.join(', ') || '-'}</dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="form-label">Tags</dt>
                      <dd>{preview.payload.tags?.join(', ') || '-'}</dd>
                    </div>
                    {preview.structuredProperties?.length && (
                      <div>
                        <dt className="form-label">Length</dt>
                        <dd>{preview.structuredProperties.length}</dd>
                      </div>
                    )}
                    {preview.structuredProperties?.ringSize && (
                      <div>
                        <dt className="form-label">Ring size</dt>
                        <dd>{preview.structuredProperties.ringSize}</dd>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div>
                      <dt className="form-label">Condition</dt>
                      <dd>{preview.payload.conditionDescription ?? '-'}</dd>
                    </div>
                    <div>
                      <dt className="form-label">Shipping</dt>
                      <dd>{preview.payload.shippingTier ?? '-'}</dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="form-label">Aspects</dt>
                      <dd>
                        {preview.payload.aspects && Object.keys(preview.payload.aspects).length > 0
                          ? Object.entries(preview.payload.aspects).map(([key, values]) => `${key}: ${values.join(', ')}`).join(' | ')
                          : '-'}
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
                <button type="button" onClick={onBack} disabled={submitting || savingCategory} className="outline-button text-sm">
                  Back
                </button>
              )}
              {loadError && (
                <button type="button" onClick={retryPreview} className="outline-button text-sm">
                  Try again
                </button>
              )}
              {(preview || loadError) && (
                <button type="button" onClick={() => advance(true)} disabled={submitting || savingCategory} className="outline-button text-sm">
                  Skip item
                </button>
              )}
              {preview && (
                <>
                  <button type="button" onClick={retryPreview} disabled={submitting || savingCategory} className="outline-button text-sm">
                    Refresh preflight
                  </button>
                  <button
                    type="button"
                    onClick={() => void submitCurrent()}
                    disabled={!preview.eligible || submitting || savingCategory}
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
