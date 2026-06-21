import type { Metadata } from 'next';
import { Libre_Caslon_Text, Hanken_Grotesk } from 'next/font/google';
import './globals.css';

const caslon = Libre_Caslon_Text({
  weight: ['400', '700'],
  style: ['normal', 'italic'],
  subsets: ['latin'],
  variable: '--font-caslon',
  display: 'swap',
});

const hanken = Hanken_Grotesk({
  weight: ['300', '400', '500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-hanken',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    template: '%s | Naples Estate Jewelry',
    default: 'Naples Estate Jewelry — Fine Gold & Estate Pieces',
  },
  description:
    'Buy and sell estate jewelry, fine gold chains, designer pieces, and bullion in Naples, FL. Live gold pricing on every item.',
  metadataBase: new URL('https://naplesestatejewelry.co'),
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'JewelryStore',
  name: 'Naples Estate Jewelry',
  url: 'https://naplesestatejewelry.co',
  telephone: '+12394048505',
  image: 'https://naplesestatejewelry.co/assets/images/pages/trust.webp',
  description:
    'Naples, FL estate jeweler buying and selling fine gold chains, estate pieces, designer jewelry, and bullion. Free in-store and on-site evaluations.',
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
  paymentAccepted: 'Cash, Check, Wire Transfer',
  areaServed: ['Naples', 'Marco Island', 'Bonita Springs', 'Fort Myers'],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html className={`${caslon.variable} ${hanken.variable}`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Material Symbols is an icon font and is not exposed by next/font/google. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=block"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-screen flex flex-col">{children}</body>
    </html>
  );
}
