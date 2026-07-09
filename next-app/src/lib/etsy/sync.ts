import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceClient } from '@/lib/supabase/service';
import { fetchSpotData } from '@/lib/spot-price';
import type { Product } from '@/types/product';
import { normalizeProductJewelryType, normalizeProductStatus } from '@/types/product';
import { ensureFreshAccessToken } from './auth';
import { etsyFetch, updateListingProperty, EtsyApiError } from './client';
import { attemptLengthSync, parseWearableLengthInches } from './length-experiment';
import { attemptRingSizeSync, parseRingSize } from './ring-size-experiment';
import {
  buildMappedPayload,
  buildPreflightChecks,
  computeContentHash,
  isPreflightPassing,
  mapProperties,
  type MappedEtsyPayload,
} from './mapping';
import {
  IMAGE_STEP_BUDGET,
  deleteEtsyListingImage,
  planImageDiff,
  reconcileMissingImageRows,
  uploadListingImage,
} from './images';
import {
  claimNextPendingListing,
  countPendingListings,
  deleteListingImageRow,
  getConnection,
  getListing,
  getListingImages,
  insertListingImage,
  insertSyncLog,
  pruneOldSyncLogs,
  upsertListing,
  type EtsyConnectionRow,
  type EtsyListingRow,
} from './store';

// Sync engine: the step machine described in etsy-sync-plan/03-sync-lifecycle.md.
// Every route (preview/sync/sync-batch/delist, plus the scheduled price push)
// calls into this module; routes stay thin (auth gate + parse + call here).

export interface SyncProgress {
  step: 'draft' | 'images' | 'inventory' | 'activate';
  uploaded?: number;
  total?: number;
}

export interface SyncStepResult {
  done: boolean;
  syncState: EtsyListingRow['sync_state'];
  progress?: SyncProgress;
  listingId?: number;
  listingUrl?: string;
  warnings?: string[];
  error?: { code: string; message: string };
}

/** Consecutive zero-progress image batches before giving up — see the image step's circuit breaker below (session 9 incident). */
const IMAGE_STALL_LIMIT = 5;

export type SyncMode = 'publish' | 'update' | 'price-only';

async function fetchProduct(service: SupabaseClient, productId: string): Promise<Product | null> {
  const { data, error } = await service.from('products').select('*').eq('id', productId).maybeSingle();
  if (error || !data) return null;
  return data as Product;
}

function listingUrlFor(listingId: number): string {
  return `https://www.etsy.com/listing/${listingId}`;
}

// The former SKU-adoption crash-recovery guard (adopt an existing Etsy draft
// on retry by matching our own SKU, if a prior run died between the create
// call succeeding and etsy_listing_id being saved) was removed 2026-07-08
// (session 9, fifth addendum) alongside no longer pushing SKU to Etsy at
// all — see DECISIONS.md for the reasoning and the accepted trade-off.
async function createDraftListing(params: {
  shopId: number;
  accessToken: string;
  connection: EtsyConnectionRow;
  payload: MappedEtsyPayload;
}): Promise<number> {
  const shopSectionId = params.payload.taxonomyPath ? params.connection.section_map?.[params.payload.taxonomyPath] : undefined;

  const res = await etsyFetch<{ listing_id: number }>({
    method: 'POST',
    path: `/v3/application/shops/${params.shopId}/listings`,
    accessToken: params.accessToken,
    json: {
      quantity: params.payload.quantity,
      title: params.payload.title,
      description: params.payload.description,
      price: params.payload.price,
      who_made: params.payload.whoMade,
      is_supply: params.payload.isSupply,
      when_made: params.payload.whenMade,
      taxonomy_id: params.payload.taxonomyId,
      tags: params.payload.tags,
      materials: params.payload.materials,
      shipping_profile_id: params.connection.shipping_profile_id,
      return_policy_id: params.connection.return_policy_id,
      readiness_state_id: params.connection.readiness_state_id ?? undefined,
      shop_section_id: shopSectionId,
      item_weight: params.payload.itemWeight ?? undefined,
      item_weight_unit: params.payload.itemWeightUnit ?? undefined,
    },
  });
  return res.data.listing_id;
}

async function updateListingInventory(params: {
  listingId: number;
  accessToken: string;
  payload: MappedEtsyPayload;
  readinessStateId: number | null;
}): Promise<void> {
  // Confirmed live 2026-07-08: Etsy rejected the first real sync with "All
  // offerings need readiness state" — the requestBody schema for this
  // operation requires `readiness_state_id` on EVERY offering (not just at
  // listing-create time), and `legacy=true` is needed to enable
  // processing-profile fields on this endpoint at all (per the operation's
  // own `legacy` query param description).
  await etsyFetch({
    method: 'PUT',
    path: `/v3/application/listings/${params.listingId}/inventory`,
    query: { legacy: true },
    accessToken: params.accessToken,
    json: {
      products: [
        {
          // Deliberately no `sku` here — see the comment above createDraftListing.
          property_values: [],
          offerings: [{
            price: params.payload.price,
            quantity: params.payload.quantity,
            is_enabled: true,
            readiness_state_id: params.readinessStateId,
          }],
        },
      ],
    },
  });
}

/**
 * Best-effort structured category properties (Material, Gold purity,
 * Bracelet length, etc — see mapping.ts's mapProperties). Deliberately
 * per-property try/catch: one bad property (e.g. the not-independently-
 * verified scale-only Length wire format, see OWNER-SETUP.md) must never
 * fail the sync or block price/qty/images, which is why this returns
 * warnings instead of throwing.
 */
