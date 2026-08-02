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

function errorMessage(data: unknown, fallback: string): string {
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

export default function EtsyBulkPublishModal({ onClose }: { onClose: () => void }) {
  const [phase, setPhase] = useState<'summary' | 'running' | 'done'>('summary');
  const [readyCount, setReadyCount] = useState<number | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [processed, setProcessed] = useState(0);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  const loadSummary = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/etsy/publish-summary');
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(errorMessage(data, 'Could not load the Etsy publish summary.'));
      setReadyCount((data as EligibilitySummary).readyToPublish ?? 0);
      setSummaryError(null);
    } catch (caught) {
      setSummaryError(caught instanceof Error ? caught.message : 'Could not load the Etsy publish summary.');
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
      let lastRemaining: number | null = null;
      let stallCount = 0;

      while (!done && !cancelledRef.current) {
        const response = await fetch('/api/admin/etsy/sync-batch', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'drain-publish' }),
        });
        const data = (await response.json().catch(() => null)) as DrainResult | null;
        if (!response.ok || !data) throw new Error(errorMessage(data, 'Bulk Etsy publish failed.'));

        setProcessed((current) => current + data.results.length);
        setRemaining(data.remaining);
        done = data.done;
        if (done) break;

        if (data.remaining === lastRemaining) {
          stallCount += 1;
          if (stallCount >= 5) {
            setError('Some drafts are not publishing, so the batch stopped after repeated zero progress. Open an affected product to review its Etsy error, then retry.');
            break;
          }
        } else {
          stallCount = 0;
          lastRemaining = data.remaining;
        }
      }
      setPhase('done');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Bulk Etsy publish failed.');
      setPhase('done');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto whitespace-normal p-4 sm:items-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="flex min-w-0 w-full max-w-md max-h-[calc(100dvh-2rem)] flex-col gap-4 overflow-y-auto border bg-white p-5 [overflow-wrap:anywhere]" style={{ borderColor: 'var(--color-outline-variant)' }}>
        <h3 className="text-lg font-bold" style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}>
          Publish all ready to Etsy
        </h3>

        {phase === 'summary' && (
          <>
            {summaryError && <p className="text-sm" style={{ color: 'var(--color-error)' }}>{summaryError}</p>}
            {!summaryError && readyCount == null && (
              <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>Counting Etsy drafts ready to publish...</p>
            )}
            {readyCount != null && (
              <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
                <strong style={{ color: 'var(--color-primary)' }}>{readyCount}</strong>{' '}
                completed Etsy draft{readyCount === 1 ? '' : 's'} awaiting review.
              </p>
            )}
            {readyCount === 0 && (
              <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                Nothing is waiting. Sync products to Etsy first; review-first listings will appear here when their drafts are complete.
              </p>
            )}
            {readyCount != null && readyCount > 0 && (
              <p className="text-xs" style={{ color: 'var(--color-error)' }}>
                This makes {readyCount} listing{readyCount === 1 ? '' : 's'} <strong>live and public on Etsy immediately</strong>. Review the drafts on Etsy first if needed.
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-2">
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
              Publishing to Etsy... {processed} done | {remaining ?? '?'} remaining
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
                Done. Published {processed} Etsy listing{processed === 1 ? '' : 's'} live.
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
