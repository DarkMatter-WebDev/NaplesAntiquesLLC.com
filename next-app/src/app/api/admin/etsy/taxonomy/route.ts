import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { EtsyApiError, fetchTaxonomyLeaves } from '@/lib/etsy/client';

export const runtime = 'nodejs';

/**
 * Full Etsy seller-taxonomy leaf list, for the admin category-override
 * picker (etsy-sync-plan's automatic ETSY_TAXONOMY_MAP guess has no exact
 * fit for several product types — see mapping.ts comments). No OAuth
 * needed, so this works even before the shop is connected.
 */
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const leaves = await fetchTaxonomyLeaves();
    return NextResponse.json({ leaves });
  } catch (err) {
    const message = err instanceof EtsyApiError ? err.operatorMessage : err instanceof Error ? err.message : 'Could not load Etsy categories.';
    return NextResponse.json({ error: message }, { status: err instanceof EtsyApiError ? err.status : 500 });
  }
}