async function pushListingProperties(params: {
  shopId: number;
  listingId: number;
  accessToken: string;
  product: Product;
  service: SupabaseClient;
  listing: EtsyListingRow;
}): Promise<string[]> {
  const warnings: string[] = [];
  for (const update of mapProperties(params.product)) {
    try {
      await updateListingProperty({
        shopId: params.shopId,
        listingId: params.listingId,
        accessToken: params.accessToken,
        propertyId: update.propertyId,
        valueIds: update.valueIds,
        values: update.values,
        scaleId: update.scaleId,
      });
    } catch (err) {
      const message = err instanceof EtsyApiError ? err.operatorMessage : err instanceof Error ? err.message : 'failed';
      warnings.push(`Category property ${update.propertyId} skipped — ${message}`);
    }
  }

  // ON by default as of 2026-07-08 (session 9) — the owner confirmed Length
  // works live across multiple categories and asked for it to auto-push, so
  // this no longer needs the ETSY_SYNC_BRACELET_LENGTH=true env flag flipped
  // in Netlify; set ETSY_SYNC_BRACELET_LENGTH=false to disable it instead.
  // Deliberately separate from the property loop above (see DECISIONS.md
  // session 5's "Gray" incident and length-experiment.ts): every write goes
  // through the discover→write→read-back→verify cycle, so a bad value fails
  // closed into a warning, never silently corrupts the listing. Excludes Ring
  // (no length concept for a buyer — Ring size instead, see below) and any
  // category with no source `length` value.
  const productType = normalizeProductJewelryType(params.product.product_type ?? params.product.jewelry_type);
  const hasWearableLength = productType != null && LENGTH_BEARING_PRODUCT_TYPES.has(productType);
  if (process.env.ETSY_SYNC_BRACELET_LENGTH !== 'false' && hasWearableLength) {
    const inches = parseWearableLengthInches(params.product.length);
    if (inches != null) {
      try {
        const result = await attemptLengthSync({ service: params.service, listing: params.listing, inches });
        if (!result.success) warnings.push(`Length: ${result.message}`);
      } catch (err) {
        const message = err instanceof EtsyApiError ? err.operatorMessage : err instanceof Error ? err.message : 'failed';
        warnings.push(`Length skipped — ${message}`);
      }
    }
  }

  // Ring size — a completely different, enumerated property (real
  // possible_values per region, e.g. "7 1/2" under a US/CA scale), never a
  // continuous measurement. ON by default as of 2026-07-08 (session 9,
  // eighth addendum) — same as Length now; the owner confirmed it works live
  // and asked for it to auto-push. Set ETSY_SYNC_RING_SIZE=false to disable.
  // A separate flag from Length so either can be turned off independently.
  // Same write→read-back→verify safety, and buildRingSizePayload only ever
  // uses a real matched chart value (never a guess), so a bad size fails
  // closed into a warning.
  if (process.env.ETSY_SYNC_RING_SIZE !== 'false' && productType === 'Ring') {
    const size = parseRingSize(params.product.length);
    if (size != null) {
      try {
        const result = await attemptRingSizeSync({ service: params.service, listing: params.listing, size });
        if (!result.success) warnings.push(`Ring size: ${result.message}`);
      } catch (err) {
        const message = err instanceof EtsyApiError ? err.operatorMessage : err instanceof Error ? err.message : 'failed';
        warnings.push(`Ring size skipped — ${message}`);
      }
    }
  }

  return warnings;
}

/** Categories confirmed (session 3 research) to have a buyer-facing length attribute on their taxonomy node — Ring is deliberately absent (Ring size instead, an unrelated enumerated property). */
const LENGTH_BEARING_PRODUCT_TYPES = new Set([
  'Necklace',
  'Bracelet',
  'Pendant',
  'Charm',
  'Earrings',
  'Brooch',
  'Cufflinks',
  'Watch',
  'Coin',
  'Bullion',
  'Silverware',
]);

async function setListingState(params: { shopId: number; listingId: number; accessToken: string; state: 'active' | 'inactive' }): Promise<void> {
  await etsyFetch({
    method: 'PATCH',
    path: `/v3/application/shops/${params.shopId}/listings/${params.listingId}`,
    accessToken: params.accessToken,
    json: { state: params.state },
  });
}

async function setListingCopy(params: { shopId: number; listingId: number; accessToken: string; payload: MappedEtsyPayload }): Promise<void> {
  // Confirmed live 2026-07-08: Etsy rejected an update-mode PATCH with
  // "Cannot update 'when_made' without 'who_made' and without 'is_supply'
  // and vice versa" — this endpoint treats the three as a linked group, so
  // when_made can never be sent alone (createDraftListing already sends all
  // three together; this call previously sent when_made by itself).
  await etsyFetch({
    method: 'PATCH',
    path: `/v3/application/shops/${params.shopId}/listings/${params.listingId}`,
    accessToken: params.accessToken,
    json: {
      title: params.payload.title,
      description: params.payload.description,
      tags: params.payload.tags,
      materials: params.payload.materials,
      taxonomy_id: params.payload.taxonomyId,
      who_made: params.payload.whoMade,
      is_supply: params.payload.isSupply,
      when_made: params.payload.whenMade,
    },
  });
}

