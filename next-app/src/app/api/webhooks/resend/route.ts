import { createHmac, timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { normalizeEmail, stableEventId, suppressMarketingEmail } from '@/lib/marketing';

export const runtime = 'nodejs';

function verifySvixSignature(body: string, headers: Headers) {
  const secret = process.env.PROVIDER_WEBHOOK_SECRET || process.env.RESEND_WEBHOOK_SECRET;
  // Fail CLOSED: with no configured secret we cannot verify the sender, so reject
  // rather than trust an unauthenticated POST. (An unverified webhook here can flip
  // arbitrary addresses to unsubscribed/suppressed via suppressMarketingEmail.)
  if (!secret) return false;

  const id = headers.get('svix-id');
  const timestamp = headers.get('svix-timestamp');
  const signatureHeader = headers.get('svix-signature');
  if (!id || !timestamp || !signatureHeader) return false;

  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const signedPayload = `${id}.${timestamp}.${body}`;
  const expected = createHmac('sha256', key).update(signedPayload).digest('base64');

  return signatureHeader
    .split(' ')
    .some((part) => {
      const signature = part.replace(/^v\d+,/, '').trim();
      const expectedBuffer = Buffer.from(expected);
      const actualBuffer = Buffer.from(signature);
      return expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer);
    });
}

function mapEventType(value: unknown) {
  const type = String(value ?? '').toLowerCase();
  if (type.includes('delivered')) return 'delivered';
  if (type.includes('opened') || type.includes('open')) return 'opened';
  if (type.includes('clicked') || type.includes('click')) return 'clicked';
  if (type.includes('bounced') || type.includes('bounce')) return 'bounced';
  if (type.includes('complained') || type.includes('complaint')) return 'complained';
  return null;
}

function emailFromPayload(data: Record<string, unknown>) {
  const to = data.to;
  if (Array.isArray(to)) return normalizeEmail(to[0]);
  return normalizeEmail(data.email || data.recipient || to);
}

function campaignIdFromPayload(data: Record<string, unknown>) {
  const tags = data.tags;
  if (Array.isArray(tags)) {
    const tag = tags.find((item) => item && typeof item === 'object' && 'name' in item && (item as { name?: string }).name === 'campaign_id');
    if (tag && typeof tag === 'object' && 'value' in tag) return String((tag as { value?: unknown }).value ?? '');
  }
  if (tags && typeof tags === 'object' && 'campaign_id' in tags) {
    return String((tags as { campaign_id?: unknown }).campaign_id ?? '');
  }
  return String(data.campaign_id ?? data.campaignId ?? '');
}

export async function POST(req: Request) {
  const body = await req.text();
  if (!verifySvixSignature(body, req.headers)) {
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 401 });
  }

  const payload = JSON.parse(body || '{}') as { type?: string; data?: Record<string, unknown> };
  const data = payload.data ?? {};
  const eventType = mapEventType(payload.type ?? data.type);
  const email = emailFromPayload(data);
  const campaignId = campaignIdFromPayload(data);

  if (!eventType || !email || !campaignId || campaignId === 'test') {
    return NextResponse.json({ success: true, ignored: true });
  }

  const url = typeof data.url === 'string' ? data.url : null;
  const supabase = createServiceClient();
  await supabase.from('email_campaign_events').upsert({
    id: stableEventId(campaignId, email, eventType, url),
    campaign_id: campaignId,
    email,
    type: eventType,
    url,
  }, { onConflict: 'campaign_id,email,type' });

  if (eventType === 'bounced' || eventType === 'complained') {
    await suppressMarketingEmail(email);
  }

  return NextResponse.json({ success: true });
}
