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

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html className={`${caslon.variable} ${hanken.variable}`}>
      <body className="min-h-screen flex flex-col">{children}</body>
    </html>
  );
}
