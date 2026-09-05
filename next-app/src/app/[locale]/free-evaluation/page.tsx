import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import Image from 'next/image';
import Link from 'next/link';
import SiteHeader from '@/components/layout/SiteHeader';
import BreadcrumbTrail from '@/components/BreadcrumbTrail';
import BreadcrumbJsonLd from '@/components/BreadcrumbJsonLd';
import SiteFooter from '@/components/layout/SiteFooter';
import EvalForm from '@/components/free-evaluation/EvalForm';
import { AppIcon } from '@/components/AppIcon';
import ClayMark, { type ClayMarkName } from '@/components/ClayMark';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const isEs = locale === 'es';
  return pageMetadata({
    title: isEs ? 'Evaluación Gratuita de Joyas y Oro' : 'Free Jewelry & Gold Evaluation',
    description: isEs
      ? 'Evaluación gratuita y sin compromiso de joyas, oro, plata, diamantes, relojes y monedas en Naples y el suroeste de Florida, con precios de mercado en vivo.'
      : 'Free, no-obligation evaluation of your jewelry, gold, silver, diamonds, watches, and coins in Naples, Marco Island, Bonita Springs, and Fort Myers FL. Live gold pricing and same-day cash offers.',
    path: '/free-evaluation',
    locale,
  });
}

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ submitted?: string }>;
}

