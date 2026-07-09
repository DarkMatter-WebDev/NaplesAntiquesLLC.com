import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

/**
 * Buyers rows are auto-populated by a database trigger on `orders` (see
 * supabase/buyers-2026-07.sql) — there is no manual "add" here, only removal.
 */
export async function DELETE(req: Request) {
  const { supabase, error } = await requireAdmin();
  if (error) return error;

  const body = await req.json().catch(() => null);
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';

  if (!email) {
    return NextResponse.json({ error: 'A buyer email is required.' }, { status: 400 });
  }

  const { error: deleteError } = await supabase
    .from('buyers')
    .delete()
    .eq('email', email);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
