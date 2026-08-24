'use client';

import { useSyncExternalStore } from 'react';
import { SHOWROOM_TIME_ZONE, showroomWeekdayName } from '@/lib/business-location';

/**
 * The day does not change while someone reads the page, so there is nothing to
 * subscribe to. Defined at module scope because `useSyncExternalStore`
 * resubscribes whenever this reference changes.
 */
const NO_SUBSCRIPTION = () => () => {};

/** What the server and the hydrating client both see: no badge. */
const SERVER_SNAPSHOT = () => false;

/**
 * "Today" marker for one row of the opening-hours list.
 *
 * ⚠️ Renders `null` on the server AND on the first client render, then marks
 * itself in an effect. That is not laziness — it is the only correct shape
 * here, and `ShowroomHours` carried a comment explaining why it had no such
 * badge at all until 2026-08-23:
 *
 * 1. These pages are **statically prerendered**. A server-rendered "today" is
 *    whatever day the BUILD machine ran on, so it would be stale the moment it
 *    shipped and wrong for every visitor after midnight.
 * 2. Rendering it during hydration instead would make the markup depend on the
 *    clock, which is a hydration mismatch by construction.
 *
 * Rendering the server snapshot through hydration and swapping to the client
 * one afterwards means the server HTML and the first client render agree, and
 * the badge appears a frame later.
 *
 * ⚠️ Pinned to the SHOWROOM's timezone, never the visitor's. Someone browsing
 * from London at 02:00 GMT is asking whether the Naples shop is open today in
 * NAPLES — `new Date().getDay()` would answer a different question, and would
 * be off by one for a good part of every day.
 */
export default function ShowroomTodayBadge({
  /** Canonical ENGLISH weekday for this row, e.g. `Tuesday`. */
  dayKey,
  label,
}: {
  dayKey: string;
  label: string;
}) {
  // `useSyncExternalStore` rather than state-in-an-effect: it is the API built
  // for "a value the server cannot know". React renders the server snapshot
  // (false) through hydration, then swaps to the client one, so the markup can
  // never mismatch — and it satisfies the compiler's set-state-in-effect rule
  // instead of working around it. The snapshot is a boolean, so React's Object.is
  // comparison is stable and this cannot loop.
  const isToday = useSyncExternalStore(
    NO_SUBSCRIPTION,
    () => showroomWeekdayName() === dayKey,
    SERVER_SNAPSHOT,
  );

  if (!isToday) return null;

  return (
    <span
      className="ml-2 inline-block rounded-sm px-1.5 py-0.5 align-[1px] text-[0.55rem] font-bold uppercase tracking-[0.12em]"
      style={{
        background: 'var(--color-primary)',
        color: 'var(--color-on-primary)',
        fontFamily: 'var(--font-label)',
      }}
      // The list is already legible without it; announcing "Today" mid-row
      // interrupts the day/time pairing a screen reader is walking through.
      aria-hidden="true"
      data-showroom-today={SHOWROOM_TIME_ZONE}
    >
      {label}
    </span>
  );
}
