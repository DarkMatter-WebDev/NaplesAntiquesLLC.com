import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

const INVOICE_ORDER_COLUMNS =
  'id, order_number, user_id, customer_name, customer_email, subtotal, tax, shipping_fee, discount, total, payment_status';

export type OrderInvoiceRecord = {
  id: string;
  invoice_number: string;
  status: string;
  total: number;
  created_at: string;
};

export type UpsertOrderInvoiceResult =
  | { ok: true; invoice: OrderInvoiceRecord }
  | { ok: false; error: string };

function invoiceNumberForOrderNumber(orderNumber: string | null | undefined) {
  return `INV-${String(orderNumber ?? '').replace(/^NEJ-/, '')}`;
}

function invoiceStatusForPaymentStatus(paymentStatus: string | null | undefined) {
  return String(paymentStatus ?? '').trim().toLowerCase() === 'paid' ? 'paid' : 'draft';
}

export async function upsertOrderInvoice(
  supabase: SupabaseClient,
  orderId: string,
): Promise<UpsertOrderInvoiceResult> {
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select(INVOICE_ORDER_COLUMNS)
    .eq('id', orderId)
    .maybeSingle();

  if (orderError || !order) {
    return { ok: false, error: orderError?.message ?? 'Order not found.' };
  }

  const invoiceNumber = invoiceNumberForOrderNumber(order.order_number as string | null);
  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .upsert(
      {
        invoice_number: invoiceNumber,
        order_id: order.id,
        user_id: order.user_id ?? null,
        customer_name: order.customer_name,
        customer_email: order.customer_email,
        subtotal: order.subtotal,
        tax: order.tax,
        shipping_fee: order.shipping_fee,
        discount: order.discount,
        total: order.total,
        status: invoiceStatusForPaymentStatus(order.payment_status as string | null),
      },
      { onConflict: 'invoice_number' },
    )
    .select('id, invoice_number, status, total, created_at')
    .single();

  if (invoiceError || !invoice) {
    return { ok: false, error: invoiceError?.message ?? 'Could not generate invoice.' };
  }

  return { ok: true, invoice: invoice as OrderInvoiceRecord };
}
