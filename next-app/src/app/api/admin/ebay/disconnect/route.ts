import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { disconnectEbay } from '@/lib/ebay/auth';
import { insertSyncLog } from '@/lib/ebay/store';

// No eBay OAuth revoke endpoint exists — clears the local row only. Listings
// already published on eBay are left untouched (confirm dialog explains this
// in the UI, matching the Etsy panel's disconnect flow).

export const runtime = 'nodejs';

export async function POST() {
  const { error } = await requireAdmin();
  if (error) return error;

  const service = createServiceClient();
  await disconnectEbay(service);
  await insertSyncLog(service, { action: 'disconnect', outcome: 'ok', message: 'eBay disconnected.' });
  return NextResponse.json({ success: true });
}
