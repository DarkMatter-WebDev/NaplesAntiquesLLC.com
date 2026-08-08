import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { getConnection, getRecentSyncLog, listQueuedPosts } from '@/lib/facebook/store';
import {
  facebookTokenEncryptionConfigured,
  facebookTokenInspectionConfigured,
} from '@/lib/facebook/auth';

export const runtime = 'nodejs';

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const service = createServiceClient();
  const connection = await getConnection(service);
  const log = await getRecentSyncLog(service, 25);
  const queued = await listQueuedPosts(service, 200);

  return NextResponse.json({
    connected: connection?.status === 'connected',
    status: connection?.status ?? 'disconnected',
    page: {
      pageId: connection?.page_id ?? null,
      pageName: connection?.page_name ?? null,
      connectedAt: connection?.connected_at ?? null,
    },
    token: {
      expiresAt: connection?.token_expires_at ?? null,
      refreshedAt: connection?.token_refreshed_at ?? null,
      encryptionKeyConfigured: facebookTokenEncryptionConfigured(),
      lifetimeValidationConfigured: facebookTokenInspectionConfigured(),
      dripCronSecretConfigured: Boolean(process.env.FACEBOOK_CRON_SECRET),
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
      postId: row.post_id,
      action: row.action,
      outcome: row.outcome,
      message: row.message,
    })),
  });
}
