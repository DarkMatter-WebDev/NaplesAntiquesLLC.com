import type { Metadata } from 'next';
import LegalPolicyPage from '@/components/legal/LegalPolicyPage';

export const metadata: Metadata = {
  title: 'Shipping Policy | Naples Estate Jewelry',
  description: 'Shipping and local pickup policy for Naples Estate Jewelry purchases.',
  robots: { index: false, follow: true },
};

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function ShippingPage({ params }: Props) {
  const { locale } = await params;

  return (
    <LegalPolicyPage
      locale={locale}
      title="Shipping Policy"
      sections={[
        {
          title: 'Fulfillment Options',
          bullets: [
            'Local pickup may be available by appointment.',
            'Priority insured shipping may be available for eligible items.',
            'Express overnight insured shipping may be available for eligible items.',
          ],
        },
        {
          title: 'Address and Identity Review',
          body: [
            'High-value jewelry and precious-metal orders may require manual review, identity confirmation, signature delivery, insurance limits, or alternate fulfillment arrangements before shipment.',
          ],
        },
        {
          title: 'Shipping Costs',
          body: [
            'Shipping costs shown at checkout are estimates or current flat options. We may contact you if the item value, destination, carrier requirements, or insurance limits require a different shipping arrangement.',
          ],
        },
        {
          title: 'Risk of Loss',
          body: [
            'Risk of loss transfers according to the confirmed pickup, delivery, or carrier arrangement. For shipped orders, please inspect packaging promptly and notify us immediately if there is damage or a delivery problem.',
          ],
        },
        {
          title: 'Restricted Destinations',
          body: [
            'We may decline or cancel shipment to destinations where delivery, insurance, fraud risk, legal restrictions, or carrier limitations make fulfillment impractical.',
          ],
        },
      ]}
    />
  );
}
