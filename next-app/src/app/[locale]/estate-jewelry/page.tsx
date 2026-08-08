import type { Metadata } from 'next';
import { alternatesFor } from '@/lib/seo';
import Image from 'next/image';
import Link from 'next/link';
import SiteHeader from '@/components/layout/SiteHeader';
import SiteFooter from '@/components/layout/SiteFooter';
import { AppIcon } from '@/components/AppIcon';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: 'Estate Jewelry Buyer in Naples, FL',
    description:
      'Private estate jewelry evaluations in Naples, FL. Onsite acid testing, XRF analysis, and GIA coordination. Immediate payment upon agreement.',
    alternates: alternatesFor('/estate-jewelry', locale),
  };
}

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function EstateJewelryPage({ params }: Props) {
  const { locale } = await params;
  const isEs = locale === 'es';

  return (
    <>
      <SiteHeader />
      <main className="site-header-offset">

        {/* Hero */}
        <section
          className="relative flex items-center overflow-hidden min-h-[600px] md:min-h-[680px]"
          style={{ background: '#0e0f0f' }}
        >
          <div className="absolute inset-0 opacity-40">
            <Image
              src="/assets/images/pages/jeweler.webp"
              alt={isEs ? 'Joyero midiendo un anillo de patrimonio durante una evaluación privada' : 'Jeweler measuring an estate ring during a private evaluation'}
              fill
              sizes="100vw"
              priority
              className="object-cover object-center"
            />
          </div>
          <div className="container mx-auto px-6 md:px-12 relative z-10 py-16">
            <div className="max-w-2xl">
              <span
                className="text-xs font-bold uppercase tracking-[0.2em] mb-4 block"
                style={{ color: '#f2ca50', fontFamily: 'var(--font-label)' }}
              >
                {isEs ? 'Evaluación de Joyería de Patrimonio' : 'Estate Jewelry Assessment'}
              </span>
              <h1
                className="text-4xl md:text-6xl text-white font-bold mb-6 leading-tight"
                style={{ fontFamily: 'var(--font-headline)' }}
              >
                {isEs
                  ? 'Evaluando la Artesanía de la Joyería Fina'
                  : 'Evaluating the Artistry of Fine Jewelry'}
              </h1>
              <p className="text-lg leading-relaxed mb-10" style={{ color: '#d0c9bc' }}>
                {isEs
                  ? 'Más allá del simple peso del oro y los quilates de las piedras hay un mundo de procedencia, artesanía e historia. Realizamos evaluaciones cuidadosas con pruebas de ácido en el lugar de su cita.'
                  : 'Beyond the mere weight of gold and carats of stone lies a world of provenance, craftsmanship, and history. We provide careful evaluations with onsite acid testing at your appointment, and coordinate trusted offsite XRF analysis and GIA certification when a piece calls for deeper documentation.'}
              </p>
              <div className="flex flex-wrap gap-4">
                <Link
                  href={isEs ? '/es/contact' : '/contact'}
                  className="gold-button"
                >
                  {isEs ? 'Programar Consulta' : 'Schedule Consultation'}
                </Link>
                <Link
                  href={isEs ? '/es/free-evaluation' : '/free-evaluation'}
                  className="outline-button"
                  style={{ borderColor: 'rgba(255,255,255,0.4)', color: 'white' }}
                >
                  {isEs ? 'Evaluación Gratuita' : 'Free Evaluation'}
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Multidimensional Approach */}
        <section className="py-20 md:py-28" style={{ background: 'var(--color-background)' }}>
          <div className="ultrawide-page container mx-auto px-6 md:px-12 max-w-6xl">
            <div className="mb-16 text-center max-w-3xl mx-auto">
              <h2
                className="text-3xl md:text-4xl font-bold mb-6 tracking-tight"
                style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}
              >
                {isEs ? 'Un Enfoque Multidimensional del Valor' : 'A Multidimensional Approach to Value'}
              </h2>
              <p style={{ color: 'var(--color-on-surface-variant)' }}>
                {isEs
                  ? 'Miramos más allá del valor de chatarra. Nuestra evaluación privada considera los factores que hacen única su pieza en el mercado secundario global.'
                  : 'We look past the scrap value. Our private evaluation considers the factors that make your piece unique in the global secondary market.'}
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div className="relative">
                <Image
                  src="/assets/images/pages/jeweler.webp"
                  alt={isEs ? 'Herramientas de joyería en el banco de trabajo' : "Jeweler's workbench with precision tools"}
                  width={700}
                  height={525}
                  className="w-full rounded-2xl object-cover shadow-xl"
                  style={{ aspectRatio: '4/3' }}
                />
              </div>

              <div className="flex flex-col gap-10">
                {[
                  {
                    title: isEs ? 'Fabricante y Procedencia' : 'Maker & Provenance',
                    body: isEs
                      ? 'Los artículos de casas como Cartier, Van Cleef & Arpels o Tiffany conllevan una prima significativa. Rastreamos registros de subastas y ventas privadas para garantizar que su pieza sea evaluada por su firma.'
                      : 'Items from houses like Cartier, Van Cleef & Arpels, or Tiffany carry a significant premium. We track auction records and private sales to ensure your piece is evaluated for its signature.',
                  },
                  {
                    title: isEs ? 'Calidad de las Gemas' : 'Gemstone Quality',
                    body: isEs
                      ? 'Para diamantes y piedras de color, combinamos inspección visual, investigación de mercado, documentación disponible, pruebas de ácido en el sitio y certificación XRF o GIA fuera del sitio cuando sea necesario.'
                      : 'For diamonds and colored stones, we combine visual inspection, market research, available paperwork, onsite acid testing, and offsite XRF or GIA certification when needed to account for rarity, origin, and treatment.',
                  },
                  {
                    title: isEs ? 'Era Histórica' : 'Historical Era',
                    body: isEs
                      ? 'Ya sea victoriano, Art Deco o Retro Moderno, el significado histórico de una pieza contribuye a su deseabilidad. Consideramos la era tanto como los materiales.'
                      : 'Whether Victorian, Art Deco, or Retro Modern, the historical significance of a piece contributes to its desirability. We consider the era as much as the materials.',
                  },
                ].map((item, i) => (
                  <div key={i}>
                    <h3
                      className="text-xl font-bold mb-3"
                      style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}
                    >
                      {item.title}
                    </h3>
                    <p className="leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>
                      {item.body}
                    </p>
                    {i < 2 && (
                      <div className="mt-6 h-px" style={{ background: 'var(--color-outline-variant)' }} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Private Consultation */}
        <section className="py-20 md:py-28" style={{ background: '#1a1c1c', color: 'white' }}>
          <div className="ultrawide-page container mx-auto px-6 md:px-12 max-w-6xl">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <span
                  className="text-xs font-bold uppercase tracking-widest mb-6 block"
                  style={{ color: '#f2ca50', fontFamily: 'var(--font-label)' }}
                >
                  {isEs ? 'Consulta Privada' : 'Private Consultation'}
                </span>
                <h2
                  className="text-3xl md:text-4xl font-bold mb-8 leading-tight"
                  style={{ fontFamily: 'var(--font-headline)' }}
                >
                  {isEs
                    ? '¿No sabe el valor de su joyería? Le damos claridad.'
                    : "Unsure of your jewelry's value? We provide clarity."}
                </h2>
                <p className="text-lg mb-8 leading-relaxed" style={{ color: '#d0c9bc' }}>
                  {isEs
                    ? 'Muchas piezas valiosas se pasan por alto porque no parecen "modernas". Nuestras evaluaciones ofrecen valoraciones honestas, sin obligación, en un entorno seguro y profesional.'
                    : 'Many valuable pieces are overlooked because they don\'t look "modern." Our estate jewelry assessments offer honest, no-obligation evaluations in a secure, professional setting.'}
                </p>
                <ul className="space-y-4 mb-10">
                  {[
                    isEs ? 'Pruebas de ácido en el lugar; XRF y certificación GIA fuera del sitio cuando sea necesario' : 'Onsite acid testing; offsite XRF, geological & GIA certification when needed',
                    isEs ? 'Manejo privado y proceso de revisión seguro' : 'Private handling and secure review process',
                    isEs ? 'Pago inmediato al llegar a un acuerdo' : 'Immediate payment upon agreement',
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-4">
                      <AppIcon name="check_circle" className="text-sm" style={{ color: '#f2ca50', flexShrink: 0, marginTop: '0.1rem', fontVariationSettings: "'FILL' 1" }} />
                      <span
                        className="text-sm font-bold uppercase tracking-wide"
                        style={{ fontFamily: 'var(--font-label)', color: 'white' }}
                      >
                        {item}
                      </span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={isEs ? '/es/contact' : '/contact'}
                  className="gold-button inline-flex"
                >
                  {isEs ? 'Reserve Su Cita Privada' : 'Book Your Private Appointment'}
                </Link>
              </div>

              <div
                className="flex aspect-square items-center justify-center rounded-2xl p-8 shadow-[0_18px_54px_rgba(0,0,0,0.16)] md:p-12"
                style={{ background: 'var(--color-surface-container-highest)' }}
              >
                <div
                  className="flex h-full w-full flex-col justify-center rounded-xl p-8 text-center md:p-10"
                  style={{ border: '1px solid rgba(115, 92, 0, 0.18)' }}
                >
                  <AppIcon name="verified"
                    className="mb-6 block"
                    style={{ color: 'var(--color-primary)', fontSize: '4rem', fontVariationSettings: "'FILL' 1" }}
                    aria-hidden="true"
                   />
                  <h3
                    className="text-2xl font-bold mb-4"
                    style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}
                  >
                    {isEs ? 'Integridad Profesional' : 'Professional Integrity'}
                  </h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>
                    {isEs
                      ? 'Nuestras evaluaciones utilizan inspección cuidadosa, herramientas de precisión, investigación de mercado y pruebas de ácido en el sitio para que los detalles importantes sean documentados y respetados.'
                      : 'Our evaluations use careful inspection, precision tools, market research, and onsite acid testing so important details are documented and respected.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Items We Buy */}
        <section className="py-20 md:py-28" style={{ background: 'var(--color-background)' }}>
          <div className="ultrawide-page container mx-auto px-6 md:px-12 max-w-6xl">
            <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-4">
              <div className="max-w-xl">
                <h2
                  className="text-3xl md:text-4xl font-bold mb-4 tracking-tight"
                  style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}
                >
                  {isEs ? 'Artículos Excepcionales Buscados' : 'Exceptional Items Sought'}
                </h2>
                <p style={{ color: 'var(--color-on-surface-variant)' }}>
                  {isEs
                    ? 'Nos enfocamos en la adquisición de piezas firmadas de alto valor, antigüedades heredadas y relojes de lujo.'
                    : 'Our boutique focuses on the acquisition of high-value signed pieces, antique heirlooms, and luxury timepieces.'}
                </p>
              </div>
              <Link
                href={isEs ? '/es/free-evaluation' : '/free-evaluation'}
                className="text-sm font-bold uppercase tracking-widest underline underline-offset-8 whitespace-nowrap"
                style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}
              >
                {isEs ? 'SOLICITAR EVALUACIÓN' : 'REQUEST EVALUATION'}
              </Link>
            </div>

            {/* Gallery grid */}
            <div className="grid md:grid-cols-2 gap-4">
              {/* Main feature — Patek / signed watches */}
              <div className="relative group overflow-hidden rounded-2xl shadow-[0_18px_54px_rgba(38,28,6,0.08)]" style={{ minHeight: 400 }}>
                <Image
                  src="/assets/images/pages/patek.webp"
                  alt={isEs ? 'Reloj de lujo Patek Philippe' : 'Patek Philippe luxury watch'}
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-cover group-hover:scale-105 transition-transform duration-700"
                  style={{ objectPosition: 'center 68%' }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-8 text-white">
                  <h4
                    className="text-2xl font-bold"
                    style={{ fontFamily: 'var(--font-headline)' }}
                  >
                    {isEs ? 'Joyería Firmada y Relojes' : 'Signed Jewelry & Watches'}
                  </h4>
                  <p
                    className="text-xs font-bold uppercase tracking-widest mt-2"
                    style={{ color: '#f2ca50', fontFamily: 'var(--font-label)' }}
                  >
                    Cartier · Rolex · Patek Philippe
                  </p>
                </div>
              </div>

              <div className="grid grid-rows-2 gap-4">
                {/* Gold & chains */}
                <div className="relative group overflow-hidden rounded-2xl shadow-[0_14px_38px_rgba(38,28,6,0.08)]" style={{ minHeight: 190 }}>
                  <Image
                    src="/assets/images/pages/gold.webp"
                    alt={isEs ? 'Joyería de oro y cadenas' : 'Gold jewelry and chains'}
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-cover group-hover:scale-105 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                    <h4 className="text-lg font-bold" style={{ fontFamily: 'var(--font-headline)' }}>
                      {isEs ? 'Anillos Antiguos' : 'Antique Rings'}
                    </h4>
                    <p
                      className="text-xs font-bold uppercase tracking-widest mt-1"
                      style={{ color: '#f2ca50', fontFamily: 'var(--font-label)' }}
                    >
                      Georgian · Victorian · Art Deco
                    </p>
                  </div>
                </div>

                {/* Estate pieces */}
                <div className="relative group overflow-hidden rounded-2xl shadow-[0_14px_38px_rgba(38,28,6,0.08)]" style={{ minHeight: 190 }}>
                  <Image
                    src="/assets/images/pages/signed.webp"
                    alt={isEs ? 'Broches y colgantes victorianos de oro' : 'Victorian gold brooches and pendants'}
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-cover group-hover:scale-105 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                    <h4 className="text-lg font-bold" style={{ fontFamily: 'var(--font-headline)' }}>
                      {isEs ? 'Broches Victorianos' : 'Victorian Brooches'}
                    </h4>
                    <p
                      className="text-xs font-bold uppercase tracking-widest mt-1"
                      style={{ color: '#f2ca50', fontFamily: 'var(--font-label)' }}
                    >
                      {isEs ? 'Esmalte Heredado y Oro' : 'Heirloom Enamel & Gold'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Credentials / Stats */}
        <section className="py-16 md:py-24" style={{ background: 'var(--color-surface-container-low)' }}>
          <div className="container mx-auto px-6 md:px-12 max-w-5xl text-center">
            <span
              className="text-xs font-bold uppercase tracking-[0.3em] mb-12 block"
              style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}
            >
              {isEs ? 'Nuestros Estándares' : 'Our Standards'}
            </span>
            <div className="flex flex-wrap justify-center gap-12 md:gap-24">
              {[
                { stat: isEs ? 'Pruebas en el Sitio' : 'Onsite Testing', label: isEs ? 'Pruebas de Ácido en su Cita' : 'Acid Tests at Your Appointment' },
                { stat: '15+', label: isEs ? 'Años de Experiencia' : 'Years Experience' },
                { stat: isEs ? 'Raíces Locales' : 'Local Roots', label: isEs ? 'Nacido y criado en Naples' : 'Born & raised in Naples' },
                { stat: isEs ? 'Mejor Mercado' : 'Top Market', label: isEs ? 'Garantía de Valor' : 'Value Guarantee' },
              ].map((item) => (
                <div key={item.stat} className="flex flex-col items-center">
                  <span
                    className="text-2xl font-bold mb-2"
                    style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-primary)' }}
                  >
                    {item.stat}
                  </span>
                  <p
                    className="text-xs font-bold uppercase tracking-wide"
                    style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}
                  >
                    {item.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

      </main>
      <SiteFooter locale={locale} />
    </>
  );
}
