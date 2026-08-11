/**
 * Health of a marketplace's daily scheduled price push, for the Admin Settings
 * last-run card. Shared by the Etsy and eBay status routes — the two schedules
 * differ only by their UTC fire time.
 *
 * Why this exists (2026-08-10): the card used to render a green check and
 * "Ready for Daily at 11:45 UTC. No completed run has been recorded yet."
 * whenever no `scheduled_price_push` row was found. That is exactly the state a
 * shop is in when the cron is silently broken, and it read as reassurance — the
 * Netlify scheduled functions had never once invoked (zero `scheduled_price_push`
 * rows across 1,538 Etsy and 56,480 eBay log rows, and zero `scheduled_drip`
 * rows for the two social workers on the same schedule mechanism) and nothing in
 * the app said so. "Never ran" and "ran and is now stale" are both faults and
 * must look like faults.
 */

/** Ordered by severity so a caller can pick an icon/colour without a lookup table. */
export type PricePushHealth =
  /** The cron secret is absent from the deployed runtime — the route would 401. */
  | 'not_configured'
  /** The owner turned daily pushes off. Not a fault. */
  | 'disabled'
  /** Enabled and configured, but no scheduled run has EVER been recorded. */
  | 'never_run'
  /** Ran before, but not since the most recent scheduled fire time. */
  | 'overdue'
  /** Ran within the current schedule window. */
  | 'ok';

/**
 * Minutes of slack after a scheduled fire time before the run counts as missed.
 *
 * A push takes well under a minute, but Netlify does not promise to-the-second
 * scheduling and the run has to finish and write its log row. An hour is long
 * enough that a normal late start never flips the card to a fault, and short
 * enough that a genuinely dead cron is visible the same morning.
 */
export const PRICE_PUSH_GRACE_MINUTES = 60;

/**
 * The most recent daily occurrence of `hour:minute` UTC strictly at or before
 * `now`. Always exists — worst case it is yesterday's.
 */
export function previousScheduledRun(hour: number, minute: number, now: Date): Date {
  const candidate = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    hour,
    minute,
    0,
    0,
  ));
  if (candidate.getTime() > now.getTime()) candidate.setUTCDate(candidate.getUTCDate() - 1);
  return candidate;
}

export function resolvePricePushHealth(params: {
  enabled: boolean;
  cronSecretConfigured: boolean;
  /** ISO timestamp of the newest `scheduled_price_push` log row, or null. */
  lastRunAt: string | null;
  /** UTC hour the Netlify schedule fires (Etsy 11:15, eBay 11:45). */
  scheduleUtcHour: number;
  scheduleUtcMinute: number;
  now?: Date;
  graceMinutes?: number;
}): PricePushHealth {
  // Order matters: a missing secret is the more actionable fault, and the
  // disabled toggle is the owner's deliberate choice rather than a problem.
  if (!params.cronSecretConfigured) return 'not_configured';
  if (!params.enabled) return 'disabled';

  const now = params.now ?? new Date();
  const grace = params.graceMinutes ?? PRICE_PUSH_GRACE_MINUTES;
  // Subtract the grace BEFORE picking the occurrence, so during the grace
  // window the comparison point is the previous day's fire time rather than
  // this morning's — otherwise a healthy push looks overdue for an hour.
  const deadline = previousScheduledRun(
    params.scheduleUtcHour,
    params.scheduleUtcMinute,
    new Date(now.getTime() - grace * 60_000),
  );

  if (!params.lastRunAt) return 'never_run';
  const lastRun = new Date(params.lastRunAt);
  if (Number.isNaN(lastRun.getTime())) return 'never_run';
  return lastRun.getTime() >= deadline.getTime() ? 'ok' : 'overdue';
}

/** True when the card should render as a fault rather than a green check. */
export function isPricePushFault(health: PricePushHealth): boolean {
  return health === 'not_configured' || health === 'never_run' || health === 'overdue';
}

export interface PricePushCardCopy {
  icon: 'check_circle' | 'warning' | 'error';
  tone: 'ok' | 'warning' | 'error';
  text: string;
}

/**
 * One presenter for both Settings panels, so the Etsy and eBay cards cannot
 * drift apart — they were byte-identical ternaries in two files before this.
 *
 * `lastRunAtLabel` is pre-formatted by the caller: the panels are client
 * components and format in the viewer's locale, while this module is also
 * imported by the server status routes.
 */
export function describePricePushHealth(params: {
  health: PricePushHealth;
  /** Human schedule string, e.g. "Daily at 11:45 UTC". */
  schedule: string;
  /** Env var name to cite when it is missing, e.g. "EBAY_CRON_SECRET". */
  cronSecretName: string;
  lastRunOutcome: 'ok' | 'warning' | 'error' | null;
  lastRunMessage: string | null;
  lastRunAtLabel: string | null;
}): PricePushCardCopy {
  switch (params.health) {
    case 'not_configured':
      return {
        icon: 'warning',
        tone: 'warning',
        text: `Not ready: ${params.cronSecretName} is missing from the deployed runtime.`,
      };
    case 'disabled':
      return {
        icon: 'warning',
        tone: 'warning',
        text: `${params.schedule}; currently disabled by the setting above.`,
      };
    case 'never_run':
      // Deliberately a fault, not "Ready for …". This is the state a shop sits
      // in when the Netlify schedule is registered but never invoking, and the
      // old green-check copy actively hid it.
      return {
        icon: 'error',
        tone: 'error',
        text: `${params.schedule} is enabled, but no scheduled run has ever been recorded. `
          + 'The schedule is not firing — check the function log in Netlify.',
      };
    case 'overdue':
      return {
        icon: 'error',
        tone: 'error',
        text: `Last scheduled run ${params.lastRunAtLabel ?? 'unknown'}, but ${params.schedule.toLowerCase()} `
          + 'has not run since. Check the function log in Netlify.',
      };
    case 'ok':
    default: {
      // The stored message is a full sentence ending in '.', so append one only
      // when it is missing rather than rendering "0 deferred..".
      const detail = (params.lastRunMessage ?? params.lastRunOutcome ?? 'ok').replace(/\.\s*$/, '');
      return {
        icon: params.lastRunOutcome === 'error'
          ? 'error'
          : params.lastRunOutcome === 'warning'
            ? 'warning'
            : 'check_circle',
        tone: params.lastRunOutcome === 'error'
          ? 'error'
          : params.lastRunOutcome === 'warning'
            ? 'warning'
            : 'ok',
        text: `Last run ${params.lastRunAtLabel ?? 'unknown'}: ${detail}.`,
      };
    }
  }
}
