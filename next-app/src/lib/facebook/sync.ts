import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Product } from '@/types/product';
import { fetchSpotData } from '@/lib/spot-price';
import { getSiteUrl } from '@/lib/order-email-branding';
import {
  FACEBOOK_PHOTO_TTL_MS,
  FacebookApiError,
  createComment,
  createFeedPost,
  createUnpublishedPhoto,
  deleteFacebookPost,
  fetchPost,
} from './client';
import { ensurePageAccessToken, markNeedsReauth } from './auth';
import { buildFacebookPost, computeFacebookContentHash } from './mapping';
import { buildFacebookRenditions, deleteRenditions } from './images';
import {
  getConnection,
  getPost,
  insertSyncLog,
  pruneOldSyncLogs,
  upsertPost,
  type FacebookPostRow,
} from './store';

/**
 * Facebook publishing state machine — same states and operator flow as
 * Instagram's (prepare locally -> review -> a separate, deliberate go-live),
 * with a simpler publish step: no container polling, and unpublished photos are
 * created synchronously.
 *
 * Every step is bounded and resumable. Photo ids are checkpointed as they are
 * created so a timeout mid-upload resumes rather than re-uploading, and stale
 * checkpoints (unpublished photos live ~24h) are discarded rather than
 * published blind.
 */

export type FacebookSyncMode = 'prepare' | 'publish';

export interface SyncStepResult {
  done: boolean;
  state: FacebookPostRow['sync_state'];
  message: string;
  permalink?: string | null;
  warnings?: string[];
}

async function loadProduct(service: SupabaseClient, productId: string): Promise<Product | null> {
  const { data } = await service.from('products').select('*').eq('id', productId).maybeSingle();
  return (data as Product) ?? null;
}

async function recordError(
  service: SupabaseClient,
  productId: string,
  action: string,
  message: string,
): Promise<SyncStepResult> {
  const existing = await getPost(service, productId);
  await upsertPost(service, productId, {
    sync_state: 'error',
    last_error: message,
    error_count: (existing?.error_count ?? 0) + 1,
  });
  await insertSyncLog(service, { product_id: productId, action, outcome: 'error', message });
  return { done: true, state: 'error', message };
}

/** On a token rejection, flip the connection to needs_reauth as well. */
async function recordAuthError(
  service: SupabaseClient,
  productId: string,
  action: string,
  err: FacebookApiError,
): Promise<SyncStepResult> {
  await markNeedsReauth(service);
  return recordError(
    service,
    productId,
    action,
    `${err.operatorMessage} Paste a fresh Page token in Admin → Settings → Facebook.`,
  );
}

/**
 * Build renditions + post text and park the product at 'review'.
 *
 * Nothing is sent to Facebook here. Re-running replaces the previous
 * renditions (and deletes the old objects) so an edited product always
 * previews what would actually publish.
 */
