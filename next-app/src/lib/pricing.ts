import type { Product, SpotData } from '@/types/product';

const GRAMS_PER_TROY_OZ = 31.1034768;
const FALLBACK_GOLD_SPOT = 5500;
const FALLBACK_SILVER_SPOT = 33;

// Purity (karat or fineness) → decimal gold fraction
export function purityToFraction(purity: number): number {
  if (purity > 100) return purity / 1000; // fineness (750, 585, 375…)
  if (purity <= 24) return purity / 24;   // karat (10, 14, 18…)
  return purity / 100;
}

export function calcSpotPrice(product: Product, spotData: SpotData | null): string | null {
  if (product.price_mode !== 'spot-multiplier') return null;
  const { weight_grams, purity, pricing_multiplier } = product;
  if (!weight_grams || !purity || !pricing_multiplier) return null;

  const spotPerOz = product.category === 'Silver'
    ? (spotData?.silverPerTroyOz ?? FALLBACK_SILVER_SPOT)
    : (spotData?.goldPerTroyOz ?? FALLBACK_GOLD_SPOT);
  const spotPerGram = spotPerOz / GRAMS_PER_TROY_OZ;
  const meltValue = weight_grams * purityToFraction(purity) * spotPerGram;
  const price = meltValue * pricing_multiplier;

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(price);
}

export function getDisplayPrice(product: Product, spotData: SpotData | null): string {
  if (product.price_mode === 'manual') {
    return product.manual_price_label ?? 'Contact for price';
  }
  return calcSpotPrice(product, spotData) ?? 'Contact for price';
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
