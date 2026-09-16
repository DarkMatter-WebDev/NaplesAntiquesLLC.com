import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { buildDealCard, loadDeal } from '@/lib/text-alerts/deals';

/**
 * POST { dealId } → renders (and stores) the picture message, returns its
 * public URL and size. The same picture is what the send uses, so what the
 * owner previews is exactly what goes out.
 */
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (admin.error) return admin.error;
  const body = await req.json().catch(() => null);
  const dealId = typeof body?.dealId === 'string' ? body.dealId : '';
  if (!dealId) return NextResponse.json({ error: 'dealId is required.' }, { status: 400 });

  const service = createServiceClient();
  const deal = await loadDeal(service, dealId);
  if (!deal) return NextResponse.json({ error: 'Deal not found.' }, { status: 404 });
  try {
    const card = await buildDealCard(service, deal);
    return NextResponse.json({ url: card.url, path: card.path, bytes: card.bytes });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not render the picture.' }, { status: 500 });
  }
}
