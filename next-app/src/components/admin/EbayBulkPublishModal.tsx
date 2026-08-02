'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface EligibilitySummary {
  readyToPublish: number;
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

/**
 * Bulk go-live: publishes every listing sitting in the "Ready to publish"
 * (review) state. The counterpart to EbayBulkSyncModal, but PUBLISH is a
 * distinct, deliberate action (Q1 review-first) — there's no enqueue step;
 * the items are already prepared, so this just drains the 'review' queue via
 * the `drain-publish` batch action with the same stall-guarded progress loop.
 */
export default function EbayBulkPublishModal({ onClose }: { onClose: () => void }) {
  const [phase, setPhase] = useState<'summary' | 'running' | 'done'>('summary');
  const [readyCount, setReadyCount] = useState<number | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [processed, setProcessed] = useState(0);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  // No setState before the first await (react-hooks/set-state-in-effect) —
  // same fetch-first pattern as EbayBulkSyncModal.loadSummary.
  const loadSummary = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/ebay/eligibility-summary');
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(errorMessage(data, 'Could not load the publish summary.'));
      setReadyCount((data as EligibilitySummary).readyToPublish ?? 0);
      setSummaryError(null);
    } catch (err) {
      setSummaryError(err instanceof Error ? err.message : 'Could not load the publish summary.');
    }
  }, []);

  useEffect(() => {
    const run = async () => { await loadSummary(); };
    void run();
  }, [loadSummary]);

  const start = async () => {
    cancelledRef.current = false;
    setError(null);
    setPhase('running');
    try {
      let done = false;
      // Stall guard: if 'remaining' stops shrinking across several polls, the
      // queue isn't draining — stop rather than loop forever (same guard as
      // EbayBulkSyncModal.start).
      let lastRemaining: number | null = null;
      let stall = 0;
      while (!done && !cancelledRef.current) {
        const res = await fetch('/api/admin/ebay/sync-batch', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'drain-publish' }),
        });
        const data = (await res.json().catch(() => null)) as DrainResult | null;
        if (!res.ok || !data) throw new Error(errorMessage(data, 'Bulk publish failed.'));
        setProcessed((current) => current + data.results.length);
        setRemaining(data.remaining);
        done = data.done;
        if (done) break;
        if (data.remaining === lastRemaining) {
          stall += 1;
          if (stall >= 5) {
            setError('Some items aren’t publishing (the queue stopped shrinking) — stopped to avoid hammering eBay. Open one in its drawer and click Publish to see the specific error, then retry.');
            break;
          }
        } else {
          stall = 0;
          lastRemaining = data.remaining;
        }
      }
      setPhase('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk publish failed.');
      setPhase('done');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto whitespace-normal p-4 sm:items-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="min-w-0 w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto border bg-white p-5 flex flex-col gap-4 [overflow-wrap:anywhere]" style={{ borderColor: 'var(--color-outline-variant)' }}>
        <h3 className="text-lg font-bold" style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}>
          Publish all ready to eBay
        </h3>

        {phase === 'summary' && (
          <>
            {summaryError && <p className="text-sm" style={{ color: 'var(--color-error)' }}>{summaryError}</p>}
            {!summaryError && readyCount == null && (
              <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>Counting listings ready to publish…</p>
            )}
            {readyCount != null && (
              <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
                <strong style={{ color: 'var(--color-primary)' }}>{readyCount}</strong>{' '}
                listing{readyCount === 1 ? '' : 's'} in the &ldquo;Ready to publish&rdquo; state.
              </p>
            )}
            {readyCount === 0 && (
              <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                Nothing is waiting. Sync items to eBay first (they land in &ldquo;Ready to publish&rdquo;), then publish them here.
              </p>
            )}
            {readyCount != null && readyCount > 0 && (
              <p className="text-xs" style={{ color: 'var(--color-error)' }}>
                This makes {readyCount} listing{readyCount === 1 ? '' : 's'} <strong>live and public on eBay immediately</strong> — buyable right
                away. Review a few in their drawers first if you haven&apos;t. This can take a while for a large queue; leave this open or check back
                later.
              </p>
            )}
            <div className="flex justify-end gap-2 flex-wrap">
              <button type="button" onClick={onClose} className="outline-button text-sm">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void start()}
                disabled={!readyCount}
                className="gold-button text-sm disabled:opacity-50"
              >
                Publish {readyCount ? `${readyCount} ` : ''}live
              </button>
            </div>
          </>
        )}

        {phase === 'running' && (
          <>
            <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
              Publishing… {processed} done · {remaining ?? '?'} remaining
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
                Done — published {processed} listing{processed === 1 ? '' : 's'}. Check each item&apos;s eBay status in its drawer, or Settings →
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
