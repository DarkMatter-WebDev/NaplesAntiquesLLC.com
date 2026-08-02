import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['en', 'es'] as const,
  defaultLocale: 'en',
  localePrefix: 'as-needed', // /shop (en), /es/shop (es)
  localeDetection: false,    // locale is URL-only; don't redirect based on Accept-Language
});

export type Locale = (typeof routing.locales)[number];
