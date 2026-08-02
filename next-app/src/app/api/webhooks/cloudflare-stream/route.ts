import { NextResponse } from 'next/server';
import { deleteCloudflareVideo, ensureCloudflareDownload, normalizeCloudflareVideo, verifyCloudflareWebhook, type CloudflareStreamVideo } from '@/lib/cloudflare-stream';
import { updateVideoRowsForUid } from '@/lib/product-video-store';
import { createServiceClient } from '@/lib/supabase/service';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const ip = getClientIp(request);
  if (!(await checkRateLimit(`cloudflare-stream-webhook:${ip}`, 300, 60))) {
    return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
  }

  const rawBody = await request.text();
  const verification = verifyCloudflareWebhook({ rawBody, signatureHeader: request.headers.get('webhook-signature') });
  if (!verification.valid || !verification.eventHash) return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 401 });
  let payload: CloudflareStreamVideo;
  try { payload = JSON.parse(rawBody) as CloudflareStreamVideo; }
  catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }); }
  try {
    const service = createServiceClient();
    const normalized = normalizeCloudflareVideo(payload);
    const { error: eventError } = await service.from('cloudflare_stream_webhook_events').insert({
      event_hash: verification.eventHash,
      cloudflare_uid: payload.uid,
      status: normalized.status,
    });
    if (eventError?.code === '23505') return NextResponse.json({ received: true, duplicate: true });
    if (eventError) throw eventError;
    let download: { status: string | null; url: string | null } | undefined;
    if (normalized.status === 'ready') download = await ensureCloudflareDownload(payload.uid).catch(() => ({ status: null, url: null }));
    if (normalized.status === 'failed' && normalized.error_code === 'DURATION_OUT_OF_RANGE') await deleteCloudflareVideo(payload.uid).catch(() => undefined);
    await updateVideoRowsForUid(service, normalized, download);
    return NextResponse.json({ received: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Webhook processing failed.' }, { status: 500 });
  }
}
