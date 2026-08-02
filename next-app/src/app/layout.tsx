import type { Metadata } from 'next';
import './globals.css';

// The <html>/<body> shell lives in [locale]/layout.tsx so `lang` can reflect the
// locale (en/es). This root layout is a passthrough that only owns global metadata
// and the globals.css import. The root not-found.tsx renders its own <html>.
const SITE_TITLE = 'Sell Gold, Jewelry & Sterling Silver in Naples, FL | Naples Estate Jewelry';
const SITE_DESCRIPTION =
  'Naples gold, jewelry, and sterling silver buyer paying top dollar. We buy estate jewelry, gold, silver, diamonds, coins, and watches across Naples, Marco Island, Bonita Springs, Estero, Fort Myers & Cape Coral. Free appraisals — we come to you.';

export const metadata: Metadata = {
  title: {
    template: '%s | Naples Estate Jewelry',
    default: SITE_TITLE,
  },
  description: SITE_DESCRIPTION,
  metadataBase: new URL('https://naplesestatejewelry.com'),
  // iOS Safari rewrites plain-text phone numbers (and dates/addresses) into
  // injected tel:/maps links BEFORE React hydrates, splitting server text
  // nodes and causing real hydration mismatches on iPhone/iPad (confirmed
  // live 2026-07-31 on the product-page trade-in line). Numbers we WANT
  // tappable are explicit <a href="tel:..."> links already.
  formatDetection: {
    telephone: false,
    date: false,
    address: false,
    email: false,
  },
  openGraph: {
    type: 'website',
    siteName: 'Naples Estate Jewelry',
    url: 'https://naplesestatejewelry.com',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [{ url: '/assets/images/pages/og-preview.webp', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ['/assets/images/pages/og-preview.webp'],
  },
  // Google Search Console HTML-tag verification. The token is account-scoped,
  // so it verifies both the legacy https://naplesestatejewelry.co URL-prefix
  // property and the new https://naplesestatejewelry.com property (add the .com
  // property in Search Console after the domain switch deploys). Do not remove —
  // Search Console re-checks this tag periodically to keep properties verified.
  verification: {
    google: 'mOpCYI06DOHizh2_SK1_iWJ967utv2WO4T3OFmbLSsA',
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
