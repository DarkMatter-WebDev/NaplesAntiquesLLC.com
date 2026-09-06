import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { pageMetadata } from '@/lib/seo';
import { jsonLdHtml } from '@/lib/json-ld';
import SiteHeader from '@/components/layout/SiteHeader';
import { BreadcrumbTrailFromLd } from '@/components/BreadcrumbTrail';
import SiteFooter from '@/components/layout/SiteFooter';
import GoldMarksSection from '@/components/gold/GoldMarksSection';

interface Props {
  params: Promise<{ locale: string }>;
}

// Illustrated gold marks guide — the gold twin of /silver-services/silver-marks
// (owner, 2026-09-06: "build out a similar detailed gold marks page like we did
// for silver and pull images from ebay"; mockup approved). Nests under the
// gold lander like the gold-worth guide. The section itself lives in
// `GoldMarksSection`; this file is the page shell around it.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const isEs = locale === 'es';
  return pageMetadata({
    title: isEs ? 'Guía de Sellos de Oro: 14K, 585, 750, GF' : 'Gold Marks Guide: 14K, 585, 750, GF & HGE',
    description: isEs
      ? 'Cómo leer los sellos de su oro: 10K, 14K, 18K y 14KP; 585, 750 y 375; gold-filled, HGE y vermeil; sellos británicos, firmas de Cartier y Tiffany, y el PT950 que no es oro blanco — con fotos.'
      : 'How to read the marks on your gold: 10K, 14K, 18K and 14KP; 585, 750 and 375; gold-filled, HGE and vermeil; British hallmarks, Cartier and Tiffany signatures, and the PT950 that is not white gold — with photos.',
    path: '/gold-services/gold-marks',
    locale,
  });
}

