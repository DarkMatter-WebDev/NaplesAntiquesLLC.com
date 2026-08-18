import { Fragment } from 'react';
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
 * ℹ️ Deliberately does NOT bold "today" the way Google Maps does. Today is a
 * client-side fact — the server renders in its own timezone and these pages are
 * statically prerendered, so a server-rendered "today" would be wrong for real
 * visitors and a client-rendered one would cost a hydration pass on the footer
 * of every page. Not worth it for emphasis.
 */
export default function ShowroomHours({
  locale = 'en',
  variant = 'full',
  className = '',
}: Props) {
  const isEs = locale === 'es';
  const rows = variant === 'grouped' ? hoursRowsGrouped(isEs) : hoursRows(isEs);

  return (
    <div className={className}>
      <dl
        className="inline-grid text-left"
        style={{
          gridTemplateColumns: 'auto auto',
          columnGap: '1.5rem',
          rowGap: '0.3rem',
        }}
      >
        {rows.map((row) => (
          <Fragment key={row.day}>
            {/* Weight, not colour, carries the emphasis — these render on four
                surfaces with four different inherited colours, and a hardcoded
                colour here would fight the footer's muted palette. Days sit a
                step under their times: the time is the answer, the day is the
                lookup key. */}
            <dt style={{ fontWeight: 600, opacity: row.closed ? 0.55 : 1 }}>
              {row.day}
            </dt>
            <dd
              className="text-right"
              style={{
                // Tabular figures so every time in the column shares a digit
                // width — without it the colon and the 1s drift and the right
                // edge only looks aligned by luck.
                fontVariantNumeric: 'tabular-nums',
                fontWeight: row.closed ? 500 : 700,
                opacity: row.closed ? 0.55 : 1,
                whiteSpace: 'nowrap',
              }}
            >
              {row.time}
            </dd>
          </Fragment>
        ))}
      </dl>

      {/* Smallest thing here on purpose: it is a footnote to the whole list,
          and it must not compete with the days it qualifies. */}
      <p className="mt-2.5 text-[0.9em]" style={{ opacity: 0.7 }}>
        {byAppointmentLabel(isEs)}
      </p>
    </div>
  );
}
