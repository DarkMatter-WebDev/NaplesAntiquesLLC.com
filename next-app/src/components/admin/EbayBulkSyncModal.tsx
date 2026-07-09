'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

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
export default function EbayBulkSyncModal({ onClose }: { onClose: () => void }) {
  const [phase, setPhase] = useState<'summary' | 'running' | 'done'>('summary');
  const [summary, setSummary] = useState<EligibilitySummary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [queued, setQueued] = useState<number | null>(null);
  const [processed, setProcessed] = useState(0);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<string | null>(null);
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
    const run = async () => { await loadSummary(); };
    void run();
  }, [loadSummary]);

  // "Check eBay statuses" — reconcile every linked listing's local state to
  // what eBay actually reports (read-only; no content re-pushed).
  const checkAll = async () => {
    setChecking(true);
    setCheckResult(null);
    try {
      const res = await fetch('/api/admin/ebay/verify-all', { method: 'POST' });
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
        body: JSON.stringify({ action: 'enqueue-all-eligible' }),
      });
      const enqueueData = await enqueueRes.json().catch(() => null);
      if (!enqueueRes.ok) throw new Error(errorMessage(enqueueData, 'Could not queue products.'));
      setQueued(enqueueData.queued ?? 0);

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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="w-full max-w-md border bg-white p-5 flex flex-col gap-4" style={{ borderColor: 'var(--color-outline-variant)' }}>
        <h3 className="text-lg font-bold" style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}>
          Sync all to eBay
        </h3>

        {phase === 'summary' && (
          <>
            {summaryError && <p className="text-sm" style={{ color: 'var(--color-error)' }}>{summaryError}</p>}
            {!summaryError && !summary && <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>Checking eligibility…</p>}
            {summary && (
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
            {summary && summary.errors > 0 && (
              <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                {summary.errors} item{summary.errors === 1 ? '' : 's'} in an error state. If a past sync hiccup left them errored but they&apos;re
                actually fine on eBay, click <strong>Check eBay statuses</strong> to reconcile them (read-only). Or click <strong>Start</strong> to
                re-sync them.
              </p>
            )}
            {checkResult && <p className="text-xs" style={{ color: 'var(--color-primary)' }}>{checkResult}</p>}
            <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
              Queues every eligible item and prepares it on eBay (or publishes it live, if auto-publish is on). This can take a while for a full
              catalog — feel free to leave this open, or check Settings → eBay Sync later for progress.
            </p>
            <div className="flex justify-end gap-2 flex-wrap">
              <button type="button" onClick={onClose} disabled={checking} className="outline-button text-sm">
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
            <div className="flex justify-end">
              <button type="button" onClick={onClose} className="gold-button text-sm">
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