/** Runs one bounded step-machine invocation for a single product. Idempotent — safe to call again. */
export async function runSyncStep(productId: string, mode: SyncMode = 'publish'): Promise<SyncStepResult> {
  const service = createServiceClient();
  const product = await fetchProduct(service, productId);
  if (!product) return { done: true, syncState: 'error', error: { code: 'not_found', message: 'Product not found.' } };

  const connection = await getConnection(service);
  const spotData = await fetchSpotData();
  let listing = await getListing(service, productId);
  const taxonomyOverride = listing?.taxonomy_override_id
    ? { id: listing.taxonomy_override_id, path: listing.taxonomy_override_path ?? '' }
    : null;
  const preflight = buildPreflightChecks(product, connection, spotData, taxonomyOverride);
  if (!isPreflightPassing(preflight)) {
    const message = preflight
      .filter((check) => !check.ok)
      .map((check) => check.message)
      .filter(Boolean)
      .join(' ') || 'This item is not eligible for Etsy sync yet.';
    await upsertListing(service, productId, { sync_state: 'error', last_error: message });
    await insertSyncLog(service, { product_id: productId, action: 'preflight', outcome: 'error', message });
    return { done: true, syncState: 'error', error: { code: 'preflight_failed', message } };
  }
  if (!connection) return { done: true, syncState: 'error', error: { code: 'not_connected', message: 'Etsy is not connected.' } };

  const { accessToken, shopId } = await ensureFreshAccessToken(service);
  const payload = buildMappedPayload(product, connection, spotData, taxonomyOverride, listing?.extra_tags ?? null);
  const warnings: string[] = [];

  // A bulk enqueue resets items to 'pending'. For an item that ALREADY exists
  // on Etsy (has a listing_id), a fresh-publish pass does NOTHING — every
  // publish step gates on a later state (create needs no listing_id, images
  // need draft_created/error, inventory needs images_synced) — so it would sit
  // in 'pending' forever and the bulk drain (which claims 'pending' and bumps
  // updated_at) would re-claim the same items every pass without end
  // (confirmed live 2026-07-08: "Processed 79 of 55 · 55 remaining", climbing).
  // Treat such an item as an UPDATE: push the current mapping (image DIFF —
  // not a re-upload — plus inventory/properties/copy) and move it to a
  // terminal state so it leaves the queue.
  const effectiveMode: SyncMode =
    mode === 'publish' && listing?.etsy_listing_id != null && listing.sync_state === 'pending' ? 'update' : mode;

  try {
    // Step 1 — draft.
    if (!listing || !listing.etsy_listing_id) {
      const listingId = await createDraftListing({ shopId, accessToken, connection, payload });
      listing = await upsertListing(service, productId, {
        etsy_listing_id: listingId,
        sync_state: 'draft_created',
        listing_state: 'draft',
        taxonomy_id: payload.taxonomyId,
      });
      await insertSyncLog(service, { product_id: productId, listing_id: listingId, action: 'create_draft', outcome: 'ok' });
    }
    const listingId = listing.etsy_listing_id as number;

    // Step 2 — images, bounded per invocation so a large product spans
    // multiple calls without ever duplicating an already-uploaded image.
    // 'error' is included here (not excluded) so a retry after ANY failure —
    // including one that happened at a later step, like inventory — re-enters
    // the pipeline instead of getting stuck: the diff/upload logic is already
    // idempotent (planImageDiff no-ops when nothing changed), so re-running
    // it on a retry is always safe, just sometimes redundant.
    if (['draft_created', 'error'].includes(listing.sync_state) || effectiveMode === 'update') {
      const existingImages = await getListingImages(service, listingId);
      let ops = planImageDiff(
        payload.images.map((image) => image.sourceUrl),
        existingImages,
      );
      ops = await reconcileMissingImageRows({ service, productId, listingId, accessToken, ops });

      const batch = ops.slice(0, IMAGE_STEP_BUDGET);
      let succeeded = 0;
      for (const op of batch) {
        if (op.type === 'upload') {
          try {
            const result = await uploadListingImage({ shopId, listingId, accessToken, sourceUrl: op.sourceUrl, rank: op.rank });
            await insertListingImage(service, {
              product_id: productId,
              etsy_listing_id: listingId,
              source_url: op.sourceUrl,
              source_key: op.sourceKey,
              bytes_sha256: result.bytesSha256,
              etsy_listing_image_id: result.etsyListingImageId,
              rank: op.rank,
            });
            succeeded += 1;
            if (result.warning) warnings.push(result.warning);
          } catch (err) {
            warnings.push(`Image skipped (source unreadable) — ${err instanceof Error ? err.message : 'upload failed'}`);
          }
        } else if (op.type === 'delete') {
          try {
            await deleteEtsyListingImage({ shopId, listingId, listingImageId: op.row.etsy_listing_image_id, accessToken });
          } catch {
            // Already gone on Etsy is fine — still drop our checkpoint row below.
          }
          await deleteListingImageRow(service, op.row.id);
          succeeded += 1;
        } else {
          try {
            const result = await uploadListingImage({ shopId, listingId, accessToken, sourceUrl: op.sourceUrl, rank: op.newRank });
            await deleteEtsyListingImage({ shopId, listingId, listingImageId: op.row.etsy_listing_image_id, accessToken }).catch(() => {});
            await deleteListingImageRow(service, op.row.id);
            await insertListingImage(service, {
              product_id: productId,
              etsy_listing_id: listingId,
              source_url: op.sourceUrl,
              source_key: op.sourceKey,
              bytes_sha256: result.bytesSha256,
              etsy_listing_image_id: result.etsyListingImageId,
              rank: op.newRank,
            });
            succeeded += 1;
          } catch (err) {
            warnings.push(`Re-rank skipped — ${err instanceof Error ? err.message : 'failed'}`);
          }
        }
      }

      if (ops.length > batch.length) {
        // More ops remain — but a batch that makes ZERO real progress must
        // never be retried forever. Confirmed live 2026-07-08 (session 9):
        // a persistently-failing image caused 100+ identical retries in a
        // tight client-side poll loop, hammering Etsy's API, with the real
        // per-image failure reason silently dropped by the client the whole
        // time (warnings were only ever surfaced once `done` became true —
        // fixed in EtsyProductPanel.tsx too). Reuses the same error_count
        // column the top-level catch-all below already uses for the same
        // "give up after repeated failure" concept.
        if (succeeded === 0) {
          const newErrorCount = (listing.error_count ?? 0) + 1;
          if (newErrorCount >= IMAGE_STALL_LIMIT) {
            const message = `Image upload stalled after ${newErrorCount} attempts with no progress. ${warnings[warnings.length - 1] ?? ''}`.trim();
            listing = await upsertListing(service, productId, { sync_state: 'error', last_error: message, error_count: newErrorCount });
            await insertSyncLog(service, { product_id: productId, listing_id: listingId, action: 'sync_step', outcome: 'error', message });
            return { done: true, syncState: 'error', listingId, error: { code: 'image_stall', message } };
          }
          listing = await upsertListing(service, productId, { error_count: newErrorCount });
        } else if (listing.error_count) {
          listing = await upsertListing(service, productId, { error_count: 0 });
        }
        return {
          done: false,
          syncState: listing.sync_state,
          progress: { step: 'images', uploaded: succeeded, total: ops.length },
          listingId,
          warnings: warnings.length ? warnings : undefined,
        };
      }
      if (listing.sync_state === 'draft_created' || listing.sync_state === 'error') {
        listing = await upsertListing(service, productId, { sync_state: 'images_synced' });
      }
    }

    // Step 3 — inventory (price/qty/sku), then best-effort category
    // properties (Material/Gold purity/length-equivalent — see mapping.ts's
    // mapProperties). Properties are skipped for price-only pushes: that
    // mode runs frequently (daily scheduled push) and only price should move.
    if (listing.sync_state === 'images_synced' || effectiveMode === 'update' || effectiveMode === 'price-only') {
      await updateListingInventory({ listingId, accessToken, payload, readinessStateId: connection.readiness_state_id });
      await insertSyncLog(service, {
        product_id: productId,
        listing_id: listingId,
        action: effectiveMode === 'price-only' ? 'price_push' : 'set_inventory',
        outcome: 'ok',
        detail: effectiveMode === 'price-only' ? { price: payload.price } : undefined,
      });
      if (effectiveMode === 'price-only') {
        listing = await upsertListing(service, productId, { last_pushed_price: payload.price, last_synced_at: new Date().toISOString() });
        return { done: true, syncState: listing.sync_state, listingId, listingUrl: listingUrlFor(listingId) };
      }

      warnings.push(...(await pushListingProperties({ shopId, listingId, accessToken, product, service, listing })));

      if (listing.sync_state === 'images_synced') {
        listing = await upsertListing(service, productId, { sync_state: 'inventory_synced', last_pushed_price: payload.price });
      }
    }

    // Step 4 — activate, or hold for owner review (Q1 default).
    if (listing.sync_state === 'inventory_synced') {
      if (connection.auto_activate) {
        await setListingState({ shopId, listingId, accessToken, state: 'active' });
        listing = await upsertListing(service, productId, {
          sync_state: 'active',
          listing_state: 'active',
          content_hash: computeContentHash(payload),
          last_synced_at: new Date().toISOString(),
          last_error: null,
          error_count: 0,
        });
        await insertSyncLog(service, { product_id: productId, listing_id: listingId, action: 'activate', outcome: 'ok' });
      } else {
        listing = await upsertListing(service, productId, {
          sync_state: 'draft_review',
          content_hash: computeContentHash(payload),
          last_synced_at: new Date().toISOString(),
          last_error: null,
          error_count: 0,
        });
        await insertSyncLog(service, { product_id: productId, listing_id: listingId, action: 'update', outcome: 'ok', message: 'Left in draft for owner review (Q1 default).' });
      }
    } else if (effectiveMode === 'update' && ['active', 'draft_review', 'out_of_date', 'pending'].includes(listing.sync_state)) {
      await setListingCopy({ shopId, listingId, accessToken, payload });
      // 'pending' here means a re-enqueued existing listing (see effectiveMode
      // above) — resolve it to a terminal state so it leaves the drain queue.
      const nextState =
        listing.sync_state === 'out_of_date' || listing.sync_state === 'pending'
          ? connection.auto_activate ? 'active' : 'draft_review'
          : listing.sync_state;
      listing = await upsertListing(service, productId, {
        content_hash: computeContentHash(payload),
        last_synced_at: new Date().toISOString(),
        sync_state: nextState,
        last_error: null,
        error_count: 0,
      });
      await insertSyncLog(service, { product_id: productId, listing_id: listingId, action: 'update', outcome: 'ok' });
    }

    return {
      done: true,
      syncState: listing.sync_state,
      listingId,
      listingUrl: listingUrlFor(listingId),
      warnings: warnings.length ? warnings : undefined,
    };
  } catch (err) {
    const message = err instanceof EtsyApiError ? err.operatorMessage : err instanceof Error ? err.message : 'Sync failed.';
    const code = err instanceof EtsyApiError ? err.code : 'sync_failed';
    if (err instanceof EtsyApiError && err.code === 'auth_expired') {
      // Auth failures are the CONNECTION's problem, not this product's — leave
      // sync_state alone so the product doesn't show a false "error" chip
      // (etsy-sync-plan/11-error-handling.md).
      return { done: true, syncState: listing?.sync_state ?? 'pending', error: { code, message } };
    }
    await upsertListing(service, productId, {
      sync_state: 'error',
      last_error: message,
      error_count: (listing?.error_count ?? 0) + 1,
    });
    await insertSyncLog(service, {
      product_id: productId,
      listing_id: listing?.etsy_listing_id ?? null,
      action: 'sync_step',
      outcome: 'error',
      message,
      detail: err instanceof EtsyApiError ? { code: err.code, status: err.status, detail: err.detail } : null,
    });
    return { done: true, syncState: 'error', error: { code, message } };
  }
}

