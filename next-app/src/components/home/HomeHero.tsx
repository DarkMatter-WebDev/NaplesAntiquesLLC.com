'use client';

// Home hero: the 3D carousel as a full-bleed background. Photos are grouped
// into a white arc and a black arc, so the ring has two clean seams. As a seam
// rotates toward the front, the hero background sweeps (a horizontal gradient
// driven every frame) so the incoming color leads the incoming photo while the
// outgoing color fades off the far side. The headline text theme flips to match
// whichever color is centered behind it.

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Carousel } from '../../../carousel/components/Carousel';
import {
  fetchSelectedItems,
  fetchSettings,
  type CarouselItem,
  type CarouselSettings,
} from '../../../carousel/lib/carouselData';
import { DEFAULT_BG, DEFAULT_VISIBLE_COUNT } from '../../../carousel/lib/carouselConfig';
import HomeSubscriberForm from './HomeSubscriberForm';

type Props = {
  locale: string;
  fallbackItems: CarouselItem[];
};

const FALLBACK_SETTINGS: CarouselSettings = {
  showPrice: false,
  bgColor: DEFAULT_BG,
  visibleCountDesktop: DEFAULT_VISIBLE_COUNT,
  visibleCountMobile: 4,
};

// Matches the carousel's mobile breakpoint in the <style> below.
const MOBILE_QUERY = '(max-width: 640px)';

function isDarkBackground(bgColor: string): boolean {
  const n = bgColor.trim().toLowerCase();
  return n === '#000' || n === '#000000' || n === 'black';
}

function withLocaleHref(item: CarouselItem, locale: string): CarouselItem {
  if (locale !== 'es' || !item.href || item.href.startsWith('/es/')) return item;
  return { ...item, href: `/es${item.href}` };
}

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

