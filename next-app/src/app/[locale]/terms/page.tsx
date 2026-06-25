import type { Metadata } from 'next';
import LegalPolicyPage from '@/components/legal/LegalPolicyPage';

export const metadata: Metadata = {
  title: 'Terms of Service | Naples Estate Jewelry',
  description: 'Terms of Service for Naples Estate Jewelry accounts, shop orders, inquiries, auctions, and services.',
  robots: { index: false, follow: true },
};

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function TermsPage({ params }: Props) {
  const { locale } = await params;
  const isEs = locale === 'es';

  return (
    <LegalPolicyPage
      locale={locale}
      title={isEs ? 'Términos de Servicio' : 'Terms of Service'}
      intro={[
        'These Terms of Service apply to naplesestatejewelry.co and related services provided by Naples Estate Jewelry & Antiques, operated by Naples Antiques LLC. By using the website, creating an account, submitting information, or placing an order, you agree to these terms.',
      ]}
      sections={[
        {
          title: 'Our Website and Services',
          body: [
            'We operate a small-business website for estate jewelry and antiques buying services, product inquiries, customer accounts, saved carts, online order requests, and curated ecommerce listings. Auction, marketplace, and vendor features may be informational, limited, or separately enabled.',
          ],
        },
        {
          title: 'Eligibility and Account Registration',
          body: [
            'You must be at least 13 years old to create an account or use this website. By using this website or creating an account, you represent and warrant that you are at least 13 years old.',
            'When you create an account, you agree to provide accurate information, keep your login credentials secure, and notify us if you believe your account has been compromised.',
          ],
        },
        {
          title: 'User Responsibilities',
          bullets: [
            'Provide accurate contact, account, order, item, and payment-related information.',
            'Use the website only for lawful purposes and do not interfere with site security or operations.',
            'Do not submit false, misleading, infringing, unlawful, or harmful content.',
          ],
        },
        {
          title: 'Accounts and Termination',
          body: [
            'We may refuse, suspend, or terminate accounts or orders when reasonably necessary to protect customers, inventory, the business, site security, legal compliance, or other users. You may request account deletion, subject to transaction and legal record retention needs.',
          ],
        },
        {
          title: 'Orders, Pricing, and Payments',
          body: [
            'Product availability, descriptions, metal prices, and pricing may change. Estate jewelry and antiques are usually one-of-a-kind and may sell, be reserved, or become unavailable. Submitting checkout information creates an order request or inventory hold; it does not guarantee final sale until payment, identity, availability, and fulfillment details are confirmed.',
            'If online payments are enabled, payment processing may be provided by a third-party payment processor. You agree to provide accurate payment information and authorize applicable charges for confirmed purchases.',
          ],
        },
        {
          title: 'Item Condition and Estate Goods',
          body: [
            'Estate, antique, and pre-owned items may show age, wear, repair, sizing, patina, or prior ownership characteristics. We try to describe items accurately, but photographs, measurements, weights, metal content, stones, and condition notes should be reviewed carefully before purchase.',
          ],
        },
        {
          title: 'Auctions, Marketplace, and Vendors',
          body: [
            'If auction, marketplace, or vendor features are separately enabled, additional Auction Terms or Vendor Terms may apply. A bid, vendor listing, or marketplace submission may create binding obligations only under the specific rules presented for that feature.',
          ],
        },
        {
          title: 'Acceptable Use',
          bullets: [
            'Do not attempt unauthorized access, scraping, probing, reverse engineering, or disruption of the website.',
            'Do not upload malware, spam, deceptive content, or content that violates another person rights.',
            'Do not use the site to sell or inquire about stolen, counterfeit, illegally obtained, or prohibited goods.',
          ],
        },
        {
          title: 'Intellectual Property',
          body: [
            'Website text, images, branding, layout, software, and other content are owned by us or our licensors unless otherwise noted. You may not copy or reuse them commercially without permission. By submitting photos, descriptions, or messages, you give us permission to use them to evaluate, respond to, support, administer, or complete the requested service.',
          ],
        },
        {
          title: "Children's Privacy",
          body: [
            'Our website is not directed toward children under the age of 13. We do not knowingly collect personal information from children under 13. If we become aware that such information has been collected, we will delete it.',
          ],
        },
        {
          title: 'Disclaimers and Limitation of Liability',
          body: [
            'The website is provided on an as-available basis. To the fullest extent permitted by law, we disclaim implied warranties and are not liable for indirect, incidental, special, consequential, or punitive damages. Our total liability for a claim related to the website or a transaction is limited to the amount you paid us for the specific item or service giving rise to the claim, unless Florida law requires otherwise.',
          ],
        },
        {
          title: 'Dispute Resolution and Florida Law',
          body: [
            'These terms are governed by Florida law, without regard to conflict-of-law rules. Before filing a formal claim, you agree to contact us and try to resolve the issue informally. Courts located in Collier County, Florida will be the preferred venue for disputes unless applicable law requires another venue.',
          ],
        },
        {
          title: 'Contact',
          body: [
            'Questions about these terms may be directed to Naples Estate Jewelry & Antiques, Naples Antiques LLC, by calling or texting (239) 404-8505 or using the Contact Us page.',
          ],
        },
      ]}
    />
  );
}