export interface CheckListingStatusResult {
  /** False when the listing no longer exists on Etsy (never synced, or just found deleted — see message). */
  found: boolean;
  syncState: EtsyListingRow['sync_state'];
  etsyState?: string;
  message: string;
}

/**
 * PURE: given our current sync_state and Etsy's reported listing state, the
 * state patch to apply (empty = leave as-is). Also CLEARS a stale 'error' — a
 * listing that errored on our side (e.g. the missing-API-key incident
 * 2026-07-08) but is actually fine on Etsy reconciles back to its real state.
 * Unknown Etsy states return an empty patch (report only, never guess).
 */
export function reconcileSyncStateFromEtsy(
  current: EtsyListingRow['sync_state'],
  etsyState: string,
): { sync_state?: EtsyListingRow['sync_state']; listing_state?: EtsyListingRow['listing_state'] } {
  switch (etsyState) {
    case 'active':
      return { sync_state: 'active', listing_state: 'active' };
    case 'inactive':
    case 'sold_out':
      return { sync_state: 'delisted', listing_state: 'inactive' };
    case 'expired':
      return { sync_state: 'delisted', listing_state: 'ended' };
    case 'draft':
      // A draft on Etsy. If our state is stale — recorded active/delisted, or a
      // leftover 'error' from a transient failure — reset to the terminal draft
      // state; otherwise keep our finer draft-family state (draft_created/…).
      return ['active', 'delisted', 'error'].includes(current)
        ? { sync_state: 'draft_review', listing_state: 'draft' }
        : { listing_state: 'draft' };
    default:
      return {};
  }
}

