import type { Metadata } from 'next';
import { alternatesFor } from '@/lib/seo';
import Image from 'next/image';
import Link from 'next/link';
import SiteHeader from '@/components/layout/SiteHeader';
import SiteFooter from '@/components/layout/SiteFooter';
import { AppIcon } from '@/components/AppIcon';

// The named trade-in program page (2026-08-04, from the mels-treasures.com
// review — their "Gold Exchange Program"). This page NAMES a service the store
// already runs: verified gold/silver applied as credit toward any piece, the
// same mechanic behind every product page's "Own gold or silver?" line. All
// copy stays truthful to that existing service — no terms, percentages, or
// promises that aren't already live behavior.

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const isEs = locale === 'es';
  return {
    title: isEs ? 'Programa de Intercambio de Oro y Plata' : 'Gold & Silver Trade-In Program',
    description: isEs
      ? 'Aplique su oro o plata sin usar como crédito para cualquier pieza de nuestra tienda. Pesado y probado frente a usted, valorado contra el mercado spot en vivo, en Naples y el suroeste de Florida.'
      : 'Put unworn gold or silver toward any piece in our shop. Tested and weighed in front of you, valued against the live spot market, in Naples and across Southwest Florida.',
    alternates: alternatesFor('/trade-in', locale),
  };
}

interface Props {
  params: Promise<{ locale: string }>;
}

const STEPS = [
  {
    icon: 'photo_camera',
    titleEn: '1. Show Us What You Have',
    titleEs: '1. Muéstrenos Lo Que Tiene',
    descEn:
      'Text photos of your gold or silver — broken chains, single earrings, old class rings, sterling flatware, coins — or book a private appointment. Mixed and unsorted is completely normal.',
    descEs:
      'Envíe fotos de su oro o plata — cadenas rotas, aretes sueltos, anillos antiguos, cubiertos de plata esterlina, monedas — o agende una cita privada. Que esté mezclado y sin clasificar es completamente normal.',
  },
  {
    icon: 'scale',
    titleEn: '2. Tested & Valued In Front Of You',
    titleEs: '2. Probado y Valorado Frente a Usted',
    descEn:
      'Everything is tested and weighed while you watch, and valued against the same live spot market our shop prices are built on. We walk through the math before you decide anything.',
    descEs:
      'Todo se prueba y pesa mientras usted observa, y se valora contra el mismo mercado spot en vivo en el que se basan los precios de nuestra tienda. Revisamos los cálculos antes de que decida.',
  },
  {
    icon: 'diamond',
    titleEn: '3. Trade Toward Any Piece',
    titleEs: '3. Intercambie Por Cualquier Pieza',
    descEn:
      'Your metal becomes credit toward any piece in the shop — or, if you would rather sell outright, we make a straightforward cash offer instead. Your choice, no pressure either way.',
    descEs:
      'Su metal se convierte en crédito para cualquier pieza de la tienda — o, si prefiere vender directamente, le hacemos una oferta clara en efectivo. Usted elige, sin presión.',
  },
];