export default function HomeHero({ locale, fallbackItems }: Props) {
  const isEs = locale === 'es';
  const storeHref = isEs ? '/es/shop' : '/shop';

  const sectionRef = useRef<HTMLElement>(null);
  const [selectedItems, setSelectedItems] = useState<CarouselItem[]>([]);
  const [settings, setSettings] = useState<CarouselSettings>(FALLBACK_SETTINGS);
  const [carouselDataSettled, setCarouselDataSettled] = useState(false);
  const [heroReady, setHeroReady] = useState(false);
  // Only the text theme lives in React state (it flips rarely); the background
  // is set imperatively every frame to avoid a re-render per frame.
  const [dark, setDark] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([fetchSelectedItems(), fetchSettings()]).then(
      ([itemsResult, settingsResult]) => {
        if (cancelled) return;
        if (itemsResult.status === 'fulfilled') setSelectedItems(itemsResult.value);
        // Only the price flag comes from settings now; each photo carries its
        // own background (white or black group).
        if (settingsResult.status === 'fulfilled') setSettings(settingsResult.value);
        setCarouselDataSettled(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  // Seed the section background before the first frame so there's no flash.
  useEffect(() => {
    if (sectionRef.current) sectionRef.current.style.background = DEFAULT_BG;
  }, []);

  // Track the mobile breakpoint so we can use a different ring size on phones.
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  const visibleCount = isMobile ? settings.visibleCountMobile : settings.visibleCountDesktop;

  const items = selectedItems.length > 0 ? selectedItems : fallbackItems;
  // Render in the admin's curated order (position). The background sweep follows
  // each photo's own bg color as it reaches the front.
  const localizedItems = useMemo(
    () => items.map((item) => withLocaleHref(item, locale)),
    [items, locale],
  );

  useEffect(() => {
    if (!carouselDataSettled) return;

    let cancelled = false;

    const visibleImages = localizedItems
      .slice(0, Math.max(1, visibleCount))
      .map((item) => item.imageUrl)
      .filter(Boolean);

    const imagePromises = visibleImages.map(
      (src) =>
        new Promise<void>((resolve) => {
          const image = new window.Image();
          image.onload = () => resolve();
          image.onerror = () => resolve();
          image.src = src;
        }),
    );
    const fontsReady = 'fonts' in document ? document.fonts.ready.catch(() => undefined) : Promise.resolve();

    Promise.allSettled([...imagePromises, fontsReady]).then(() => {
      if (cancelled) return;
      window.requestAnimationFrame(() => {
        if (!cancelled) setHeroReady(true);
      });
    });

    return () => {
      cancelled = true;
    };
  }, [carouselDataSettled, localizedItems, visibleCount]);

  // Flip the text theme to match the photo centered behind the headline.
  const handleFrontItem = useCallback(
    (item: CarouselItem) => setDark(isDarkBackground(item.bgColor || DEFAULT_BG)),
    [],
  );

  // Paint the swept background imperatively (no re-render).
  const handleBackgroundChange = useCallback((css: string) => {
    if (sectionRef.current) sectionRef.current.style.background = css;
  }, []);

  const theme = dark ? DARK_THEME : LIGHT_THEME;

  const buttons = [
    { href: storeHref, label: isEs ? 'Comprar' : 'Buy' },
    { href: isEs ? '/es/estate-jewelry' : '/estate-jewelry', label: isEs ? 'Vender' : 'Sell' },
    { href: isEs ? '/es/contact' : '/contact', label: isEs ? 'Intercambiar' : 'Trade' },
  ];

  return (
    <section
      ref={sectionRef}
      className={`home-carousel-hero relative overflow-hidden border-b ${heroReady ? 'is-ready' : ''}`}
      style={{ borderColor: 'rgba(220, 179, 54, 0.22)', ...theme }}
      data-customer-reveal-skip
    >
      {/* Carousel background */}
      <div className="home-carousel-theme">
        <Carousel
          items={localizedItems}
          showPrice={settings.showPrice}
          bg={DEFAULT_BG}
          cardWidth={15.5}
          perspective={35}
          visibleCount={visibleCount}
          onFrontItemChange={handleFrontItem}
          onBackgroundChange={handleBackgroundChange}
        />
      </div>

      {/* Top halo for text legibility — two layers cross-fade so the color
          change is smooth (gradients can't transition; opacity can). */}
      <div className="home-top-fade home-top-fade--light" style={{ opacity: dark ? 0 : 1 }} aria-hidden="true" />
      <div className="home-top-fade home-top-fade--dark" style={{ opacity: dark ? 1 : 0 }} aria-hidden="true" />

      {/* Headline — centered in the top half, above the rotating pieces */}
      <div className="home-hero-top">
        <span
          className="text-[0.75rem] font-bold uppercase tracking-[0.3em] block"
          style={{ color: 'var(--hero-eyebrow)', fontFamily: 'var(--font-label)' }}
        >
          {isEs ? 'Joyería de Patrimonio y Relojes' : 'Curated Estate Jewelry & Watches'}
        </span>
        <h1
          className="font-normal tracking-normal"
          style={{ fontFamily: 'var(--font-headline)', color: 'var(--hero-text)' }}
        >
          {isEs ? 'Rara. Auténtica. Atemporal.' : 'Rare. Authentic. Timeless.'}
        </h1>
      </div>

      {/* Sign-up + actions — centered in the open space below the pieces */}
      <div className="home-hero-bottom">
        <div className="flex w-full justify-center px-2" style={{ pointerEvents: 'auto' }}>
          <HomeSubscriberForm locale={locale} />
        </div>
        <div className="flex flex-wrap justify-center gap-4 md:gap-5" style={{ pointerEvents: 'auto' }}>
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
        .home-carousel-hero {
          min-height: calc(100svh - 4rem);
          /* Background is painted per-frame (a swept gradient) by the carousel,
             so no CSS transition here — it would lag the sweep. */
        }

        .home-carousel-theme,
        .home-hero-top,
        .home-hero-bottom {
          opacity: 0;
        }

        .home-carousel-hero.is-ready .home-carousel-theme {
          animation: home-carousel-fade-in 760ms ease 260ms both;
        }

        .home-carousel-hero.is-ready .home-hero-top {
          animation: home-hero-top-fade-in 720ms cubic-bezier(0.2, 0.8, 0.2, 1) 80ms both;
        }

        .home-carousel-hero.is-ready .home-hero-bottom {
          animation: home-hero-bottom-fade-in 720ms cubic-bezier(0.2, 0.8, 0.2, 1) 500ms both;
        }

        @keyframes home-carousel-fade-in {
          from {
            opacity: 0;
            filter: blur(8px);
          }
          to {
            opacity: 1;
            filter: blur(0);
          }
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

        /* Carousel scene: full height, transparent so the section color shows
           through, base scale. */
        .home-carousel-hero .home-carousel-theme > div:first-child {
          min-height: calc(100svh - 4rem);
          block-size: calc(100svh - 4rem);
          background: transparent !important;
          transform: scale(1.22);
          transform-origin: center center;
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
          width: min(92vw, 52rem);
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
          line-height: 0.95;
          margin: 0;
          text-shadow: 0 2px 24px rgba(var(--hero-fade), 0.9);
        }

        @media (min-width: 1024px) {
          .home-carousel-hero .home-carousel-theme > div:first-child {
            --cardW: clamp(26em, 29vw, 36em) !important;
            /* Larger perspective = less extreme foreshortening, so the side
               cards (the smallest ones) stay bigger and more legible. */
            --perspective: 34em !important;
            transform: scale(1.42);
          }
        }

        @media (max-width: 640px) {
          .home-carousel-hero .home-carousel-theme > div:first-child {
            --cardW: clamp(13em, 60vw, 18em) !important;
            --perspective: 30em !important;
            /* Pulled up and zoomed in a touch (scale 1.12 -> 1.14) so the
               focal item reads a little larger. */
            transform: translateY(-6svh) scale(1.14);
            transform-origin: center 55%;
          }

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
        }

        @media (prefers-reduced-motion: reduce) {
          .home-carousel-theme,
          .home-hero-top,
          .home-hero-bottom {
            opacity: 1;
            filter: none;
            animation: none !important;
          }

          .home-hero-top,
          .home-hero-bottom {
            transform: translateX(-50%);
          }
        }
      `}</style>
    </section>
  );
}
