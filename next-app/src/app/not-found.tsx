import Link from 'next/link';
import { caslon, hanken } from '@/lib/fonts';

/**
 * Root-level 404 for unmatched, non-localized paths (anything outside the
 * [locale] segment). Since the root layout is now a passthrough (the <html> shell
 * lives in [locale]/layout.tsx so `lang` can be per-locale), this page renders its
 * own <html>/<body> and applies the brand fonts. It does NOT use SiteHeader/
 * SiteFooter: those rely on next-intl's provider, which only exists inside the
 * [locale] layout. globals.css is imported by the root layout, so CSS tokens and
 * the gold-button/outline-button utilities are available.
 */
export default function NotFound() {
  return (
    <html lang="en" className={`${caslon.variable} ${hanken.variable}`}>
      <body>
        <main
          className="flex flex-col items-center justify-center text-center px-6 min-h-screen"
          style={{ background: 'var(--color-background)' }}
        >
      <Link
        href="/"
        className="text-sm font-bold uppercase tracking-[0.2em] mb-10"
        style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-primary)' }}
      >
        Naples Estate Jewelry.Co
      </Link>
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
      </body>
    </html>
  );
}
