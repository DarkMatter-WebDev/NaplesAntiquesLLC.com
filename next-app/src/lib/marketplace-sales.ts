/**
 * Inbound marketplace sales → site "Sold" (owner, 2026-09-12: "an item sells
 * on Etsy → automatically mark it sold on our site, which in turn ends it on
 * eBay, and the same for eBay").
 *
 * PURE half. The 30-minute reconcile sweeps read paid orders from each
 * marketplace (`lib/marketplace-sales-sweep.ts`), and these functions decide
 * which order lines are real sales of products we know, and where the cursor
 * moves. Nothing here touches a network or the database, so the rules are
 * unit-tested: `lib/__tests__/marketplace-sales.test.ts`.
 *
 * Rules the owner set:
 * - Only sales made AFTER the feature is enabled count ("I've covered all
 *   previous sales"): the first run ARMS the cursor at "now" and processes
 *   nothing; later runs read from the cursor (minus a small overlap — the
 *   `marketplace_sale_events` table makes re-reads harmless).
 * - Cancelled / fully refunded orders are never sales, and nothing here ever
 *   UN-sells a product.
 * - `sold_price` becomes what the buyer paid for the item (before shipping).
 */
export type SaleChannel = 'etsy' | 'ebay';

export interface MarketplaceSaleLine {
  channel: SaleChannel;
  externalOrderId: string;
  externalLineId: string;
  productId: string;
  quantity: number;
  /** Unit price the buyer paid for the item, in USD. */
  salePrice: number | null;
  /** When the marketplace created the order (ISO). */
  createdAt: string;
  /** What the marketplace called the item — for the log row. */
  title: string | null;
}

/** An order line we could not tie to a product — logged, never acted on. */
export interface UnmatchedSaleLine {
  channel: SaleChannel;
  externalOrderId: string;
  externalLineId: string;
  reference: string;
  title: string | null;
}

/** OAuth scope each connection must hold before orders can be read. */
export const ETSY_SALES_SCOPE = 'transactions_r';
export const EBAY_SALES_SCOPE = 'https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly';

/** Re-read this much before the cursor on every run — a late-arriving order never falls through the gap. */
export const SALES_CURSOR_OVERLAP_MS = 10 * 60 * 1000;

export function hasSalesScope(channel: SaleChannel, scopes: string[] | null | undefined): boolean {
  const needed = channel === 'etsy' ? ETSY_SALES_SCOPE : EBAY_SALES_SCOPE;
  return Array.isArray(scopes) && scopes.includes(needed);
}

/** The earliest order time to ask the marketplace for, given the stored cursor. */
export function salesReadFrom(cursor: string | Date, overlapMs = SALES_CURSOR_OVERLAP_MS): Date {
  const at = typeof cursor === 'string' ? new Date(cursor) : cursor;
  return new Date(at.getTime() - overlapMs);
}

// ---------------------------------------------------------------------------
// Etsy — shop receipts (GET /v3/application/shops/{shop_id}/receipts)
// ---------------------------------------------------------------------------
export interface EtsyReceiptTransaction {
  transaction_id: number;
  listing_id: number | null;
  sku?: string | null;
  title?: string | null;
  quantity: number;
  price?: { amount: number; divisor: number; currency_code?: string } | null;
}

export interface EtsyReceipt {
  receipt_id: number;
  status?: string | null;
  is_paid?: boolean;
  /** Unix seconds. Etsy sends both spellings depending on the API vintage. */
  created_timestamp?: number;
  create_timestamp?: number;
  transactions?: EtsyReceiptTransaction[];
}

/** Receipt statuses that are NOT a sale we should act on. Etsy's casing varies, so compare lower-cased. */
const ETSY_NON_SALE_STATUSES = new Set(['canceled', 'cancelled', 'fully refunded']);