export default async function FreeEvaluationPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { submitted } = await searchParams;
  const isEs = locale === 'es';
  const isSubmitted = submitted === '1';

  // `mark` names a clay illustration in /assets/images/icons, not an AppIcon.
  // These are decorative illustrated marks rather than functional UI icons —
  // see DECISIONS, "Illustrated clay marks are images; UI icons stay Lucide".
  const categories = isEs
    ? [
        { mark: 'chain' as ClayMarkName, label: 'Oro y Cadenas' },
        { mark: 'signet-ring' as ClayMarkName, label: 'Diamantes y Anillos' },
        { mark: 'watch' as ClayMarkName, label: 'Relojes' },
        { mark: 'sterling-flatware' as ClayMarkName, label: 'Plata Esterlina' },
        { mark: 'coins' as ClayMarkName, label: 'Monedas y Lingotes' },
        { mark: 'heirloom' as ClayMarkName, label: 'Antigüedades y Reliquias' },
      ]
    : [
        { mark: 'chain' as ClayMarkName, label: 'Gold & Chains' },
        { mark: 'signet-ring' as ClayMarkName, label: 'Diamonds & Rings' },
        { mark: 'watch' as ClayMarkName, label: 'Watches' },
        { mark: 'sterling-flatware' as ClayMarkName, label: 'Sterling Silver' },
        { mark: 'coins' as ClayMarkName, label: 'Coins & Bullion' },
        { mark: 'heirloom' as ClayMarkName, label: 'Antiques & Heirlooms' },
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
          body: 'Visítenos en el salón o déjenos ir a usted. Probamos, pesamos y explicamos cómo llegamos a cada número — usando precios de oro en vivo, nada oculto.',
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
          body: "Visit the showroom, or let us come to you. We test, weigh, and explain how we arrive at each number — using live gold pricing, nothing hidden.",
        },
        {
          num: '03',
          title: 'You Get an Honest Number',
          body: "Know exactly what your items are worth. If you want to sell, we make a same-day offer — cash, check, or wire. If not, no problem at all.",
        },
      ];

  // One crumbs array feeds both the JSON-LD and the visible trail.
  const crumbs = [{ name: isEs ? 'Evaluación Gratuita' : 'Free Evaluation', path: '/free-evaluation' }];

  return (
    <>
      <BreadcrumbJsonLd locale={locale} crumbs={crumbs} />
      <SiteHeader />
      <main className="site-header-offset">

        {/* Hero — descriptive, no form. This page is built to be SENT to someone
            who is unsure what they have, so the first screen explains the
            service and shows who they would be dealing with. The form moved down
            to its own block below: leading with it read as being asked to hand
            over details before anything had been explained. */}
        <section className="relative overflow-hidden" style={{ background: '#0e0f0f' }}>
          {/* ultrawide-page: a max-w-6xl canvas has to opt into an ultra-wide
              tier — enforced by ultrawide-layout.test.ts, and it matches the
              What We Evaluate section below. */}
          <div className="ultrawide-page container mx-auto px-6 md:px-8 max-w-6xl relative z-10 pt-14 pb-14 md:pt-20 md:pb-20">
            <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
              <div>
                {/* --color-primary (#735c00) is the LIGHT-surface gold and only
                    reaches ~2.96:1 on this near-black hero — below AA, and it
                    read as dimmed. #f2ca50 is the on-dark gold already used by
                    the kicker, the metal terms and the trust chips below, at
                    12:1. Tinted fill so the pill still reads as a pill now that
                    the border is no longer carrying it alone. */}
                <BreadcrumbTrail locale={locale} crumbs={crumbs} tone="dark" />
                <span
                  className="inline-block text-xs font-bold uppercase tracking-[0.4em] border rounded-full px-4 py-1.5 mb-6"
                  style={{
                    color: '#f2ca50',
                    borderColor: 'rgba(242, 202, 80, 0.38)',
                    background: 'rgba(242, 202, 80, 0.08)',
                    fontFamily: 'var(--font-label)',
                  }}
                >
                  {isEs ? '100% Gratuito — Sin Obligación' : '100% Free — No Obligation'}
                </span>

                <h1
                  className="text-3xl md:text-5xl font-bold mb-5 tracking-tight leading-[1.06]"
                  style={{ fontFamily: 'var(--font-headline)', color: '#f7f2e7' }}
                >
                  {isEs
                    ? 'Traiga lo que tenga. Le diré exactamente qué es.'
                    : "Bring Whatever You Have. I'll Tell You Exactly What It Is."}
                </h1>

                <div className="text-base md:text-lg leading-relaxed" style={{ color: '#d8d1c2' }}>
                  <p className="fe-hero-lede">
                    {isEs
                      ? 'Soy Chris. Llevo más de 15 años evaluando joyería de patrimonio en el suroeste de Florida, y estoy encantado de revisar lo que tenga — sin ninguna obligación de vender.'
                      : "I'm Chris. I've spent 15+ years evaluating estate jewelry across Southwest Florida, and I'm happy to go through whatever you have — with no obligation to sell any of it."}
                  </p>

                  <h2 className="fe-hero-kicker mt-7">
                    {isEs ? 'Cada pieza, identificada' : 'Every piece, identified'}
                  </h2>
                  <p>
                    {isEs
                      ? 'No hace falta ordenar nada primero. Traiga la caja entera, el cajón entero, el patrimonio entero. Yo separo lo que es oro y plata de lo que no lo es, y luego le digo exactamente qué es cada pieza:'
                      : "You don't need to sort anything first. Bring the whole box, the whole drawer, the whole estate. I separate what is gold and silver from what isn't, then tell you exactly what each piece is:"}
                  </p>

                  {/* Grouped by metal and ascending within each group, ending
                      open — the list is an illustration of the detail you get
                      back, not the full set of things we handle. */}
                  <dl className="fe-metal-panel mt-4">
                    {(isEs
                      ? [
                          ['Oro', '9k, 10k, 14k, 18k, 22k y más'],
                          ['Plata', 'esterlina .925, europea 800 y 900, plata de monedas'],
                          ['Y lo demás', 'platino, paladio, relleno de oro, chapado, bisutería — se lo digo tal cual'],
                        ]
                      : [
                          ['Gold', '9k, 10k, 14k, 18k, 22k and up'],
                          ['Silver', 'sterling .925, European 800 and 900, coin silver'],
                          ['Everything else', 'platinum, palladium, gold-filled, plated, costume — I tell you straight'],
                        ]
                    ).map(([label, list]) => (
                      <div key={label} className="fe-metal-row">
                        <dt className="fe-metal-term">{label}</dt>
                        <dd className="fe-metal-detail">{list}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="fe-hero-note mt-3">
                    {isEs
                      ? 'Y si aparece algo que no está en esa lista, también se lo identifico — rara vez llega una caja sin alguna sorpresa.'
                      : "And if something turns up that isn't on that list, I'll identify that too — a box rarely arrives without at least one surprise in it."}
                  </p>

                  <p className="fe-hero-closer mt-7">
                    {isEs
                      ? 'Y si no está seguro de qué conservar y qué vender, valoro las piezas una por una para que pueda decidir con números reales delante.'
                      : "And if you're not sure what to keep and what to sell, I'll price pieces individually so you can decide with real numbers in front of you."}
                  </p>
                </div>

                {/* Site button classes, not one-off inline styles. The primary
                    previously painted itself with --color-primary (#735c00) and
                    dark text on top, which reads as a disabled control rather
                    than a call to action. `.gold-button` is the brighter
                    gradient used for every other primary CTA and brings its
                    hover / active / focus-visible states with it. */}
                {/* Centred below lg for the same reason as the trust chips
                    further down: the hero is one stacked column there. */}
                <div className="mt-8 flex flex-wrap justify-center lg:justify-start gap-3">
                  <a href="#request" className="gold-button">
                    {isEs ? 'Enviar una solicitud' : 'Send a request'}
                  </a>
                  <a href="tel:2394048505" className="outline-button outline-button-on-dark">
                    {isEs ? 'Llamar (239) 404-8505' : 'Call (239) 404-8505'}
                  </a>
                </div>
              </div>

              {/* PLACEHOLDER, to be replaced with a real photograph of Chris.
                  Generated, and deliberately framed with the face out of shot:
                  the copy beside it is first person ("I'm Chris…"), so a
                  recognisable stranger here would read as a claim about who he
                  is. The alt text describes the work, never a person, for the
                  same reason. Swap the file and the alt text together. */}
              <div className="relative">
                <Image
                  src="/assets/images/pages/evaluation-desk-placeholder.webp"
                  alt={isEs
                    ? 'Piezas de oro y plata clasificadas en grupos sobre un tapete de escritorio, junto a una lupa de joyero y una báscula'
                    : "Gold and silver pieces sorted into groups on a desk mat beside a jeweller's loupe and a scale"}
                  width={1600}
                  height={1067}
                  priority
                  sizes="(min-width: 1024px) 42vw, 100vw"
                  className="w-full h-auto rounded-2xl"
                  style={{ boxShadow: '0 24px 70px rgba(0,0,0,0.45)' }}
                />
              </div>
            </div>

            {/* Trust chips. Centred below lg: the hero is a single stacked
                column there, and a ragged left-aligned wrap (2 / 1 / 1) reads as
                broken rather than deliberate. From lg the hero is two columns
                with everything left-aligned, so the row follows. */}
            <ul className="flex flex-wrap justify-center lg:justify-start gap-2.5 md:gap-3 mt-10">
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
                  <AppIcon name="check_circle" className="text-sm" aria-hidden="true" />
                  {chip}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Request block — the form, now in the second position with a plain
            lead-in rather than sitting in the hero. */}
        <section id="request" className="scroll-mt-24 py-14 md:py-20" style={{ background: '#141616' }}>
          <div className="container mx-auto px-6 md:px-8 max-w-3xl">
            <div className="text-center mb-8">
              <h2
                className="text-2xl md:text-3xl font-bold mb-3 tracking-tight"
                style={{ fontFamily: 'var(--font-headline)', color: '#f7f2e7' }}
              >
                {isEs ? 'Envíe una solicitud abajo' : 'Send a request below'}
              </h2>
              <p className="text-base leading-relaxed" style={{ color: '#c9c2b3' }}>
                {isEs
                  ? 'Cuéntenos brevemente qué tiene y, si quiere, adjunte fotos de las piezas. No es obligatorio — una descripción de una línea es suficiente para empezar.'
                  : 'Tell us briefly what you have and, if you like, attach photos of the items. Photos are optional — a one-line description is enough to get started.'}
              </p>
            </div>
            <EvalForm locale={locale} submitted={isSubmitted} />
          </div>
        </section>

        {/* What We Evaluate */}
        <section className="py-16 md:py-24" style={{ background: 'var(--color-surface-container-low)' }}>
          <div className="ultrawide-page container mx-auto px-6 md:px-8 max-w-6xl">
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

            {/* Generous row gap because there are no longer cards to separate
                these — the whitespace is the only thing grouping each mark with
                its own label rather than the row below. */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-10 sm:gap-x-8 sm:gap-y-12 max-w-4xl mx-auto">
              {categories.map((cat) => (
                <a
                  key={cat.label}
                  href="tel:2394048505"
                  className="fe-icon-tile"
                >
                  {/* Deliberately oversized — responsive sizing and the hover
                      tilt live in `.fe-icon-mark` (globals.css). */}
                  <ClayMark name={cat.mark} size={136} className="fe-icon-mark" />
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

        {/* What actually happens on the table. The detail here is the point of
            the page: someone who does not know what they own needs to see that
            the sorting is methodical and that nothing gets lumped together. */}
        <section className="py-16 md:py-24" style={{ background: 'var(--color-surface-container-low)' }}>
          <div className="container mx-auto px-6 md:px-8 max-w-4xl">
            <div className="text-center mb-12">
              <span
                className="text-xs font-bold uppercase tracking-[0.4em]"
                style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}
              >
                {isEs ? 'En la Mesa' : 'On the Table'}
              </span>
              <h2
                className="text-3xl md:text-4xl font-bold mt-3 mb-4 tracking-tight"
                style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}
              >
                {isEs ? 'Cómo Clasifico Realmente Sus Piezas' : 'How I Actually Sort Through Your Pieces'}
              </h2>
              <p className="text-lg max-w-2xl mx-auto" style={{ color: 'var(--color-on-surface-variant)' }}>
                {isEs
                  ? 'Nada se junta en un solo montón. Esto es exactamente lo que hago, en orden, mientras usted observa.'
                  : 'Nothing gets lumped into one pile. This is exactly what I do, in order, while you watch.'}
              </p>
            </div>

            <ol className="space-y-5">
              {(isEs
                ? [
                    {
                      n: '01',
                      t: 'Primero: qué es metal precioso y qué no',
                      b: 'Antes que nada separo lo que realmente es oro o plata de lo que no lo es. Mucho de lo que llega es chapado, relleno de oro, bañado o simplemente bisutería — y eso está bien, es completamente normal. Uso imán, piedra de toque y prueba ácida para saberlo con certeza, y le digo qué es cada cosa sin rodeos.',
                    },
                    {
                      n: '02',
                      t: 'Después: por pureza, en subcategorías',
                      b: 'El oro se separa por quilataje, de menor a mayor: 9k (habitual en piezas británicas antiguas), 10k, 14k, 18k, 22k y más. La plata se separa en esterlina .925, europea 800 y 900, y plata de monedas. El platino y el paladio van a su propio grupo cuando aparecen. Cada grupo se pesa por separado, porque cada pureza vale distinto por gramo — juntarlos le restaría valor a las mejores piezas.',
                    },
                    {
                      n: '03',
                      t: 'Luego: pesar y calcular contra el spot en vivo',
                      b: 'Cada grupo va a una báscula calibrada delante de usted. Aplico el precio spot en vivo de ese día a la pureza de cada montón y le muestro la cuenta. Nada de números sacados del aire — usted ve el peso, la pureza y el cálculo.',
                    },
                    {
                      n: '04',
                      t: 'Y si no sabe qué conservar: pieza por pieza',
                      b: 'Muchas personas llegan sin saber qué quieren vender y qué quieren guardar. En ese caso valoro las piezas individualmente y le doy un número por cada una, para que pueda separar lo sentimental de lo que quiere convertir en efectivo. Puede quedarse con todo, vender una sola cosa, o vender el lote entero. La decisión es suya y no cambia nada de mi lado.',
                    },
                  ]
                : [
                    {
                      n: '01',
                      t: 'First: what is precious metal and what isn’t',
                      b: 'Before anything else I separate what is genuinely gold or silver from what isn’t. A lot of what comes in is plated, gold-filled, vermeil or simply costume — and that is completely normal, it happens with nearly every box. I use a magnet, a touchstone and acid testing to know for certain, and I tell you straight what each piece is.',
                    },
                    {
                      n: '02',
                      t: 'Then: by purity, into subcategories',
                      b: 'Gold gets separated by karat, lowest to highest: 9k (common in older British pieces), 10k, 14k, 18k, 22k and up. Silver splits into sterling .925, European 800 and 900, and coin silver. Platinum and palladium get their own group when they turn up. Each group is weighed on its own, because each purity is worth a different amount per gram — weighing them together would quietly cost you money on the better pieces.',
                    },
                    {
                      n: '03',
                      t: 'Next: weighed and calculated against live spot',
                      b: 'Every group goes on a calibrated scale in front of you. I apply that day’s live spot price to the purity of each pile and show you the arithmetic. No numbers pulled out of the air — you see the weight, the purity, and the math.',
                    },
                    {
                      n: '04',
                      t: 'And if you’re unsure what to keep: piece by piece',
                      b: 'Plenty of people arrive not knowing what they want to sell and what they want to hold on to. When that’s the case I price pieces individually and give you a number for each one, so you can separate what’s sentimental from what you’d rather turn into cash. Keep everything, sell one thing, or sell the lot — it’s your call and it changes nothing on my end.',
                    },
                  ]
              ).map((row) => (
                <li
                  key={row.n}
                  className="flex flex-col rounded-2xl px-6 py-7 shadow-[0_14px_38px_rgba(38,28,6,0.05)] md:flex-row md:px-8"
                  style={{ background: 'var(--color-surface-container-high)' }}
                >
                  <span
                    className="font-bold italic text-3xl md:mr-10 mb-3 md:mb-0 opacity-50 md:pt-1"
                    style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-primary)' }}
                  >
                    {row.n}
                  </span>
                  <div className="flex-1">
                    <h3
                      className="text-lg font-bold mb-2"
                      style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}
                    >
                      {row.t}
                    </h3>
                    <p className="leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>
                      {row.b}
                    </p>
                  </div>
                </li>
              ))}
            </ol>

            <p
              className="mt-10 text-center text-base leading-relaxed max-w-2xl mx-auto"
              style={{ color: 'var(--color-on-surface-variant)' }}
            >
              {isEs
                ? 'Al final sabrá exactamente qué tiene, aunque no venda absolutamente nada. Esa parte siempre es gratis.'
                : 'At the end of it you’ll know exactly what you have, even if you sell none of it. That part is always free.'}
            </p>
          </div>
        </section>

        {/* Trust pillars */}
        <section className="py-16 md:py-24" style={{ background: 'var(--color-surface-container-low)' }}>
          <div className="container mx-auto px-6 md:px-8 max-w-4xl">
            <div className="grid md:grid-cols-3 gap-6 text-center">
              {(isEs
                ? [
                    { mark: 'nocost' as ClayMarkName, title: 'Sin Costo, Sin Trampa', body: 'La evaluación es genuinamente gratuita y no tiene ninguna obligación de vender.' },
                    { mark: 'pricing' as ClayMarkName, title: 'Precios de Mercado en Vivo', body: 'El oro y la plata se valoran según los precios spot en tiempo real, mostrados abiertamente.' },
                    { mark: 'private' as ClayMarkName, title: 'Privado y Discreto', body: 'En el salón o en su casa. Sus artículos e información permanecen confidenciales.' },
                  ]
                : [
                    { mark: 'nocost' as ClayMarkName, title: 'No Cost, No Catch', body: 'The evaluation is genuinely free and carries zero obligation to sell.' },
                    { mark: 'pricing' as ClayMarkName, title: 'Live Market Pricing', body: 'Gold and silver are valued against real-time spot prices, shown openly.' },
                    { mark: 'private' as ClayMarkName, title: 'Private & Discreet', body: 'At the showroom or in your home. Your items and information stay confidential.' },
                  ]
              ).map((pillar) => (
                <div key={pillar.title} className="p-6">
                  {/* 72px, not the old 2.2rem/35px: the clay modelling and the
                      float are both invisible at icon size — see DECISIONS.
                      The drop-shadow is what makes the mark read as floating,
                      and it works here because this band is light. */}
                  <ClayMark name={pillar.mark} size={72} className="mb-3 block mx-auto" />
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
