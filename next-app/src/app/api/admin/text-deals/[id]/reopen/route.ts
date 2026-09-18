import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { reopenDealAsDraft } from '@/lib/text-alerts/deals';
import { PRODUCT_IMAGES_BUCKET } from '@/lib/product-image-storage';

/** POST: clone a sold/sent deal into a new draft (same photo, price, line; fresh message) for editing and resending. */
export const runtime = 'nodejs';

type Context = { params: Promise<{ id: string }> };

export async function POST(_req: Request, context: Context) {
  const { error } = await requireAdmin();
  if (error) return error;
  const { id } = await context.params;
  try {
    const deal = await reopenDealAsDraft(id);
    const service = createServiceClient();
    const photo_url = deal.photo_path ? service.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(deal.photo_path).data.publicUrl : null;
    return NextResponse.json({ deal: { ...deal, photo_url } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not reopen the deal.';
    return NextResponse.json({ error: message }, { status: /not found/i.test(message) ? 404 : 500 });
  }
}
