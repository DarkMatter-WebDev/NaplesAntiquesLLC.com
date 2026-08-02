import type { Metadata } from 'next';
import LegalPolicyPage from '@/components/legal/LegalPolicyPage';
import UnsubscribeForm from '@/components/legal/UnsubscribeForm';
import { getSecondaryPageMetadata } from '@/lib/secondary-page-metadata';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return getSecondaryPageMetadata('unsubscribe', locale);
}

interface Props {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ email?: string; token?: string }>;
}

export default async function UnsubscribePage({ params, searchParams }: Props) {
  const { locale } = await params;
  const query = await searchParams;
  const isEs = locale === 'es';

  return (
    <LegalPolicyPage
      locale={locale}
      title={isEs ? 'Cancelar Suscripción' : 'Unsubscribe'}
      updated={isEs ? '19 de junio de 2026' : undefined}
      intro={[
        isEs
          ? 'Utilice esta página para dejar de recibir novedades generales de marketing de Naples Estate Jewelry. Los mensajes transaccionales sobre consultas activas, pedidos, facturas, seguridad o atención al cliente aún podrán enviarse cuando sean necesarios.'
          : 'Use this page to opt out of general marketing updates from Naples Estate Jewelry. Transactional messages about active inquiries, orders, invoices, security, or customer service may still be sent when needed.',
      ]}
      sections={[
        {
          title: isEs ? 'Preferencia de Correo de Marketing' : 'Marketing Email Preference',
          body: [
            isEs
              ? 'Introduzca el correo electrónico que utilizó para suscribirse o crear su cuenta. Si forma parte de nuestra audiencia de marketing, quedará marcado como no suscrito.'
              : 'Enter the email address you used to subscribe or create your account. If it is in our marketing audience, it will be marked unsubscribed.',
          ],
        },
      ]}
    >
      <UnsubscribeForm locale={locale} initialEmail={query?.email ?? ''} token={query?.token ?? ''} />
    </LegalPolicyPage>
  );
}
