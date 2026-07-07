import type { SupabaseClient } from '@supabase/supabase-js';
import type { Product } from '@/types/product';
import { isProductPurchasable, normalizeProductQuantity } from '@/types/product';
import { fetchSpotData } from '@/lib/spot-price';
import { getProductImages, getProductMetal, getProductWeight, getSnapshotPrice } from '@/lib/sales';

// Authoritative checkout pricing. This is the single source of truth for tax,
// shipping, and the per-item snapshot prices — the frontend never sends amounts.
// FL_TAX_RATE is THE one source of truth for the rate — cart/checkout/admin all
// import it so the displayed and charged rate can never drift apart again (they
// previously diverged: 7% checkout vs 6.5% admin).
export const FL_TAX_RATE = 0.06;
// Human label for the rate, kept next to it so the two never disagree.
export const FL_TAX_RATE_LABEL = '6%';

export const SHIPPING_FEES: Record<string, number> = {
  'local-pickup': 0,
  'express-overnight-insured': 75,
  'priority-insured': 45,
};

export function shippingMethodForDb(value: string): string {
  return value === 'local-pickup' ? 'pickup' : 'shipping';
}

// FL sales tax nexus: we only collect it when the sale is completed in Florida —
// local pickup (always happens here in Naples) or a shipping address within FL.
// Out-of-state shipments are not taxed. Matches common free-text entries for the
// state field ("FL", "Fla", "Florida", any case/whitespace).
export function isFloridaState(state: string | null | undefined): boolean {
  const normalized = (state ?? '').trim().toLowerCase().replace(/\.$/, '');
  return normalized === 'fl' || normalized === 'fla' || normalized === 'florida';
}

// `shippingMethod` here is the raw checkout value ('local-pickup' | 'express-…' |
// 'priority-…'), not the DB-normalized `orders.shipping_method` column value.
export function chargesFlSalesTax(shippingMethod: string, shippingState: string | null | undefined): boolean {
  return shippingMethod === 'local-pickup' || isFloridaState(shippingState);
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
  'quantity',
].join(', ');

const CHECKOUT_PRODUCT_COLUMNS_WITHOUT_ITEM_YEAR = CHECKOUT_PRODUCT_COLUMNS
  .split(', ')
  .filter((column) => column !== 'item_year' && column !== 'quantity')
  .join(', ');

function isMissingItemYearColumnError(error: { message?: string | null } | null | undefined) {
  return Boolean(error?.message?.toLowerCase().includes('item_year'))
    || Boolean(error?.message?.toLowerCase().includes('quantity'));
}

export type CheckoutOrderItem = {
  product_id: string;
  inventory_number: string;
  title_snapshot: string;
  item_year_snapshot: number | null;
  metal_snapshot: string;
  purity_snapshot: string | null;
  gram_weight_snapshot: number | null;
  // Unit price for one unit of the item. The line total is price_snapshot * quantity.
  price_snapshot: number;
  quantity: number;
  image_snapshot: string | null;
};

// A requested cart line: which product and how many units of it the buyer wants.
export type OrderLine = { productId: string; quantity: number };

// Accept either the legacy string[] of product ids (each treated as quantity 1)
// or the quantity-aware line shape. Normalizes to unique lines with a positive
// integer quantity, dropping blanks.
export function normalizeOrderLines(input: string[] | OrderLine[]): OrderLine[] {
  const byId = new Map<string, number>();
  for (const entry of input) {
    const productId = typeof entry === 'string' ? entry : String(entry?.productId ?? '');
    if (!productId) continue;
    const rawQty = typeof entry === 'string' ? 1 : Number(entry?.quantity);
    const quantity = Number.isFinite(rawQty) ? Math.max(1, Math.floor(rawQty)) : 1;
    byId.set(productId, (byId.get(productId) ?? 0) + quantity);
  }
  return Array.from(byId, ([productId, quantity]) => ({ productId, quantity }));
}

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
  lines: string[] | OrderLine[],
  shippingMethod: string,
  shippingState?: string | null,
): Promise<OrderDraft | OrderDraftError> {
  const orderLines = normalizeOrderLines(lines);
  if (orderLines.length === 0) {
    return { error: 'Cart is empty', status: 400 };
  }

  const productIds = orderLines.map((line) => line.productId);
  const quantityByProductId = new Map(orderLines.map((line) => [line.productId, line.quantity]));

  // Whitelist the shipping method. An unknown value used to silently resolve to a
  // $0 fee (SHIPPING_FEES[x] ?? 0) while still being recorded as a shipped order —
  // i.e. free insured shipping via a tampered request.
  if (!(shippingMethod in SHIPPING_FEES)) {
    return { error: 'Invalid shipping method.', status: 400 };
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
      quantity: 1,
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

  const unavailable = typedProducts.filter((product) => !isProductPurchasable(product.status, product.quantity));
  if (unavailable.length > 0) {
    return {
      error: `Unavailable item: ${unavailable.map((product) => product.title).join(', ')}`,
      status: 409,
    };
  }

  // Reject any line whose requested quantity exceeds live stock. This is the
  // snapshot gate; the capture RPC re-checks under a row lock before selling.
  const overstocked = typedProducts.filter(
    (product) => (quantityByProductId.get(product.id) ?? 1) > normalizeProductQuantity(product.quantity),
  );
  if (overstocked.length > 0) {
    return {
      error: `Not enough stock for: ${overstocked
        .map((product) => `${product.title} (only ${normalizeProductQuantity(product.quantity)} available)`)
        .join(', ')}. Please lower the quantity.`,
      status: 409,
    };
  }

  // If the live metal feed is down, fetchSpotData() returns a hardcoded fallback
  // spot (spot-price.ts). That is fine for *display*, but must never set the
  // chargeable price of a spot-linked item — the fallback can diverge sharply from
  // the real market and would let a buyer lock in an off-market price during an
  // outage. Manual fixed-price items are unaffected because their chargeable
  // amount comes from the saved Price Label.
  if (spotData.source === 'fallback') {
    const spotLinked = typedProducts.filter(
      (product) => product.price_mode !== 'manual',
    );
    if (spotLinked.length > 0) {
      return {
        error: `Live metal pricing is temporarily unavailable, so these items can't be purchased online right now: ${spotLinked
          .map((product) => product.title)
          .join(', ')}. Please call (239) 404-8505 to complete your purchase.`,
        status: 503,
      };
    }
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
    // Round each unit price to cents so the snapshot, the order total, and the
    // PayPal amount breakdown all reconcile exactly (PayPal rejects a breakdown
    // whose parts don't sum to the total).
    price_snapshot: round2(getSnapshotPrice(product, spotData)),
    quantity: quantityByProductId.get(product.id) ?? 1,
    image_snapshot: getProductImages(product)[0] ?? null,
  }));

  // Never let a $0 (or negative) line item reach checkout. A snapshot price of 0
  // means the item has no usable price — an unparsable manual label ("Contact
  // for price") or a spot item missing weight/purity. These
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

  const subtotal = round2(items.reduce((sum, item) => sum + item.price_snapshot * item.quantity, 0));
  const shippingFee = SHIPPING_FEES[shippingMethod] ?? 0;
  const tax = chargesFlSalesTax(shippingMethod, shippingState) ? round2(subtotal * FL_TAX_RATE) : 0;
  const total = round2(subtotal + tax + shippingFee);

  return { items, subtotal, tax, shippingFee, total };
}
