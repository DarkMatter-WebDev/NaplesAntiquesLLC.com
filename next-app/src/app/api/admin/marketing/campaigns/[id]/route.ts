import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/service';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(_req: Request, { params }: RouteContext) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: 'Invalid campaign id.' }, { status: 400 });
  }

  const { error: deleteError } = await createServiceClient()
    .from('email_campaigns')
    .delete()
    .eq('id', id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message || 'Could not delete campaign.' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
