import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { caslon, hanken } from '@/lib/fonts';
import { WishlistProvider } from '@/context/WishlistContext';
import { CartProvider } from '@/context/CartContext';
import CookieNotice from '@/components/legal/CookieNotice';
import CustomerReveal from '@/components/layout/CustomerReveal';
import { jsonLdHtml } from '@/lib/json-ld';

interface Props {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

// This layout owns <html>/<head>/<body> so `lang` reflects the active locale.
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'JewelryStore',
  name: 'Naples Estate Jewelry',
  url: 'https://naplesestatejewelry.co',
  telephone: '+12394048505',
  image: 'https://naplesestatejewelry.co/assets/images/pages/trust.webp',
  description:
    'Naples, FL estate jeweler buying and selling fine gold chains, estate pieces, designer jewelry, and bullion. Free on-site evaluations by appointment across Southwest Florida.',
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Naples',
    addressRegion: 'FL',
    addressCountry: 'US',
  },
  geo: {
    '@type': 'GeoCoordinates',
    latitude: 26.142,
    longitude: -81.795,
  },
  openingHoursSpecification: [
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      opens: '10:00',
      closes: '17:00',
    },
  ],
  priceRange: '$$',
  currenciesAccepted: 'USD',
  paymentAccepted: 'Cash, Check, Wire Transfer, PayPal, Credit Card, Debit Card',
  areaServed: ['Naples', 'Marco Island', 'Bonita Springs', 'Fort Myers'],
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
    <html lang={locale} className={`${caslon.variable} ${hanken.variable}`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Material Symbols is an icon font and is not exposed by next/font/google.
            Preload the stylesheet, then drop the unused GRAD axis (never set in
            this app) to shrink the variable font payload. opsz/wght/FILL are all
            in use (wght 200 on the service pages, FILL toggles on cart/wishlist). */}
        {/* display=block is intentional for an icon font: it hides the glyphs
            until the font loads (max ~3s) instead of flashing fallback tofu
            boxes the way swap/optional would — so the google-font-display rule is
            a false positive here. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font, @next/next/google-font-display */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL@20..48,100..700,0..1&display=block"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdHtml(jsonLd) }}
        />
      </head>
      <body className="min-h-screen flex flex-col">
        <NextIntlClientProvider locale={locale} messages={messages}>
          {/* CartProvider must wrap WishlistProvider: WishlistDrawer (rendered by
              WishlistProvider) has an Add to Cart button that calls useCart(), so it
              needs a CartContext ancestor. CartDrawer has no reverse dependency on
              WishlistContext, so this order is safe. */}
          <CartProvider locale={locale}>
            <WishlistProvider locale={locale}>
              <div data-customer-reveal-root className="contents">
                {children}
                <CustomerReveal />
              </div>
              <CookieNotice locale={locale} />
            </WishlistProvider>
          </CartProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
