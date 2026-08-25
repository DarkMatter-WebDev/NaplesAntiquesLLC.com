'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

const REVEAL_SELECTOR = [
  'main > section',
  'main > article',
  'main > div',
  'main section',
  'main article',
  'main form',
  'main aside',
  'main nav',
  'main [class*="card"]',
  'main [class*="panel"]',
  'main [class*="tile"]',
  'main [class*="hero"]',
  'footer',
].join(',');

const EXCLUDE_SELECTOR = [
  '[data-customer-reveal-skip]',
  '[data-customer-reveal-root] header',
  '.shop-card-reveal',
  '.shop-card-reveal *',
  '.shop-list-row',
  '.shop-list-row *',
  '.shop-entry-reveal',
  '.shop-entry-reveal *',
  '.site-loading-screen',
  '.app-icon',
  'script',
  'style',
  'noscript',
].join(',');

const BACKGROUND_URL_PATTERN = /url\((?:"([^"]+)"|'([^']+)'|([^)"']+))\)/g;
const REVEAL_MEDIA_TIMEOUT_MS = 1400;

function backgroundUrlsFor(element: Element) {
  const urls = new Set<string>();
  const nodes = [element, ...Array.from(element.querySelectorAll('*'))];

  nodes.slice(0, 80).forEach((node) => {
    const backgroundImage = window.getComputedStyle(node).backgroundImage;
    for (const match of backgroundImage.matchAll(BACKGROUND_URL_PATTERN)) {
      const url = match[1] ?? match[2] ?? match[3];
      if (url && !url.startsWith('data:')) urls.add(url.trim());
    }
  });

  return Array.from(urls);
}

function waitForImage(image: HTMLImageElement) {
  if (image.complete) return Promise.resolve();

  return new Promise<void>((resolve) => {
    const done = () => {
      image.removeEventListener('load', done);
      image.removeEventListener('error', done);
      resolve();
    };

    image.addEventListener('load', done, { once: true });
    image.addEventListener('error', done, { once: true });
  });
}

function waitForBackground(url: string) {
  return new Promise<void>((resolve) => {
    const image = new Image();
    image.onload = () => resolve();
    image.onerror = () => resolve();
    image.src = url;
  });
}

function revealElement(element: HTMLElement, index: number) {
  // 'done' must be in this guard: the MutationObserver re-runs the sweep, and
  // without it every settled element would be re-stamped 'pending' (opacity 0)
  // and vanish.
  if (
    element.dataset.customerReveal === 'pending' ||
    element.dataset.customerReveal === 'visible' ||
    element.dataset.customerReveal === 'done'
  ) {
    return;
  }

  const delayMs = Math.min(index, 7) * 70;
  element.dataset.customerReveal = 'pending';
  element.style.setProperty('--customer-reveal-delay', `${delayMs}ms`);

  // Lazy images are intentionally allowed to remain offscreen and unloaded.
  // Waiting for them here can hide an otherwise ready page indefinitely (for
  // example, a horizontally scrollable product thumbnail gallery on mobile).
  const imagePromises = Array.from(element.querySelectorAll('img'))
    .filter((image) => image.loading !== 'lazy')
    .map(waitForImage);
  const backgroundPromises = backgroundUrlsFor(element).map(waitForBackground);
  const fontsReady = 'fonts' in document ? document.fonts.ready.catch(() => undefined) : Promise.resolve();
  let hasRevealed = false;
  let settleTimer: number | undefined;

  const commitReveal = () => {
    element.dataset.customerReveal = 'visible';

    // Release the reveal's compositor hint once the transition has finished.
    // 'visible' carries `will-change: opacity, transform, filter` (globals.css)
    // — needed DURING the 620ms transition, but left on forever it pinned every
    // revealed element as a compositor layer for the life of the page, which is
    // real GPU memory pressure on weak machines (found in the 2026-08-24 weak-GPU
    // hero audit). 'done' has NO CSS rules on purpose: natural styles are
    // visually identical to the transition's end state (opacity 1, no transform,
    // no blur), so the swap is invisible. A timeout rather than `transitionend`
    // because the transition can be skipped entirely (hidden document commits
    // immediately; reduced-motion forces transition: none) and the settle must
    // still happen. 620ms matches the CSS duration — keep them in step.
    if (settleTimer === undefined) {
      settleTimer = window.setTimeout(() => {
        if (element.dataset.customerReveal === 'visible') {
          element.dataset.customerReveal = 'done';
        }
      }, delayMs + 620 + 180);
    }
  };

  const reveal = () => {
    if (hasRevealed) return;
    hasRevealed = true;

    // Hidden documents suspend requestAnimationFrame indefinitely (background
    // tabs, prerendering, non-compositing webviews), and pending content also
    // blocks pointer events, so the frame-aligned flip must never be the only
    // path to visibility. Commit immediately while hidden; while visible, keep
    // the frame-aligned flip with a bounded idempotent backstop.
    if (document.visibilityState === 'hidden') {
      commitReveal();
      return;
    }

    window.requestAnimationFrame(commitReveal);
    window.setTimeout(commitReveal, 500);
  };

  // A decorative animation may delay content briefly, but must never become a
  // permanent visibility gate when a network resource is slow or unavailable.
  const fallbackTimer = window.setTimeout(reveal, REVEAL_MEDIA_TIMEOUT_MS);

  Promise.allSettled([...imagePromises, ...backgroundPromises, fontsReady]).then(() => {
    window.clearTimeout(fallbackTimer);
    reveal();
  });
}

