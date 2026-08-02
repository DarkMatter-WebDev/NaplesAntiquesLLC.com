import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { isValidEmail, normalizeEmail } from '@/lib/marketing';

export async function POST(req: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json().catch(() => null);
  const email = normalizeEmail(body?.email);
  const fullName = typeof body?.fullName === 'string' ? body.fullName.trim() : '';

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: 'A valid subscriber email is required.' }, { status: 400 });
  }

  try {
    const supabase = createServiceClient();
    const { error: upsertError } = await supabase
      .from('homepage_subscribers')
      .upsert({
        email,
        full_name: fullName || null,
        source: 'admin_manual',
        locale: 'en',
        subscribed: true,
        subscribed_at: new Date().toISOString(),
        consent_at: new Date().toISOString(),
        unsubscribed_at: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'email' });

    if (upsertError) throw upsertError;
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not add subscriber.' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json().catch(() => null);
  const originalEmail = normalizeEmail(body?.originalEmail);
  const email = normalizeEmail(body?.email);
  const fullName = typeof body?.fullName === 'string' ? body.fullName.trim() : '';

  if (!isValidEmail(originalEmail) || !isValidEmail(email)) {
    return NextResponse.json({ error: 'A valid original and new email are required.' }, { status: 400 });
  }

  try {
    const supabase = createServiceClient();
    const { error: updateError } = await supabase
      .from('homepage_subscribers')
      .update({
        email,
        full_name: fullName || null,
        updated_at: new Date().toISOString(),
      })
      .eq('email', originalEmail);

    if (updateError) throw updateError;
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not update subscriber.' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json().catch(() => null);
  const email = normalizeEmail(body?.email);

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: 'A valid subscriber email is required.' }, { status: 400 });
  }

  try {
    const supabase = createServiceClient();
    const { error: deleteError } = await supabase
      .from('homepage_subscribers')
      .delete()
      .eq('email', email);

    if (deleteError) throw deleteError;
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not delete subscriber.' },
      { status: 500 }
    );
  }
}
