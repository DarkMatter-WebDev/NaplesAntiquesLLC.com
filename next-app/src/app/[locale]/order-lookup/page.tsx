import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import SiteHeader from '@/components/layout/SiteHeader';
import SiteFooter from '@/components/layout/SiteFooter';
import OrderLookupForm from '@/components/orders/OrderLookupForm';

/**
 * `/order-lookup` — a customer opens their own order with the order number
 * plus the email or phone on it. No account needed (owner, 2026-09-17).
 * Utility page: noindex and off the sitemap (guarded by order-lookup.test.ts).
 * The receipt and shipping emails link here with `?order=` prefilled.
 */

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ order?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const isEs = locale === 'es';
  return {
    ...pageMetadata({
      title: isEs ? 'Consultar mi pedido' : 'Order Lookup',
      description: isEs
        ? 'Vea el estado de su pedido con su número de pedido y el correo o teléfono usado.'
        : 'Check your order status with your order number and the email or phone you used.',
      path: '/order-lookup',
      locale,
    }),
    robots: { index: false, follow: false },
  };
}

export default async function OrderLookupPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { order } = await searchParams;
  const isEs = locale === 'es';
  return (
    <>
      <SiteHeader />
      <main className="site-header-offset">
        <div className="mx-auto max-w-2xl px-6 pb-20 pt-10 md:px-8">
          <div className="mb-8 text-center">
            <span className="text-xs font-bold uppercase tracking-[0.4em]" style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}>
              {isEs ? 'Sus pedidos' : 'Your orders'}
            </span>
            <h1 className="responsive-title-lg mt-4 mb-4 font-bold tracking-tight" style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}>
              {isEs ? 'Consultar mi pedido' : 'Order Lookup'}
            </h1>
            <p className="responsive-copy mx-auto max-w-xl" style={{ color: 'var(--color-on-surface-variant)' }}>
              {isEs
                ? 'No necesita una cuenta. Escriba el número de pedido de su recibo y el correo o teléfono que usó al comprar.'
                : 'No account needed. Enter the order number from your receipt and the email or phone you used at checkout.'}
            </p>
          </div>
          <OrderLookupForm locale={locale} initialOrderNumber={typeof order === 'string' ? order : undefined} />
        </div>
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}
