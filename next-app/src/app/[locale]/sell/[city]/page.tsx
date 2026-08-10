import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { alternatesFor } from '@/lib/seo';
import { jsonLdHtml } from '@/lib/json-ld';
import { SERVICE_AREAS, getServiceArea } from '@/lib/service-areas';
import { routing } from '@/i18n/routing';
import SiteHeader from '@/components/layout/SiteHeader';
import SiteFooter from '@/components/layout/SiteFooter';
import ClayMark from '@/components/ClayMark';

interface Props {
  params: Promise<{ locale: string; city: string }>;
}

export function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    SERVICE_AREAS.map((area) => ({ locale, city: area.slug })),
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, city } = await params;
  const area = getServiceArea(city);
  if (!area) return {};
  const isEs = locale === 'es';
  const title = isEs
    ? `Vender Oro, Joyería y Plata en ${area.city}, FL`
    : `Sell Gold, Jewelry & Silver in ${area.city}, FL`;
  const description = isEs
    ? `Comprador de oro, joyería y plata esterlina que paga al mejor precio en ${area.city}, FL. Compramos joyería de patrimonio, oro, plata, diamantes, monedas y relojes. Evaluación gratuita — vamos a usted. Llame al (239) 404-8505.`
    : `Top-paying gold, jewelry & sterling silver buyer serving ${area.city}, FL. We buy estate jewelry, gold, silver, diamonds, coins & watches. Free appraisals — we come to you. Call (239) 404-8505.`;
  return {
    title,
    description,
    alternates: alternatesFor(`/sell/${area.slug}`, locale),
    openGraph: {
      type: 'website',
      url: `https://naplesestatejewelry.com${isEs ? '/es' : ''}/sell/${area.slug}`,
      title: `${title} | Naples Estate Jewelry`,
      description,
    },
  };
}

