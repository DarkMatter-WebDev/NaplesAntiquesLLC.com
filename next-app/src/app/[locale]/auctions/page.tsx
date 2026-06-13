import type { Metadata } from 'next';
import Link from 'next/link';
import SiteHeader from '@/components/layout/SiteHeader';
import SiteFooter from '@/components/layout/SiteFooter';

export const metadata: Metadata = {
  title: 'Auctions | Naples Estate Jewelry',
  description:
    'Auction guidance for estate jewelry, antiques, coins, watches, art, and high-value collections in Naples and Southwest Florida.',
};

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function AuctionsPage({ params }: Props) {
  const { locale } = await params;
  const isEs = locale === 'es';
  const contactHref = isEs ? '/es/contact' : '/contact';
  const evaluationHref = isEs ? '/es/free-evaluation' : '/free-evaluation';

  const steps = [
    {
      title: isEs ? 'Revision Privada' : 'Private Review',
      body: isEs
        ? 'Empezamos con fotos, una llamada o una cita privada para entender la coleccion y sus objetivos.'
        : 'We start with photos, a call, or a private appointment to understand the collection and your goals.',
    },
    {
      title: isEs ? 'Ruta Recomendada' : 'Recommended Path',
      body: isEs
        ? 'Le explicamos si una venta directa, una evaluacion gratuita o una estrategia de subasta tiene mas sentido.'
        : 'We explain whether a direct sale, free evaluation, or auction strategy makes the most sense.',
    },
    {
      title: isEs ? 'Ayuda Clara' : 'Clear Guidance',
      body: isEs
        ? 'Recibe orientacion honesta antes de mover piezas importantes, sin presion y sin compromiso.'
        : 'You get honest guidance before moving important pieces, with no pressure and no obligation.',
    },
  ];

  return (
    <>
      <SiteHeader />
      <main className="pt-16">
        <section
          className="py-16 md:py-24 border-b"
          style={{ background: 'var(--color-surface-container-low)', borderColor: 'var(--color-outline-variant)' }}
        >
          <div className="container mx-auto px-6 md:px-8 max-w-5xl">
            <span
              className="text-xs font-bold uppercase tracking-[0.4em]"
              style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}
            >
              {isEs ? 'Subastas y Colecciones' : 'Auctions & Collections'}
            </span>
            <h1
              className="text-4xl md:text-6xl font-bold mt-4 mb-6 tracking-tight max-w-3xl"
              style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}
            >
              {isEs ? 'Cuando una Pieza Merece el Mercado Adecuado' : 'When a Piece Deserves the Right Market'}
            </h1>
            <p className="text-lg md:text-xl max-w-3xl leading-relaxed mb-10" style={{ color: 'var(--color-on-surface-variant)' }}>
              {isEs
                ? 'Algunas joyas, relojes, antiguedades, monedas y colecciones especiales pueden beneficiarse de una estrategia mas amplia. Le ayudamos a entender sus opciones antes de decidir vender directamente o explorar una subasta.'
                : 'Some jewelry, watches, antiques, coins, and special collections may benefit from a broader strategy. We help you understand your options before deciding whether to sell directly or explore auction opportunities.'}
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href={evaluationHref} className="gold-button">
                {isEs ? 'Solicitar Evaluacion' : 'Request Evaluation'}
              </Link>
              <Link href={contactHref} className="outline-button">
                {isEs ? 'Hablar con Chris' : 'Talk With Chris'}
              </Link>
            </div>
          </div>
        </section>

        <section className="py-14 md:py-20">
          <div className="container mx-auto px-6 md:px-8 max-w-5xl">
            <div className="grid md:grid-cols-3 gap-5">
              {steps.map((step) => (
                <article
                  key={step.title}
                  className="border p-6"
                  style={{ background: 'var(--color-surface-container-lowest)', borderColor: 'var(--color-outline-variant)' }}
                >
                  <h2
                    className="text-xl font-bold mb-3"
                    style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}
                  >
                    {step.title}
                  </h2>
                  <p className="leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>
                    {step.body}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}
