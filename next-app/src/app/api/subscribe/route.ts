import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { sendConfirmation } from '@/lib/text-alerts/confirmations';
import {
  channelWantsEmail,
  channelWantsText,
  normalizeUsPhone,
  parseSubscribeChannel,
  SMS_CONSENT_VERSION,
  smsConsentText,
} from '@/lib/subscriber-phone';

function normalizeEmail(value: unknown) {
  return String(value ?? '').trim().toLowerCase();
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/**
 * Homepage "Join the List" sign-up: email, text alerts, or both.
 *
 * The channel decides what is required — an email for `email` / `both`, a US
 * mobile number AND the ticked consent box for `text` / `both`. The consent
 * statement stored on the row is this server's copy of the wording
 * (`lib/subscriber-phone.ts`), never text the browser sends, so the record of
 * consent cannot be forged by a hand-made request.
 *
 * Nothing here sends a text. A phone row is saved as `pending`; the
 * confirmation text ("reply YES") belongs to the texting batch.
 */
export async function POST(req: Request) {
  const ip = getClientIp(req);
  if (!(await checkRateLimit(`subscribe:${ip}`, 10, 3600))) {
    return NextResponse.json({ error: 'Too many requests. Please try again in a bit.' }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });

  const locale = String(body.locale ?? 'en') === 'es' ? 'es' : 'en';
  const isEs = locale === 'es';
  const channel = parseSubscribeChannel(body.channel);
  const email = normalizeEmail(body.email);
  const fullName = String(body.fullName ?? '').trim().slice(0, 200);
  const phone = normalizeUsPhone(body.phone);
  const smsConsent = body.smsConsent === true;

  if (channelWantsEmail(channel) && !isValidEmail(email)) {
    return NextResponse.json(
      { error: isEs ? 'Ingrese un correo electrónico válido.' : 'Please enter a valid email address.' },
      { status: 400 },
    );
  }
  if (channelWantsText(channel)) {
    if (!phone) {
      return NextResponse.json(
        { error: isEs ? 'Ingrese un número de celular de EE. UU. válido.' : 'Please enter a valid US mobile number.' },
        { status: 400 },
      );
    }
    if (!smsConsent) {
      return NextResponse.json(
        { error: isEs ? 'Marque la casilla para recibir mensajes de texto.' : 'Please tick the box to receive text alerts.' },
        { status: 400 },
      );
    }
  }

  // The underlying SECURITY DEFINER RPC is service-role-only so callers cannot
  // bypass this route's validation and IP limit through PostgREST directly.
  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc('subscribe_homepage_v2', {
    subscriber_email: channelWantsEmail(channel) ? email : null,
    subscriber_name: fullName || null,
    subscriber_locale: locale,
    subscriber_phone: channelWantsText(channel) ? phone : null,
    subscriber_sms_consent: channelWantsText(channel) && smsConsent,
    subscriber_sms_consent_text: channelWantsText(channel) ? smsConsentText(locale) : null,
    subscriber_sms_consent_version: channelWantsText(channel) ? SMS_CONSENT_VERSION : null,
    subscriber_source: 'homepage_hero',
  });

  if (error) {
    console.error('Homepage subscriber insert error:', error);
    return NextResponse.json(
      { error: isEs ? 'No se pudo guardar la suscripción.' : 'Could not save subscription.' },
      { status: 500 },
    );
  }

  const row = Array.isArray(data) ? data[0] : data;
  const smsStatus = channelWantsText(channel) ? (row?.sms_status ?? 'pending') : null;

  // The "reply YES" text, right away. Awaited (not after(): that is
  // best-effort on Netlify) but never allowed to fail the sign-up — the
  // 15-minute sweep sends anything this misses, and nothing goes out while
  // Twilio is not configured.
  if (smsStatus === 'pending' && phone && row?.phone_saved !== false) {
    try {
      await sendConfirmation(phone);
    } catch (err) {
      console.error('[subscribe] confirmation text failed', err instanceof Error ? err.message : err);
    }
  }

  return NextResponse.json({
    success: true,
    channel,
    // What the window tells the visitor about their number: saved and waiting
    // for the YES reply, or already confirmed from an earlier sign-up.
    smsStatus,
  });
}
