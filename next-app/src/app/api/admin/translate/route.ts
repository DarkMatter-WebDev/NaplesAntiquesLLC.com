import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { translateProductCopyToSpanish } from '@/lib/ai-translate';
import { checkRateLimit } from '@/lib/rate-limit';

const MAX_TITLE_LENGTH = 400;
const MAX_DESCRIPTION_LENGTH = 8000;
const HOURLY_LIMIT = Math.max(1, Number(process.env.TRANSLATE_RATE_LIMIT_HOURLY) || 30);

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();
  if (!profile?.is_admin) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  if (!(await checkRateLimit(`admin-translate:${user.id}`, HOURLY_LIMIT, 3600))) {
    console.warn('[admin/translate] rate_limited', { userId: user.id });
    return NextResponse.json({ error: 'Spanish translation limit reached. Please try again later.' }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const title = (typeof body?.title === 'string' ? body.title : '').slice(0, MAX_TITLE_LENGTH);
  const description = (typeof body?.description === 'string' ? body.description : '').slice(0, MAX_DESCRIPTION_LENGTH);
  const notes = (typeof body?.notes === 'string' ? body.notes : '').slice(0, MAX_DESCRIPTION_LENGTH);

  if (!title.trim() && !description.trim() && !notes.trim()) {
    return NextResponse.json({ title_es: null, description_es: null, notes_es: null });
  }

  try {
    const result = await translateProductCopyToSpanish({ title, description, notes });
    return NextResponse.json(result);
  } catch (error) {
    console.error('[admin/translate] failed', {
      userId: user.id,
      message: error instanceof Error ? error.message : 'Unknown translation error',
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Translation failed.' },
      { status: 500 },
    );
  }
}
