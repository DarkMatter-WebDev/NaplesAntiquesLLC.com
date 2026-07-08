import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { upsertListing } from '@/lib/etsy/store';

export const runtime = 'nodejs';

/**
 * Save (or clear) a manual per-product Etsy category override
 * (etsy_listings.taxonomy_override_id/_path) — see the category picker in
 * the product drawer's Etsy section and mapping.ts's resolveEffectiveTaxonomy.
 * Passing a null taxonomyId clears the override, reverting to the automatic
 * ETSY_TAXONOMY_MAP guess.
 */
export async function PUT(req: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json().catch(() => null);
  const productId = typeof body?.productId === 'string' ? body.productId : null;
  if (!productId) return NextResponse.json({ error: 'Missing productId.' }, { status: 400 });

  const taxonomyId = body?.taxonomyId == null ? null : Number(body.taxonomyId);
  if (taxonomyId != null && (!Number.isFinite(taxonomyId) || taxonomyId <= 0)) {
    return NextResponse.json({ error: 'Invalid taxonomyId.' }, { status: 400 });
  }
  const taxonomyPath = taxonomyId != null && typeof body?.taxonomyPath === 'string' ? body.taxonomyPath : null;

  const service = createServiceClient();
  try {
    await upsertListing(service, productId, {
      taxonomy_override_id: taxonomyId,
      taxonomy_override_path: taxonomyId != null ? taxonomyPath : null,
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not save the category.' }, { status: 500 });
  }
}
