import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendOrderInvoiceEmail } from '@/lib/order-invoice-mailer';

interface Props {
  params: Promise<{ id: string }>;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(req: Request, { params }: Props) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const recipient = String(body?.recipient ?? '').trim();
  const rawItemDiscounts = body?.itemDiscounts && typeof body.itemDiscounts === 'object'
    ? body.itemDiscounts as Record<string, unknown>
    : {};
  const itemDiscounts = Object.fromEntries(
    Object.entries(rawItemDiscounts).map(([itemId, value]) => [itemId, Number(value) || 0]),
  );

  if (!recipient || !isValidEmail(recipient)) {
    return NextResponse.json({ error: 'A valid recipient email is required.' }, { status: 400 });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return NextResponse.json({ error: 'Email sending is not configured. Missing RESEND_API_KEY.' }, { status: 500 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if (!profile?.is_admin) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }

  const result = await sendOrderInvoiceEmail({
    supabase,
    resendKey,
    orderId: id,
    recipient,
    itemDiscounts,
    sentBy: { id: user.id, email: user.email ?? null },
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ success: true, email: result.email });
}
