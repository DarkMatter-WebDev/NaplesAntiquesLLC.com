import type { Metadata } from 'next';
import Link from 'next/link';
import { alternatesFor } from '@/lib/seo';
import { jsonLdHtml } from '@/lib/json-ld';
import { SERVICE_AREAS } from '@/lib/service-areas';
import SiteHeader from '@/components/layout/SiteHeader';
import SiteFooter from '@/components/layout/SiteFooter';
import { AppIcon } from '@/components/AppIcon';

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const isEs = locale === 'es';
  const title = isEs
    ? 'Vender Oro, Joyería y Plata en el Suroeste de Florida'
    : 'Sell Gold, Jewelry & Sterling Silver in Southwest Florida';
  const description = isEs
    ? 'Comprador de oro, joyería, plata esterlina, diamantes, monedas y relojes que paga al mejor precio en Naples, Marco Island, Bonita Springs, Estero, Fort Myers y Cape Coral. Evaluación gratuita — vamos a usted.'
    : 'Top-paying buyer of gold, jewelry, sterling silver, diamonds, coins & watches serving Naples, Marco Island, Bonita Springs, Estero, Fort Myers & Cape Coral. Free appraisals — we come to you.';
  return {
    title,
    description,
    alternates: alternatesFor('/sell', locale),
    openGraph: {
      type: 'website',
      url: `https://naplesestatejewelry.com${isEs ? '/es' : ''}/sell`,
      title: `${title} | Naples Estate Jewelry`,
      description,
    },
  };
}

