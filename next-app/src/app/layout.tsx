import type { Metadata } from 'next';
import './globals.css';

// The <html>/<body> shell lives in [locale]/layout.tsx so `lang` can reflect the
// locale (en/es). This root layout is a passthrough that only owns global metadata
// and the globals.css import. The root not-found.tsx renders its own <html>.
export const metadata: Metadata = {
  title: {
    template: '%s | Naples Estate Jewelry',
    default: 'Naples Estate Jewelry — Fine Gold & Estate Pieces',
  },
  description:
    'Buy and sell estate jewelry, fine gold chains, designer pieces, and bullion in Naples, FL. Live gold pricing on every item.',
  metadataBase: new URL('https://naplesestatejewelry.co'),
  openGraph: {
    type: 'website',
    siteName: 'Naples Estate Jewelry',
    url: 'https://naplesestatejewelry.co',
    title: 'Naples Estate Jewelry — Fine Gold & Estate Pieces',
    description:
      'Buy and sell estate jewelry, fine gold chains, designer pieces, and bullion in Naples, FL. Live gold pricing on every item.',
    images: [{ url: '/assets/images/pages/og-preview.webp', width: 1983, height: 793 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Naples Estate Jewelry — Fine Gold & Estate Pieces',
    description:
      'Buy and sell estate jewelry, fine gold chains, designer pieces, and bullion in Naples, FL. Live gold pricing on every item.',
    images: ['/assets/images/pages/og-preview.webp'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
