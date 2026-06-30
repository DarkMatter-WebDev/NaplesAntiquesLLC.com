import type { Order, OrderItem } from '@/types/sales';
import { formatCurrency, orderStatusLabel } from '@/types/sales';
import { formatProductItemYear } from '@/types/product';
import { normalizeLegacyLocalImageUrl } from '@/lib/image-url';

export type InvoiceEmailOrder = Order & { order_items: OrderItem[] };

export interface InvoiceEmailContent {
  subject: string;
  invoiceNumber: string;
  greeting: string;
  intro: string;
  items: {
    title: string;
    inventory: string;
    details: string;
    price: string;
    originalPrice: string;
    discount: string | null;
    imageUrl: string | null;
  }[];
  totals: {
    subtotal: string;
    discount: string;
    tax: string;
    shipping: string;
    total: string;
  };
  note: string;
  closing: string;
  html: string;
  text: string;
}

export function invoiceNumberForOrder(order: Pick<Order, 'order_number'>, fallbackInvoiceNumber?: string | null) {
  return fallbackInvoiceNumber || `INV-${order.order_number.replace(/^NEJ-/, '')}`;
}

export function withInvoiceLineDiscounts(order: InvoiceEmailOrder, itemDiscounts: Record<string, number>): InvoiceEmailOrder {
  const persistedLineDiscount = order.order_items.reduce((sum, item) => sum + clampDiscount(Number(item.discount ?? 0), item.price_snapshot), 0);
  const editedItems = order.order_items.map((item) => ({
    ...item,
    discount: clampDiscount(itemDiscounts[item.id] ?? Number(item.discount ?? 0), item.price_snapshot),
  }));
  const editedLineDiscount = editedItems.reduce((sum, item) => sum + clampDiscount(Number(item.discount ?? 0), item.price_snapshot), 0);
  const orderLevelDiscount = Math.max(order.discount - persistedLineDiscount, 0);
  const discount = orderLevelDiscount + editedLineDiscount;
  const taxableBeforeDiscount = Math.max(order.subtotal - order.discount, 0);
  const taxRate = taxableBeforeDiscount > 0 ? order.tax / taxableBeforeDiscount : 0;
  const tax = Math.max(order.subtotal - discount, 0) * taxRate;
  const total = Math.max(order.subtotal - discount, 0) + tax + order.shipping_fee;

  return {
    ...order,
    order_items: editedItems,
    discount,
    tax,
    total,
  };
}

