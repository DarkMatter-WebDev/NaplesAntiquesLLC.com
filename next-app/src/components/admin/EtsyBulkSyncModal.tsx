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

/** Phase 2 bulk action (etsy-sync-plan/07-admin-ux.md §3): pre-flight summary -> confirm -> drain the queue with progress -> stop-after-current cancel. */
export default function EtsyBulkSyncModal({ onClose }: { onClose: () => void }) {
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
    const run = async () => { await loadSummary(); };
    void run();
  }, [loadSummary]);

  // "Check Etsy statuses" — reconcile every linked listing's local state to
  // what Etsy actually reports (read-only; no content re-pushed). Recovers
  // items stuck in 'error' after a transient failure, then refreshes the counts
  // so those move out of the "errors" bucket and become syncable again.
  const checkAll = async () => {
    setChecking(true);
    setCheckResult(null);
    try {
      const res = await fetch('/api/admin/etsy/verify-all', { method: 'POST' });
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
        body: JSON.stringify({ action: 'enqueue-all-eligible' }),
      });
      const enqueueData = await enqueueRes.json().catch(() => null);
      if (!enqueueRes.ok) throw new Error(enqueueData?.error || 'Could not queue products.');
      setQueued(enqueueData.queued ?? 0);

      let done = false;
      // Stall guard: if 'remaining' stops shrinking across several polls, the
      // queue isn't draining (an item that never leaves the queue would
      // otherwise loop forever — the 2026-07-08 runaway). A legitimate slow
      // multi-photo item keeps 'remaining' flat for at most ~3 polls, so 5
      // identical readings means genuinely stuck. (The server also bounds each
      // pass; this is the outer bound on the poll loop.)
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
        setProcessed((current) => current + data.results.length);
        setRemaining(data.remaining);
        done = data.done;
        if (done) break;
        if (data.remaining === lastRemaining) {
          stall += 1;
          if (stall >= 5) {
            setError('Some items aren’t progressing (the queue stopped shrinking) — stopped to avoid hammering Etsy. Sync those products individually to see the error, then retry.');
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
          Sync all to Etsy
        </h3>

        {phase === 'summary' && (
          <>
            {summaryError && <p className="text-sm" style={{ color: 'var(--color-error)' }}>{summaryError}</p>}
            {!summaryError && !summary && <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>Checking eligibility…</p>}
            {summary && (
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
            {summary && summary.errors > 0 && (
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
            <div className="flex justify-end gap-2 flex-wrap">
              <button type="button" onClick={onClose} disabled={checking} className="outline-button text-sm">
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
                Done — processed {processed} product{processed === 1 ? '' : 's'}. Check each item&apos;s Etsy status in its drawer, or Settings → Etsy
                Sync for the activity log.
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
