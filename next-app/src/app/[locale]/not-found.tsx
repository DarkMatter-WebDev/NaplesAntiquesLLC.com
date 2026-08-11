import Link from 'next/link';
import type { Metadata } from 'next';
import { getLocale } from 'next-intl/server';
import SiteHeader from '@/components/layout/SiteHeader';
import SiteFooter from '@/components/layout/SiteFooter';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return {
    title: locale === 'es' ? 'Página No Encontrada' : 'Page Not Found',
    robots: { index: false, follow: false },
  };
}

export default async function NotFound() {
  const locale = await getLocale();
  const isEs = locale === 'es';
  const prefix = isEs ? '/es' : '';

  return (
    <>
      <SiteHeader />
      <main
        className="pt-28 md:pt-32 pb-20 flex flex-col items-center justify-center text-center px-6 min-h-[60svh]"
        style={{ background: 'var(--color-background)' }}
      >
        <p
          className="text-xs font-bold uppercase tracking-[0.4em] mb-6"
          style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}
        >
          404
        </p>
        <h1
          className="text-4xl md:text-5xl font-bold mb-6 tracking-tight"
          style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}
        >
          {isEs ? 'Página No Encontrada' : 'Page Not Found'}
        </h1>
        <p className="text-lg mb-10 max-w-md" style={{ color: 'var(--color-on-surface-variant)' }}>
          {isEs
            ? 'La página que busca no existe o puede haberse movido.'
            : 'The page you\'re looking for doesn\'t exist or may have moved.'}
        </p>
        <div className="flex flex-wrap gap-4 justify-center">
          <Link href={prefix || '/'} className="gold-button">
            {isEs ? 'Ir al Inicio' : 'Go Home'}
          </Link>
          <Link href={`${prefix}/shop`} className="outline-button">
            {isEs ? 'Ver la Tienda' : 'Browse Shop'}
          </Link>
        </div>
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}
