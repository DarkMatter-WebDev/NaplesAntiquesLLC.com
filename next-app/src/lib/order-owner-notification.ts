import type { SupabaseClient } from '@supabase/supabase-js';
import { formatCurrency, orderStatusLabel } from '@/types/sales';
import { getSiteUrl } from '@/lib/order-email-branding';
import { escapeHtml } from '@/lib/marketing-email-html';

// Where the owner's new-order notifications go. Override with the env var; the
// default is the address the owner asked for.
export const DEFAULT_ORDER_NOTIFICATION_EMAIL = 'info@naplesestatejewelry.co';

function ownerNotificationRecipient(): string {
  return (process.env.ORDER_NOTIFICATION_EMAIL || DEFAULT_ORDER_NOTIFICATION_EMAIL).trim();
}

const OWNER_ORDER_COLUMNS = [
  'id',
  'order_number',
  'customer_name',
  'customer_email',
  'customer_phone',
  'subtotal',
  'tax',
  'shipping_fee',
  'discount',
  'total',
  'payment_method',
  'shipping_method',
  'shipping_address',
  'customer_notes',
  'created_at',
  'order_items(title_snapshot, inventory_number, price_snapshot, quantity)',
].join(', ');
// `quantity` may not exist yet (migration pending) — retry without it and treat
// every line as quantity 1.
const OWNER_ORDER_COLUMNS_WITHOUT_QUANTITY = OWNER_ORDER_COLUMNS.replace(', quantity', '');

type OwnerOrderItem = {
  title_snapshot: string | null;
  inventory_number: string | null;
  price_snapshot: number | null;
  quantity?: number | null;
};

type OwnerOrder = {
  id: string;
  order_number: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  subtotal: number | null;
  tax: number | null;
  shipping_fee: number | null;
  discount: number | null;
  total: number | null;
  payment_method: string | null;
  shipping_method: string | null;
  shipping_address: unknown;
  customer_notes: string | null;
  created_at: string | null;
  order_items: OwnerOrderItem[] | null;
};

function itemQty(item: OwnerOrderItem): number {
  const qty = Math.floor(Number(item.quantity ?? 1));
  return Number.isFinite(qty) && qty > 0 ? qty : 1;
}

function addressLines(address: unknown): string[] {
  if (!address || typeof address !== 'object') return [];
  const a = address as Record<string, unknown>;
  const get = (key: string) => (typeof a[key] === 'string' ? (a[key] as string).trim() : '');
  const cityLine = [[get('city'), get('state')].filter(Boolean).join(', '), get('postal_code')]
    .filter(Boolean)
    .join(' ')
    .trim();
  return [get('line1'), get('line2'), cityLine, get('country')].filter((line) => line.length > 0);
}

/**
 * Best-effort owner alert: emails the shop a summary of a new (paid) order so the
 * owner is notified directly, not just via the admin Orders list. Sent alongside
 * the customer's receipt from finalizePaidOrder(). Never throws — a failure here
 * must not affect the buyer's completed payment.
 */