export default async function TradeInPage({ params }: Props) {
  const { locale } = await params;
  const isEs = locale === 'es';
  const p = (path: string) => `${isEs ? '/es' : ''}${path}`;

  return (
    <>
      <SiteHeader />
      <main className="site-header-offset">

        {/* Hero */}
        <section className="relative overflow-hidden pt-16 pb-16 md:pt-20 md:pb-24 border-b border-white/5">
          <div className="absolute inset-0 z-0">
            <Image
              src="/assets/images/pages/gold.webp"
              alt={isEs ? 'Joyería de oro' : 'Gold jewelry'}
              fill
              sizes="100vw"
              className="object-cover"
              style={{ objectPosition: 'center 45%' }}
              priority
            />
          </div>
          <div className="absolute inset-0 z-0 bg-[#1a1c1c]/60" />
          <div className="max-w-5xl mx-auto px-6 md:px-8 text-center relative z-10">
            <span className="text-[#e9c349] text-xs font-bold uppercase tracking-[0.4em]">
              {isEs ? 'Intercambie, No Funda' : 'Trade It, Don’t Melt It'}
            </span>
            <h1 className="text-4xl md:text-5xl text-white font-[family-name:var(--font-headline)] font-bold mt-4 mb-6 tracking-tight">
              {isEs ? 'Programa de Intercambio de Oro y Plata' : 'Gold & Silver Trade-In Program'}
            </h1>
            <p className="text-lg md:text-xl text-[#d7d0c3] italic max-w-3xl mx-auto leading-relaxed">
              {isEs
                ? 'El oro que está guardado sin usarse puede convertirse en una pieza que amará. Aplique el valor verificado de su oro o plata como crédito para cualquier pieza de nuestra tienda — pesado, probado y calculado frente a usted contra el mercado en vivo.'
                : 'Gold sitting unworn in a drawer can become a piece you will actually love. Put the verified value of your gold or silver toward any piece in our shop — tested, weighed, and priced in front of you against the live market.'}
            </p>
          </div>
        </section>

        {/* How it works */}
        <section className="py-16 md:py-24">
          <div className="max-w-4xl mx-auto px-6 md:px-8">
            <div className="text-center mb-12">
              <span className="text-[#735c00] text-xs font-bold uppercase tracking-[0.4em]">
                {isEs ? 'Cómo Funciona' : 'How It Works'}
              </span>
              <h2 className="text-3xl md:text-4xl font-[family-name:var(--font-headline)] font-bold mt-4 mb-4 tracking-tight">
                {isEs ? 'Tres Pasos, Sin Sorpresas' : 'Three Steps, No Surprises'}
              </h2>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {STEPS.map(({ icon, titleEn, titleEs, descEn, descEs }) => (
                <div key={icon} className="rounded-2xl border border-[#d0c5af]/60 bg-white p-6 shadow-[0_14px_38px_rgba(38,28,6,0.06)]">
                  <AppIcon name={icon} className="text-[#735c00] block mb-3" style={{ fontSize: '2rem' }} />
                  <h3 className="font-[family-name:var(--font-headline)] font-bold text-lg mb-2">
                    {isEs ? titleEs : titleEn}
                  </h3>
                  <p className="text-[#4d4635] text-sm leading-relaxed">{isEs ? descEs : descEn}</p>
                </div>
              ))}
            </div>

            {/* Ties the program to the number on every product page. */}
            <div className="mt-12 rounded-2xl border border-[#735c00]/20 bg-[#735c00]/5 p-6 shadow-[0_14px_38px_rgba(38,28,6,0.05)] md:p-8">
              <p className="text-center text-[#4d4635] text-sm md:text-base leading-relaxed">
                <span className="text-[#735c00] font-[family-name:var(--font-headline)] font-bold">
                  {isEs ? '¿Ya vio un precio de intercambio?' : 'Already spotted a trade-in price?'}
                </span>{' '}
                {isEs
                  ? 'Cada pieza de nuestra tienda muestra una línea de "¿Tienes oro o plata?" con un ejemplo de cuánto podría pagar aplicando su metal. Ese número sale de este programa.'
                  : 'Every piece in our shop shows an "Own gold or silver?" line with an example of how little you might pay by applying your metal. That number comes from this program.'}{' '}
                <Link href={p('/shop')} className="text-[#735c00] underline underline-offset-2 font-bold">
                  {isEs ? 'Ver la tienda' : 'Browse the shop'}
                </Link>
                .
              </p>
            </div>
          </div>
        </section>

        {/* Sustainability */}
        <section className="py-16 md:py-20 bg-[#f3f3f3]">
          <div className="max-w-3xl mx-auto px-6 md:px-8 text-center">
            <span
              className="inline-flex h-11 w-11 items-center justify-center rounded-full mb-4"
              style={{ background: 'rgba(212, 175, 55, 0.16)', color: '#735c00' }}
            >
              <AppIcon name="recycling" style={{ fontSize: '22px' }} />
            </span>
            <h2 className="text-3xl md:text-4xl font-[family-name:var(--font-headline)] font-bold mb-4 tracking-tight">
              {isEs ? 'Oro Que Sigue Viviendo' : 'Gold That Keeps On Living'}
            </h2>
            <p className="text-[#4d4635] leading-relaxed">
              {isEs
                ? 'Las piezas de patrimonio que vendemos fueron salvadas de la fundición, y el metal que usted intercambia mantiene ese ciclo en movimiento. Es la manera más sostenible de disfrutar joyería fina: nada nuevo se extrae, y la historia sigue en circulación.'
                : 'The estate pieces we sell were saved from the melting pot, and the metal you trade keeps that cycle turning. It is the most sustainable way to enjoy fine jewelry — nothing newly mined, and the history stays in circulation.'}
            </p>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 md:py-28">
          <div className="max-w-4xl mx-auto px-6 md:px-8 text-center">
            <h2 className="text-4xl md:text-5xl font-[family-name:var(--font-headline)] font-bold mb-6 tracking-tight">
              {isEs ? '¿Listo Para Intercambiar?' : 'Ready to Trade?'}
            </h2>
            <p className="text-[#4d4635] text-lg mb-10 max-w-2xl mx-auto leading-relaxed">
              {isEs
                ? 'Envíe fotos de lo que tiene o llame para una evaluación privada gratuita — vamos a usted en Naples y todo el suroeste de Florida.'
                : 'Text photos of what you have, or call for a free private evaluation — we come to you in Naples and across Southwest Florida.'}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center flex-wrap">
              <Link href={p('/free-evaluation')} className="gold-button">
                {isEs ? 'Evaluación Gratuita' : 'Free Evaluation'}
              </Link>
              <a href="tel:2394048505" className="outline-button">
                Call (239) 404-8505
              </a>
              <Link href={p('/shop')} className="outline-button">
                {isEs ? 'Ver la Tienda' : 'Browse the Shop'}
              </Link>
            </div>
          </div>
        </section>

      </main>
      <SiteFooter locale={locale} />
    </>
  );
}
