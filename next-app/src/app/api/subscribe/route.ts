import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

function normalizeEmail(value: unknown) {
  return String(value ?? '').trim().toLowerCase();
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(req: Request) {
  const ip = getClientIp(req);
  if (!(await checkRateLimit(`subscribe:${ip}`, 10, 3600))) {
    return NextResponse.json({ error: 'Too many requests. Please try again in a bit.' }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });

  const email = normalizeEmail(body.email);
  const fullName = String(body.fullName ?? '').trim().slice(0, 200);
  const locale = String(body.locale ?? 'en') === 'es' ? 'es' : 'en';

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
  }

  // The underlying SECURITY DEFINER RPC is service-role-only so callers cannot
  // bypass this route's validation and IP limit through PostgREST directly.
  const supabase = createServiceClient();
  const { error } = await supabase.rpc('subscribe_homepage', {
    subscriber_email: email,
    subscriber_name: fullName || null,
    subscriber_locale: locale,
  });

  if (error) {
    console.error('Homepage subscriber insert error:', error);
    return NextResponse.json({ error: 'Could not save subscription.' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