export async function runPrepareStep(
  service: SupabaseClient,
  productId: string,
): Promise<SyncStepResult> {
  const product = await loadProduct(service, productId);
  if (!product) return recordError(service, productId, 'prepare', 'Product not found.');

  const connection = await getConnection(service);
  const spotData = await fetchSpotData();
  const existing = await getPost(service, productId);

  const post = buildFacebookPost({
    product,
    spotData,
    siteUrl: getSiteUrl(),
    imageSelection: existing?.image_selection ?? null,
    settings: {
      includePrice: connection?.caption_include_price ?? true,
      spanishLine: connection?.caption_spanish_line ?? true,
      cta: connection?.caption_cta ?? undefined,
      baseHashtags: connection?.base_hashtags?.length ? connection.base_hashtags : undefined,
    },
  });

  if (post.blockedReason) {
    return recordError(service, productId, 'prepare', post.blockedReason);
  }

  try {
    const { renditions, warnings: renditionWarnings } = await buildFacebookRenditions({
      service,
      productId,
      imageUrls: post.imageUrls,
      crops: existing?.image_crops ?? null,
      card: post.cardContent,
      cardSourceUrl: existing?.card_source_url ?? null,
      cardBackground: existing?.card_background ?? null,
    });
    const warnings = [...post.warnings, ...renditionWarnings];

    // Replace, don't accumulate: the previous renditions are now unreferenced.
    if (existing?.rendition_paths?.length) {
      await deleteRenditions(
        service,
        existing.rendition_paths.filter((path) => !renditions.some((r) => r.path === path)),
      );
    }

    await upsertPost(service, productId, {
      sync_state: 'review',
      rendition_paths: renditions.map((r) => r.path),
      posted_caption: post.message,
      posted_price: post.quotedPrice,
      content_hash: computeFacebookContentHash(post),
      // Any previously-created unpublished photos are void now that images changed.
      photo_ids: [],
      photos_expire_at: null,
      last_error: null,
      error_count: 0,
    });

    await insertSyncLog(service, {
      product_id: productId,
      action: 'prepare',
      outcome: warnings.length ? 'warning' : 'ok',
      message: `Prepared ${renditions.length} slide(s) for review.`,
      detail: warnings.length ? { warnings } : null,
    });

    return {
      done: true,
      state: 'review',
      message: `Prepared ${renditions.length} slide(s). Review the post text, then publish.`,
      warnings,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not prepare the post.';
    return recordError(service, productId, 'prepare', message);
  }
}

/** Unpublished photos live ~24h; anything near that boundary is rebuilt. */
function photosUsable(row: FacebookPostRow | null): boolean {
  if (!row?.photos_expire_at || !row.photo_ids?.length) return false;
  // 30-minute safety margin so we never attach a photo that expires mid-call.
  return new Date(row.photos_expire_at).getTime() - Date.now() > 30 * 60 * 1000;
}

/**
 * Go live. Uploads unpublished photos (resuming from checkpoints when fresh),
 * creates the feed post, then verifies by reading it back.
 */
export async function runPublishStep(
  service: SupabaseClient,
  productId: string,
): Promise<SyncStepResult> {
  const row = await getPost(service, productId);
  if (!row) return recordError(service, productId, 'publish', 'This product has not been prepared yet.');

  if (row.sync_state === 'published' && row.fb_post_id) {
    return {
      done: true,
      state: 'published',
      message: 'Already published.',
      permalink: row.permalink,
    };
  }
  if (!row.posted_caption || !row.rendition_paths?.length) {
    return recordError(service, productId, 'publish', 'Prepare this product before publishing.');
  }

  const auth = await ensurePageAccessToken(service);
  if (!auth) {
    return recordError(
      service,
      productId,
      'publish',
      'Facebook is not connected, or the stored token needs to be replaced.',
    );
  }

  try {
    // Public URLs for the already-uploaded renditions.
    const imageUrls = row.rendition_paths.map((path) => {
      const { data } = service.storage.from('product-images').getPublicUrl(path);
      return data.publicUrl;
    });

    let photoIds = photosUsable(row) ? row.photo_ids : [];

    if (photoIds.length < imageUrls.length) {
      await upsertPost(service, productId, { sync_state: 'publishing' });
      const expiresAt = new Date(Date.now() + FACEBOOK_PHOTO_TTL_MS).toISOString();

      // Resume from however many photos a previous attempt got through.
      for (let index = photoIds.length; index < imageUrls.length; index += 1) {
        const photoId = await createUnpublishedPhoto({
          pageId: auth.pageId,
          accessToken: auth.accessToken,
          imageUrl: imageUrls[index],
        });
        photoIds = [...photoIds, photoId];
        // Checkpoint after each photo so a timeout resumes rather than restarts.
        await upsertPost(service, productId, {
          photo_ids: photoIds,
          photos_expire_at: expiresAt,
        });
      }
    }

    const postId = await createFeedPost({
      pageId: auth.pageId,
      accessToken: auth.accessToken,
      message: row.posted_caption,
      photoIds,
    });

    // Verify by reading it back — proof the post really exists.
    const post = await fetchPost(postId, auth.accessToken).catch(() => null);

    await upsertPost(service, productId, {
      sync_state: 'published',
      fb_post_id: postId,
      permalink: post?.permalink_url ?? null,
      posted_at: new Date().toISOString(),
      queued_at: null,
      photo_ids: [],
      photos_expire_at: null,
      last_error: null,
      error_count: 0,
    });

    await insertSyncLog(service, {
      product_id: productId,
      post_id: postId,
      action: 'publish',
      outcome: 'ok',
      message: `Published to Facebook${post?.permalink_url ? ` (${post.permalink_url})` : ''}.`,
    });
    await pruneOldSyncLogs(service);

    return {
      done: true,
      state: 'published',
      message: 'Published to Facebook.',
      permalink: post?.permalink_url ?? null,
    };
  } catch (err) {
    if (err instanceof FacebookApiError && err.code === 'invalid_token') {
      return recordAuthError(service, productId, 'publish', err);
    }
    const message =
      err instanceof FacebookApiError
        ? err.operatorMessage
        : err instanceof Error
          ? err.message
          : 'Publishing failed.';
    return recordError(service, productId, 'publish', message);
  }
}

export async function runSyncStep(
  service: SupabaseClient,
  productId: string,
  mode: FacebookSyncMode,
): Promise<SyncStepResult> {
  return mode === 'prepare'
    ? runPrepareStep(service, productId)
    : runPublishStep(service, productId);
}

/**
 * Comment the configured SOLD marker on a published post. Idempotent: a post
 * that already carries the comment is left alone.
 */
export async function markPostSold(
  service: SupabaseClient,
  productId: string,
): Promise<{ commented: boolean; message: string }> {
  const connection = await getConnection(service);
  if (!connection?.sold_comment_enabled) {
    return { commented: false, message: 'Sold comments are turned off.' };
  }

  const row = await getPost(service, productId);
  if (!row?.fb_post_id || row.sync_state !== 'published') {
    return { commented: false, message: 'No published Facebook post for this product.' };
  }
  if (row.sold_comment_id) {
    return { commented: false, message: 'This post is already marked sold.' };
  }

  const auth = await ensurePageAccessToken(service);
  if (!auth) return { commented: false, message: 'Facebook is not connected.' };

  try {
    const commentId = await createComment({
      postId: row.fb_post_id,
      accessToken: auth.accessToken,
      message: connection.sold_comment_text || 'SOLD',
    });
    await upsertPost(service, productId, {
      sold_comment_id: commentId,
      sold_comment_at: new Date().toISOString(),
    });
    await insertSyncLog(service, {
      product_id: productId,
      post_id: row.fb_post_id,
      action: 'sold_comment',
      outcome: 'ok',
      message: 'Commented the sold marker on the Facebook post.',
    });
    return { commented: true, message: 'Marked the Facebook post as sold.' };
  } catch (err) {
    const message =
      err instanceof FacebookApiError ? err.operatorMessage : 'Could not comment on the post.';
    await insertSyncLog(service, {
      product_id: productId,
      action: 'sold_comment',
      outcome: 'error',
      message,
    });
    return { commented: false, message };
  }
}

/**
 * Remove a published post. Unlike Instagram, Facebook's API genuinely supports
 * this, so there is no manual-delete detour: the post is deleted remotely, then
 * local state and renditions are cleared.
 */
export async function deletePost(
  service: SupabaseClient,
  productId: string,
): Promise<{ deleted: boolean; message: string }> {
  const row = await getPost(service, productId);
  if (!row) return { deleted: false, message: 'No Facebook post recorded for this product.' };

  if (row.fb_post_id) {
    const auth = await ensurePageAccessToken(service);
    if (!auth) return { deleted: false, message: 'Facebook is not connected.' };
    try {
      await deleteFacebookPost(row.fb_post_id, auth.accessToken);
    } catch (err) {
      if (err instanceof FacebookApiError && err.code === 'invalid_token') {
        await markNeedsReauth(service);
      }
      const message =
        err instanceof FacebookApiError ? err.operatorMessage : 'Could not delete the post.';
      await insertSyncLog(service, {
        product_id: productId,
        post_id: row.fb_post_id,
        action: 'delete',
        outcome: 'error',
        message,
      });
      return { deleted: false, message };
    }
  }

  await forgetPost(service, productId, 'Deleted the Facebook post and its renditions.');
  return { deleted: true, message: 'Deleted the Facebook post.' };
}

/**
 * Clear local state for a post and delete its renditions, without touching
 * Facebook. Used by the delete path above, and directly when the operator
 * removed the post by hand on Facebook.
 */
export async function forgetPost(
  service: SupabaseClient,
  productId: string,
  logMessage = 'Cleared the local Facebook record.',
): Promise<{ forgotten: boolean; message: string }> {
  const row = await getPost(service, productId);
  if (!row) return { forgotten: false, message: 'No Facebook post recorded for this product.' };

  await deleteRenditions(service, row.rendition_paths ?? []);
  await upsertPost(service, productId, {
    sync_state: 'deleted',
    fb_post_id: null,
    permalink: null,
    rendition_paths: [],
    photo_ids: [],
    photos_expire_at: null,
    queued_at: null,
    sold_comment_id: null,
    sold_comment_at: null,
  });
  await insertSyncLog(service, {
    product_id: productId,
    action: 'forget',
    outcome: 'ok',
    message: logMessage,
  });

  return { forgotten: true, message: logMessage };
}

/**
 * Discard a prepared-but-unpublished upload: delete the rendition files and
 * clear the prepared post text, price, hash, staged photos, and queue entry —
 * while KEEPING the operator's curation (lineup, crops, card
 * source/background). Mirrors the Instagram discard; see its docblock for the
 * rationale and the published/publishing guards.
 */
export async function discardPrepared(
  service: SupabaseClient,
  productId: string,
): Promise<{ discarded: boolean; message: string }> {
  const row = await getPost(service, productId);
  if (!row || (!row.rendition_paths?.length && !row.posted_caption && !row.queued_at)) {
    return { discarded: false, message: 'There is no prepared upload to discard.' };
  }
  if (row.sync_state === 'published') {
    return { discarded: false, message: 'This post is live — use Remove post instead of discarding.' };
  }
  if (row.sync_state === 'publishing') {
    return {
      discarded: false,
      message: 'A publish is in flight; wait for it to finish (or fail) before discarding.',
    };
  }

  await deleteRenditions(service, row.rendition_paths ?? []);
  await upsertPost(service, productId, {
    sync_state: 'pending',
    rendition_paths: [],
    posted_caption: null,
    posted_price: null,
    content_hash: null,
    photo_ids: [],
    photos_expire_at: null,
    queued_at: null,
    last_error: null,
    error_count: 0,
  });
  await insertSyncLog(service, {
    product_id: productId,
    action: 'discard',
    outcome: 'ok',
    message: 'Discarded the prepared upload; lineup, crops and card choices were kept.',
  });

  return {
    discarded: true,
    message: 'Discarded. Your lineup and card choices were kept — Prepare rebuilds the draft any time.',
  };
}

/**
 * Drip runner: publish up to the configured daily limit from the approved
 * queue, oldest first. Only ever touches products an admin explicitly queued.
 */
export async function runScheduledDrip(service: SupabaseClient): Promise<{
  published: number;
  skipped: number;
  message: string;
}> {
  const connection = await getConnection(service);
  if (connection?.status !== 'connected') {
    return { published: 0, skipped: 0, message: 'Facebook is not connected.' };
  }

  const dailyLimit = connection.daily_post_limit ?? 2;
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const { count: postedToday } = await service
    .from('facebook_posts')
    .select('product_id', { count: 'exact', head: true })
    .eq('sync_state', 'published')
    .gte('posted_at', since.toISOString());

  const remaining = Math.max(0, dailyLimit - (postedToday ?? 0));
  if (remaining === 0) {
    return { published: 0, skipped: 0, message: `Daily limit of ${dailyLimit} already met.` };
  }

  const { data: queued } = await service
    .from('facebook_posts')
    .select('*')
    .in('sync_state', ['review'])
    .not('queued_at', 'is', null)
    .order('queued_at', { ascending: true })
    .limit(remaining);

  let published = 0;
  let skipped = 0;
  for (const row of (queued as FacebookPostRow[]) ?? []) {
    // Publishing to Facebook changes no storefront data, so there is
    // deliberately no shop-cache revalidation here.
    const result = await runPublishStep(service, row.product_id);
    if (result.state === 'published') published += 1;
    else skipped += 1;
  }

  const message = `Drip run complete: ${published} published, ${skipped} skipped.`;
  await insertSyncLog(service, {
    action: 'scheduled_drip',
    outcome: skipped > 0 && published === 0 ? 'warning' : 'ok',
    message,
  });

  return { published, skipped, message };
}
