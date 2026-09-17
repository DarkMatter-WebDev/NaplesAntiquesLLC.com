// The Offer inside a product page's Product JSON-LD.
//
// Why a helper (2026-09-16): Search Console flagged every SOLD product page
// ("Missing field price (in offers)") because the schema used to copy the
// storefront label, and the admin "hide sold item prices" setting turns that
// label into the word "Sold". Google requires a price on every Offer, sold out
// or not, so the schema now reads the canonical price VALUE — the same helper
// checkout, the feeds and the marketplaces use — which for a sold item is the
// recorded sale price (or, before one is recorded, the last asking price).
// The visible page keeps saying "Sold"; only the machine-readable schema
// carries the number. Any future sale therefore never produces this error.
//
// When no numeric price exists at all (a manual "Contact for price" label),
// there is no valid Offer to emit. Google then rejects an Offer without a
// price AND a Product without offers/review/rating, so the page emits no
// Product schema rather than an invalid one — a plain indexed page with no
// rich result, which is the honest state of a priceless listing.

const SELLER = { '@type': 'Organization', name: 'Naples Estate Jewelry' } as const;

export type ProductOfferLd = {
  '@type': 'Offer';
  url: string;
  priceCurrency: 'USD';
  price: string;
  priceValidUntil?: string;
  availability: 'https://schema.org/InStock' | 'https://schema.org/SoldOut';
  itemCondition: 'https://schema.org/UsedCondition';
  seller: typeof SELLER;
};

export type ProductOfferInput = {
  /** getProductPriceValue(product, spot): sold-price lock, manual amount, or spot price. */
  priceValue: number | null | undefined;
  /** Canonical product URL for the active locale. */
  url: string;
  /** isProductPurchasable(status, quantity). */
  isPurchasable: boolean;
  /** YYYY-MM-DD; only attached while the item is still for sale. */
  priceValidUntil: string;
};

/**
 * Offer for the Product schema, or `null` when there is no numeric price —
 * in which case the caller must omit the Product schema entirely.
 */
export function productOfferLd(input: ProductOfferInput): ProductOfferLd | null {
  const { priceValue, url, isPurchasable, priceValidUntil } = input;
  if (priceValue == null || !Number.isFinite(priceValue) || priceValue < 0) return null;
  // Whole dollars stay whole ("1460"); cents survive ("1460.5").
  const price = String(priceValue);
  return {
    '@type': 'Offer',
    url,
    priceCurrency: 'USD',
    price,
    // A recorded sale is history, not an offer with a shelf life.
    ...(isPurchasable ? { priceValidUntil } : {}),
    availability: isPurchasable ? 'https://schema.org/InStock' : 'https://schema.org/SoldOut',
    itemCondition: 'https://schema.org/UsedCondition',
    seller: SELLER,
  };
}
