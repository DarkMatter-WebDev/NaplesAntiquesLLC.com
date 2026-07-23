import type { Metadata } from 'next';
import SiteHeader from '@/components/layout/SiteHeader';
import SiteFooter from '@/components/layout/SiteFooter';
import PaymentClient from '@/components/checkout/PaymentClient';
import { getSecondaryPageMetadata } from '@/lib/secondary-page-metadata';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return getSecondaryPageMetadata('payment', locale);
}

export const dynamic = 'force-dynamic';

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
