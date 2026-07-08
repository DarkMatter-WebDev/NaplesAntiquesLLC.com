import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { getListingsMap } from '@/lib/etsy/store';

export const runtime = 'nodejs';

/**
 * Bulk product_id -> etsy_listings row map, powering the Product Admin table's
 * per-row Etsy status chip (etsy-sync-plan/07-admin-ux.md). Not itemized in
 * etsy-sync-plan/09-api-routes.md's route table (that doc's list isn't framed
 * as exhaustive); added because the admin table needs it to avoid one Etsy
 * status call per product row. Returns an empty map (never errors) before the
 * migration has run.
 */
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const service = createServiceClient();
  const listings = await getListingsMap(service);
  return NextResponse.json({ listings });
}
