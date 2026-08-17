'use client';

// Static hero overlay: the headline, sign-up form, CTA buttons, and the top
// legibility halo. HomeHeroStack pins ONE of these over the two parallax
// slideshow panes, so while scrolling swaps the slideshows underneath, this
// layer stays exactly where it is until the whole frame breaks free.
//
// The light/dark text theme is controlled by the stack via the `dark` prop
// (driven by whichever slideshow currently dominates the frame); the elements
// transition between the two token sets.

import Link from 'next/link';
import { useEffect, useState, type CSSProperties } from 'react';
import HomeSubscriberForm from './HomeSubscriberForm';

type Props = {
  locale: string;
  dark: boolean;
};

// Theme tokens consumed by the overlay; the elements transition between them.
const LIGHT_THEME: CSSProperties = {
  '--hero-fade': '255, 253, 247',
  '--hero-text': '#17130c',
  '--hero-eyebrow': '#8f6c06',
  '--hero-btn-color': '#7a5800',
  '--hero-btn-border': 'rgba(139, 103, 0, 0.55)',
  '--hero-btn-bg': 'rgba(180, 130, 0, 0.10)',
} as CSSProperties;

const DARK_THEME: CSSProperties = {
  '--hero-fade': '5, 5, 5',
  '--hero-text': '#f9f9f7',
  '--hero-eyebrow': '#e9c349',
  '--hero-btn-color': '#e9c349',
  '--hero-btn-border': 'rgba(233, 195, 73, 0.72)',
  '--hero-btn-bg': 'rgba(212, 175, 55, 0.14)',
} as CSSProperties;

