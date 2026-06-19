import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { buildMarketingAudience, type AudienceScope } from '@/lib/marketing';

function normalizeScope(value: unknown): AudienceScope {
  return value === 'subscribers' || value === 'accounts' || value === 'all' ? value : 'all';
}

export async function POST(req: Request) {
  const { supabase, error } = await requireAdmin();
  if (error) return error;

  const body = await req.json().catch(() => null);
  const scope = normalizeScope(body?.scope);

  try {
    const recipients = await buildMarketingAudience(scope, supabase);
    return NextResponse.json({ count: recipients.length, scope });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not build marketing audience.' },
      { status: 500 }
    );
  }
}
