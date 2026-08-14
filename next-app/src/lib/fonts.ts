import { Libre_Caslon_Text, Hanken_Grotesk } from 'next/font/google';

// Shared font instances so both the [locale] layout (which now owns <html> to set
// lang per locale) and the root not-found (which renders its own <html>) apply the
// same font CSS variables.
// ⚠️ PRELOADING IS A PRIORITY LANE, NOT A FREEBIE. Measured on production
// 2026-08-14: four preloaded font files (87KB) began at ~292ms and held the
// connection until 395ms, while the 21KB render-blocking stylesheet — the ONLY
// resource actually gating the first pixel — did not start until 336ms. The
// fonts were queue-jumping the thing the visitor was waiting for.
//
// The headline face KEEPS its preload: the homepage LCP element is the <h1>
// ("Rare. Authentic. Timeless."), so Caslon is genuinely on the critical path
// and preloading it is what stops that heading reflowing.
export const caslon = Libre_Caslon_Text({
  weight: ['400', '700'],
  style: ['normal', 'italic'],
  subsets: ['latin'],
  variable: '--font-caslon',
  display: 'swap',
});

// Body face: NOT preloaded. `display: swap` already renders every word
// immediately in the fallback and swaps when it arrives, so the only cost is a
// brief metric shift on body copy — paid in exchange for the stylesheet, and
// therefore the first pixel, arriving sooner for everyone on a slow connection.
export const hanken = Hanken_Grotesk({
  weight: ['300', '400', '500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-hanken',
  display: 'swap',
  preload: false,
});
