import type { Metadata } from 'next';
import LegalPolicyPage from '@/components/legal/LegalPolicyPage';

export const metadata: Metadata = {
  title: 'Auction Terms | Naples Estate Jewelry',
  description: 'Auction terms for Naples Estate Jewelry auction guidance and any future bidding features.',
  robots: { index: false, follow: true },
};

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function AuctionTermsPage({ params }: Props) {
  const { locale } = await params;

  return (
    <LegalPolicyPage
      locale={locale}
      title="Auction Terms"
      intro={[
        'The current Auctions page is an informational and consultation page. The website does not currently operate live public bidding unless a specific auction event or registration flow separately states that bidding is open.',
      ]}
      sections={[
        {
          title: 'Bidder Responsibilities',
          body: [
            'If bidding is enabled for a specific auction, bidders are responsible for reading the lot description, condition notes, photos, payment requirements, pickup or shipping limits, buyer premium if any, and all event-specific rules before placing a bid.',
          ],
        },
        {
          title: 'Winning Bidder Obligations',
          body: [
            'A winning bid may create a binding obligation to pay for the item, taxes, fees, shipping, insurance, and any stated buyer premium. Failure to complete payment may result in cancellation, account restriction, or other remedies allowed by law.',
          ],
        },
        {
          title: 'Maximum Bids and Bid Errors',
          body: [
            'If maximum bidding is offered, you are responsible for the maximum amount you enter. Contact us immediately if you believe you made a bid entry error. We may, but are not required to, correct or cancel bids when an error is clear and correction is fair to the auction.',
          ],
        },
        {
          title: 'Condition and Authenticity',
          body: [
            'Auction items are usually estate, antique, or pre-owned goods. Condition reports are opinions based on available information and should not replace your own review. Additional inspection may be available before bidding when practical.',
          ],
        },
        {
          title: 'Seller Responsibilities',
          body: [
            'Sellers must have legal title or authority to sell submitted items and must disclose known condition issues, repairs, provenance restrictions, liens, claims, or authenticity concerns.',
          ],
        },
        {
          title: 'Cancellation and Platform Rights',
          body: [
            'We may withdraw lots, reject bids, cancel sales, correct errors, suspend accounts, or change auction procedures when reasonably necessary for fairness, security, legal compliance, suspected fraud, or operational reasons.',
          ],
        },
      ]}
    />
  );
}