export default function HomeHeroOverlay({ locale, dark }: Props) {
  const isEs = locale === 'es';
  const storeHref = isEs ? '/es/shop' : '/shop';

  // Reveal after fonts settle (mirrors the slideshow's is-ready fade timing);
  // a short fallback guarantees the text can never stay hidden.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let marked = false;
    const mark = () => {
      if (cancelled || marked) return;
      marked = true;
      window.requestAnimationFrame(() => {
        if (!cancelled) setReady(true);
      });
    };
    const fallbackTimer = window.setTimeout(mark, 1500);
    const fontsReady =
      'fonts' in document ? document.fonts.ready.catch(() => undefined) : Promise.resolve();
    Promise.resolve(fontsReady).then(() => {
      window.clearTimeout(fallbackTimer);
      mark();
    });
    return () => {
      cancelled = true;
      window.clearTimeout(fallbackTimer);
    };
  }, []);

  const theme = dark ? DARK_THEME : LIGHT_THEME;

  const buttons = [
    { href: storeHref, label: isEs ? 'Comprar' : 'Buy' },
    { href: isEs ? '/es/estate-jewelry' : '/estate-jewelry', label: isEs ? 'Vender' : 'Sell' },
    // Trade goes to the named program page, not /contact — the page explains
    // how a trade-in works and carries its own contact paths, so sending
    // people straight to a contact form skipped the explanation.
    { href: isEs ? '/es/trade-in' : '/trade-in', label: isEs ? 'Intercambiar' : 'Trade' },
  ];

  return (
    <div
      className={`home-hero-overlay ${ready ? 'is-ready' : ''}`}
      style={theme}
      data-customer-reveal-skip
    >
      {/* Top halo for text legibility — two layers cross-fade so the color
          change is smooth (gradients can't transition; opacity can). */}
      <div className="home-top-fade home-top-fade--light" style={{ opacity: dark ? 0 : 1 }} aria-hidden="true" />
      <div className="home-top-fade home-top-fade--dark" style={{ opacity: dark ? 1 : 0 }} aria-hidden="true" />

      {/* Headline — centered in the top half, above the rotating pieces */}
      <div className="home-hero-top">
        {/* Eyebrow: a <span>, so it carries NO heading weight — which is why the
            PROMISE lives here and the keywords sit in the <h1> below. This is
            the pairing the owner settled on; it was briefly
            "We Buy & Sell Estate Jewelry and Watches" while the headline was
            brand copy, and reverted with the headline.

            ⚠️ It must put the knowing on US, not the customer.
            "Know What Yours Is Worth" was rejected for implying the visitor
            should already know what they have — most arrive holding something
            inherited and unidentified.

            ⚠️ Says nothing about the SERVICE MODEL, deliberately. A storefront
            is opening, so "mobile", "we come to you" and "by appointment only"
            would all need rewriting the day it does. Keep it that way. */}
        <span
          className="text-[0.75rem] font-bold uppercase tracking-[0.3em] block"
          style={{ color: 'var(--hero-eyebrow)', fontFamily: 'var(--font-label)' }}
        >
          {isEs ? 'Una Pieza o Todo un Patrimonio' : 'One Piece or an Entire Estate'}
        </span>
        {/* ⚠️ KEEP THIS SHORT — the length is load-bearing, not a style choice.
            At clamp(2.4rem, 8vw, 5.75rem) in a min(92vw, 52rem) box, measured
            line counts are: ~26-29 characters = 2 lines at every width (the
            profile this page has always had), 38 characters = 3 lines at both
            320px and 1280px+, 48 characters = 4 lines. Re-measure before
            lengthening; the full page title will NOT fit here.

            KEYWORDS, deliberately — location + both primary categories + buyer
            intent, in the one slot Google reads as the page's topic. The owner's
            stated priority (2026-08-16) is that the strongest signal on the site
            is that we BUY in Naples, and this is the only element that can carry
            it with heading weight.

            A brand-voice draft ("Pieces Worth Discovering") held this slot
            briefly and was reverted for exactly that reason. Its trade-off is
            worth remembering if the question comes round again: warmer copy, but
            the homepage then had no on-page topic signal at all.

            ⚠️ At 46 characters this is well past the ~29-char two-line budget.
            The headline block was widened to 72rem so it renders TWO lines on
            desktop; it is still THREE at phone and tablet widths, where 92vw
            binds before the cap. Accepted. Re-measure on any rewording and do
            not assume a line count — it now differs by breakpoint.

            ⚠️ "Premier", not "Premiere" — the latter means a debut performance.
            `/silver-services` uses the same correct form; do not let a
            well-meaning edit reintroduce the typo in the site's largest text.

            ⚠️ One test survives every rewrite: hero copy must never imply the
            visitor should ALREADY know what they have. "Know What Yours Is
            Worth" was rejected for exactly that — most arrive holding something
            inherited and unidentified. */}
        <h1
          className="font-normal tracking-normal"
          style={{ fontFamily: 'var(--font-headline)', color: 'var(--hero-text)' }}
        >
          {isEs
            ? 'Compradores de Oro, Plata y Joyería en Naples'
            : 'Naples Premier Gold, Sterling & Jewelry Buyers'}
        </h1>
      </div>

      {/* Sign-up + actions — centered in the open space below the pieces */}
      <div className="home-hero-bottom">
        <div className="flex w-full justify-center px-2" style={{ pointerEvents: 'auto' }}>
          <HomeSubscriberForm locale={locale} />
        </div>
        <div
          className="home-hero-actions flex flex-wrap justify-center gap-4 md:gap-5"
          style={{ pointerEvents: 'auto' }}
        >
          {buttons.map(({ href, label }) => (
            <Link
              key={label}
              href={href}
              className="hero-cta inline-flex justify-center min-w-[9rem] md:min-w-[10rem] border px-8 py-2.5 rounded-full text-xs font-bold uppercase tracking-widest"
              style={{
                background: 'var(--hero-btn-bg)',
                borderColor: 'var(--hero-btn-border)',
                color: 'var(--hero-btn-color)',
                fontFamily: 'var(--font-label)',
                boxShadow: '0 0 18px rgba(212,175,55,0.12)',
                backdropFilter: 'blur(3px)',
              }}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>

      <style>{`
        /* The overlay is a pinned, click-transparent layer over the slideshow
           panes; the form and CTA wrappers opt back into pointer events. */
        .home-hero-overlay {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }

        .home-hero-overlay .home-hero-top,
        .home-hero-overlay .home-hero-bottom {
          opacity: 0;
        }

        .home-hero-overlay.is-ready .home-hero-top {
          animation: home-hero-top-fade-in 720ms cubic-bezier(0.2, 0.8, 0.2, 1) 80ms both;
        }

        .home-hero-overlay.is-ready .home-hero-bottom {
          animation: home-hero-bottom-fade-in 720ms cubic-bezier(0.2, 0.8, 0.2, 1) 500ms both;
        }

        @keyframes home-hero-top-fade-in {
          from {
            opacity: 0;
            filter: blur(6px);
            transform: translateX(-50%) translateY(14px);
          }
          to {
            opacity: 1;
            filter: blur(0);
            transform: translateX(-50%) translateY(0);
          }
        }

        @keyframes home-hero-bottom-fade-in {
          from {
            opacity: 0;
            filter: blur(6px);
            transform: translateX(-50%) translateY(18px);
          }
          to {
            opacity: 1;
            filter: blur(0);
            transform: translateX(-50%) translateY(0);
          }
        }

        /* Top halo layers (cross-faded via inline opacity) */
        .home-top-fade {
          position: absolute;
          inset: 0;
          z-index: 4;
          pointer-events: none;
          transition: opacity 0.8s ease;
        }
        .home-top-fade--light {
          background:
            radial-gradient(ellipse 80% 55% at 50% 0%,
              rgba(255, 253, 247, 0.65) 0%, rgba(255, 253, 247, 0.25) 60%, transparent 100%),
            linear-gradient(to bottom, rgba(255, 253, 247, 0.35) 0%, transparent 45%);
        }
        .home-top-fade--dark {
          background:
            radial-gradient(ellipse 80% 55% at 50% 0%,
              rgba(5, 5, 5, 0.65) 0%, rgba(5, 5, 5, 0.25) 60%, transparent 100%),
            linear-gradient(to bottom, rgba(5, 5, 5, 0.35) 0%, transparent 45%);
        }

        /* Headline block — centered within the TOP HALF of the hero. */
        .home-hero-top {
          position: absolute;
          left: 50%;
          top: 0;
          height: 50%;
          /* 72rem (1152px), not the 52rem the sign-up block below still uses.
             Measured 2026-08-16: the 46-character headline needs 1152px to fall
             from three lines to two at the 5.75rem type cap — 1024px and 1100px
             are both still three. Widening buys a line back on desktop and
             nothing else: below roughly 1250px the 92vw term binds first, so
             phones and tablets are completely unaffected.

             ⚠️ Deliberately NOT applied to .home-hero-bottom. That block holds
             the subscriber form and the Buy/Sell/Trade buttons, and stretching
             an input row to 1152px makes it worse, not better. The two blocks
             being different widths is intended. */
          width: min(92vw, 72rem);
          transform: translateX(-50%);
          z-index: 5;
          pointer-events: none;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 0 1rem;
        }

        /* Sign-up + actions — centered in the open space BELOW the pieces. */
        .home-hero-bottom {
          position: absolute;
          left: 50%;
          bottom: clamp(5rem, 15svh, 10rem);
          width: min(92vw, 52rem);
          transform: translateX(-50%);
          z-index: 5;
          pointer-events: none;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1.5rem;
        }

        /* Smooth color cross-fade in sync with the background */
        .home-hero-top span,
        .home-hero-top h1 {
          transition: color 0.8s ease, text-shadow 0.8s ease;
        }
        .hero-cta {
          transition: background 0.8s ease, border-color 0.8s ease, color 0.8s ease, scale 0.2s ease;
        }
        .hero-cta:hover { scale: 1.04; }

        .home-hero-top > span {
          margin-bottom: 1.25rem;
        }

        .home-hero-top h1 {
          font-size: clamp(2.4rem, 8vw, 5.75rem);
          /* 1.15, not the 0.95 this used to be. 0.95 advances the baseline LESS
             than the font's own ink needs, so on a two-line headline the
             descenders of line 1 collided with the ascenders of line 2 — the
             "p" of "Naples" landed on the "i" of "Sterling" (owner spotted it).

             Measured at the 5.75rem cap (92px): line 2 needs 77px of ascender
             and line 1 drops a 23px descender = 100px of ink, against an 87.4px
             advance — a 12.6px overlap. Anything below 1.09 still collides;
             1.1 clears by only 1.2px, which a font-fallback swap could erase.
             ⚠️ Do not tighten this back below ~1.1 without re-measuring the ink,
             and note the ratio applies at EVERY size, so the collision existed
             on phones too, just less visibly. */
          line-height: 1.15;
          margin: 0;
          text-shadow: 0 2px 24px rgba(var(--hero-fade), 0.9);
        }

        @media (max-width: 640px) {
          /* Headline near the top (nudged down a touch). */
          .home-hero-top {
            top: clamp(3rem, 11svh, 6rem);
            height: auto;
            justify-content: flex-start;
          }

          .home-hero-top > span {
            margin-bottom: 0.6rem;
          }

          .home-hero-top h1 {
            font-size: clamp(1.9rem, 7vw, 2.5rem);
          }

          /* Sign-up + actions anchored to the bottom of the hero so the Trade
             button always stays inside it (with a small gap before the next
             section) regardless of viewport height / browser-chrome changes. */
          .home-hero-bottom {
            top: auto;
            bottom: clamp(1rem, 3svh, 2rem);
            gap: 0.85rem;
          }

          /* Two up, one down — STRUCTURAL, not a side effect of what fits.
             As a wrapping flex row this was two-plus-one only while two 9rem
             buttons plus the 1rem gap fitted the line; below about 336px of
             row width that failed and all three silently became separate
             rows (measured: 294px of row at a 320px viewport against the
             304px the pair needed). A two-column grid decides the count up
             front, so the narrowest phone gets the same arrangement as a
             wide one. */
          .home-hero-actions {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 0.75rem;
            /* Capped so the columns land on the same 9rem the buttons already
               used, rather than stretching to fill a 640px viewport. */
            width: min(100%, 18.75rem);
            margin-inline: auto;
          }

          /* The grid track owns the width now. Without this the 9rem minimum
             would overflow its column on a narrow phone instead of shrinking. */
          .home-hero-actions .hero-cta {
            min-width: 0;
            padding-inline: 0.75rem;
          }

          /* The odd button spans both tracks and centres at ONE track's width
             (50% of the full span, less half the gap), so it sits directly
             under the pair at matching width rather than stretching double. */
          .home-hero-actions .hero-cta:last-child {
            grid-column: 1 / -1;
            justify-self: center;
            width: calc(50% - 0.375rem);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .home-hero-overlay .home-hero-top,
          .home-hero-overlay .home-hero-bottom {
            opacity: 1;
            filter: none;
            animation: none !important;
            transform: translateX(-50%);
          }
        }
      `}</style>
    </div>
  );
}
