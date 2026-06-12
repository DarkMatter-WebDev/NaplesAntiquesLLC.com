import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import SiteHeader from '@/components/layout/SiteHeader';
import SiteFooter from '@/components/layout/SiteFooter';

export const metadata: Metadata = {
  title: 'Naples Estate Jewelry — Fine Gold & Estate Pieces',
};

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  const isEs = locale === 'es';
  const shopHref = isEs ? '/es/shop' : '/shop';
  const evalHref = isEs ? '/es/free-evaluation' : '/free-evaluation';
  const contactHref = isEs ? '/es/contact' : '/contact';

  return (
    <>
      <SiteHeader />

      <main className="flex flex-col">

        {/* Hero */}
        <section
          className="relative flex flex-col items-center justify-center text-center min-h-[92vh] px-6"
          style={{ background: 'var(--color-background)' }}
        >
          <div className="max-w-3xl mx-auto">
            <p
              className="text-[0.65rem] font-bold uppercase tracking-[0.42em] mb-6"
              style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}
            >
              {isEs ? 'Naples, Florida' : 'Naples, Florida'}
            </p>

            <h1
              className="text-5xl md:text-7xl font-bold leading-tight mb-8"
              style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}
            >
              {isEs ? (
                <>Joyería de<br />Patrimonio Fino</>
              ) : (
                <>Fine Estate<br />Jewelry</>
              )}
            </h1>

            <p
              className="text-base md:text-lg max-w-xl mx-auto mb-10 leading-relaxed"
              style={{ color: 'var(--color-on-surface-variant)' }}
            >
              {isEs
                ? 'Compramos y vendemos joyería de patrimonio, cadenas de oro, piezas de diseñador y lingotes — con precios del spot de oro en vivo.'
                : 'We buy and sell estate jewelry, fine gold chains, designer pieces, and bullion — with live gold spot pricing on every item.'}
            </p>

            <div className="flex flex-wrap gap-4 justify-center">
              <Link href={shopHref} className="gold-button text-sm">
                {isEs ? 'Ver Tienda' : 'Shop Now'}
              </Link>
              <Link href={evalHref} className="outline-button text-sm">
                {isEs ? 'Evaluación Gratuita' : 'Free Evaluation'}
              </Link>
            </div>
          </div>

          {/* Scroll indicator */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-40">
            <div
              className="w-px h-10 animate-pulse"
              style={{ background: 'var(--color-primary)' }}
            />
          </div>
        </section>

        {/* Services strip */}
        <section
          className="py-20 px-6 border-t"
          style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-low)' }}
        >
          <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-8">
            {[
              {
                icon: '💛',
                title: isEs ? 'Compramos Oro' : 'We Buy Gold',
                body: isEs
                  ? 'Evaluaciones gratuitas en el acto para todas las piezas de oro.'
                  : 'Free walk-in appraisals on all gold jewelry, coins, and bullion.',
                href: evalHref,
                cta: isEs ? 'Evaluación gratuita →' : 'Free evaluation →',
              },
              {
                icon: '🏆',
                title: isEs ? 'Vendemos Joyas' : 'We Sell Jewelry',
                body: isEs
                  ? 'Cadenas, pulseras, anillos y piezas de diseñador con precios transparentes.'
                  : 'Chains, bracelets, rings, and designer pieces priced at live gold rates.',
                href: shopHref,
                cta: isEs ? 'Ver tienda →' : 'Browse shop →',
              },
              {
                icon: '📞',
                title: isEs ? 'Contacto Directo' : 'Direct Contact',
                body: isEs
                  ? 'Hable con nosotros directamente — sin intermediarios.'
                  : 'Talk directly to us — no middlemen, no automated runaround.',
                href: contactHref,
                cta: isEs ? 'Contáctenos →' : 'Contact us →',
              },
            ].map((item) => (
              <div key={item.title} className="flex flex-col gap-3">
                <span className="text-3xl">{item.icon}</span>
                <h3
                  className="text-xl font-bold"
                  style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}
                >
                  {item.title}
                </h3>
                <p className="text-sm leading-relaxed flex-1" style={{ color: 'var(--color-on-surface-variant)' }}>
                  {item.body}
                </p>
                <Link
                  href={item.href}
                  className="text-xs font-bold tracking-wide uppercase"
                  style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}
                >
                  {item.cta}
                </Link>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section
          className="py-20 px-6 text-center border-t"
          style={{ borderColor: 'var(--color-outline-variant)' }}
        >
          <p
            className="text-[0.65rem] font-bold uppercase tracking-[0.35em] mb-4"
            style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}
          >
            {isEs ? 'Llámenos Hoy' : 'Call Us Today'}
          </p>
          <a
            href="tel:2394048505"
            className="text-4xl md:text-5xl font-bold transition-opacity hover:opacity-70"
            style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}
          >
            (239) 404-8505
          </a>
          <p className="mt-4 text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
            {isEs ? 'Naples, Florida · Lunes–Sábado' : 'Naples, Florida · Mon–Sat'}
          </p>
        </section>

      </main>
      <SiteFooter locale={locale} />
    </>
  );
}
