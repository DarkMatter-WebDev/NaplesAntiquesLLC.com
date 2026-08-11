import type { Metadata } from 'next';
import { alternatesFor } from '@/lib/seo';
import Image from 'next/image';
import Link from 'next/link';
import SiteHeader from '@/components/layout/SiteHeader';
import SiteFooter from '@/components/layout/SiteFooter';
import { CardGrid, PageContainer, Section } from '@/components/layout/ResponsiveLayout';
import HomeHeroStack from '@/components/home/HomeHeroStack';
import HomeBootSplash from '@/components/home/HomeBootSplash';
import ClayMark from '@/components/ClayMark';
import TestimonialsSection from '@/components/home/TestimonialsSection';
import { getHomeCarouselPayload } from '@/lib/home-carousel-server';
import type { CarouselItem } from '../../../../carousel/lib/carouselData';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const isEs = locale === 'es';
  return {
    title: {
      absolute: isEs
        ? 'Compramos Oro, Joyería y Plata Esterlina en Naples, FL | Naples Estate Jewelry'
        : 'Sell Gold, Jewelry & Sterling Silver in Naples, FL | Naples Estate Jewelry',
    },
    description: isEs
      ? 'Compramos oro, joyería de patrimonio, plata esterlina, diamantes, monedas y relojes en Naples y el suroeste de Florida. Evaluaciones gratuitas — vamos a usted. Llame al (239) 404-8505.'
      : 'We buy gold, estate jewelry, sterling silver, diamonds, coins, and watches in Naples and across Southwest Florida. Top-dollar payouts, free appraisals, we come to you. Call (239) 404-8505.',
    alternates: alternatesFor('/', locale),
  };
}

interface Props {
  params: Promise<{ locale: string }>;
}