export function etsyReceiptIsSale(receipt: EtsyReceipt): boolean {
  if (receipt.is_paid === false) return false;
  const status = (receipt.status ?? '').trim().toLowerCase();
  return !ETSY_NON_SALE_STATUSES.has(status);
}

function etsyMoney(price: EtsyReceiptTransaction['price']): number | null {
  if (!price || !Number.isFinite(price.amount) || !price.divisor) return null;
  return Math.round(((price.amount / price.divisor) + Number.EPSILON) * 100) / 100;
}

function etsyCreatedAt(receipt: EtsyReceipt): string {
  const seconds = receipt.created_timestamp ?? receipt.create_timestamp ?? 0;
  return new Date(seconds * 1000).toISOString();
}

export interface EtsySaleSelection {
  sales: MarketplaceSaleLine[];
  unmatched: UnmatchedSaleLine[];
  /** Receipts skipped as cancelled / refunded / unpaid. */
  skippedReceipts: number;
}

/**
 * Turn Etsy receipts into product sale lines. `listingToProduct` maps our
 * `etsy_listings.etsy_listing_id` → `product_id`; a line whose listing we
 * never synced (listed on Etsy by hand) is reported as unmatched.
 */
export function selectEtsySaleLines(receipts: readonly EtsyReceipt[], listingToProduct: ReadonlyMap<number, string>): EtsySaleSelection {
  const sales: MarketplaceSaleLine[] = [];
  const unmatched: UnmatchedSaleLine[] = [];
  let skippedReceipts = 0;
  for (const receipt of receipts) {
    if (!etsyReceiptIsSale(receipt)) {
      skippedReceipts += 1;
      continue;
    }
    for (const line of receipt.transactions ?? []) {
      const productId = line.listing_id != null ? listingToProduct.get(line.listing_id) : undefined;
      const quantity = Math.max(1, Math.floor(Number(line.quantity) || 1));
      if (!productId) {
        unmatched.push({
          channel: 'etsy',
          externalOrderId: String(receipt.receipt_id),
          externalLineId: String(line.transaction_id),
          reference: line.listing_id != null ? `listing ${line.listing_id}` : (line.sku ?? 'no listing id'),
          title: line.title ?? null,
        });
        continue;
      }
      sales.push({
        channel: 'etsy',
        externalOrderId: String(receipt.receipt_id),
        externalLineId: String(line.transaction_id),
        productId,
        quantity,
        salePrice: etsyMoney(line.price),
        createdAt: etsyCreatedAt(receipt),
        title: line.title ?? null,
      });
    }
  }
  return { sales, unmatched, skippedReceipts };
}

// ---------------------------------------------------------------------------
// eBay — Sell Fulfillment orders (GET /sell/fulfillment/v1/order)
// ---------------------------------------------------------------------------
export interface EbayOrderLineItem {
  lineItemId: string;
  legacyItemId?: string | null;
  sku?: string | null;
  title?: string | null;
  quantity: number;
  lineItemCost?: { value?: string | number; currency?: string } | null;
}

export interface EbayOrder {
  orderId: string;
  creationDate?: string;
  orderPaymentStatus?: string | null;
  cancelStatus?: { cancelState?: string | null } | null;
  lineItems?: EbayOrderLineItem[];
}

/** Paid, and a partial refund (shipping, a courtesy) still means the item sold. */
const EBAY_SALE_PAYMENT_STATUSES = new Set(['PAID', 'PARTIALLY_REFUNDED']);

export function ebayOrderIsSale(order: EbayOrder): boolean {
  const payment = (order.orderPaymentStatus ?? '').toUpperCase();
  if (!EBAY_SALE_PAYMENT_STATUSES.has(payment)) return false;
  const cancel = (order.cancelStatus?.cancelState ?? 'NONE_REQUESTED').toUpperCase();
  return cancel === 'NONE_REQUESTED';
}

