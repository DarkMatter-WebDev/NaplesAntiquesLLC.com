import type { Metadata } from 'next';
import SiteHeader from '@/components/layout/SiteHeader';
import SiteFooter from '@/components/layout/SiteFooter';
import CheckoutClient from '@/components/checkout/CheckoutClient';
import { alternatesFor } from '@/lib/seo';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const isEs = locale === 'es';
  return {
    title: isEs ? 'Finalizar Compra' : 'Checkout',
    description: isEs
      ? 'Finalice la compra de sus artículos de Naples Estate Jewelry.'
      : 'Checkout for Naples Estate Jewelry shop items.',
    alternates: alternatesFor('/checkout', locale),
    robots: { index: false, follow: false },
  };
}

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function CheckoutPage({ params }: Props) {
  const { locale } = await params;

  // Guest checkout: no account required. PayPal identifies the buyer, the order
  // records the contact details entered here, and a user_id is attached only when
  // the buyer happens to be signed in. CheckoutClient offers an optional sign-in.
  const paypalClientId = process.env.PAYPAL_CLIENT_ID ?? null;

  return (
    <>
      <SiteHeader />
      <main className="site-header-offset">
        <CheckoutClient locale={locale} paypalClientId={paypalClientId} />
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}
