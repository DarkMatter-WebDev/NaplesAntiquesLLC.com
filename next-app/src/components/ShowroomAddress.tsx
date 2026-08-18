import { cityLine, landmarkParts, streetLine } from '@/lib/business-location';

interface Props {
  locale?: string;
  className?: string;
}

/**
 * The showroom address as a readable block, for any surface a visitor scans
 * rather than reads in a sentence.
 *
 * Replaces the raw `addressWithLandmark()` string on display surfaces. That
 * string joins the address and the landmark with a middot, and a middot is not
 * a break opportunity — so in a narrow column the line broke wherever it ran
 * out of room, which in the footer meant:
 *
 *     6240 Shirley St, Ste 104, Naples, FL 34109 · inside Sharon
 *     Lynch Collections
 *
 * A business name split across two lines reads as two things. Worse, the whole
 * point of naming Sharon Lynch Collections is wayfinding — it is the sign the
 * visitor is looking for out front, so it is the one phrase that must survive
 * intact.
 *
 * The layout here:
 *
 * - The landmark is its own line, so it can never split, and it drops the
 *   middot — a line break already separates the two facts, and a leading "·"
 *   on a wrapped line is worse than none.
 * - Street and city are separate `nowrap` runs, so if the first line must
 *   break it breaks after "Ste 104," rather than inside "Naples, FL 34109".
 * - The landmark is a step down in weight, which marks it as a qualifier on
 *   the address rather than a second address.
 *
 * ⚠️ Keep using `addressWithLandmark()` for prose and email — a sentence like
 * "Local pickup is free at …" needs the string, and an email cannot take a
 * React element. Both read `landmarkPhrase()`, so they cannot drift.
 */
export default function ShowroomAddress({ locale = 'en', className = '' }: Props) {
  const isEs = locale === 'es';

  return (
    <span className={`block ${className}`}>
      {/* The street line carries the weight: it is the fact someone came for.
          The landmark below is explicitly reset to normal weight so it stays a
          qualifier even when a surface sets the whole block bold. */}
      <span className="block" style={{ fontWeight: 600 }}>
        <span style={{ whiteSpace: 'nowrap' }}>{streetLine()}</span>
        {', '}
        <span style={{ whiteSpace: 'nowrap' }}>{cityLine()}</span>
      </span>
      {/* Only the NAME is `nowrap`. Making the whole clause unbreakable would
          guarantee the line but hand it a cliff: at 320px the Spanish version
          ("dentro de Sharon Lynch Collections") measures 190px inside a 269px
          column, and a font bump or a longer suite name would push an
          unbreakable run straight into horizontal scroll. Letting the
          preposition wrap protects the thing that actually matters — the sign
          the visitor is hunting for — at any width. */}
      <span className="block" style={{ fontWeight: 400, opacity: 0.8 }}>
        {landmarkParts(isEs).lead}
        <span style={{ whiteSpace: 'nowrap' }}>{landmarkParts(isEs).name}</span>
      </span>
    </span>
  );
}
