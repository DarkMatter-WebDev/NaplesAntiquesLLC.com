/**
 * The "30-minute checks" card in Admin Settings → Etsy / eBay: when the
 * scheduled sales sweep + status reconcile last ran, and what it found.
 *
 * Why this exists (2026-09-14): the panel only said when sales watching
 * STARTED, so a stalled scheduler looked exactly like a quiet day — and a
 * stalled check is how a sold item stays live on the other marketplace. Both
 * sweeps log a summary row on every run, clean or not (see
 * `reconcileEtsyStatusDrift`), so the age of the newest summary row is the
 * heartbeat.
 *
 * Pure and shared: the status routes pass the rows through, the client panels
 * format the time and call `describeStatusChecks` with the viewer's clock.
 */
import { PRICE_PUSH_RUN_HISTORY_HINT, type PricePushCardCopy } from './marketplace-price-push-health';

/**
 * Minutes without a check before the card turns red. The job fires every 30
 * minutes, so 60 means two missed runs — one late start never flips it
 * (owner-approved 2026-09-14).
 */
export const STATUS_CHECK_STALE_MINUTES = 60;

/**
 * A sales row belongs to a check when it was written at most this long before
 * the reconcile row. The route runs the sales sweep first (15 s budget), then
 * the reconcile (20 s budget), in one request.
 */
const SALES_ROW_PAIRING_MS = 5 * 60_000;

export interface StatusCheckRow {
  createdAt: string;
  outcome: 'ok' | 'warning' | 'error';
  message: string | null;
  detail: unknown;
}

export type StatusCheckHealth = 'never_run' | 'stalled' | 'ok';

export function resolveStatusCheckHealth(
  lastCheckAt: string | null,
  now: Date = new Date(),
  staleMinutes: number = STATUS_CHECK_STALE_MINUTES,
): StatusCheckHealth {
  if (!lastCheckAt) return 'never_run';
  const at = new Date(lastCheckAt).getTime();
  if (Number.isNaN(at)) return 'never_run';
  return now.getTime() - at > staleMinutes * 60_000 ? 'stalled' : 'ok';
}

/**
 * "10:00 PM ET" for a check within the last 20 hours, "9/12, 10:00 PM ET"
 * beyond that. The owner's clock, whatever the admin's browser is set to.
 */
export function formatStatusCheckTime(iso: string, now: Date = new Date()): string {
  const at = new Date(iso);
  const zone = { timeZone: 'America/New_York' } as const;
  const time = at.toLocaleTimeString('en-US', { ...zone, hour: 'numeric', minute: '2-digit' });
  if (now.getTime() - at.getTime() < 20 * 60 * 60_000) return `${time} ET`;
  return `${at.toLocaleDateString('en-US', { ...zone, month: 'numeric', day: 'numeric' })}, ${time} ET`;
}

/** "less than a minute", "12 min", "2 h 14 min", "3 days". */
export function formatElapsed(ms: number): string {
  const minutes = Math.max(0, Math.floor(ms / 60_000));
  if (minutes < 1) return 'less than a minute';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours >= 48) return `${Math.floor(hours / 24)} days`;
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

function count(detail: unknown, key: string): number | null {
  if (!detail || typeof detail !== 'object') return null;
  const value = (detail as Record<string, unknown>)[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** The sales row written by the same run as `check`, or null. */
export function pairedSalesRow(check: StatusCheckRow, sales: StatusCheckRow | null): StatusCheckRow | null {
  if (!sales) return null;
  const gap = new Date(check.createdAt).getTime() - new Date(sales.createdAt).getTime();
  return gap >= 0 && gap <= SALES_ROW_PAIRING_MS ? sales : null;
}

/**
 * "134 listings checked, 0 sales, nothing to fix". Falls back to the row's own
 * message for rows without counts (a skipped or failed run).
 */
export function summarizeStatusCheck(check: StatusCheckRow, sales: StatusCheckRow | null): string {
  const scanned = count(check.detail, 'scanned');
  if (scanned === null) return (check.message ?? check.outcome).replace(/\.\s*$/, '');

  const parts = [`${plural(scanned, 'listing')} checked`];
  const paired = pairedSalesRow(check, sales);
  if (paired?.outcome === 'error') {
    parts.push('the sales check failed');
  } else if (paired) {
    const sold = count(paired.detail, 'sold');
    const reduced = count(paired.detail, 'decremented');
    if (sold !== null || reduced !== null) parts.push(plural((sold ?? 0) + (reduced ?? 0), 'sale'));
  }

  const drifted = count(check.detail, 'drifted') ?? 0;
  if (drifted === 0) {
    parts.push('nothing to fix');
  } else {
    const fixed = (count(check.detail, 'repaired') ?? 0) + (count(check.detail, 'reconciled') ?? 0);
    const failed = count(check.detail, 'failed') ?? 0;
    const remaining = count(check.detail, 'remaining') ?? 0;
    if (fixed) parts.push(`${fixed} fixed`);
    if (failed) parts.push(`${failed} still out of sync`);
    if (remaining) parts.push(`${remaining} left for the next check`);
  }
  return parts.join(', ');
}

export function describeStatusChecks(params: {
  lastCheck: StatusCheckRow | null;
  lastSales: StatusCheckRow | null;
  /** Pre-formatted by the caller in the owner's time zone, e.g. "10:00 PM ET". */
  lastCheckAtLabel: string | null;
  now?: Date;
}): PricePushCardCopy {
  const now = params.now ?? new Date();
  const health = resolveStatusCheckHealth(params.lastCheck?.createdAt ?? null, now);

  if (health === 'never_run' || !params.lastCheck) {
    return {
      icon: 'error',
      tone: 'error',
      text: 'No 30-minute check has been recorded yet — sold items may stay live on the other marketplace. '
        + PRICE_PUSH_RUN_HISTORY_HINT,
    };
  }

  const check = params.lastCheck;
  const when = `Last check ${formatElapsed(now.getTime() - new Date(check.createdAt).getTime())} ago`
    + (params.lastCheckAtLabel ? ` (${params.lastCheckAtLabel})` : '');

  if (health === 'stalled') {
    return {
      icon: 'error',
      tone: 'error',
      text: `${when} — sold items may stay live on the other marketplace until it runs again. ${PRICE_PUSH_RUN_HISTORY_HINT}`,
    };
  }

  if (check.outcome === 'error') {
    return {
      icon: 'error',
      tone: 'error',
      text: `${when} failed: ${(check.message ?? 'no details recorded').replace(/\.\s*$/, '')}.`,
    };
  }

  const salesFailed = pairedSalesRow(check, params.lastSales)?.outcome === 'error';
  const warn = check.outcome === 'warning' || salesFailed;
  return {
    icon: warn ? 'warning' : 'check_circle',
    tone: warn ? 'warning' : 'ok',
    text: `${when}: ${summarizeStatusCheck(check, params.lastSales)}.`,
  };
}
