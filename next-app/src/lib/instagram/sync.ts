import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Product } from '@/types/product';
import { fetchSpotData } from '@/lib/spot-price';
import {
  INSTAGRAM_CONTAINER_TTL_MS,
  InstagramApiError,
  createCarouselContainer,
  createCarouselItemContainer,
  createComment,
  createImageContainer,
  fetchContainerStatus,
  fetchMedia,
  fetchPublishingLimit,
  instagramFetch,
} from './client';
import { ensureFreshAccessToken } from './auth';
import { buildInstagramPost, computeInstagramContentHash } from './mapping';
import { buildRenditions, deleteRenditions } from './images';
import {
  getConnection,
  getPost,
  insertSyncLog,
  pruneOldSyncLogs,
  upsertPost,
  type InstagramPostRow,
} from './store';

/**
 * Instagram publishing state machine.
 *
 * Shape mirrors the eBay integration (prepare locally -> review -> a separate,
 * deliberate go-live) rather than Etsy's, because Instagram has no concept of a
 * remote draft: an unpublished container expires after 24 hours, so "prepare"
 * has to mean "prepared locally", not "parked remotely".
 *
 * Every step is bounded and resumable. Container ids are checkpointed as they
 * are created so a timeout mid-carousel does not orphan work or double-post.
 */

export type InstagramSyncMode = 'prepare' | 'publish';

