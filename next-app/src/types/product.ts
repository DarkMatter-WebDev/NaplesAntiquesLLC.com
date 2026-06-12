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
  pricing_multiplier: number | null;
  status: 'Available' | 'Sold';
  images: string[];
  description: string | null;
  description_es: string | null;
  details: string[];
  details_es: string[];
  tags: string[];
  tags_es: string[];
  private_price_label: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface SpotData {
  goldPerTroyOz: number;
  fetchedAt: number;
  source: 'api' | 'fallback';
}
