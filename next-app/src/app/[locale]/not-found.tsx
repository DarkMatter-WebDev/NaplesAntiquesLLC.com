import Link from 'next/link';
import SiteHeader from '@/components/layout/SiteHeader';
import SiteFooter from '@/components/layout/SiteFooter';

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main
        className="pt-28 md:pt-32 pb-20 flex flex-col items-center justify-center text-center px-6 min-h-[60vh]"
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
          Page Not Found
        </h1>
        <p className="text-lg mb-10 max-w-md" style={{ color: 'var(--color-on-surface-variant)' }}>
          The page you&rsquo;re looking for doesn&rsquo;t exist or may have moved.
        </p>
        <div className="flex flex-wrap gap-4 justify-center">
          <Link href="/" className="gold-button">
            Go Home
          </Link>
          <Link href="/shop" className="outline-button">
            Browse Shop
          </Link>
        </div>
      </main>
      <SiteFooter locale="en" />
    </>
  );
}
