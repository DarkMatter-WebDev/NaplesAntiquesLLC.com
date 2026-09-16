import { NextResponse } from 'next/server';
import { inboundWebhookUrl, twilioConfig } from '@/lib/text-alerts/config';
import { formBodyToParams, isValidTwilioSignature } from '@/lib/text-alerts/signature';
import { handleInbound } from '@/lib/text-alerts/inbound';
import { twiml } from '@/lib/text-alerts/messages';

/**
 * "A message comes in" webhook for the toll-free number. Set in the Twilio
 * console (Phone Numbers → the number → Messaging → A message comes in →
 * Webhook, HTTP POST) to `inboundWebhookUrl()` = SITE_URL + this path.
 *
 * Twilio signs the request; an unsigned or mis-signed POST is refused. The
 * response is TwiML, which is how a reply (the YES confirmation, the sold
 * line) goes back without a second API call.
 */
export const runtime = 'nodejs';
export const maxDuration = 30;

function xml(body: string, status = 200) {
  return new NextResponse(body, { status, headers: { 'Content-Type': 'text/xml; charset=utf-8' } });
}

export async function POST(req: Request) {
  const config = twilioConfig();
  if (!config) return NextResponse.json({ error: 'Twilio is not configured.' }, { status: 503 });

  const raw = await req.text();
  const params = formBodyToParams(raw);
  if (!isValidTwilioSignature(config.authToken, inboundWebhookUrl(), params, req.headers.get('x-twilio-signature'))) {
    return NextResponse.json({ error: 'Bad signature.' }, { status: 403 });
  }

  try {
    const result = await handleInbound({
      MessageSid: params.MessageSid,
      From: params.From,
      Body: params.Body,
      NumMedia: params.NumMedia,
    });
    return xml(result.twiml);
  } catch (error) {
    console.error('[text-alerts] inbound failed', error instanceof Error ? error.message : error);
    // Twilio retries a 5xx; an empty 200 keeps a broken row from spamming the number.
    return xml(twiml());
  }
}
