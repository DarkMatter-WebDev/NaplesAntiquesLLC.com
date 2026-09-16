import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { statusCallbackUrl, twilioConfig } from '@/lib/text-alerts/config';
import { formBodyToParams, isValidTwilioSignature } from '@/lib/text-alerts/signature';

/**
 * Delivery status for every message we send (passed as StatusCallback on
 * each send, so nothing to configure in the console). Updates the deal send
 * row or the system-message row that carries the SID. Signed by Twilio.
 */
export const runtime = 'nodejs';
export const maxDuration = 15;

const KNOWN = new Set(['queued', 'sending', 'sent', 'delivered', 'undelivered', 'failed', 'read', 'accepted', 'scheduled', 'canceled']);

export async function POST(req: Request) {
  const config = twilioConfig();
  if (!config) return NextResponse.json({ error: 'Twilio is not configured.' }, { status: 503 });

  const params = formBodyToParams(await req.text());
  if (!isValidTwilioSignature(config.authToken, statusCallbackUrl(), params, req.headers.get('x-twilio-signature'))) {
    return NextResponse.json({ error: 'Bad signature.' }, { status: 403 });
  }

  const sid = params.MessageSid?.trim();
  const status = params.MessageStatus?.trim().toLowerCase();
  if (!sid || !status || !KNOWN.has(status)) return new NextResponse(null, { status: 204 });
  const errorCode = params.ErrorCode?.trim() || null;
  const now = new Date().toISOString();

  const service = createServiceClient();
  const { data: sendRows } = await service
    .from('text_deal_sends')
    .update({ status, error_code: errorCode, updated_at: now })
    .eq('message_sid', sid)
    .select('id');
  if (!sendRows || sendRows.length === 0) {
    await service
      .from('text_system_messages')
      .update({ status, error: errorCode ? `Twilio error ${errorCode}` : null })
      .eq('message_sid', sid);
  }
  return new NextResponse(null, { status: 204 });
}
