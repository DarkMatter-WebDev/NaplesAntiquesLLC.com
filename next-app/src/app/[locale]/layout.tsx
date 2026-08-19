import { Suspense } from 'react';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { caslon, hanken } from '@/lib/fonts';
import { WishlistProvider } from '@/context/WishlistContext';
import { CartProvider } from '@/context/CartContext';
import CookieNotice from '@/components/legal/CookieNotice';
import CustomerReveal from '@/components/layout/CustomerReveal';
import SocialBackgroundPublishProvider from '@/components/admin/SocialBackgroundPublishProvider';
import RouteProgressBar from '@/components/layout/RouteProgressBar';
// TEMPORARY (2026-08-18): diagnostic for the in-app-browser viewport jump.
// Renders null unless the URL carries `?vpdebug=1`. Remove this import, its
// mount below, and the component itself once the jump is understood and fixed.
import ViewportDebugOverlay from '@/components/layout/ViewportDebugOverlay';
import ViewportHeightToken from '@/components/layout/ViewportHeightToken';
import { jsonLdHtml } from '@/lib/json-ld';
import { GEO, mapsUrl, openingHoursSchema, postalAddressSchema } from '@/lib/business-location';

interface Props {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

// This layout owns <html>/<head>/<body> so `lang` reflects the active locale.
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'JewelryStore',
  '@id': 'https://naplesestatejewelry.com/#business',
  name: 'Naples Estate Jewelry',
  alternateName: ['Naples Jewelry Buyers', 'Naples Gold & Silver Buyer'],
  url: 'https://naplesestatejewelry.com',
  telephone: '+12394048505',
  // The public contact mailbox moved to .com (owner, 2026-08-08), so the
  // address customers see now matches the domain they are on. This is the
  // INBOUND address and is only correct while `info@naplesestatejewelry.com`
  // actually receives mail in Google Workspace — the .com root MX points at
  // Workspace, but the mailbox/alias must exist there or inquiries bounce.
  email: 'info@naplesestatejewelry.com',
  image: 'https://naplesestatejewelry.com/assets/images/pages/trust.webp',
  logo: 'https://naplesestatejewelry.com/assets/images/branding/logo.webp',
  description:
    'Naples, FL gold, jewelry, and sterling silver buyer paying top dollar for estate jewelry, gold, silver, diamonds, coins, watches, and full estates. Showroom at 6240 Shirley St, Ste 104, open Tuesday to Saturday, with home evaluations on request across Southwest Florida.',
  // Real street address as of 2026-08-17 (showroom open). Sourced from
  // lib/business-location.ts so the schema, the footer, checkout and the
  // pickup receipt cannot drift apart — NAP consistency is a ranking factor.
  address: postalAddressSchema(),
  // `geo` is emitted ONLY when real coordinates exist. It previously carried
  // 26.142/-81.795, the Naples-downtown approximation, which is 5.6 miles from
  // Shirley St — a pin that contradicted the street address in this same
  // block. Omitting it is strictly better than shipping a wrong one; see the
  // note on GEO in lib/business-location.ts for how to fill it in.
  ...(GEO ? { geo: { '@type': 'GeoCoordinates', ...GEO } } : {}),
  hasMap: mapsUrl(),
  // ⚠️ Tue-Sat 11:00-15:00. Claimed Mon-Sat 10:00-17:00 until 2026-08-17, which
  // was never true of the showroom. Must stay identical to the Google Business
  // Profile: Google compares them once the profile is verified.
  openingHoursSpecification: openingHoursSchema(),
  priceRange: '$$',
  currenciesAccepted: 'USD',
  paymentAccepted: 'Cash, Check, Wire Transfer, PayPal, Credit Card, Debit Card',
  // Related domains + profiles help Google consolidate this business entity.
  // naplesestatejewelry.com is now the primary domain (owner bought it,
  // confirmed 2026-08-01 — superseding the 2026-07-11 parked-page note). The
  // legacy .co apex 301-redirects here, so it is not listed in sameAs.
  sameAs: [
    'https://naplesjewelrybuyers.com',
  ],
  areaServed: [
    'Naples, FL', 'Marco Island, FL', 'Bonita Springs, FL',
    'Estero, FL', 'Fort Myers, FL', 'Cape Coral, FL',
  ].map((name) => ({ '@type': 'City', name })),
  knowsAbout: [
    'Selling gold', 'Selling estate jewelry', 'Selling sterling silver',
    'Selling diamonds', 'Selling coins and bullion', 'Selling luxury watches',
  ],
  makesOffer: [
    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Gold buying — we buy gold jewelry, coins, and bullion' } },
    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Estate jewelry buying — we buy fine and designer jewelry' } },
    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Sterling silver buying — we buy silver flatware, holloware, and jewelry' } },
    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Diamond, coin, and watch buying' } },
  ],
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      className={`${caslon.variable} ${hanken.variable}`}
      // The page background, INLINE on the root element, duplicating
      // `body { background-color: var(--color-background) }` in globals.css.
      //
      // Not redundant: an external stylesheet is render-blocking, so until it
      // arrives the browser paints the canvas with its own default — pure
      // WHITE. That is the blank screen a first-time visitor on a slow
      // connection stares at. An inline style attribute is applied by the
      // parser from the first bytes of HTML, with no stylesheet needed, so the
      // canvas starts as the brand off-white instead.
      //
      // Keep this value in sync with `--color-background` (#f9f9f7).
      style={{ backgroundColor: '#f9f9f7' }}
    >
      <head>
        {/* Critical splash styles, inlined so the homepage boot splash is
            painted the instant the browser has parsed this <head> — it does not
            wait on the 21KB stylesheet, which on a slow first visit is the
            single thing standing between the visitor and any pixel at all.
            The full rules still live in globals.css; this is the minimum needed
            to make the splash legible, and the stylesheet refines it. */}
        <style
          dangerouslySetInnerHTML={{
            __html: `.home-boot-splash{position:fixed;inset:0;z-index:100;display:grid;place-items:center;padding:2rem 1rem;background:linear-gradient(145deg,#080806 0%,#17120a 48%,#030303 100%);color:#fff8e6;text-align:center;font-family:var(--font-caslon),Georgia,serif}.home-boot-splash .site-loading-eyebrow{font-size:.72rem;letter-spacing:.28em;text-transform:uppercase;color:rgba(255,248,230,.66)}.home-boot-splash .home-boot-splash-title{font-size:clamp(1.55rem,8vw,4.1rem);line-height:.98;margin:.4rem 0 0}.home-boot-splash .site-loading-copy{margin:.35rem 0 0;font-size:clamp(.9rem,3vw,1.05rem);color:rgba(255,248,230,.72)}`,
          }}
        />
        {/* `--app-vh`, written before first paint.
            Everything sized to the viewport reads this token instead of `svh`,
            because `svh` is NOT stable in an in-app browser: measured
            2026-08-18 in Instagram's iOS webview, `vh`/`svh`/`dvh` all resolve
            to the SAME value and all three track the chrome (innerHeight
            729<->853). See `ViewportHeightToken` for the full measurement.

            Inline and synchronous on purpose. Setting this after hydration
            would let the page lay out at the CSS fallback first and jump when
            the token landed — reintroducing, at load, the exact class of shift
            this removes during scroll. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{document.documentElement.style.setProperty('--app-vh',window.innerHeight+'px')}catch(e){}`,
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdHtml(jsonLd) }}
        />
      </head>
      {/* `min-h-[var(--app-vh)]`, NOT `min-h-screen` and no longer `min-h-svh`.
          Two corrections, a few hours apart on 2026-08-18, and the second
          supersedes the first:

          1. Tailwind's `min-h-screen` compiles to `min-height: 100vh`. On
             mobile `100vh` is the LARGE viewport, so every page shorter than
             the screen carried about one toolbar-height of phantom scroll —
             enough travel to trigger hide-on-scroll, which grows the viewport,
             which removes the need to scroll, which brings the toolbar back.
             That was real, and the 2026-08-11 svh sweep could not see it
             because the alias contains no unit literal.
          2. `min-h-svh` did not fix it, because **`svh` is not stable in an
             in-app browser.** Measured in Instagram's iOS webview on the live
             site: `vh`, `svh` and `dvh` all resolve to the SAME value and all
             three track the chrome (innerHeight 729<->853). Instagram resizes
             the webview natively, so WebKit sees a plain window resize and has
             no small-vs-large viewport to distinguish.

          `--app-vh` is written before first paint by the inline script above
          and refreshed only through `onLayoutAffectingResize`, so toolbar
          movement cannot touch it. See `ViewportHeightToken`.

          ℹ️ The cosmetic trade the owner accepted for `svh` still applies and is
          unchanged: on a page SHORTER than the screen with the toolbar hidden,
          a thin strip of page background shows below the footer's `#f3f3f3`. */}
      <body className="min-h-[var(--app-vh)] flex flex-col">
        <NextIntlClientProvider locale={locale} messages={messages}>
          {/* CartProvider must wrap WishlistProvider: WishlistDrawer (rendered by
              WishlistProvider) has an Add to Cart button that calls useCart(), so it
              needs a CartContext ancestor. CartDrawer has no reverse dependency on
              WishlistContext, so this order is safe. */}
          {/* Outside the providers: it depends on nothing but the current URL,
              and renders null except while a navigation is in flight.

              ⚠️ The Suspense boundary is REQUIRED, not decorative. The bar reads
              `useSearchParams` (a shop filter changes only the query, so that is
              the only way it can tell when such a navigation has landed), and
              calling that hook client-renders the tree up to the nearest
              boundary. Without this wrapper that tree is the whole app and every
              static page would deopt; with it, containment is exactly the bar,
              which renders null anyway. Removing it silently costs 454 prerendered
              pages. */}
          <Suspense fallback={null}>
            <RouteProgressBar />
          </Suspense>
          {/* TEMPORARY diagnostic — see the import note. Deliberately NOT inside
              a Suspense boundary and deliberately NOT using `useSearchParams`:
              it reads `window.location.search` in an effect instead, so it
              cannot deopt the 454 prerendered pages the way the bar above
              could. */}
          <ViewportHeightToken />
          <ViewportDebugOverlay />
          <CartProvider locale={locale}>
            <WishlistProvider locale={locale}>
              <SocialBackgroundPublishProvider>
                <div data-customer-reveal-root className="contents">
                  {children}
                  <CustomerReveal />
                </div>
              </SocialBackgroundPublishProvider>
              <CookieNotice locale={locale} />
            </WishlistProvider>
          </CartProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