/** Applies the reconciliation patch to one row; returns whether it changed. Shared by the per-item and bulk status checks. */
async function applyEtsyReconciliation(
  service: SupabaseClient,
  listing: EtsyListingRow,
  etsyState: string,
): Promise<{ changed: boolean; syncState: EtsyListingRow['sync_state'] }> {
  const patch = reconcileSyncStateFromEtsy(listing.sync_state, etsyState);
  const nextSync = patch.sync_state ?? listing.sync_state;
  const nextListing = patch.listing_state !== undefined ? patch.listing_state : listing.listing_state;
  if (nextSync === listing.sync_state && nextListing === listing.listing_state) {
    return { changed: false, syncState: listing.sync_state };
  }
  const clearError = listing.sync_state === 'error' && nextSync !== 'error';
  const updated = await upsertListing(service, listing.product_id, {
    ...patch,
    last_synced_at: new Date().toISOString(),
    ...(clearError ? { last_error: null, error_count: 0 } : {}),
  });
  await insertSyncLog(service, {
    product_id: listing.product_id,
    listing_id: listing.etsy_listing_id,
    action: 'check_status',
    outcome: 'ok',
    message: `Reconciled with Etsy — listing state: ${etsyState}.`,
  });
  return { changed: true, syncState: updated.sync_state };
}

/**
 * Manual reconciliation for when the Etsy-side listing changed outside this
 * app. Two cases:
 *
 * 1. The listing is gone (404) — most commonly the owner deleting a draft
 *    directly on etsy.com. Etsy hard-deletes draft listings, so the local row
 *    is reset to not-listed (etsy_listing_id cleared, sync_state 'pending') so
 *    "Sync to Etsy" — a fresh publish — reappears instead of "Sync Updates".
 *
 * 2. The listing still exists — GET its real state and write it back into our
 *    row when it changed out of band. The important case (confirmed live
 *    2026-07-08): the owner activates a draft directly on Etsy; without this,
 *    our chip stayed "Draft on Etsy — needs review" forever. Etsy's state axis
 *    is coarser than our sync_state, so for a still-"draft" listing we KEEP
 *    whatever draft-family sync_state we recorded (draft_created/images_synced/
 *    inventory_synced/draft_review) — that encodes our own pipeline progress
 *    and is strictly more informative than a bare "draft".
 */
export async function checkListingStatus(productId: string): Promise<CheckListingStatusResult> {
  const service = createServiceClient();
  const listing = await getListing(service, productId);
  if (!listing?.etsy_listing_id) {
    return { found: false, syncState: listing?.sync_state ?? 'pending', message: 'This product has never been synced to Etsy.' };
  }

  const { accessToken } = await ensureFreshAccessToken(service);
  try {
    const res = await etsyFetch<{ state: string }>({ path: `/v3/application/listings/${listing.etsy_listing_id}`, accessToken });
    const etsyState = res.data.state;
    const { changed, syncState } = await applyEtsyReconciliation(service, listing, etsyState);
    return {
      found: true,
      syncState,
      etsyState,
      message: changed
        ? `Updated — this listing is now ${etsyState} on Etsy.`
        : `Already in sync — listing state on Etsy: ${etsyState}.`,
    };
  } catch (err) {
    if (err instanceof EtsyApiError && err.status === 404) {
      const updated = await upsertListing(service, productId, {
        etsy_listing_id: null,
        sync_state: 'pending',
        listing_state: null,
        taxonomy_id: null,
        content_hash: null,
        last_pushed_price: null,
        last_error: null,
        error_count: 0,
      });
      await insertSyncLog(service, {
        product_id: productId,
        listing_id: listing.etsy_listing_id,
        action: 'check_status',
        outcome: 'ok',
        message: 'Listing no longer exists on Etsy (likely deleted there) — reset to not-listed.',
      });
      return { found: false, syncState: updated.sync_state, message: 'This listing no longer exists on Etsy — reset to not-listed. You can sync it fresh.' };
    }
    throw err;
  }
}

export interface CheckAllStatusResult {
  checked: number;
  updated: number;
  /** Listings gone from Etsy (404) — reset to not-listed. */
  reset: number;
  errors: number;
}