const HOME_CAROUSEL_FALLBACK: CarouselItem[] = [
  { id: 'h1', imageUrl: '/assets/images/shop/shop-14k-curb-link-bracelet-01.webp',        name: 'Estate bracelet',       priceLabel: null, href: '/shop', status: 'available', bgColor: null },
  { id: 'h2', imageUrl: '/assets/images/shop/shop-14k-byzantine-link-chain-01.webp',       name: 'Byzantine chain',       priceLabel: null, href: '/shop', status: 'available', bgColor: null },
  { id: 'h3', imageUrl: '/assets/images/shop/shop-10k-cuban-chain-01.webp',                name: 'Cuban chain',           priceLabel: null, href: '/shop', status: 'available', bgColor: null },
  { id: 'h4', imageUrl: '/assets/images/shop/shop-10k-hollow-cuban-chain-necklace-01.webp', name: 'Hollow Cuban necklace', priceLabel: null, href: '/shop', status: 'available', bgColor: null },
  { id: 'h5', imageUrl: '/assets/images/shop/shop-10k-monaco-edge-cuban-chain-01.webp',    name: 'Monaco Cuban chain',    priceLabel: null, href: '/shop', status: 'available', bgColor: null },
  { id: 'h6', imageUrl: '/assets/images/shop/shop-14k-curb-link-bracelet-01.webp',         name: 'Gold bracelet',         priceLabel: null, href: '/shop', status: 'available', bgColor: null },
];

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  const isEs = locale === 'es';
  const storeHref = isEs ? '/es/shop' : '/shop';
  const evalHref = isEs ? '/es/free-evaluation' : '/free-evaluation';
  const contactHref = isEs ? '/es/contact' : '/contact';

  const carousel = await getHomeCarouselPayload(HOME_CAROUSEL_FALLBACK);

  return (
    <>
      <HomeBootSplash />
      <SiteHeader />

      <main className="site-header-offset flex flex-col">

        {/* Hero — scroll-pinned parallax stack: three slideshows hand over in
            sequence, each with its own admin-curated lineup (falling back to
            the first), then the frame breaks free.

            The announcement bar is passed IN as the hero's banner rather than
            sitting above it in page flow (owner, 2026-08-11: it should not
            scroll away until the hero text does). Inside the pinned frame it
            unpins on exactly the same frame as the overlay text, with no second
            release point to keep in sync. It is still deliberately NOT part of
            the fixed header, which is sized by --site-header-height and consumed
            by every page offset and sticky top. */}
        <HomeHeroStack
          locale={locale}
          initialItems={carousel.items}
          initialAltItems={carousel.altItems}
          initialThirdItems={carousel.thirdItems}
          initialSettings={carousel.settings}
          banner={
            <Link
              data-customer-reveal-skip
              className="home-announcement"
              href={`${isEs ? '/es' : ''}/free-evaluation`}
              // The visible text is three separated fragments, which reads as
              // stop-start to a screen reader; this gives it one clean sentence.
              aria-label={isEs
                ? 'Evaluaciones gratuitas, solo este mes. Solicite la suya.'
                : 'Free evaluations, this month only. Request yours.'}
              style={{ background: '#1a1c1c' }}
            >
              {(isEs
                ? ['Evaluaciones gratuitas', 'Solo este mes']
                : ['Free evaluations', 'This month only']
              ).map((item, index) => (
                <span
                  key={item}
                  // Both items show at EVERY width. The old strip hid its third
                  // item below 780px because three service claims could not fit;
                  // this promo is two fragments and comfortably shorter than what
                  // already fitted, so nothing needs hiding. Re-check at 320px in
                  // BOTH locales if the copy changes — Spanish is the long one.
                  className="home-announcement-item"
                  style={{ color: '#e9c349', fontFamily: 'var(--font-label)' }}
                >
                  {index > 0 && <span aria-hidden="true" className="home-announcement-separator">·</span>}
                  {item}
                </span>
              ))}
              {/* Outside the mapped list on purpose: the third item is hidden
                  below 780px, so an arrow tacked onto it would take the only
                  "this is tappable" cue away from phones — where the bar is
                  most likely to be tapped. */}
              <span aria-hidden="true" className="home-announcement-arrow">→</span>
            </Link>
          }
        />

        {/* Services strip */}
        <Section
          className="border-t"
          style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-low)' }}
        >
          <PageContainer max="content">
          <CardGrid className="md:grid-cols-3">
            {[
              {
                title: isEs ? 'Compramos Oro' : 'We Buy Gold',
                body: isEs
                  ? 'Evaluaciones gratuitas en el acto para todas las piezas de oro.'
                  : 'Free appraisals on all gold jewelry, coins, and bullion — we come to you.',
                href: evalHref,
                cta: isEs ? 'Evaluación gratuita →' : 'Free evaluation →',
              },
              {
                title: isEs ? 'Vendemos Joyas' : 'We Sell Jewelry',
                body: isEs
                  ? 'Cadenas, pulseras, anillos y piezas de diseñador con precios transparentes.'
                  : 'Chains, bracelets, rings, and designer pieces priced at live gold rates.',
                href: storeHref,
                cta: isEs ? 'Ver tienda →' : 'Browse shop →',
              },
              {
                title: isEs ? 'Contacto Directo' : 'Direct Contact',
                body: isEs
                  ? 'Hable con nosotros directamente — sin intermediarios.'
                  : 'Talk directly to us — no middlemen, no automated runaround.',
                href: contactHref,
                cta: isEs ? 'Contáctenos →' : 'Contact us →',
              },
            ].map((item, index) => (
              <div
                key={item.title}
                className="group flex flex-col gap-3 border-b pb-6 md:border-b-0 md:border-l md:pb-0 md:pl-7"
                style={{ borderColor: 'rgba(115, 92, 0, 0.16)' }}
              >
                <div className="transition duration-300 group-hover:-translate-y-0.5">
                  <ClayMark name={index === 0 ? 'goldbar' : index === 1 ? 'ring' : 'phone'} size={88} />
                </div>
                {/* h2, not h3: these three cards are top-level page sections
                    with no parent h2 above them, so h3 skipped a level and left
                    the outline implying a section that does not exist. Size is
                    carried by text-xl, so the change is semantic only. */}
                <h2
                  className="text-xl font-bold leading-tight"
                  style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}
                >
                  {item.title}
                </h2>
                <p className="text-sm leading-relaxed flex-1" style={{ color: 'var(--color-on-surface-variant)' }}>
                  {item.body}
                </p>
                <Link
                  href={item.href}
                  className="hover-underline-grow w-fit text-xs font-bold uppercase tracking-[0.16em]"
                  style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}
                >
                  {item.cta}
                </Link>
              </div>
            ))}
          </CardGrid>
          </PageContainer>
        </Section>

        {/* Meet the owner — the founder story block (2026-08-04, from the
            mels-treasures.com review). Facts only: 15+ years, Naples-born,
            mobile appointment model. */}
        <Section className="border-t" style={{ borderColor: 'var(--color-outline-variant)' }}>
          <PageContainer max="content">
            <div className="grid items-center gap-10 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
              <div className="relative mx-auto aspect-[4/5] w-full max-w-sm overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--color-outline-variant)' }}>
                <Image
                  src="/assets/images/pages/chris.webp"
                  alt={isEs ? 'Chris, propietario de Naples Estate Jewelry' : 'Chris, owner of Naples Estate Jewelry'}
                  fill
                  sizes="(max-width: 768px) 90vw, 40vw"
                  className="object-cover"
                />
              </div>
              <div>
                <p
                  className="text-[0.65rem] font-bold uppercase tracking-[0.35em] mb-3"
                  style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}
                >
                  {isEs ? 'Conozca al Propietario' : 'Meet the Owner'}
                </p>
                <h2
                  className="responsive-title-lg font-bold mb-5 tracking-tight"
                  style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}
                >
                  Chris
                </h2>
                <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--color-on-surface-variant)' }}>
                  {isEs
                    ? 'Nacido y criado en Naples, Chris lleva más de 15 años comprando y vendiendo joyería fina de patrimonio en el suroeste de Florida. Sin vitrina y sin intermediarios: cada evaluación es una cita privada, en su casa o en un lugar que le convenga, y cada pieza de la tienda fue seleccionada y verificada personalmente.'
                    : 'Born and raised in Naples, Chris has spent 15+ years buying and selling fine estate jewelry across Southwest Florida. No storefront, no middlemen — every appraisal is a private appointment at your home or a place convenient to you, and every piece in the shop was personally selected and verified.'}
                </p>
                <p className="text-sm leading-relaxed mb-6" style={{ color: 'var(--color-on-surface-variant)' }}>
                  {isEs
                    ? 'Ya sea que venda el patrimonio de una familia o busque una cadena de oro macizo a precio justo, trata directamente con la persona que responde el teléfono.'
                    : "Whether you're selling a family estate or hunting for a solid-gold chain at an honest price, you deal directly with the person who answers the phone."}
                </p>
                <div className="flex flex-wrap gap-4">
                  <Link
                    href={isEs ? '/es/about' : '/about'}
                    className="hover-underline-grow text-xs font-bold uppercase tracking-[0.16em]"
                    style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}
                  >
                    {isEs ? 'Conozca más →' : 'Learn more →'}
                  </Link>
                  <a
                    href="tel:2394048505"
                    className="hover-underline-grow text-xs font-bold uppercase tracking-[0.16em]"
                    style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}
                  >
                    {isEs ? 'Llame o envíe un mensaje →' : 'Call or text Chris →'}
                  </a>
                </div>
              </div>
            </div>
          </PageContainer>
        </Section>

        {/* Why buy estate gold — education block */}
        <Section
          className="border-t text-center"
          style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-low)' }}
        >
          <PageContainer max="narrow">
            <p
              className="text-[0.65rem] font-bold uppercase tracking-[0.35em] mb-3"
              style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}
            >
              {isEs ? '¿Por Qué Patrimonio?' : 'Why Estate?'}
            </p>
            <h2
              className="responsive-title-lg font-bold mb-6 tracking-tight"
              style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}
            >
              {isEs ? '¿Por Qué Comprar Oro de Patrimonio?' : 'Why Buy Estate Gold?'}
            </h2>
            <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--color-on-surface-variant)' }}>
              {isEs
                ? 'El oro antiguo tiene algo especial: décadas de uso crean una calidez y un carácter que no se pueden fabricar. Cada pieza de nuestra tienda es única — rescatada de la fundición, verificada a mano y con una historia propia.'
                : "There's something special about old gold: decades of wear create a warmth and character that simply can't be manufactured. Every piece in our shop is one of a kind — rescued from the melting pot, verified by hand, and carrying a story of its own."}
            </p>
            <p className="text-sm leading-relaxed mb-8" style={{ color: 'var(--color-on-surface-variant)' }}>
              {isEs
                ? 'Y como nuestros precios están ligados al mercado spot en vivo, paga un precio transparente cercano al valor del metal — no un margen de boutique.'
                : "And because our prices are linked to the live spot market, you pay a transparent price close to the metal's value — not a boutique markup."}
            </p>
            <Link
              href={storeHref}
              className="hover-underline-grow text-xs font-bold uppercase tracking-[0.16em]"
              style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}
            >
              {isEs ? 'Ver la colección →' : 'Browse the collection →'}
            </Link>
          </PageContainer>
        </Section>

        {/* Top FAQs — native details accordions; every answer restates live
            policy only, and the full list lives at /faq */}
        <Section className="border-t" style={{ borderColor: 'var(--color-outline-variant)' }}>
          <PageContainer max="narrow">
            <p
              className="text-center text-[0.65rem] font-bold uppercase tracking-[0.35em] mb-3"
              style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}
            >
              {isEs ? 'Preguntas Frecuentes' : 'Frequently Asked'}
            </p>
            <h2
              className="text-center responsive-title-lg font-bold mb-10 tracking-tight"
              style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}
            >
              {isEs ? 'Antes de Comprar o Vender' : 'Before You Buy or Sell'}
            </h2>
            <div className="flex flex-col">
              {(isEs
                ? [
                    { q: '¿Compran joyería además de venderla?', a: 'Sí — comprar es la mitad del negocio. Evaluaciones gratuitas y privadas para oro, plata, diamantes, relojes y patrimonios completos; vamos a usted en todo el suroeste de Florida.' },
                    { q: '¿Cómo funciona el envío?', a: 'Cada pedido enviado viaja totalmente asegurado con confirmación de firma, y los pedidos de $5,000+ se envían por USPS Registered Mail. Las tarifas según el valor se muestran al pagar.' },
                    { q: '¿Puedo ver una pieza en persona?', a: 'Por supuesto. La recogida local con cita es gratuita en el área de Naples — elija Recogida local al pagar o llame para coordinar.' },
                    { q: '¿Cómo fijan sus precios?', a: 'La mayoría de las piezas se calculan directamente contra el mercado de metales en vivo, con el valor de rescate junto al precio; algunas tienen un precio fijo. En ambos casos, lo que ve es transparente — no un margen arbitrario.' },
                  ]
                : [
                    { q: 'Do you buy jewelry as well as sell it?', a: 'Yes — buying is half the business. Free, private appraisals for gold, silver, diamonds, watches, and full estates; we come to you across Southwest Florida.' },
                    { q: 'How does shipping work?', a: 'Every shipped order travels fully insured with signature confirmation, and orders of $5,000+ ship USPS Registered Mail. Value-based rates are shown at checkout.' },
                    { q: 'Can I see a piece in person?', a: 'Absolutely. Local pickup by appointment is free in the Naples area — choose Local Pickup at checkout, or call to arrange a viewing.' },
                    { q: 'How are your prices set?', a: 'Most pieces are priced directly against the live metals market, with the scrap value shown right beside the price; some carry a set price instead. Either way, what you see is transparent — not an arbitrary markup.' },
                  ]
              ).map((faq) => (
                <details key={faq.q} className="home-faq-accordion">
                  <summary>
                    <span className="text-sm font-bold" style={{ color: 'var(--color-on-surface)', fontFamily: 'var(--font-headline)' }}>
                      {faq.q}
                    </span>
                    <span aria-hidden="true" className="home-faq-chevron" style={{ color: 'var(--color-primary)' }}>▾</span>
                  </summary>
                  <p className="pb-4 pr-6 text-sm leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>
                    {faq.a}
                  </p>
                </details>
              ))}
            </div>
            <p className="mt-8 text-center">
              <Link
                href={isEs ? '/es/faq' : '/faq'}
                className="hover-underline-grow text-xs font-bold uppercase tracking-[0.16em]"
                style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}
              >
                {isEs ? 'Ver todas las preguntas →' : 'View all FAQs →'}
              </Link>
            </p>
          </PageContainer>
          <style>{`
            .home-faq-accordion {
              border-bottom: 1px solid var(--color-outline-variant);
            }
            .home-faq-accordion:first-of-type {
              border-top: 1px solid var(--color-outline-variant);
            }
            .home-faq-accordion > summary {
              display: flex;
              align-items: center;
              justify-content: space-between;
              gap: 1rem;
              padding: 1rem 0.15rem;
              cursor: pointer;
              list-style: none;
            }
            .home-faq-accordion > summary::-webkit-details-marker {
              display: none;
            }
            .home-faq-chevron {
              flex-shrink: 0;
              transition: transform 200ms ease;
            }
            .home-faq-accordion[open] .home-faq-chevron {
              transform: rotate(180deg);
            }
            @media (prefers-reduced-motion: reduce) {
              .home-faq-chevron {
                transition: none;
              }
            }
          `}</style>
        </Section>

        {/* Testimonials — real Google reviews (verbatim), shared with product
            pages via src/lib/testimonials.ts */}
        <TestimonialsSection locale={locale} />

        {/* CTA */}
        <Section
          className="text-center border-t"
          style={{ borderColor: 'var(--color-outline-variant)' }}
        >
          <PageContainer max="narrow">
          <p
            className="text-[0.65rem] font-bold uppercase tracking-[0.35em] mb-4"
            style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}
          >
            {isEs ? 'Llámenos Hoy' : 'Call Us Today'}
          </p>
          <a
            href="tel:2394048505"
            className="responsive-title-lg font-bold transition-opacity hover:opacity-70"
            style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}
          >
            (239) 404-8505
          </a>
          <p className="mt-4 text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
            {isEs ? 'Naples, Florida · Lunes–Sábado · Con cita' : 'Naples, Florida · Mon–Sat · By appointment'}
          </p>
          </PageContainer>
        </Section>

      </main>
      <SiteFooter locale={locale} />
    </>
  );
}
