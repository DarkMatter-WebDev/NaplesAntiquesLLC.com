import type { Metadata } from 'next';
import { alternatesFor } from '@/lib/seo';

export type AccountMetadataPage = 'account' | 'security' | 'sign-in' | 'sign-up' | 'reset-password';

const ACCOUNT_METADATA: Record<AccountMetadataPage, {
  path: string;
  title: { en: string; es: string };
  description: { en: string; es: string };
}> = {
  account: {
    path: '/account',
    title: { en: 'My Account', es: 'Mi Cuenta' },
    description: {
      en: 'View your Naples Estate Jewelry account and order history.',
      es: 'Consulte su cuenta e historial de pedidos de Naples Estate Jewelry.',
    },
  },
  security: {
    path: '/account/security',
    title: { en: 'Account Security', es: 'Seguridad de la Cuenta' },
    description: {
      en: 'Manage your Naples Estate Jewelry account security.',
      es: 'Administre la seguridad de su cuenta de Naples Estate Jewelry.',
    },
  },
  'sign-in': {
    path: '/account/sign-in',
    title: { en: 'Sign In', es: 'Iniciar Sesión' },
    description: {
      en: 'Sign in to your Naples Estate Jewelry account.',
      es: 'Inicie sesión en su cuenta de Naples Estate Jewelry.',
    },
  },
  'sign-up': {
    path: '/account/sign-up',
    title: { en: 'Create Account', es: 'Crear Cuenta' },
    description: {
      en: 'Create a Naples Estate Jewelry customer account.',
      es: 'Cree una cuenta de cliente de Naples Estate Jewelry.',
    },
  },
  'reset-password': {
    path: '/account/reset-password',
    title: { en: 'Reset Password', es: 'Restablecer Contraseña' },
    description: {
      en: 'Reset your Naples Estate Jewelry account password.',
      es: 'Restablezca la contraseña de su cuenta de Naples Estate Jewelry.',
    },
  },
};

export function getAccountMetadata(page: AccountMetadataPage, locale: string): Metadata {
  const copy = ACCOUNT_METADATA[page];
  const language = locale === 'es' ? 'es' : 'en';

  return {
    title: copy.title[language],
    description: copy.description[language],
    alternates: alternatesFor(copy.path, locale),
    robots: { index: false, follow: false },
  };
}