export default async function GoldMarksGuidePage({ params }: Props) {
  const { locale } = await params;
  const isEs = locale === 'es';
  const p = (path: string) => (isEs ? `/es${path}` : path);
  const evalHref = p('/free-evaluation');
  const canonicalUrl = `https://naplesestatejewelry.com${isEs ? '/es' : ''}/gold-services/gold-marks`;

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: isEs ? 'Inicio' : 'Home', item: `https://naplesestatejewelry.com${isEs ? '/es' : ''}` },
      { '@type': 'ListItem', position: 2, name: isEs ? 'Vender Oro' : 'Sell Gold', item: `https://naplesestatejewelry.com${isEs ? '/es' : ''}/gold-services` },
      { '@type': 'ListItem', position: 3, name: isEs ? 'Sellos de Oro' : 'Gold Marks', item: canonicalUrl },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(breadcrumbLd) }} />
      <SiteHeader />
      <main className="site-header-offset">

        {/* Hero — same layout as the silver guide: the photo is a right-hand
            panel from lg (58% wide) so the stamp stays clear of the text
            column; the Disney charm's "©WALT DISNEY PRODS 14K" back sits at
            about 30% across / 45% down its photo, so object-position pulls it
            toward the panel's centre. Below lg: full-width under an 82% wash. */}
        <section className="relative flex min-h-[440px] items-center overflow-hidden bg-[#1a1c1c] lg:min-h-[500px]">
          <div className="absolute inset-y-0 right-0 z-0 w-full lg:w-[58%]">
            <Image
              src="/assets/images/pages/gold-marks/own-disney-14k-full.webp"
              alt=""
              aria-hidden="true"
              fill
              sizes="(min-width: 1024px) 58vw, 100vw"
              priority
              className="object-cover object-[35%_45%]"
            />
            <div className="absolute inset-0 bg-[#1a1c1c]/[0.82] lg:bg-transparent lg:bg-gradient-to-r lg:from-[#1a1c1c] lg:from-0% lg:via-[#1a1c1c]/55 lg:via-28% lg:to-[#1a1c1c]/15 lg:to-100%" />
          </div>
          <div className="ultrawide-page relative z-10 mx-auto w-full max-w-[1440px] px-4 md:px-8">
            <div className="max-w-3xl">
              <BreadcrumbTrailFromLd ld={breadcrumbLd} />
              <span className="mb-4 block text-xs font-bold uppercase tracking-[0.2em] text-[#e9c349]" style={{ fontFamily: 'var(--font-label)' }}>
                {isEs ? 'Guía de Sellos de Oro · Naples, FL' : 'Gold Marks Guide · Naples, FL'}
              </span>
              <h1 className="mb-6 text-4xl font-bold leading-tight text-white md:text-5xl" style={{ fontFamily: 'var(--font-headline)' }}>
                {isEs ? 'Cómo Leer los Sellos de su Oro' : 'How to Read the Marks on Your Gold'}
              </h1>
              <p className="mb-8 max-w-xl text-lg leading-relaxed text-[#d7d0c3]">
                {isEs
                  ? '10K, 14K, 18K y 14KP; 585, 750 y 375; gold-filled, HGE y vermeil; sellos británicos, firmas de Cartier y Tiffany, y el PT950 que no es oro blanco — qué significa cada sello para el valor de una pieza, con fotos de oro que pasó por nuestro salón en Naples.'
                  : '10K, 14K, 18K and 14KP; 585, 750 and 375; gold-filled, HGE and vermeil; British hallmarks, Cartier and Tiffany signatures, and the PT950 that is not white gold — what each stamp means for the value of a piece, with photos from gold that came through our Naples showroom.'}
              </p>
              <div className="flex flex-wrap gap-4">
                <Link href={evalHref} className="gold-button">
                  {isEs ? 'PROGRAMAR EVALUACIÓN' : 'SCHEDULE EVALUATION'}
                </Link>
                <Link
                  href={p('/gold-services')}
                  className="outline-button"
                  style={{ borderColor: 'rgba(255,255,255,0.48)', color: 'white', background: 'rgba(255,255,255,0.08)' }}
                >
                  {isEs ? 'VOLVER A VENDER ORO' : 'BACK TO SELL GOLD'}
                </Link>
              </div>
            </div>
          </div>
        </section>

        <div className="border-b border-[#d0c5af] bg-[#f3f3f3]">
          <GoldMarksSection locale={locale} />
        </div>

        {/* Related */}
        <section className="mx-auto max-w-4xl px-4 py-16 text-center md:px-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#735c00]" style={{ fontFamily: 'var(--font-label)' }}>
            {isEs ? 'Siga leyendo' : 'Keep reading'}
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <Link href={p('/gold-services/what-is-my-gold-worth')} className="rounded-2xl border border-[#d0c5af] bg-white p-5 text-left shadow-[0_10px_28px_rgba(38,28,6,0.04)] transition-transform duration-200 hover:-translate-y-0.5">
              <b className="block text-base text-[#1a1c1c]" style={{ fontFamily: 'var(--font-headline)' }}>
                {isEs ? '¿Cuánto vale mi oro?' : 'What is my gold worth?'}
              </b>
              <span className="mt-1 block text-sm leading-relaxed text-[#4d4635]">
                {isEs ? 'La matemática de los quilates con un ejemplo práctico.' : 'The karat math with a worked example.'}
              </span>
            </Link>
            <Link href={p('/silver-services/silver-marks')} className="rounded-2xl border border-[#d0c5af] bg-white p-5 text-left shadow-[0_10px_28px_rgba(38,28,6,0.04)] transition-transform duration-200 hover:-translate-y-0.5">
              <b className="block text-base text-[#1a1c1c]" style={{ fontFamily: 'var(--font-headline)' }}>
                {isEs ? 'Cómo leer los sellos de su plata' : 'Reading the marks on your silver'}
              </b>
              <span className="mt-1 block text-sm leading-relaxed text-[#4d4635]">
                {isEs ? 'La guía gemela para la plata — 26 fotos.' : 'The silver twin of this guide — 26 photos.'}
              </span>
            </Link>
            <Link href={p('/gold-services')} className="rounded-2xl border border-[#d0c5af] bg-white p-5 text-left shadow-[0_10px_28px_rgba(38,28,6,0.04)] transition-transform duration-200 hover:-translate-y-0.5">
              <b className="block text-base text-[#1a1c1c]" style={{ fontFamily: 'var(--font-headline)' }}>
                {isEs ? 'Vender Oro en Naples' : 'Sell Gold in Naples'}
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
