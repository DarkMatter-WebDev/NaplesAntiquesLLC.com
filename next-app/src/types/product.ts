export type ProductStatus =
  | 'draft'
  | 'available'
  | 'reserved'
  | 'pending_payment'
  | 'sold'
  | 'archived'
  | 'Available'
  | 'Sold';

export type ProductLocation =
  | 'showcase'
  | 'safe'
  | 'offsite'
  | 'shipped'
  | 'picked_up';

export interface Product {
  id: string;
  category: 'Gold' | 'Silver';
  title: string;
  title_es: string | null;
  price_label: string | null;
  manual_price_label: string | null;
  price_mode: 'spot-multiplier' | 'manual';
  purity: number | null;
  weight_grams: number | null;
  inventory_number: number | null;
  sku: string | null;
  slug: string | null;
  metal: string | null;
  gram_weight: number | null;
  stone_details: string | null;
  chain_type: string | null;
  length: string | null;
  pricing_multiplier: number | null;
  status: ProductStatus;
  location: ProductLocation | string | null;
  images: string[];
  image_urls: string[];
  description: string | null;
  description_es: string | null;
  details: string[];
  details_es: string[];
  tags: string[];
  tags_es: string[];
  private_price_label: string | null;
  gender: string | null;
  cost_basis: number | null;
  melt_value: number | null;
  asking_price: number | null;
  minimum_price: number | null;
  live_spot_snapshot: Record<string, unknown> | null;
  acquisition_date: string | null;
  acquisition_source: string | null;
  internal_notes: string | null;
  public_notes: string | null;
  featured: boolean | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface SpotData {
  goldPerTroyOz: number;
  silverPerTroyOz: number | null;
  fetchedAt: number;
  source: 'api' | 'fallback';
}

export function normalizeProductStatus(status: ProductStatus | null | undefined): ProductStatus {
  const value = String(status ?? 'available').toLowerCase().replace(/\s+/g, '_');
  if (value === 'draft') return 'draft';
  if (value === 'reserved') return 'reserved';
  if (value === 'pending_payment') return 'pending_payment';
  if (value === 'sold') return 'sold';
  if (value === 'archived') return 'archived';
  return 'available';
}

export function isProductSold(status: ProductStatus | null | undefined): boolean {
  return normalizeProductStatus(status) === 'sold';
}

export function isProductPurchasable(status: ProductStatus | null | undefined): boolean {
  return normalizeProductStatus(status) === 'available';
}

export function productStatusLabel(status: ProductStatus | null | undefined): string {
  const normalized = normalizeProductStatus(status);
  if (normalized === 'pending_payment') return 'Pending Payment';
  return normalized.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}
