import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import SiteHeader from '@/components/layout/SiteHeader';
import SiteFooter from '@/components/layout/SiteFooter';
import HomeSubscriberForm from '@/components/home/HomeSubscriberForm';

export const metadata: Metadata = {
  title: 'Naples Estate Jewelry — Fine Gold & Estate Pieces',
};

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  const isEs = locale === 'es';
  const shopHref = isEs ? '/es/shop' : '/shop';
  const evalHref = isEs ? '/es/free-evaluation' : '/free-evaluation';
  const contactHref = isEs ? '/es/contact' : '/contact';

  return (
    <>
      <SiteHeader />

      <main className="flex flex-col">

        {/* Hero */}
        <section className="relative min-h-[820px] sm:min-h-[760px] md:min-h-screen flex items-start overflow-hidden pt-28 md:pt-32 xl:pt-36 pb-16 bg-[#101111]">

          {/* Background: video + fallback image + overlays */}
          <div className="absolute inset-x-0 overflow-hidden" style={{ top: '-7%', height: '114%', zIndex: 0 }} aria-hidden="true">
            {/* Fallback image — shown when video is unavailable or reduced-motion */}
            <Image
              src="/assets/images/pages/homepage-hero-bangles.webp"
              alt=""
              fill
              className="hero-pan hero-fallback object-cover object-center"
              style={{ opacity: 0, zIndex: 0 }}
              priority
            />
            {/* Video */}
            <video
              className="hero-video absolute inset-0 w-full h-full object-cover object-center"
              style={{ zIndex: 1 }}
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
            >
              <source src="/assets/video/homepage-hero.mp4" type="video/mp4" />
            </video>
            {/* Dark gradient overlay */}
            <div
              className="absolute inset-0"
              style={{
                zIndex: 2,
                background:
                  'radial-gradient(circle at 19% 22%, rgba(26,28,28,0.74) 0%, rgba(26,28,28,0.5) 32%, rgba(26,28,28,0.14) 60%, rgba(26,28,28,0.36) 100%),' +
                  'linear-gradient(90deg, rgba(26,28,28,0.78) 0%, rgba(26,28,28,0.42) 38%, rgba(26,28,28,0.08) 76%)',
              }}
            />
            {/* Light sweep shimmer */}
            <div
              className="hero-sweep absolute inset-y-0 -left-1/3 w-1/2 pointer-events-none"
              style={{ zIndex: 3 }}
            />
          </div>

          {/* Content */}
          <div className="container mx-auto px-6 md:px-8 relative flex justify-center" style={{ zIndex: 10 }}>
            <div className="flex flex-col items-center justify-start text-center">
              <span
                className="text-[0.75rem] font-bold uppercase tracking-[0.3em] block mt-8 mb-6"
                style={{ color: '#e9c349', fontFamily: 'var(--font-label)' }}
              >
                {isEs ? 'Joyería de Patrimonio y Relojes' : 'Curated Estate Jewelry & Watches'}
              </span>
              <h1
                className="text-4xl md:text-6xl font-normal mt-2 mb-14 md:mb-20 tracking-normal"
                style={{ fontFamily: 'var(--font-headline)', color: '#f9f9f7' }}
              >
                {isEs ? 'Rara. Auténtica. Atemporal.' : 'Rare. Authentic. Timeless.'}
              </h1>
              <div className="mb-10 flex w-full justify-center px-2">
                <HomeSubscriberForm locale={locale} />
              </div>
              <div className="flex flex-col items-center gap-4 mb-20">
                <div className="flex flex-wrap justify-center gap-4 md:gap-5">
                  <Link
                    href={shopHref}
                    className="inline-flex justify-center min-w-[9rem] md:min-w-[10rem] border px-8 py-2.5 rounded-full text-xs font-bold uppercase tracking-widest transition-colors"
                    style={{
                      borderColor: 'rgba(212,175,55,0.6)',
                      color: '#e9c349',
                      fontFamily: 'var(--font-label)',
                    }}
                  >
                    {isEs ? 'Comprar' : 'Buy'}
                  </Link>
                  <Link
                    href={isEs ? '/es/estate-jewelry' : '/estate-jewelry'}
                    className="inline-flex justify-center min-w-[9rem] md:min-w-[10rem] border px-8 py-2.5 rounded-full text-xs font-bold uppercase tracking-widest transition-colors"
                    style={{
                      borderColor: 'rgba(212,175,55,0.6)',
                      color: '#e9c349',
                      fontFamily: 'var(--font-label)',
                    }}
                  >
                    {isEs ? 'Vender' : 'Sell'}
                  </Link>
                  <Link
                    href={isEs ? '/es/contact' : '/contact'}
                    className="inline-flex justify-center min-w-[9rem] md:min-w-[10rem] border px-8 py-2.5 rounded-full text-xs font-bold uppercase tracking-widest transition-colors"
                    style={{
                      borderColor: 'rgba(212,175,55,0.6)',
                      color: '#e9c349',
                      fontFamily: 'var(--font-label)',
                    }}
                  >
                    {isEs ? 'Intercambiar' : 'Trade'}
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Scroll indicator */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 opacity-40" style={{ zIndex: 10 }}>
            <div className="w-px h-10 animate-pulse" style={{ background: 'var(--color-primary)' }} />
          </div>
        </section>

        {/* Services strip */}
        <section
          className="py-20 px-6 border-t"
          style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-low)' }}
        >
          <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-8">
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
                href: shopHref,
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
            ].map((item) => (
              <div key={item.title} className="flex flex-col gap-3">
                <span className="text-3xl">{item.icon}</span>
                <h3
                  className="text-xl font-bold"
                  style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}
                >
                  {item.title}
                </h3>
                <p className="text-sm leading-relaxed flex-1" style={{ color: 'var(--color-on-surface-variant)' }}>
                  {item.body}
                </p>
                <Link
                  href={item.href}
                  className="text-xs font-bold tracking-wide uppercase"
                  style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}
                >
                  {item.cta}
                </Link>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section
          className="py-20 px-6 text-center border-t"
          style={{ borderColor: 'var(--color-outline-variant)' }}
        >
          <p
            className="text-[0.65rem] font-bold uppercase tracking-[0.35em] mb-4"
            style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}
          >
            {isEs ? 'Llámenos Hoy' : 'Call Us Today'}
          </p>
          <a
            href="tel:2394048505"
            className="text-4xl md:text-5xl font-bold transition-opacity hover:opacity-70"
            style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}
          >
            (239) 404-8505
          </a>
          <p className="mt-4 text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
            {isEs ? 'Naples, Florida · Lunes–Sábado' : 'Naples, Florida · Mon–Sat'}
          </p>
        </section>

      </main>
      <SiteFooter locale={locale} />
    </>
  );
}
