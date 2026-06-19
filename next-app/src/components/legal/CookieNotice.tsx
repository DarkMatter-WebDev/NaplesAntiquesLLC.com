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
      className="fixed bottom-3 left-3 right-3 z-[70] mx-auto max-w-4xl rounded-2xl border p-4 shadow-[0_18px_64px_rgba(38,28,6,0.18)] backdrop-blur md:bottom-5 md:flex md:items-center md:justify-between md:gap-5 md:p-5"
      style={{
        background: 'rgba(255,255,255,0.94)',
        borderColor: 'rgba(115, 92, 0, 0.16)',
        color: 'var(--color-on-surface)',
      }}
      role="region"
      aria-label={isEs ? 'Aviso de cookies' : 'Cookie notice'}
    >
      <div className="text-sm leading-relaxed">
        <p className="font-bold" style={{ fontFamily: 'var(--font-label)', color: 'var(--color-primary)' }}>
          {isEs ? 'Cookies y almacenamiento esencial' : 'Essential Cookies and Storage'}
        </p>
        <p style={{ color: 'var(--color-on-surface-variant)' }}>
          {isEs
            ? 'Usamos cookies esenciales y almacenamiento del navegador para inicio de sesion, carrito, favoritos, idioma y seguridad.'
            : 'We use essential cookies and browser storage for sign-in, cart, favorites, language routing, and security.'}
        </p>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 md:mt-0 md:flex-nowrap">
        <Link href={`${prefix}/privacy`} className="outline-button px-4 py-2 text-[0.68rem]">
          {isEs ? 'Privacidad' : 'Privacy'}
        </Link>
        <Link href={`${prefix}/cookie-preferences`} className="outline-button px-4 py-2 text-[0.68rem]">
          {isEs ? 'Preferencias' : 'Preferences'}
        </Link>
        <button type="button" onClick={accept} className="gold-button px-4 py-2 text-[0.68rem]">
          {isEs ? 'Aceptar' : 'Accept'}
        </button>
      </div>
    </div>
  );
}
