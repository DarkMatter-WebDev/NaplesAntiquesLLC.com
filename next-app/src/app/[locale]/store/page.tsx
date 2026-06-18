import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import SiteFooter from '@/components/layout/SiteFooter';
import SiteHeader from '@/components/layout/SiteHeader';

export const metadata: Metadata = {
  title: 'Store | Naples Estate Jewelry',
  description:
    'Choose a Naples Estate Jewelry shopping category, including estate jewelry now and sterling silver tablewares coming soon.',
};

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function StorePage({ params }: Props) {
  const { locale } = await params;
  const isEs = locale === 'es';
  const prefix = isEs ? '/es' : '';

  return (
    <>
      <SiteHeader />
      <main className="pt-16 store-page">

        {/* Category header */}
        <section
          className="py-20 md:py-28 text-center border-b"
          style={{
            background: 'var(--color-surface-container-lowest)',
            borderColor: 'rgba(220, 179, 54, 0.22)',
          }}
        >
          <span
            className="block text-[0.72rem] font-bold uppercase tracking-[0.28em] mb-5"
            style={{ color: '#8f6c06', fontFamily: 'var(--font-label)' }}
          >
            {isEs ? 'Elija una categoria' : 'Choose a category'}
          </span>
          <h1
            className="font-normal mx-auto"
            style={{
              fontFamily: 'var(--font-headline)',
              color: 'var(--color-on-surface)',
              fontSize: 'clamp(2.4rem, 8vw, 4.5rem)',
              lineHeight: '0.95',
              maxWidth: '18ch',
            }}
          >
            {isEs ? '¿Qué desea ver?' : 'What would you like to browse?'}
          </h1>
          <p
            className="mt-5 mx-auto"
            style={{
              maxWidth: '38rem',
              color: 'var(--color-on-surface-variant)',
              fontSize: 'clamp(0.98rem, 2.4vw, 1.15rem)',
              lineHeight: '1.55',
            }}
          >
            {isEs
              ? 'Comience con nuestras joyas de patrimonio disponibles ahora. Mas categorias se abriran aqui a medida que el inventario este listo.'
              : 'Start with the estate jewelry available now. Additional buying categories will open here as inventory is ready.'}
          </p>
        </section>

        {/* Category cards */}
        <section className="py-12 md:py-16" style={{ background: 'var(--color-surface-container-lowest)' }}>
          <div className="container mx-auto grid max-w-6xl gap-5 px-6 md:grid-cols-2 md:gap-6 md:px-8">
            <article
              className="group overflow-hidden border bg-white"
              style={{ borderColor: 'var(--color-outline-variant)' }}
            >
              <div className="relative aspect-[16/10] overflow-hidden bg-[#11100c]">
                <Image
                  src="/assets/images/pages/shop-modern-hero-crop.png"
                  alt=""
                  fill
                  sizes="(min-width: 768px) 50vw, 100vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  priority
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/8 to-transparent" aria-hidden="true" />
                <span
                  className="absolute bottom-4 left-4 text-[0.68rem] font-bold uppercase tracking-[0.24em]"
                  style={{ color: '#f0c85a', fontFamily: 'var(--font-label)' }}
                >
                  {isEs ? 'Disponible ahora' : 'Available now'}
                </span>
              </div>
              <div className="flex min-h-[16rem] flex-col p-6 md:p-8">
                <h2
                  className="text-2xl font-bold md:text-3xl"
                  style={{ color: 'var(--color-on-surface)', fontFamily: 'var(--font-headline)' }}
                >
                  {isEs ? 'Joyas de Patrimonio' : 'Estate Jewelry Shop'}
                </h2>
                <p className="mt-4 leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>
                  {isEs
                    ? 'Explore cadenas, pulseras, anillos y piezas seleccionadas con precios transparentes.'
                    : 'Browse chains, bracelets, rings, and curated estate pieces with transparent pricing.'}
                </p>
                <Link href={`${prefix}/shop`} className="gold-button mt-auto self-start">
                  {isEs ? 'Ver Joyas' : 'Browse Jewelry'}
                </Link>
              </div>
            </article>

            <article
              className="overflow-hidden border bg-white"
              style={{ borderColor: 'var(--color-outline-variant)' }}
            >
              <div className="relative aspect-[16/10] overflow-hidden bg-[#151515]">
                <Image
                  src="/assets/images/pages/silver.jpg"
                  alt=""
                  fill
                  sizes="(min-width: 768px) 50vw, 100vw"
                  className="object-cover opacity-80 grayscale-[0.15]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/62 via-black/12 to-transparent" aria-hidden="true" />
                <span
                  className="absolute bottom-4 left-4 text-[0.68rem] font-bold uppercase tracking-[0.24em]"
                  style={{ color: '#f0c85a', fontFamily: 'var(--font-label)' }}
                >
                  {isEs ? 'Proximamente' : 'Coming soon'}
                </span>
              </div>
              <div className="flex min-h-[16rem] flex-col p-6 md:p-8">
                <h2
                  className="text-2xl font-bold md:text-3xl"
                  style={{ color: 'var(--color-on-surface)', fontFamily: 'var(--font-headline)' }}
                >
                  {isEs ? 'Plateria de Mesa Sterling' : 'Sterling Silver Tablewares'}
                </h2>
                <p className="mt-4 leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>
                  {isEs
                    ? 'Un espacio reservado para cubiertos, bandejas, piezas huecas y servicios de mesa de plata sterling.'
                    : 'A reserved space for sterling flatware, trays, hollowware, and table service pieces.'}
                </p>
                <button
                  type="button"
                  disabled
                  className="mt-auto self-start border px-6 py-3 text-xs font-bold uppercase tracking-widest opacity-60"
                  style={{
                    borderColor: 'var(--color-outline-variant)',
                    color: 'var(--color-on-surface-variant)',
                    fontFamily: 'var(--font-label)',
                  }}
                >
                  {isEs ? 'Aun no disponible' : 'Not available yet'}
                </button>
              </div>
            </article>
          </div>
        </section>
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}
