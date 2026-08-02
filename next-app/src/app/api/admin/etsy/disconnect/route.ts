import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { disconnectEtsy } from '@/lib/etsy/auth';
import { insertSyncLog } from '@/lib/etsy/store';

export const runtime = 'nodejs';

// Etsy has no token-revocation endpoint (etsy-sync-plan/04-oauth-and-secrets.md)
// — this only clears our stored grant. Listings already on Etsy are untouched.
export async function POST() {
  const { error } = await requireAdmin();
  if (error) return error;

  const service = createServiceClient();
  try {
    await disconnectEtsy(service);
    await insertSyncLog(service, { action: 'disconnect', outcome: 'ok' });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not disconnect Etsy.' }, { status: 500 });
  }
}
