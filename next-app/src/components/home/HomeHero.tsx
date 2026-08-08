'use client';

// Hero slideshow pane: the 3D carousel as a full-bleed background. Photos are
// grouped into a white arc and a black arc, so the ring has two clean seams. As
// a seam rotates toward the front, the section background sweeps (a horizontal
// gradient driven every frame) so the incoming color leads the incoming photo
// while the outgoing color fades off the far side.
//
// This component is ONLY the slideshow (background + ring + loading spinner).
// The static headline / sign-up / CTA layer lives in HomeHeroOverlay, and
// HomeHeroStack composes two of these panes with one pinned overlay for the
// scroll parallax. Which color is centered behind the headline is reported
// outward via onThemeChange so the overlay can flip its text theme.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Carousel } from '../../../carousel/components/Carousel';
import {
  type CarouselItem,
  type CarouselSettings,
} from '../../../carousel/lib/carouselData';
import { DEFAULT_BG } from '../../../carousel/lib/carouselConfig';

type Props = {
  locale: string;
  initialItems: CarouselItem[];
  initialSettings: CarouselSettings;
  /**
   * Fires when the photo centered behind the headline changes between the
   * light and dark arc. Keep the handler stable (useCallback).
   */
  onThemeChange?: (dark: boolean) => void;
  /**
   * Spin the ring the opposite way (photos flow left-to-right across the
   * front). The stack sets this on slideshow B so the two slideshows move
   * against each other.
   */
  reverseSpin?: boolean;
  /**
   * Hard-pause this pane's carousel. `HomeHeroStack` knows exactly which panes
   * are offscreen (it applies the transforms), so it drives this rather than
   * leaving it to the carousel's own IntersectionObserver, which cannot detect
   * offscreen panes inside the pinned frame. See the `paused` prop on Carousel.
   */
  paused?: boolean;
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

export default function HomeHero({
  locale,
  initialItems,
  initialSettings,
  onThemeChange,
  reverseSpin = false,
  paused = false,
}: Props) {
  const sectionRef = useRef<HTMLElement>(null);
  const [heroReady, setHeroReady] = useState(false);

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
  const visibleCount = isMobile
    ? initialSettings.visibleCountMobile
    : initialSettings.visibleCountDesktop;

  // Render in the admin's curated order (position). The background sweep follows
  // each photo's own bg color as it reaches the front.
  const localizedItems = useMemo(
    () => initialItems.map((item) => withLocaleHref(item, locale)),
    [initialItems, locale],
  );

  useEffect(() => {
    let cancelled = false;
    let readyMarked = false;

    const markHeroReady = () => {
      if (cancelled || readyMarked) return;
      readyMarked = true;
      window.requestAnimationFrame(() => {
        if (!cancelled) setHeroReady(true);
      });
    };

    const fallbackTimer = window.setTimeout(markHeroReady, 1800);

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
      window.clearTimeout(fallbackTimer);
      markHeroReady();
    });

    return () => {
      cancelled = true;
      window.clearTimeout(fallbackTimer);
    };
  }, [localizedItems, visibleCount]);

  // Report the theme of the photo centered behind the headline.
  const handleFrontItem = useCallback(
    (item: CarouselItem) => onThemeChange?.(isDarkBackground(item.bgColor || DEFAULT_BG)),
    [onThemeChange],
  );

  // Paint the swept background imperatively (no re-render).
  const handleBackgroundChange = useCallback((css: string) => {
    if (sectionRef.current) sectionRef.current.style.background = css;
  }, []);

  return (
    <section
      ref={sectionRef}
      // No border here: the pane's edges travel through the pinned frame
      // during the parallax crossing, so the hero's bottom separator lives on
      // .home-hero-stack-frame instead of the slideshow section.
      className={`home-carousel-hero relative overflow-hidden ${heroReady ? 'is-ready' : ''}`}
      data-customer-reveal-skip
    >
      {/* Loading spinner — fills the blank spot while the carousel data/images
          settle, and fades out the instant heroReady flips (no minimum show
          time). Hidden outright under prefers-reduced-motion, where the
          content below is already forced to opacity 1 with no fade to wait
          for. */}
      <div className="home-hero-loading" aria-hidden="true">
        <span className="home-hero-spinner" />
      </div>

      {/* Carousel background */}
      <div className="home-carousel-theme">
        <Carousel
          items={localizedItems}
          showPrice={initialSettings.showPrice}
          bg={DEFAULT_BG}
          reverse={reverseSpin}
          paused={paused}
          cardWidth={15.5}
          perspective={35}
          visibleCount={visibleCount}
          onFrontItemChange={handleFrontItem}
          onBackgroundChange={handleBackgroundChange}
        />
      </div>

      <style>{`
        .home-carousel-hero {
          min-height: calc(100svh - var(--site-header-height));
          /* Background is painted per-frame (a swept gradient) by the carousel,
             so no CSS transition here — it would lag the sweep. */
        }

        .home-carousel-theme {
          opacity: 0;
        }

        .home-carousel-hero.is-ready .home-carousel-theme {
          animation: home-carousel-fade-in 760ms ease 260ms both;
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

        /* Loading spinner — centered over the whole hero, above the (still
           invisible) carousel layer. Fades out as soon as .is-ready is added;
           no artificial minimum display time. */
        .home-hero-loading {
          position: absolute;
          inset: 0;
          z-index: 6;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
          opacity: 1;
          transition: opacity 180ms ease;
        }
        .home-carousel-hero.is-ready .home-hero-loading {
          opacity: 0;
        }
        .home-hero-spinner {
          width: 4.5rem;
          height: 4.5rem;
          border-radius: 9999px;
          border: 5px solid rgba(139, 108, 6, 0.18);
          border-top-color: #b48200;
          animation: home-hero-spin 800ms linear infinite;
        }
        @keyframes home-hero-spin {
          to {
            transform: rotate(360deg);
          }
        }

        /* Carousel scene: full height, transparent so the section color shows
           through, base scale. */
        .home-carousel-hero .home-carousel-theme > div:first-child {
          min-height: calc(100svh - var(--site-header-height));
          block-size: calc(100svh - var(--site-header-height));
          background: transparent !important;
          transform: scale(1.22);
          transform-origin: center center;
        }

        @media (min-width: 1024px) {
          .home-carousel-hero .home-carousel-theme > div:first-child {
            --cardW: clamp(26em, 29vw, 36em) !important;
            /* Keep the far side of the ring in front of the perspective plane.
               At the old value, wide cards could land almost on that plane,
               producing enormous transformed hitboxes that covered neighbors.
               This keeps the projection comfortably away from the camera plane
               even at the maximum desktop card width. */
            --perspective: 70em !important;
            transform: scale(1.42);
          }
        }

        @media (max-width: 640px) {
          .home-carousel-hero .home-carousel-theme > div:first-child {
            --cardW: clamp(12em, 56vw, 17em) !important;
            --perspective: 30em !important;
            /* Lifted higher (translateY -6svh -> -12svh) and trimmed a touch
               (scale 1.14 -> 1.06) so the ring clears the "Get first look"
               sign-up block on short viewports instead of sitting behind it. */
            transform: translateY(-12svh) scale(1.06);
            transform-origin: center 50%;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .home-hero-loading {
            display: none;
          }

          .home-carousel-theme {
            opacity: 1;
            filter: none;
            animation: none !important;
          }
        }
      `}</style>
    </section>
  );
}
