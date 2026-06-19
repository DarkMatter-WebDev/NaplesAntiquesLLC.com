import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import SiteHeader from '@/components/layout/SiteHeader';
import SiteFooter from '@/components/layout/SiteFooter';
import EvalForm from '@/components/free-evaluation/EvalForm';

export const metadata: Metadata = {
  title: 'Free Jewelry & Gold Evaluation | Naples Estate Jewelry',
  description:
    'Free, no-obligation evaluation of your jewelry, gold, silver, diamonds, watches, and coins in Naples, Marco Island, Bonita Springs, and Fort Myers FL. Live gold pricing and same-day cash offers.',
};

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ submitted?: string }>;
}

export default async function FreeEvaluationPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { submitted } = await searchParams;
  const isEs = locale === 'es';
  const isSubmitted = submitted === '1';

  const categories = isEs
    ? [
        { icon: 'payments', label: 'Oro y Cadenas' },
        { icon: 'diamond', label: 'Diamantes y Anillos' },
        { icon: 'watch', label: 'Relojes' },
        { icon: 'dining', label: 'Plata Esterlina' },
        { icon: 'toll', label: 'Monedas y Lingotes' },
        { icon: 'inventory_2', label: 'Antigüedades y Reliquias' },
      ]
    : [
        { icon: 'payments', label: 'Gold & Chains' },
        { icon: 'diamond', label: 'Diamonds & Rings' },
        { icon: 'watch', label: 'Watches' },
        { icon: 'dining', label: 'Sterling Silver' },
        { icon: 'toll', label: 'Coins & Bullion' },
        { icon: 'inventory_2', label: 'Antiques & Heirlooms' },
      ];

  const steps = isEs
    ? [
        {
          num: '01',
          title: 'Contáctenos',
          body: 'Llámenos o envíenos un texto con una descripción rápida o algunas fotos de lo que tiene.',
        },
        {
          num: '02',
          title: 'Lo Evaluamos',
          body: 'Reunámonos con cita o déjenos ir a usted. Probamos, pesamos y explicamos cómo llegamos a cada número — usando precios de oro en vivo, nada oculto.',
        },
        {
          num: '03',
          title: 'Obtiene un Número Honesto',
          body: 'Sepa exactamente cuánto valen sus artículos. Si desea vender, hacemos una oferta el mismo día — efectivo, cheque o transferencia bancaria. Si no, no hay problema.',
        },
      ]
    : [
        {
          num: '01',
          title: 'Reach Out',
          body: "Call or text us a quick description or a few photos of what you have. Scan our card's QR code anytime to land right here.",
        },
        {
          num: '02',
          title: 'We Evaluate It',
          body: "Meet by appointment or let us come to you. We test, weigh, and explain how we arrive at each number — using live gold pricing, nothing hidden.",
        },
        {
          num: '03',
          title: 'You Get an Honest Number',
          body: "Know exactly what your items are worth. If you want to sell, we make a same-day offer — cash, check, or wire. If not, no problem at all.",
        },
      ];

  return (
    <>
      <SiteHeader />
      <main className="pt-16">

        {/* Hero with inline form */}
        <section className="relative overflow-hidden" style={{ background: '#0e0f0f' }}>
          <div className="absolute inset-0 z-0">
            <Image
              src="/assets/images/pages/jeweler.webp"
              alt={isEs ? 'Joyero midiendo un anillo con calibradores durante una evaluación gratuita' : 'Jeweler measuring a diamond ring with calipers during a free evaluation'}
              fill
              priority
              className="object-cover"
              style={{ objectPosition: 'center 38%', filter: 'grayscale(12%) contrast(1.02)' }}
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(90deg, rgba(10,11,11,0.95) 0%, rgba(10,11,11,0.82) 42%, rgba(10,11,11,0.5) 100%), linear-gradient(0deg, rgba(10,11,11,0.92) 0%, rgba(10,11,11,0.2) 55%, rgba(10,11,11,0.4) 100%)',
              }}
            />
          </div>

          <div className="container mx-auto px-6 md:px-8 max-w-5xl relative z-10 pt-16 pb-14 md:pt-24 md:pb-20">
            <span
              className="inline-block text-xs font-bold uppercase tracking-[0.4em] border rounded-full px-4 py-1.5 mb-6"
              style={{
                color: 'var(--color-primary)',
                borderColor: 'color-mix(in srgb, var(--color-primary) 40%, transparent)',
                fontFamily: 'var(--font-label)',
              }}
            >
              {isEs ? '100% Gratuito — Sin Obligación' : '100% Free — No Obligation'}
            </span>

            <h1
              className="text-3xl md:text-6xl font-bold mb-5 tracking-tight max-w-3xl leading-[1.05]"
              style={{ fontFamily: 'var(--font-headline)', color: '#f7f2e7', textShadow: '0 2px 24px rgba(0,0,0,0.45)' }}
            >
              {isEs
                ? '¿Cuánto vale realmente? Descúbralo gratis.'
                : "What's It Really Worth? Find Out for Free."}
            </h1>

            <p className="hidden md:block text-lg md:text-2xl mb-9 max-w-2xl leading-relaxed" style={{ color: '#d8d1c2' }}>
              {isEs
                ? 'Obtenga una evaluación experta y sin presión de su joyería, oro, plata, diamantes, relojes y monedas — con precios en vivo según el mercado de hoy.'
                : "Get an expert, no-pressure evaluation of your jewelry, gold, silver, diamonds, watches, and coins — priced live against today's market. Walk away knowing exactly what you have."}
            </p>

            <div className="mb-9">
              <EvalForm locale={locale} submitted={isSubmitted} />
            </div>

            {/* Trust chips */}
            <ul className="flex flex-wrap gap-2.5 md:gap-3">
              {(isEs
                ? ['Sin obligación', 'Oferta en efectivo el mismo día', 'Precios transparentes y en vivo', 'Privado y discreto']
                : ['No obligation', 'Same-day cash offer', 'Live, transparent pricing', 'Private & discreet']
              ).map((chip) => (
                <li
                  key={chip}
                  className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs"
                  style={{
                    border: '1px solid rgba(242,202,80,0.34)',
                    background: 'rgba(242,202,80,0.07)',
                    color: '#ecdcb0',
                    letterSpacing: '0.04em',
                    fontFamily: 'var(--font-label)',
                  }}
                >
                  <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }} aria-hidden="true">
                    check_circle
                  </span>
                  {chip}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* What We Evaluate */}
        <section className="py-16 md:py-24" style={{ background: 'var(--color-surface-container-low)' }}>
          <div className="container mx-auto px-6 md:px-8 max-w-6xl">
            <div className="text-center mb-12">
              <span
                className="text-xs font-bold uppercase tracking-[0.4em]"
                style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}
              >
                {isEs ? 'Lo que Evaluamos' : 'What We Evaluate'}
              </span>
              <h2
                className="text-3xl md:text-4xl font-bold mt-3 mb-4 tracking-tight"
                style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}
              >
                {isEs
                  ? 'Traiga Cualquier Joyería Antigua — Oro, Plata, Patrimonio y Más'
                  : 'Bring Any Old Jewelry — Gold, Silver, Estate & More'}
              </h2>
              <p className="text-lg max-w-2xl mx-auto" style={{ color: 'var(--color-on-surface-variant)' }}>
                {isEs
                  ? 'No es necesario ordenarla primero. Piezas individuales o colecciones enteras — evaluamos todo y le damos un número honesto.'
                  : "No need to sort it first. Single pieces or whole unsorted collections — we'll evaluate everything and give you one honest number."}
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-w-4xl mx-auto">
              {categories.map((cat) => (
                <a
                  key={cat.label}
                  href="tel:2394048505"
                  className="fe-icon-tile"
                >
                  <span
                    className="material-symbols-outlined mb-3 text-[#735c00]"
                    style={{ fontSize: '2.35rem', fontVariationSettings: "'FILL' 1" }}
                    aria-hidden="true"
                  >
                    {cat.icon}
                  </span>
                  <span className="text-sm font-bold leading-tight" style={{ fontFamily: 'var(--font-label)' }}>
                    {cat.label}
                  </span>
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-16 md:py-24">
          <div className="container mx-auto px-6 md:px-8 max-w-4xl">
            <div className="text-center mb-12">
              <h2
                className="text-3xl md:text-4xl font-bold mb-4 tracking-tight"
                style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}
              >
                {isEs ? 'Cómo Funciona la Evaluación Gratuita' : 'How the Free Evaluation Works'}
              </h2>
              <p className="text-lg max-w-2xl mx-auto" style={{ color: 'var(--color-on-surface-variant)' }}>
                {isEs
                  ? 'Simple, rápido y completamente gratuito. Nunca está obligado a vender nada.'
                  : "Simple, fast, and completely free. You're never obligated to sell anything."}
              </p>
            </div>

            <div className="space-y-4">
              {steps.map((step) => (
                <div
                  key={step.num}
                  className="flex flex-col rounded-2xl px-6 py-8 shadow-[0_14px_38px_rgba(38,28,6,0.05)] md:flex-row md:items-center md:px-8"
                  style={{ background: 'var(--color-surface-container-high)' }}
                >
                  <span
                    className="font-bold italic text-4xl md:mr-12 mb-4 md:mb-0 opacity-50"
                    style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-primary)' }}
                  >
                    {step.num}
                  </span>
                  <div className="flex-1">
                    <h4
                      className="text-xl font-bold mb-1"
                      style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}
                    >
                      {step.title}
                    </h4>
                    <p style={{ color: 'var(--color-on-surface-variant)' }}>{step.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Trust pillars */}
        <section className="py-16 md:py-24" style={{ background: 'var(--color-surface-container-low)' }}>
          <div className="container mx-auto px-6 md:px-8 max-w-4xl">
            <div className="grid md:grid-cols-3 gap-6 text-center">
              {(isEs
                ? [
                    { icon: 'check_circle', title: 'Sin Costo, Sin Trampa', body: 'La evaluación es genuinamente gratuita y no tiene ninguna obligación de vender.' },
                    { icon: 'monitoring', title: 'Precios de Mercado en Vivo', body: 'El oro y la plata se valoran según los precios spot en tiempo real, mostrados abiertamente.' },
                    { icon: 'lock', title: 'Privado y Discreto', body: 'Móvil y solo con cita. Sus artículos e información permanecen confidenciales.' },
                  ]
                : [
                    { icon: 'check_circle', title: 'No Cost, No Catch', body: 'The evaluation is genuinely free and carries zero obligation to sell.' },
                    { icon: 'monitoring', title: 'Live Market Pricing', body: 'Gold and silver are valued against real-time spot prices, shown openly.' },
                    { icon: 'lock', title: 'Private & Discreet', body: 'Mobile and appointment-only. Your items and information stay confidential.' },
                  ]
              ).map((pillar) => (
                <div key={pillar.title} className="p-6">
                  <span
                    className="material-symbols-outlined mb-3 block text-[#735c00]"
                    style={{ fontSize: '2.2rem', fontVariationSettings: "'FILL' 1" }}
                    aria-hidden="true"
                  >
                    {pillar.icon}
                  </span>
                  <h3
                    className="text-lg font-bold mb-2"
                    style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}
                  >
                    {pillar.title}
                  </h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>
                    {pillar.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* About Chris */}
        <section
          className="py-16 md:py-24"
          style={{ background: 'var(--color-surface-container-low)', borderTop: '1px solid var(--color-outline-variant)' }}
        >
          <div className="container mx-auto px-6 md:px-8 max-w-5xl">
            <div className="grid md:grid-cols-[280px_1fr] gap-10 md:gap-14 items-center">
              <div className="flex justify-center">
                <Image
                  src="/assets/images/pages/chris.webp"
                  alt={isEs ? 'Chris, propietario de Naples Estate Jewelry' : 'Chris, owner of Naples Estate Jewelry'}
                  width={256}
                  height={256}
                  className="rounded-full object-cover"
                  style={{ width: '12rem', height: '12rem', border: '2px solid color-mix(in srgb, var(--color-primary) 30%, transparent)', boxShadow: '0 24px 60px rgba(0,0,0,0.4)' }}
                />
              </div>
              <div className="text-center md:text-left">
                <span
                  className="text-xs font-bold uppercase tracking-[0.4em]"
                  style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}
                >
                  {isEs ? 'Hable con un Experto Real' : 'Talk to a Real Expert'}
                </span>
                <h2
                  className="text-2xl md:text-3xl font-bold mt-3 mb-4 tracking-tight"
                  style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}
                >
                  {isEs ? "Tratará Directamente con Chris" : "You'll Deal Directly With Chris"}
                </h2>
                <p className="text-lg leading-relaxed mb-6" style={{ color: 'var(--color-on-surface-variant)' }}>
                  {isEs
                    ? 'Sin centros de llamadas, sin intermediarios. Con más de 15 años evaluando joyería de patrimonio en todo el suroeste de Florida, Chris revisa personalmente cada pieza y explica exactamente cómo llega a cada número — para que pueda tomar una decisión informada sin ninguna presión.'
                    : "No call centers, no middlemen. With 15+ years evaluating estate jewelry across Southwest Florida, Chris personally reviews every piece and explains exactly how he reaches each number — so you can make an informed decision with zero pressure."}
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start items-center">
                  <a href="tel:2394048505" className="gold-button">
                    {isEs ? 'Llame o Envíe un Texto a Chris' : 'Call or Text Chris'}
                  </a>
                  <Link
                    href={isEs ? '/es/about' : '/about'}
                    className="text-sm font-bold uppercase tracking-widest underline underline-offset-4"
                    style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}
                  >
                    {isEs ? 'Conozca al equipo' : 'Meet the team'}
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-20 md:py-28">
          <div className="container mx-auto px-6 md:px-8 max-w-4xl text-center">
            <h2
              className="text-4xl md:text-5xl font-bold mb-6 tracking-tight"
              style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}
            >
              {isEs ? 'Descubra Cuánto Vale' : "Find Out What It's Worth"}
            </h2>
            <p className="text-lg mb-10 max-w-2xl mx-auto" style={{ color: 'var(--color-on-surface-variant)' }}>
              {isEs
                ? 'Solo toma un momento obtener una evaluación gratuita y honesta. Llame o envíenos un texto — nunca hay presión para vender.'
                : "It only takes a moment to get a free, honest evaluation. Call or text us — there's never any pressure to sell."}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center flex-wrap">
              <a href="tel:2394048505" className="gold-button">
                (239) 404-8505
              </a>
              <Link href={isEs ? '/es/contact' : '/contact'} className="outline-button">
                {isEs ? 'Solicitar una Llamada' : 'Request a Call'}
              </Link>
            </div>
          </div>
        </section>

      </main>
      <SiteFooter locale={locale} />
    </>
  );
}
