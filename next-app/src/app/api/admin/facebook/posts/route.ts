import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { listPosts } from '@/lib/facebook/store';

export const runtime = 'nodejs';

/** Per-product Facebook state, for admin row chips and the product panel. */
export async function GET(req: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const url = new URL(req.url);
  const ids = url.searchParams.get('ids');
  const productIds = ids ? ids.split(',').map((id) => id.trim()).filter(Boolean) : undefined;

  const service = createServiceClient();
  const posts = await listPosts(service, productIds);

  return NextResponse.json({
    posts: posts.map((row) => ({
      productId: row.product_id,
      syncState: row.sync_state,
      permalink: row.permalink,
      postedAt: row.posted_at,
      queuedAt: row.queued_at,
      soldCommentAt: row.sold_comment_at,
      lastError: row.last_error,
    })),
  });
}
