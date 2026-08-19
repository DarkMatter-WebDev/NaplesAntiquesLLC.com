'use client';

import { useEffect } from 'react';
import { onLayoutAffectingResize } from '@/lib/viewport-resize';

/**
 * Keeps `--app-vh` — the STABLE viewport height — up to date.
 *
 * WHY A JS TOKEN AND NOT `svh`
 * ---------------------------
 * Because `svh` does not do what its spec promises in the one environment this
 * exists for. Measured 2026-08-18 in Instagram's iOS in-app browser, on the
 * live site:
 *
 * | reading | value |
 * | --- | --- |
 * | `vh` / `svh` / `dvh` probes | **all three identical**, and all three moved |
 * | `innerHeight` | swung **729 ↔ 853** — a 124px chrome travel |
 * | homepage document height | moved **423px** |
 *
 * Instagram resizes the WKWebView natively rather than retracting browser
 * chrome, so WebKit sees a plain window resize: there is no "small" versus
 * "large" viewport to distinguish, the three unit families collapse into one
 * number, and that number tracks the toolbar. `svh` is therefore no more stable
 * than `dvh` there, which is exactly the assumption the 2026-08-11 batch was
 * built on.
 *
 * The 423px is the homepage hero, and the arithmetic closes: its runway is
 * `(100svh - header) + 240svh`, i.e. **3.4 × svh**, so a 124px chrome swing
 * becomes 3.4 × 124 = **421.6px** of document height against 423px measured.
 * The page height changing under a scroll IS the jump.
 *
 * HOW IT WORKS
 * ------------
 * An inline script in `[locale]/layout.tsx` writes `--app-vh` before first
 * paint, so there is no flash and no hydration shift. This component then
 * refreshes it ONLY through `onLayoutAffectingResize`, which fires on a width
 * change or a height change beyond 160px — comfortably above the 124px measured
 * here, so toolbar movement can never move the token, while a rotation or a
 * genuine window resize still does.
 *
 * ⚠️ The value is deliberately whatever the viewport was at load. Freezing it
 * is the entire point; a token that tracked the viewport would just be `dvh`
 * with extra steps.
 *
 * ⚠️ `globals.css` defines `--app-vh: 100svh` as the no-JS fallback, which is
 * correct everywhere `svh` behaves per spec. Do not "simplify" a
 * `var(--app-vh)` back to `100svh`.
 */
export default function ViewportHeightToken() {
  useEffect(() => {
    const apply = () => {
      document.documentElement.style.setProperty('--app-vh', `${window.innerHeight}px`);
    };

    // The inline script already ran; re-apply once in case hydration happened
    // after an orientation change, then follow only real layout changes.
    apply();
    return onLayoutAffectingResize(apply);
  }, []);

  return null;
}
