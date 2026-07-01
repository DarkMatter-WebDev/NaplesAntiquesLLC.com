import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import SiteHeader from '@/components/layout/SiteHeader';
import SiteFooter from '@/components/layout/SiteFooter';
import CheckoutClient from '@/components/checkout/CheckoutClient';
import { createClient } from '@/lib/supabase/server';

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
  const prefix = locale === 'es' ? '/es' : '';

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect(`${prefix}/account/sign-in?next=${prefix}/checkout`);
  }

  // PayPal client id is public by design (it's embedded in the JS SDK URL).
  // Read it server-side and pass it down so it isn't a NEXT_PUBLIC_* var.
  const paypalClientId = process.env.PAYPAL_CLIENT_ID ?? null;

  return (
    <>
      <SiteHeader />
      <main className="pt-16">
        <CheckoutClient locale={locale} paypalClientId={paypalClientId} />
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}
