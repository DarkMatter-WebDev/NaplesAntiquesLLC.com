import type { Metadata } from 'next';
import LegalPolicyPage from '@/components/legal/LegalPolicyPage';
import UnsubscribeForm from '@/components/legal/UnsubscribeForm';

export const metadata: Metadata = {
  title: 'Unsubscribe | Naples Estate Jewelry',
  description: 'Unsubscribe from Naples Estate Jewelry marketing updates.',
  robots: { index: false, follow: false },
};

interface Props {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ email?: string; token?: string }>;
}

export default async function UnsubscribePage({ params, searchParams }: Props) {
  const { locale } = await params;
  const query = await searchParams;

  return (
    <LegalPolicyPage
      locale={locale}
      title="Unsubscribe"
      intro={[
        'Use this page to opt out of general marketing updates from Naples Estate Jewelry. Transactional messages about active inquiries, orders, invoices, security, or customer service may still be sent when needed.',
      ]}
      sections={[
        {
          title: 'Marketing Email Preference',
          body: [
            'Enter the email address you used to subscribe or create your account. If it is in our marketing audience, it will be marked unsubscribed.',
          ],
        },
      ]}
    >
      <UnsubscribeForm locale={locale} initialEmail={query?.email ?? ''} token={query?.token ?? ''} />
    </LegalPolicyPage>
  );
}
