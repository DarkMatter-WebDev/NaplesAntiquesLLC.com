import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/service';
import {
  encryptToken,
  exchangeForLongLivedToken,
  instagramTokenEncryptionConfigured,
  verifyPastedToken,
} from '@/lib/instagram/auth';
import { InstagramApiError } from '@/lib/instagram/client';
import { insertSyncLog, updateConnection } from '@/lib/instagram/store';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Store an Instagram access token the owner generated in the Meta App Dashboard.
 *
 * Why a paste instead of a redirect OAuth flow: Instagram requires HTTPS
 * redirect URIs and rejects http://localhost, which would make the owner's
 * LAN/dev testing impossible. This is a single owner-operated account on a
 * development-mode app, where Meta's own documented path is dashboard token
 * generation. Once stored, the scheduled refresh keeps it alive indefinitely,
 * so this paste happens once.
 *
 * The token itself is never logged, never echoed back, and is encrypted at rest.
 */
export async function POST(req: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  if (!instagramTokenEncryptionConfigured()) {
    return NextResponse.json(
      { error: 'INSTAGRAM_TOKEN_ENC_KEY is not configured, so the token cannot be stored securely.' },
      { status: 503 },
    );
  }

  const body = await req.json().catch(() => null);
  const rawToken = typeof body?.token === 'string' ? body.token.trim() : '';
  const isShortLived = body?.shortLived === true;

  if (!rawToken) {
    return NextResponse.json({ error: 'Paste the Instagram access token.' }, { status: 400 });
  }

  const service = createServiceClient();

  try {
    let accessToken = rawToken;
    // Meta's dashboard hands out long-lived tokens; a short-lived one has to be
    // exchanged first or it would die in an hour.
    let expiresInSeconds = 60 * 24 * 60 * 60;

    if (isShortLived) {
      const exchanged = await exchangeForLongLivedToken(rawToken);
      accessToken = exchanged.accessToken;
      expiresInSeconds = exchanged.expiresInSeconds;
    }

    const profile = await verifyPastedToken(accessToken);
    const now = new Date();

    await updateConnection(service, {
      status: 'connected',
      ig_user_id: profile.igUserId,
      username: profile.username,
      account_type: profile.accountType,
      access_token_enc: encryptToken(accessToken),
      token_expires_at: new Date(now.getTime() + expiresInSeconds * 1000).toISOString(),
      token_refreshed_at: now.toISOString(),
      connected_at: now.toISOString(),
    });

    await insertSyncLog(service, {
      action: 'connect',
      outcome: 'ok',
      message: `Connected Instagram account @${profile.username ?? profile.igUserId}.`,
    });

    return NextResponse.json({
      connected: true,
      account: {
        igUserId: profile.igUserId,
        username: profile.username,
        accountType: profile.accountType,
      },
    });
  } catch (err) {
    const message =
      err instanceof InstagramApiError
        ? err.operatorMessage
        : err instanceof Error
          ? err.message
          : 'Could not verify that token.';

    await insertSyncLog(service, {
      action: 'connect',
      outcome: 'error',
      message,
    });

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
