'use client';

// Viewport pause for the testimonials marquee (2026-08-24).
//
// The marquee's movement is still pure CSS — that design rule stands (no
// per-frame JS for decoration; see the .testimonial-marquee comment in
// globals.css). What this island adds is the OFF switch: the track's infinite
// transform animation re-composites a masked, viewport-wide band on every
// frame even while the band is scrolled out of view, which is free on a good
// GPU and real waste on a weak one (2026-08-24 weak-GPU hero audit). An
// IntersectionObserver costs nothing per frame; it fires only when the band
// crosses the viewport edge, toggling `data-marquee-paused`, and CSS does the
// rest.
//
// The attribute is toggled imperatively (no state, no re-render), and it must
// stay an attribute + CSS rule rather than an inline
// `style.animationPlayState`: an inline 'running' would override the
// hover-pause and focus-within-pause rules in globals.css, which also use
// animation-play-state.
//
// The cards arrive as server-rendered children, so none of their content joins
// the client bundle.

import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';

type Props = {
  /** Carries --testimonial-marquee-duration, derived from the card count. */
  trackStyle: CSSProperties;
  children: ReactNode;
};

export default function TestimonialMarqueeBand({ trackStyle, children }: Props) {
  const bandRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const band = bandRef.current;
    if (!band) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        // Real intersected area, not `isIntersecting` — the boolean is true
        // for zero-area grazes (the hero-pane pause bug, CHANGELOG 2026-08-06).
        const { width, height } = entry.intersectionRect;
        if (width > 0 && height > 0) delete band.dataset.marqueePaused;
        else band.dataset.marqueePaused = '';
      },
      // Resume a beat before the band actually enters, so it is already
      // moving when it scrolls into view rather than starting with a jerk.
      { rootMargin: '96px 0px' },
    );
    io.observe(band);
    return () => io.disconnect();
  }, []);

  return (
    // Class names and data-customer-reveal-skip are load-bearing — this is the
    // same wrapper TestimonialsSection rendered inline before 2026-08-24; see
    // the comments there and in globals.css.
    <div ref={bandRef} className="testimonial-marquee" data-customer-reveal-skip>
      <div className="testimonial-marquee-track" style={trackStyle}>
        {children}
      </div>
    </div>
  );
}