function collectRevealElements(root: HTMLElement) {
  const candidates = Array.from(root.querySelectorAll<HTMLElement>(REVEAL_SELECTOR));
  const seen = new Set<HTMLElement>();

  return candidates.filter((element) => {
    if (seen.has(element) || element.closest(EXCLUDE_SELECTOR)) return false;
    // Shop catalog views carry dozens of lazy-loaded product images. Waiting on
    // all of them before revealing a parent wrapper leaves list view stuck at
    // opacity:0 (gallery is already skipped via .shop-product-grid). The shop
    // page runs its own entry animation via .shop-entry-reveal / .shop-card-reveal.
    if (element.querySelector('.shop-product-grid, .shop-product-list')) return false;
    if (element.querySelectorAll('img').length > 40) return false;
    if (element.offsetParent === null && window.getComputedStyle(element).position !== 'fixed') return false;
    seen.add(element);
    return true;
  });
}

export default function CustomerReveal() {
  const pathname = usePathname();

  useEffect(() => {
    const root = document.querySelector<HTMLElement>('[data-customer-reveal-root]');
    if (!root) return;

    const normalizedPathname = pathname.replace(/^\/(?:en|es)(?=\/|$)/, '') || '/';
    const isAdminRoute = normalizedPathname === '/admin' || normalizedPathname.startsWith('/admin/');

    if (isAdminRoute) {
      root.classList.remove('customer-reveal-enabled');
      root.querySelectorAll<HTMLElement>('[data-customer-reveal]').forEach((element) => {
        element.removeAttribute('data-customer-reveal');
        element.style.removeProperty('--customer-reveal-delay');
      });
      return;
    }

    const runReveal = () => {
      root.classList.add('customer-reveal-enabled');
      collectRevealElements(root).forEach((element, index) => {
        revealElement(element, index);
      });
    };

    const observer = new MutationObserver(() => {
      window.requestAnimationFrame(runReveal);
    });

    let timer: number | undefined;
    const startReveal = () => {
      timer = window.setTimeout(() => {
        runReveal();
        observer.observe(root, { childList: true, subtree: true });
      }, 80);
    };

    if (document.readyState === 'complete') {
      startReveal();
    } else {
      window.addEventListener('load', startReveal, { once: true });
    }

    return () => {
      window.removeEventListener('load', startReveal);
      if (timer) window.clearTimeout(timer);
      observer.disconnect();
    };
  }, [pathname]);

  return null;
}