/**
 * Bulk "Check Etsy status of all" — reconciles every LINKED listing's local
 * state against what Etsy actually reports (read-only GET per listing; no
 * content is re-pushed). Clears stale local states — most importantly the
 * 'error' rows left by a transient failure (e.g. the 2026-07-08 missing-API-key
 * incident) that are actually fine drafts on Etsy — so they return to their
 * real state instead of being stuck un-syncable. A connection-level failure
 * (bad token) stops the run so the owner gets a clear "reconnect" message
 * rather than every item flapping. One call handles the whole catalog well
 * under the route's 60s budget.
 */
export async function checkAllListingStatuses(): Promise<CheckAllStatusResult> {
  const service = createServiceClient();
  const { data } = await service.from('etsy_listings').select('*').not('etsy_listing_id', 'is', null);
  const rows = (data ?? []) as EtsyListingRow[];
  if (rows.length === 0) return { checked: 0, updated: 0, reset: 0, errors: 0 };

  const { accessToken } = await ensureFreshAccessToken(service);
  let checked = 0;
  let updated = 0;
  let reset = 0;
  let errors = 0;

  for (const listing of rows) {
    if (!listing.etsy_listing_id) continue;
    try {
      const res = await etsyFetch<{ state: string }>({ path: `/v3/application/listings/${listing.etsy_listing_id}`, accessToken });
      checked += 1;
      const { changed } = await applyEtsyReconciliation(service, listing, res.data.state);
      if (changed) updated += 1;
    } catch (err) {
      if (err instanceof EtsyApiError && err.status === 404) {
        // Gone on Etsy (deleted there) — reset to not-listed, same as the per-item check.
        await upsertListing(service, listing.product_id, {
          etsy_listing_id: null,
          sync_state: 'pending',
          listing_state: null,
          taxonomy_id: null,
          content_hash: null,
          last_pushed_price: null,
          last_error: null,
          error_count: 0,
        });
        await insertSyncLog(service, { product_id: listing.product_id, listing_id: listing.etsy_listing_id, action: 'check_status', outcome: 'ok', message: 'No longer on Etsy — reset to not-listed.' });
        checked += 1;
        reset += 1;
      } else if (isConnectionLevelEtsyError(err)) {
        throw err; // connection issue affects every listing — stop and surface it
      } else {
        errors += 1;
      }
    }
  }

  return { checked, updated, reset, errors };
}

export async function runDelist(productId: string): Promise<SyncStepResult> {
  const service = createServiceClient();
  const listing = await getListing(service, productId);
  if (!listing?.etsy_listing_id) {
    return { done: true, syncState: 'delisted', warnings: ['This product was never synced to Etsy.'] };
  }
  const { accessToken, shopId } = await ensureFreshAccessToken(service);
  await setListingState({ shopId, listingId: listing.etsy_listing_id, accessToken, state: 'inactive' });
  const updated = await upsertListing(service, productId, {
    sync_state: 'delisted',
    listing_state: 'inactive',
    last_synced_at: new Date().toISOString(),
  });
  await insertSyncLog(service, { product_id: productId, listing_id: listing.etsy_listing_id, action: 'delist', outcome: 'ok' });
  return { done: true, syncState: updated.sync_state, listingId: listing.etsy_listing_id, listingUrl: listingUrlFor(listing.etsy_listing_id) };
}

export async function runReactivate(productId: string): Promise<SyncStepResult> {
  const service = createServiceClient();
  const listing = await getListing(service, productId);
  if (!listing?.etsy_listing_id) {
    throw new Error('This product has never been synced to Etsy — use "Sync to Etsy" instead.');
  }
  const connection = await getConnection(service);
  const { accessToken, shopId } = await ensureFreshAccessToken(service);
  const targetState = connection?.auto_activate ? 'active' : 'draft_review';
  if (targetState === 'active') {
    await setListingState({ shopId, listingId: listing.etsy_listing_id, accessToken, state: 'active' });
  }
  const updated = await upsertListing(service, productId, {
    sync_state: targetState,
    listing_state: targetState === 'active' ? 'active' : 'draft',
    last_synced_at: new Date().toISOString(),
  });
  await insertSyncLog(service, { product_id: productId, listing_id: listing.etsy_listing_id, action: 'relist', outcome: 'ok' });
  return { done: true, syncState: updated.sync_state, listingId: listing.etsy_listing_id, listingUrl: listingUrlFor(listing.etsy_listing_id) };
}

// ---------------------------------------------------------------------------
// Phase 2 — bulk queue (enqueue + drain) and content-hash-driven "out of date"
// detection. `etsy_listings.sync_state = 'pending'` rows ARE the queue.
// ---------------------------------------------------------------------------
export async function enqueueProducts(productIds: string[]): Promise<number> {
  const service = createServiceClient();
  let count = 0;
  for (const id of productIds) {
    const existing = await getListing(service, id);
    if (existing && !['error', 'unlinked'].includes(existing.sync_state) && existing.etsy_listing_id) continue;
    await upsertListing(service, id, { sync_state: 'pending' });
    count += 1;
  }
  return count;
}

export async function enqueueAllEligible(): Promise<number> {
  const service = createServiceClient();
  const connection = await getConnection(service);
  const spotData = await fetchSpotData();
  const { data } = await service.from('products').select('*').eq('status', 'available');
  const products = (data ?? []) as Product[];
  let count = 0;
  for (const product of products) {
    const existing = await getListing(service, product.id);
    const taxonomyOverride = existing?.taxonomy_override_id
      ? { id: existing.taxonomy_override_id, path: existing.taxonomy_override_path ?? '' }
      : null;
    const preflight = buildPreflightChecks(product, connection, spotData, taxonomyOverride);
    if (!isPreflightPassing(preflight)) continue;
    if (existing && (existing.sync_state === 'active' || existing.sync_state === 'draft_review')) continue;
    await upsertListing(service, product.id, { sync_state: 'pending' });
    count += 1;
  }
  return count;
}

export interface DrainResult {
  done: boolean;
  remaining: number;
  results: { productId: string; syncState: string }[];
}

