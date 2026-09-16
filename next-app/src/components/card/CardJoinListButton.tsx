'use client';

import dynamic from 'next/dynamic';
import { useState, type CSSProperties } from 'react';
import { AppIcon } from '@/components/AppIcon';

// Same lazy load as the homepage launcher (`HomeSubscriberForm`): the window
// is fetched on the first tap, never with the page. `ssr: false` because it
// portals into document.body.
const HomeSubscribeModal = dynamic(() => import('@/components/home/HomeSubscribeModal'), { ssr: false });

/**
 * "Join the List" on the `/card` QR landing page (owner, 2026-09-15, mockup
 * Option C: a full-width tile under the What We Buy / Shop / Instagram /
 * Facebook grid, tinted like the window's "Text-only deals" box so it reads
 * as something other than one more link).
 *
 * The only client-side piece on an otherwise JS-free page. It opens the SAME
 * Email / Text / Both window as the homepage hero, so the card and the site
 * grow one list with one consent record. Not gold: the review ask stays the
 * card's one filled button (DECISIONS, "/card").
 */
export default function CardJoinListButton({
  locale,
  className,
  style,
}: {
  locale: string;
  className?: string;
  style?: CSSProperties;
}) {
  const isEs = locale === 'es';
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={className}
        style={style}
      >
        <AppIcon name="notifications" className="text-[1.25rem]" style={{ color: 'var(--color-primary)' }} />
        <span className="whitespace-nowrap">{isEs ? 'Unirse a la Lista' : 'Join the List'}</span>
        {/* The hint says what the list is; it drops its case and spacing so
            the label stays the tile's name. The tile is ONE line in both
            languages (owner, 2026-09-15): the label never wraps, and the hint
            is short on purpose (Spanish: 231px of content in a 296px tile at
            360px wide) and truncates rather than wrapping if a screen is ever
            narrower than that. */}
        <span className="min-w-0 truncate font-medium normal-case tracking-[0.04em]" style={{ color: 'var(--color-on-surface-variant)' }}>
          · {isEs ? 'correo o texto' : 'email or text deals'}
        </span>
      </button>
      {open && <HomeSubscribeModal locale={locale} onClose={() => setOpen(false)} />}
    </>
  );
}
