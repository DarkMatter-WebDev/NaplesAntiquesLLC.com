import type { Metadata } from 'next';
import { alternatesFor } from '@/lib/seo';
import Link from 'next/link';
import SiteHeader from '@/components/layout/SiteHeader';
import SiteFooter from '@/components/layout/SiteFooter';
import { CardGrid, PageContainer, Section } from '@/components/layout/ResponsiveLayout';
import HomeHero from '@/components/home/HomeHero';
import HomeBootSplash from '@/components/home/HomeBootSplash';
import ServiceIconCanvas from '@/components/home/ServiceIconCanvas';
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

  const fallbackItems = HOME_CAROUSEL_FALLBACK.map((item) => ({
    ...item,
    href: item.href ? `${isEs ? '/es' : ''}${item.href}` : null,
  }));

  return (
    <>
      <HomeBootSplash />
      <SiteHeader />

      <main className="flex flex-col pt-16">

        {/* Hero — 3D carousel as full-bleed background, color-fading per photo */}
        <HomeHero locale={locale} fallbackItems={fallbackItems} />

        {/* Services strip */}
        <Section
          className="border-t"
          style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-low)' }}
        >
          <PageContainer max="content">
          <CardGrid className="md:grid-cols-3">
            {[
              {
                icon: '💛',
                title: isEs ? 'Compramos Oro' : 'We Buy Gold',
                body: isEs
                  ? 'Evaluaciones gratuitas en el acto para todas las piezas de oro.'
                  : 'Free appraisals on all gold jewelry, coins, and bullion — we come to you.',
                href: evalHref,
                cta: isEs ? 'Evaluación gratuita →' : 'Free evaluation →',
              },
              {
                icon: '🏆',
                title: isEs ? 'Vendemos Joyas' : 'We Sell Jewelry',
                body: isEs
                  ? 'Cadenas, pulseras, anillos y piezas de diseñador con precios transparentes.'
                  : 'Chains, bracelets, rings, and designer pieces priced at live gold rates.',
                href: storeHref,
                cta: isEs ? 'Ver tienda →' : 'Browse shop →',
              },
              {
                icon: '📞',
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
                  <ServiceIconCanvas kind={index === 0 ? 'gold' : index === 1 ? 'jewelry' : 'contact'} />
                </div>
                <h3
                  className="text-xl font-bold leading-tight"
                  style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}
                >
                  {item.title}
                </h3>
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

        {/* Testimonials — real Google reviews (verbatim). */}
        <Section className="border-t" style={{ borderColor: 'var(--color-outline-variant)' }}>
          <PageContainer>
            <p
              className="text-center text-[0.65rem] font-bold uppercase tracking-[0.35em] mb-3"
              style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}
            >
              {isEs ? 'Lo Que Dicen Los Clientes' : 'What Clients Say'}
            </p>
            <h2
              className="text-center responsive-title-lg font-bold mb-10 tracking-tight"
              style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}
            >
              {isEs ? 'De Confianza en el Suroeste de Florida' : 'Trusted Across Southwest Florida'}
            </h2>
            <CardGrid className="md:grid-cols-3">
              {(isEs
                ? [
                    { quote: '¡Chris es increíble! Trabajé con él vendiendo algunos artículos. Obtuve un precio justo y preciso, y tuvo una excelente comunicación, además de ser rápido y flexible para reunirse. ¡Muy recomendable y volveré a venderle!', name: 'Nolan Olivier', meta: 'Reseña de Google' },
                    { quote: 'Chris es el mejor, ¡siempre es muy profesional al tratar con él!', name: 'Onur', meta: 'Guía Local de Google' },
                    { quote: 'Trabajar con esta empresa fue una experiencia excelente. Me ofrecieron un precio significativamente mejor por mi joyería de oro en comparación con otros lugares donde la había tasado. Chris fue increíblemente servicial y se tomó el tiempo de explicarme todo en detalle, lo que me hizo sentir cómoda y segura durante todo el proceso. Nunca me sentí presionada, y realmente aprecié el cuidado y la atención que brindó. Recomiendo mucho esta empresa y sin duda volveré en el futuro. ¡Gracias!', name: 'Yisel Perez', meta: 'Reseña de Google' },
                  ]
                : [
                    { quote: 'Chris is amazing! Worked with him selling some items. Got a fair and accurate price, and he had great communication while being fast and flexible to meet! Highly recommend and will be selling to him again.', name: 'Nolan Olivier', meta: 'Google review' },
                    { quote: 'Chris is the best, he is always so professional when dealing with him!', name: 'Onur', meta: 'Google Local Guide' },
                    { quote: 'Working with this company was an excellent experience. They offered me a significantly better price for my gold jewelry compared to other places where I had it appraised. Chris was incredibly helpful and took the time to explain everything in detail, which made me feel comfortable and confident throughout the process. I never felt rushed, and I truly appreciated the care and attention he provided. I highly recommend this company and will definitely be returning in the future. Thank you!', name: 'Yisel Perez', meta: 'Google review' },
                  ]
              ).map((r) => (
                <figure
                  key={r.name}
                  className="flex flex-col gap-4 rounded-2xl border bg-white p-6"
                  style={{ borderColor: 'var(--color-outline-variant)' }}
                >
                  <div aria-hidden="true" style={{ color: '#e9c349', letterSpacing: '0.15em' }}>
                    ★★★★★
                  </div>
                  <blockquote className="text-sm leading-relaxed" style={{ color: 'var(--color-on-surface)' }}>
                    &ldquo;{r.quote}&rdquo;
                  </blockquote>
                  <figcaption className="mt-auto pt-2 text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                    <strong style={{ color: 'var(--color-on-surface)' }}>{r.name}</strong> · {r.meta}
                  </figcaption>
                </figure>
              ))}
            </CardGrid>
            <p className="text-center mt-8 text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
              {isEs ? 'Reseñas de clientes en Google.' : 'Client reviews on Google.'}
            </p>
          </PageContainer>
        </Section>

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