export async function sendNewOrderOwnerNotification(opts: {
  supabase: SupabaseClient;
  resendKey: string;
  orderId: string;
}): Promise<void> {
  const { supabase, resendKey, orderId } = opts;
  try {
    let { data, error } = await supabase
      .from('orders')
      .select(OWNER_ORDER_COLUMNS)
      .eq('id', orderId)
      .single();
    if (error && /quantity/i.test(error.message ?? '')) {
      ({ data, error } = await supabase
        .from('orders')
        .select(OWNER_ORDER_COLUMNS_WITHOUT_QUANTITY)
        .eq('id', orderId)
        .single());
    }
    if (error || !data) {
      console.error('Owner notification: order fetch failed:', error?.message);
      return;
    }

    const order = data as unknown as OwnerOrder;
    const items = order.order_items ?? [];
    const adminUrl = `${getSiteUrl()}/admin/orders/${order.id}`;
    const customerName = order.customer_name?.trim() || 'Guest';
    const total = formatCurrency(Number(order.total ?? 0));
    const shipping = orderStatusLabel(order.shipping_method);
    const shipTo = addressLines(order.shipping_address);
    const subject = `New order ${order.order_number} — ${total} (${customerName})`;

    const itemLines = items.length > 0
      ? items.map((item) => {
          const qty = itemQty(item);
          const name = item.title_snapshot || 'Item';
          const inv = item.inventory_number ? ` [#${item.inventory_number}]` : '';
          const line = formatCurrency(Number(item.price_snapshot ?? 0) * qty);
          return `- ${qty > 1 ? `${qty}× ` : ''}${name}${inv} — ${line}`;
        })
      : ['- (no item details attached)'];

    const text = [
      `New paid order: ${order.order_number}`,
      `Total: ${total}`,
      '',
      'Customer:',
      `  ${customerName}`,
      ...(order.customer_email ? [`  ${order.customer_email}`] : []),
      ...(order.customer_phone ? [`  ${order.customer_phone}`] : []),
      '',
      'Items:',
      ...itemLines,
      '',
      `Subtotal: ${formatCurrency(Number(order.subtotal ?? 0))}`,
      ...(Number(order.discount ?? 0) > 0 ? [`Discount: -${formatCurrency(Number(order.discount))}`] : []),
      `Tax: ${formatCurrency(Number(order.tax ?? 0))}`,
      `Shipping fee: ${formatCurrency(Number(order.shipping_fee ?? 0))}`,
      `Total: ${total}`,
      '',
      `Fulfillment: ${shipping}`,
      ...(shipTo.length > 0 ? ['Ship to:', ...shipTo.map((l) => `  ${l}`)] : []),
      ...(order.customer_notes ? ['', `Customer notes: ${order.customer_notes}`] : []),
      '',
      `View / manage: ${adminUrl}`,
    ].join('\n');

    const itemRowsHtml = items.length > 0
      ? items.map((item) => {
          const qty = itemQty(item);
          const name = escapeHtml(item.title_snapshot || 'Item');
          const inv = item.inventory_number ? `<span style="color:#9a8f7a;"> [#${escapeHtml(item.inventory_number)}]</span>` : '';
          const line = escapeHtml(formatCurrency(Number(item.price_snapshot ?? 0) * qty));
          return `<tr>
            <td style="padding:8px 0;border-bottom:1px solid #eadfbd;color:#1d1a14;font-size:14px;">${qty > 1 ? `${qty}× ` : ''}${name}${inv}</td>
            <td align="right" style="padding:8px 0;border-bottom:1px solid #eadfbd;color:#735c00;font-weight:700;white-space:nowrap;">${line}</td>
          </tr>`;
        }).join('')
      : `<tr><td colspan="2" style="padding:8px 0;color:#746b5b;">No item details attached.</td></tr>`;

    const contactRows = [
      ['Name', customerName],
      ...(order.customer_email ? [['Email', order.customer_email]] : []),
      ...(order.customer_phone ? [['Phone', order.customer_phone]] : []),
    ].map(([label, value]) => `<tr>
        <td style="padding:2px 12px 2px 0;color:#746b5b;font-size:13px;white-space:nowrap;">${escapeHtml(label)}</td>
        <td style="padding:2px 0;color:#1d1a14;font-size:13px;">${escapeHtml(value)}</td>
      </tr>`).join('');

    const html = `
      <div style="margin:0;padding:0;background:#f8f6ef;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8f6ef;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;color:#1d1a14;">
          <tr><td align="center">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #d5c697;">
              <tr><td style="padding:24px 28px 16px;border-bottom:1px solid #d5c697;">
                <div style="color:#735c00;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;">NaplesEstateJewelry.com — New Order</div>
                <h1 style="margin:8px 0 0;color:#1d1a14;font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:1.2;">${escapeHtml(order.order_number)} — ${escapeHtml(total)}</h1>
                <div style="display:inline-block;margin:12px 0 0;padding:5px 12px;background:#0f7a4f;color:#ffffff;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;border-radius:3px;">Paid in full</div>
              </td></tr>
              <tr><td style="padding:22px 28px;">
                <p style="margin:0 0 6px;font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#735c00;">Customer</p>
                <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 20px;">${contactRows}</table>

                <p style="margin:0 0 6px;font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#735c00;">Items</p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-top:1px solid #eadfbd;margin:0 0 18px;">${itemRowsHtml}</table>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px;">
                  <tr><td style="padding:3px 0;color:#746b5b;font-size:14px;">Subtotal</td><td align="right" style="padding:3px 0;color:#1d1a14;font-size:14px;">${escapeHtml(formatCurrency(Number(order.subtotal ?? 0)))}</td></tr>
                  ${Number(order.discount ?? 0) > 0 ? `<tr><td style="padding:3px 0;color:#746b5b;font-size:14px;">Discount</td><td align="right" style="padding:3px 0;color:#1d1a14;font-size:14px;">-${escapeHtml(formatCurrency(Number(order.discount)))}</td></tr>` : ''}
                  <tr><td style="padding:3px 0;color:#746b5b;font-size:14px;">Tax</td><td align="right" style="padding:3px 0;color:#1d1a14;font-size:14px;">${escapeHtml(formatCurrency(Number(order.tax ?? 0)))}</td></tr>
                  <tr><td style="padding:3px 0;color:#746b5b;font-size:14px;">Shipping fee</td><td align="right" style="padding:3px 0;color:#1d1a14;font-size:14px;">${escapeHtml(formatCurrency(Number(order.shipping_fee ?? 0)))}</td></tr>
                  <tr><td style="padding:10px 0 0;border-top:1px solid #d5c697;color:#735c00;font-size:15px;font-weight:700;">Total</td><td align="right" style="padding:10px 0 0;border-top:1px solid #d5c697;color:#735c00;font-size:15px;font-weight:700;">${escapeHtml(total)}</td></tr>
                </table>

                <div style="margin:0 0 20px;padding:12px 14px;background:#fbfaf5;border:1px solid #eadfbd;color:#746b5b;font-size:13px;line-height:1.5;">
                  Fulfillment: <strong style="color:#1d1a14;">${escapeHtml(shipping)}</strong>
                  ${shipTo.length > 0 ? `<div style="margin-top:8px;padding-top:8px;border-top:1px solid #eadfbd;"><strong style="display:block;color:#1d1a14;font-size:11px;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;">Ship to</strong>${shipTo.map(escapeHtml).join('<br/>')}</div>` : ''}
                  ${order.customer_notes ? `<div style="margin-top:8px;padding-top:8px;border-top:1px solid #eadfbd;"><strong style="display:block;color:#1d1a14;font-size:11px;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;">Customer notes</strong>${escapeHtml(order.customer_notes)}</div>` : ''}
                </div>

                <a href="${escapeHtml(adminUrl)}" style="display:inline-block;background:#735c00;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:11px 22px;border-radius:4px;">View order in admin</a>
              </td></tr>
            </table>
          </td></tr>
        </table>
      </div>
    `;

    const { Resend } = await import('resend');
    const resend = new Resend(resendKey);
    await resend.emails.send(
      {
        from: 'Naples Estate Jewelry <noreply@naplesestatejewelry.com>',
        to: ownerNotificationRecipient(),
        // Let the owner reply straight to the buyer from the notification.
        replyTo: order.customer_email ? String(order.customer_email) : undefined,
        subject,
        html,
        text,
      },
      { idempotencyKey: `order-${order.id}-owner-notification` },
    );
  } catch (err) {
    console.error('Owner new-order notification error:', err);
  }
}
