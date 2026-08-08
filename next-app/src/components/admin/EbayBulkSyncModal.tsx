'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import SelectedMarketplaceReviewFlow from './SelectedMarketplaceReviewFlow';
import { EBAY_BULK_ENQUEUE_LIMIT } from '@/lib/ebay/guards';

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
  results: { productId: string; syncState: string }[];
}

// eBay routes return { error: { code, message } } — read via this helper
// rather than `data?.error` (see the note in EbaySettingsPanel.tsx).
function errorMessage(data: unknown, fallback: string): string {
  if (data && typeof data === 'object' && 'error' in data) {
    const err = (data as { error?: unknown }).error;
    if (err && typeof err === 'object' && 'message' in err) {
      const message = (err as { message?: unknown }).message;
      if (typeof message === 'string' && message) return message;
    }
  }
  return fallback;
}

/** Bulk action mirroring EtsyBulkSyncModal: pre-flight summary -> confirm -> drain the queue with progress -> stop-after-current cancel. */
export default function EbayBulkSyncModal({ onClose, productIds }: { onClose: (completed?: boolean) => void; productIds?: string[] }) {
  const selectedProductIds = productIds?.length ? productIds : null;
  const selectedRun = selectedProductIds !== null;
  const selectedCount = selectedProductIds?.length ?? 0;
  const [phase, setPhase] = useState<'summary' | 'running' | 'done'>('summary');
  const [summary, setSummary] = useState<EligibilitySummary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [queued, setQueued] = useState<number | null>(null);
  // Batch cap / write-block notice from the enqueue response.
  const [batchNotice, setBatchNotice] = useState<string | null>(null);
  const [processed, setProcessed] = useState(0);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<string | null>(null);
  const [selectedFlow, setSelectedFlow] = useState<'choice' | 'review'>('choice');
  const cancelledRef = useRef(false);

  // No setState before the first await (react-hooks/set-state-in-effect) —
  // see EtsyBulkSyncModal.loadSummary for the same fetch-first pattern.
  const loadSummary = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/ebay/eligibility-summary');
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(errorMessage(data, 'Could not load the eligibility summary.'));
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
        marketplace="ebay"
        productIds={selectedProductIds ?? []}
        onBack={() => setSelectedFlow('choice')}
        onClose={onClose}
      />
    );
  }

  // "Check eBay statuses" — reconcile every linked listing's local state to
  // what eBay actually reports (read-only; no content re-pushed).
  const checkAll = async () => {
    setChecking(true);
    setCheckResult(null);
    try {
      const res = await fetch('/api/admin/ebay/verify-all', {
        method: 'POST',
        ...(selectedRun
          ? {
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ productIds: selectedProductIds }),
            }
          : {}),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) throw new Error(errorMessage(data, 'Could not check eBay statuses.'));
      setCheckResult(
        `Checked ${data.checked} listing${data.checked === 1 ? '' : 's'} — ${data.updated} updated` +
          `${data.reset ? `, ${data.reset} reset (gone from eBay)` : ''}${data.errors ? `, ${data.errors} couldn’t be read` : ''}.`,
      );
      await loadSummary();
    } catch (err) {
      setCheckResult(err instanceof Error ? err.message : 'Could not check eBay statuses.');
    } finally {
      setChecking(false);
    }
  };

  const start = async () => {
    cancelledRef.current = false;
    setError(null);
    setPhase('running');
    try {
      const enqueueRes = await fetch('/api/admin/ebay/sync-batch', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(selectedRun
          ? { action: 'enqueue', productIds: selectedProductIds }
          : { action: 'enqueue-all-eligible' }),
      });
      const enqueueData = await enqueueRes.json().catch(() => null);
      if (!enqueueRes.ok) throw new Error(errorMessage(enqueueData, 'Could not queue products.'));
      setQueued(enqueueData.queued ?? 0);
      // Surface the batch cap and any write-blocked items instead of letting a
      // partial run look complete (never blanket re-sync — run this again for
      // the next batch).
      setBatchNotice(
        [
          enqueueData.withheld
            ? `${enqueueData.withheld} more eligible item${enqueueData.withheld === 1 ? '' : 's'} withheld this run — run this again after reviewing the results on eBay.`
            : null,
          enqueueData.notAvailable
            ? `${enqueueData.notAvailable} item${enqueueData.notAvailable === 1 ? '' : 's'} skipped — no longer available for sale.`
            : null,
          enqueueData.blocked
            ? `${enqueueData.blocked} write-blocked item${enqueueData.blocked === 1 ? '' : 's'} skipped.`
            : null,
        ]
          .filter(Boolean)
          .join(' ') || null,
      );

      let done = false;
      // Stall guard: if 'remaining' stops shrinking across several polls, the
      // queue isn't draining — stop rather than loop forever (see
      // EtsyBulkSyncModal.start for the same guard against the same failure
      // mode).
      let lastRemaining: number | null = null;
      let stall = 0;
      while (!done && !cancelledRef.current) {
        const res = await fetch('/api/admin/ebay/sync-batch', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'drain' }),
        });
        const data = (await res.json().catch(() => null)) as DrainResult | null;
        if (!res.ok || !data) throw new Error(errorMessage(data, 'Batch sync failed.'));
        setProcessed((current) => current + data.results.length);
        setRemaining(data.remaining);
        done = data.done;
        if (done) break;
        if (data.remaining === lastRemaining) {
          stall += 1;
          if (stall >= 5) {
            setError('Some items aren’t progressing (the queue stopped shrinking) — stopped to avoid hammering eBay. Sync those products individually to see the error, then retry.');
            break;
          }
        } else {
          stall = 0;
          lastRemaining = data.remaining;
        }
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
          {selectedRun ? `Sync ${selectedCount} selected to eBay` : 'Sync all to eBay'}
        </h3>

        {phase === 'summary' && (
          <>
            {selectedRun && (
              <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
                Ready to queue <strong style={{ color: 'var(--color-primary)' }}>{selectedCount}</strong> selected product{selectedCount === 1 ? '' : 's'} on eBay.
              </p>
            )}
            {!selectedRun && summaryError && <p className="text-sm" style={{ color: 'var(--color-error)' }}>{summaryError}</p>}
            {!selectedRun && !summaryError && !summary && <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>Checking eligibility…</p>}
            {!selectedRun && summary && (
              <div className="text-sm flex flex-col gap-1" style={{ color: 'var(--color-on-surface-variant)' }}>
                <p>
                  <strong style={{ color: 'var(--color-primary)' }}>{summary.eligible} eligible</strong> · {summary.ineligible} ineligible ·{' '}
                  {summary.upToDate} up to date · {summary.errors} errors
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
                actually fine on eBay, click <strong>Check eBay statuses</strong> to reconcile them (read-only). Or click <strong>Start</strong> to
                re-sync them.
              </p>
            )}
            {checkResult && <p className="text-xs" style={{ color: 'var(--color-primary)' }}>{checkResult}</p>}
            <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
              Queues eligible items and prepares them on eBay (or publishes them live, if auto-publish is on). Each run is capped at{' '}
              <strong>{EBAY_BULK_ENQUEUE_LIMIT}</strong> items so a large catalog is rewritten in reviewable batches rather than all at once — run
              this again for the next batch after spot-checking the results on eBay.
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
                    {checking ? 'Checking…' : 'Check selected eBay statuses'}
                  </button>
                </div>
              </>
            ) : (
              <div className="flex justify-end gap-2 flex-wrap">
                <button type="button" onClick={() => onClose(false)} disabled={checking} className="outline-button text-sm">
                  Cancel
                </button>
                <button type="button" onClick={() => void checkAll()} disabled={checking} className="outline-button text-sm disabled:opacity-50">
                  {checking ? 'Checking…' : 'Check eBay statuses'}
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
              {queued == null ? 'Queuing eligible products…' : `Processed ${processed} · ${remaining ?? '?'} remaining…`}
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
                Done — processed {processed} product{processed === 1 ? '' : 's'}. Check each item&apos;s eBay status in its drawer, or Settings →
                eBay Sync for the activity log.
              </p>
            )}
            {batchNotice && (
              <p
                className="text-sm"
                style={{
                  padding: '0.6rem 0.75rem',
                  border: '1px solid color-mix(in srgb, var(--color-primary) 35%, transparent)',
                  background: 'color-mix(in srgb, var(--color-primary) 8%, transparent)',
                  color: 'var(--color-on-surface)',
                }}
              >
                {batchNotice}
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
