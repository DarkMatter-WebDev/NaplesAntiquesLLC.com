import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { runSyncStep, type SyncMode } from '@/lib/ebay/sync';

export const runtime = 'nodejs';
export const maxDuration = 60;

const VALID_MODES: SyncMode[] = ['publish', 'update', 'price-only', 'publish-live'];

export async function POST(req: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  let body: { productId?: string; mode?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: { code: 'invalid_json', message: 'Invalid JSON body.' } }, { status: 400 });
  }
  if (!body.productId) {
    return NextResponse.json({ error: { code: 'missing_product_id', message: 'productId is required.' } }, { status: 400 });
  }
  const mode = (body.mode ?? 'publish') as SyncMode;
  if (!VALID_MODES.includes(mode)) {
    return NextResponse.json({ error: { code: 'invalid_mode', message: `mode must be one of ${VALID_MODES.join(', ')}.` } }, { status: 400 });
  }

  const result = await runSyncStep(body.productId, mode);
  return NextResponse.json(result);
}
