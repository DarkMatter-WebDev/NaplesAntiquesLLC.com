import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata } from '@/lib/seo';
import { jsonLdHtml } from '@/lib/json-ld';
import SiteHeader from '@/components/layout/SiteHeader';
import { BreadcrumbTrailFromLd } from '@/components/BreadcrumbTrail';
import SiteFooter from '@/components/layout/SiteFooter';
import ClayMark from '@/components/ClayMark';

interface Props {
  params: Promise<{ locale: string }>;
}

// Seller-intent lander for the diamond query cluster (GSC 2026-08: "sell
// diamonds naples" 71.6, "diamond buyers naples fl" 61.7, "sell diamond ring
// naples" 69.8, "naples engagement ring buyer" 68.2, "sell diamond eternity
// bands naples" 59.7 — ~35 impressions with no page). The page's differentiator
// is the honest resale-vs-insurance-appraisal framing; keep it. Lab-grown
// stance (owner decision 2026-08-30): we DO buy them, priced honestly against
// their much lower resale market.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const isEs = locale === 'es';
  return pageMetadata({
    title: isEs ? 'Vender Diamantes en Naples, FL' : 'Sell Diamonds in Naples, FL',
    description: isEs
      ? 'Compradores de diamantes en Naples, FL. Venda anillos de compromiso, argollas de eternidad, aretes y piedras sueltas — con o sin certificado. Evaluación privada y pago inmediato. (239) 404-8505.'
      : 'Diamond buyers in Naples, FL. Sell engagement rings, eternity bands, studs, and loose stones — certified or not. Private evaluations, honest resale numbers, paid on the spot. Call (239) 404-8505.',
    path: '/diamond-buyers',
    locale,
  });
}

