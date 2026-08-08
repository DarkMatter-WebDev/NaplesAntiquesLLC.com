import { CardGrid, PageContainer, Section } from '@/components/layout/ResponsiveLayout';
import { TESTIMONIALS } from '@/lib/testimonials';

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
        {/* 1 / 2 / 4 columns — never 3. The shared grid's auto-fit picked 3
            columns in the ~850-1150px band, which left the fourth review alone
            on a second row the moment one was added (2026-08-05). */}
        <CardGrid className="testimonial-grid">
          {TESTIMONIALS.map((review) => (
            // `product-light-surface`: this card is always white, so on a dark
            // product page (where these reviews also render) it has to restore
            // the light text tokens — otherwise the quote inherits near-white
            // type onto white. Inert everywhere else, including the homepage.
            <figure
              key={review.name}
              className="product-light-surface flex flex-col gap-4 rounded-2xl border bg-white p-6"
              style={{ borderColor: 'var(--color-outline-variant)' }}
            >
              <div aria-hidden="true" style={{ color: '#e9c349', letterSpacing: '0.15em' }}>
                ★★★★★
              </div>
              <blockquote className="text-sm leading-relaxed" style={{ color: 'var(--color-on-surface)' }}>
                &ldquo;{isEs ? review.quoteEs : review.quote}&rdquo;
              </blockquote>
              <figcaption className="mt-auto pt-2 text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                <strong style={{ color: 'var(--color-on-surface)' }}>{review.name}</strong>
                {' · '}
                {isEs ? review.metaEs : review.meta}
              </figcaption>
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
