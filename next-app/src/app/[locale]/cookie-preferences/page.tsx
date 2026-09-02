import type { Metadata } from 'next';
import LegalPolicyPage from '@/components/legal/LegalPolicyPage';
import CookiePreferencesClient from '@/components/legal/CookiePreferencesClient';
import { getLegalMetadata } from '@/lib/legal-metadata';
import { getSpanishLegalCopy } from '@/lib/spanish-legal-copy';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return getLegalMetadata('cookie-preferences', locale);
}

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function CookiePreferencesPage({ params }: Props) {
  const { locale } = await params;
  const isEs = locale === 'es';
  const spanishCopy = getSpanishLegalCopy('cookie-preferences', locale);

  return (
    <LegalPolicyPage
      locale={locale}
      path="/cookie-preferences"
      title={spanishCopy?.title ?? 'Cookie Preferences'}
      updated={spanishCopy?.updated}
      intro={spanishCopy?.intro ?? [
        'This site currently uses essential cookies and browser storage to operate core features. During the compliance audit, no Google Analytics, Google Tag Manager, Meta Pixel, Microsoft Clarity, Hotjar, or similar tracking pixel was found in the app source.',
      ]}
      sections={spanishCopy?.sections ?? [
        {
          title: isEs ? 'Cookies y Almacenamiento Esenciales' : 'Essential Cookies and Storage',
          bullets: [
            'Supabase authentication cookies for sign-in and account sessions.',
            'Language routing cookies such as NEXT_LOCALE.',
            'Cart and favorites storage in the browser so shop features continue working between page views.',
            'Cookie notice storage so the notice does not repeatedly appear after acceptance.',
          ],
        },
        {
          title: isEs ? 'Cookies Opcionales de Analítica o Publicidad' : 'Optional Analytics or Advertising Cookies',
          body: [
            'No optional analytics or advertising cookie system is currently enabled in the app source reviewed for this audit. If that changes, this page should be updated with a real opt-in or opt-out control before those tools are enabled.',
          ],
        },
        {
          title: isEs ? 'Administrar los Controles del Navegador' : 'Managing Browser Controls',
          body: [
            'You can also clear cookies and local storage in your browser settings. Doing so may sign you out, clear your local cart or favorites, reset your language choice, or cause the cookie notice to appear again.',
          ],
        },
      ]}
    >
      <CookiePreferencesClient locale={locale} />
    </LegalPolicyPage>
  );
}
