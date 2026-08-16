import { getProductSoldPriceLock, isProductSold, type Product, type SpotData } from '@/types/product';

const GRAMS_PER_TROY_OZ = 31.1034768;
const FALLBACK_GOLD_SPOT = 5500;
const FALLBACK_SILVER_SPOT = 33;

// Purity (karat or fineness) → decimal gold fraction
export function purityToFraction(purity: number): number {
  if (purity > 100) return purity / 1000; // fineness (750, 585, 375…)
  if (purity <= 24) return purity / 24;   // karat (10, 14, 18…)
  return purity / 100;
}

/**
 * Item prices are whole dollars — owner policy, 2026-08-15. A piece is offered
 * and charged at a round figure, so the number on a shop card is exactly the
 * number PayPal collects.
 *
 * The rounding happens on the VALUE, never in a formatter alone. Display and
 * charge are computed on separate paths (a shop card formats getDisplayPrice;
 * checkout charges getSnapshotPrice via getProductPriceValue), so rounding only
 * the formatter would show $5,533 and collect $5,533.47 — precisely what
 * "Never charge a total the buyer was not shown" forbids.
 *
 * Deliberately NOT rounded:
 * - a captured sold price, which is a historical amount rather than an offer;
 * - melt/scrap value and the live spot ticker, which are market quotes;
 * - tax and order totals, because 6% of a whole dollar is not a whole dollar.
 */
export function roundToWholeDollar(price: number): number {
  return Math.round(price);
}

/**
 * THE price formatter. There is deliberately only one. Two formatters with
 * different decimal policies is what let manual-priced items render cents while
 * spot-priced items rendered whole dollars on the same shop grid.
 */
export function formatUsdPrice(price: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(price);
}

export function parseManualPriceLabelValue(label: string | null | undefined): number | null {
  const value = (label ?? '').trim();
  if (!value) return null;

  const match = value.match(/^\$?\s*([0-9][0-9,]*(?:\.\d{1,2})?)\s*$/);
  if (!match) return null;

  const parsed = Number(match[1].replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeManualPriceLabel(label: string | null | undefined): string | null {
  const value = (label ?? '').trim();
  if (!value) return null;

  const parsed = parseManualPriceLabelValue(value);
  return parsed == null ? value : formatUsdPrice(roundToWholeDollar(parsed));
}

export function calcSpotPriceValue(product: Product, spotData: SpotData | null): number | null {
  if (product.price_mode !== 'spot-multiplier') return null;
  const { pricing_multiplier } = product;
  const meltValue = calcSpotMeltValue(product, spotData);
  if (meltValue == null || !pricing_multiplier) return null;
  return meltValue * pricing_multiplier;
}

export function calcSpotMeltValue(product: Product, spotData: SpotData | null): number | null {
  const weightGrams = product.gram_weight ?? product.weight_grams;
  const { purity } = product;
  if (!weightGrams || !purity) return null;

  const spotPerOz = product.category === 'Silver'
    ? (spotData?.silverPerTroyOz ?? FALLBACK_SILVER_SPOT)
    : (spotData?.goldPerTroyOz ?? FALLBACK_GOLD_SPOT);
  const spotPerGram = spotPerOz / GRAMS_PER_TROY_OZ;
  return weightGrams * purityToFraction(purity) * spotPerGram;
}

/**
 * Marketplace writes must never flatten a storefront fallback into a real
 * Etsy/eBay price. The storefront may keep rendering an explicitly-labelled
 * estimate during a provider outage, but an external marketplace write is a
 * durable financial action and therefore fails closed.
 */
export function getMarketplaceSpotPriceError(product: Product, spotData: SpotData | null): string | null {
  if (product.price_mode !== 'spot-multiplier' || getProductSoldPriceLock(product) != null) return null;
  if (!spotData || spotData.source !== 'api') {
    return 'Live metal spot pricing is unavailable. Marketplace pricing was not changed.';
  }

  const relevantSpot = product.category === 'Silver'
    ? spotData.silverPerTroyOz
    : spotData.goldPerTroyOz;
  if (relevantSpot == null || !Number.isFinite(relevantSpot) || relevantSpot <= 0) {
    return `Live ${product.category.toLowerCase()} spot pricing is unavailable. Marketplace pricing was not changed.`;
  }

  return null;
}

/**
 * THE chargeable price of one unit, and the same number every surface displays.
 * Checkout, PayPal, eBay, Etsy, the social card, and Deep Field all read it, so
 * rounding here is what keeps the shown price and the collected price identical.
 */
export function getProductPriceValue(product: Product, spotData: SpotData | null): number | null {
  // A captured sale is a record of what someone actually paid, not an offer.
  // It keeps its exact recorded amount; re-rounding it would misstate history.
  const lockedPrice = getProductSoldPriceLock(product);
  if (lockedPrice != null) return lockedPrice;

  const offered = product.price_mode === 'manual'
    ? parseManualPriceLabelValue(product.manual_price_label)
    : calcSpotPriceValue(product, spotData);
  return offered == null ? null : roundToWholeDollar(offered);
}

export function getSpotMeltDisplayPrice(product: Product, spotData: SpotData | null): string {
  const value = calcSpotMeltValue(product, spotData);
  return value == null ? '-' : formatUsdPrice(value);
}

/**
 * Formats exactly the value getProductPriceValue resolved — one path, so the
 * card and the charge can never disagree.
 */
export function getDisplayPrice(product: Product, spotData: SpotData | null): string {
  const value = getProductPriceValue(product, spotData);
  if (value != null) return formatUsdPrice(value);

  // A manual label that is not a parseable amount ("Contact for price",
  // "Call for pricing") is prose, not a number. Show it verbatim.
  const label = (product.manual_price_label ?? '').trim();
  if (product.price_mode === 'manual' && label) return label;
  return 'Contact for price';
}

export function getStorefrontDisplayPrice(
  product: Product,
  spotData: SpotData | null,
  hideSoldItemPrices: boolean,
  locale = 'en',
): string {
  if (hideSoldItemPrices && isProductSold(product.status)) {
    return locale === 'es' ? 'Vendido' : 'Sold';
  }
  return getDisplayPrice(product, spotData);
}

export function getPriceContext(product: Product, spotData: SpotData | null, locale = 'en'): string {
  if (product.price_mode === 'manual') {
    return locale === 'es' ? 'Precio manual' : 'Manual price';
  }
  if (!spotData) {
    return locale === 'es' ? 'Precio estimado' : 'Estimated price';
  }
  const isSilver = product.category === 'Silver';
  const metal = isSilver
    ? (locale === 'es' ? 'plata' : 'silver')
    : (locale === 'es' ? 'oro' : 'gold');
  const source = spotData.source === 'fallback'
    ? (locale === 'es' ? 'precio de respaldo' : 'fallback price')
    : (locale === 'es' ? 'precio spot en vivo' : 'live spot price');
  return locale === 'es' ? `Basado en spot de ${metal} (${source})` : `Based on ${metal} spot (${source})`;
}
