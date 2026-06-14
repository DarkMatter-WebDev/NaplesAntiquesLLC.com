import type { Metadata } from 'next';
import SiteHeader from '@/components/layout/SiteHeader';
import SiteFooter from '@/components/layout/SiteFooter';
import PaymentClient from '@/components/checkout/PaymentClient';

export const metadata: Metadata = {
  title: 'Payment | Naples Estate Jewelry',
  description: 'Payment for Naples Estate Jewelry shop items.',
  robots: {
    index: false,
    follow: false,
  },
};

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function PaymentPage({ params }: Props) {
  const { locale } = await params;

  return (
    <>
      <SiteHeader />
      <main className="pt-16">
        <PaymentClient locale={locale} />
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}
