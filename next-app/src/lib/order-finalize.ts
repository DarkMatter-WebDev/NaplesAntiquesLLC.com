import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { upsertOrderInvoice } from '@/lib/order-invoices';

/**
 * Post-payment finalization shared by BOTH capture paths — the client
 * `capture-order` route and the `webhook` backstop. Upserts the invoice
 * (idempotent on invoice_number) and best-effort emails the buyer their receipt.
 * Safe to call from either path: the invoice upsert de-dupes, and a re-capture of
 * an already-paid order short-circuits before this runs, so no duplicate receipt.
 *
 * Previously this lived only in capture-order, so an order completed by the
 * webhook (buyer's browser died after PayPal approval) got no invoice row and no
 * receipt email.
 */
export async function finalizePaidOrder(service: SupabaseClient, orderId: string): Promise<void> {
  const { data: order } = await service
    .from('orders')
    .select('id, customer_email')
    .eq('id', orderId)
    .maybeSingle();
  if (!order) return;

  await upsertOrderInvoice(service, order.id);

  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey && order.customer_email) {
    try {
      const { sendOrderInvoiceEmail } = await import('@/lib/order-invoice-mailer');
      await sendOrderInvoiceEmail({
        supabase: service,
        resendKey,
        orderId: order.id,
        recipient: order.customer_email as string,
        sentBy: { id: null, email: 'Automatic — order confirmation' },
      });
    } catch (err) {
      console.error('Auto receipt email error:', err);
    }
  }
}

/**
 * Race loser on a one-of-one item: PayPal captured the buyer's money but the item
 * was already sold to someone else, so `capture_paypal_order` flagged the order
 * `failed`. The buyer was told a refund is coming — alert an admin so it actually
 * happens. De-duped (the losing capture can arrive via both the client route and
 * the webhook) and best-effort.
 */
export async function notifyItemConflict(
  service: SupabaseClient,
  order: { id: string; orderNumber: string },
): Promise<void> {
  try {
    const { data: existing } = await service
      .from('admin_notifications')
      .select('id')
      .eq('order_id', order.id)
      .eq('type', 'order')
      .ilike('title', 'Refund needed%')
      .limit(1);
    if (existing && existing.length > 0) return;

    await service.from('admin_notifications').insert({
      type: 'order',
      title: `Refund needed — item already sold (${order.orderNumber})`,
      body:
        `Order ${order.orderNumber} captured payment, but its item(s) were already sold to another buyer, ` +
        `so the order is flagged 'failed'. Issue a full PayPal refund to this buyer.`,
      order_id: order.id,
    });
  } catch (err) {
    console.error('item_conflict admin notification error:', err);
  }
}
