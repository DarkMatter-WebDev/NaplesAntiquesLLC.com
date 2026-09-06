import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { pageMetadata } from '@/lib/seo';
import { jsonLdHtml } from '@/lib/json-ld';
import SiteHeader from '@/components/layout/SiteHeader';
import { BreadcrumbTrailFromLd } from '@/components/BreadcrumbTrail';
import SiteFooter from '@/components/layout/SiteFooter';
import SilverMarksSection from '@/components/silver/SilverMarksSection';

interface Props {
  params: Promise<{ locale: string }>;
}

// Illustrated silver marks guide, split out of /silver-services on 2026-09-06
// (owner: the lander should explain how and what we buy; the 26-photo marks
// section was 58% of its words and sat above the buying content). Nests under
// the lander like /silver-services/flatware-value so the lander keeps its
// "sell sterling silver naples" intent and this page can own the
// informational queries (what does EPNS mean, silver hallmark identification).
// The section itself — copy, photos, lightbox — is unchanged and lives in
// `SilverMarksSection`; this file is the page shell around it.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const isEs = locale === 'es';
  return pageMetadata({
    title: isEs ? 'Guía de Sellos de Plata: EPNS, León, 925' : 'Silver Marks Guide: EPNS, Lion, Sterling, 925',
    description: isEs
      ? 'Cómo leer los sellos de su plata: qué significan EPNS y EPBM, el león británico, STERLING y la plata de moneda, 925 y los sellos del mundo — con fotos de piezas que pasaron por nuestro salón en Naples.'
      : 'How to read the marks on your silver: what EPNS and EPBM mean, the British lion, STERLING and coin silver, 925 and world marks — with photos from pieces that came through our Naples showroom.',
    path: '/silver-services/silver-marks',
    locale,
  });
}

