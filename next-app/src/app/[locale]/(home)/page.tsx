import type { Metadata } from 'next';
import Link from 'next/link';
import SiteHeader from '@/components/layout/SiteHeader';
import SiteFooter from '@/components/layout/SiteFooter';
import { CardGrid, PageContainer, Section } from '@/components/layout/ResponsiveLayout';
import HomeHero from '@/components/home/HomeHero';
import ServiceIconCanvas from '@/components/home/ServiceIconCanvas';
import type { CarouselItem } from '../../../../carousel/lib/carouselData';

export const metadata: Metadata = {
  title: 'Naples Estate Jewelry — Fine Gold & Estate Pieces',
};

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
                  : 'Free walk-in appraisals on all gold jewelry, coins, and bullion.',
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
                  className="w-fit text-xs font-bold uppercase tracking-[0.16em] transition-colors hover:underline"
                  style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}
                >
                  {item.cta}
                </Link>
              </div>
            ))}
          </CardGrid>
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
            {isEs ? 'Naples, Florida · Lunes–Sábado' : 'Naples, Florida · Mon–Sat'}
          </p>
          </PageContainer>
        </Section>

      </main>
      <SiteFooter locale={locale} />
    </>
  );
}
