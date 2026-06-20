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
  '.site-loading-screen',
  '.material-symbols-outlined',
  'script',
  'style',
  'noscript',
].join(',');

const BACKGROUND_URL_PATTERN = /url\((?:"([^"]+)"|'([^']+)'|([^)"']+))\)/g;

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
  if (element.dataset.customerReveal === 'pending' || element.dataset.customerReveal === 'visible') return;

  element.dataset.customerReveal = 'pending';
  element.style.setProperty('--customer-reveal-delay', `${Math.min(index, 7) * 70}ms`);

  const imagePromises = Array.from(element.querySelectorAll('img')).map(waitForImage);
  const backgroundPromises = backgroundUrlsFor(element).map(waitForBackground);
  const fontsReady = 'fonts' in document ? document.fonts.ready.catch(() => undefined) : Promise.resolve();

  Promise.allSettled([...imagePromises, ...backgroundPromises, fontsReady]).then(() => {
    window.requestAnimationFrame(() => {
      element.dataset.customerReveal = 'visible';
    });
  });
}

function collectRevealElements(root: HTMLElement) {
  const candidates = Array.from(root.querySelectorAll<HTMLElement>(REVEAL_SELECTOR));
  const seen = new Set<HTMLElement>();

  return candidates.filter((element) => {
    if (seen.has(element) || element.closest(EXCLUDE_SELECTOR)) return false;
    if (element.querySelector('.shop-product-grid')) return false;
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