export default async function DiamondBuyersPage({ params }: Props) {
  const { locale } = await params;
  const isEs = locale === 'es';
  const p = (path: string) => (isEs ? `/es${path}` : path);
  const evalHref = p('/free-evaluation');
  const canonicalUrl = `https://naplesestatejewelry.com${isEs ? '/es' : ''}/diamond-buyers`;

  const factors = [
    {
      kEn: 'The stone',
      kEs: 'La piedra',
      titleEn: 'The 4Cs, seen honestly',
      titleEs: 'Las 4C, vistas con honestidad',
      descEn: 'Carat, cut, color, clarity — measured with loupe and gauge in front of you. GIA certificates help, and we coordinate GIA verification for significant stones, but an uncertified diamond is still very sellable.',
      descEs: 'Quilates, corte, color y claridad — medidos con lupa y calibrador frente a usted. Los certificados GIA ayudan, y coordinamos la verificación con GIA para piedras importantes, pero un diamante sin certificado sigue siendo muy vendible.',
    },
    {
      kEn: 'The market',
      kEs: 'El mercado',
      titleEn: 'Real resale demand',
      titleEs: 'Demanda real de reventa',
      descEn: 'Shapes and sizes move differently — a one-carat round sells faster than a three-carat marquise. We buy against today’s actual market, not a chart from a decade ago.',
      descEs: 'Las formas y los tamaños se mueven distinto — un redondo de un quilate se vende más rápido que un marquise de tres. Compramos según el mercado real de hoy, no según una tabla de hace una década.',
    },
    {
      kEn: 'The mounting',
      kEs: 'La montura',
      titleEn: 'Gold counts too',
      titleEs: 'El oro también cuenta',
      descEn: 'The setting is weighed and priced as gold at live spot — added to the stone value, never ignored. Signed pieces (Tiffany, Cartier) are priced as pieces, not parts.',
      descEs: 'La montura se pesa y se valora como oro al precio spot en vivo — sumada al valor de la piedra, nunca ignorada. Las piezas firmadas (Tiffany, Cartier) se valoran como piezas, no como partes.',
    },
  ] as const;

  const faqs = [
    {
      qEn: 'How much can I sell my diamond ring for?',
      qEs: '¿Por cuánto puedo vender mi anillo de diamantes?',
      aEn: 'It depends on the stone’s carat, cut, color, and clarity, the current resale market for its shape and size, and the gold in the mounting. That is why we evaluate in person and explain each factor — a real number beats an online guess. The evaluation is free.',
      aEs: 'Depende de los quilates, el corte, el color y la claridad de la piedra, del mercado actual de reventa para su forma y tamaño, y del oro de la montura. Por eso evaluamos en persona y explicamos cada factor — un número real vale más que una estimación en línea. La evaluación es gratuita.',
    },
    {
      qEn: 'Do I need a GIA certificate to sell a diamond?',
      qEs: '¿Necesito un certificado GIA para vender un diamante?',
      aEn: 'No. A certificate helps confirm what a stone is, and we coordinate GIA verification for significant diamonds, but we regularly buy uncertified stones — we grade them in front of you.',
      aEs: 'No. Un certificado ayuda a confirmar qué es la piedra, y coordinamos la verificación con GIA para diamantes importantes, pero compramos piedras sin certificado con regularidad — las clasificamos frente a usted.',
    },
    {
      qEn: 'Why is the offer less than my insurance appraisal says?',
      qEs: '¿Por qué la oferta es menor que lo que dice mi tasación del seguro?',
      aEn: 'An insurance appraisal states retail replacement value — what a jeweler would charge to sell you a new equivalent, at full margin. Resale is a different market, and any buyer’s honest offer will be below that paper number. We would rather explain the difference than surprise you with it.',
      aEs: 'Una tasación de seguro indica el valor de reposición al detalle — lo que un joyero cobraría por venderle un equivalente nuevo, con margen completo. La reventa es un mercado distinto, y la oferta honesta de cualquier comprador estará por debajo de ese número en papel. Preferimos explicar la diferencia antes que sorprenderlo con ella.',
    },
    {
      qEn: 'Do you buy lab-grown diamonds?',
      qEs: '¿Compran diamantes de laboratorio?',
      aEn: 'Yes. Lab-grown resale values are a fraction of natural-diamond values — production keeps getting cheaper, and the resale market prices them accordingly. We will price yours honestly against that market and show you exactly how we got there.',
      aEs: 'Sí. Los valores de reventa de los diamantes de laboratorio son una fracción de los naturales — producirlos es cada vez más barato, y el mercado de reventa los valora en consecuencia. Valoraremos el suyo con honestidad según ese mercado y le mostraremos exactamente cómo llegamos al número.',
    },
    {
      qEn: 'Where can I sell an engagement ring in Naples?',
      qEs: '¿Dónde puedo vender un anillo de compromiso en Naples?',
      aEn: 'At our Shirley St showroom in North Naples — walk in during open hours, or book a private appointment, including home visits across Southwest Florida. Tested, weighed, and priced in front of you, paid on the spot.',
      aEs: 'En nuestro salón de Shirley St en North Naples — entre durante el horario de atención o reserve una cita privada, incluidas visitas a domicilio en todo el suroeste de Florida. Probado, pesado y valorado frente a usted, con pago en el acto.',
    },
  ];

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: isEs ? 'Inicio' : 'Home', item: `https://naplesestatejewelry.com${isEs ? '/es' : ''}` },
      { '@type': 'ListItem', position: 2, name: isEs ? 'Vender Diamantes' : 'Sell Diamonds', item: canonicalUrl },
    ],
  };

  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: isEs ? f.qEs : f.qEn,
      acceptedAnswer: { '@type': 'Answer', text: isEs ? f.aEs : f.aEn },
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(breadcrumbLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(faqLd) }} />
      <SiteHeader />
      <main className="site-header-offset">

        {/* Hero */}
        <section className="relative flex min-h-[460px] items-center overflow-hidden bg-[#1a1c1c]">
          <div className="ultrawide-page relative z-10 mx-auto w-full max-w-[1440px] px-4 md:px-8">
            <div className="max-w-3xl">
              <BreadcrumbTrailFromLd ld={breadcrumbLd} />
              <span className="mb-4 block text-xs font-bold uppercase tracking-[0.2em] text-[#e9c349]" style={{ fontFamily: 'var(--font-label)' }}>
                {isEs ? 'Privado · Discreto · Pago en el Acto' : 'Private · Discreet · Paid on the Spot'}
              </span>
              <h1 className="mb-6 text-4xl font-bold leading-tight text-white md:text-5xl" style={{ fontFamily: 'var(--font-headline)' }}>
                {isEs ? 'Venda Diamantes y Joyas con Diamantes en Naples' : 'Sell Diamonds & Diamond Jewelry in Naples'}
              </h1>
              <p className="mb-8 max-w-xl text-lg leading-relaxed text-[#d7d0c3]">
                {isEs
                  ? 'Anillos de compromiso, argollas de eternidad, aretes, pulseras de tenis y piedras sueltas — con o sin certificado. Una evaluación privada con la matemática explicada abiertamente, y el pago en el momento en que acepta. Vender un diamante suele ser personal; lo mantenemos sin prisas y enteramente en sus términos.'
                  : "Engagement rings, eternity bands, studs, tennis bracelets, and loose stones — certified or not. A private evaluation with the math explained openly, and payment the moment you accept. Selling a diamond is often personal; we keep it unhurried and entirely on your terms."}
              </p>
              <div className="flex flex-wrap gap-4">
                <Link href={evalHref} className="gold-button">
                  {isEs ? 'EVALUACIÓN GRATUITA DE DIAMANTES' : 'GET A FREE DIAMOND EVALUATION'}
                </Link>
                <a
                  href="tel:2394048505"
                  className="outline-button"
                  style={{ borderColor: 'rgba(255,255,255,0.48)', color: 'white', background: 'rgba(255,255,255,0.08)' }}
                >
                  {isEs ? 'LLAMAR (239) 404-8505' : 'CALL (239) 404-8505'}
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* What drives the offer */}
        <section className="border-y border-[#d0c5af] bg-[#f3f3f3] py-16">
          <div className="mx-auto max-w-5xl px-4 md:px-8">
            <h2 className="mb-4 text-3xl font-bold text-[#1a1c1c] md:text-4xl" style={{ fontFamily: 'var(--font-headline)' }}>
              {isEs ? 'Lo que un diamante realmente vale al venderlo' : 'What a diamond is really worth when you sell'}
            </h2>
            <p className="max-w-2xl text-base leading-relaxed text-[#4d4635]">
              {isEs
                ? 'El número de una vieja tasación de seguro es un valor de reposición al detalle — más o menos lo que un joyero cobraría por venderle uno nuevo. La reventa es un mercado distinto, y quien no se lo diga lo está preparando para una decepción. Lo que realmente determina su oferta:'
                : "The number on an old insurance appraisal is a retail replacement value — roughly what a jeweler would charge to sell you a new one. Resale is a different market, and anyone who won't say so is setting you up for disappointment. What actually drives your offer:"}
            </p>
            <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
              {factors.map((f) => (
                <div key={f.kEn} className="rounded-2xl border border-[#d0c5af] bg-white p-6 shadow-[0_10px_28px_rgba(38,28,6,0.04)]">
                  <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-[#735c00]" style={{ fontFamily: 'var(--font-label)' }}>
                    {isEs ? f.kEs : f.kEn}
                  </p>
                  <h3 className="mb-2 text-lg font-bold text-[#1a1c1c]" style={{ fontFamily: 'var(--font-headline)' }}>
                    {isEs ? f.titleEs : f.titleEn}
                  </h3>
                  <p className="text-sm leading-relaxed text-[#4d4635]">{isEs ? f.descEs : f.descEn}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Life's timeline */}
        <section className="mx-auto max-w-3xl px-4 py-16 text-center md:px-8">
          <h2 className="mb-4 text-3xl font-bold text-[#1a1c1c] md:text-4xl" style={{ fontFamily: 'var(--font-headline)' }}>
            {isEs ? 'Se vende en los tiempos de la vida' : "Sold on life's timeline"}
          </h2>
          <p className="mx-auto max-w-2xl text-base leading-relaxed text-[#4d4635]">
            {isEs
              ? 'Anillos de compromiso después de un divorcio, un solitario que llegó con una herencia, una mejora que dejó el original en un cajón. Sea lo que sea que lo traiga, la evaluación ocurre en privado, a su ritmo, sin juicios y sin presión — y usted se va con el pago en la mano o con su anillo en el dedo, nunca con un "tal vez".'
              : 'Engagement rings after a divorce, a solitaire that came with an inheritance, an upgrade that left the original in a drawer. Whatever brings you in, the evaluation happens in private, at your pace, with no judgment and no pressure — and you leave with payment in hand or your ring still on your finger, never a maybe.'}
          </p>
        </section>

        {/* FAQ */}
        <section className="border-t border-[#d0c5af] bg-[#f3f3f3] py-20">
          <div className="mx-auto max-w-3xl px-4 md:px-8">
            <h2 className="mb-10 text-center text-3xl font-bold text-[#1a1c1c] md:text-4xl" style={{ fontFamily: 'var(--font-headline)' }}>
              {isEs ? 'Preguntas Sobre Vender Diamantes' : 'Selling Diamonds FAQ'}
            </h2>
            <div className="flex flex-col gap-4">
              {faqs.map((f) => (
                <details key={f.qEn} className="group rounded-2xl border border-[#d0c5af] bg-white p-5 shadow-[0_10px_28px_rgba(38,28,6,0.04)]">
                  <summary className="cursor-pointer list-none text-base font-bold text-[#1a1c1c]" style={{ fontFamily: 'var(--font-headline)' }}>
                    {isEs ? f.qEs : f.qEn}
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-[#4d4635]">{isEs ? f.aEs : f.aEn}</p>
                </details>
              ))}
            </div>
            <p className="mt-8 text-center text-sm leading-relaxed text-[#4d4635]">
              {isEs ? (
                <>¿Vende más que diamantes? También compramos <Link href={p('/gold-services')} className="font-semibold text-[#735c00] underline underline-offset-2">oro</Link>, <Link href={p('/silver-services')} className="font-semibold text-[#735c00] underline underline-offset-2">plata esterlina</Link> y <Link href={p('/estate-jewelry')} className="font-semibold text-[#735c00] underline underline-offset-2">joyería de patrimonio</Link>.</>
              ) : (
                <>Selling more than diamonds? We also buy <Link href={p('/gold-services')} className="font-semibold text-[#735c00] underline underline-offset-2">gold</Link>, <Link href={p('/silver-services')} className="font-semibold text-[#735c00] underline underline-offset-2">sterling silver</Link>, and <Link href={p('/estate-jewelry')} className="font-semibold text-[#735c00] underline underline-offset-2">estate jewelry</Link>.</>
              )}
            </p>
          </div>
        </section>

        {/* Final CTA */}
        <section className="bg-[#2f3131] py-24 text-center">
          <div className="mx-auto max-w-2xl px-4">
            <ClayMark name="gemstone" size={96} onDark className="mx-auto mb-6 block" />
            <h2 className="mb-6 text-3xl font-bold text-white md:text-4xl" style={{ fontFamily: 'var(--font-headline)' }}>
              {isEs ? '¿Listo para un número honesto por su diamante?' : 'Ready for an honest number on your diamond?'}
            </h2>
            <p className="mx-auto mb-10 max-w-lg text-base leading-relaxed text-[#d7d0c3]">
              {isEs
                ? 'Evaluación gratuita, privada y sin obligación — en el salón o en su casa.'
                : 'Free, private, no-obligation evaluation — at the showroom or in your home.'}
            </p>
            <div className="flex flex-col justify-center gap-6 md:flex-row">
              <Link href={evalHref} className="gold-button">
                {isEs ? 'PROGRAMAR EVALUACIÓN' : 'SCHEDULE AN EVALUATION'}
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
