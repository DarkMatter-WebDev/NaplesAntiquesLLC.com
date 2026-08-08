import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { getConnection, getRecentSyncLog, listQueuedPosts } from '@/lib/instagram/store';
import { instagramTokenEncryptionConfigured } from '@/lib/instagram/auth';

export const runtime = 'nodejs';

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const service = createServiceClient();
  const connection = await getConnection(service);
  const log = await getRecentSyncLog(service, 25);
  const queued = await listQueuedPosts(service, 200);

  const expiresAt = connection?.token_expires_at ? new Date(connection.token_expires_at) : null;
  const daysUntilExpiry = expiresAt
    ? Math.floor((expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
    : null;

  return NextResponse.json({
    connected: connection?.status === 'connected',
    status: connection?.status ?? 'disconnected',
    account: {
      igUserId: connection?.ig_user_id ?? null,
      username: connection?.username ?? null,
      accountType: connection?.account_type ?? null,
      connectedAt: connection?.connected_at ?? null,
    },
    token: {
      expiresAt: connection?.token_expires_at ?? null,
      refreshedAt: connection?.token_refreshed_at ?? null,
      daysUntilExpiry,
      encryptionKeyConfigured: instagramTokenEncryptionConfigured(),
      refreshCronSecretConfigured: Boolean(process.env.INSTAGRAM_CRON_SECRET),
    },
    policy: {
      autoPublish: connection?.auto_publish ?? false,
      captionIncludePrice: connection?.caption_include_price ?? true,
      captionSpanishLine: connection?.caption_spanish_line ?? true,
      captionCta: connection?.caption_cta ?? null,
      baseHashtags: connection?.base_hashtags ?? [],
      soldCommentEnabled: connection?.sold_comment_enabled ?? true,
      soldCommentText: connection?.sold_comment_text ?? 'SOLD',
    },
    queue: {
      approvedCount: queued.length,
      nextProductId: queued[0]?.product_id ?? null,
    },
    recentActivity: log.map((row) => ({
      id: row.id,
      createdAt: row.created_at,
      productId: row.product_id,
      mediaId: row.media_id,
      action: row.action,
      outcome: row.outcome,
      message: row.message,
    })),
  });
}