export function buildInvoiceEmailContent(order: InvoiceEmailOrder, fallbackInvoiceNumber?: string | null): InvoiceEmailContent {
  const invoiceNumber = invoiceNumberForOrder(order, fallbackInvoiceNumber);
  const subject = `Invoice ${invoiceNumber} from Naples Estate Jewelry Co`;
  const customerName = order.customer_name || 'there';
  const items = order.order_items.map((item) => {
    const discount = clampDiscount(Number(item.discount ?? 0), item.price_snapshot);
    const lineTotal = Math.max(item.price_snapshot - discount, 0);
    const circa = formatProductItemYear(item.item_year_snapshot);
    const details = [
      circa ? `Ca. ${circa}` : null,
      item.metal_snapshot,
      item.purity_snapshot ? `${item.purity_snapshot} purity` : null,
      item.gram_weight_snapshot ? `${item.gram_weight_snapshot}g` : null,
    ].filter(Boolean).join(' - ');

    return {
      title: item.title_snapshot,
      inventory: item.inventory_number || 'No inventory #',
      details: details || 'Estate jewelry item',
      price: formatCurrency(lineTotal),
      originalPrice: formatCurrency(item.price_snapshot),
      discount: discount > 0 ? `-${formatCurrency(discount)}` : null,
      imageUrl: absoluteImageUrl(normalizeLegacyLocalImageUrl(item.image_snapshot)),
    };
  });
  const totals = {
    subtotal: formatCurrency(order.subtotal),
    discount: `-${formatCurrency(order.discount)}`,
    tax: formatCurrency(order.tax),
    shipping: formatCurrency(order.shipping_fee),
    total: formatCurrency(order.total),
  };
  const greeting = `Hi ${customerName},`;
  const intro = `Thank you for your order with Naples Estate Jewelry Co. Invoice ${invoiceNumber} for ${order.order_number} is ready for review.`;
  const note = 'Please reply to this email or call/text (239) 404-8505 with any questions about payment, pickup, delivery, or shipping.';
  const closing = 'Thank you, Naples Estate Jewelry Co';
  const shipToLines = formatAddressLines(order.shipping_address);

  return {
    subject,
    invoiceNumber,
    greeting,
    intro,
    items,
    totals,
    note,
    closing,
    html: buildInvoiceEmailHtml({
      orderNumber: order.order_number,
      subject,
      greeting,
      intro,
      items,
      totals,
      note,
      closing,
      paymentStatus: orderStatusLabel(order.payment_status),
      fulfillmentStatus: orderStatusLabel(order.fulfillment_status),
      shippingMethod: orderStatusLabel(order.shipping_method),
      shipTo: shipToLines,
    }),
    text: [
      greeting,
      intro,
      '',
      'Items:',
      ...(items.length > 0 ? items.map((item) => `- ${item.title} (${item.inventory}) - ${item.discount ? `${item.originalPrice}, line discount ${item.discount}, total ${item.price}` : item.price}`) : ['- No item details were attached.']),
      '',
      `Subtotal: ${totals.subtotal}`,
      `Discount: ${totals.discount}`,
      `Tax: ${totals.tax}`,
      `Shipping: ${totals.shipping}`,
      `Total: ${totals.total}`,
      ...(shipToLines.length > 0 ? ['', 'Ship to:', ...shipToLines] : []),
      '',
      note,
      closing,
    ].join('\n'),
  };
}

