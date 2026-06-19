import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import SiteFooter from '@/components/layout/SiteFooter';
import SiteHeader from '@/components/layout/SiteHeader';

export const metadata: Metadata = {
  title: 'Store | Naples Estate Jewelry',
  description:
    'Choose a Naples Estate Jewelry shopping category, including estate jewelry and sterling silver tablewares.',
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
            className="h-[30rem] w-full object-cover object-center sm:h-auto"
          />
          <div
            className="absolute inset-0 bg-gradient-to-b from-white/24 via-transparent to-black/8"
            aria-hidden="true"
          />
          <div className="absolute inset-x-0 top-[18%] flex justify-center px-5 sm:top-[24%] md:top-[28%]">
            <div className="grid w-full max-w-5xl grid-cols-2 items-center gap-5 sm:gap-8 md:gap-12 lg:max-w-6xl">
              <Link
                href={`${prefix}/shop`}
                className="group relative flex h-[9.75rem] w-full max-w-[9.75rem] cursor-pointer flex-col items-center justify-center justify-self-start overflow-hidden rounded-2xl border-2 bg-white/92 p-3 text-center backdrop-blur-md transition duration-300 before:absolute before:inset-x-0 before:top-0 before:h-1/2 before:bg-gradient-to-b before:from-white before:to-transparent before:opacity-80 before:content-[''] hover:-translate-y-2 hover:bg-white hover:shadow-[0_34px_90px_rgba(38,28,6,0.34),0_12px_24px_rgba(38,28,6,0.2),inset_0_1px_0_rgba(255,255,255,0.95),inset_0_-12px_24px_rgba(143,108,6,0.08)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#8f6c06] active:translate-y-0 sm:h-60 sm:max-w-[15rem] sm:p-6 md:h-72 md:max-w-[18rem] md:p-8"
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
                  className="relative mt-4 inline-flex min-h-9 items-center gap-2 rounded-full border bg-white/82 py-1.5 pl-3.5 pr-1.5 text-[0.55rem] font-bold uppercase tracking-[0.16em] shadow-[0_12px_30px_rgba(38,28,6,0.12),inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-sm transition duration-300 group-hover:-translate-y-0.5 group-hover:bg-white group-hover:shadow-[0_18px_38px_rgba(38,28,6,0.16),inset_0_1px_0_rgba(255,255,255,0.95)] sm:mt-5 sm:min-h-11 sm:gap-3 sm:pl-5 sm:pr-2 sm:text-[0.68rem] sm:tracking-[0.2em]"
                  style={{
                    borderColor: 'rgba(143, 108, 6, 0.34)',
                    color: '#735c00',
                    fontFamily: 'var(--font-label)',
                  }}
                >
                  <span>{isEs ? 'Ver Joyas' : 'Browse Jewelry'}</span>
                  <span
                    className="grid h-6 w-6 place-items-center rounded-full text-sm leading-none transition duration-300 group-hover:translate-x-0.5 sm:h-7 sm:w-7"
                    style={{
                      background: 'linear-gradient(135deg, #dcb336, #b5890c)',
                      color: '#fffaf0',
                      boxShadow: '0 6px 14px rgba(143, 108, 6, 0.2)',
                    }}
                    aria-hidden="true"
                  >
                    →
                  </span>
                </span>
              </Link>

              <Link
                href={`${prefix}/silver-tableware`}
                className="group relative flex h-[9.75rem] w-full max-w-[9.75rem] flex-col items-center justify-center justify-self-end overflow-hidden rounded-2xl border-2 bg-white/88 p-3 text-center backdrop-blur-md transition duration-300 before:absolute before:inset-x-0 before:top-0 before:h-1/2 before:bg-gradient-to-b before:from-white before:to-transparent before:opacity-75 before:content-[''] hover:-translate-y-2 hover:bg-white hover:shadow-[0_34px_90px_rgba(38,28,6,0.3),0_12px_24px_rgba(38,28,6,0.17),inset_0_1px_0_rgba(255,255,255,0.95),inset_0_-12px_24px_rgba(120,120,120,0.08)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#8f6c06] active:translate-y-0 sm:h-60 sm:max-w-[15rem] sm:p-6 md:h-72 md:max-w-[18rem] md:p-8"
                style={{
                  borderColor: 'rgba(255, 255, 255, 0.72)',
                  boxShadow:
                    '0 26px 68px rgba(38, 28, 6, 0.22), 0 9px 20px rgba(38, 28, 6, 0.13), inset 0 1px 0 rgba(255, 255, 255, 0.9), inset 0 -10px 22px rgba(31, 31, 31, 0.06)',
                }}
              >
                <span
                  className="relative text-[0.58rem] font-bold uppercase tracking-[0.18em] sm:text-xs sm:tracking-[0.22em]"
                  style={{ color: '#735c00', fontFamily: 'var(--font-label)' }}
                >
                  {isEs ? 'Disponible' : 'Available'}
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
                  className="relative mt-4 inline-flex min-h-9 items-center gap-2 rounded-full border bg-white/82 py-1.5 pl-3.5 pr-1.5 text-[0.55rem] font-bold uppercase tracking-[0.16em] shadow-[0_12px_30px_rgba(38,28,6,0.12),inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-sm transition duration-300 group-hover:-translate-y-0.5 group-hover:bg-white group-hover:shadow-[0_18px_38px_rgba(38,28,6,0.16),inset_0_1px_0_rgba(255,255,255,0.95)] sm:mt-5 sm:min-h-11 sm:gap-3 sm:pl-5 sm:pr-2 sm:text-[0.68rem] sm:tracking-[0.2em]"
                  style={{
                    borderColor: 'rgba(143, 108, 6, 0.34)',
                    color: '#735c00',
                    fontFamily: 'var(--font-label)',
                  }}
                >
                  <span>{isEs ? 'Ver Plateria' : 'Browse Tableware'}</span>
                  <span
                    className="grid h-6 w-6 place-items-center rounded-full text-sm leading-none transition duration-300 group-hover:translate-x-0.5 sm:h-7 sm:w-7"
                    style={{
                      background: 'linear-gradient(135deg, #dcb336, #b5890c)',
                      color: '#fffaf0',
                      boxShadow: '0 6px 14px rgba(143, 108, 6, 0.2)',
                    }}
                    aria-hidden="true"
                  >
                    →
                  </span>
                </span>
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}