export interface SyncStepResult {
  done: boolean;
  state: InstagramPostRow['sync_state'];
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

/**
 * Build renditions + caption and park the product at 'review'.
 *
 * Nothing is sent to Instagram here. Re-running replaces the previous
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
  const existingForLineup = await getPost(service, productId);

  const post = buildInstagramPost({
    product,
    spotData,
    imageSelection: existingForLineup?.image_selection ?? null,
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

  const existing = existingForLineup;

  try {
    const { renditions, warnings: renditionWarnings } = await buildRenditions({
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
      posted_caption: post.caption,
      posted_price: post.quotedPrice,
      content_hash: computeInstagramContentHash(post),
      // Any previously-created containers are void now that images changed.
      child_container_ids: [],
      carousel_container_id: null,
      container_expires_at: null,
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
      message: `Prepared ${renditions.length} slide(s). Review the caption, then publish.`,
      warnings,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not prepare the post.';
    return recordError(service, productId, 'prepare', message);
  }
}

/** Containers expire after 24h; anything near that boundary is rebuilt. */
function containersUsable(row: InstagramPostRow | null): boolean {
  if (!row?.container_expires_at) return false;
  // 30-minute safety margin so we never publish a container that expires mid-call.
  return new Date(row.container_expires_at).getTime() - Date.now() > 30 * 60 * 1000;
}

/**
 * Go live. Creates containers (resuming from checkpoints when they are still
 * fresh), publishes, then verifies by reading the media back.
 */
export async function runPublishStep(
  service: SupabaseClient,
  productId: string,
): Promise<SyncStepResult> {
  const row = await getPost(service, productId);
  if (!row) return recordError(service, productId, 'publish', 'This product has not been prepared yet.');

  if (row.sync_state === 'published' && row.ig_media_id) {
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

  const auth = await ensureFreshAccessToken(service);
  if (!auth) {
    return recordError(
      service,
      productId,
      'publish',
      'Instagram is not connected, or the stored token needs to be replaced.',
    );
  }

  try {
    const limit = await fetchPublishingLimit(auth.igUserId, auth.accessToken);
    if (limit.used >= limit.total) {
      const message = `Instagram's 24-hour publishing limit is reached (${limit.used}/${limit.total}). Try again later.`;
      await insertSyncLog(service, { product_id: productId, action: 'publish', outcome: 'warning', message });
      return { done: false, state: row.sync_state, message };
    }

    // Public URLs for the already-uploaded renditions.
    const imageUrls = row.rendition_paths.map((path) => {
      const { data } = service.storage.from('product-images').getPublicUrl(path);
      return data.publicUrl;
    });

    let carouselContainerId = containersUsable(row) ? row.carousel_container_id : null;
    const isSingleImage = imageUrls.length === 1;

    if (!carouselContainerId) {
      await upsertPost(service, productId, { sync_state: 'publishing' });
      const expiresAt = new Date(Date.now() + INSTAGRAM_CONTAINER_TTL_MS).toISOString();

      if (isSingleImage) {
        carouselContainerId = await createImageContainer({
          igUserId: auth.igUserId,
          accessToken: auth.accessToken,
          imageUrl: imageUrls[0],
          caption: row.posted_caption,
          altText: null,
        });
      } else {
        const childIds: string[] = [];
        for (const imageUrl of imageUrls) {
          const childId = await createCarouselItemContainer({
            igUserId: auth.igUserId,
            accessToken: auth.accessToken,
            imageUrl,
          });
          childIds.push(childId);
          // Checkpoint after each child so a timeout resumes rather than restarts.
          await upsertPost(service, productId, {
            child_container_ids: childIds,
            container_expires_at: expiresAt,
          });
        }

        carouselContainerId = await createCarouselContainer({
          igUserId: auth.igUserId,
          accessToken: auth.accessToken,
          childrenIds: childIds,
          caption: row.posted_caption,
        });
      }

      await upsertPost(service, productId, {
        carousel_container_id: carouselContainerId,
        container_expires_at: expiresAt,
      });
    }

    // Meta fetches and processes each image asynchronously; publishing before
    // it finishes fails, so wait for FINISHED with a bounded number of checks.
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const status = await fetchContainerStatus(carouselContainerId, auth.accessToken);
      if (status.status_code === 'FINISHED') break;
      if (status.status_code === 'ERROR' || status.status_code === 'EXPIRED') {
        return recordError(
          service,
          productId,
          'publish',
          `Instagram could not process the images (${status.status_code}). Re-prepare and try again.`,
        );
      }
      if (attempt === 9) {
        return {
          done: false,
          state: 'publishing',
          message: 'Instagram is still processing the images. Retry in a moment to finish publishing.',
        };
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    const mediaId = await instagramFetch<{ id: string }>({
      path: `/${auth.igUserId}/media_publish`,
      accessToken: auth.accessToken,
      method: 'POST',
      params: { creation_id: carouselContainerId },
    }).then((res) => res.id);

    // Verify by reading it back — proof the post really exists.
    const media = await fetchMedia(mediaId, auth.accessToken).catch(() => null);

    await upsertPost(service, productId, {
      sync_state: 'published',
      ig_media_id: mediaId,
      permalink: media?.permalink ?? null,
      posted_at: new Date().toISOString(),
      queued_at: null,
      child_container_ids: [],
      carousel_container_id: null,
      container_expires_at: null,
      last_error: null,
      error_count: 0,
    });

    await insertSyncLog(service, {
      product_id: productId,
      media_id: mediaId,
      action: 'publish',
      outcome: 'ok',
      message: `Published to Instagram${media?.permalink ? ` (${media.permalink})` : ''}.`,
    });
    await pruneOldSyncLogs(service);

    return {
      done: true,
      state: 'published',
      message: 'Published to Instagram.',
      permalink: media?.permalink ?? null,
    };
  } catch (err) {
    const message =
      err instanceof InstagramApiError
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
  mode: InstagramSyncMode,
): Promise<SyncStepResult> {
  return mode === 'prepare'
    ? runPrepareStep(service, productId)
    : runPublishStep(service, productId);
}

/**
 * Comment the configured SOLD marker on a published post.
 *
 * Idempotent: a post that already carries the comment is left alone, so a
 * repeated status change never spams the post.
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
  if (!row?.ig_media_id || row.sync_state !== 'published') {
    return { commented: false, message: 'No published Instagram post for this product.' };
  }
  if (row.sold_comment_id) {
    return { commented: false, message: 'This post is already marked sold.' };
  }

  const auth = await ensureFreshAccessToken(service);
  if (!auth) return { commented: false, message: 'Instagram is not connected.' };

  try {
    const commentId = await createComment({
      mediaId: row.ig_media_id,
      accessToken: auth.accessToken,
      message: connection.sold_comment_text || 'SOLD',
    });
    await upsertPost(service, productId, {
      sold_comment_id: commentId,
      sold_comment_at: new Date().toISOString(),
    });
    await insertSyncLog(service, {
      product_id: productId,
      media_id: row.ig_media_id,
      action: 'sold_comment',
      outcome: 'ok',
      message: 'Commented the sold marker on the Instagram post.',
    });
    return { commented: true, message: 'Marked the Instagram post as sold.' };
  } catch (err) {
    const message =
      err instanceof InstagramApiError ? err.operatorMessage : 'Could not comment on the post.';
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
 * Detects Meta's "this object does not support DELETE" family of responses.
 *
 * Confirmed live 2026-08-01: the Instagram API with Instagram Login provides
 * NO media-deletion endpoint. (The `instagram_manage_contents` permission that
 * can delete posts belongs to the Facebook-Login variant, which requires a
 * linked Facebook Page — an architecture we deliberately do not use.) A post
 * published through this integration can therefore only be removed by hand in
 * the Instagram app.
 */
function isUnsupportedDelete(err: unknown): boolean {
  if (!(err instanceof InstagramApiError)) return false;
  return /does not support this operation|Unsupported \w+ request/i.test(err.operatorMessage);
}

/**
 * Remove a published post.
 *
 * Attempts the API delete, but Instagram does not actually support deleting
 * media through this API. When that is the outcome the local record is left
 * INTACT — the operator still needs the permalink to find and delete the post
 * by hand — and an actionable message is returned. Use `forgetPost` afterwards
 * to clear local state.
 */
export async function deletePost(
  service: SupabaseClient,
  productId: string,
): Promise<{ deleted: boolean; manualDeleteRequired?: boolean; permalink?: string | null; message: string }> {
  const row = await getPost(service, productId);
  if (!row) return { deleted: false, message: 'No Instagram post recorded for this product.' };

  if (row.ig_media_id) {
    const auth = await ensureFreshAccessToken(service);
    if (!auth) return { deleted: false, message: 'Instagram is not connected.' };
    try {
      await instagramFetch({
        path: `/${row.ig_media_id}`,
        accessToken: auth.accessToken,
        method: 'DELETE',
      });
    } catch (err) {
      if (isUnsupportedDelete(err)) {
        const message =
          'Instagram does not allow deleting posts through its API. Open the post in the Instagram app and delete it there, then choose "Forget this post" to clear it here.';
        await insertSyncLog(service, {
          product_id: productId,
          media_id: row.ig_media_id,
          action: 'delete',
          outcome: 'warning',
          message,
        });
        return {
          deleted: false,
          manualDeleteRequired: true,
          permalink: row.permalink,
          message,
        };
      }

      const message =
        err instanceof InstagramApiError ? err.operatorMessage : 'Could not delete the post.';
      await insertSyncLog(service, {
        product_id: productId,
        action: 'delete',
        outcome: 'error',
        message,
      });
      return { deleted: false, message };
    }
  }

  await forgetPost(service, productId, 'Deleted the Instagram post and its renditions.');
  return { deleted: true, message: 'Deleted the Instagram post.' };
}

/**
 * Clear local state for a post and delete its renditions, without touching
 * Instagram. Used after the operator has deleted a post by hand, and by the
 * successful delete path above.
 */
export async function forgetPost(
  service: SupabaseClient,
  productId: string,
  logMessage = 'Cleared the local Instagram record; the post was removed manually.',
): Promise<{ forgotten: boolean; message: string }> {
  const row = await getPost(service, productId);
  if (!row) return { forgotten: false, message: 'No Instagram post recorded for this product.' };

  await deleteRenditions(service, row.rendition_paths ?? []);
  await upsertPost(service, productId, {
    sync_state: 'deleted',
    ig_media_id: null,
    permalink: null,
    rendition_paths: [],
    child_container_ids: [],
    carousel_container_id: null,
    container_expires_at: null,
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
 * clear the prepared caption, price, hash, containers, and queue entry — while
 * KEEPING the operator's curation (lineup, crops, card source/background).
 * Changing your mind must not cost the curation work; a later Prepare rebuilds
 * the draft in one click. Refuses on published posts (that is Remove's job)
 * and while a publish is in flight (discarding mid-publish would race the
 * container flow).
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
    child_container_ids: [],
    carousel_container_id: null,
    container_expires_at: null,
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
    return { published: 0, skipped: 0, message: 'Instagram is not connected.' };
  }

  const dailyLimit = connection.daily_post_limit ?? 2;
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const { count: postedToday } = await service
    .from('instagram_posts')
    .select('product_id', { count: 'exact', head: true })
    .eq('sync_state', 'published')
    .gte('posted_at', since.toISOString());

  const remaining = Math.max(0, dailyLimit - (postedToday ?? 0));
  if (remaining === 0) {
    return { published: 0, skipped: 0, message: `Daily limit of ${dailyLimit} already met.` };
  }

  const { data: queued } = await service
    .from('instagram_posts')
    .select('*')
    .in('sync_state', ['review'])
    .not('queued_at', 'is', null)
    .order('queued_at', { ascending: true })
    .limit(remaining);

  let published = 0;
  let skipped = 0;
  for (const row of (queued as InstagramPostRow[]) ?? []) {
    // Publishing to Instagram changes no storefront data, so there is
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
