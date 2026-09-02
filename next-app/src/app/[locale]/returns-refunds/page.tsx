import type { Metadata } from 'next';
import LegalPolicyPage from '@/components/legal/LegalPolicyPage';
import { getLegalMetadata } from '@/lib/legal-metadata';
import { getSpanishLegalCopy } from '@/lib/spanish-legal-copy';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return getLegalMetadata('returns-refunds', locale);
}

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function ReturnsRefundsPage({ params }: Props) {
  const { locale } = await params;
  const isEs = locale === 'es';
  const spanishCopy = getSpanishLegalCopy('returns-refunds', locale);

  return (
    <LegalPolicyPage
      locale={locale}
      path="/returns-refunds"
      title={spanishCopy?.title ?? 'Returns & Refunds'}
      updated={spanishCopy?.updated}
      intro={spanishCopy?.intro ?? [
        'Our inventory is one-of-a-kind estate merchandise priced against the live gold, silver, and platinum markets — prices that move constantly. Please review the photos, descriptions, measurements, condition notes, and pricing carefully, and contact us with any questions before you complete payment.',
      ]}
      sections={spanishCopy?.sections ?? [
        {
          title: isEs ? 'Todas las Ventas Son Finales' : 'All Sales Are Final',
          body: [
            'Because our pieces are pre-owned, estate in nature, and priced against precious-metal markets that change by the minute, all sales are final once payment is completed. A change in the gold or silver market after your purchase is not, by itself, a reason for a return, refund, or price adjustment.',
          ],
        },
        {
          title: isEs ? 'Si un Artículo Fue Descrito Incorrectamente (Garantía de 5 Días)' : 'If an Item Is Misrepresented (5-Day Guarantee)',
          body: [
            'The one exception: if an item you receive is materially misrepresented — meaningfully different from its listed description, metal, purity, weight, or condition — we will make it right. Call or text us at (239) 404-8505 within five (5) days of receiving the item, and we will arrange a full refund once the piece is returned in the same condition with all original packaging, documentation, and accessories.',
          ],
        },
        {
          title: isEs ? 'Artículos Dañados o Incorrectos' : 'Damaged or Incorrect Items',
          body: [
            'If an item arrives damaged in transit, or you received the wrong piece, contact us immediately at (239) 404-8505. Keep all packaging and take photos so we can review the issue and file any shipping-insurance claim.',
          ],
        },
        {
          title: isEs ? 'Cómo Se Emiten los Reembolsos' : 'How Refunds Are Issued',
          body: [
            'Approved refunds — for misrepresented, damaged, or incorrect items — are issued to the original payment method once the returned item is received and inspected. Please do not ship anything back before calling us; return shipping for an approved claim is arranged with us in advance.',
          ],
        },
        {
          title: isEs ? 'Contacto' : 'Contact',
          body: [
            'For any return or refund question, call or text (239) 404-8505 before shipping anything back.',
          ],
        },
      ]}
    />
  );
}
