import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { upsertOrderInvoice } from '@/lib/order-invoices';

interface Props {
  params: Promise<{ id: string }>;
}

export async function POST(_req: Request, { params }: Props) {
  const { id } = await params;
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;

  const result = await upsertOrderInvoice(auth.supabase, id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: /not found/i.test(result.error) ? 404 : 500 });
  }

  return NextResponse.json({ success: true, invoice: result.invoice });
}