function ebayMoney(cost: EbayOrderLineItem['lineItemCost'], quantity: number): number | null {
  if (!cost || cost.value == null) return null;
  const total = Number(cost.value);
  if (!Number.isFinite(total)) return null;
  // lineItemCost is the line total; the product wants a unit price.
  return Math.round(((total / Math.max(1, quantity)) + Number.EPSILON) * 100) / 100;
}

export interface EbaySaleSelection {
  sales: MarketplaceSaleLine[];
  unmatched: UnmatchedSaleLine[];
  skippedOrders: number;
}

/**
 * Turn eBay orders into product sale lines. `skuToProduct` maps
 * `ebay_listings.ebay_sku` → `product_id`; `itemToProduct` maps
 * `ebay_listing_id` → `product_id` as the fallback when a SKU is absent.
 */
export function selectEbaySaleLines(
  orders: readonly EbayOrder[],
  skuToProduct: ReadonlyMap<string, string>,
  itemToProduct: ReadonlyMap<string, string>,
): EbaySaleSelection {
  const sales: MarketplaceSaleLine[] = [];
  const unmatched: UnmatchedSaleLine[] = [];
  let skippedOrders = 0;
  for (const order of orders) {
    if (!ebayOrderIsSale(order)) {
      skippedOrders += 1;
      continue;
    }
    for (const line of order.lineItems ?? []) {
      const quantity = Math.max(1, Math.floor(Number(line.quantity) || 1));
      const productId =
        (line.sku ? skuToProduct.get(line.sku) : undefined)
        ?? (line.legacyItemId ? itemToProduct.get(String(line.legacyItemId)) : undefined);
      if (!productId) {
        unmatched.push({
          channel: 'ebay',
          externalOrderId: order.orderId,
          externalLineId: line.lineItemId,
          reference: line.sku ? `sku ${line.sku}` : line.legacyItemId ? `item ${line.legacyItemId}` : 'no sku or item id',
          title: line.title ?? null,
        });
        continue;
      }
      sales.push({
        channel: 'ebay',
        externalOrderId: order.orderId,
        externalLineId: line.lineItemId,
        productId,
        quantity,
        salePrice: ebayMoney(line.lineItemCost, quantity),
        createdAt: order.creationDate ?? new Date(0).toISOString(),
        title: line.title ?? null,
      });
    }
  }
  return { sales, unmatched, skippedOrders };
}

// ---------------------------------------------------------------------------
// Outcomes — what `apply_marketplace_sale()` reports per line, and the sweep summary
// ---------------------------------------------------------------------------
export type SaleApplyOutcome = 'sold' | 'decremented' | 'duplicate' | 'not_available' | 'missing_product' | 'error';

export interface SalesSweepSummary {
  ordersRead: number;
  sold: number;
  decremented: number;
  alreadyHandled: number;
  unmatched: number;
  failed: number;
}

export function emptySalesSweepSummary(): SalesSweepSummary {
  return { ordersRead: 0, sold: 0, decremented: 0, alreadyHandled: 0, unmatched: 0, failed: 0 };
}

export function countSaleOutcome(summary: SalesSweepSummary, outcome: SaleApplyOutcome): void {
  if (outcome === 'sold') summary.sold += 1;
  else if (outcome === 'decremented') summary.decremented += 1;
  else if (outcome === 'duplicate' || outcome === 'not_available') summary.alreadyHandled += 1;
  else summary.failed += 1;
}

export function formatSalesSweepSummary(channelName: string, summary: SalesSweepSummary): string {
  return `${channelName} sales: ${summary.ordersRead} order${summary.ordersRead === 1 ? '' : 's'} read, `
    + `${summary.sold} marked sold, ${summary.decremented} quantity reduced, ${summary.alreadyHandled} already handled, `
    + `${summary.unmatched} not ours, ${summary.failed} failed`;
}

export function salesSweepOutcomeLevel(summary: SalesSweepSummary): 'ok' | 'warning' | 'error' {
  if (summary.failed > 0) return 'error';
  if (summary.unmatched > 0) return 'warning';
  return 'ok';
}
