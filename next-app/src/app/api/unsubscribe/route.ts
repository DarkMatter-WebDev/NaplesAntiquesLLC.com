import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { isValidEmail, normalizeEmail, suppressMarketingEmail } from '@/lib/marketing';

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });

  const email = normalizeEmail(body.email);
  const token = String(body.token ?? '').trim();
  if (!isValidEmail(email) && !token) {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
  }

  try {
    const supabase = createServiceClient();
    if (token) {
      const { data, error } = await supabase
        .from('homepage_subscribers')
        .update({ subscribed: false, unsubscribed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('unsubscribe_token', token)
        .select('email')
        .maybeSingle();

      if (error) throw error;
      await suppressMarketingEmail(data?.email ?? email);
    } else {
      await suppressMarketingEmail(email);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Marketing unsubscribe error:', err);
    return NextResponse.json({ error: 'Could not update subscription.' }, { status: 500 });
  }
}
