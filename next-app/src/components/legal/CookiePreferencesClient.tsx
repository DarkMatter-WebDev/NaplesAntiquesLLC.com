'use client';

import { useEffect, useState } from 'react';

const COOKIE_NOTICE_KEY = 'nej_cookie_notice_v1';

export default function CookiePreferencesClient({ locale }: { locale: string }) {
  const isEs = locale === 'es';
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAccepted(localStorage.getItem(COOKIE_NOTICE_KEY) === 'accepted');
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function acceptNotice() {
    localStorage.setItem(COOKIE_NOTICE_KEY, 'accepted');
    setAccepted(true);
  }

  function resetNotice() {
    localStorage.removeItem(COOKIE_NOTICE_KEY);
    setAccepted(false);
  }

  return (
    <div
      className="mt-8 rounded-2xl border bg-white/80 p-5 shadow-[0_16px_44px_rgba(38,28,6,0.06)] md:p-6"
      style={{ borderColor: 'rgba(115, 92, 0, 0.14)' }}
    >
      <h2 className="mb-3 font-[family-name:var(--font-headline)] text-2xl font-bold text-[#1a1c1c]">
        {isEs ? 'Preferencia actual' : 'Current Preference'}
      </h2>
      <p className="mb-4 text-sm leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>
        {accepted
          ? (isEs ? 'El aviso de cookies fue aceptado en este navegador.' : 'The cookie notice has been accepted in this browser.')
          : (isEs ? 'El aviso de cookies no está marcado como aceptado en este navegador.' : 'The cookie notice is not currently marked accepted in this browser.')}
      </p>
      <div className="flex flex-wrap gap-2.5">
        <button type="button" className="gold-button px-5 py-2.5" onClick={acceptNotice} disabled={accepted}>
          {isEs ? 'Aceptar aviso' : 'Accept Notice'}
        </button>
        <button type="button" className="outline-button px-5 py-2.5" onClick={resetNotice} disabled={!accepted}>
          {isEs ? 'Restablecer aviso' : 'Reset Notice'}
        </button>
      </div>
    </div>
  );
}
