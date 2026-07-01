import type { FulfillmentStatus, Order } from '@/types/sales';
import { orderStatusLabel } from '@/types/sales';

export interface FulfillmentUpdateEmailContent {
  subject: string;
  html: string;
  text: string;
}

const STATUS_MESSAGES: Record<FulfillmentStatus, string> = {
  pending: 'Your order is being prepared.',
  packed: 'Your order has been packed and is being prepared for its next step.',
  shipped: 'Your order has shipped!',
  picked_up: 'Your order has been picked up. Thank you for shopping with us!',
  cancelled: 'Your order has been cancelled.',
};

export function buildFulfillmentUpdateEmailContent(
  order: Pick<Order, 'order_number' | 'customer_name'>,
  status: FulfillmentStatus,
): FulfillmentUpdateEmailContent {
  const customerName = order.customer_name || 'there';
  const statusLabel = orderStatusLabel(status);
  const subject = `Update on your order ${order.order_number} from Naples Estate Jewelry Co`;
  const greeting = `Hi ${customerName},`;
  const message = STATUS_MESSAGES[status] ?? `Your order status has been updated to ${statusLabel}.`;
  const note = 'Please reply to this email or call/text (239) 404-8505 with any questions.';
  const closing = 'Thank you, Naples Estate Jewelry Co';

  const text = [
    greeting,
    '',
    message,
    '',
    `Order: ${order.order_number}`,
    `Status: ${statusLabel}`,
    '',
    note,
    closing,
  ].join('\n');

  const html = `
    <div style="margin:0;padding:0;background:#f8f6ef;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8f6ef;padding:28px 12px;font-family:Arial,Helvetica,sans-serif;color:#1d1a14;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #d5c697;">
              <tr>
                <td style="padding:28px 30px 18px;border-bottom:1px solid #d5c697;">
                  <div style="color:#735c00;font-size:11px;font-weight:700;letter-spacing:4px;text-transform:uppercase;">Naples Estate Jewelry Co</div>
                  <h1 style="margin:10px 0 0;color:#1d1a14;font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:1.2;">Order Update</h1>
                  <p style="margin:8px 0 0;color:#746b5b;font-size:13px;">Order ${escapeHtml(order.order_number)} - ${escapeHtml(statusLabel)}</p>
                </td>
              </tr>
              <tr>
                <td style="padding:26px 30px;">
                  <p style="margin:0 0 14px;font-size:15px;line-height:1.55;">${escapeHtml(greeting)}</p>
                  <p style="margin:0 0 20px;font-size:15px;line-height:1.55;">${escapeHtml(message)}</p>
                  <p style="margin:0 0 18px;font-size:15px;line-height:1.55;">${escapeHtml(note)}</p>
                  <p style="margin:0;font-size:15px;line-height:1.55;">${escapeHtml(closing)}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  `;

  return { subject, html, text };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