export default async function SellHubPage({ params }: Props) {
  const { locale } = await params;
  const isEs = locale === 'es';
  const p = (path: string) => (isEs ? `/es${path}` : path);

  const buyCategories = [
    { icon: 'paid', en: 'Sell Gold', es: 'Vender Oro', href: '/gold-services' },
    { icon: 'star', en: 'Sell Sterling Silver', es: 'Vender Plata Esterlina', href: '/silver-services' },
    { icon: 'diamond', en: 'Sell Estate Jewelry', es: 'Vender Joyería de Patrimonio', href: '/estate-jewelry' },
    { icon: 'toll', en: 'Sell Coins & Bullion', es: 'Vender Monedas y Lingotes', href: '/bullion' },
  ];

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: isEs ? 'Inicio' : 'Home', item: `https://naplesestatejewelry.com${isEs ? '/es' : ''}` },
      { '@type': 'ListItem', position: 2, name: isEs ? 'Vender' : 'Sell', item: `https://naplesestatejewelry.com${isEs ? '/es' : ''}/sell` },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(breadcrumbLd) }} />
      <SiteHeader />
      <main className="pt-16">

        {/* Hero */}
        <section className="relative flex min-h-[480px] items-center overflow-hidden bg-[#1a1c1c]">
          <div className="relative z-10 mx-auto w-full max-w-[1440px] px-4 md:px-8">
            <div className="max-w-3xl">
              <span className="mb-4 block text-xs font-bold uppercase tracking-[0.2em] text-[#e9c349]" style={{ fontFamily: 'var(--font-label)' }}>
                {isEs ? 'Compramos en Todo el Suroeste de Florida' : 'We Buy Across Southwest Florida'}
              </span>
              <h1 className="mb-6 text-4xl font-bold leading-tight text-white md:text-5xl" style={{ fontFamily: 'var(--font-headline)' }}>
                {isEs
                  ? 'Venda Oro, Joyería y Plata Esterlina al Mejor Precio'
                  : 'Sell Gold, Jewelry & Sterling Silver for Top Dollar'}
              </h1>
              <p className="mb-8 max-w-xl text-lg leading-relaxed text-[#d7d0c3]">
                {isEs
                  ? 'Comprador privado y móvil de oro, joyería de patrimonio, plata, diamantes, monedas y relojes. Evaluación gratuita, números honestos y pago inmediato — vamos a usted.'
                  : 'Private, mobile buyer of gold, estate jewelry, silver, diamonds, coins, and watches. Free evaluation, honest numbers, and immediate payment — we come to you.'}
              </p>
              <div className="flex flex-wrap gap-4">
                <Link href={p('/free-evaluation')} className="gold-button">
                  {isEs ? 'EVALUACIÓN GRATIS' : 'GET A FREE ESTIMATE'}
                </Link>
                <a
                  href="tel:2394048505"
                  className="outline-button"
                  style={{ borderColor: 'rgba(255,255,255,0.48)', color: 'white', background: 'rgba(255,255,255,0.08)' }}
                >
                  CALL (239) 404-8505
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* What we buy */}
        <section className="mx-auto max-w-[1440px] px-4 py-20 md:px-8">
          <h2 className="mb-12 text-center text-3xl font-bold text-[#1a1c1c] md:text-4xl" style={{ fontFamily: 'var(--font-headline)' }}>
            {isEs ? 'Qué Compramos' : 'What We Buy'}
          </h2>
          <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
            {buyCategories.map((c) => (
              <Link
                key={c.href}
                href={p(c.href)}
                className="group flex flex-col items-center rounded-2xl border border-[#d0c5af] bg-white p-8 text-center shadow-[0_14px_38px_rgba(38,28,6,0.05)] transition-all hover:-translate-y-0.5 hover:shadow-xl"
              >
                <AppIcon name={c.icon} className="mb-4 text-[#735c00]" style={{ fontSize: '2.75rem', fontVariationSettings: "'FILL' 0, 'wght' 200" }} aria-hidden="true" />
                <span className="text-base font-bold text-[#1a1c1c]" style={{ fontFamily: 'var(--font-headline)' }}>
                  {isEs ? c.es : c.en}
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* Areas we serve */}
        <section className="border-y border-[#d0c5af] bg-[#f3f3f3] py-20">
          <div className="mx-auto max-w-[1440px] px-4 md:px-8">
            <div className="mb-10 text-center">
              <h2 className="mb-3 text-3xl font-bold text-[#1a1c1c] md:text-4xl" style={{ fontFamily: 'var(--font-headline)' }}>
                {isEs ? 'Áreas que Servimos' : 'Areas We Serve'}
              </h2>
              <p className="mx-auto max-w-xl text-sm leading-relaxed text-[#4d4635]">
                {isEs
                  ? 'Elija su ciudad para ver cómo compramos oro, joyería y plata localmente.'
                  : 'Choose your city to see how we buy gold, jewelry, and silver locally.'}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {SERVICE_AREAS.map((a) => (
                <Link
                  key={a.slug}
                  href={p(`/sell/${a.slug}`)}
                  className="group rounded-2xl border border-[#d0c5af] bg-white p-6 shadow-[0_10px_28px_rgba(38,28,6,0.04)] transition-all hover:-translate-y-0.5 hover:shadow-xl"
                >
                  <h3 className="mb-1 text-xl font-bold text-[#1a1c1c] group-hover:text-[#735c00]" style={{ fontFamily: 'var(--font-headline)' }}>
                    {isEs ? `Vender en ${a.city}, ${a.region}` : `Sell in ${a.city}, ${a.region}`}
                  </h3>
                  <p className="text-xs text-[#4d4635]" style={{ fontFamily: 'var(--font-label)' }}>
                    {a.nearby.slice(0, 4).join(' · ')}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="bg-[#2f3131] py-24 text-center">
          <div className="mx-auto max-w-2xl px-4">
            <h2 className="mb-6 text-3xl font-bold text-white md:text-4xl" style={{ fontFamily: 'var(--font-headline)' }}>
              {isEs ? 'Descubra lo que valen sus artículos' : 'Find out what your items are worth'}
            </h2>
            <p className="mx-auto mb-10 max-w-lg text-base leading-relaxed text-[#d7d0c3]">
              {isEs
                ? 'Evaluación gratuita y sin obligación en todo el suroeste de Florida.'
                : 'Free, no-obligation evaluation throughout Southwest Florida.'}
            </p>
            <div className="flex flex-col justify-center gap-6 md:flex-row">
              <Link href={p('/free-evaluation')} className="gold-button">
                {isEs ? 'PROGRAMAR CITA' : 'SCHEDULE APPOINTMENT'}
              </Link>
              <a
                href="tel:2394048505"
                className="outline-button"
                style={{ borderColor: 'rgba(255,255,255,0.32)', color: 'white', background: 'rgba(255,255,255,0.08)' }}
              >
                CALL (239) 404-8505
              </a>
            </div>
          </div>
        </section>

      </main>
      <SiteFooter locale={locale} />
    </>
  );
}
