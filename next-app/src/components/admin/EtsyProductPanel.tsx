'use client';

import { useCallback, useEffect, useState } from 'react';
import ComboboxInput from './ComboboxInput';

interface PreflightCheck {
  check: string;
  ok: boolean;
  message?: string;
  value?: number | string | null;
}

interface MappedPayload {
  title: string;
  tags: string[];
  materials: string[];
  taxonomyPath: string | null;
  taxonomyIsOverride: boolean;
  taxonomyIsApproximate: boolean;
  whenMade: string;
  whenMadeUsedFallback: boolean;
  price: number | null;
  priceBeforeMarkup: number | null;
  quantity: number;
  sku: string;
  images: { sourceUrl: string; rank: number }[];
}

interface TaxonomyLeaf {
  id: number;
  path: string;
}

interface PreviewResponse {
  eligible: boolean;
  preflight: PreflightCheck[];
  payload: MappedPayload;
  /** Normalized jewelry type (e.g. "Bracelet", "Ring") — authoritative signal for which structured-property row to show, rather than pattern-matching taxonomyPath text. */
  productType: string | null;
  /** Structured properties that auto-push on sync, shown in the dry-run for review. Either value is null when there's nothing to push for this product. */
  structuredProperties?: { length: string | null; ringSize: string | null };
}

interface EtsyListingSummary {
  etsy_listing_id: number | null;
  sync_state: string;
  listing_state: string | null;
  last_error: string | null;
  last_synced_at: string | null;
}

interface SyncStepResult {
  done: boolean;
  syncState: string;
  progress?: { step: string; uploaded?: number; total?: number };
  listingId?: number;
  listingUrl?: string;
  warnings?: string[];
  error?: { code: string; message: string };
}

const STATE_LABELS: Record<string, string> = {
  pending: 'Not listed',
  draft_created: 'Draft on Etsy',
  images_synced: 'Draft on Etsy',
  inventory_synced: 'Draft on Etsy',
  draft_review: 'Draft on Etsy — needs review',
  active: 'Active on Etsy',
  out_of_date: 'Out of date on Etsy',
  delisted: 'Delisted',
  error: 'Error',
};

// "View on Etsy" points at the owner's shop-manager listing views, not the
// public etsy.com/listing/<id> URL — a draft isn't publicly viewable there,
// and the owner prefers landing on their own management list. Active listings
// → the default listings view; anything else (draft/inactive/unknown) → the
// draft filter.
const ETSY_MANAGE_ACTIVE_URL = 'https://www.etsy.com/your/shops/me/tools/listings?ref=seller-platform-mcnav';
const ETSY_MANAGE_DRAFT_URL = 'https://www.etsy.com/your/shops/me/tools/listings?ref=seller-platform-mcnav&state=draft&sort=update_date';

