import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { ebayConfigured } from '@/lib/ebay/client';
import { buildAuthorizeUrl, generateOauthState } from '@/lib/ebay/auth';
import { createOauthState } from '@/lib/ebay/store';

// Step 1 of OAuth (ebay-sync-plan/04-oauth-and-secrets.md): generate a CSRF
// state, persist it, and 302 to eBay's consent screen. No PKCE (eBay
// requires a confidential client) — the callback exchanges the code
// server-side using Basic auth.

export const runtime = 'nodejs';

export async function GET() {
  const { error, user } = await requireAdmin();
  if (error) return error;
  if (!ebayConfigured()) {
    return NextResponse.json({ error: { code: 'not_configured', message: 'eBay credentials are not configured yet.' } }, { status: 503 });
  }

  const service = createServiceClient();
  const state = generateOauthState();
  await createOauthState(service, { state, adminUserId: user!.id });

  return NextResponse.redirect(buildAuthorizeUrl({ state }));
}
