'use client';

import { useSyncExternalStore } from 'react';
import { SHOWROOM_TIME_ZONE, showroomWeekdayName, type HoursRow } from '@/lib/business-location';

/** The day does not change while someone reads the page — nothing to subscribe to. */
const NO_SUBSCRIPTION = () => () => {};

/** What the server and the hydrating client both see: no day yet. */
const SERVER_SNAPSHOT = () => '';

interface Props {
  /** `hoursRows()` for the live schedule — one row per weekday, localized. */
  rows: HoursRow[];
  /** "Open today" / "Abierto hoy" */
  openLabel: string;
  /** "Closed today" / "Cerrado hoy" */
  closedLabel: string;
  /** "Today" / "Hoy" — the small gold chip. */
  badgeLabel: string;
}

/**
 * The `/card` page's headline hours line: "Open today 11:00 AM – 3:00 PM".
 *
 * Same shape as `ShowroomTodayBadge`, for the same reason: the page is
 * statically prerendered, so a server-rendered "today" would be the BUILD
 * day and wrong for every visitor after midnight. The server (and the first
 * client render) paint an empty line of fixed height; the real day arrives a
 * frame after mount via `useSyncExternalStore`, which is the API built for "a
 * value the server cannot know" and cannot produce a hydration mismatch.
 *
 * ⚠️ Pinned to the SHOWROOM's timezone, never the visitor's — the question is
 * whether the Naples shop is open today in Naples.
 */
export default function CardTodayHours({ rows, openLabel, closedLabel, badgeLabel }: Props) {
  const todayKey = useSyncExternalStore(NO_SUBSCRIPTION, showroomWeekdayName, SERVER_SNAPSHOT);
  const today = todayKey ? rows.find((row) => row.dayKey === todayKey) : undefined;

  return (
    // Fixed minimum height so the line filling in after mount cannot shove the
    // buttons below it — a visitor may already be reaching for "Call".
    <p
      className="flex min-h-[1.75rem] flex-wrap items-center justify-center gap-x-2 text-[0.95rem] font-semibold"
      style={{ color: 'var(--color-on-surface)' }}
      data-showroom-today={SHOWROOM_TIME_ZONE}
      aria-live="polite"
    >
      {today && (
        <>
          <span>
            {today.closed ? closedLabel : `${openLabel} ${today.time}`}
          </span>
          {!today.closed && (
            <span
              className="inline-block rounded-sm px-1.5 py-0.5 text-[0.55rem] font-bold uppercase tracking-[0.12em]"
              style={{
                background: 'var(--color-primary)',
                color: 'var(--color-on-primary)',
                fontFamily: 'var(--font-label)',
              }}
              aria-hidden="true"
            >
              {badgeLabel}
            </span>
          )}
        </>
      )}
    </p>
  );
}
