import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { completeOauthExchange } from '@/lib/etsy/auth';
import { consumeOauthState, insertSyncLog } from '@/lib/etsy/store';

export const runtime = 'nodejs';

// Step 3 of OAuth (etsy-sync-plan/04-oauth-and-secrets.md): Etsy redirects the
// admin's browser back here with ?code&state. Exchange the code for tokens,
// resolve the shop, persist, redirect to the settings panel.
export async function GET(req: Request) {
  const { user, error } = await requireAdmin();
  if (error) return error;

  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const settingsUrl = new URL('/admin/settings', url.origin);

  if (!code || !state || !user) {
    settingsUrl.searchParams.set('etsy', 'error');
    return NextResponse.redirect(settingsUrl);
  }

  const service = createServiceClient();
  // Single-use + admin-bound: reject unknown/expired state rows, and reject a
  // state row created by a different admin session (CSRF hardening per
  // etsy-sync-plan/04-oauth-and-secrets.md).
  const stateRow = await consumeOauthState(service, state);
  if (!stateRow || stateRow.admin_user_id !== user.id) {
    settingsUrl.searchParams.set('etsy', 'error');
    return NextResponse.redirect(settingsUrl);
  }

  try {
    await completeOauthExchange(service, { code, codeVerifier: stateRow.code_verifier });
    await insertSyncLog(service, { action: 'connect', outcome: 'ok' });
    settingsUrl.searchParams.set('etsy', 'connected');
  } catch (err) {
    await insertSyncLog(service, {
      action: 'connect',
      outcome: 'error',
      message: err instanceof Error ? err.message : 'OAuth exchange failed.',
    });
    settingsUrl.searchParams.set('etsy', 'error');
  }
  return NextResponse.redirect(settingsUrl);
}
