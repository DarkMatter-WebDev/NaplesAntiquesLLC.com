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
import { jsonLdHtml } from '@/lib/json-ld';

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
    'Naples, FL gold, jewelry, and sterling silver buyer paying top dollar for estate jewelry, gold, silver, diamonds, coins, watches, and full estates. Free on-site evaluations by appointment across Southwest Florida.',
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
    <html lang={locale} className={`${caslon.variable} ${hanken.variable}`}>
      <head>
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
