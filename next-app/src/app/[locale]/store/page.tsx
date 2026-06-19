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
        <section
          className="relative overflow-hidden"
          style={{ background: 'var(--color-surface-container-lowest)' }}
        >
          <Image
            src="/assets/images/pages/store.png"
            alt={
              isEs
                ? 'Joyas de oro de patrimonio y platería de mesa de plata sterling'
                : 'Gold estate jewelry and sterling silver tablewares'
            }
            width={1536}
            height={1024}
            sizes="100vw"
            priority
            className="h-[36rem] w-full object-cover object-center sm:h-auto"
          />
          <div
            className="absolute inset-0 bg-gradient-to-b from-white/24 via-transparent to-black/8"
            aria-hidden="true"
          />
          <div className="absolute inset-x-0 top-[18%] flex justify-center px-5 sm:top-[24%] md:top-[28%]">
            <div className="grid w-full max-w-5xl grid-cols-2 items-center gap-5 sm:gap-8 md:gap-12 lg:max-w-6xl">
              <Link
                href={`${prefix}/shop`}
                className="group relative flex h-[9.75rem] w-full max-w-[9.75rem] cursor-pointer flex-col items-center justify-center justify-self-start overflow-hidden rounded-[0.35rem] border-2 bg-white/92 p-3 text-center backdrop-blur-md transition duration-300 before:absolute before:inset-x-0 before:top-0 before:h-1/2 before:bg-gradient-to-b before:from-white before:to-transparent before:opacity-80 before:content-[''] hover:-translate-y-2 hover:bg-white hover:shadow-[0_34px_90px_rgba(38,28,6,0.34),0_12px_24px_rgba(38,28,6,0.2),inset_0_1px_0_rgba(255,255,255,0.95),inset_0_-12px_24px_rgba(143,108,6,0.08)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#8f6c06] active:translate-y-0 sm:h-60 sm:max-w-[15rem] sm:p-6 md:h-72 md:max-w-[18rem] md:p-8"
                style={{
                  borderColor: 'rgba(255, 255, 255, 0.72)',
                  boxShadow:
                    '0 28px 76px rgba(38, 28, 6, 0.28), 0 10px 22px rgba(38, 28, 6, 0.16), inset 0 1px 0 rgba(255, 255, 255, 0.95), inset 0 -10px 22px rgba(143, 108, 6, 0.07)',
                }}
              >
                <span
                  className="relative text-[0.58rem] font-bold uppercase tracking-[0.18em] sm:text-xs sm:tracking-[0.22em]"
                  style={{ color: '#8f6c06', fontFamily: 'var(--font-label)' }}
                >
                  {isEs ? 'Disponible' : 'Available'}
                </span>
                <span
                  className="relative mt-3 text-[1.12rem] leading-none sm:mt-4 sm:text-[1.95rem] md:text-[2.35rem]"
                  style={{
                    color: 'var(--color-on-surface)',
                    fontFamily: 'var(--font-headline)',
                  }}
                >
                  {isEs ? 'Joyas de Patrimonio' : 'Estate Jewelry Shop'}
                </span>
                <span
                  className="relative mt-4 inline-flex items-center justify-center rounded-[0.25rem] border px-3 py-2 text-[0.56rem] font-bold uppercase tracking-[0.14em] shadow-[0_8px_16px_rgba(143,108,6,0.22),inset_0_1px_0_rgba(255,255,255,0.35)] transition group-hover:translate-y-[-1px] sm:mt-5 sm:px-4 sm:text-xs sm:tracking-[0.18em]"
                  style={{
                    background: '#8f6c06',
                    borderColor: '#755804',
                    color: '#fffaf0',
                    fontFamily: 'var(--font-label)',
                  }}
                >
                  {isEs ? 'Ver Joyas >' : 'Browse Jewelry >'}
                </span>
              </Link>

              <button
                type="button"
                disabled
                className="relative flex h-[9.75rem] w-full max-w-[9.75rem] cursor-not-allowed flex-col items-center justify-center justify-self-end overflow-hidden rounded-[0.35rem] border-2 bg-white/82 p-3 text-center opacity-80 backdrop-blur-md before:absolute before:inset-x-0 before:top-0 before:h-1/2 before:bg-gradient-to-b before:from-white before:to-transparent before:opacity-75 before:content-[''] sm:h-60 sm:max-w-[15rem] sm:p-6 md:h-72 md:max-w-[18rem] md:p-8"
                style={{
                  borderColor: 'rgba(255, 255, 255, 0.68)',
                  boxShadow:
                    '0 26px 68px rgba(38, 28, 6, 0.22), 0 9px 20px rgba(38, 28, 6, 0.13), inset 0 1px 0 rgba(255, 255, 255, 0.9), inset 0 -10px 22px rgba(31, 31, 31, 0.06)',
                }}
              >
                <span
                  className="relative text-[0.58rem] font-bold uppercase tracking-[0.18em] sm:text-xs sm:tracking-[0.22em]"
                  style={{ color: '#7b735f', fontFamily: 'var(--font-label)' }}
                >
                  {isEs ? 'Próximamente' : 'Coming soon'}
                </span>
                <span
                  className="relative mt-3 text-[0.98rem] leading-none sm:mt-4 sm:text-[1.65rem] md:text-[1.95rem]"
                  style={{
                    color: 'var(--color-on-surface)',
                    fontFamily: 'var(--font-headline)',
                  }}
                >
                  {isEs ? 'Platería Sterling' : 'Sterling Silver Tablewares'}
                </span>
                <span
                  className="relative mt-4 inline-flex items-center justify-center rounded-[0.25rem] border bg-white/55 px-3 py-2 text-[0.56rem] font-bold uppercase tracking-[0.14em] shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] sm:mt-5 sm:px-4 sm:text-xs sm:tracking-[0.18em]"
                  style={{
                    borderColor: 'rgba(123, 115, 95, 0.36)',
                    color: '#7b735f',
                    fontFamily: 'var(--font-label)',
                  }}
                >
                  {isEs ? 'No disponible' : 'Not available'}
                </span>
              </button>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}
