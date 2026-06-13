import type { Metadata } from 'next';
import SiteHeader from '@/components/layout/SiteHeader';
import SiteFooter from '@/components/layout/SiteFooter';
import CheckoutClient from '@/components/checkout/CheckoutClient';

export const metadata: Metadata = {
  title: 'Checkout | Naples Estate Jewelry',
  description: 'Checkout for Naples Estate Jewelry shop items.',
  robots: {
    index: false,
    follow: false,
  },
};

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function CheckoutPage({ params }: Props) {
  const { locale } = await params;

  return (
    <>
      <SiteHeader />
      <main className="pt-16">
        <CheckoutClient locale={locale} />
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}
