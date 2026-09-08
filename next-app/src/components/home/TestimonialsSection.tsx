import { CardGrid, PageContainer, Section } from '@/components/layout/ResponsiveLayout';
import { TESTIMONIALS } from '@/lib/testimonials';
import TestimonialCard from './TestimonialCard';
import TestimonialMarqueeBand from './TestimonialMarqueeBand';

// Curated customer testimonials, shared by the homepage and product pages so
// there is exactly one review list (src/lib/testimonials.ts) and one card
// (TestimonialCard.tsx — the /reviews page renders the same card). Server-rendered;
// the marquee's MOVEMENT is pure CSS, and its one piece of client JS is the
// tiny TestimonialMarqueeBand island, which only pauses the animation while
// the band is offscreen (an IntersectionObserver, no per-frame work — the
// cards themselves stay server-rendered children). Renders nothing at all if
// the curated list is ever emptied — an empty "reviews" section is worse than
// none.

type Props = {
  locale: string;
  /**
   * Product-page presentation: tighter vertical rhythm and a smaller heading,
   * so the band reads as a footnote to the piece rather than a second hero.
   */
  compact?: boolean;
  /**
   * `marquee` is the homepage band (2026-08-18): one continuously scrolling
   * full-bleed row. `grid` is the original 2/4-column block and is still what
   * product pages render — a page about one item should not have a moving
   * element competing with the photography.
   */
  variant?: 'grid' | 'marquee';
};

/**
 * Cards visible in one half of the marquee track, at minimum.
 *
 * The loop works by translating the track exactly -50%, so the track holds two
 * identical halves and each half must be wide enough to cover the viewport on
 * its own — otherwise a gap of empty space walks across the screen once per
 * cycle. Eight cards at 20rem is ~2720px, which clears any realistic display.
 */
const MIN_CARDS_PER_HALF = 8;

/**
 * Seconds a single card takes to cross its own width. Duration is derived from
 * the card count rather than hardcoded, so adding reviews makes the band longer
 * instead of making it faster.
 */
const SECONDS_PER_CARD = 7;

export default function TestimonialsSection({ locale, compact = false, variant = 'grid' }: Props) {
  const isEs = locale === 'es';
  if (TESTIMONIALS.length === 0) return null;

  const heading = (
    <>
      <p
        className="text-center text-[0.65rem] font-bold uppercase tracking-[0.35em] mb-3"
        style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}
      >
        {isEs ? 'Lo Que Dicen Los Clientes' : 'What Clients Say'}
      </p>
      <h2
        className={`text-center font-bold tracking-tight ${compact ? 'text-2xl mb-8' : 'responsive-title-lg mb-10'}`}
        style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}
      >
        {isEs ? 'De Confianza en el Suroeste de Florida' : 'Trusted Across Southwest Florida'}
      </h2>
    </>
  );

  /**
   * Rendered by BOTH variants, which is why the review CTA lives here rather
   * than beside either layout — the marquee (homepage) and the grid (product
   * pages) both end with this block.
   *
   * A plain <a>, never next/link: `/review` is a route handler that 302s to
   * Google, and a client-side navigation has no page to render. `_blank` keeps
   * the visitor's place on the site, matching the per-card "Read on Google".
   *
   * ⚠️ The aria-label must BEGIN with the visible text or axe flags
   * label-content-name-mismatch — same rule as the card links below.
   */
  const footnote = (
    <div className="mt-8 text-center">
      <a
        href="/review"
        className="outline-button"
        target="_blank"
        rel="noopener noreferrer"
        aria-label={
          isEs
            ? 'Dejar una Reseña en Google (se abre en una pestaña nueva)'
            : 'Leave a Review on Google (opens in a new tab)'
        }
      >
        {isEs ? 'Dejar una Reseña' : 'Leave a Review'}
      </a>
      <p className="mt-3 text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
        {isEs ? 'Reseñas de clientes en Google.' : 'Client reviews on Google.'}
      </p>
    </div>
  );

  if (variant === 'marquee') {
    const repeatsPerHalf = Math.max(1, Math.ceil(MIN_CARDS_PER_HALF / TESTIMONIALS.length));
    const cardsPerHalf = repeatsPerHalf * TESTIMONIALS.length;
    const durationSeconds = cardsPerHalf * SECONDS_PER_CARD;

    return (
      <Section className="border-t" style={{ borderColor: 'var(--color-outline-variant)' }}>
        <PageContainer>{heading}</PageContainer>

        {/* Deliberately OUTSIDE PageContainer. `Section` carries only vertical
            padding, so the band runs edge to edge — a marquee that stopped at
            the text column would read as a widget, not a banner.

            `data-customer-reveal-skip` is required, not cosmetic. CustomerReveal
            matches `main [class*="card"]` and stamps every match
            `data-customer-reveal="pending"` (opacity 0) until an observer
            reveals it. Inside a moving track, the cards that start off-screen
            may never be observed, so the band would scroll a procession of
            invisible cards. `closest()` is what CustomerReveal tests, so this
            one attribute on the wrapper excludes every card beneath it. */}
        <TestimonialMarqueeBand
          trackStyle={{ '--testimonial-marquee-duration': `${durationSeconds}s` } as React.CSSProperties}
        >
          {Array.from({ length: repeatsPerHalf * 2 }).flatMap((_, pass) =>
            TESTIMONIALS.map((review) =>
              <TestimonialCard key={`${review.name}-${pass}`} review={review} isEs={isEs} isRepeat={pass > 0} />,
            ),
          )}
        </TestimonialMarqueeBand>

        <PageContainer>{footnote}</PageContainer>
      </Section>
    );
  }

  return (
    <Section className="border-t" style={{ borderColor: 'var(--color-outline-variant)' }}>
      <PageContainer>
        {heading}
        {/* 2 / 4 columns — never 1 and never 3. Two is the floor (owner,
            2026-08-09): the reviews stay side by side at every width so the
            band reads as a body of reviews rather than one lone testimonial.
            Three is skipped because the shared grid's auto-fit picked it in the
            ~850-1150px band, which left the fourth review alone on a second row
            the moment one was added (2026-08-05). Layout, and the narrow-width
            compaction that a 2-up phone needs, live in `.testimonial-grid` /
            `.testimonial-card` (globals.css). */}
        <CardGrid className="testimonial-grid">
          {TESTIMONIALS.map((review) => (
            <TestimonialCard key={review.name} review={review} isEs={isEs} />
          ))}
        </CardGrid>
        {footnote}
      </PageContainer>
    </Section>
  );
}
