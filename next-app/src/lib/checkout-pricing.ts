import type { SupabaseClient } from '@supabase/supabase-js';
import type { Product } from '@/types/product';
import { isProductPurchasable } from '@/types/product';
import { fetchSpotData } from '@/lib/spot-price';
import { getProductImages, getProductMetal, getProductWeight, getSnapshotPrice } from '@/lib/sales';

// Authoritative checkout pricing. This is the single source of truth for tax,
// shipping, and the per-item snapshot prices — the frontend never sends amounts.
export const FL_TAX_RATE = 0.07;

export const SHIPPING_FEES: Record<string, number> = {
  'local-pickup': 0,
  'express-overnight-insured': 75,
  'priority-insured': 45,
};

export function shippingMethodForDb(value: string): string {
  return value === 'local-pickup' ? 'pickup' : 'shipping';
}

/** Round to whole cents. Used so order amounts and the PayPal breakdown agree. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

const CHECKOUT_PRODUCT_COLUMNS = [
  'id',
  'category',
  'metal_type',
  'metal_variant',
  'title',
  'item_year',
  'price_mode',
  'purity',
  'weight_grams',
  'inventory_number',
  'sku',
  'gram_weight',
  'pricing_multiplier',
  'status',
  'images',
  'image_urls',
  'manual_price_label',
  'asking_price',
].join(', ');

const CHECKOUT_PRODUCT_COLUMNS_WITHOUT_ITEM_YEAR = CHECKOUT_PRODUCT_COLUMNS
  .split(', ')
  .filter((column) => column !== 'item_year')
  .join(', ');

function isMissingItemYearColumnError(error: { message?: string | null } | null | undefined) {
  return Boolean(error?.message?.toLowerCase().includes('item_year'));
}

export type CheckoutOrderItem = {
  product_id: string;
  inventory_number: string;
  title_snapshot: string;
  item_year_snapshot: number | null;
  metal_snapshot: string;
  purity_snapshot: string | null;
  gram_weight_snapshot: number | null;
  price_snapshot: number;
  image_snapshot: string | null;
};

export type OrderDraft = {
  items: CheckoutOrderItem[];
  subtotal: number;
  tax: number;
  shippingFee: number;
  total: number;
};

export type OrderDraftError = { error: string; status: number };

export function isOrderDraftError(value: OrderDraft | OrderDraftError): value is OrderDraftError {
  return (value as OrderDraftError).error !== undefined;
}

/**
 * Load the products for a cart, verify they are all still purchasable, and build
 * the order item snapshots + authoritative totals. Returns an error shape (with
 * an HTTP status) instead of throwing so route handlers can respond directly.
 */
export async function buildOrderDraft(
  supabase: SupabaseClient,
  productIds: string[],
  shippingMethod: string,
): Promise<OrderDraft | OrderDraftError> {
  if (productIds.length === 0) {
    return { error: 'Cart is empty', status: 400 };
  }

  const [productResult, spotData] = await Promise.all([
    supabase.from('products').select(CHECKOUT_PRODUCT_COLUMNS).in('id', productIds),
    fetchSpotData(),
  ]);

  let products: unknown[] | null = productResult.data as unknown[] | null;
  let productsError = productResult.error;
  if (isMissingItemYearColumnError(productsError)) {
    const fallback = await supabase
      .from('products')
      .select(CHECKOUT_PRODUCT_COLUMNS_WITHOUT_ITEM_YEAR)
      .in('id', productIds);
    products = (fallback.data as unknown[] | null)?.map((product) => ({
      ...(product as Record<string, unknown>),
      item_year: null,
    })) ?? null;
    productsError = fallback.error;
  }

  if (productsError) {
    return { error: productsError.message, status: 500 };
  }

  const typedProducts = (products ?? []) as unknown as Product[];
  if (typedProducts.length !== productIds.length) {
    return { error: 'One or more cart items could not be found', status: 400 };
  }

  const unavailable = typedProducts.filter((product) => !isProductPurchasable(product.status));
  if (unavailable.length > 0) {
    return {
      error: `Unavailable item: ${unavailable.map((product) => product.title).join(', ')}`,
      status: 409,
    };
  }

  const items: CheckoutOrderItem[] = typedProducts.map((product) => ({
    product_id: product.id,
    inventory_number:
      product.inventory_number != null ? String(product.inventory_number) : product.sku ?? product.id,
    title_snapshot: product.title,
    item_year_snapshot: product.item_year,
    metal_snapshot: getProductMetal(product),
    purity_snapshot: product.purity ? String(product.purity) : null,
    gram_weight_snapshot: getProductWeight(product),
    // Round each line price to cents so the snapshot, the order total, and the
    // PayPal amount breakdown all reconcile exactly (PayPal rejects a breakdown
    // whose parts don't sum to the total).
    price_snapshot: round2(getSnapshotPrice(product, spotData)),
    image_snapshot: getProductImages(product)[0] ?? null,
  }));

  // Never let a $0 (or negative) line item reach checkout. A snapshot price of 0
  // means the item has no usable price — an unparsable manual label ("Contact
  // for price"), a spot item missing weight/purity, or asking_price = 0. These
  // must be handled by a phone call, not sold online for nothing. (CODE-D01)
  const invalidPriced = items.filter((item) => !(item.price_snapshot > 0));
  if (invalidPriced.length > 0) {
    return {
      error: `This item isn't available for online purchase yet: ${invalidPriced
        .map((item) => item.title_snapshot)
        .join(', ')}. Please call (239) 404-8505 to buy it.`,
      status: 409,
    };
  }

  const subtotal = round2(items.reduce((sum, item) => sum + item.price_snapshot, 0));
  const shippingFee = SHIPPING_FEES[shippingMethod] ?? 0;
  const tax = round2(subtotal * FL_TAX_RATE);
  const total = round2(subtotal + tax + shippingFee);

  return { items, subtotal, tax, shippingFee, total };
}
