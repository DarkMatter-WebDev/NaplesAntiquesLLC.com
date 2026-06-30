export type PaymentStatus =
  | 'unpaid'
  | 'pending'
  | 'paid'
  | 'failed'
  | 'refunded'
  | 'partially_refunded';

export type FulfillmentStatus =
  | 'pending'
  | 'packed'
  | 'shipped'
  | 'picked_up'
  | 'cancelled';

export type OrderStatus = 'open' | 'completed' | 'cancelled' | 'refunded';

export type ShippingMethod = 'pickup' | 'shipping' | 'local_delivery';

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  inventory_number: string | null;
  title_snapshot: string;
  item_year_snapshot: number | null;
  metal_snapshot: string | null;
  purity_snapshot: string | null;
  gram_weight_snapshot: number | null;
  price_snapshot: number;
  discount?: number;
  image_snapshot: string | null;
  created_at: string;
}

export interface Order {
  id: string;
  order_number: string;
  user_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  subtotal: number;
  tax: number;
  shipping_fee: number;
  discount: number;
  total: number;
  payment_status: PaymentStatus;
  fulfillment_status: FulfillmentStatus;
  order_status: OrderStatus;
  payment_method: string | null;
  payment_reference: string | null;
  shipping_method: ShippingMethod;
  shipping_address: Record<string, unknown> | null;
  billing_address: Record<string, unknown> | null;
  internal_notes: string | null;
  customer_notes: string | null;
  refund_amount: number | null;
  created_at: string;
  updated_at: string;
  order_items?: OrderItem[];
}

export function formatCurrency(value: number | null | undefined): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value ?? 0);
}

export function formatOrderDate(value: string | null | undefined): string {
  if (!value) return '-';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

export function orderStatusLabel(value: string | null | undefined): string {
  if (!value) return '-';
  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}
