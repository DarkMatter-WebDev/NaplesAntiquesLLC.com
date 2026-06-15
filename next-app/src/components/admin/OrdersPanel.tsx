'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Product } from '@/types/product';
import { isProductPurchasable, productStatusLabel } from '@/types/product';
import type { Order, PaymentStatus, FulfillmentStatus, OrderStatus, ShippingMethod } from '@/types/sales';
import { formatCurrency, formatOrderDate, orderStatusLabel } from '@/types/sales';
import type { SpotData } from '@/types/product';
import { buildAddressObject, generateOrderNumber, getProductImages, getProductMetal, getProductWeight, getSnapshotPrice } from '@/lib/sales';

const GOLD = '#735c00';
const BORDER = 'var(--color-outline-variant)';
const FL_TAX_RATE = 0.065;

interface Props {
  initialOrders: Order[];
  products: Product[];
  spotData: SpotData | null;
  locale: string;
}

type FormState = {
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  payment_method: string;
  shipping_method: ShippingMethod;
  shipping_fee: string;
  discount: string;
  customer_notes: string;
  internal_notes: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
};

const emptyForm: FormState = {
  customer_name: '',
  customer_email: '',
  customer_phone: '',
  payment_method: 'manual',
  shipping_method: 'pickup',
  shipping_fee: '0',
  discount: '0',
  customer_notes: '',
  internal_notes: '',
  address_line1: '',
  address_line2: '',
  city: '',
  state: 'FL',
  postal_code: '',
  country: 'United States',
};

