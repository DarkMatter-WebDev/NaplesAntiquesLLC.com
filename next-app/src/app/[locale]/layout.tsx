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
        {/* Material Symbols (icon font) is self-hosted + subset via @font-face in
            globals.css and served same-origin from /assets/fonts, so there is no
            render-blocking third-party stylesheet on the critical path anymore.
            Preload the (tiny, ~65KB) subset so it arrives inside font-display:
            block's window — icons render immediately instead of briefly flashing
            their ligature names as text. crossOrigin is required: webfonts are
            always fetched in CORS/anonymous mode, so this must match the
            @font-face fetch to avoid a double download.
            The body fonts (caslon/hanken) are self-hosted by next/font at build
            time, so no runtime fonts.googleapis.com / fonts.gstatic.com
            connection remains — hence no preconnects here. */}
        <link
          rel="preload"
          href="/assets/fonts/material-symbols-subset-v357.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
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
