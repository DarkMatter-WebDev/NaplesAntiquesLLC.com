import type { Metadata } from 'next';
import LegalPolicyPage from '@/components/legal/LegalPolicyPage';
import { getLegalMetadata } from '@/lib/legal-metadata';
import { getSpanishLegalCopy } from '@/lib/spanish-legal-copy';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return getLegalMetadata('auction-terms', locale);
}

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function AuctionTermsPage({ params }: Props) {
  const { locale } = await params;
  const isEs = locale === 'es';
  const spanishCopy = getSpanishLegalCopy('auction-terms', locale);

  return (
    <LegalPolicyPage
      locale={locale}
      title={spanishCopy?.title ?? 'Auction Terms'}
      updated={spanishCopy?.updated}
      intro={spanishCopy?.intro ?? [
        'The current Auctions page is an informational and consultation page. The website does not currently operate live public bidding unless a specific auction event or registration flow separately states that bidding is open.',
      ]}
      sections={spanishCopy?.sections ?? [
        {
          title: isEs ? 'Responsabilidades del Postor' : 'Bidder Responsibilities',
          body: [
            'If bidding is enabled for a specific auction, bidders are responsible for reading the lot description, condition notes, photos, payment requirements, pickup or shipping limits, buyer premium if any, and all event-specific rules before placing a bid.',
          ],
        },
        {
          title: isEs ? 'Obligaciones del Postor Ganador' : 'Winning Bidder Obligations',
          body: [
            'A winning bid may create a binding obligation to pay for the item, taxes, fees, shipping, insurance, and any stated buyer premium. Failure to complete payment may result in cancellation, account restriction, or other remedies allowed by law.',
          ],
        },
        {
          title: isEs ? 'Pujas Máximas y Errores de Puja' : 'Maximum Bids and Bid Errors',
          body: [
            'If maximum bidding is offered, you are responsible for the maximum amount you enter. Contact us immediately if you believe you made a bid entry error. We may, but are not required to, correct or cancel bids when an error is clear and correction is fair to the auction.',
          ],
        },
        {
          title: isEs ? 'Condición y Autenticidad' : 'Condition and Authenticity',
          body: [
            'Auction items are usually estate, antique, or pre-owned goods. Condition reports are opinions based on available information and should not replace your own review. Additional inspection may be available before bidding when practical.',
          ],
        },
        {
          title: isEs ? 'Responsabilidades del Vendedor' : 'Seller Responsibilities',
          body: [
            'Sellers must have legal title or authority to sell submitted items and must disclose known condition issues, repairs, provenance restrictions, liens, claims, or authenticity concerns.',
          ],
        },
        {
          title: isEs ? 'Cancelación y Derechos de la Plataforma' : 'Cancellation and Platform Rights',
          body: [
            'We may withdraw lots, reject bids, cancel sales, correct errors, suspend accounts, or change auction procedures when reasonably necessary for fairness, security, legal compliance, suspected fraud, or operational reasons.',
          ],
        },
      ]}
    />
  );
}
