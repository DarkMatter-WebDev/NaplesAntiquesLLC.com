'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';

const GOLD = '#e9c349';

// The window is loaded on the first tap, never with the homepage: it is not
// part of the hero's first paint or its measured LCP (DECISIONS, "Media &
// hero loading"). `ssr: false` because it portals into document.body.
const HomeSubscribeModal = dynamic(() => import('./HomeSubscribeModal'), { ssr: false });

/**
 * The hero's sign-up block: today's caption over ONE gold button that opens
 * the "Join the List" window (owner, 2026-09-15, "Option B"). Until then this
 * component WAS the form — Name / Email / Join on one row with the consent
 * line under it. The fields, the consent line and the choice of email or text
 * alerts now live in `HomeSubscribeModal`.
 *
 * The file keeps its name so the hero's imports and guard test are stable;
 * the `home-subscriber-*` class names are hooks for the hero's compact mode
 * (HomeHeroOverlay), which shrinks these two elements on screens too short to
 * fit them. They carry no styles of their own.
 */
export default function HomeSubscriberForm({ locale }: { locale: string }) {
  const isEs = locale === 'es';
  const [open, setOpen] = useState(false);

  return (
    <div
      className="flex w-full max-w-2xl flex-col items-center"
      style={{ color: 'var(--hero-text)', fontFamily: 'var(--font-label)' }}
    >
      <p
        className="home-subscriber-label mb-2 text-[0.6rem] sm:mb-3 sm:text-[0.68rem] font-bold uppercase tracking-[0.24em]"
        style={{ color: 'var(--hero-eyebrow)', textShadow: '0 1px 10px rgba(var(--hero-fade), 0.9)' }}
      >
        {isEs ? 'Reciba nuevas piezas primero' : 'Get first look at new pieces'}
      </p>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="home-subscriber-join inline-flex h-10 items-center gap-2 rounded-full px-6 text-[0.7rem] font-extrabold uppercase tracking-[0.18em] sm:h-11 sm:px-7 sm:text-xs"
        style={{ background: GOLD, color: '#171717', boxShadow: '0 2px 12px rgba(0,0,0,0.2)' }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.6 8.6 0 0 1-3.6-.8L3 21l1.9-4.6A8.4 8.4 0 0 1 3 11.5a8.4 8.4 0 0 1 9-8.4 8.4 8.4 0 0 1 9 8.4z" />
        </svg>
        {isEs ? 'Unirse a la lista' : 'Join the List'}
      </button>
      {open && <HomeSubscribeModal locale={locale} onClose={() => setOpen(false)} />}
    </div>
  );
}
