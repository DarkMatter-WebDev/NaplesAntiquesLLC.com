import type { Product } from '@/types/product';
import { productMetalVariantLabel } from '@/types/product';
import type { SpotData } from '@/types/product';
import { getProductPriceValue } from '@/lib/pricing';

export function generateOrderNumber(date = new Date()): string {
  const stamp = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('');
  const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `NEJ-${stamp}-${suffix}`;
}

export function getProductImages(product: Product): string[] {
  return product.image_urls?.length ? product.image_urls : product.images ?? [];
}

export function getProductMetal(product: Product): string {
  return productMetalVariantLabel(product.metal_variant, product.category);
}

export function getProductWeight(product: Product): number | null {
  return product.gram_weight ?? product.weight_grams ?? null;
}

export function getSnapshotPrice(product: Product, spotData: SpotData | null): number {
  const resolved = getProductPriceValue(product, spotData);
  if (resolved != null) return resolved;
  if (product.price_mode === 'manual' && product.asking_price != null) return Number(product.asking_price);
  return 0;
}

export function buildAddressObject(fields: {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}) {
  const address = {
    line1: fields.line1?.trim() || null,
    line2: fields.line2?.trim() || null,
    city: fields.city?.trim() || null,
    state: fields.state?.trim() || null,
    postal_code: fields.postalCode?.trim() || null,
    country: fields.country?.trim() || 'United States',
  };
  return Object.values(address).some(Boolean) ? address : null;
}
