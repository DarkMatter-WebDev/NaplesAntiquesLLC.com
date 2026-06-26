import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Map each admin action to its SECURITY DEFINER RPC. All three do their own
// admin check internally and run with owner privileges, so they don't depend on
// table-level grants. Called with the authenticated user's session so auth.uid()
// resolves to the signed-in admin.
const ACTION_RPC: Record<string, string> = {
  trash: 'trash_admin_notifications', // move to Recycle Bin (soft delete)
  restore: 'restore_admin_notifications', // restore from bin to inbox
  purge: 'delete_admin_notifications', // permanent "Delete Forever"
};

export async function POST(req: Request) {
  // Verify caller is an authenticated admin.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();
  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const action = typeof body?.action === 'string' ? body.action : '';
  const ids: unknown = body?.ids;

  const rpc = ACTION_RPC[action];
  if (!rpc) {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }
  if (!Array.isArray(ids) || ids.length === 0 || !ids.every((id) => typeof id === 'string')) {
    return NextResponse.json({ error: 'ids must be a non-empty array of strings' }, { status: 400 });
  }

  const { data, error } = await supabase.rpc(rpc, { p_ids: ids as string[] });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, affected: data ?? null });
}
