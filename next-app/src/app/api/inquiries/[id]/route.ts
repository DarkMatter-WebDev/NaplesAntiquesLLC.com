import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body?.status) return NextResponse.json({ error: 'Missing status' }, { status: 400 });

  const { status } = body as { status: string };
  if (!['new', 'read', 'replied'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  // Admin-only, matching every other admin write. Previously this checked only
  // that *some* user was signed in and relied on RLS to filter the update — which
  // silently returned success even when 0 rows were affected. Gate explicitly.
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { error } = await auth.supabase
    .from('inquiries')
    .update({ status })
    .eq('id', id);

  if (error) return NextResponse.json({ error: 'Could not update inquiry.' }, { status: 500 });

  return NextResponse.json({ success: true });
}
