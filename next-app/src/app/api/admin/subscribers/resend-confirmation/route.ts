import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { normalizeUsPhone } from '@/lib/subscriber-phone';
import { sendConfirmation } from '@/lib/text-alerts/confirmations';

/** POST { phone } → the "reply YES" text again, for a row still pending. */
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const { error } = await requireAdmin();
  if (error) return error;
  const body = await req.json().catch(() => null);
  const phone = normalizeUsPhone(body?.phone);
  if (!phone) return NextResponse.json({ error: 'A valid US mobile number is required.' }, { status: 400 });
  const result = await sendConfirmation(phone, { force: true });
  if (result.outcome === 'sent') return NextResponse.json({ success: true, sid: result.sid });
  if (result.outcome === 'not_pending') return NextResponse.json({ error: 'That number is not pending.' }, { status: 409 });
  if (result.outcome === 'not_configured') return NextResponse.json({ error: 'Twilio is not configured yet.' }, { status: 503 });
  return NextResponse.json({ error: result.error }, { status: 502 });
}
