import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getVerifiedUser } from '@/lib/auth-claims';
import AdminHeader from '@/components/admin/AdminHeader';
import { formatCurrency, formatOrderDate, orderStatusLabel } from '@/types/sales';

export const metadata: Metadata = { title: 'Admin - User Invoices' };

interface Props {
  params: Promise<{ locale: string; id: string }>;
}

type SiteUser = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
};

type InvoiceRow = {
  id: string;
  invoice_number: string;
  order_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  invoice_date: string | null;
  due_date: string | null;
  subtotal: number;
  tax: number;
  shipping_fee: number;
  discount: number;
  total: number;
  status: string;
  invoice_pdf_url: string | null;
  created_at: string;
};

type OrderRow = {
  id: string;
  order_number: string;
  total: number;
  payment_status: string;
  order_status: string;
  created_at: string;
};

function displayName(user: SiteUser) {
  const fromParts = [user.first_name, user.last_name].filter(Boolean).join(' ');
  return user.full_name || fromParts || user.email || 'Account';
}

export default async function AdminUserInvoicesPage({ params }: Props) {
  const { locale, id } = await params;
  const isEs = locale === 'es';
  const adminBasePath = isEs ? '/es/admin' : '/admin';

  const supabase = await createClient();
  const user = await getVerifiedUser(supabase);

  if (!user) {
    redirect(isEs ? '/es/account/sign-in' : '/account/sign-in');
  }

  const { data: adminProfile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if (!adminProfile?.is_admin) {
    redirect(isEs ? '/es/account' : '/account');
  }

  const [
    { data: siteUser },
    { data: invoices },
    { data: orders },
    { count: unreadMessagesCount },
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, first_name, last_name, full_name, email, phone')
      .eq('id', id)
      .single(),
    supabase
      .from('invoices')
      .select('id, invoice_number, order_id, customer_name, customer_email, invoice_date, due_date, subtotal, tax, shipping_fee, discount, total, status, invoice_pdf_url, created_at')
      .eq('user_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('orders')
      .select('id, order_number, total, payment_status, order_status, created_at')
      .eq('user_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('admin_notifications')
      .select('id', { count: 'exact', head: true })
      .eq('is_read', false),
  ]);

  if (!siteUser) notFound();

  const invoiceRows = (invoices ?? []) as InvoiceRow[];
  const orderRows = (orders ?? []) as OrderRow[];
  const invoicedOrderIds = new Set(invoiceRows.map((invoice) => invoice.order_id).filter(Boolean));
  const ordersWithoutInvoices = orderRows.filter((order) => !invoicedOrderIds.has(order.id));
  const invoiceTotal = invoiceRows.reduce((sum, invoice) => sum + Number(invoice.total ?? 0), 0);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-background, #fafaf8)' }}>
      <AdminHeader
        adminBasePath={adminBasePath}
        active="users"
        unreadMessagesCount={unreadMessagesCount ?? 0}
        userEmail={user.email}
      />

      <main className="px-4 md:px-8 py-8">
        <div className="ultrawide-page-medium max-w-[1200px] mx-auto">
          <div className="mb-6">
            <Link href={`${adminBasePath}/users`} className="hover-underline-grow text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}>
              Back to Users
            </Link>
          </div>

          <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.35em] mb-3" style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}>
                User Invoices
              </p>
              <h1 className="text-3xl md:text-4xl font-bold" style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}>
                {displayName(siteUser as SiteUser)}
              </h1>
              <p className="mt-2 text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
                {(siteUser as SiteUser).email || 'No email'}{(siteUser as SiteUser).phone ? ` · ${(siteUser as SiteUser).phone}` : ''}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <Metric label="Orders" value={orderRows.length} />
              <Metric label="Invoices" value={invoiceRows.length} />
              <Metric label="Invoice Total" value={formatCurrency(invoiceTotal)} />
            </div>
          </div>

          <section className="border mb-8" style={{ borderColor: 'var(--color-outline-variant)', background: 'white' }}>
            <div className="border-b px-5 py-4" style={{ borderColor: 'var(--color-outline-variant)' }}>
              <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}>
                Generated Invoices
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead style={{ background: 'var(--color-surface-container-low)' }}>
                  <tr>
                    {['Invoice', 'Order', 'Date', 'Status', 'Subtotal', 'Tax', 'Shipping', 'Total', 'File'].map((heading) => (
                      <th key={heading} className="px-4 py-3 text-[0.68rem] uppercase tracking-widest font-bold" style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}>
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {invoiceRows.map((invoice) => (
                    <tr key={invoice.id} className="border-t" style={{ borderColor: 'var(--color-outline-variant)' }}>
                      <td className="px-4 py-3 font-semibold" style={{ color: 'var(--color-on-surface)' }}>{invoice.invoice_number}</td>
                      <td className="px-4 py-3">
                        {invoice.order_id ? (
                          <Link href={`${adminBasePath}/orders/${invoice.order_id}`} className="hover-underline-grow text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}>
                            Open Order
                          </Link>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--color-on-surface-variant)' }}>{formatOrderDate(invoice.invoice_date || invoice.created_at)}</td>
                      <td className="px-4 py-3" style={{ color: 'var(--color-primary)' }}>{orderStatusLabel(invoice.status)}</td>
                      <td className="px-4 py-3" style={{ color: 'var(--color-on-surface-variant)' }}>{formatCurrency(invoice.subtotal)}</td>
                      <td className="px-4 py-3" style={{ color: 'var(--color-on-surface-variant)' }}>{formatCurrency(invoice.tax)}</td>
                      <td className="px-4 py-3" style={{ color: 'var(--color-on-surface-variant)' }}>{formatCurrency(invoice.shipping_fee)}</td>
                      <td className="px-4 py-3 font-semibold" style={{ color: 'var(--color-primary)' }}>{formatCurrency(invoice.total)}</td>
                      <td className="px-4 py-3">
                        {invoice.invoice_pdf_url ? (
                          <a href={invoice.invoice_pdf_url} className="hover-underline-grow text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}>
                            PDF
                          </a>
                        ) : '-'}
                      </td>
                    </tr>
                  ))}
                  {invoiceRows.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center" style={{ color: 'var(--color-on-surface-variant)' }}>
                        No invoices generated for this account yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {ordersWithoutInvoices.length > 0 && (
            <section className="border" style={{ borderColor: 'var(--color-outline-variant)', background: 'white' }}>
              <div className="border-b px-5 py-4" style={{ borderColor: 'var(--color-outline-variant)' }}>
                <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}>
                  Purchases Without Generated Invoices
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead style={{ background: 'var(--color-surface-container-low)' }}>
                    <tr>
                      {['Order', 'Created', 'Payment', 'Order Status', 'Total', 'Action'].map((heading) => (
                        <th key={heading} className="px-4 py-3 text-[0.68rem] uppercase tracking-widest font-bold" style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}>
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ordersWithoutInvoices.map((order) => (
                      <tr key={order.id} className="border-t" style={{ borderColor: 'var(--color-outline-variant)' }}>
                        <td className="px-4 py-3 font-semibold" style={{ color: 'var(--color-on-surface)' }}>{order.order_number}</td>
                        <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--color-on-surface-variant)' }}>{formatOrderDate(order.created_at)}</td>
                        <td className="px-4 py-3" style={{ color: 'var(--color-primary)' }}>{orderStatusLabel(order.payment_status)}</td>
                        <td className="px-4 py-3" style={{ color: 'var(--color-on-surface-variant)' }}>{orderStatusLabel(order.order_status)}</td>
                        <td className="px-4 py-3 font-semibold" style={{ color: 'var(--color-primary)' }}>{formatCurrency(order.total)}</td>
                        <td className="px-4 py-3">
                          <Link href={`${adminBasePath}/orders/${order.id}`} className="gold-button text-xs">
                            Open Order
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border px-4 py-3" style={{ borderColor: 'var(--color-outline-variant)', background: 'white' }}>
      <p className="text-xl font-bold" style={{ color: 'var(--color-on-surface)' }}>{value}</p>
      <p className="text-[0.62rem] uppercase tracking-widest" style={{ color: 'var(--color-on-surface-variant)' }}>{label}</p>
    </div>
  );
}
