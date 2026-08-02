import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { getListingsMap } from '@/lib/ebay/store';

// Bulk product_id -> listing map (local DB read, no eBay calls). Powers the
// per-row eBay status chip in Product Admin — one fetch on mount, never one
// call per row (the exact staleness fix the Etsy chips needed).

export const runtime = 'nodejs';

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const service = createServiceClient();
  const listings = await getListingsMap(service);
  return NextResponse.json({ listings });
}
