import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { getVerifiedUser } from '@/lib/auth-claims';
import AdminHeader from '@/components/admin/AdminHeader';
import DiscountCodesManager from '@/components/admin/DiscountCodesManager';
import { isDiscountType, type DiscountCodeRecord } from '@/lib/discount-codes';

export const metadata: Metadata = { title: 'Admin - Discount Codes' };

interface Props {
  params: Promise<{ locale: string }>;
}

const SELECT_COLUMNS =
  'id, code, discount_type, discount_value, min_order_subtotal, expires_at, max_redemptions, times_used, active, notes, created_at, updated_at';

export default async function AdminDiscountCodesPage({ params }: Props) {
  const { locale } = await params;
  const isEs = locale === 'es';
  const adminBasePath = isEs ? '/es/admin' : '/admin';

  const supabase = await createClient();
  const user = await getVerifiedUser(supabase);

  if (!user) {
    redirect(isEs ? '/es/account/sign-in' : '/account/sign-in');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if (!profile?.is_admin) {
    redirect(isEs ? '/es/account' : '/account');
  }

  const [codesResult, { count: unreadMessagesCount }] = await Promise.all([
    supabase.from('discount_codes').select(SELECT_COLUMNS).order('created_at', { ascending: false }),
    supabase.from('admin_notifications').select('id', { count: 'exact', head: true }).eq('is_read', false),
  ]);

  const codes: DiscountCodeRecord[] = (codesResult.data ?? [])
    .filter((row) => isDiscountType(row.discount_type))
    .map((row) => ({
      id: String(row.id),
      code: String(row.code ?? ''),
      discount_type: row.discount_type as DiscountCodeRecord['discount_type'],
      discount_value: Number(row.discount_value ?? 0),
      min_order_subtotal: row.min_order_subtotal == null ? null : Number(row.min_order_subtotal),
      expires_at: row.expires_at == null ? null : String(row.expires_at),
      max_redemptions: row.max_redemptions == null ? null : Number(row.max_redemptions),
      times_used: Number(row.times_used ?? 0),
      active: Boolean(row.active),
      notes: row.notes == null ? null : String(row.notes),
      created_at: String(row.created_at ?? ''),
      updated_at: String(row.updated_at ?? ''),
    }));

  // The table is created by a manual migration, so a missing table is the
  // expected state before it is run — say so plainly rather than showing a raw
  // Postgres error.
  const loadError = codesResult.error
    ? /discount_codes/i.test(codesResult.error.message)
      ? 'The discount_codes table does not exist yet. Run supabase/discount-codes-2026-08.sql in Supabase, then reload this page.'
      : `Could not load discount codes: ${codesResult.error.message}`
    : null;

  return (
    <div style={{ minHeight: '100svh', background: 'var(--color-background, #fafaf8)' }}>
      <AdminHeader
        adminBasePath={adminBasePath}
        active="discount-codes"
        unreadMessagesCount={unreadMessagesCount ?? 0}
        userEmail={user.email}
      />

      <main className="px-4 md:px-8 py-8">
        <div className="ultrawide-page-medium max-w-[1200px] mx-auto">
          <div className="mb-8">
            <p
              className="text-[0.65rem] font-bold uppercase tracking-[0.35em] mb-3"
              style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}
            >
              Promotions
            </p>
            <h1
              className="text-3xl md:text-4xl font-bold"
              style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}
            >
              Discount Codes
            </h1>
            <p className="mt-3 max-w-[62ch] text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
              Codes a shopper can enter at checkout for a percentage or dollar amount off the
              merchandise subtotal. Shipping and tax are calculated after the discount.
            </p>
          </div>

          <DiscountCodesManager initialCodes={codes} loadError={loadError} />
        </div>
      </main>
    </div>
  );
}
