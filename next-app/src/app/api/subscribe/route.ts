import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

function normalizeEmail(value: unknown) {
  return String(value ?? '').trim().toLowerCase();
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });

  const email = normalizeEmail(body.email);
  const fullName = String(body.fullName ?? '').trim();
  const locale = String(body.locale ?? 'en') === 'es' ? 'es' : 'en';

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
  }

  const supabase = await createClient();
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
