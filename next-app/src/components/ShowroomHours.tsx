import { Fragment } from 'react';
import ShowroomTodayBadge from '@/components/ShowroomTodayBadge';
import {
  byAppointmentLabel,
  hoursRows,
  hoursRowsGrouped,
} from '@/lib/business-location';

interface Props {
  locale?: string;
  /**
   * `full` lists all seven days, the way Google Maps does — the reference
   * layout, for surfaces someone consults before driving over.
   *
   * `grouped` says the same thing in two rows, for a marketing block that
   * cannot spend seven. See the warning on `hoursRowsGrouped()`: it is the
   * lossy one.
   */
  variant?: 'full' | 'grouped';
  /**
   * WHICH rows is `variant`; this is HOW they are laid out.
   *
   * `inline` (default) shrinks to its content and centres as a unit — right for
   * a footer column or a centred block.
   *
   * `rows` fills its container and separates each day with a hairline, the
   * Google-Maps-style table. Only worth it in a column wide enough to give the
   * time a right edge far from the day.
   */
  layout?: 'inline' | 'rows';
  /**
   * Mark the current day. Off by default and deliberately so: it costs a
   * client component per row, and every surface but the homepage CTA renders
   * this list on pages where the emphasis is not worth that. See
   * `ShowroomTodayBadge` for why it cannot be server-rendered.
   */
  highlightToday?: boolean;
  className?: string;
}

/**
 * Opening hours as a day-then-time list.
 *
 * Replaces `hoursLine()` ("Tue–Sat 11am–3pm, or by appointment") on display
 * surfaces. That single line packs three separate facts — which days, which
 * hours, and that appointments exist — into one run of text, so a reader has to
 * parse a sentence to answer "can I go on Thursday". A two-column list answers
 * it by scanning.
 *
 * Layout notes:
 *
 * - It is a `<dl>`: these are genuinely term/definition pairs, and the markup
 *   should say so for a screen reader rather than faking a table with divs.
 * - The grid is `inline-grid` inside a centering wrapper, so the block shrinks
 *   to its content and centers as a unit while the two columns stay aligned
 *   with each other. A plain centered grid would centre each row individually
 *   and lose the column edge that makes it scannable.
 * - Closed days are dimmed rather than hidden. "Sunday — Closed" is the answer
 *   to a question someone is actually asking; an absent row is not.
 * - **"or by appointment" sits under the list, not beside a row.** It qualifies
 *   every row, so putting it in the time column next to one day would say
 *   something false about that day specifically. A third column would break the
 *   two-column alignment the list exists for.
 *
 * ℹ️ "Today" is OPT-IN via `highlightToday`, and off everywhere but the
 * homepage CTA. The reasoning that used to rule it out entirely still holds and
 * is what shapes the implementation: today is a client-side fact, these pages
 * are statically prerendered, and a server-rendered "today" would be the build
 * date. `ShowroomTodayBadge` therefore renders nothing until after mount, and
 * reads the SHOWROOM's timezone rather than the visitor's. Leaving it off keeps
 * the footer's copy of this list a pure server component on every page.
 */
export default function ShowroomHours({
  locale = 'en',
  variant = 'full',
  layout = 'inline',
  highlightToday = false,
  className = '',
}: Props) {
  const isEs = locale === 'es';
  const rows = variant === 'grouped' ? hoursRowsGrouped(isEs) : hoursRows(isEs);
  const asRows = layout === 'rows';
  const todayLabel = isEs ? 'Hoy' : 'Today';

  return (
    <div className={className}>
      <dl
        className={asRows ? 'grid w-full text-left' : 'inline-grid text-left'}
        style={{
          // `1fr auto` so the time is pinned to the container's right edge
          // rather than sitting wherever the longest day name leaves it.
          gridTemplateColumns: asRows ? '1fr auto' : 'auto auto',
          columnGap: '1.5rem',
          rowGap: asRows ? '0' : '0.3rem',
        }}
      >
        {rows.map((row, index) => {
          // No rule under the last row: the list ends there, and a trailing
          // hairline reads as the top of an empty row.
          const rule = asRows && index < rows.length - 1
            ? '1px solid var(--color-outline-variant)'
            : undefined;
          return (
          <Fragment key={row.day}>
            {/* Weight, not colour, carries the emphasis — these render on four
                surfaces with four different inherited colours, and a hardcoded
                colour here would fight the footer's muted palette. Days sit a
                step under their times: the time is the answer, the day is the
                lookup key. */}
            {/* 0.8, not lower: closed days are muted by OPACITY over four
                different surfaces, and axe measured 0.55 at 2.72:1 on the
                footer's #f3f3f3 and 3.8:1 on the CTA's #f9f9f7 — both under
                the 4.5:1 WCAG AA floor. 0.8 clears 4.5:1 on the worst surface
                while the weight step below still reads as muted. */}
            <dt
              className={asRows ? 'py-2.5' : undefined}
              style={{
                fontWeight: 600,
                opacity: row.closed ? 0.8 : 1,
                // The hairline is drawn by BOTH cells of the row, not by the
                // row (a <dl> grid has no row element to hang it on) and not
                // by the dt alone, which would stop at the day column's edge.
                borderBottom: rule,
              }}
            >
              {row.day}
              {highlightToday && row.dayKey && (
                <ShowroomTodayBadge dayKey={row.dayKey} label={todayLabel} />
              )}
            </dt>
            <dd
              className={asRows ? 'py-2.5 text-right' : 'text-right'}
              style={{
                borderBottom: rule,
                // Tabular figures so every time in the column shares a digit
                // width — without it the colon and the 1s drift and the right
                // edge only looks aligned by luck.
                fontVariantNumeric: 'tabular-nums',
                fontWeight: row.closed ? 500 : 700,
                opacity: row.closed ? 0.8 : 1, // same 4.5:1 floor as the dt above
                whiteSpace: 'nowrap',
              }}
            >
              {row.time}
            </dd>
          </Fragment>
          );
        })}
      </dl>

      {/* Smallest thing here on purpose: it is a footnote to the whole list,
          and it must not compete with the days it qualifies. */}
      {/* Opacity 0.8 is the contrast floor here too (0.7 measured 3.85:1 on
          the footer); the smaller size alone keeps it subordinate. */}
      <p className="mt-2.5 text-[0.9em]" style={{ opacity: 0.8 }}>
        {byAppointmentLabel(isEs)}
      </p>
    </div>
  );
}
