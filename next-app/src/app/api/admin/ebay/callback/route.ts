import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { completeOauthExchange } from '@/lib/ebay/auth';
import { consumeOauthState, insertSyncLog } from '@/lib/ebay/store';

// Step 3 of OAuth: exchange the single-use authorization code (~299s TTL,
// never persisted) for tokens. See ebay-sync-plan/04-oauth-and-secrets.md.

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function GET(req: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const redirectTo = new URL('/admin/settings', url.origin);

  if (!code || !state) {
    redirectTo.searchParams.set('ebay', 'error');
    return NextResponse.redirect(redirectTo);
  }

  const service = createServiceClient();
  const stateRow = await consumeOauthState(service, state);
  if (!stateRow) {
    redirectTo.searchParams.set('ebay', 'error');
    return NextResponse.redirect(redirectTo);
  }

  try {
    await completeOauthExchange(service, { code });
    await insertSyncLog(service, { action: 'connect', outcome: 'ok', message: 'eBay connected.' });
    redirectTo.searchParams.set('ebay', 'connected');
  } catch (err) {
    await insertSyncLog(service, {
      action: 'connect',
      outcome: 'error',
      message: err instanceof Error ? err.message : 'Connect failed.',
    });
    redirectTo.searchParams.set('ebay', 'error');
  }

  return NextResponse.redirect(redirectTo);
}