function buildInvoiceEmailHtml({
  orderNumber,
  subject,
  greeting,
  intro,
  items,
  totals,
  note,
  closing,
  paymentStatus,
  fulfillmentStatus,
  shippingMethod,
  shipTo,
}: Omit<InvoiceEmailContent, 'html' | 'text' | 'invoiceNumber'> & {
  orderNumber: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  shippingMethod: string;
  shipTo: string[];
}) {
  const itemRows = items.length > 0
    ? items.map((item) => `
      <tr>
        <td style="padding:14px 0;border-bottom:1px solid #eadfbd;">
          <table role="presentation" cellspacing="0" cellpadding="0" width="100%">
            <tr>
              <td width="72" valign="top" style="width:72px;padding-right:14px;">
                ${item.imageUrl ? `<img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.title)}" width="58" height="58" style="display:block;width:58px;height:58px;object-fit:contain;border:1px solid #eadfbd;background:#fbfaf5;" />` : `<div style="width:58px;height:58px;border:1px solid #eadfbd;background:#fbfaf5;"></div>`}
              </td>
              <td valign="top">
                <strong style="display:block;color:#1d1a14;font-size:15px;line-height:1.35;">${escapeHtml(item.title)}</strong>
                <span style="display:block;margin-top:4px;color:#746b5b;font-size:12px;">${escapeHtml(item.inventory)}${item.details ? ` - ${escapeHtml(item.details)}` : ''}</span>
              </td>
            </tr>
          </table>
        </td>
        <td align="right" style="padding:14px 0;border-bottom:1px solid #eadfbd;color:#735c00;font-weight:700;white-space:nowrap;">
          ${item.discount ? `<span style="display:block;color:#746b5b;font-size:12px;font-weight:400;text-decoration:line-through;">${escapeHtml(item.originalPrice)}</span><span style="display:block;color:#735c00;font-size:12px;">Discount ${escapeHtml(item.discount)}</span>` : ''}
          ${escapeHtml(item.price)}
        </td>
      </tr>
    `).join('')
    : '<tr><td colspan="2" style="padding:14px 0;color:#746b5b;">No item details were attached.</td></tr>';

  return `
    <div style="margin:0;padding:0;background:#f8f6ef;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8f6ef;padding:28px 12px;font-family:Arial,Helvetica,sans-serif;color:#1d1a14;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;background:#ffffff;border:1px solid #d5c697;">
              <tr>
                <td style="padding:28px 30px 18px;border-bottom:1px solid #d5c697;">
                  <div style="color:#735c00;font-size:11px;font-weight:700;letter-spacing:4px;text-transform:uppercase;">Naples Estate Jewelry Co</div>
                  <h1 style="margin:10px 0 0;color:#1d1a14;font-family:Georgia,'Times New Roman',serif;font-size:28px;line-height:1.2;">${escapeHtml(subject)}</h1>
                  <p style="margin:8px 0 0;color:#746b5b;font-size:13px;">Order ${escapeHtml(orderNumber)} - ${escapeHtml(paymentStatus)} - ${escapeHtml(fulfillmentStatus)}</p>
                </td>
              </tr>
              <tr>
                <td style="padding:26px 30px;">
                  <p style="margin:0 0 14px;font-size:15px;line-height:1.55;">${escapeHtml(greeting)}</p>
                  <p style="margin:0 0 20px;font-size:15px;line-height:1.55;">${escapeHtml(intro)}</p>

                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-top:1px solid #eadfbd;border-bottom:1px solid #eadfbd;margin:0 0 22px;">
                    ${itemRows}
                  </table>

                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 22px;">
                    ${totalRow('Subtotal', totals.subtotal)}
                    ${totalRow('Discount', totals.discount)}
                    ${totalRow('Tax', totals.tax)}
                    ${totalRow('Shipping', totals.shipping)}
                    ${totalRow('Total', totals.total, true)}
                  </table>

                  <div style="margin:0 0 22px;padding:14px 16px;background:#fbfaf5;border:1px solid #eadfbd;color:#746b5b;font-size:13px;line-height:1.5;">
                    Shipping method: ${escapeHtml(shippingMethod)}
                    ${shipTo.length > 0 ? `<div style="margin-top:10px;padding-top:10px;border-top:1px solid #eadfbd;"><strong style="display:block;color:#1d1a14;font-size:11px;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;">Ship to</strong>${shipTo.map(escapeHtml).join('<br/>')}</div>` : ''}
                  </div>

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
}

function totalRow(label: string, value: string, strong = false) {
  return `
    <tr>
      <td style="padding:${strong ? '12px 0 0' : '5px 0'};${strong ? 'border-top:1px solid #d5c697;' : ''}color:${strong ? '#735c00' : '#746b5b'};font-size:14px;${strong ? 'font-weight:700;' : ''}">${escapeHtml(label)}</td>
      <td align="right" style="padding:${strong ? '12px 0 0' : '5px 0'};${strong ? 'border-top:1px solid #d5c697;' : ''}color:${strong ? '#735c00' : '#1d1a14'};font-size:14px;${strong ? 'font-weight:700;' : ''}">${escapeHtml(value)}</td>
    </tr>
  `;
}

function formatAddressLines(address: unknown): string[] {
  if (!address || typeof address !== 'object') return [];
  const a = address as Record<string, unknown>;
  const get = (key: string) => (typeof a[key] === 'string' ? (a[key] as string).trim() : '');
  const cityLine = [[get('city'), get('state')].filter(Boolean).join(', '), get('postal_code')]
    .filter(Boolean)
    .join(' ')
    .trim();
  return [get('line1'), get('line2'), cityLine, get('country')].filter((line) => line.length > 0);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function clampDiscount(value: number, max: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(value, 0), Math.max(max, 0));
}

function absoluteImageUrl(value: string | null | undefined) {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (!value.startsWith('/')) return null;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://naplesestatejewelry.co';
  return `${siteUrl.replace(/\/$/, '')}${value}`;
}
