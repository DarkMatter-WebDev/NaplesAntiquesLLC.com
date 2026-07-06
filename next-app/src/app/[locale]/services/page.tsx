import type { Metadata } from 'next';
import { alternatesFor } from '@/lib/seo';
import Link from 'next/link';
import SiteHeader from '@/components/layout/SiteHeader';
import SiteFooter from '@/components/layout/SiteFooter';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: 'Our Services',
    description:
      'Choose a free jewelry evaluation or estate services with Naples Estate Jewelry. Private, appointment-only service throughout Southwest Florida.',
    alternates: alternatesFor('/services', locale),
  };
}

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function ServicesPage({ params }: Props) {
  const { locale } = await params;
  const isEs = locale === 'es';
  const prefix = isEs ? '/es' : '';

  const options = [
    {
      href: `${prefix}/free-evaluation`,
      eyebrow: isEs ? 'Gratis y sin obligación' : 'Free and no obligation',
      title: isEs ? 'Evaluación Gratuita' : 'Free Evaluation',
      body: isEs
        ? 'Para joyería, oro, plata, diamantes, relojes, monedas y piezas heredadas. Obtenga un número claro antes de decidir.'
        : 'For jewelry, gold, silver, diamonds, watches, coins, and inherited pieces. Get a clear number before you decide.',
      button: isEs ? 'Ver Evaluación Gratuita' : 'View Free Evaluation',
    },
    {
      href: `${prefix}/estate-services`,
      eyebrow: isEs ? 'Colecciones y patrimonios' : 'Collections and estates',
      title: isEs ? 'Servicios de Patrimonio' : 'Estate Services',
      body: isEs
        ? 'Para familias, albaceas y fideicomisarios que necesitan ayuda privada con colecciones heredadas o liquidaciones de patrimonio.'
        : 'For families, executors, and trustees who need private help with inherited collections or estate liquidation.',
      button: isEs ? 'Ver Servicios de Patrimonio' : 'View Estate Services',
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
          <div className="container mx-auto px-6 md:px-8 max-w-4xl text-center">
            <span
              className="text-xs font-bold uppercase tracking-[0.4em]"
              style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}
            >
              {isEs ? 'Otros Servicios' : 'Other Services'}
            </span>
            <h1
              className="text-4xl md:text-5xl font-bold mt-4 mb-6 tracking-tight"
              style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}
            >
              {isEs ? 'Elija el Servicio Adecuado' : 'Choose the Right Service'}
            </h1>
            <p className="text-lg md:text-xl max-w-2xl mx-auto leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>
              {isEs
                ? 'Dos caminos sencillos para comenzar: una evaluación gratuita de artículos individuales o ayuda más amplia con un patrimonio.'
                : 'Two simple ways to start: a free evaluation for individual items, or broader help with an estate.'}
            </p>
          </div>
        </section>

        <section className="py-14 md:py-20">
          <div className="container mx-auto px-6 md:px-8 max-w-5xl">
            <div className="grid md:grid-cols-2 gap-5 md:gap-6">
              {options.map((option) => (
                <article
                  key={option.href}
                  className="border p-6 md:p-8 flex flex-col min-h-[19rem]"
                  style={{ background: 'var(--color-surface-container-lowest)', borderColor: 'var(--color-outline-variant)' }}
                >
                  <span
                    className="text-[0.68rem] font-bold uppercase tracking-[0.24em]"
                    style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}
                  >
                    {option.eyebrow}
                  </span>
                  <h2
                    className="text-2xl md:text-3xl font-bold mt-4 mb-4"
                    style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}
                  >
                    {option.title}
                  </h2>
                  <p className="leading-relaxed mb-8" style={{ color: 'var(--color-on-surface-variant)' }}>
                    {option.body}
                  </p>
                  <Link href={option.href} className="gold-button mt-auto self-start">
                    {option.button}
                  </Link>
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
