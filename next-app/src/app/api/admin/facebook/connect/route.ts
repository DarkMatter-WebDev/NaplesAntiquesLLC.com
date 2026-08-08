import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/service';
import {
  encryptToken,
  facebookTokenEncryptionConfigured,
  verifyPastedPageToken,
} from '@/lib/facebook/auth';
import { FacebookApiError } from '@/lib/facebook/client';
import { getConnection, insertSyncLog, updateConnection } from '@/lib/facebook/store';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Store a Facebook PAGE access token the owner generated (Graph API Explorer
 * with the Page selected, or a Business system-user token).
 *
 * Same paste-not-OAuth rationale as Instagram's connect route, with one
 * difference in our favour: a page token derived from a long-lived user token
 * does not expire, so there is no refresh schedule at all — this paste is
 * expected to be a one-time event unless Meta invalidates the token.
 *
 * The token itself is never logged, never echoed back, and is encrypted at rest.
 */
export async function POST(req: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  if (!facebookTokenEncryptionConfigured()) {
    return NextResponse.json(
      { error: 'FACEBOOK_TOKEN_ENC_KEY is not configured, so the token cannot be stored securely.' },
      { status: 503 },
    );
  }

  const body = await req.json().catch(() => null);
  const rawToken = typeof body?.token === 'string' ? body.token.trim() : '';

  if (!rawToken) {
    return NextResponse.json({ error: 'Paste the Facebook Page access token.' }, { status: 400 });
  }

  const service = createServiceClient();

  try {
    const page = await verifyPastedPageToken(rawToken);
    const existing = await getConnection(service);
    if (
      existing?.page_id &&
      existing.page_id !== page.pageId
    ) {
      throw new FacebookApiError({
        status: 409,
        code: 'wrong_page',
        operatorMessage: `That token belongs to ${page.pageName ?? page.pageId}, not the currently connected Page. The existing token was kept.`,
        retryable: false,
      });
    }
    const now = new Date();

    await updateConnection(service, {
      status: 'connected',
      page_id: page.pageId,
      page_name: page.pageName,
      access_token_enc: encryptToken(rawToken),
      token_expires_at: page.tokenExpiresAt,
      token_refreshed_at: now.toISOString(),
      connected_at: now.toISOString(),
    });

    await insertSyncLog(service, {
      action: 'connect',
      outcome: 'ok',
      message: `Connected Facebook Page ${page.pageName ?? page.pageId}.`,
    });

    return NextResponse.json({
      connected: true,
      page: { pageId: page.pageId, pageName: page.pageName },
    });
  } catch (err) {
    const message =
      err instanceof FacebookApiError
        ? err.operatorMessage
        : err instanceof Error
          ? err.message
          : 'Could not verify that token.';

    await insertSyncLog(service, { action: 'connect', outcome: 'error', message });

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
