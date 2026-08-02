import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { disconnect, insertSyncLog } from '@/lib/facebook/store';

export const runtime = 'nodejs';

/**
 * Forget the stored token and Page. Published posts and their history are
 * intentionally left intact: disconnecting is an app-side action and must never
 * touch anything already live on Facebook.
 */
export async function POST() {
  const { error } = await requireAdmin();
  if (error) return error;

  const service = createServiceClient();
  await disconnect(service);
  await insertSyncLog(service, {
    action: 'disconnect',
    outcome: 'ok',
    message: 'Facebook connection cleared. Existing posts were left untouched.',
  });

  return NextResponse.json({ connected: false });
}
