import type { Metadata } from 'next';
import LegalPolicyPage from '@/components/legal/LegalPolicyPage';

export const metadata: Metadata = {
  title: 'Vendor Terms | Naples Estate Jewelry',
  description: 'Vendor terms for any future vendor or marketplace participation with Naples Estate Jewelry.',
  robots: { index: false, follow: true },
};

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function VendorTermsPage({ params }: Props) {
  const { locale } = await params;

  return (
    <LegalPolicyPage
      locale={locale}
      title="Vendor Terms"
      intro={[
        'The current website does not provide public vendor account registration. These terms are a baseline for any vendor, consignor, marketplace, or listing relationship that we separately approve in writing or through a future registration flow.',
      ]}
      sections={[
        {
          title: 'Listing Requirements',
          body: [
            'Vendors must provide accurate item descriptions, photos, ownership information, condition details, metal or gemstone information where known, and any required documentation. We may edit, reject, or remove listings that are incomplete, misleading, risky, or inconsistent with our brand.',
          ],
        },
        {
          title: 'Prohibited Items',
          body: [
            'Vendors may not list stolen goods, counterfeit goods, illegally obtained property, restricted materials, unsafe items, items infringing intellectual-property rights, or items they are not authorized to sell.',
          ],
        },
        {
          title: 'Fees, Commissions, and Payment Timelines',
          body: [
            'Any fees, commissions, payment timing, shipping responsibilities, returns handling, insurance, and tax responsibilities must be agreed in writing or in the applicable vendor program terms before listings go live.',
          ],
        },
        {
          title: 'Account Suspension',
          body: [
            'We may suspend or terminate vendor participation for inaccurate listings, customer complaints, suspected fraud, prohibited items, nonpayment, legal risk, or other conduct that may harm customers or the business.',
          ],
        },
        {
          title: 'Intellectual Property',
          body: [
            'Vendors retain ownership of their own submitted photos and descriptions, but grant us permission to use, edit, display, archive, and promote them for listing, selling, customer service, legal, and administrative purposes.',
          ],
        },
      ]}
    />
  );
}
