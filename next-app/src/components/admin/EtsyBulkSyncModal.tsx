'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import SelectedMarketplaceReviewFlow from './SelectedMarketplaceReviewFlow';

interface EligibilitySummary {
  total: number;
  eligible: number;
  ineligible: number;
  upToDate: number;
  errors: number;
  ineligibleSamples: { title: string; reason: string }[];
}

interface DrainResult {
  done: boolean;
  remaining: number;
  results: { productId: string; syncState: string; done: boolean }[];
}

/** Phase 2 bulk action (etsy-sync-plan/07-admin-ux.md §3): pre-flight summary -> confirm -> drain the queue with progress -> stop-after-current cancel. */
export default function EtsyBulkSyncModal({ onClose, productIds }: { onClose: (completed?: boolean) => void; productIds?: string[] }) {
  const selectedProductIds = productIds?.length ? productIds : null;
  const selectedRun = selectedProductIds !== null;
  const selectedCount = selectedProductIds?.length ?? 0;
  const [phase, setPhase] = useState<'summary' | 'running' | 'done'>('summary');
  const [summary, setSummary] = useState<EligibilitySummary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [queued, setQueued] = useState<number | null>(null);
  const [processed, setProcessed] = useState(0);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<string | null>(null);
  const [selectedFlow, setSelectedFlow] = useState<'choice' | 'review'>('choice');
  const cancelledRef = useRef(false);

  // No setState before the first await (react-hooks/set-state-in-effect) — see
  // EtsyProductPanel.tsx's loadPreview for the same fetch-first pattern.
  const loadSummary = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/etsy/eligibility-summary');
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Could not load the eligibility summary.');
      setSummary(data as EligibilitySummary);
      setSummaryError(null);
    } catch (err) {
      setSummaryError(err instanceof Error ? err.message : 'Could not load the eligibility summary.');
    }
  }, []);

  useEffect(() => {
    if (selectedRun) return;
    const run = async () => { await loadSummary(); };
    void run();
  }, [loadSummary, selectedRun]);

  if (selectedRun && selectedFlow === 'review') {
    return (
      <SelectedMarketplaceReviewFlow
        marketplace="etsy"
        productIds={selectedProductIds ?? []}
        onBack={() => setSelectedFlow('choice')}
        onClose={onClose}
      />
    );
  }

  // "Check Etsy statuses" — reconcile every linked listing's local state to
  // what Etsy actually reports (read-only; no content re-pushed). Recovers
  // items stuck in 'error' after a transient failure, then refreshes the counts
  // so those move out of the "errors" bucket and become syncable again.
  const checkAll = async () => {
    setChecking(true);
    setCheckResult(null);
    try {
      const res = await fetch('/api/admin/etsy/verify-all', {
        method: 'POST',
        ...(selectedRun
          ? {
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ productIds: selectedProductIds }),
            }
          : {}),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) throw new Error(data?.error || 'Could not check Etsy statuses.');
      setCheckResult(
        `Checked ${data.checked} listing${data.checked === 1 ? '' : 's'} — ${data.updated} updated` +
          `${data.reset ? `, ${data.reset} reset (gone from Etsy)` : ''}${data.errors ? `, ${data.errors} couldn’t be read` : ''}.`,
      );
      await loadSummary();
    } catch (err) {
      setCheckResult(err instanceof Error ? err.message : 'Could not check Etsy statuses.');
    } finally {
      setChecking(false);
    }
  };

  const start = async () => {
    cancelledRef.current = false;
    setError(null);
    setPhase('running');
    try {
      const enqueueRes = await fetch('/api/admin/etsy/sync-batch', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(selectedRun
          ? { action: 'enqueue', productIds: selectedProductIds }
          : { action: 'enqueue-all-eligible' }),
      });
      const enqueueData = await enqueueRes.json().catch(() => null);
      if (!enqueueRes.ok) throw new Error(enqueueData?.error || 'Could not queue products.');
      setQueued(enqueueData.queued ?? 0);

      let done = false;
      // Multi-photo listings remain queued while each four-image batch succeeds,
      // so an unchanged count is only a stall when the server processed nothing.
      let lastRemaining: number | null = null;
      let stall = 0;
      while (!done && !cancelledRef.current) {
        const res = await fetch('/api/admin/etsy/sync-batch', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'drain' }),
        });
        const data = (await res.json().catch(() => null)) as (DrainResult & { error?: string }) | null;
        if (!res.ok || !data) throw new Error(data?.error || 'Batch sync failed.');
        const completed = data.results.filter((result) => result.done).length;
        setProcessed((current) => current + completed);
        setRemaining(data.remaining);
        done = data.done;
        if (done) break;
        if (data.results.length === 0 && data.remaining === lastRemaining) {
          stall += 1;
          if (stall >= 5) {
            setError('Some items aren’t progressing (the queue stopped shrinking) — stopped to avoid hammering Etsy. Sync those products individually to see the error, then retry.');
            break;
          }
        } else {
          stall = 0;
        }
        lastRemaining = data.remaining;
      }
      setPhase('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Batch sync failed.');
      setPhase('done');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto whitespace-normal p-4 sm:items-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="min-w-0 w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto border bg-white p-5 flex flex-col gap-4 [overflow-wrap:anywhere]" style={{ borderColor: 'var(--color-outline-variant)' }}>
        <h3 className="text-lg font-bold" style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}>
          {selectedRun ? `Sync ${selectedCount} selected to Etsy` : 'Sync all to Etsy'}
        </h3>

        {phase === 'summary' && (
          <>
            {selectedRun && (
              <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
                Ready to evaluate <strong style={{ color: 'var(--color-primary)' }}>{selectedCount}</strong> selected product{selectedCount === 1 ? '' : 's'}.
                New, errored, and sync-needed listings will be queued; current listings will be skipped.
              </p>
            )}
            {!selectedRun && summaryError && <p className="text-sm" style={{ color: 'var(--color-error)' }}>{summaryError}</p>}
            {!selectedRun && !summaryError && !summary && <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>Checking eligibility…</p>}
            {!selectedRun && summary && (
              <div className="text-sm flex flex-col gap-1" style={{ color: 'var(--color-on-surface-variant)' }}>
                <p>
                  <strong style={{ color: 'var(--color-primary)' }}>{summary.eligible} eligible</strong> · {summary.ineligible} ineligible ·{' '}
                  {summary.upToDate} already up to date · {summary.errors} errors (of {summary.total} available items)
                </p>
                {summary.ineligibleSamples.length > 0 && (
                  <details className="text-xs">
                    <summary className="cursor-pointer">Why some items are ineligible</summary>
                    <ul className="list-disc pl-4 mt-1 flex flex-col gap-1">
                      {summary.ineligibleSamples.map((sample) => (
                        <li key={sample.title}>
                          {sample.title}
                          <span style={{ color: 'var(--color-error)' }}> — {sample.reason}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            )}
            {!selectedRun && summary && summary.errors > 0 && (
              <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                {summary.errors} item{summary.errors === 1 ? '' : 's'} in an error state. If a past sync hiccup left them errored but they&apos;re
                actually fine on Etsy, click <strong>Check Etsy statuses</strong> to reconcile them (read-only — errored drafts return to
                &ldquo;needs review,&rdquo; anything deleted resets to not-listed). Or click <strong>Start</strong> to re-sync them.
              </p>
            )}
            {checkResult && <p className="text-xs" style={{ color: 'var(--color-primary)' }}>{checkResult}</p>}
            <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
              Queues every eligible item and pushes it to Etsy as a draft (or active, if auto-activate is on). This can take a while for a full
              catalog — feel free to leave this open, or check Settings → Etsy Sync later for progress.
            </p>
            {selectedRun ? (
              <>
                <p className="form-label">Choose sync method</p>
                <div className="grid gap-2">
                  <button
                    type="button"
                    onClick={() => void start()}
                    disabled={checking || selectedCount === 0}
                    className="gold-button justify-center text-sm disabled:opacity-50"
                  >
                    Sync immediately
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedFlow('review')}
                    disabled={checking || selectedCount === 0}
                    className="outline-button justify-center text-sm disabled:opacity-50"
                  >
                    Review and submit one by one
                  </button>
                </div>
                <div className="flex justify-end gap-2 flex-wrap">
                  <button type="button" onClick={() => onClose(false)} disabled={checking} className="outline-button text-sm">
                    Cancel
                  </button>
                  <button type="button" onClick={() => void checkAll()} disabled={checking} className="outline-button text-sm disabled:opacity-50">
                    {checking ? 'Checking…' : 'Check selected Etsy statuses'}
                  </button>
                </div>
              </>
            ) : (
              <div className="flex justify-end gap-2 flex-wrap">
                <button type="button" onClick={() => onClose(false)} disabled={checking} className="outline-button text-sm">
                  Cancel
                </button>
                <button type="button" onClick={() => void checkAll()} disabled={checking} className="outline-button text-sm disabled:opacity-50">
                  {checking ? 'Checking…' : 'Check Etsy statuses'}
                </button>
                <button
                  type="button"
                  onClick={() => void start()}
                  disabled={checking || !summary || (summary.eligible === 0 && summary.errors === 0)}
                  className="gold-button text-sm disabled:opacity-50"
                >
                  Start
                </button>
              </div>
            )}
          </>
        )}

        {phase === 'running' && (
          <>
            <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
              {queued == null ? 'Queuing eligible products…' : `Processed ${processed} of ${queued} · ${remaining ?? '?'} remaining…`}
            </p>
            <div className="flex justify-end">
              <button type="button" onClick={() => { cancelledRef.current = true; }} className="outline-button text-sm">
                Stop after current item
              </button>
            </div>
          </>
        )}

        {phase === 'done' && (
          <>
            {error ? (
              <p className="text-sm" style={{ color: 'var(--color-error)' }}>{error}</p>
            ) : (
              <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
                {selectedRun && queued != null
                  ? `Done — queued ${queued} of ${selectedCount} selected and processed ${processed} product${processed === 1 ? '' : 's'}.`
                  : `Done — processed ${processed} product${processed === 1 ? '' : 's'}.`}{' '}
                Check each item&apos;s Etsy status in its drawer, or Settings → Etsy Sync for the activity log.
              </p>
            )}
            <div className="flex justify-end">
              <button type="button" onClick={() => onClose(!error && !cancelledRef.current)} className="gold-button text-sm">
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