const DRAIN_TIME_BUDGET_MS = 8000;

export interface DrainDeps {
  claimNext: () => Promise<string | null>;
  runStep: (productId: string) => Promise<SyncStepResult>;
  now: () => number;
  budgetMs: number;
}

export interface DrainCoreResult {
  results: { productId: string; syncState: string }[];
  /** true when the queue emptied (claimNext returned null); false when the time budget was hit first. */
  exhausted: boolean;
}

/**
 * Pure orchestration loop (unit-tested in __tests__/sync.test.ts with fake
 * deps). The cross-invocation atomicity guarantee — two concurrent drains
 * never claiming the same product — comes from the `FOR UPDATE SKIP LOCKED`
 * Postgres RPC this calls into (supabase/etsy-sync.sql), which requires the
 * live migration to exercise for real (owner checklist item).
 */
export async function drainQueueCore(deps: DrainDeps): Promise<DrainCoreResult> {
  const start = deps.now();
  const results: DrainCoreResult['results'] = [];
  const seen = new Set<string>();
  for (;;) {
    if (deps.now() - start > deps.budgetMs) return { results, exhausted: false };
    const productId = await deps.claimNext();
    if (!productId) return { results, exhausted: true };
    // Safety net (2026-07-08): if we re-claim an item we already processed this
    // pass, it isn't leaving the queue (it finished a step but stayed claimable
    // — e.g. a bug that leaves it 'pending'). Stop the pass instead of cycling
    // the same items forever and burning Etsy's rate budget. The client's own
    // stall guard then ends the poll loop. Root cause of the reported runaway
    // is fixed above (effectiveMode); this bounds the damage of any future one.
    if (seen.has(productId)) return { results, exhausted: false };
    seen.add(productId);
    const result = await deps.runStep(productId);
    results.push({ productId, syncState: result.syncState });
    // A product still mid-image-batch (done:false) stays claimable by design —
    // break so the rest of the queue drains before we come back to it.
    if (!result.done) break;
  }
  return { results, exhausted: false };
}

/**
 * A connection-level failure (bad/expired OAuth token, missing shop id) affects
 * EVERY item, not just this one — the batch should stop with a clear "reconnect
 * Etsy" message rather than march on marking the whole catalog errored. Every
 * other throw is this item's problem and is contained (see drainQueue).
 */
function isConnectionLevelEtsyError(err: unknown): boolean {
  if (err instanceof EtsyApiError) {
    return err.status === 401 || err.code === 'invalid_grant' || err.code === 'auth_expired' || err.code === 'oauth_token_failed';
  }
  const message = err instanceof Error ? err.message : '';
  return /reconnect|not connected|refresh token|shop id/i.test(message);
}

export async function drainQueue(): Promise<DrainResult> {
  const service = createServiceClient();
  const core = await drainQueueCore({
    claimNext: () => claimNextPendingListing(service),
    // runSyncStep catches its OWN step errors, but a throw from its pre-flight
    // setup (e.g. a token refresh) is uncaught and would otherwise fail the
    // whole drain with a 500 (confirmed 2026-07-08). Contain per-item throws
    // so one bad listing can't sink the batch; rethrow connection-level ones so
    // the batch stops with an actionable message instead of erroring everything.
    runStep: async (id) => {
      try {
        return await runSyncStep(id, 'publish');
      } catch (err) {
        if (isConnectionLevelEtsyError(err)) throw err;
        const message = err instanceof Error ? err.message : 'Sync step failed unexpectedly.';
        await upsertListing(service, id, { sync_state: 'error', last_error: message }).catch(() => {});
        await insertSyncLog(service, { product_id: id, action: 'sync_step', outcome: 'error', message }).catch(() => {});
        return { done: true, syncState: 'error', error: { code: 'sync_failed', message } };
      }
    },
    now: () => Date.now(),
    budgetMs: DRAIN_TIME_BUDGET_MS,
  });
  const remaining = await countPendingListings(service);
  return { done: core.exhausted && remaining === 0, remaining, results: core.results };
}

/** Marks active/draft_review listings whose mapped payload no longer matches the last pushed hash. */
export async function scanAndMarkOutOfDate(): Promise<number> {
  const service = createServiceClient();
  const connection = await getConnection(service);
  const spotData = await fetchSpotData();
  const { data } = await service.from('etsy_listings').select('*').in('sync_state', ['active', 'draft_review']);
  let count = 0;
  for (const row of (data ?? []) as EtsyListingRow[]) {
    const product = await fetchProduct(service, row.product_id);
    if (!product) continue;
    const taxonomyOverride = row.taxonomy_override_id ? { id: row.taxonomy_override_id, path: row.taxonomy_override_path ?? '' } : null;
    const payload = buildMappedPayload(product, connection, spotData, taxonomyOverride, row.extra_tags ?? null);
    if (computeContentHash(payload) !== row.content_hash) {
      await upsertListing(service, row.product_id, { sync_state: 'out_of_date' });
      count += 1;
    }
  }
  return count;
}

/**
 * Pure threshold decision for the scheduled price push (Q4: push only when
 * |delta| >= threshold%). Exported standalone for unit testing.
 */
export function shouldPushPrice(newPrice: number, lastPushedPrice: number | null, thresholdPct: number): boolean {
  if (lastPushedPrice == null || lastPushedPrice <= 0) return true;
  const changePct = (Math.abs(newPrice - lastPushedPrice) / lastPushedPrice) * 100;
  return changePct >= thresholdPct;
}

const LIVE_LISTING_STATES = ['draft_created', 'images_synced', 'inventory_synced', 'draft_review', 'active', 'out_of_date'];

