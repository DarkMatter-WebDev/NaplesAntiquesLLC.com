import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import {
  decideTokenRefresh,
  decryptToken,
  encryptToken,
  refreshLongLivedToken,
} from '@/lib/instagram/auth';
import { InstagramApiError } from '@/lib/instagram/client';
import { insertSyncLog, updateConnection } from '@/lib/instagram/store';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Scheduled Instagram token keep-warm.
 *
 * Long-lived Instagram tokens last 60 days and can only be refreshed while
 * still valid, so a quiet stretch with no admin activity would silently kill
 * the connection. This runs weekly and refreshes once the token is inside its
 * renewal window.
 *
 * No admin browser session exists when a cron calls this, so it is gated by a
 * shared secret header instead of requireAdmin().
 */
export async function POST(req: Request) {
  const secret = process.env.INSTAGRAM_CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'INSTAGRAM_CRON_SECRET is not configured.' }, { status: 503 });
  }
  if (req.headers.get('x-cron-secret') !== secret) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const service = createServiceClient();

  const { data: connection } = await service
    .from('instagram_connection')
    .select('status, access_token_enc, token_expires_at, token_refreshed_at')
    .eq('id', 1)
    .maybeSingle();

  const decision = decideTokenRefresh({
    hasToken: Boolean(connection?.access_token_enc),
    expiresAt: connection?.token_expires_at ? new Date(connection.token_expires_at) : null,
    refreshedAt: connection?.token_refreshed_at ? new Date(connection.token_refreshed_at) : null,
    now: new Date(),
  });

  if (decision.action === 'skip') {
    // Record the no-op run. A weekly job that legitimately does nothing for
    // ~53 of every 60 days used to leave no trace at all, so "ran and correctly
    // skipped" was indistinguishable from "never ran" — which is precisely what
    // made this the wrong probe when the dead Netlify schedules were being
    // diagnosed (2026-08-10). One row a week is free.
    await insertSyncLog(service, {
      action: 'token_refresh',
      outcome: 'ok',
      message: `Token refresh checked; no action needed (${decision.reason}).`,
    });
    return NextResponse.json({ refreshed: false, reason: decision.reason });
  }

  if (decision.action === 'reauth') {
    await updateConnection(service, { status: 'needs_reauth' });
    await insertSyncLog(service, {
      action: 'token_refresh',
      outcome: 'error',
      message: 'The Instagram token expired and must be re-pasted from the Meta App Dashboard.',
    });
    return NextResponse.json({ refreshed: false, reason: 'expired', needsReauth: true }, { status: 200 });
  }

  try {
    const current = decryptToken(connection!.access_token_enc as string);
    const refreshed = await refreshLongLivedToken(current);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + refreshed.expiresInSeconds * 1000);

    await updateConnection(service, {
      access_token_enc: encryptToken(refreshed.accessToken),
      token_expires_at: expiresAt.toISOString(),
      token_refreshed_at: now.toISOString(),
      status: 'connected',
    });

    await insertSyncLog(service, {
      action: 'token_refresh',
      outcome: 'ok',
      message: `Instagram token refreshed; now valid until ${expiresAt.toISOString().slice(0, 10)}.`,
    });

    return NextResponse.json({ refreshed: true, expiresAt: expiresAt.toISOString() });
  } catch (err) {
    const message =
      err instanceof InstagramApiError
        ? err.operatorMessage
        : err instanceof Error
          ? err.message
          : 'Instagram token refresh failed.';

    // Only an auth failure means the connection is actually broken; a transient
    // network/5xx failure leaves the still-valid token in place for next week.
    const isAuthFailure = err instanceof InstagramApiError && err.code === 'invalid_token';
    if (isAuthFailure) await updateConnection(service, { status: 'needs_reauth' });

    await insertSyncLog(service, {
      action: 'token_refresh',
      outcome: 'error',
      message,
    });

    return NextResponse.json({ refreshed: false, error: message }, { status: 500 });
  }
}