/** Self-contained Etsy drawer section: its own fetch, its own sync loop — mirrors the AI section's pattern (own state, own round trip, independent of the form's Save). */
export default function EtsyProductPanel({
  productId,
  onSynced,
}: {
  productId: string;
  /** Called after an action that can change this listing's sync state, so the
   *  parent admin table can refresh its status chips (see AdminShell). */
  onSynced?: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [listing, setListing] = useState<EtsyListingSummary | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState<SyncStepResult['progress'] | null>(null);
  const [busyAction, setBusyAction] = useState<'delist' | 'reactivate' | 'check-status' | null>(null);
  const [pushingPrice, setPushingPrice] = useState(false);
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [categoryInput, setCategoryInput] = useState('');
  const [taxonomyLeaves, setTaxonomyLeaves] = useState<TaxonomyLeaf[] | null>(null);
  const [loadingTaxonomy, setLoadingTaxonomy] = useState(false);
  const [taxonomyLoadError, setTaxonomyLoadError] = useState<string | null>(null);
  const [savingCategory, setSavingCategory] = useState(false);

  const showNotice = (text: string, ok = true) => {
    setNotice({ text, ok });
    window.setTimeout(() => setNotice(null), 5000);
  };

  const loadPreview = useCallback(async (): Promise<{ ok: boolean; message?: string }> => {
    // No setState before the first await: called directly from the mount
    // effect below, and a synchronous setState there would trigger cascading
    // renders (react-hooks/set-state-in-effect) — matches the fetch-first
    // pattern used by AdminSettingsPanel.tsx elsewhere in this app. `loading`
    // only ever starts true (initial mount) and settles to false in `finally`;
    // later manual reloads (Refresh button, post-sync) update the data in
    // place without re-showing the full loading state. Returns a result
    // (rather than relying on state) so a caller like the Refresh Preview
    // button can show its own notice without racing React's state updates.
    try {
      const [previewRes, listingsRes] = await Promise.all([
        fetch('/api/admin/etsy/preview', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ productId }),
        }),
        fetch('/api/admin/etsy/listings'),
      ]);
      const previewData = await previewRes.json().catch(() => null);
      if (!previewRes.ok) throw new Error(previewData?.error || 'Could not load the Etsy preview.');
      const listingsData = await listingsRes.json().catch(() => null);
      setPreview(previewData as PreviewResponse);
      setListing((listingsData?.listings?.[productId] as EtsyListingSummary | undefined) ?? null);
      setLoadError(null);
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load the Etsy preview.';
      setLoadError(message);
      return { ok: false, message };
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    const run = async () => { await loadPreview(); };
    void run();
  }, [loadPreview]);

  const handleRefreshClick = async () => {
    const result = await loadPreview();
    showNotice(result.ok ? 'Preview refreshed.' : (result.message ?? 'Could not refresh the preview.'), result.ok);
  };

  const runSyncLoop = async (mode: 'publish' | 'update') => {
    setSyncing(true);
    setProgress(null);
    // Stall detection: if the exact same progress comes back repeatedly,
    // stop instead of polling forever. Confirmed live 2026-07-08 (session
    // 9): a persistently-failing image caused 100+ identical polls against
    // the same batch, hammering Etsy's API, with the real failure reason
    // never shown (warnings were previously only surfaced once done became
    // true — fixed below too). sync.ts now has its own server-side circuit
    // breaker for the same scenario; this is a second, independent guard.
    let lastProgressSignature: string | null = null;
    let stallCount = 0;
    try {
      for (;;) {
        const res = await fetch('/api/admin/etsy/sync', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ productId, mode }),
        });
        const data = (await res.json().catch(() => null)) as SyncStepResult | null;
        if (!res.ok || !data) throw new Error('Sync request failed.');
        if (data.error) {
          showNotice(data.error.message, false);
          break;
        }
        if (!data.done) {
          setProgress(data.progress ?? null);
          if (data.warnings?.length) showNotice(data.warnings.join(' '), false);
          const signature = JSON.stringify(data.progress);
          if (signature === lastProgressSignature) {
            stallCount += 1;
            if (stallCount >= 5) {
              showNotice('Sync stalled — no progress after several attempts, stopping to avoid hammering Etsy. See the notice above for the actual failure reason, or try again.', false);
              break;
            }
          } else {
            stallCount = 0;
            lastProgressSignature = signature;
          }
          continue;
        }
        if (data.warnings?.length) showNotice(data.warnings.join(' '), true);
        else showNotice(`Synced — ${STATE_LABELS[data.syncState] ?? data.syncState}.`, true);
        break;
      }
    } catch (err) {
      showNotice(err instanceof Error ? err.message : 'Sync failed.', false);
    } finally {
      setSyncing(false);
      setProgress(null);
      await loadPreview();
      onSynced?.(); // refresh the parent table's status chips
    }
  };

  const runAction = async (action: 'delist' | 'reactivate') => {
    setBusyAction(action);
    try {
      const res = await fetch('/api/admin/etsy/delist', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ productId, action }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Action failed.');
      showNotice(action === 'delist' ? 'Deactivated on Etsy.' : 'Reactivated on Etsy.', true);
    } catch (err) {
      showNotice(err instanceof Error ? err.message : 'Action failed.', false);
    } finally {
      setBusyAction(null);
      await loadPreview();
      onSynced?.(); // refresh the parent table's status chips
    }
  };

  // Reconciles with the real Etsy listing — catches out-of-band changes our
  // DB can't learn about on its own: the owner deleting a draft on etsy.com
  // (resets to not-listed), or activating a draft there (flips our chip to
  // "Active on Etsy"). Read-only on Etsy's side (a GET), so it's safe to call
  // any time the listing is linked; loadPreview() below re-renders the chip.
  const checkStatus = async () => {
    setBusyAction('check-status');
    try {
      const res = await fetch('/api/admin/etsy/verify-listing', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ productId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Could not check Etsy status.');
      showNotice(data.message ?? 'Checked Etsy status.', true);
    } catch (err) {
      showNotice(err instanceof Error ? err.message : 'Could not check Etsy status.', false);
    } finally {
      setBusyAction(null);
      await loadPreview();
      onSynced?.(); // refresh the parent table's status chips
    }
  };

  // Lean price-only push for THIS listing (updateListingInventory only — no
  // images/properties). price-only completes in one server call (no polling),
  // so this is a plain one-shot. Only offered for already-listed products.
  const pushPriceOnly = async () => {
    setPushingPrice(true);
    try {
      const res = await fetch('/api/admin/etsy/sync', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ productId, mode: 'price-only' }),
      });
      const data = (await res.json().catch(() => null)) as SyncStepResult | null;
      if (!res.ok || !data) throw new Error('Price push failed.');
      if (data.error) showNotice(data.error.message, false);
      else showNotice('Price pushed to Etsy.', true);
    } catch (err) {
      showNotice(err instanceof Error ? err.message : 'Price push failed.', false);
    } finally {
      setPushingPrice(false);
      await loadPreview();
      onSynced?.(); // refresh the parent table's status chips
    }
  };

  const openCategoryPicker = async () => {
    setCategoryPickerOpen(true);
    setCategoryInput(preview?.payload.taxonomyPath ?? '');
    if (taxonomyLeaves || loadingTaxonomy) return;
    setLoadingTaxonomy(true);
    setTaxonomyLoadError(null);
    try {
      const res = await fetch('/api/admin/etsy/taxonomy');
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Could not load Etsy categories.');
      setTaxonomyLeaves(data.leaves as TaxonomyLeaf[]);
    } catch (err) {
      setTaxonomyLoadError(err instanceof Error ? err.message : 'Could not load Etsy categories.');
    } finally {
      setLoadingTaxonomy(false);
    }
  };

  const saveCategory = async (taxonomyId: number | null, taxonomyPath: string | null) => {
    setSavingCategory(true);
    try {
      const res = await fetch('/api/admin/etsy/category', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ productId, taxonomyId, taxonomyPath }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Could not save the category.');
      showNotice(taxonomyId ? 'Category saved.' : 'Reverted to the automatic category.', true);
      setCategoryPickerOpen(false);
    } catch (err) {
      showNotice(err instanceof Error ? err.message : 'Could not save the category.', false);
    } finally {
      setSavingCategory(false);
      await loadPreview();
    }
  };

  const confirmCategorySelection = () => {
    const match = taxonomyLeaves?.find((leaf) => leaf.path === categoryInput);
    if (!match) {
      showNotice('Pick an exact category from the list.', false);
      return;
    }
    void saveCategory(match.id, match.path);
  };

  if (loading) return <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>Loading Etsy status…</p>;
  // Only the initial load (no preview yet) replaces the panel with a bare
  // error line; a later failed Refresh Preview click keeps the existing
  // panel/data on screen and reports the failure via the notice banner
  // instead (same as every other action button below).
  if (loadError && !preview) return <p className="text-xs" style={{ color: 'var(--color-error)' }}>{loadError}</p>;
  if (!preview) return null;

  const stateLabel = listing ? (STATE_LABELS[listing.sync_state] ?? listing.sync_state) : 'Not listed';
  const alreadyListed = Boolean(listing?.etsy_listing_id);
  // Which structured-property row to show in the dry-run. Mirrors sync.ts's
  // server-side LENGTH_BEARING_PRODUCT_TYPES (every pinned category except
  // Ring, which has no buyer-facing length concept — Ring size instead, an
  // unrelated enumerated property).
  const isLengthBearing = preview.productType != null && preview.productType !== 'Ring' && preview.productType !== 'Other';
  const isRing = preview.productType === 'Ring';

  return (
    <div className="flex flex-col gap-4">
      {notice && (
        <div
          className="px-3 py-2 text-xs font-medium"
          role="status"
          style={{
            background: notice.ok ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)' : 'color-mix(in srgb, var(--color-error) 10%, transparent)',
            border: `1px solid ${notice.ok ? 'color-mix(in srgb, var(--color-primary) 28%, transparent)' : 'color-mix(in srgb, var(--color-error) 28%, transparent)'}`,
            color: notice.ok ? 'var(--color-primary)' : 'var(--color-error)',
          }}
        >
          {notice.text}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span
          className="inline-flex text-[0.6rem] font-bold uppercase tracking-widest px-2 py-0.5"
          style={{
            background: listing?.sync_state === 'error' ? 'color-mix(in srgb, var(--color-error) 16%, transparent)' : 'color-mix(in srgb, var(--color-primary) 14%, transparent)',
            color: listing?.sync_state === 'error' ? 'var(--color-error)' : 'var(--color-primary)',
          }}
        >
          {stateLabel}
        </span>
        {listing?.etsy_listing_id && (
          <a
            href={listing.listing_state === 'active' ? ETSY_MANAGE_ACTIVE_URL : ETSY_MANAGE_DRAFT_URL}
            target="_blank"
            rel="noreferrer"
            className="text-xs underline"
            style={{ color: 'var(--color-primary)' }}
          >
            View on Etsy
          </a>
        )}
      </div>

      {listing?.last_error && <p className="text-xs" style={{ color: 'var(--color-error)' }}>{listing.last_error}</p>}

      <div>
        <p className="form-label mb-1">Pre-flight</p>
        <ul className="flex flex-col gap-1">
          {preview.preflight.map((check) => (
            <li
              key={check.check}
              className="text-xs flex items-start gap-2"
              style={{ color: !check.ok ? 'var(--color-error)' : check.message ? '#a9760a' : 'var(--color-on-surface-variant)' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '14px', lineHeight: '1.4' }} aria-hidden="true">
                {!check.ok ? 'error' : check.message ? 'warning' : 'check_circle'}
              </span>
              <span>{check.message ?? check.check}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="grid md:grid-cols-2 gap-3 text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
        <div>
          <span className="form-label">Title</span>
          <p>{preview.payload.title}</p>
        </div>
        <div>
          <span className="form-label">Price</span>
          <p>
            {preview.payload.price != null ? `$${preview.payload.price.toFixed(2)}` : '—'}
            {preview.payload.priceBeforeMarkup != null && preview.payload.price != null ? ` (site: $${preview.payload.priceBeforeMarkup.toFixed(2)})` : ''}
          </p>
        </div>
        <div>
          <span className="form-label">Tags</span>
          <p>{preview.payload.tags.join(', ') || '—'}</p>
        </div>
        <div>
          <span className="form-label">Materials</span>
          <p>{preview.payload.materials.join(', ') || '—'}</p>
        </div>
        <div>
          <span className="form-label">When made</span>
          <p>
            {preview.payload.whenMade}
            {preview.payload.whenMadeUsedFallback ? ' (fallback)' : ''}
          </p>
        </div>
        {isLengthBearing && (
          <div>
            <span className="form-label">Length</span>
            {preview.structuredProperties?.length ? (
              <p>{preview.structuredProperties.length} <span style={{ color: 'var(--color-on-surface-variant)' }}>· pushes on sync</span></p>
            ) : (
              <p style={{ color: 'var(--color-on-surface-variant)' }}>No length set — nothing to push</p>
            )}
          </div>
        )}
        {isRing && (
          <div>
            <span className="form-label">Ring size</span>
            {preview.structuredProperties?.ringSize ? (
              <p>{preview.structuredProperties.ringSize} (US/CA) <span style={{ color: 'var(--color-on-surface-variant)' }}>· pushes on sync</span></p>
            ) : (
              <p style={{ color: 'var(--color-on-surface-variant)' }}>No size in the length field — nothing to push</p>
            )}
          </div>
        )}
        <div className="md:col-span-2">
          <span className="form-label">Category</span>
          <p>
            {preview.payload.taxonomyPath ?? '—'}
            {preview.payload.taxonomyIsOverride && (
              <span className="ml-2 text-[0.65rem] font-bold uppercase tracking-wide" style={{ color: 'var(--color-primary)' }}>Manually selected</span>
            )}
            {preview.payload.taxonomyIsApproximate && (
              <span className="ml-2 text-[0.65rem] font-bold uppercase tracking-wide" style={{ color: '#a9760a' }}>Closest match — review</span>
            )}
          </p>
          {!categoryPickerOpen ? (
            <div className="mt-1 flex flex-wrap gap-2">
              <button type="button" onClick={() => void openCategoryPicker()} className="outline-button text-xs">
                Choose exact category…
              </button>
              {preview.payload.taxonomyIsOverride && (
                <button type="button" onClick={() => void saveCategory(null, null)} disabled={savingCategory} className="outline-button text-xs">
                  Reset to automatic
                </button>
              )}
            </div>
          ) : (
            <div className="mt-2 flex flex-col gap-2 border p-3" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
              {loadingTaxonomy && <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>Loading Etsy&apos;s full category list…</p>}
              {taxonomyLoadError && <p className="text-xs" style={{ color: 'var(--color-error)' }}>{taxonomyLoadError}</p>}
              {taxonomyLeaves && (
                <ComboboxInput
                  value={categoryInput}
                  onChange={setCategoryInput}
                  options={taxonomyLeaves.map((leaf) => leaf.path)}
                  placeholder="Type to search Etsy categories…"
                  disabled={savingCategory}
                />
              )}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setCategoryPickerOpen(false)} disabled={savingCategory} className="outline-button text-xs">
                  Cancel
                </button>
                <button type="button" onClick={confirmCategorySelection} disabled={savingCategory || !taxonomyLeaves} className="gold-button text-xs">
                  {savingCategory ? 'Saving…' : 'Use this category'}
                </button>
              </div>
            </div>
          )}
        </div>
        <div>
          <span className="form-label">Photos</span>
          <p>{preview.payload.images.length}</p>
        </div>
      </div>

      {progress && (
        <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
          {progress.step === 'images' ? `Uploading image ${progress.uploaded ?? 0} of ${progress.total ?? '?'}…` : `Working on ${progress.step}…`}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void handleRefreshClick()} disabled={loading || syncing} className="outline-button text-sm">
          Refresh Preview
        </button>
        {alreadyListed && (
          <button type="button" onClick={() => void checkStatus()} disabled={busyAction !== null || syncing} className="outline-button text-sm">
            {busyAction === 'check-status' ? 'Checking…' : 'Check Etsy Status'}
          </button>
        )}
        {!alreadyListed ? (
          <button type="button" onClick={() => void runSyncLoop('publish')} disabled={!preview.eligible || syncing} className="gold-button text-sm disabled:opacity-50">
            {syncing ? 'Syncing…' : 'Sync to Etsy'}
          </button>
        ) : (
          <button type="button" onClick={() => void runSyncLoop('update')} disabled={syncing} className="gold-button text-sm">
            {syncing ? 'Syncing…' : 'Sync Updates'}
          </button>
        )}
        {alreadyListed && (
          <button
            type="button"
            onClick={() => void pushPriceOnly()}
            disabled={pushingPrice || syncing || busyAction !== null}
            className="outline-button text-sm"
            title="Push just the current price to Etsy (no photos or details)"
          >
            {pushingPrice ? 'Pushing price…' : 'Push price'}
          </button>
        )}
        {alreadyListed && listing?.sync_state !== 'delisted' && (
          <button type="button" onClick={() => void runAction('delist')} disabled={busyAction !== null} className="outline-button text-sm">
            {busyAction === 'delist' ? 'Deactivating…' : 'Deactivate on Etsy'}
          </button>
        )}
        {alreadyListed && listing?.sync_state === 'delisted' && (
          <button type="button" onClick={() => void runAction('reactivate')} disabled={busyAction !== null} className="outline-button text-sm">
            {busyAction === 'reactivate' ? 'Reactivating…' : 'Reactivate on Etsy'}
          </button>
        )}
      </div>
    </div>
  );
}
