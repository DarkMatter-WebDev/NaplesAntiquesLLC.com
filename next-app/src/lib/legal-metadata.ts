import type { Metadata } from 'next';
import { alternatesFor } from '@/lib/seo';

export type LegalPageKey =
  | 'privacy'
  | 'terms'
  | 'returns-refunds'
  | 'shipping'
  | 'accessibility'
  | 'cookie-preferences';

const LEGAL_METADATA: Record<LegalPageKey, {
  path: string;
  en: { title: string; description: string };
  es: { title: string; description: string };
}> = {
  privacy: {
    path: '/privacy',
    en: {
      title: 'Privacy Policy',
      description: 'How Naples Estate Jewelry collects, uses, and protects personal information.',
    },
    es: {
      title: 'Política de Privacidad',
      description: 'Cómo Naples Estate Jewelry recopila, utiliza y protege la información personal.',
    },
  },
  terms: {
    path: '/terms',
    en: {
      title: 'Terms of Service',
      description: 'Terms for Naples Estate Jewelry accounts, shop orders, inquiries, and services.',
    },
    es: {
      title: 'Términos de Servicio',
      description: 'Términos para cuentas, pedidos, consultas y servicios de Naples Estate Jewelry.',
    },
  },
  'returns-refunds': {
    path: '/returns-refunds',
    en: {
      title: 'Returns & Refunds',
      description: 'Returns and refunds policy for Naples Estate Jewelry purchases.',
    },
    es: {
      title: 'Devoluciones y Reembolsos',
      description: 'Política de devoluciones y reembolsos para compras en Naples Estate Jewelry.',
    },
  },
  shipping: {
    path: '/shipping',
    en: {
      title: 'Shipping Policy',
      description: 'Shipping and local pickup policy for Naples Estate Jewelry purchases.',
    },
    es: {
      title: 'Política de Envío',
      description: 'Política de envío y recogida local para compras en Naples Estate Jewelry.',
    },
  },
  accessibility: {
    path: '/accessibility',
    en: {
      title: 'Accessibility Statement',
      description: 'Accessibility statement and contact information for Naples Estate Jewelry.',
    },
    es: {
      title: 'Declaración de Accesibilidad',
      description: 'Declaración de accesibilidad e información de contacto de Naples Estate Jewelry.',
    },
  },
  'cookie-preferences': {
    path: '/cookie-preferences',
    en: {
      title: 'Cookie Preferences',
      description: 'Cookie and browser storage preferences for Naples Estate Jewelry.',
    },
    es: {
      title: 'Preferencias de Cookies',
      description: 'Preferencias de cookies y almacenamiento del navegador para Naples Estate Jewelry.',
    },
  },
};

export function getLegalMetadata(page: LegalPageKey, locale: string): Metadata {
  const config = LEGAL_METADATA[page];
  const copy = locale === 'es' ? config.es : config.en;

  return {
    title: copy.title,
    description: copy.description,
    alternates: alternatesFor(config.path, locale),
    robots: { index: false, follow: true },
  };
}
