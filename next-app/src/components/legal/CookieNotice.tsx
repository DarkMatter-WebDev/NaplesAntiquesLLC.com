'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const COOKIE_NOTICE_KEY = 'nej_cookie_notice_v1';

export default function CookieNotice({ locale }: { locale: string }) {
  const isEs = locale === 'es';
  const prefix = isEs ? '/es' : '';
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setVisible(localStorage.getItem(COOKIE_NOTICE_KEY) !== 'accepted');
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function accept() {
    localStorage.setItem(COOKIE_NOTICE_KEY, 'accepted');
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-3 left-3 right-3 z-[70] mx-auto max-w-4xl rounded-2xl border p-3.5 shadow-[0_18px_64px_rgba(38,28,6,0.18)] backdrop-blur md:bottom-5 md:flex md:items-center md:justify-between md:gap-5 md:p-5"
      style={{
        background: 'rgba(255,255,255,0.94)',
        borderColor: 'rgba(115, 92, 0, 0.16)',
        color: 'var(--color-on-surface)',
      }}
      role="region"
      aria-label={isEs ? 'Aviso de cookies' : 'Cookie notice'}
    >
      <div className="min-w-0 text-xs leading-snug md:text-sm md:leading-relaxed">
        <p className="text-[0.78rem] font-bold md:text-sm" style={{ fontFamily: 'var(--font-label)', color: 'var(--color-primary)' }}>
          {isEs ? 'Cookies y almacenamiento esencial' : 'Essential Cookies and Storage'}
        </p>
        <p style={{ color: 'var(--color-on-surface-variant)' }}>
          {isEs
            ? 'Usamos cookies esenciales y almacenamiento del navegador para inicio de sesión, carrito, favoritos, idioma y seguridad.'
            : 'We use essential cookies and browser storage for sign-in, cart, favorites, language routing, and security.'}
        </p>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 md:mt-0 md:flex md:flex-shrink-0 md:flex-nowrap md:items-center">
        {/* ⚠️ These two do NOT prefetch, and this banner is the worst possible
            place to do so: it renders for FIRST-TIME visitors specifically —
            exactly the people already waiting on a cold, uncached page — and
            points at two legal pages almost nobody opens. Measured 2026-08-14,
            /cookie-preferences was the single most-prefetched route on the site
            (6x) with /privacy close behind. */}
        <Link href={`${prefix}/privacy`} prefetch={false} className="outline-button justify-center px-3 py-1.5 text-[0.62rem] md:px-4 md:py-2 md:text-[0.68rem]">
          {isEs ? 'Privacidad' : 'Privacy'}
        </Link>
        <Link href={`${prefix}/cookie-preferences`} prefetch={false} className="outline-button justify-center px-3 py-1.5 text-[0.62rem] md:px-4 md:py-2 md:text-[0.68rem]">
          {isEs ? 'Preferencias' : 'Preferences'}
        </Link>
        <button type="button" onClick={accept} className="gold-button col-span-2 justify-center px-3 py-1.5 text-[0.62rem] md:px-4 md:py-2 md:text-[0.68rem]">
          {isEs ? 'Aceptar' : 'Accept'}
        </button>
      </div>
    </div>
  );
}
