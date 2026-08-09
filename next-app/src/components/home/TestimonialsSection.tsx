import { CardGrid, PageContainer, Section } from '@/components/layout/ResponsiveLayout';
import { GOOGLE_REVIEWS_URL, TESTIMONIALS } from '@/lib/testimonials';

// Curated customer testimonials, shared by the homepage and product pages so
// there is exactly one review list (src/lib/testimonials.ts). Server-rendered,
// no client JS. Renders nothing at all if the curated list is ever emptied —
// an empty "reviews" section is worse than none.

type Props = {
  locale: string;
  /**
   * Product-page presentation: tighter vertical rhythm and a smaller heading,
   * so the band reads as a footnote to the piece rather than a second hero.
   */
  compact?: boolean;
};

export default function TestimonialsSection({ locale, compact = false }: Props) {
  const isEs = locale === 'es';
  if (TESTIMONIALS.length === 0) return null;

  return (
    <Section className="border-t" style={{ borderColor: 'var(--color-outline-variant)' }}>
      <PageContainer>
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
            // `product-light-surface`: this card is always white, so on a dark
            // product page (where these reviews also render) it has to restore
            // the light text tokens — otherwise the quote inherits near-white
            // type onto white. Inert everywhere else, including the homepage.
            <figure
              key={review.name}
              className="testimonial-card product-light-surface rounded-2xl border bg-white"
              style={{ borderColor: 'var(--color-outline-variant)' }}
            >
              <div className="testimonial-stars" aria-hidden="true" style={{ color: '#e9c349' }}>
                ★★★★★
              </div>
              {/* The quote is truncated in CSS (`-webkit-line-clamp`), never in
                  JS. The full verbatim text stays in the DOM for screen readers
                  and crawlers, and nothing here can accidentally become an
                  edited version of a customer's words — the rule in
                  `lib/testimonials.ts`. The card links to Google, where the
                  untruncated review lives. */}
              <blockquote style={{ color: 'var(--color-on-surface)' }}>
                &ldquo;{isEs ? review.quoteEs : review.quote}&rdquo;
              </blockquote>
              <figcaption className="mt-auto pt-2" style={{ color: 'var(--color-on-surface-variant)' }}>
                <strong style={{ color: 'var(--color-on-surface)' }}>{review.name}</strong>
                {' · '}
                {isEs ? review.metaEs : review.meta}
              </figcaption>
              {/* The whole card is clickable via this link's stretched
                  ::after overlay, rather than an <a> wrapping the figure. That
                  keeps the figure/figcaption semantics intact and gives the
                  link a short accessible name — wrapping the card would make
                  the entire 480-character quote the link text.

                  Do NOT rename this class to anything containing "card": that
                  substring makes CustomerReveal stamp the anchor, which turns
                  it into a containing block and silently collapses the overlay.
                  Full explanation sits with the rule in globals.css. */}
              <a
                className="testimonial-google-link"
                href={GOOGLE_REVIEWS_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={
                  isEs
                    ? `Leer la reseña completa de ${review.name} en Google (se abre en una pestaña nueva)`
                    : `Read ${review.name}'s full review on Google (opens in a new tab)`
                }
              >
                {isEs ? 'Leer en Google' : 'Read on Google'}
                <span aria-hidden="true"> →</span>
              </a>
            </figure>
          ))}
        </CardGrid>
        <p className="text-center mt-8 text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
          {isEs ? 'Reseñas de clientes en Google.' : 'Client reviews on Google.'}
        </p>
      </PageContainer>
    </Section>
  );
}
