import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { parseAiSpeechText } from '@/lib/ai-speech';

const HOURLY_LIMIT = 60;
const REQUEST_TIMEOUT_MS = 30_000;
const usageByUser = new Map<string, number[]>();

function checkRateLimit(userId: string) {
  const now = Date.now();
  const hourAgo = now - 60 * 60 * 1000;
  const recent = (usageByUser.get(userId) ?? []).filter((timestamp) => timestamp > hourAgo);
  if (recent.length >= HOURLY_LIMIT) {
    usageByUser.set(userId, recent);
    return false;
  }
  recent.push(now);
  usageByUser.set(userId, recent);
  return true;
}

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

  const body = await req.json().catch(() => null);
  const speechText = parseAiSpeechText(body?.text);
  if (!speechText.ok) return NextResponse.json({ error: speechText.error }, { status: 400 });
  if (!checkRateLimit(user.id)) {
    return NextResponse.json({ error: 'Read-aloud limit reached. Please try again later.' }, { status: 429 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'AI voice is not configured.' }, { status: 503 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_TTS_MODEL?.trim() || 'gpt-4o-mini-tts',
        voice: process.env.OPENAI_TTS_VOICE?.trim() || 'marin',
        input: speechText.text,
        instructions: 'Speak clearly in a calm, warm, professional tone for an estate jewelry catalog administrator.',
        response_format: 'mp3',
      }),
      signal: controller.signal,
    });

    if (!response.ok || !response.body) {
      const data = await response.json().catch(() => null);
      const message = data?.error?.message ?? `AI voice request failed with status ${response.status}.`;
      console.error('[ai-speech] provider_failed', { userId: user.id, status: response.status, message });
      return NextResponse.json({ error: 'AI voice could not be generated.' }, { status: 502 });
    }

    return new Response(response.body, {
      status: 200,
      headers: {
        'content-type': response.headers.get('content-type') || 'audio/mpeg',
        'cache-control': 'private, no-store',
        'x-content-type-options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('[ai-speech] failed', {
      userId: user.id,
      message: error instanceof Error ? error.message : 'Unknown speech error',
    });
    return NextResponse.json({ error: 'AI voice could not be generated.' }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}
