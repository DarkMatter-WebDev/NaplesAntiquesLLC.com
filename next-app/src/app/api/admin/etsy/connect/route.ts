import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { buildAuthorizeUrl, generateOauthState, generatePkcePair } from '@/lib/etsy/auth';
import { etsyConfigured } from '@/lib/etsy/client';
import { createOauthState } from '@/lib/etsy/store';

export const runtime = 'nodejs';

// Step 1 of OAuth (etsy-sync-plan/04-oauth-and-secrets.md): generate a CSRF
// state + PKCE pair, persist the handshake row, redirect to Etsy's consent
// screen.
export async function GET() {
  const { user, error } = await requireAdmin();
  if (error) return error;
  if (!etsyConfigured()) {
    return NextResponse.json({ error: 'Etsy is not configured (ETSY_API_KEY is unset in this environment).' }, { status: 503 });
  }
  if (!user) return NextResponse.json({ error: 'Admin session required.' }, { status: 401 });

  const service = createServiceClient();
  const state = generateOauthState();
  const { codeVerifier, codeChallenge } = generatePkcePair();

  try {
    await createOauthState(service, { state, codeVerifier, adminUserId: user.id });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not start the Etsy connection.' }, { status: 500 });
  }

  return NextResponse.redirect(buildAuthorizeUrl({ state, codeChallenge }));
}
