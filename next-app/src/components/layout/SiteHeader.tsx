'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';

export default function SiteHeader() {
  const t = useTranslations('nav');
  const locale = useLocale();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  // Build locale-aware href
  function href(path: string) {
    const base = locale === 'es' ? '/es' : '';
    return `${base}${path}`;
  }

  // Alternate locale URL for language toggle
  const altLocale = locale === 'en' ? 'es' : 'en';
  const altPath = pathname.replace(/^\/(es)(\/|$)/, '/').replace(/^(?!\/)/, '/');
  const altHref = altLocale === 'es' ? `/es${altPath === '/' ? '' : altPath}` : altPath;

  return (
    <header className="site-header fixed top-0 w-full z-50 bg-[color:var(--color-background)]/95 border-b border-[color:var(--color-outline-variant)] backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3 px-4 md:px-8 py-4 md:py-5 w-full max-w-[1440px] mx-auto">

        {/* Brand */}
        <Link href={href('/')} className="flex items-center gap-3 min-w-0">
          <Image
            src="/assets/images/branding/logo.webp"
            alt="Naples Estate Jewelry Logo"
            width={40}
            height={40}
            className="h-10 w-auto object-contain flex-shrink-0"
            priority
            unoptimized
          />
          <span
            className="text-[18px] md:text-[22px] tracking-normal uppercase"
            style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-primary)' }}
          >
            Naples Estate Jewelry Co
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden 2xl:flex items-center gap-5">
          {[
            { key: 'home', path: '/' },
            { key: 'shop', path: '/shop' },
            { key: 'about', path: '/about' },
            { key: 'contact', path: '/contact' },
          ].map(({ key, path }) => (
            <Link
              key={key}
              href={href(path)}
              className="text-sm font-medium tracking-wide px-1 py-2 transition-colors"
              style={{ color: 'var(--color-secondary)', fontFamily: 'var(--font-label)' }}
            >
              {t(key as 'home' | 'shop' | 'about' | 'contact')}
            </Link>
          ))}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Link
            href={altHref}
            className="text-xs font-bold tracking-widest uppercase px-2 py-1 transition-colors"
            style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}
          >
            {locale === 'en' ? 'ES' : 'EN'}
          </Link>

          <a
            href="tel:2394048505"
            className="gold-button hidden 2xl:inline-flex"
          >
            {t('callNow')}
          </a>

          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="2xl:hidden border px-3 py-2 text-xs font-bold tracking-widest uppercase"
            style={{
              borderColor: 'color-mix(in srgb, var(--color-primary) 50%, transparent)',
              color: 'var(--color-primary)',
              fontFamily: 'var(--font-label)',
            }}
            aria-expanded={menuOpen}
            aria-label={menuOpen ? t('close') : t('menu')}
          >
            {menuOpen ? t('close') : t('menu')}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div
          className="2xl:hidden border-t"
          style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-background)' }}
        >
          <div className="flex flex-col px-5 py-4">
            {[
              { key: 'home', path: '/' },
              { key: 'shop', path: '/shop' },
              { key: 'sellToUs', path: '/estate-jewelry' },
              { key: 'about', path: '/about' },
              { key: 'services', path: '/free-evaluation' },
              { key: 'contact', path: '/contact' },
              { key: 'myAccount', path: '/account' },
            ].map(({ key, path }) => (
              <Link
                key={key}
                href={href(path)}
                onClick={() => setMenuOpen(false)}
                className="py-3 border-b text-sm font-medium"
                style={{
                  borderColor: 'var(--color-outline-variant)',
                  color: 'var(--color-on-surface)',
                  fontFamily: 'var(--font-label)',
                }}
              >
                {t(key as keyof typeof t)}
              </Link>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
