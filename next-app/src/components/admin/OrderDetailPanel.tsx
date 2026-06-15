'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Order, OrderItem, FulfillmentStatus, OrderStatus } from '@/types/sales';
import { formatCurrency, formatOrderDate, orderStatusLabel } from '@/types/sales';

const GOLD = '#735c00';
const BORDER = 'var(--color-outline-variant)';

interface Invoice {
  id: string;
  invoice_number: string;
  status: string;
  total: number;
  created_at: string;
}

interface Props {
  initialOrder: Order & { order_items: OrderItem[] };
  initialInvoices: Invoice[];
  locale: string;
}

export default function OrderDetailPanel({ initialOrder, initialInvoices, locale }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const adminBasePath = locale === 'es' ? '/es/admin' : '/admin';
  const [order, setOrder] = useState(initialOrder);
  const [invoices, setInvoices] = useState(initialInvoices);
  const [internalNotes, setInternalNotes] = useState(order.internal_notes ?? '');
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const productIds = order.order_items.map((item) => item.product_id).filter(Boolean) as string[];

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

  async function updateFulfillment(status: FulfillmentStatus) {
    const ok = await updateOrder({ fulfillment_status: status }, status);
    if (ok) setMessage({ text: `Fulfillment marked ${orderStatusLabel(status)}.`, ok: true });
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

  async function saveNotes() {
    const ok = await updateOrder({ internal_notes: internalNotes.trim() || null }, 'notes');
    if (ok) setMessage({ text: 'Internal notes saved.', ok: true });
  }

  async function generateInvoice() {
    setSaving('invoice');
    setMessage(null);
    const invoiceNumber = `INV-${order.order_number.replace(/^NEJ-/, '')}`;
    const { data, error } = await supabase
      .from('invoices')
      .insert({
        invoice_number: invoiceNumber,
        order_id: order.id,
        user_id: order.user_id,
        customer_name: order.customer_name,
        customer_email: order.customer_email,
        subtotal: order.subtotal,
        tax: order.tax,
        shipping_fee: order.shipping_fee,
        discount: order.discount,
        total: order.total,
        status: order.payment_status === 'paid' ? 'paid' : 'draft',
      })
      .select()
      .single();

    if (error) {
      setMessage({ text: error.message, ok: false });
      setSaving(null);
      return;
    }

    setInvoices((current) => [data as Invoice, ...current]);
    setMessage({ text: 'Invoice record generated. Printable invoice comes in the next invoice chunk.', ok: true });
    setSaving(null);
    router.refresh();
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
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={markPaid} disabled={saving === 'paid'} className="gold-button text-sm disabled:opacity-50">Mark Paid</button>
            <button type="button" onClick={markUnpaid} disabled={saving === 'unpaid'} className="outline-button text-sm disabled:opacity-50">Mark Unpaid</button>
            <button type="button" onClick={markRefunded} disabled={saving === 'refunded'} className="outline-button text-sm disabled:opacity-50">Mark Refunded</button>
            <button type="button" onClick={cancelOrder} disabled={saving === 'cancelled'} className="outline-button text-sm disabled:opacity-50">Cancel Order</button>
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
              {order.customer_notes && (
                <p className="mt-4 text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
                  {order.customer_notes}
                </p>
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
                      {['Item', 'Inventory', 'Metal', 'Purity', 'Weight', 'Price', 'Product'].map((heading) => (
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
                        <td className="px-4 py-3" style={{ color: 'var(--color-on-surface-variant)' }}>{item.inventory_number || '-'}</td>
                        <td className="px-4 py-3" style={{ color: 'var(--color-on-surface-variant)' }}>{item.metal_snapshot || '-'}</td>
                        <td className="px-4 py-3" style={{ color: 'var(--color-on-surface-variant)' }}>{item.purity_snapshot || '-'}</td>
                        <td className="px-4 py-3" style={{ color: 'var(--color-on-surface-variant)' }}>{item.gram_weight_snapshot ? `${item.gram_weight_snapshot}g` : '-'}</td>
                        <td className="px-4 py-3 font-semibold" style={{ color: GOLD }}>{formatCurrency(item.price_snapshot)}</td>
                        <td className="px-4 py-3">
                          {item.product_id ? (
                            <Link href={`${adminBasePath}?product=${item.product_id}`} className="text-xs font-bold uppercase tracking-wide hover:underline" style={{ color: GOLD, fontFamily: 'var(--font-label)' }}>
                              Open
                            </Link>
                          ) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="border p-5" style={{ borderColor: BORDER, background: 'white' }}>
              <h2 className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: GOLD, fontFamily: 'var(--font-label)' }}>Fulfillment</h2>
              <div className="flex flex-wrap gap-2">
                {(['packed', 'shipped', 'picked_up'] as FulfillmentStatus[]).map((status) => (
                  <button key={status} type="button" onClick={() => updateFulfillment(status)} disabled={saving === status} className="outline-button text-sm disabled:opacity-50">
                    Mark {orderStatusLabel(status)}
                  </button>
                ))}
              </div>
            </section>

            <section className="border p-5" style={{ borderColor: BORDER, background: 'white' }}>
              <div className="flex items-center justify-between gap-4 mb-4">
                <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: GOLD, fontFamily: 'var(--font-label)' }}>Invoices</h2>
                <button type="button" onClick={generateInvoice} disabled={saving === 'invoice'} className="outline-button text-sm disabled:opacity-50">
                  Generate Invoice
                </button>
              </div>
              {invoices.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {invoices.map((invoice) => (
                    <div key={invoice.id} className="flex items-center justify-between border px-3 py-2 text-sm" style={{ borderColor: BORDER }}>
                      <span className="font-semibold" style={{ color: 'var(--color-on-surface)' }}>{invoice.invoice_number}</span>
                      <span style={{ color: 'var(--color-on-surface-variant)' }}>{orderStatusLabel(invoice.status)} · {formatCurrency(invoice.total)}</span>
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

          <aside className="border p-5 h-fit" style={{ borderColor: BORDER, background: 'white' }}>
            <h2 className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: GOLD, fontFamily: 'var(--font-label)' }}>Summary</h2>
            <StatusRow label="Payment" value={order.payment_status} />
            <StatusRow label="Fulfillment" value={order.fulfillment_status} />
            <StatusRow label="Order" value={order.order_status} />
            <div className="border-t mt-4 pt-4" style={{ borderColor: BORDER }}>
              <MoneyRow label="Subtotal" value={order.subtotal} />
              <MoneyRow label="Discount" value={-order.discount} />
              <MoneyRow label="Tax" value={order.tax} />
              <MoneyRow label="Shipping" value={order.shipping_fee} />
              <div className="border-t mt-3 pt-3" style={{ borderColor: BORDER }}>
                <MoneyRow label="Total" value={order.total} strong />
              </div>
            </div>
            <div className="border-t mt-4 pt-4 text-sm" style={{ borderColor: BORDER, color: 'var(--color-on-surface-variant)' }}>
              <div>Payment method: {order.payment_method || '-'}</div>
              <div>Reference: {order.payment_reference || '-'}</div>
              <div>Shipping: {orderStatusLabel(order.shipping_method)}</div>
            </div>
          </aside>
        </div>
      </div>
    </main>
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