export default async function SilverMarksGuidePage({ params }: Props) {
  const { locale } = await params;
  const isEs = locale === 'es';
  const p = (path: string) => (isEs ? `/es${path}` : path);
  const evalHref = p('/free-evaluation');
  const canonicalUrl = `https://naplesestatejewelry.com${isEs ? '/es' : ''}/silver-services/silver-marks`;

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: isEs ? 'Inicio' : 'Home', item: `https://naplesestatejewelry.com${isEs ? '/es' : ''}` },
      { '@type': 'ListItem', position: 2, name: isEs ? 'Vender Plata Esterlina' : 'Sell Sterling Silver', item: `https://naplesestatejewelry.com${isEs ? '/es' : ''}/silver-services` },
      { '@type': 'ListItem', position: 3, name: isEs ? 'Sellos de Plata' : 'Silver Marks', item: canonicalUrl },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(breadcrumbLd) }} />
      <SiteHeader />
      <main className="site-header-offset">

        {/* Hero. The photo is the London 1824 mug base from the guide itself —
            its hallmark row is at about 44% across and 50% down the frame.
            Owner (mockup review): "center that new hero pic more so we can see
            the marks on the bottom of the mug". So from lg the photo is a
            right-hand panel (58% wide) with object-position 44% 50%, which
            puts the marks ~67% across the hero, clear of the text column that
            ends at 53%; the wash fades from solid at the panel's left edge.
            Below lg the panel is full-width behind an 82% wash — texture, as
            on the lander's hero. */}
        <section className="relative flex min-h-[440px] items-center overflow-hidden bg-[#1a1c1c] lg:min-h-[500px]">
          <div className="absolute inset-y-0 right-0 z-0 w-full lg:w-[58%]">
            <Image
              src="/assets/images/pages/silver-marks/own-london-1824-base-full.webp"
              alt=""
              aria-hidden="true"
              fill
              sizes="(min-width: 1024px) 58vw, 100vw"
              priority
              className="object-cover object-[44%_50%]"
            />
            <div className="absolute inset-0 bg-[#1a1c1c]/[0.82] lg:bg-transparent lg:bg-gradient-to-r lg:from-[#1a1c1c] lg:from-0% lg:via-[#1a1c1c]/55 lg:via-28% lg:to-[#1a1c1c]/15 lg:to-100%" />
          </div>
          <div className="ultrawide-page relative z-10 mx-auto w-full max-w-[1440px] px-4 md:px-8">
            <div className="max-w-3xl">
              <BreadcrumbTrailFromLd ld={breadcrumbLd} />
              <span className="mb-4 block text-xs font-bold uppercase tracking-[0.2em] text-[#e9c349]" style={{ fontFamily: 'var(--font-label)' }}>
                {isEs ? 'Guía de Sellos de Plata · Naples, FL' : 'Silver Marks Guide · Naples, FL'}
              </span>
              <h1 className="mb-6 text-4xl font-bold leading-tight text-white md:text-5xl" style={{ fontFamily: 'var(--font-headline)' }}>
                {isEs ? 'Cómo Leer los Sellos de su Plata' : 'How to Read the Marks on Your Silver'}
              </h1>
              <p className="mb-8 max-w-xl text-lg leading-relaxed text-[#d7d0c3]">
                {isEs
                  ? 'E.P.N.S. y EPBM, el león británico, STERLING y la plata de moneda, 925 y los números y símbolos del mundo — qué significa cada uno para el valor de una pieza, con fotos de plata que pasó por nuestro salón en Naples.'
                  : "E.P.N.S. and EPBM, the British lion, STERLING and coin silver, 925 and the world's numbers and symbols — what each one means for the value of a piece, with photos from silver that came through our Naples showroom."}
              </p>
              <div className="flex flex-wrap gap-4">
                <Link href={evalHref} className="gold-button">
                  {isEs ? 'PROGRAMAR EVALUACIÓN' : 'SCHEDULE EVALUATION'}
                </Link>
                <Link
                  href={p('/silver-services')}
                  className="outline-button"
                  style={{ borderColor: 'rgba(255,255,255,0.48)', color: 'white', background: 'rgba(255,255,255,0.08)' }}
                >
                  {isEs ? 'VOLVER A VENDER PLATA' : 'BACK TO SELL SILVER'}
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* The guide — unchanged from its 2026-09-06 build on the lander. */}
        <div className="border-b border-[#d0c5af] bg-[#f3f3f3]">
          <SilverMarksSection locale={locale} />
        </div>

        {/* Related */}
        <section className="mx-auto max-w-4xl px-4 py-16 text-center md:px-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#735c00]" style={{ fontFamily: 'var(--font-label)' }}>
            {isEs ? 'Siga leyendo' : 'Keep reading'}
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <Link href={p('/gold-services/gold-marks')} className="rounded-2xl border border-[#d0c5af] bg-white p-5 text-left shadow-[0_10px_28px_rgba(38,28,6,0.04)] transition-transform duration-200 hover:-translate-y-0.5">
              <b className="block text-base text-[#1a1c1c]" style={{ fontFamily: 'var(--font-headline)' }}>
                {isEs ? 'Cómo leer los sellos de su oro' : 'Reading the marks on your gold'}
              </b>
              <span className="mt-1 block text-sm leading-relaxed text-[#4d4635]">
                {isEs ? 'La guía gemela para el oro — 31 fotos.' : 'The gold twin of this guide — 31 photos.'}
              </span>
            </Link>
            <Link href={p('/silver-services/flatware-value')} className="rounded-2xl border border-[#d0c5af] bg-white p-5 text-left shadow-[0_10px_28px_rgba(38,28,6,0.04)] transition-transform duration-200 hover:-translate-y-0.5">
              <b className="block text-base text-[#1a1c1c]" style={{ fontFamily: 'var(--font-headline)' }}>
                {isEs ? '¿Cuánto vale mi cubertería de plata?' : 'What is my sterling flatware worth?'}
              </b>
              <span className="mt-1 block text-sm leading-relaxed text-[#4d4635]">
                {isEs ? 'Patrón, peso y la cuestión del chapado — la guía del valor de la cubertería.' : 'Pattern, weight and the plated question — the flatware value guide.'}
              </span>
            </Link>
            <Link href={p('/silver-services')} className="rounded-2xl border border-[#d0c5af] bg-white p-5 text-left shadow-[0_10px_28px_rgba(38,28,6,0.04)] transition-transform duration-200 hover:-translate-y-0.5">
              <b className="block text-base text-[#1a1c1c]" style={{ fontFamily: 'var(--font-headline)' }}>
                {isEs ? 'Vender Plata en Naples' : 'Sell Silver in Naples'}
              </b>
              <span className="mt-1 block text-sm leading-relaxed text-[#4d4635]">
                {isEs ? 'Qué compramos, cómo lo probamos y cómo funciona una evaluación.' : 'What we buy, how we test it, and how an evaluation works.'}
              </span>
            </Link>
          </div>
        </section>

        {/* Final CTA */}
        <section className="bg-[#2f3131] py-24 text-center">
          <div className="mx-auto max-w-2xl px-4">
            <h2 className="mb-6 text-3xl font-bold text-white md:text-4xl" style={{ fontFamily: 'var(--font-headline)' }}>
              {isEs ? '¿Listo para una Evaluación Profesional?' : 'Ready for a Professional Evaluation?'}
            </h2>
            <p className="mx-auto mb-10 max-w-lg text-base leading-relaxed text-[#d7d0c3]">
              {isEs
                ? 'Traiga la pieza — buscamos el sello con usted, probamos el metal y le explicamos una oferta directa.'
                : 'Bring the piece — we will find the mark with you, test the metal, and explain a straightforward offer.'}
            </p>
            <div className="flex flex-col justify-center gap-6 md:flex-row">
              <Link href={evalHref} className="gold-button">
                {isEs ? 'PROGRAMAR UNA CITA' : 'SCHEDULE A TIME'}
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
