import { Libre_Caslon_Text, Hanken_Grotesk } from 'next/font/google';

// Shared font instances so both the [locale] layout (which now owns <html> to set
// lang per locale) and the root not-found (which renders its own <html>) apply the
// same font CSS variables.
export const caslon = Libre_Caslon_Text({
  weight: ['400', '700'],
  style: ['normal', 'italic'],
  subsets: ['latin'],
  variable: '--font-caslon',
  display: 'swap',
});

export const hanken = Hanken_Grotesk({
  weight: ['300', '400', '500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-hanken',
  display: 'swap',
});
