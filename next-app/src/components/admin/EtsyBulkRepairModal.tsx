'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface RepairSummary {
  total: number;
  outOfDate: number;
  incomplete: number;
}

interface DrainResult {
  done: boolean;
  remaining: number;
  results: { productId: string; syncState: string; done: boolean }[];
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

export default function EtsyBulkRepairModal({ onClose }: { onClose: (completed?: boolean) => void }) {
  const [phase, setPhase] = useState<'summary' | 'running' | 'done'>('summary');
  const [summary, setSummary] = useState<RepairSummary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [processed, setProcessed] = useState(0);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  const loadSummary = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/etsy/repair-summary');
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(errorMessage(data, 'Could not inspect Etsy sync issues.'));
      setSummary(data as RepairSummary);
      setSummaryError(null);
    } catch (caught) {
      setSummaryError(caught instanceof Error ? caught.message : 'Could not inspect Etsy sync issues.');
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
      let zeroProgressPasses = 0;

      while (!done && !cancelledRef.current) {
        const response = await fetch('/api/admin/etsy/sync-batch', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'drain-repair' }),
        });
        const data = (await response.json().catch(() => null)) as DrainResult | null;
        if (!response.ok || !data) throw new Error(errorMessage(data, 'Etsy repair failed.'));

        setProcessed((current) => current + data.results.filter((result) => result.done).length);
        setRemaining(data.remaining);
        done = data.done;
        if (done) break;

        if (data.results.length === 0 && data.remaining === lastRemaining) {
          zeroProgressPasses += 1;
          if (zeroProgressPasses >= 5) {
            setError('The repair queue stopped making progress. No further Etsy requests were sent. Review the item errors, then retry.');
            break;
          }
        } else {
          zeroProgressPasses = 0;
        }
        lastRemaining = data.remaining;
      }
      setPhase('done');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Etsy repair failed.');
      setPhase('done');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto whitespace-normal p-4 sm:items-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="flex min-w-0 w-full max-w-md max-h-[calc(100dvh-2rem)] flex-col gap-4 overflow-y-auto border bg-white p-5 [overflow-wrap:anywhere]" style={{ borderColor: 'var(--color-outline-variant)' }}>
        <h3 className="text-lg font-bold" style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}>
          Repair all Etsy sync issues
        </h3>

        {phase === 'summary' && (
          <>
            {summaryError && <p className="text-sm" style={{ color: 'var(--color-error)' }}>{summaryError}</p>}
            {!summaryError && !summary && <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>Inspecting linked Etsy listings...</p>}
            {summary && (
              <div className="text-sm flex flex-col gap-1" style={{ color: 'var(--color-on-surface-variant)' }}>
                <p><strong style={{ color: 'var(--color-primary)' }}>{summary.total}</strong> linked listing{summary.total === 1 ? '' : 's'} can be repaired.</p>
                <p className="text-xs">{summary.outOfDate} sync-needed | {summary.incomplete} interrupted before completion</p>
              </div>
            )}
            <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
              Completes every remaining image batch, inventory update, and listing copy. Active listings stay active, drafts stay drafts, and unavailable Etsy listings are skipped.
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => onClose(false)} className="outline-button text-sm">Cancel</button>
              <button
                type="button"
                onClick={() => void start()}
                disabled={!summary?.total}
                className="gold-button text-sm disabled:opacity-50"
              >
                Repair {summary?.total ? `${summary.total} ` : ''}now
              </button>
            </div>
          </>
        )}

        {phase === 'running' && (
          <>
            <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
              Repairing Etsy listings... {processed} complete | {remaining ?? '?'} remaining
            </p>
            <div className="flex justify-end">
              <button type="button" onClick={() => { cancelledRef.current = true; }} className="outline-button text-sm">Stop after current step</button>
            </div>
          </>
        )}

        {phase === 'done' && (
          <>
            {error ? (
              <p className="text-sm" style={{ color: 'var(--color-error)' }}>{error}</p>
            ) : (
              <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
                Done. Repaired {processed} Etsy listing{processed === 1 ? '' : 's'}.
              </p>
            )}
            <div className="flex justify-end">
              <button type="button" onClick={() => onClose(!error && !cancelledRef.current)} className="gold-button text-sm">Close</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
