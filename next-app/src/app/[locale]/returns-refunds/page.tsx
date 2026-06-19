import type { Metadata } from 'next';
import LegalPolicyPage from '@/components/legal/LegalPolicyPage';

export const metadata: Metadata = {
  title: 'Returns & Refunds | Naples Estate Jewelry',
  description: 'Returns and refunds policy for Naples Estate Jewelry purchases.',
  robots: { index: false, follow: true },
};

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function ReturnsRefundsPage({ params }: Props) {
  const { locale } = await params;

  return (
    <LegalPolicyPage
      locale={locale}
      title="Returns & Refunds"
      intro={[
        'Estate jewelry, antiques, coins, watches, and precious-metal items are often one-of-a-kind. Please review photos, descriptions, measurements, condition notes, and pricing before purchase and contact us with questions before final payment.',
      ]}
      sections={[
        {
          title: 'Before Final Sale',
          body: [
            'Checkout on this website currently creates an order request or inventory hold for admin follow-up. If you change your mind before payment or pickup/shipment confirmation, contact us as soon as possible so we can cancel the pending order and release the item.',
          ],
        },
        {
          title: 'Returns',
          body: [
            'Returns are handled case by case. Because inventory is pre-owned, estate, antique, precious-metal, or market-priced, some sales may be final once payment is completed. If a return is approved, the item must be returned in the same condition, with all included packaging, documentation, tags, and accessories.',
          ],
        },
        {
          title: 'Refunds',
          body: [
            'Approved refunds are issued to the original payment method when practical. Shipping, insurance, appraisal, sizing, repair, payment-processing, or special-order costs may be non-refundable unless we made an error or applicable law requires otherwise.',
          ],
        },
        {
          title: 'Damaged or Incorrect Items',
          body: [
            'If an item arrives damaged or materially different from what was confirmed, contact us immediately at (239) 404-8505. Keep the packaging and take photos so we can review the issue and any shipping-insurance claim.',
          ],
        },
        {
          title: 'Market-Priced Items',
          body: [
            'Items priced with reference to gold, silver, platinum, or other market prices may change with the market. Price changes after purchase are not, by themselves, a reason for a refund or price adjustment.',
          ],
        },
        {
          title: 'Contact',
          body: [
            'For return or refund questions, call or text (239) 404-8505 before shipping anything back.',
          ],
        },
      ]}
    />
  );
}
