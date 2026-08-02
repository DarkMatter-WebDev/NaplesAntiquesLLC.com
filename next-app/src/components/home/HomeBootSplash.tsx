'use client';

import { useEffect, useState } from 'react';

// Branded splash that is server-rendered into the homepage HTML, so it paints on
// the very first frame — including cold mobile/tablet loads where the static page
// arrives before any JS runs and the route-level loading.tsx (a soft-navigation
// Suspense fallback) never shows. It fades out the moment the app hydrates; a CSS
// failsafe animation (see globals.css) also hides it if hydration is slow or never
// happens, so it can never get stuck over the page.
//
// Uses the same visuals as SiteLoadingScreen (the `site-loading-*` classes) for a
// consistent look, but renders a <div> (not a second <h1>/<main>) to avoid
// duplicate landmarks/headings on the homepage.
export default function HomeBootSplash() {
  const [hidden, setHidden] = useState(false);
  const [removed, setRemoved] = useState(false);

  useEffect(() => {
    // Hydrated — the real hero is live underneath. Begin the fade-out.
    const raf = requestAnimationFrame(() => setHidden(true));
    // Removal fallback: if the CSS transition never fires an end event (e.g.
    // prefers-reduced-motion disables it), drop the node after a short delay.
    const timer = window.setTimeout(() => setRemoved(true), 700);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
    };
  }, []);

  if (removed) return null;

  return (
    <div
      className={`site-loading-screen home-boot-splash${hidden ? ' is-hidden' : ''}`}
      aria-hidden="true"
      onTransitionEnd={() => setRemoved(true)}
    >
      <div className="site-loading-card">
        <div className="site-loading-wheel" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <p className="site-loading-eyebrow">Curated estate jewelry</p>
        <div className="home-boot-splash-title">
          NaplesEstate<wbr />Jewelry.com
        </div>
        <p className="site-loading-copy">Preparing your visit</p>
      </div>
    </div>
  );
}
