import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { drainPublishQueue, drainQueue, enqueueAllEligible, enqueueProducts } from '@/lib/ebay/sync';

// Phase 2 bulk queue + drain. Same envelope as the Etsy sync-batch route:
// enqueue / enqueue-all-eligible / drain, backed by
// claim_next_pending_ebay_listing() (supabase/ebay-sync.sql).

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  let body: { action?: string; productIds?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: { code: 'invalid_json', message: 'Invalid JSON body.' } }, { status: 400 });
  }

  if (body.action === 'enqueue') {
    if (!Array.isArray(body.productIds) || body.productIds.length === 0) {
      return NextResponse.json({ error: { code: 'missing_product_ids', message: 'productIds is required.' } }, { status: 400 });
    }
    const queued = await enqueueProducts(body.productIds);
    return NextResponse.json({ queued });
  }
  if (body.action === 'enqueue-all-eligible') {
    const queued = await enqueueAllEligible();
    return NextResponse.json({ queued });
  }
  if (body.action === 'drain') {
    const result = await drainQueue();
    return NextResponse.json(result);
  }
  if (body.action === 'drain-publish') {
    // Publishes prepared 'review' listings live — deliberate go-live action.
    const result = await drainPublishQueue();
    return NextResponse.json(result);
  }

  return NextResponse.json(
    { error: { code: 'invalid_action', message: 'action must be "enqueue", "enqueue-all-eligible", "drain", or "drain-publish".' } },
    { status: 400 },
  );
}
