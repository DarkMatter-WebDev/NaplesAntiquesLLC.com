'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Order, OrderItem, FulfillmentStatus, OrderStatus } from '@/types/sales';
import { formatCurrency, formatOrderDate, formatPublicPurity, orderStatusLabel } from '@/types/sales';
import { formatProductItemYear } from '@/types/product';
import { buildInvoiceEmailContent, invoiceNumberForOrder, isOrderPaid, withInvoiceLineDiscounts } from '@/lib/order-invoice-email';
import { buildFulfillmentUpdateEmailContent } from '@/lib/order-fulfillment-email';
import { normalizeLegacyLocalImageUrl } from '@/lib/image-url';
import { adminRevalidateProducts } from '@/app/actions/admin-products';

const GOLD = '#735c00';
const BORDER = 'var(--color-outline-variant)';
const FULFILLMENT_MARK_STATUSES: FulfillmentStatus[] = ['packed', 'shipped', 'picked_up'];

/** Format a stored address jsonb ({line1,line2,city,state,postal_code,country}) into display lines. */
function formatOrderAddress(address: unknown): string | null {
  if (!address || typeof address !== 'object') return null;
  const a = address as Record<string, unknown>;
  const get = (key: string) => (typeof a[key] === 'string' ? (a[key] as string).trim() : '');
  const cityLine = [[get('city'), get('state')].filter(Boolean).join(', '), get('postal_code')]
    .filter(Boolean)
    .join(' ')
    .trim();
  const lines = [get('line1'), get('line2'), cityLine, get('country')].filter((line) => line.length > 0);
  return lines.length > 0 ? lines.join('\n') : null;
}

interface Invoice {
  id: string;
  invoice_number: string;
  status: string;
  total: number;
  created_at: string;
}

interface OrderEmail {
  id: string;
  email_type: string;
  recipient: string;
  subject: string | null;
  status: string | null;
  sent_by_email: string | null;
  created_at: string;
}

interface Props {
  initialOrder: Order & { order_items: OrderItem[] };
  initialInvoices: Invoice[];
  initialOrderEmails: OrderEmail[];
  adminEmail: string | null;
  locale: string;
}

