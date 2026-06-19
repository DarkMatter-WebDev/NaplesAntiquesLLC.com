import type { Metadata } from 'next';
import LegalPolicyPage from '@/components/legal/LegalPolicyPage';
import CookiePreferencesClient from '@/components/legal/CookiePreferencesClient';

export const metadata: Metadata = {
  title: 'Cookie Preferences | Naples Estate Jewelry',
  description: 'Cookie and browser storage preferences for Naples Estate Jewelry.',
  robots: { index: false, follow: true },
};

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function CookiePreferencesPage({ params }: Props) {
  const { locale } = await params;
  const isEs = locale === 'es';

  return (
    <LegalPolicyPage
      locale={locale}
      title={isEs ? 'Preferencias de Cookies' : 'Cookie Preferences'}
      intro={[
        'This site currently uses essential cookies and browser storage to operate core features. During the compliance audit, no Google Analytics, Google Tag Manager, Meta Pixel, Microsoft Clarity, Hotjar, or similar tracking pixel was found in the app source.',
      ]}
      sections={[
        {
          title: 'Essential Cookies and Storage',
          bullets: [
            'Supabase authentication cookies for sign-in and account sessions.',
            'Language routing cookies such as NEXT_LOCALE.',
            'Cart and favorites storage in the browser so shop features continue working between page views.',
            'Cookie notice storage so the notice does not repeatedly appear after acceptance.',
          ],
        },
        {
          title: 'Optional Analytics or Advertising Cookies',
          body: [
            'No optional analytics or advertising cookie system is currently enabled in the app source reviewed for this audit. If that changes, this page should be updated with a real opt-in or opt-out control before those tools are enabled.',
          ],
        },
        {
          title: 'Managing Browser Controls',
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