/**
 * Phase 2 auto-delist/relist (etsy-sync-plan/03-sync-lifecycle.md Flow 3).
 * Called from the existing product-status/cache-revalidation chokepoints
 * (adminRevalidateProduct(s) in app/actions/admin-products.ts, PayPal
 * capture-order, and the PayPal webhook) rather than threading a new "who
 * changes product status" audit through the app. ALWAYS best-effort and
 * non-throwing — a delist/relist failure must never block the caller's real
 * operation (an order capture, an admin status change). No-ops entirely when
 * `auto_delist_on_sold` is off (Phase 1 default) or Etsy isn't connected.
 */
export async function handleProductStatusChange(productIds: string[]): Promise<void> {
  if (productIds.length === 0) return;
  try {
    const service = createServiceClient();
    const connection = await getConnection(service);
    if (!connection || !connection.auto_delist_on_sold || connection.status !== 'connected') return;

    for (const productId of productIds) {
      try {
        const listing = await getListing(service, productId);
        if (!listing?.etsy_listing_id) continue; // never synced to Etsy — nothing to do

        const { data: product } = await service.from('products').select('status').eq('id', productId).maybeSingle();
        if (!product) continue;
        const status = normalizeProductStatus(product.status);

        if (status !== 'available' && LIVE_LISTING_STATES.includes(listing.sync_state)) {
          await runDelist(productId);
        } else if (status === 'available' && listing.sync_state === 'delisted') {
          await runReactivate(productId);
        }
      } catch (err) {
        console.error(`Etsy auto-delist/relist failed for product ${productId}:`, err);
      }
    }
  } catch (err) {
    console.error('Etsy auto-delist/relist hook failed:', err);
  }
}

/** Phase 2 scheduled daily price push — see /api/admin/etsy/price-push (Netlify Scheduled Function target). */
export async function runScheduledPricePush(): Promise<{ pushed: number; skipped: number }> {
  const service = createServiceClient();
  // Opportunistic housekeeping (no cron dependency) — this route already runs daily.
  await pruneOldSyncLogs(service).catch(() => {});

  const connection = await getConnection(service);
  if (!connection || !connection.price_push_enabled || connection.status !== 'connected') return { pushed: 0, skipped: 0 };

  const spotData = await fetchSpotData();
  const { data } = await service.from('etsy_listings').select('*').in('sync_state', ['active', 'draft_review', 'out_of_date']);
  let pushed = 0;
  let skipped = 0;

  for (const row of (data ?? []) as EtsyListingRow[]) {
    const product = await fetchProduct(service, row.product_id);
    if (!product) {
      skipped += 1;
      continue;
    }
    const taxonomyOverride = row.taxonomy_override_id ? { id: row.taxonomy_override_id, path: row.taxonomy_override_path ?? '' } : null;
    const payload = buildMappedPayload(product, connection, spotData, taxonomyOverride, row.extra_tags ?? null);
    if (payload.price == null || !shouldPushPrice(payload.price, row.last_pushed_price, connection.price_push_threshold_pct)) {
      skipped += 1;
      continue;
    }
    try {
      await runSyncStep(row.product_id, 'price-only');
      pushed += 1;
    } catch {
      skipped += 1;
    }
  }

  return { pushed, skipped };
}

/** Live listings processed per "Push prices now" invocation — keeps each call well under any function timeout. */
const PRICE_PUSH_BATCH = 8;

/**
 * Manual "Push prices now" — re-sends the current computed price of every live
 * (active/draft_review) listing whose price differs from what was last sent to
 * Etsy, IGNORING the daily scheduled push's threshold (a markup change is a
 * deliberate, immediate re-price, not spot-drift noise the threshold exists to
 * suppress). Uses the lean price-only path (updateListingInventory only — no
 * image/property work), unlike a full "Sync Updates".
 *
 * Batched + resumable so it can't time out: the caller polls until `done`.
 * Idempotent — a listing already at the right price is skipped, so re-running
 * converges. A failure doesn't update last_pushed_price, so a persistently
 * failing item keeps `remaining` from reaching 0; the caller's stall guard
 * (identical repeated `remaining`) ends the loop instead of retrying forever.
 *
 * NOTE: this is the right tool after a markup change because the bulk "Sync
 * All to Etsy" (enqueueAllEligible) deliberately SKIPS already-active/
 * draft_review listings — it never re-prices what's already up.
 */
export async function pushPricesBatch(): Promise<{ done: boolean; pushed: number; failed: number; remaining: number }> {
  const service = createServiceClient();
  const connection = await getConnection(service);
  if (!connection || connection.status !== 'connected') return { done: true, pushed: 0, failed: 0, remaining: 0 };

  const spotData = await fetchSpotData();
  const { data } = await service.from('etsy_listings').select('*').in('sync_state', ['active', 'draft_review']);
  const rows = (data ?? []) as EtsyListingRow[];

  // Which live listings' current price differs from what we last sent Etsy?
  const needsPush: string[] = [];
  for (const row of rows) {
    if (!row.etsy_listing_id) continue;
    const product = await fetchProduct(service, row.product_id);
    if (!product) continue;
    const taxonomyOverride = row.taxonomy_override_id ? { id: row.taxonomy_override_id, path: row.taxonomy_override_path ?? '' } : null;
    const payload = buildMappedPayload(product, connection, spotData, taxonomyOverride, row.extra_tags ?? null);
    if (payload.price != null && payload.price !== row.last_pushed_price) needsPush.push(row.product_id);
  }

  let pushed = 0;
  let failed = 0;
  for (const productId of needsPush.slice(0, PRICE_PUSH_BATCH)) {
    try {
      const result = await runSyncStep(productId, 'price-only');
      if (result.syncState === 'error') failed += 1;
      else pushed += 1;
    } catch {
      failed += 1;
    }
  }

  const remaining = needsPush.length - pushed; // failed items stay "needs push"
  return { done: remaining === 0, pushed, failed, remaining };
}