export default function OrderDetailPanel({ initialOrder, initialInvoices, initialOrderEmails, adminEmail, locale }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const adminBasePath = locale === 'es' ? '/es/admin' : '/admin';
  const shopBasePath = locale === 'es' ? '/es/shop' : '/shop';
  const orderReturnPath = `${adminBasePath}/orders/${initialOrder.id}`;
  const [order, setOrder] = useState(initialOrder);
  const [invoices, setInvoices] = useState(initialInvoices);
  const [orderEmails, setOrderEmails] = useState<OrderEmail[]>(initialOrderEmails);
  const [internalNotes, setInternalNotes] = useState(order.internal_notes ?? '');
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showPartialRefund, setShowPartialRefund] = useState(false);
  const [partialRefundAmount, setPartialRefundAmount] = useState(
    order.refund_amount != null ? String(order.refund_amount) : '',
  );
  const [showEmailInvoice, setShowEmailInvoice] = useState(false);
  const [emailRecipient, setEmailRecipient] = useState(order.customer_email ?? '');
  const [emailSending, setEmailSending] = useState(false);
  const [emailMessage, setEmailMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [pendingFulfillmentStatus, setPendingFulfillmentStatus] = useState<FulfillmentStatus | null>(null);
  const [notifyCustomerOnFulfillment, setNotifyCustomerOnFulfillment] = useState(true);
  const [showEmailUpdate, setShowEmailUpdate] = useState(false);
  const [emailUpdateStatus, setEmailUpdateStatus] = useState<FulfillmentStatus | null>(null);
  const [emailUpdateRecipient, setEmailUpdateRecipient] = useState(order.customer_email ?? '');
  const [emailUpdateSending, setEmailUpdateSending] = useState(false);
  const [emailUpdateMessage, setEmailUpdateMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [itemDiscounts, setItemDiscounts] = useState<Record<string, string>>(() =>
    Object.fromEntries(initialOrder.order_items.map((item) => [item.id, String(item.discount ?? 0)])),
  );

  const orderIsPaid = isOrderPaid(order);
  const invoiceDocLabel = orderIsPaid ? 'Receipt' : 'Invoice';
  const productIds = order.order_items.map((item) => item.product_id).filter(Boolean) as string[];
  const latestInvoice = invoices[0] ?? null;
  const invoiceNumber = invoiceNumberForOrder(order, latestInvoice?.invoice_number);
  const numericItemDiscounts = Object.fromEntries(Object.entries(itemDiscounts).map(([id, value]) => [id, Number(value) || 0]));
  const emailOrder = withInvoiceLineDiscounts(order, numericItemDiscounts);
  const emailContent = buildInvoiceEmailContent(emailOrder, invoiceNumber);
  const emailUpdateContent = emailUpdateStatus ? buildFulfillmentUpdateEmailContent(order, emailUpdateStatus) : null;
  const persistedLineDiscount = order.order_items.reduce((sum, item) => sum + clampMoneyDiscount(Number(item.discount ?? 0), item.price_snapshot), 0);
  const editedLineDiscount = order.order_items.reduce((sum, item) => sum + clampMoneyDiscount(Number(itemDiscounts[item.id]) || 0, item.price_snapshot), 0);
  const orderLevelDiscount = Math.max(order.discount - persistedLineDiscount, 0);
  const editedTotalDiscount = orderLevelDiscount + editedLineDiscount;
  const taxableBeforeDiscount = Math.max(order.subtotal - order.discount, 0);
  const taxRate = taxableBeforeDiscount > 0 ? order.tax / taxableBeforeDiscount : 0;
  const editedTax = Math.max(order.subtotal - editedTotalDiscount, 0) * taxRate;
  const editedTotal = Math.max(order.subtotal - editedTotalDiscount, 0) + editedTax + order.shipping_fee;

  async function updateOrder(updates: Partial<Order>, action: string) {
    setSaving(action);
    setMessage(null);
    const { error } = await supabase.from('orders').update(updates).eq('id', order.id);
    if (error) {
      setMessage({ text: error.message, ok: false });
      setSaving(null);
      return false;
    }
    setOrder((current) => ({ ...current, ...updates }));
    setSaving(null);
    router.refresh();
    return true;
  }

  async function updateProducts(status: string) {
    if (productIds.length === 0) return true;
    const { error } = await supabase.from('products').update({ status }).in('id', productIds);
    if (error) {
      setMessage({ text: error.message, ok: false });
      return false;
    }
    // Purge the shop-gallery cache — this write happens via the browser client,
    // so no server route revalidates the tag for us. Without it the public
    // gallery keeps the old status for up to 5 minutes.
    await adminRevalidateProducts(productIds);
    return true;
  }

  async function markPaid() {
    const ok = await updateOrder({ payment_status: 'paid', order_status: 'completed' }, 'paid');
    if (ok) {
      await updateProducts('sold');
      setMessage({ text: 'Order marked paid and products marked sold.', ok: true });
    }
  }

  async function markUnpaid() {
    const ok = await updateOrder({ payment_status: 'unpaid', order_status: 'open' }, 'unpaid');
    if (ok) {
      await updateProducts('pending_payment');
      setMessage({ text: 'Order marked unpaid and products returned to pending payment.', ok: true });
    }
  }

  async function markRefunded() {
    const ok = await updateOrder({ payment_status: 'refunded', order_status: 'refunded' }, 'refunded');
    if (ok) {
      setMessage({ text: 'Order marked refunded. Products were not returned to available automatically.', ok: true });
    }
  }

  async function markPartiallyRefunded() {
    const amount = parseFloat(partialRefundAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setMessage({ text: 'Enter a valid refund amount greater than zero.', ok: false });
      return;
    }
    if (amount > order.total) {
      setMessage({ text: `Refund amount cannot exceed the order total (${formatCurrency(order.total)}).`, ok: false });
      return;
    }
    const ok = await updateOrder({ payment_status: 'partially_refunded', refund_amount: amount }, 'partial-refund');
    if (ok) {
      setPartialRefundAmount(String(amount));
      setShowPartialRefund(false);
      setMessage({ text: `Order marked partially refunded — ${formatCurrency(amount)} refunded.`, ok: true });
    }
  }

  async function updateFulfillment(status: FulfillmentStatus) {
    const ok = await updateOrder({ fulfillment_status: status }, status);
    if (ok) setMessage({ text: `Fulfillment marked ${orderStatusLabel(status)}.`, ok: true });
    return ok;
  }

  async function confirmFulfillmentUpdate() {
    if (!pendingFulfillmentStatus) return;
    const status = pendingFulfillmentStatus;
    const shouldNotify = notifyCustomerOnFulfillment;
    const ok = await updateFulfillment(status);
    setPendingFulfillmentStatus(null);
    if (ok && shouldNotify) {
      setEmailUpdateStatus(status);
      setEmailUpdateRecipient(order.customer_email ?? '');
      setEmailUpdateMessage(null);
      setShowEmailUpdate(true);
    }
  }

  async function sendFulfillmentUpdateEmail() {
    if (!emailUpdateStatus) return;
    setEmailUpdateMessage(null);
    const recipient = emailUpdateRecipient.trim();
    if (!recipient) {
      setEmailUpdateMessage({ text: 'Enter a recipient email address before sending.', ok: false });
      return;
    }

    setEmailUpdateSending(true);
    const response = await fetch(`/api/admin/orders/${order.id}/email-update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient, status: emailUpdateStatus }),
    });
    const result = await response.json().catch(() => null);
    setEmailUpdateSending(false);

    if (!response.ok) {
      setEmailUpdateMessage({ text: result?.error ?? 'Could not send update email.', ok: false });
      return;
    }

    recordSentEmail({
      email_type: 'fulfillment_update',
      recipient,
      subject: emailUpdateContent?.subject ?? null,
      status: emailUpdateStatus,
    });
    setEmailUpdateMessage({ text: `Update email sent to ${recipient}.`, ok: true });
  }

  async function cancelOrder() {
    const updates: Partial<Order> = {
      order_status: 'cancelled' as OrderStatus,
      fulfillment_status: 'cancelled',
    };
    const ok = await updateOrder(updates, 'cancelled');
    if (ok) {
      if (order.payment_status !== 'paid') {
        await updateProducts('available');
        setMessage({ text: 'Order cancelled and unpaid products returned to available.', ok: true });
      } else {
        setMessage({ text: 'Paid order cancelled. Products were left sold for review.', ok: true });
      }
    }
  }

  async function reopenOrder() {
    const ok = await updateOrder({
      order_status: 'open' as OrderStatus,
      fulfillment_status: 'pending',
    }, 'reopen');
    if (ok) {
      if (order.payment_status !== 'paid') {
        await updateProducts('pending_payment');
        setMessage({ text: 'Order reopened and unpaid products returned to pending payment.', ok: true });
      } else {
        setMessage({ text: 'Order reopened. Paid products were left sold for review.', ok: true });
      }
    }
  }

  async function deleteOrder() {
    setSaving('delete');
    setMessage(null);
    const { error } = await supabase.from('orders').delete().eq('id', order.id);
    if (error) {
      setMessage({ text: error.message, ok: false });
      setSaving(null);
      return;
    }
    router.push(`${adminBasePath}/orders`);
  }

  async function saveNotes() {
    const ok = await updateOrder({ internal_notes: internalNotes.trim() || null }, 'notes');
    if (ok) setMessage({ text: 'Internal notes saved.', ok: true });
  }

  async function saveLineDiscounts() {
    setSaving('line-discounts');
    setMessage(null);

    const updates = order.order_items.map((item) => {
      const discount = clampMoneyDiscount(Number(itemDiscounts[item.id]) || 0, item.price_snapshot);
      return supabase.from('order_items').update({ discount }).eq('id', item.id);
    });
    const results = await Promise.all(updates);
    const itemError = results.find((result) => result.error)?.error;
    if (itemError) {
      setMessage({ text: itemError.message, ok: false });
      setSaving(null);
      return;
    }

    const ok = await updateOrder({
      discount: editedTotalDiscount,
      tax: editedTax,
      total: editedTotal,
    }, 'line-discounts');
    if (ok) {
      setOrder((current) => ({
        ...current,
        discount: editedTotalDiscount,
        tax: editedTax,
        total: editedTotal,
        order_items: current.order_items.map((item) => ({
          ...item,
          discount: clampMoneyDiscount(Number(itemDiscounts[item.id]) || 0, item.price_snapshot),
        })),
      }));
      setMessage({ text: 'Line discounts saved and order totals recalculated.', ok: true });
    }
  }


  // Prepend a just-sent email to the on-page history so it shows immediately.
  // (The server also persists it; a reload reflects the stored record.)
  function recordSentEmail(entry: { email_type: string; recipient: string; subject: string | null; status: string | null }) {
    setOrderEmails((prev) => [
      {
        id: `local-${Date.now()}`,
        email_type: entry.email_type,
        recipient: entry.recipient,
        subject: entry.subject,
        status: entry.status,
        sent_by_email: adminEmail,
        created_at: new Date().toISOString(),
      },
      ...prev,
    ]);
  }

  async function sendInvoiceEmail() {
    setEmailMessage(null);
    const recipient = emailRecipient.trim();
    if (!recipient) {
      setEmailMessage({ text: 'Enter a recipient email address before sending.', ok: false });
      return;
    }

    setEmailSending(true);
    const response = await fetch(`/api/admin/orders/${order.id}/email-invoice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient, itemDiscounts: numericItemDiscounts }),
    });
    const result = await response.json().catch(() => null);
    setEmailSending(false);

    if (!response.ok) {
      setEmailMessage({ text: result?.error ?? 'Could not send invoice email.', ok: false });
      return;
    }

    const documentLabel = orderIsPaid ? 'Receipt' : 'Invoice';
    recordSentEmail({ email_type: orderIsPaid ? 'receipt' : 'invoice', recipient, subject: emailContent.subject, status: null });
    setEmailMessage({ text: `${documentLabel} email sent to ${recipient}.`, ok: true });
  }

  return (
    <main className="px-4 md:px-8 py-8">
      <div className="max-w-[1300px] mx-auto">
        <div className="mb-6">
          <Link href={`${adminBasePath}/orders`} className="text-xs font-bold uppercase tracking-widest hover:underline" style={{ color: GOLD, fontFamily: 'var(--font-label)' }}>
            Back to Orders
          </Link>
        </div>

        {message && (
          <div className="mb-6 border px-4 py-3 text-sm"
            style={{
              borderColor: message.ok ? GOLD : 'var(--color-error)',
              color: message.ok ? GOLD : 'var(--color-error)',
              background: 'white',
            }}>
            {message.text}
          </div>
        )}

        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.35em] mb-3" style={{ color: GOLD, fontFamily: 'var(--font-label)' }}>
              Order Detail
            </p>
            <h1 className="text-3xl md:text-4xl font-bold" style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}>
              {order.order_number}
            </h1>
            <p className="text-sm mt-2" style={{ color: 'var(--color-on-surface-variant)' }}>
              Created {formatOrderDate(order.created_at)}
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setShowEmailInvoice(true)} className="outline-button text-sm">Email {invoiceDocLabel}</button>
              <button type="button" onClick={markPaid} disabled={saving === 'paid' || order.payment_status === 'paid'} className="gold-button text-sm disabled:opacity-50">Mark Paid</button>
              <button type="button" onClick={markUnpaid} disabled={saving === 'unpaid' || order.payment_status === 'unpaid'} className="outline-button text-sm disabled:opacity-50">Mark Unpaid</button>
              <button type="button" onClick={markRefunded} disabled={saving === 'refunded' || order.payment_status === 'refunded'} className="outline-button text-sm disabled:opacity-50">Mark Refunded</button>
              <button
                type="button"
                onClick={() => { setShowPartialRefund((v) => !v); setMessage(null); }}
                disabled={saving === 'partial-refund'}
                className="outline-button text-sm disabled:opacity-50"
              >
                Mark Partially Refunded
              </button>
              <button
                type="button"
                onClick={() => { setShowCancelConfirm(true); setShowDeleteConfirm(false); setMessage(null); }}
                disabled={saving === 'cancelled' || order.order_status === 'cancelled' || order.fulfillment_status === 'cancelled'}
                className="outline-button text-sm disabled:opacity-50"
              >
                Cancel Order
              </button>
              <button
                type="button"
                onClick={() => { setShowDeleteConfirm(true); setShowCancelConfirm(false); setMessage(null); }}
                disabled={saving === 'delete'}
                className="outline-button text-sm disabled:opacity-50"
                style={{ borderColor: 'var(--color-error)', color: 'var(--color-error)' }}
              >
                Delete Order
              </button>
            </div>
            {showCancelConfirm && (
              <div className="flex flex-wrap items-center gap-3 border px-4 py-3" style={{ borderColor: 'var(--color-error)', background: 'white' }}>
                <span className="text-sm" style={{ color: 'var(--color-on-surface)' }}>
                  Cancel this order? This cannot be undone.
                </span>
                <button
                  type="button"
                  onClick={() => { setShowCancelConfirm(false); cancelOrder(); }}
                  disabled={saving === 'cancelled'}
                  className="outline-button text-sm disabled:opacity-50"
                  style={{ borderColor: 'var(--color-error)', color: 'var(--color-error)' }}
                >
                  {saving === 'cancelled' ? 'Cancelling…' : 'Yes, Cancel Order'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCancelConfirm(false)}
                  className="outline-button text-sm"
                >
                  Keep Order
                </button>
              </div>
            )}
            {showDeleteConfirm && (
              <div className="flex flex-wrap items-center gap-3 border px-4 py-3" style={{ borderColor: 'var(--color-error)', background: 'white' }}>
                <span className="text-sm" style={{ color: 'var(--color-on-surface)' }}>
                  Permanently delete this order? It will be removed from the database and cannot be recovered.
                </span>
                <button
                  type="button"
                  onClick={() => { setShowDeleteConfirm(false); deleteOrder(); }}
                  disabled={saving === 'delete'}
                  className="outline-button text-sm disabled:opacity-50"
                  style={{ borderColor: 'var(--color-error)', color: 'var(--color-error)' }}
                >
                  {saving === 'delete' ? 'Deleting…' : 'Yes, Delete Order'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="outline-button text-sm"
                >
                  Keep Order
                </button>
              </div>
            )}
            {showPartialRefund && (
              <div className="flex flex-wrap items-center gap-3 border px-4 py-3" style={{ borderColor: BORDER, background: 'white' }}>
                <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
                  Refund amount
                  <input
                    // eslint-disable-next-line jsx-a11y/no-autofocus
                    autoFocus
                    type="number"
                    className="form-field text-sm"
                    style={{ width: '7rem' }}
                    min="0.01"
                    max={order.total}
                    step="0.01"
                    value={partialRefundAmount}
                    onChange={(e) => setPartialRefundAmount(e.target.value)}
                    placeholder="0.00"
                  />
                </label>
                <span className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                  max {formatCurrency(order.total)}
                </span>
                <button
                  type="button"
                  onClick={markPartiallyRefunded}
                  disabled={saving === 'partial-refund'}
                  className="gold-button text-sm disabled:opacity-50"
                >
                  {saving === 'partial-refund' ? 'Saving…' : 'Confirm'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowPartialRefund(false)}
                  className="outline-button text-sm"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="grid lg:grid-cols-[1fr_22rem] gap-6">
          <div className="flex flex-col gap-6">
            <section className="border p-5" style={{ borderColor: BORDER, background: 'white' }}>
              <h2 className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: GOLD, fontFamily: 'var(--font-label)' }}>Customer</h2>
              <div className="grid md:grid-cols-3 gap-4 text-sm">
                <Field label="Name" value={order.customer_name} />
                <Field label="Email" value={order.customer_email} />
                <Field label="Phone" value={order.customer_phone} />
              </div>
              {(() => {
                const shipping = formatOrderAddress(order.shipping_address);
                const billing = formatOrderAddress(order.billing_address);
                if (!shipping && !billing) return null;
                return (
                  <div className="mt-4 grid gap-4 md:grid-cols-2 text-sm">
                    {shipping && (
                      <div>
                        <span className="mb-1 block text-[0.62rem] font-bold uppercase tracking-widest" style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}>
                          Shipping Address
                        </span>
                        <p className="whitespace-pre-line" style={{ color: 'var(--color-on-surface)' }}>{shipping}</p>
                      </div>
                    )}
                    {billing && (
                      <div>
                        <span className="mb-1 block text-[0.62rem] font-bold uppercase tracking-widest" style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}>
                          Billing Address
                        </span>
                        <p className="whitespace-pre-line" style={{ color: 'var(--color-on-surface)' }}>{billing}</p>
                      </div>
                    )}
                  </div>
                );
              })()}
              {order.customer_notes && (
                <div className="mt-4">
                  <span className="mb-1 block text-[0.62rem] font-bold uppercase tracking-widest" style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}>
                    Customer Notes
                  </span>
                  <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
                    {order.customer_notes}
                  </p>
                </div>
              )}
            </section>

            <section className="border" style={{ borderColor: BORDER, background: 'white' }}>
              <div className="border-b px-5 py-4" style={{ borderColor: BORDER }}>
                <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: GOLD, fontFamily: 'var(--font-label)' }}>Items</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[780px] text-sm">
                  <thead style={{ background: 'var(--color-surface-container-low)' }}>
                    <tr>
                      {['Item', 'Date', 'Inventory', 'Metal', 'Purity', 'Weight', 'Price', 'Discount', 'Product'].map((heading) => (
                        <th key={heading} className="px-4 py-3 text-left text-[0.68rem] uppercase tracking-widest" style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}>
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {order.order_items.map((item) => (
                      <tr key={item.id} className="border-t" style={{ borderColor: BORDER }}>
                        <td className="px-4 py-3 font-semibold" style={{ color: 'var(--color-on-surface)' }}>{item.title_snapshot}</td>
                        <td className="px-4 py-3" style={{ color: 'var(--color-on-surface-variant)' }}>{formatProductItemYear(item.item_year_snapshot) ?? '-'}</td>
                        <td className="px-4 py-3" style={{ color: 'var(--color-on-surface-variant)' }}>{item.inventory_number || '-'}</td>
                        <td className="px-4 py-3" style={{ color: 'var(--color-on-surface-variant)' }}>{item.metal_snapshot || '-'}</td>
                        <td className="px-4 py-3" style={{ color: 'var(--color-on-surface-variant)' }}>{formatPublicPurity(item.purity_snapshot) ?? '-'}</td>
                        <td className="px-4 py-3" style={{ color: 'var(--color-on-surface-variant)' }}>{item.gram_weight_snapshot ? `${item.gram_weight_snapshot}g` : '-'}</td>
                        <td className="px-4 py-3 font-semibold" style={{ color: GOLD }}>{formatCurrency(item.price_snapshot)}</td>
                        <td className="px-4 py-3">
                          <label className="grid min-w-28 gap-1">
                            <span className="sr-only">Line discount for {item.title_snapshot}</span>
                            <input
                              className="form-field text-sm"
                              type="number"
                              min="0"
                              max={item.price_snapshot}
                              step="0.01"
                              value={itemDiscounts[item.id] ?? '0'}
                              onChange={(event) => setItemDiscounts((current) => ({ ...current, [item.id]: event.target.value }))}
                            />
                          </label>
                        </td>
                        <td className="px-4 py-3">
                          {item.product_id ? (
                            <Link href={`${shopBasePath}/${item.product_id}?returnTo=${encodeURIComponent(orderReturnPath)}`} className="text-xs font-bold uppercase tracking-wide hover:underline" style={{ color: GOLD, fontFamily: 'var(--font-label)' }}>
                              Open
                            </Link>
                          ) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-col gap-3 border-t px-5 py-4 md:flex-row md:items-center md:justify-between" style={{ borderColor: BORDER }}>
                <div className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
                  Line discounts: <strong style={{ color: GOLD }}>-{formatCurrency(editedLineDiscount)}</strong>
                  <span className="mx-2">-</span>
                  New total: <strong style={{ color: GOLD }}>{formatCurrency(editedTotal)}</strong>
                </div>
                <button type="button" onClick={saveLineDiscounts} disabled={saving === 'line-discounts'} className="outline-button justify-center text-sm disabled:opacity-50">
                  Save Line Discounts
                </button>
              </div>
            </section>

            <section className="border p-5" style={{ borderColor: BORDER, background: 'white' }}>
              <h2 className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: GOLD, fontFamily: 'var(--font-label)' }}>Fulfillment</h2>
              <div className="flex flex-wrap gap-2">
                {FULFILLMENT_MARK_STATUSES.includes(order.fulfillment_status) ? (
                  <button
                    type="button"
                    onClick={() => updateFulfillment('pending')}
                    disabled={saving === 'pending'}
                    className="outline-button text-sm disabled:opacity-50"
                  >
                    Unmark {orderStatusLabel(order.fulfillment_status)}
                  </button>
                ) : (
                  FULFILLMENT_MARK_STATUSES.map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => { setPendingFulfillmentStatus(status); setNotifyCustomerOnFulfillment(true); setMessage(null); }}
                      disabled={saving === status}
                      className="outline-button text-sm disabled:opacity-50"
                    >
                      Mark {orderStatusLabel(status)}
                    </button>
                  ))
                )}
              </div>
              {pendingFulfillmentStatus && (
                <div className="mt-3 flex flex-wrap items-center gap-3 border px-4 py-3" style={{ borderColor: BORDER, background: 'var(--color-surface-container-low)' }}>
                  <span className="text-sm" style={{ color: 'var(--color-on-surface)' }}>
                    Mark this order as {orderStatusLabel(pendingFulfillmentStatus)}?
                  </span>
                  <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
                    <input
                      type="checkbox"
                      checked={notifyCustomerOnFulfillment}
                      onChange={(event) => setNotifyCustomerOnFulfillment(event.target.checked)}
                    />
                    Update customer via email
                  </label>
                  <button
                    type="button"
                    onClick={confirmFulfillmentUpdate}
                    disabled={saving === pendingFulfillmentStatus}
                    className="gold-button text-sm disabled:opacity-50"
                  >
                    {saving === pendingFulfillmentStatus ? 'Saving…' : 'OK'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingFulfillmentStatus(null)}
                    className="outline-button text-sm"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </section>

            <section className="border p-5" style={{ borderColor: BORDER, background: 'white' }}>
              <div className="flex items-center justify-between gap-4 mb-4">
                <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: GOLD, fontFamily: 'var(--font-label)' }}>Invoices</h2>
              </div>
              {invoices.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {invoices.map((invoice) => (
                    <div key={invoice.id} className="flex items-center justify-between border px-3 py-2 text-sm" style={{ borderColor: BORDER }}>
                      <Link
                        href={`${adminBasePath}/orders/${order.id}/invoice`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold underline underline-offset-2"
                        style={{ color: 'var(--color-on-surface)' }}
                      >
                        {invoice.invoice_number}
                      </Link>
                      <span style={{ color: 'var(--color-on-surface-variant)' }}>{orderStatusLabel(invoice.status)} — {formatCurrency(invoice.total)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>No invoice generated yet.</p>
              )}
            </section>

            <section className="border p-5" style={{ borderColor: BORDER, background: 'white' }}>
              <h2 className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: GOLD, fontFamily: 'var(--font-label)' }}>Internal Notes</h2>
              <textarea className="form-field w-full resize-y" rows={4} value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} />
              <button type="button" onClick={saveNotes} disabled={saving === 'notes'} className="gold-button text-sm mt-3 disabled:opacity-50">
                Save Notes
              </button>
            </section>
          </div>

          <div className="flex flex-col gap-6 h-fit">
          <aside className="border p-5" style={{ borderColor: BORDER, background: 'white' }}>
            <h2 className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: GOLD, fontFamily: 'var(--font-label)' }}>Summary</h2>
            <StatusRow label="Payment" value={order.payment_status} />
            <StatusRow label="Fulfillment" value={order.fulfillment_status} />
            <StatusRow label="Order" value={order.order_status} />
            <div className="border-t mt-4 pt-4" style={{ borderColor: BORDER }}>
              <MoneyRow label="Subtotal" value={order.subtotal} />
              {order.discount > 0 && <MoneyRow label="Discount" value={-order.discount} />}
              <MoneyRow label="Tax" value={order.tax} />
              <MoneyRow label="Shipping" value={order.shipping_fee} />
              <div className="border-t mt-3 pt-3" style={{ borderColor: BORDER }}>
                <MoneyRow label="Total" value={order.total} strong />
              </div>
              {order.refund_amount != null && order.refund_amount > 0 && (
                <div className="border-t mt-3 pt-3" style={{ borderColor: BORDER }}>
                  <MoneyRow label="Refunded" value={-order.refund_amount} />
                </div>
              )}
            </div>
            <div className="border-t mt-4 pt-4 text-sm" style={{ borderColor: BORDER, color: 'var(--color-on-surface-variant)' }}>
              <div>Payment method: {order.payment_method || '-'}</div>
              <div>Reference: {order.payment_reference || '-'}</div>
              <div>Shipping: {orderStatusLabel(order.shipping_method)}</div>
            </div>
          </aside>

          <section className="border p-5" style={{ borderColor: BORDER, background: 'white' }}>
            <h2 className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: GOLD, fontFamily: 'var(--font-label)' }}>Email History</h2>
            {orderEmails.length > 0 ? (
              <ul className="flex flex-col gap-3">
                {orderEmails.map((email) => (
                  <li key={email.id} className="border-b pb-3 last:border-b-0 last:pb-0" style={{ borderColor: BORDER }}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[0.7rem] font-bold uppercase tracking-widest" style={{ color: GOLD, fontFamily: 'var(--font-label)' }}>
                        {emailTypeLabel(email)}
                      </span>
                      <span className="text-[0.7rem] whitespace-nowrap" style={{ color: 'var(--color-on-surface-variant)' }}>
                        {formatOrderDate(email.created_at)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm break-words" style={{ color: 'var(--color-on-surface)' }}>
                      To {email.recipient}
                    </p>
                    {email.subject && (
                      <p className="mt-0.5 text-xs break-words" style={{ color: 'var(--color-on-surface-variant)' }}>
                        {email.subject}
                      </p>
                    )}
                    <p className="mt-0.5 text-[0.68rem]" style={{ color: 'var(--color-on-surface-variant)' }}>
                      {email.sent_by_email ? `Sent by ${email.sent_by_email}` : 'Sent automatically'}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>No emails sent from this page yet.</p>
            )}
          </section>
          </div>
        </div>
      </div>

      {showEmailInvoice && (
        <div className="fixed inset-0 z-50 overflow-y-auto px-4 py-6" style={{ background: 'rgba(0, 0, 0, 0.42)' }}>
          <div className="relative mx-auto w-full max-w-3xl border bg-white shadow-2xl" style={{ borderColor: BORDER }}>
            <button
              type="button"
              onClick={() => setShowEmailInvoice(false)}
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border bg-white"
              style={{ borderColor: 'rgba(115, 92, 0, 0.18)', color: GOLD }}
              aria-label="Close email invoice preview"
            >
              <span className="material-symbols-outlined text-[1.2rem]" aria-hidden="true">close</span>
            </button>

            <div className="border-b px-5 py-5 pr-16 md:px-7" style={{ borderColor: BORDER }}>
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.28em]" style={{ color: GOLD, fontFamily: 'var(--font-label)' }}>
                Email {invoiceDocLabel}
              </p>
              <h2 className="mt-2 text-2xl font-bold" style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}>
                Preview and Recipient
              </h2>
            </div>

            <div className="grid gap-5 p-5 md:p-7">
              <label className="grid gap-1">
                <span className="form-label">Customer Email</span>
                <input
                  className="form-field"
                  type="email"
                  value={emailRecipient}
                  onChange={(event) => setEmailRecipient(event.target.value)}
                  placeholder="customer@example.com"
                />
              </label>

              <div className="grid gap-1">
                <span className="form-label">Subject</span>
                <div className="border bg-white px-3 py-3 text-sm" style={{ borderColor: BORDER, color: 'var(--color-on-surface)' }}>
                  {emailContent.subject}
                </div>
              </div>

              <section className="border bg-white" style={{ borderColor: BORDER }}>
                <div className="border-b px-4 py-3" style={{ borderColor: BORDER }}>
                  <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: GOLD, fontFamily: 'var(--font-label)' }}>
                    Email Preview
                  </h3>
                </div>
                <div className="px-4 py-4 text-sm leading-relaxed" style={{ color: 'var(--color-on-surface)' }}>
                  <p>{emailContent.greeting}</p>
                  <p className="mt-3">{emailContent.intro}</p>
                  <div className="mt-5 overflow-hidden border" style={{ borderColor: BORDER }}>
                    {emailContent.items.length > 0 ? emailContent.items.map((item) => {
                      const imageUrl = normalizeLegacyLocalImageUrl(item.imageUrl);
                      return (
                      <div key={`${item.inventory}-${item.title}`} className="grid gap-3 border-b px-3 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center" style={{ borderColor: 'rgba(115, 92, 0, 0.12)' }}>
                        <div className="grid min-w-0 grid-cols-[4.5rem_minmax(0,1fr)] gap-3">
                          <div className="relative h-[4.5rem] overflow-hidden border" style={{ borderColor: 'rgba(115, 92, 0, 0.18)', background: '#f7f3e8' }}>
                            {imageUrl ? (
                              <Image
                                src={imageUrl}
                                alt={item.title}
                                fill
                                sizes="72px"
                                className="object-contain"
                                unoptimized={imageUrl.startsWith('/assets/')}
                              />
                            ) : (
                              <span className="material-symbols-outlined flex h-full w-full items-center justify-center text-[1.4rem]" aria-hidden="true" style={{ color: 'rgba(115, 92, 0, 0.34)' }}>
                                photo_camera
                              </span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <strong className="block" style={{ color: 'var(--color-on-surface)' }}>{item.title}</strong>
                            <span className="mt-1 block text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                              {item.inventory} - {item.details}
                            </span>
                          </div>
                        </div>
                        <div className="text-right font-bold" style={{ color: GOLD }}>
                          {item.discount && (
                            <>
                              <span className="block text-xs font-normal line-through" style={{ color: 'var(--color-on-surface-variant)' }}>
                                {item.originalPrice}
                              </span>
                              <span className="block text-xs">
                                Discount {item.discount}
                              </span>
                            </>
                          )}
                          <span>{item.price}</span>
                        </div>
                      </div>
                    ); }) : (
                      <p className="px-3 py-3" style={{ color: 'var(--color-on-surface-variant)' }}>No item details were attached.</p>
                    )}
                  </div>
                  <div className="mt-5 border px-4 py-3" style={{ borderColor: BORDER, background: 'var(--color-surface-container-low)' }}>
                    <EmailTotalRow label="Subtotal" value={emailContent.totals.subtotal} />
                    {emailContent.totals.discount && <EmailTotalRow label="Discount" value={emailContent.totals.discount} />}
                    <EmailTotalRow label="Tax" value={emailContent.totals.tax} />
                    <EmailTotalRow label="Shipping" value={emailContent.totals.shipping} />
                    <div className="mt-2 border-t pt-2" style={{ borderColor: BORDER }}>
                      <EmailTotalRow label="Total" value={emailContent.totals.total} strong />
                    </div>
                  </div>
                  <p className="mt-5">{emailContent.note}</p>
                  <p className="mt-3">{emailContent.closing}</p>
                </div>
              </section>

              {emailMessage && (
                <p className="text-sm font-bold" style={{ color: emailMessage.ok ? GOLD : 'var(--color-error)' }}>
                  {emailMessage.text}
                </p>
              )}

              <div className="flex flex-col-reverse gap-2 border-t pt-4 md:flex-row md:justify-end" style={{ borderColor: BORDER }}>
                <button type="button" onClick={() => setShowEmailInvoice(false)} className="outline-button justify-center text-sm">
                  Close
                </button>
                <button type="button" onClick={sendInvoiceEmail} disabled={emailSending} className="gold-button justify-center text-sm disabled:opacity-50">
                  {emailSending ? 'Sending...' : `Send ${invoiceDocLabel} Email`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showEmailUpdate && emailUpdateContent && (
        <div className="fixed inset-0 z-50 overflow-y-auto px-4 py-6" style={{ background: 'rgba(0, 0, 0, 0.42)' }}>
          <div className="relative mx-auto w-full max-w-lg border bg-white shadow-2xl" style={{ borderColor: BORDER }}>
            <button
              type="button"
              onClick={() => setShowEmailUpdate(false)}
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border bg-white"
              style={{ borderColor: 'rgba(115, 92, 0, 0.18)', color: GOLD }}
              aria-label="Close email update preview"
            >
              <span className="material-symbols-outlined text-[1.2rem]" aria-hidden="true">close</span>
            </button>

            <div className="border-b px-5 py-5 pr-16 md:px-7" style={{ borderColor: BORDER }}>
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.28em]" style={{ color: GOLD, fontFamily: 'var(--font-label)' }}>
                Email Update
              </p>
              <h2 className="mt-2 text-2xl font-bold" style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}>
                Notify Customer{emailUpdateStatus ? `: ${orderStatusLabel(emailUpdateStatus)}` : ''}
              </h2>
            </div>

            <div className="grid gap-5 p-5 md:p-7">
              <label className="grid gap-1">
                <span className="form-label">Customer Email</span>
                <input
                  className="form-field"
                  type="email"
                  value={emailUpdateRecipient}
                  onChange={(event) => setEmailUpdateRecipient(event.target.value)}
                  placeholder="customer@example.com"
                />
              </label>

              <div className="grid gap-1">
                <span className="form-label">Subject</span>
                <div className="border bg-white px-3 py-3 text-sm" style={{ borderColor: BORDER, color: 'var(--color-on-surface)' }}>
                  {emailUpdateContent.subject}
                </div>
              </div>

              <section className="border bg-white" style={{ borderColor: BORDER }}>
                <div className="border-b px-4 py-3" style={{ borderColor: BORDER }}>
                  <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: GOLD, fontFamily: 'var(--font-label)' }}>
                    Email Preview
                  </h3>
                </div>
                <div className="whitespace-pre-line px-4 py-4 text-sm leading-relaxed" style={{ color: 'var(--color-on-surface)' }}>
                  {emailUpdateContent.text}
                </div>
              </section>

              {emailUpdateMessage && (
                <p className="text-sm font-bold" style={{ color: emailUpdateMessage.ok ? GOLD : 'var(--color-error)' }}>
                  {emailUpdateMessage.text}
                </p>
              )}

              <div className="flex flex-col-reverse gap-2 border-t pt-4 md:flex-row md:justify-end" style={{ borderColor: BORDER }}>
                <button type="button" onClick={() => setShowEmailUpdate(false)} className="outline-button justify-center text-sm">
                  Close
                </button>
                <button type="button" onClick={sendFulfillmentUpdateEmail} disabled={emailUpdateSending} className="gold-button justify-center text-sm disabled:opacity-50">
                  {emailUpdateSending ? 'Sending...' : 'Send Update Email'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function EmailTotalRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-4 py-1" style={{ color: strong ? GOLD : 'var(--color-on-surface-variant)' }}>
      <span className={strong ? 'font-bold' : ''}>{label}</span>
      <span className={strong ? 'font-bold' : ''}>{value}</span>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-[0.62rem] font-bold uppercase tracking-widest" style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}>{label}</p>
      <p className="mt-1 font-medium" style={{ color: 'var(--color-on-surface)' }}>{value || '-'}</p>
    </div>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-1 text-sm">
      <span style={{ color: 'var(--color-on-surface-variant)' }}>{label}</span>
      <span className="font-bold" style={{ color: GOLD }}>{orderStatusLabel(value)}</span>
    </div>
  );
}

function MoneyRow({ label, value, strong = false }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-4 py-1 text-sm" style={{ color: strong ? GOLD : 'var(--color-on-surface-variant)' }}>
      <span className={strong ? 'font-bold' : ''}>{label}</span>
      <span className={strong ? 'font-bold' : ''}>{formatCurrency(value)}</span>
    </div>
  );
}

function clampMoneyDiscount(value: number, max: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(value, 0), Math.max(max, 0));
}

function emailTypeLabel(email: { email_type: string; status: string | null }): string {
  if (email.email_type === 'invoice') return 'Invoice';
  if (email.email_type === 'receipt') return 'Receipt';
  if (email.email_type === 'fulfillment_update') {
    return email.status ? `Update — ${orderStatusLabel(email.status)}` : 'Fulfillment Update';
  }
  return email.email_type;
}
