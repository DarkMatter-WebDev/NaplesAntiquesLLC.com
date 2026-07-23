import type { Metadata } from 'next';
import { alternatesFor } from '@/lib/seo';

type SecondaryPage = 'payment' | 'unsubscribe';

const COPY: Record<SecondaryPage, {
  path: string;
  en: { title: string; description: string };
  es: { title: string; description: string };
}> = {
  payment: {
    path: '/payment',
    en: {
      title: 'Payment',
      description: 'Payment for Naples Estate Jewelry shop items.',
    },
    es: {
      title: 'Pago',
      description: 'Pago de artículos de la tienda Naples Estate Jewelry.',
    },
  },
  unsubscribe: {
    path: '/unsubscribe',
    en: {
      title: 'Unsubscribe',
      description: 'Unsubscribe from Naples Estate Jewelry marketing updates.',
    },
    es: {
      title: 'Cancelar Suscripción',
      description: 'Cancele las novedades de marketing de Naples Estate Jewelry.',
    },
  },
};

export function getSecondaryPageMetadata(page: SecondaryPage, locale: string): Metadata {
  const config = COPY[page];
  const copy = locale === 'es' ? config.es : config.en;
  return {
    title: copy.title,
    description: copy.description,
    alternates: alternatesFor(config.path, locale),
    robots: { index: false, follow: false },
  };
}