export default async function SellCityPage({ params }: Props) {
  const { locale, city } = await params;
  const area = getServiceArea(city);
  if (!area) notFound();

  const isEs = locale === 'es';
  const p = (path: string) => (isEs ? `/es${path}` : path);
  const evalHref = p('/free-evaluation');
  const contactHref = p('/contact');
  const intro = isEs ? area.introEs : area.introEn;
  const travel = isEs ? area.travelEs : area.travelEn;
  const canonicalUrl = `https://naplesestatejewelry.com${isEs ? '/es' : ''}/sell/${area.slug}`;

  // Each card's heading front-loads a high-intent "<thing> buyers in <city>"
  // phrase so the page can rank for every buy-side combination.
  const whatWeBuy = [
    {
      mark: 'goldbar',
      titleEn: `Sell Gold in ${area.city}`,
      titleEs: `Vender Oro en ${area.city}`,
      descEn: `Gold buyers in ${area.city} for 10k–24k jewelry, chains, class rings, dental gold, coins, and bullion — paid by live gold-spot weight, not a flat lowball.`,
      descEs: `Compradores de oro en ${area.city} para joyería de 10k–24k, cadenas, anillos, oro dental, monedas y lingotes — pagado por peso al precio spot en vivo, sin ofertas bajas.`,
    },
    {
      mark: 'chain',
      titleEn: `Sell Jewelry in ${area.city}`,
      titleEs: `Vender Joyería en ${area.city}`,
      descEn: `Estate and designer jewelry buyers in ${area.city} — Tiffany, Cartier, David Yurman, and unsigned heirloom pieces. We buy necklaces, bracelets, rings, and earrings.`,
      descEs: `Compradores de joyería de patrimonio y de diseñador en ${area.city} — Tiffany, Cartier, David Yurman y piezas heredadas. Compramos collares, pulseras, anillos y aretes.`,
    },
    {
      mark: 'flatware',
      titleEn: `Sell Sterling Silver in ${area.city}`,
      titleEs: `Vender Plata Esterlina en ${area.city}`,
      descEn: `Sterling silver buyers in ${area.city} for flatware, tea sets, trays, holloware, and .925 jewelry. Full estates and single pieces welcome.`,
      descEs: `Compradores de plata esterlina en ${area.city} para cubiertos, juegos de té, bandejas, holloware y joyería .925. Aceptamos patrimonios completos y piezas sueltas.`,
    },
    {
      mark: 'ring',
      titleEn: `Sell Diamonds in ${area.city}`,
      titleEs: `Vender Diamantes en ${area.city}`,
      descEn: `Diamond buyers in ${area.city} for loose stones and mounted diamonds — engagement rings, tennis bracelets, and studs, certified or not.`,
      descEs: `Compradores de diamantes en ${area.city} para piedras sueltas y montadas — anillos de compromiso, pulseras de tenis y aretes, con o sin certificado.`,
    },
    {
      mark: 'coins',
      titleEn: `Sell Coins & Bullion in ${area.city}`,
      titleEs: `Vender Monedas y Lingotes en ${area.city}`,
      descEn: `Coin and bullion buyers in ${area.city} — gold and silver Eagles, Krugerrands, Maple Leafs, sovereigns, junk silver, and bars of any mint.`,
      descEs: `Compradores de monedas y lingotes en ${area.city} — Eagles de oro y plata, Krugerrands, Maple Leafs, soberanos, plata de circulación y barras de cualquier casa de moneda.`,
    },
    {
      mark: 'watch',
      titleEn: `Sell Watches in ${area.city}`,
      titleEs: `Vender Relojes en ${area.city}`,
      descEn: `Luxury watch buyers in ${area.city} — Rolex, Omega, Cartier, and vintage timepieces, running or not, with or without box and papers.`,
      descEs: `Compradores de relojes de lujo en ${area.city} — Rolex, Omega, Cartier y relojes vintage, funcionen o no, con o sin caja y papeles.`,
    },
  ] as const;

  const steps = [
    {
      mark: 'phone',
      titleEn: 'Call or request an estimate',
      titleEs: 'Llame o solicite un estimado',
      descEn: `Call (239) 404-8505 or send a few photos. We give you a ballpark before we ever meet.`,
      descEs: `Llame al (239) 404-8505 o envíe algunas fotos. Le damos una idea del valor antes de reunirnos.`,
    },
    {
      mark: 'house',
      titleEn: 'We come to you',
      titleEs: 'Vamos a usted',
      descEn: `${travel} We test and weigh everything in front of you — no mailing off your valuables.`,
      descEs: `${travel} Probamos y pesamos todo frente a usted — sin enviar sus objetos de valor por correo.`,
    },
    {
      mark: 'cash',
      titleEn: 'Get paid on the spot',
      titleEs: 'Reciba su pago en el acto',
      descEn: `Accept our offer and get paid immediately. No pressure, no obligation if you decline.`,
      descEs: `Acepte nuestra oferta y reciba el pago de inmediato. Sin presión ni obligación si la rechaza.`,
    },
  ] as const;

  const faqs = [
    {
      qEn: `Where can I sell gold in ${area.city}?`,
      qEs: `¿Dónde puedo vender oro en ${area.city}?`,
      aEn: `Naples Estate Jewelry buys gold throughout ${area.city} by private appointment. We come to your home, test and weigh your gold in front of you, price it against the live gold-spot market, and pay you on the spot — typically more than a pawn shop or mail-in buyer.`,
      aEs: `Naples Estate Jewelry compra oro en todo ${area.city} con cita privada. Vamos a su casa, probamos y pesamos su oro frente a usted, lo valoramos según el mercado spot en vivo y le pagamos en el acto — normalmente más que una casa de empeño o un comprador por correo.`,
    },
    {
      qEn: `Who buys sterling silver near ${area.city}?`,
      qEs: `¿Quién compra plata esterlina cerca de ${area.city}?`,
      aEn: `We do. We buy sterling silver flatware, tea sets, trays, holloware, and .925 jewelry from sellers across ${area.city} and surrounding Southwest Florida — whole estates or a single piece.`,
      aEs: `Nosotros. Compramos cubiertos de plata esterlina, juegos de té, bandejas, holloware y joyería .925 de vendedores en ${area.city} y el suroeste de Florida — patrimonios completos o una sola pieza.`,
    },
    {
      qEn: `Do you buy estate jewelry, diamonds, and watches in ${area.city}?`,
      qEs: `¿Compran joyería de patrimonio, diamantes y relojes en ${area.city}?`,
      aEn: `Yes. Along with gold and silver, we buy estate and designer jewelry, loose and mounted diamonds, luxury watches, and coins throughout ${area.city}.`,
      aEs: `Sí. Además de oro y plata, compramos joyería de patrimonio y de diseñador, diamantes sueltos y montados, relojes de lujo y monedas en todo ${area.city}.`,
    },
    {
      qEn: `Do I have to come to you?`,
      qEs: `¿Tengo que ir a usted?`,
      aEn: `No. ${travel} Our service is mobile and appointment-only, so you never have to carry valuables into a store.`,
      aEs: `No. ${travel} Nuestro servicio es móvil y solo con cita, así que nunca tiene que llevar objetos de valor a una tienda.`,
    },
    {
      qEn: `How do I get paid?`,
      qEs: `¿Cómo recibo el pago?`,
      aEn: `Once you accept our offer, you are paid immediately — cash or another method you prefer. There is no obligation to sell if the number is not right for you.`,
      aEs: `Una vez que acepta nuestra oferta, recibe el pago de inmediato — en efectivo u otro método que prefiera. No hay obligación de vender si el número no le conviene.`,
    },
  ];

  const otherAreas = SERVICE_AREAS.filter((a) => a.slug !== area.slug);

  const localBusinessLd = {
    '@context': 'https://schema.org',
    '@type': 'JewelryStore',
    '@id': `${canonicalUrl}#business`,
    name: `Naples Estate Jewelry — ${area.city} Gold, Jewelry & Silver Buyer`,
    url: canonicalUrl,
    telephone: '+12394048505',
    email: 'info@naplesestatejewelry.com',
    image: 'https://naplesestatejewelry.com/assets/images/pages/trust.webp',
    logo: 'https://naplesestatejewelry.com/assets/images/branding/logo.webp',
    description: isEs ? area.introEs : area.introEn,
    priceRange: '$$',
    currenciesAccepted: 'USD',
    paymentAccepted: 'Cash, Check, Wire Transfer, PayPal',
    areaServed: [...new Set([area.city, ...area.nearby])].map((name) => ({ '@type': 'City', name: `${name}, FL` })),
    // naplesestatejewelry.com is now this site's own primary domain, so it no
    // longer belongs in sameAs (the legacy .co apex 301-redirects here).
    sameAs: ['https://naplesjewelrybuyers.com'],
  };

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: isEs ? 'Inicio' : 'Home', item: `https://naplesestatejewelry.com${isEs ? '/es' : ''}` },
      { '@type': 'ListItem', position: 2, name: isEs ? 'Vender' : 'Sell', item: `https://naplesestatejewelry.com${isEs ? '/es' : ''}/sell` },
      { '@type': 'ListItem', position: 3, name: area.city, item: canonicalUrl },
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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(localBusinessLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(breadcrumbLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(faqLd) }} />
      <SiteHeader />
      <main className="site-header-offset">

        {/* Hero */}
        <section className="relative flex min-h-[520px] items-center overflow-hidden bg-[#1a1c1c]">
          <div className="ultrawide-page relative z-10 mx-auto w-full max-w-[1440px] px-4 md:px-8">
            <div className="max-w-3xl">
              <span className="mb-4 block text-xs font-bold uppercase tracking-[0.2em] text-[#e9c349]" style={{ fontFamily: 'var(--font-label)' }}>
                {isEs ? `Comprador en ${area.city}, ${area.region}` : `${area.city}, ${area.region} Buyer`}
              </span>
              <h1 className="mb-6 text-4xl font-bold leading-tight text-white md:text-5xl" style={{ fontFamily: 'var(--font-headline)' }}>
                {isEs
                  ? `Venda Oro, Joyería y Plata Esterlina en ${area.city}, FL`
                  : `Sell Gold, Jewelry & Sterling Silver in ${area.city}, FL`}
              </h1>
              <p className="mb-8 max-w-xl text-lg leading-relaxed text-[#d7d0c3]">
                {isEs
                  ? `El comprador de confianza y al mejor precio de ${area.city} para oro, joyería de patrimonio, plata, diamantes, monedas y relojes. Vamos a usted.`
                  : `${area.city}'s trusted, top-paying buyer for gold, estate jewelry, silver, diamonds, coins, and watches. We come to you.`}
              </p>
              <div className="flex flex-wrap gap-4">
                <Link href={evalHref} className="gold-button">
                  {isEs ? 'EVALUACIÓN GRATIS' : 'GET A FREE ESTIMATE'}
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

        {/* Local intro */}
        <section className="border-y border-[#d0c5af] bg-[#f3f3f3] py-14">
          <div className="mx-auto max-w-3xl px-4 text-center md:px-8">
            <h2 className="mb-4 text-2xl font-bold text-[#1a1c1c] md:text-3xl" style={{ fontFamily: 'var(--font-headline)' }}>
              {isEs ? `Su comprador local en ${area.city}` : `Your local buyer in ${area.city}`}
            </h2>
            <p className="text-base leading-relaxed text-[#4d4635]">{intro}</p>
            <p className="mt-4 text-sm font-semibold uppercase tracking-wide text-[#735c00]" style={{ fontFamily: 'var(--font-label)' }}>
              {isEs ? 'Áreas que servimos: ' : 'Areas we serve: '}
              {area.nearby.join(' · ')}
            </p>
          </div>
        </section>

        {/* What we buy */}
        <section className="ultrawide-page mx-auto max-w-[1440px] px-4 py-20 md:px-8">
          <div className="mb-12 max-w-2xl">
            <h2 className="mb-4 text-3xl font-bold text-[#1a1c1c] md:text-4xl" style={{ fontFamily: 'var(--font-headline)' }}>
              {isEs ? `Qué Compramos en ${area.city}` : `What We Buy in ${area.city}`}
            </h2>
            <p className="text-sm leading-relaxed text-[#4d4635]">
              {isEs
                ? `Pagamos al mejor precio por metales preciosos y piezas finas en cualquier condición — desde una sola cadena hasta un patrimonio completo.`
                : `We pay top dollar for precious metals and fine pieces in any condition — from a single chain to a complete estate.`}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {whatWeBuy.map((item) => (
              <div key={item.mark} className="rounded-2xl border border-[#d0c5af] bg-white p-7 shadow-[0_14px_38px_rgba(38,28,6,0.05)] transition-all hover:-translate-y-0.5 hover:shadow-xl">
                <ClayMark name={item.mark} size={88} className="mb-4 block" />
                <h3 className="mb-2 text-lg font-bold text-[#1a1c1c]" style={{ fontFamily: 'var(--font-headline)' }}>
                  {isEs ? item.titleEs : item.titleEn}
                </h3>
                <p className="text-sm leading-relaxed text-[#4d4635]">{isEs ? item.descEs : item.descEn}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="bg-[#f3f3f3] py-20">
          <div className="ultrawide-page mx-auto max-w-[1440px] px-4 md:px-8">
            <h2 className="mb-12 text-center text-3xl font-bold text-[#1a1c1c] md:text-4xl" style={{ fontFamily: 'var(--font-headline)' }}>
              {isEs ? 'Cómo Funciona' : 'How Selling to Us Works'}
            </h2>
            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              {steps.map((step, i) => (
                <div key={step.mark} className="text-center">
                  {/* The gold disc behind this went with the icon: a gold clay
                      mark on a #d4af37 circle is gold on gold, and the mark's
                      own float shadow does the lifting the disc used to. */}
                  <ClayMark name={step.mark} size={88} className="mx-auto mb-5 block" />
                  <p className="mb-1 text-xs font-bold uppercase tracking-[0.2em] text-[#735c00]" style={{ fontFamily: 'var(--font-label)' }}>
                    {isEs ? `Paso ${i + 1}` : `Step ${i + 1}`}
                  </p>
                  <h3 className="mb-2 text-lg font-bold text-[#1a1c1c]" style={{ fontFamily: 'var(--font-headline)' }}>
                    {isEs ? step.titleEs : step.titleEn}
                  </h3>
                  <p className="mx-auto max-w-xs text-sm leading-relaxed text-[#4d4635]">{isEs ? step.descEs : step.descEn}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="mx-auto max-w-3xl px-4 py-20 md:px-8">
          <h2 className="mb-10 text-center text-3xl font-bold text-[#1a1c1c] md:text-4xl" style={{ fontFamily: 'var(--font-headline)' }}>
            {isEs ? `Preguntas Frecuentes — ${area.city}` : `${area.city} Selling FAQ`}
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
        </section>

        {/* Other areas */}
        <section className="border-t border-[#d0c5af] bg-[#f3f3f3] py-16">
          <div className="ultrawide-page mx-auto max-w-[1440px] px-4 md:px-8">
            <h2 className="mb-6 text-center text-2xl font-bold text-[#1a1c1c] md:text-3xl" style={{ fontFamily: 'var(--font-headline)' }}>
              {isEs ? 'Otras Áreas que Servimos' : 'Other Areas We Serve'}
            </h2>
            <div className="flex flex-wrap justify-center gap-3">
              {otherAreas.map((a) => (
                <Link
                  key={a.slug}
                  href={p(`/sell/${a.slug}`)}
                  className="rounded-full border border-[#d0c5af] bg-white px-5 py-2 text-sm font-semibold text-[#735c00] transition-colors hover:bg-[#735c00] hover:text-white"
                  style={{ fontFamily: 'var(--font-label)' }}
                >
                  {isEs ? `Vender en ${a.city}` : `Sell in ${a.city}`}
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="bg-[#2f3131] py-24 text-center">
          <div className="mx-auto max-w-2xl px-4">
            {/* onDark: this band is #2f3131, where a black float shadow is
                invisible and only costs paint work. */}
            <ClayMark name="shield" size={96} onDark className="mx-auto mb-6 block" />
            <h2 className="mb-6 text-3xl font-bold text-white md:text-4xl" style={{ fontFamily: 'var(--font-headline)' }}>
              {isEs ? `¿Listo para vender en ${area.city}?` : `Ready to sell in ${area.city}?`}
            </h2>
            <p className="mx-auto mb-10 max-w-lg text-base leading-relaxed text-[#d7d0c3]">
              {isEs
                ? 'Evaluación gratuita, privada y sin obligación. Números honestos y pago inmediato.'
                : 'Free, private, no-obligation evaluation. Honest numbers and immediate payment.'}
            </p>
            <div className="flex flex-col justify-center gap-6 md:flex-row">
              <Link href={evalHref} className="gold-button">
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
            <p className="mt-8 text-sm text-[#a9a9a5]">
              <Link href={contactHref} className="underline underline-offset-2 hover:text-white">
                {isEs ? 'O envíenos un mensaje' : 'Or send us a message'}
              </Link>
            </p>
          </div>
        </section>

      </main>
      <SiteFooter locale={locale} />
    </>
  );
}