export default function OrdersPanel({ initialOrders, products, spotData, locale }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const adminBasePath = locale === 'es' ? '/es/admin' : '/admin';
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [search, setSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [fulfillmentFilter, setFulfillmentFilter] = useState('');
  const [orderFilter, setOrderFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const availableProducts = useMemo(
    () => products.filter((product) => isProductPurchasable(product.status)),
    [products],
  );

  const selectedProducts = useMemo(
    () => products.filter((product) => selectedProductIds.includes(product.id)),
    [products, selectedProductIds],
  );

  const subtotal = selectedProducts.reduce((sum, product) => sum + getSnapshotPrice(product, spotData), 0);
  const discount = Number(form.discount) || 0;
  const shippingFee = Number(form.shipping_fee) || 0;
  const tax = Math.max(subtotal - discount, 0) * FL_TAX_RATE;
  const total = Math.max(subtotal - discount, 0) + tax + shippingFee;

  const filteredOrders = orders.filter((order) => {
    if (paymentFilter && order.payment_status !== paymentFilter) return false;
    if (fulfillmentFilter && order.fulfillment_status !== fulfillmentFilter) return false;
    if (orderFilter && order.order_status !== orderFilter) return false;
    if (search) {
      const haystack = [
        order.order_number,
        order.customer_name,
        order.customer_email,
        order.customer_phone,
        ...(order.order_items ?? []).map((item) => item.title_snapshot),
      ].filter(Boolean).join(' ').toLowerCase();
      if (!haystack.includes(search.toLowerCase())) return false;
    }
    return true;
  });

  function toggleProduct(id: string) {
    setSelectedProductIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }

  async function createOrder() {
    if (selectedProducts.length === 0) {
      setMessage({ text: 'Select at least one available product.', ok: false });
      return;
    }
    if (!form.customer_name.trim() || !form.customer_email.trim()) {
      setMessage({ text: 'Customer name and email are required.', ok: false });
      return;
    }

    setSaving(true);
    setMessage(null);

    const orderPayload = {
      order_number: generateOrderNumber(),
      customer_name: form.customer_name.trim(),
      customer_email: form.customer_email.trim(),
      customer_phone: form.customer_phone.trim() || null,
      subtotal,
      tax,
      shipping_fee: shippingFee,
      discount,
      total,
      payment_status: 'unpaid' as PaymentStatus,
      fulfillment_status: 'pending' as FulfillmentStatus,
      order_status: 'open' as OrderStatus,
      payment_method: form.payment_method.trim() || 'manual',
      shipping_method: form.shipping_method,
      shipping_address: buildAddressObject({
        line1: form.address_line1,
        line2: form.address_line2,
        city: form.city,
        state: form.state,
        postalCode: form.postal_code,
        country: form.country,
      }),
      billing_address: null,
      internal_notes: form.internal_notes.trim() || null,
      customer_notes: form.customer_notes.trim() || null,
    };

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert(orderPayload)
      .select()
      .single();

    if (orderError || !order) {
      setMessage({ text: orderError?.message ?? 'Could not create order.', ok: false });
      setSaving(false);
      return;
    }

    const itemPayloads = selectedProducts.map((product) => ({
      order_id: order.id,
      product_id: product.id,
      inventory_number: product.inventory_number != null ? String(product.inventory_number) : product.sku ?? product.id,
      title_snapshot: product.title,
      metal_snapshot: getProductMetal(product),
      purity_snapshot: product.purity ? String(product.purity) : null,
      gram_weight_snapshot: getProductWeight(product),
      price_snapshot: getSnapshotPrice(product, spotData),
      image_snapshot: getProductImages(product)[0] ?? null,
    }));

    const { error: itemsError } = await supabase.from('order_items').insert(itemPayloads);
    if (itemsError) {
      setMessage({ text: itemsError.message, ok: false });
      setSaving(false);
      return;
    }

    const { error: productError } = await supabase
      .from('products')
      .update({ status: 'pending_payment' })
      .in('id', selectedProductIds);

    if (productError) {
      setMessage({ text: `Order created, but products were not reserved: ${productError.message}`, ok: false });
      setSaving(false);
      return;
    }

    setOrders((current) => [{ ...(order as Order), order_items: itemPayloads as never }, ...current]);
    setSaving(false);
    setShowCreate(false);
    setSelectedProductIds([]);
    setForm(emptyForm);
    router.push(`${adminBasePath}/orders/${order.id}`);
    router.refresh();
  }

  return (
    <main className="px-4 md:px-8 py-8">
      <div className="max-w-[1500px] mx-auto">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.35em] mb-3"
              style={{ color: GOLD, fontFamily: 'var(--font-label)' }}>
              Sales
            </p>
            <h1 className="text-3xl md:text-4xl font-bold"
              style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}>
              Orders
            </h1>
          </div>
          <button type="button" onClick={() => setShowCreate(true)} className="gold-button text-sm">
            Create Manual Order
          </button>
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

        <div className="mb-5 flex flex-wrap gap-2 items-end">
          <input
            type="search"
            placeholder="Search order, customer, item..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="form-field flex-1 min-w-60"
          />
          <Filter label="Payment" value={paymentFilter} setValue={setPaymentFilter} options={['unpaid', 'pending', 'paid', 'failed', 'refunded', 'partially_refunded']} />
          <Filter label="Fulfillment" value={fulfillmentFilter} setValue={setFulfillmentFilter} options={['pending', 'packed', 'shipped', 'picked_up', 'cancelled']} />
          <Filter label="Order" value={orderFilter} setValue={setOrderFilter} options={['open', 'completed', 'cancelled', 'refunded']} />
          {(search || paymentFilter || fulfillmentFilter || orderFilter) && (
            <button
              type="button"
              onClick={() => { setSearch(''); setPaymentFilter(''); setFulfillmentFilter(''); setOrderFilter(''); }}
              className="text-xs font-bold uppercase tracking-wide hover:underline pb-2"
              style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}
            >
              Clear
            </button>
          )}
        </div>

        <div className="overflow-x-auto border" style={{ borderColor: BORDER, background: 'white' }}>
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead style={{ background: 'var(--color-surface-container-low)' }}>
              <tr>
                {['Order', 'Date', 'Customer', 'Email / Phone', 'Items', 'Total', 'Payment', 'Fulfillment', 'Status', 'Actions'].map((heading) => (
                  <th key={heading} className="px-4 py-3 text-[0.68rem] uppercase tracking-widest font-bold"
                    style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}>
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order) => (
                <tr key={order.id} className="border-t" style={{ borderColor: BORDER }}>
                  <td className="px-4 py-3 font-bold" style={{ color: GOLD }}>{order.order_number}</td>
                  <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--color-on-surface-variant)' }}>{formatOrderDate(order.created_at)}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--color-on-surface)' }}>{order.customer_name || '-'}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--color-on-surface-variant)' }}>
                    <div>{order.customer_email || '-'}</div>
                    <div>{order.customer_phone || ''}</div>
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--color-on-surface-variant)' }}>
                    {(order.order_items ?? []).map((item) => item.title_snapshot).join(', ') || '-'}
                  </td>
                  <td className="px-4 py-3 font-semibold" style={{ color: GOLD }}>{formatCurrency(order.total)}</td>
                  <td className="px-4 py-3"><Badge value={order.payment_status} /></td>
                  <td className="px-4 py-3"><Badge value={order.fulfillment_status} /></td>
                  <td className="px-4 py-3"><Badge value={order.order_status} /></td>
                  <td className="px-4 py-3">
                    <Link href={`${adminBasePath}/orders/${order.id}`} className="text-xs font-bold uppercase tracking-wide hover:underline" style={{ color: GOLD, fontFamily: 'var(--font-label)' }}>
                      View
                    </Link>
                  </td>
                </tr>
              ))}
              {filteredOrders.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center" style={{ color: 'var(--color-on-surface-variant)' }}>
                    No orders found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 overflow-y-auto px-4 py-8" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="mx-auto w-full max-w-5xl border" style={{ background: 'var(--color-background)', borderColor: BORDER }}>
            <div className="flex items-center justify-between border-b px-6 py-4" style={{ borderColor: BORDER }}>
              <h2 className="text-lg font-bold" style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}>
                Create Manual Order
              </h2>
              <button type="button" onClick={() => setShowCreate(false)}
                className="text-sm font-bold uppercase tracking-wide"
                style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}>
                Close
              </button>
            </div>

            <div className="grid lg:grid-cols-[1fr_21rem] gap-6 p-6">
              <div className="flex flex-col gap-5">
                <section>
                  <h3 className="form-label">Customer</h3>
                  <div className="grid md:grid-cols-3 gap-3">
                    <input className="form-field" placeholder="Customer name" value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} />
                    <input className="form-field" type="email" placeholder="Email" value={form.customer_email} onChange={(e) => setForm({ ...form, customer_email: e.target.value })} />
                    <input className="form-field" type="tel" placeholder="Phone" value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} />
                  </div>
                </section>

                <section>
                  <h3 className="form-label">Products</h3>
                  <div className="border max-h-72 overflow-y-auto" style={{ borderColor: BORDER }}>
                    {availableProducts.map((product) => {
                      const price = getSnapshotPrice(product, spotData);
                      return (
                        <label key={product.id} className="flex items-center gap-3 border-b px-3 py-2 cursor-pointer" style={{ borderColor: BORDER }}>
                          <input type="checkbox" checked={selectedProductIds.includes(product.id)} onChange={() => toggleProduct(product.id)} style={{ accentColor: GOLD }} />
                          <span className="flex-1 min-w-0">
                            <span className="block text-sm font-semibold truncate" style={{ color: 'var(--color-on-surface)' }}>{product.title}</span>
                            <span className="block text-[0.68rem] uppercase tracking-wide" style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}>
                              {product.inventory_number || product.sku || product.id} · {productStatusLabel(product.status)}
                            </span>
                          </span>
                          <span className="text-sm font-bold" style={{ color: GOLD }}>{formatCurrency(price)}</span>
                        </label>
                      );
                    })}
                    {availableProducts.length === 0 && (
                      <p className="px-3 py-8 text-center text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
                        No available products to add.
                      </p>
                    )}
                  </div>
                </section>

                <section>
                  <h3 className="form-label">Shipping / Pickup</h3>
                  <div className="grid md:grid-cols-3 gap-3">
                    <select className="form-field" value={form.shipping_method} onChange={(e) => setForm({ ...form, shipping_method: e.target.value as ShippingMethod })}>
                      <option value="pickup">Pickup</option>
                      <option value="shipping">Shipping</option>
                      <option value="local_delivery">Local Delivery</option>
                    </select>
                    <input className="form-field" type="number" step="0.01" placeholder="Shipping fee" value={form.shipping_fee} onChange={(e) => setForm({ ...form, shipping_fee: e.target.value })} />
                    <input className="form-field" type="number" step="0.01" placeholder="Discount" value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} />
                  </div>
                  <div className="mt-3 grid md:grid-cols-2 gap-3">
                    <input className="form-field md:col-span-2" placeholder="Address line 1" value={form.address_line1} onChange={(e) => setForm({ ...form, address_line1: e.target.value })} />
                    <input className="form-field md:col-span-2" placeholder="Address line 2" value={form.address_line2} onChange={(e) => setForm({ ...form, address_line2: e.target.value })} />
                    <input className="form-field" placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                    <input className="form-field" placeholder="State" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
                    <input className="form-field" placeholder="Postal code" value={form.postal_code} onChange={(e) => setForm({ ...form, postal_code: e.target.value })} />
                    <input className="form-field" placeholder="Country" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
                  </div>
                </section>

                <section>
                  <h3 className="form-label">Notes</h3>
                  <div className="grid md:grid-cols-2 gap-3">
                    <textarea className="form-field resize-y" rows={3} placeholder="Customer notes" value={form.customer_notes} onChange={(e) => setForm({ ...form, customer_notes: e.target.value })} />
                    <textarea className="form-field resize-y" rows={3} placeholder="Internal notes" value={form.internal_notes} onChange={(e) => setForm({ ...form, internal_notes: e.target.value })} />
                  </div>
                </section>
              </div>

              <aside className="border p-4 h-fit" style={{ borderColor: BORDER, background: 'white' }}>
                <h3 className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: GOLD, fontFamily: 'var(--font-label)' }}>
                  Order Summary
                </h3>
                <SummaryRow label="Subtotal" value={formatCurrency(subtotal)} />
                <SummaryRow label="Discount" value={`-${formatCurrency(discount)}`} />
                <SummaryRow label="Tax" value={formatCurrency(tax)} />
                <SummaryRow label="Shipping" value={formatCurrency(shippingFee)} />
                <div className="border-t mt-3 pt-3" style={{ borderColor: BORDER }}>
                  <SummaryRow label="Total" value={formatCurrency(total)} strong />
                </div>
                <button type="button" onClick={createOrder} disabled={saving} className="gold-button w-full mt-5 text-sm disabled:opacity-50">
                  {saving ? 'Creating...' : 'Create Order'}
                </button>
              </aside>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function Filter({ label, value, setValue, options }: { label: string; value: string; setValue: (value: string) => void; options: string[] }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[0.58rem] font-bold uppercase tracking-[0.14em]" style={{ color: GOLD, fontFamily: 'var(--font-label)' }}>{label}</span>
      <select className="form-field text-xs" value={value} onChange={(e) => setValue(e.target.value)}>
        <option value="">All</option>
        {options.map((option) => <option key={option} value={option}>{orderStatusLabel(option)}</option>)}
      </select>
    </div>
  );
}

function Badge({ value }: { value: string }) {
  return (
    <span className="inline-flex px-2 py-1 text-[0.62rem] font-bold uppercase tracking-wide"
      style={{ background: 'var(--color-surface-container-low)', color: 'var(--color-on-surface-variant)' }}>
      {orderStatusLabel(value)}
    </span>
  );
}

function SummaryRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-4 py-1 text-sm" style={{ color: strong ? GOLD : 'var(--color-on-surface-variant)' }}>
      <span className={strong ? 'font-bold' : ''}>{label}</span>
      <span className={strong ? 'font-bold' : ''}>{value}</span>
    </div>
  );
}
