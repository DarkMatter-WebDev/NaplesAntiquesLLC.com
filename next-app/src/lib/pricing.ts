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
  const price = calcSpotPriceValue(product, spotData);
  if (price == null) return null;

  return formatUsdPrice(price);
}

export function formatUsdPrice(price: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(price);
}

export function formatManualPriceAmount(price: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: Number.isInteger(price) ? 0 : 2,
    maximumFractionDigits: 2,
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
  return parsed == null ? value : formatManualPriceAmount(parsed);
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

export function getSpotMeltDisplayPrice(product: Product, spotData: SpotData | null): string {
  const value = calcSpotMeltValue(product, spotData);
  return value == null ? '-' : formatUsdPrice(value);
}

export function getDisplayPrice(product: Product, spotData: SpotData | null): string {
  if (product.price_mode === 'manual') {
    return normalizeManualPriceLabel(product.manual_price_label) ?? 'Contact for price';
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
