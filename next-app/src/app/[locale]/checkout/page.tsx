import type { Metadata } from 'next';
import SiteHeader from '@/components/layout/SiteHeader';
import SiteFooter from '@/components/layout/SiteFooter';
import CheckoutClient from '@/components/checkout/CheckoutClient';
import { alternatesFor } from '@/lib/seo';
import { hoursLine } from '@/lib/business-location';
import { getStoreHours } from '@/lib/store-hours';

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
  // Admin-editable hours, formatted here so the client component receives a
  // ready string instead of reading Supabase a second time.
  const pickupHoursLine = hoursLine(await getStoreHours(), locale === 'es');

  return (
    <>
      <SiteHeader />
      <main className="site-header-offset">
        <CheckoutClient locale={locale} paypalClientId={paypalClientId} pickupHoursLine={pickupHoursLine} />
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}
