import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceClient } from '@/lib/supabase/service';
import { fetchSpotData } from '@/lib/spot-price';
import type { Product } from '@/types/product';
import { normalizeProductQuantity, normalizeProductStatus } from '@/types/product';
import { EbayApiError, ebayFetch } from './client';
import { ensureFreshAccessToken } from './auth';
import {
  buildMappedPayload,
  buildPreflightChecks,
  computeContentHash,
  computeEbayPrice,
  isPreflightPassing,
  type EbayConnectionDefaults,
  type MappedEbayPayload,
} from './mapping';
import {
  claimNextPendingListing,
  claimNextReviewListing,
  countPendingListings,
  countReviewListings,
  getConnection,
  getListing,
  insertSyncLog,
  upsertListing,
  type EbayConnectionRow,
  type EbayListingRow,
  type EbaySyncState,
} from './store';

// The step machine + queue drain + price push + status-change hook. Mirrors
// the SHAPE of next-app/src/lib/etsy/sync.ts (checkpointed steps, content-hash
// change detection, claim-RPC queue drain with a seen-guard and
// re-enqueue/update detection, price-push threshold, fire-and-forget product
// status hook) — copied, never imported, per BUILD-PROMPT.md hard rule 9.
// eBay needs far fewer calls per product (~3-4 vs Etsy's ~12, no images step,
// no draft state — see ebay-sync-plan/03-sync-lifecycle.md), so most
// publishes complete in a single runSyncStep() call; the resumable/bounded
// shape is kept anyway for crash-window safety and bulk-drain uniformity.

export type SyncMode = 'publish' | 'update' | 'price-only' | 'publish-live';

export interface SyncStepResult {
  done: boolean;
  syncState: EbaySyncState;
  progress?: { step: string };
  listingId?: string;
  listingUrl?: string;
  warnings?: string[];
  error?: { code: string; message: string };
}

function listingUrlFor(listingId: string): string {
  return `https://www.ebay.com/itm/${listingId}`;
}

function toConnectionDefaults(connection: EbayConnectionRow): EbayConnectionDefaults {
  return {
    fulfillment_policy_id: connection.fulfillment_policy_id,
    express_fulfillment_policy_id: connection.express_fulfillment_policy_id,
    high_value_shipping_threshold: connection.high_value_shipping_threshold,
    payment_policy_id: connection.payment_policy_id,
    return_policy_id: connection.return_policy_id,
    merchant_location_key: connection.merchant_location_key,
    price_markup_pct: connection.price_markup_pct,
    marketplace_id: connection.marketplace_id,
    selling_limit_amount: connection.selling_limit_amount,
    selling_limit_quantity: connection.selling_limit_quantity,
  };
}

async function loadProduct(service: SupabaseClient, productId: string): Promise<Product | null> {
  const { data } = await service.from('products').select('*').eq('id', productId).maybeSingle();
  return (data as Product | null) ?? null;
}

// ---------------------------------------------------------------------------
// Low-level eBay Sell Inventory API calls. See
// ebay-sync-plan/rest-endpoints-used.md. TODO(ebay-verify): request/response
// field names are pinned from well-established eBay Sell API conventions,
// not a live fetch (see next-app/src/lib/ebay/client.ts's header note) — spot
// check against the real contract before the first production sync.
// ---------------------------------------------------------------------------
async function putInventoryItem(accessToken: string, payload: MappedEbayPayload): Promise<void> {
  await ebayFetch({
    method: 'PUT',
    path: `/sell/inventory/v1/inventory_item/${encodeURIComponent(payload.sku)}`,
    accessToken,
    contentLanguage: true,
    json: {
      product: {
        title: payload.title,
        description: payload.description,
        aspects: payload.aspects,
        imageUrls: payload.images.map((image) => image.url),
      },
      condition: payload.conditionId,
      conditionDescription: payload.conditionDescription,
      availability: { shipToLocationAvailability: { quantity: payload.quantity } },
    },
  });
}

interface CreateOfferResponse {
  offerId: string;
}

function offerBody(payload: MappedEbayPayload) {
  return {
    sku: payload.sku,
    marketplaceId: payload.marketplaceId,
    format: 'FIXED_PRICE',
    listingDescription: payload.description,
    availableQuantity: payload.quantity,
    categoryId: payload.categoryId,
    listingPolicies: {
      fulfillmentPolicyId: payload.fulfillmentPolicyId,
      paymentPolicyId: payload.paymentPolicyId,
      returnPolicyId: payload.returnPolicyId,
    },
    pricingSummary: { price: { value: String(payload.price ?? 0), currency: 'USD' } },
    merchantLocationKey: payload.merchantLocationKey,
  };
}

async function createOffer(accessToken: string, payload: MappedEbayPayload): Promise<string> {
  const res = await ebayFetch<CreateOfferResponse>({
    method: 'POST',
    path: '/sell/inventory/v1/offer',
    accessToken,
    contentLanguage: true,
    json: offerBody(payload),
  });
  return res.data.offerId;
}

async function findExistingOfferId(accessToken: string, sku: string): Promise<string | null> {
  try {
    const res = await ebayFetch<{ offers?: Array<{ offerId: string }> }>({
      method: 'GET',
      path: '/sell/inventory/v1/offer',
      accessToken,
      query: { sku },
    });
    return res.data.offers?.[0]?.offerId ?? null;
  } catch {
    return null;
  }
}

async function updateOffer(accessToken: string, offerId: string, payload: MappedEbayPayload): Promise<void> {
  await ebayFetch({
    method: 'PUT',
    path: `/sell/inventory/v1/offer/${encodeURIComponent(offerId)}`,
    accessToken,
    contentLanguage: true,
    json: offerBody(payload),
  });
}

interface PublishOfferResponse {
  listingId: string;
  warnings?: Array<{ message?: string }>;
}

async function publishOfferCall(accessToken: string, offerId: string): Promise<{ listingId: string; warnings: string[] }> {
  const res = await ebayFetch<PublishOfferResponse>({
    method: 'POST',
    path: `/sell/inventory/v1/offer/${encodeURIComponent(offerId)}/publish`,
    accessToken,
  });
  return {
    listingId: res.data.listingId,
    warnings: (res.data.warnings ?? []).map((warning) => warning.message ?? '').filter(Boolean),
  };
}

async function withdrawOfferCall(accessToken: string, offerId: string): Promise<void> {
  await ebayFetch({ method: 'POST', path: `/sell/inventory/v1/offer/${encodeURIComponent(offerId)}/withdraw`, accessToken });
}

// Deletes an UNPUBLISHED offer outright (the prepared draft). Only valid for
// an unpublished offer — a live/published listing must be withdrawn first.
async function deleteOfferCall(accessToken: string, offerId: string): Promise<void> {
  await ebayFetch({ method: 'DELETE', path: `/sell/inventory/v1/offer/${encodeURIComponent(offerId)}`, accessToken });
}

interface GetOfferResponse {
  offerId: string;
  // Offer publication state: "PUBLISHED" | "UNPUBLISHED". Confirmed live
  // 2026-07-10: an ended-on-eBay listing returns status "UNPUBLISHED" with
  // listing.listingStatus "ENDED" — but listing.listingId is STILL present
  // (the old, now-dead id), which is exactly why the prior liveness check
  // (isPublished = Boolean(listingId)) wrongly reported it as live.
  status?: string;
  listing?: { listingId?: string; listingStatus?: string; soldQuantity?: number };
}

async function getOfferCall(accessToken: string, offerId: string): Promise<GetOfferResponse> {
  const res = await ebayFetch<GetOfferResponse>({
    method: 'GET',
    path: `/sell/inventory/v1/offer/${encodeURIComponent(offerId)}`,
    accessToken,
  });
  return res.data;
}

interface BulkPriceQuantityEntry {
  sku: string;
  quantity?: number;
  offerId?: string;
  price?: number;
}

// TODO(ebay-verify): batching shape (entries appear one-SKU-each, <=25/call
// per the plan's own flag at rest-endpoints-used.md) — this build sends one
// entry per call for isolation/simplicity; batch if verified safe.
async function bulkUpdatePriceQuantity(accessToken: string, entries: BulkPriceQuantityEntry[]): Promise<void> {
  if (!entries.length) return;
  const requests = entries.map((entry) => ({
    sku: entry.sku,
    ...(entry.quantity != null ? { shipToLocationAvailability: { quantity: entry.quantity } } : {}),
    ...(entry.offerId
      ? { offers: [{ offerId: entry.offerId, ...(entry.price != null ? { price: { value: String(entry.price), currency: 'USD' } } : {}) }] }
      : {}),
  }));
  await ebayFetch({ method: 'POST', path: '/sell/inventory/v1/bulk_update_price_quantity', accessToken, json: { requests } });
}

// ---------------------------------------------------------------------------
// Main step machine. See ebay-sync-plan/03-sync-lifecycle.md for the state
// diagram. Idempotent at every step (full-replace PUTs, checkpoint reads
// before each write) so a repeated call always converges.
// ---------------------------------------------------------------------------
export async function runSyncStep(productId: string, mode: SyncMode = 'publish'): Promise<SyncStepResult> {
  const service = createServiceClient();
  const listing = await getListing(service, productId);

  if (mode === 'publish-live') return publishLiveStep(service, productId, listing);
  if (mode === 'price-only') return priceOnlyStep(service, productId, listing);

  const product = await loadProduct(service, productId);
  if (!product) {
    return { done: true, syncState: 'error', error: { code: 'product_not_found', message: 'Product not found.' } };
  }

  const connectionRow = await getConnection(service);
  if (!connectionRow || connectionRow.status !== 'connected') {
    return {
      done: true,
      syncState: listing?.sync_state ?? 'pending',
      error: { code: 'not_connected', message: 'Connect eBay in Settings before syncing.' },
    };
  }
  const connection = toConnectionDefaults(connectionRow);
  const spotData = await fetchSpotData().catch(() => null);

  const checks = buildPreflightChecks(product, connection, spotData);
  if (!isPreflightPassing(checks)) {
    const failing = checks.find((check) => !check.ok);
    const message = failing?.message ?? 'Pre-flight failed.';
    await upsertListing(service, productId, {
      ebay_sku: listing?.ebay_sku ?? product.id,
      sync_state: 'error',
      last_error: message,
      error_count: (listing?.error_count ?? 0) + 1,
    });
    await insertSyncLog(service, { product_id: productId, action: 'preflight', outcome: 'error', message });
    return { done: true, syncState: 'error', error: { code: 'preflight_failed', message } };
  }

  // Runaway-prevention (required from day one — ebay-sync-plan/
  // 08-database-schema.md — unlike Etsy, where this was a later production
  // fix): a bulk enqueue resets an item to 'pending'. For an item that
  // already has an offer, a fresh-publish pass creates nothing new and
  // would just sit in 'pending' forever, so the drain loop would re-claim it
  // every pass without end. Treat it as an update instead. Also covers a
  // re-sync of an ENDED item (owner ended/deleted it on eBay, then re-syncs
  // to re-list) — its existing offer's content must be refreshed before it
  // can be re-published with current price/details.
  const effectiveMode: SyncMode =
    mode === 'publish' && listing?.ebay_offer_id != null && (listing.sync_state === 'pending' || listing.sync_state === 'ended')
      ? 'update'
      : mode;

  const payload = buildMappedPayload(product, connection, spotData);

  try {
    const { accessToken } = await ensureFreshAccessToken(service);

    // Step 1 — inventory item (full replace; idempotent, safe to repeat).
    await putInventoryItem(accessToken, payload);
    await upsertListing(service, productId, {
      ebay_sku: payload.sku,
      sync_state: listing?.ebay_offer_id ? listing.sync_state : 'item_synced',
      category_id: payload.categoryId,
    });

    // Step 2 — offer (create once; full-replace update thereafter).
    let offerId = listing?.ebay_offer_id ?? null;
    if (!offerId) {
      try {
        offerId = await createOffer(accessToken, payload);
      } catch (err) {
        // Crash-window adoption: a prior invocation may have created the
        // offer without persisting the id (eBay enforces one offer per
        // SKU+marketplace+format, so "already exists" is the only way this
        // create can fail for an otherwise-valid payload).
        const adopted = await findExistingOfferId(accessToken, payload.sku);
        if (!adopted) throw err;
        offerId = adopted;
      }
      await upsertListing(service, productId, { ebay_offer_id: offerId, sync_state: 'offer_created', category_id: payload.categoryId });
    } else if (effectiveMode === 'update') {
      await updateOffer(accessToken, offerId, payload);
    }

    // Step 3 — publish decision. A stale ebay_listing_id lingers on an ENDED
    // listing (eBay keeps returning the old id even after it's ended — see
    // checkListingStatus), so "already live" is keyed on sync_state, NOT just
    // the id's presence. Re-syncing an ended item must go through the
    // review/publish gate — never silently re-mark it published/live (reported
    // bug 2026-07-10: "Sync to eBay" showed an un-published item as LIVE).
    const isLiveOnEbay = listing?.ebay_listing_id != null && listing.sync_state !== 'ended';
    if (!isLiveOnEbay) {
      if (connectionRow.auto_publish) {
        const published = await publishOfferCall(accessToken, offerId!);
        const hash = computeContentHash(payload);
        await upsertListing(service, productId, {
          sync_state: 'published',
          ebay_listing_id: published.listingId,
          content_hash: hash,
          last_pushed_price: payload.price,
          last_pushed_qty: payload.quantity,
          last_error: null,
          error_count: 0,
        });
        await insertSyncLog(service, { product_id: productId, listing_id: published.listingId, action: 'publish', outcome: 'ok' });
        return {
          done: true,
          syncState: 'published',
          listingId: published.listingId,
          listingUrl: listingUrlFor(published.listingId),
          warnings: published.warnings,
        };
      }

      // Q1: review-first default — stop here. Publish is a distinct,
      // deliberately-clicked action (mode: 'publish-live') since eBay has no
      // draft state — an unpublished offer is invisible in Seller Hub, so
      // this preview IS the review surface. Clear any stale ebay_listing_id
      // (an ended item carries the old, dead id): a review item has no live
      // listing, and leaving it set would make publishLiveStep short-circuit
      // as "already published" and never actually re-publish.
      await upsertListing(service, productId, { sync_state: 'review', ebay_listing_id: null, last_error: null, error_count: 0 });
      await insertSyncLog(service, { product_id: productId, action: 'offer_ready', outcome: 'ok' });
      return {
        done: true,
        syncState: 'review',
        warnings: ['Ready to publish — review the preview, then click Publish on eBay (goes live immediately).'],
      };
    }

    // Already published — this is an update pass. isLiveOnEbay (true in this
    // branch) guarantees a live listing id.
    const liveListingId = listing!.ebay_listing_id!;
    const hash = computeContentHash(payload);
    const nextState: EbaySyncState = listing!.sync_state === 'hidden_oos' ? 'hidden_oos' : 'published';
    await upsertListing(service, productId, {
      sync_state: nextState,
      content_hash: hash,
      last_pushed_price: payload.price,
      last_pushed_qty: nextState === 'hidden_oos' ? 0 : payload.quantity,
      last_error: null,
      error_count: 0,
    });
    await insertSyncLog(service, { product_id: productId, listing_id: liveListingId, action: 'update', outcome: 'ok' });
    return {
      done: true,
      syncState: nextState,
      listingId: liveListingId,
      listingUrl: listingUrlFor(liveListingId),
    };
  } catch (err) {
    return handleSyncError(service, productId, listing, err, 'sync');
  }
}

async function handleSyncError(
  service: SupabaseClient,
  productId: string,
  listing: EbayListingRow | null,
  err: unknown,
  action: string,
): Promise<SyncStepResult> {
  const isConnectionLevel = err instanceof EbayApiError && (err.code === 'auth_expired' || err.code === 'missing_scope');
  const message = err instanceof EbayApiError ? err.operatorMessage : err instanceof Error ? err.message : 'Unknown error.';
  const code = err instanceof EbayApiError ? err.code : 'unknown';

  if (isConnectionLevel) {
    // Connection-level failures are not this product's fault — leave its
    // sync_state untouched so it doesn't need to be re-triggered once
    // reconnected.
    await insertSyncLog(service, { product_id: productId, action, outcome: 'error', message });
    return { done: true, syncState: listing?.sync_state ?? 'pending', error: { code, message } };
  }

  // ebay_sku is NOT NULL — on a first-ever sync attempt there's no existing
  // row yet, so this upsert is really an INSERT and must supply it (falls
  // back to productId, same convention as the preflight-failure branch
  // above and enqueueProducts()) or the error-logging write itself throws
  // and masks the real failure that got us here.
  await upsertListing(service, productId, {
    ebay_sku: listing?.ebay_sku ?? productId,
    sync_state: 'error',
    last_error: message,
    error_count: (listing?.error_count ?? 0) + 1,
  });
  await insertSyncLog(service, {
    product_id: productId,
    action,
    outcome: 'error',
    message,
    detail: err instanceof EbayApiError ? { code: err.code, status: err.status, errorId: err.errorId } : undefined,
  });
  return { done: true, syncState: 'error', error: { code, message } };
}

async function publishLiveStep(
  service: SupabaseClient,
  productId: string,
  listing: EbayListingRow | null,
): Promise<SyncStepResult> {
  if (!listing?.ebay_offer_id) {
    return {
      done: true,
      syncState: listing?.sync_state ?? 'pending',
      error: { code: 'no_offer', message: 'Sync this item first to prepare an offer before publishing.' },
    };
  }
  if (listing.ebay_listing_id) {
    return { done: true, syncState: listing.sync_state, listingId: listing.ebay_listing_id, listingUrl: listingUrlFor(listing.ebay_listing_id) };
  }
  try {
    const { accessToken } = await ensureFreshAccessToken(service);
    const published = await publishOfferCall(accessToken, listing.ebay_offer_id);

    // Record a content_hash/last_pushed_* baseline at publish time — the
    // review step (runSyncStep's Q1 branch) never sets one, so without this
    // scanAndMarkOutOfDate spuriously flags a freshly-published item
    // 'out_of_date' the moment it next runs (confirmed live 2026-07-10: the
    // review→Publish Now path is this shop's only publish path since
    // auto_publish is off, and produced exactly this — content_hash null on
    // an otherwise-fine 'published' row). Best-effort: the publish itself
    // must still succeed even if this lookup fails.
    let contentPatch: Partial<Pick<EbayListingRow, 'content_hash' | 'last_pushed_price' | 'last_pushed_qty'>> = {};
    const product = await loadProduct(service, productId).catch(() => null);
    const connectionRow = product ? await getConnection(service).catch(() => null) : null;
    if (product && connectionRow) {
      const connection = toConnectionDefaults(connectionRow);
      const spotData = await fetchSpotData().catch(() => null);
      const payload = buildMappedPayload(product, connection, spotData);
      contentPatch = {
        content_hash: computeContentHash(payload),
        last_pushed_price: payload.price,
        last_pushed_qty: payload.quantity,
      };
    }

    await upsertListing(service, productId, {
      sync_state: 'published',
      ebay_listing_id: published.listingId,
      last_error: null,
      error_count: 0,
      ...contentPatch,
    });
    await insertSyncLog(service, { product_id: productId, listing_id: published.listingId, action: 'publish', outcome: 'ok' });
    return {
      done: true,
      syncState: 'published',
      listingId: published.listingId,
      listingUrl: listingUrlFor(published.listingId),
      warnings: published.warnings,
    };
  } catch (err) {
    return handleSyncError(service, productId, listing, err, 'publish');
  }
}

async function priceOnlyStep(
  service: SupabaseClient,
  productId: string,
  listing: EbayListingRow | null,
): Promise<SyncStepResult> {
  if (!listing?.ebay_offer_id) {
    return {
      done: true,
      syncState: listing?.sync_state ?? 'pending',
      error: { code: 'no_offer', message: 'This item has no eBay offer yet.' },
    };
  }
  const product = await loadProduct(service, productId);
  const connectionRow = await getConnection(service);
  if (!product || !connectionRow || connectionRow.status !== 'connected') {
    return { done: true, syncState: listing.sync_state, error: { code: 'not_connected', message: 'eBay is not connected.' } };
  }
  const connection = toConnectionDefaults(connectionRow);
  const spotData = await fetchSpotData().catch(() => null);
  const priceResult = computeEbayPrice(product, spotData, connection.price_markup_pct);
  if (priceResult.price == null) {
    return {
      done: true,
      syncState: listing.sync_state,
      error: { code: 'price_unavailable', message: priceResult.rejectedReason ?? 'No computable price.' },
    };
  }
  try {
    const { accessToken } = await ensureFreshAccessToken(service);
    await bulkUpdatePriceQuantity(accessToken, [{ sku: listing.ebay_sku, offerId: listing.ebay_offer_id, price: priceResult.price }]);
    await upsertListing(service, productId, { last_pushed_price: priceResult.price });
    await insertSyncLog(service, {
      product_id: productId,
      listing_id: listing.ebay_listing_id,
      action: 'price_push',
      outcome: 'ok',
      detail: { price: priceResult.price },
    });
    return { done: true, syncState: listing.sync_state, listingId: listing.ebay_listing_id ?? undefined };
  } catch (err) {
    return handleSyncError(service, productId, listing, err, 'price_push');
  }
}

// ---------------------------------------------------------------------------
// Manual delist verbs (Q7): hide (quantity-zero, Out-of-Stock Control),
// withdraw (archived/deleted), restore.
// ---------------------------------------------------------------------------
async function withdrawListing(
  service: SupabaseClient,
  listing: EbayListingRow,
  productId: string,
): Promise<void> {
  const { accessToken } = await ensureFreshAccessToken(service);
  if (listing.ebay_offer_id) await withdrawOfferCall(accessToken, listing.ebay_offer_id);
  await upsertListing(service, productId, { sync_state: 'ended' });
  await insertSyncLog(service, { product_id: productId, listing_id: listing.ebay_listing_id, action: 'withdraw', outcome: 'ok' });
}

async function hideListingQuantityZero(
  service: SupabaseClient,
  listing: EbayListingRow,
  productId: string,
): Promise<void> {
  const { accessToken } = await ensureFreshAccessToken(service);
  await bulkUpdatePriceQuantity(accessToken, [{ sku: listing.ebay_sku, quantity: 0, offerId: listing.ebay_offer_id ?? undefined }]);
  await upsertListing(service, productId, { sync_state: 'hidden_oos', last_pushed_qty: 0 });
  await insertSyncLog(service, { product_id: productId, listing_id: listing.ebay_listing_id, action: 'hide_oos', outcome: 'ok' });
}

async function restoreListingQuantity(
  service: SupabaseClient,
  listing: EbayListingRow,
  productId: string,
  quantity: number | string | null,
): Promise<void> {
  const { accessToken } = await ensureFreshAccessToken(service);
  const qty = normalizeProductQuantity(quantity);
  await bulkUpdatePriceQuantity(accessToken, [{ sku: listing.ebay_sku, quantity: qty, offerId: listing.ebay_offer_id ?? undefined }]);
  await upsertListing(service, productId, { sync_state: 'published', last_pushed_qty: qty });
  await insertSyncLog(service, { product_id: productId, listing_id: listing.ebay_listing_id, action: 'restore', outcome: 'ok' });
}

export async function runDelist(productId: string, action: 'hide' | 'withdraw' | 'restore'): Promise<SyncStepResult> {
  const service = createServiceClient();
  const connectionRow = await getConnection(service);
  const listing = await getListing(service, productId);
  if (!connectionRow || connectionRow.status !== 'connected') {
    return { done: true, syncState: listing?.sync_state ?? 'pending', error: { code: 'not_connected', message: 'eBay is not connected.' } };
  }
  if (!listing?.ebay_listing_id) {
    return {
      done: true,
      syncState: listing?.sync_state ?? 'pending',
      error: { code: 'not_published', message: 'This item has never been published to eBay.' },
    };
  }
  try {
    if (action === 'withdraw') {
      await withdrawListing(service, listing, productId);
      return { done: true, syncState: 'ended' };
    }
    if (action === 'hide') {
      await hideListingQuantityZero(service, listing, productId);
      return { done: true, syncState: 'hidden_oos' };
    }
    const { data: productRow } = await service.from('products').select('quantity').eq('id', productId).maybeSingle();
    await restoreListingQuantity(service, listing, productId, productRow?.quantity ?? 1);
    return { done: true, syncState: 'published' };
  } catch (err) {
    return handleSyncError(service, productId, listing, err, `delist_${action}`);
  }
}

// "Un-stage": fully discard a PREPARED-but-not-live offer (a 'review' item, or
// an 'ended' item whose unpublished offer still lingers) — delete the offer on
// eBay and reset the row to not-listed, so it drops out of the review/publish
// queue and shows "Not listed" again. A live listing is refused (must be
// ended/hidden first). Idempotent: a 404 on delete (offer already gone) still
// resets the local state.
export async function runUnstage(productId: string): Promise<SyncStepResult> {
  const service = createServiceClient();
  const connectionRow = await getConnection(service);
  const listing = await getListing(service, productId);
  if (!connectionRow || connectionRow.status !== 'connected') {
    return { done: true, syncState: listing?.sync_state ?? 'pending', error: { code: 'not_connected', message: 'eBay is not connected.' } };
  }
  if (!listing?.ebay_offer_id) {
    // Nothing staged — already not listed on eBay.
    return { done: true, syncState: 'pending' };
  }
  if (listing.ebay_listing_id != null && ['published', 'out_of_date', 'hidden_oos'].includes(listing.sync_state)) {
    return {
      done: true,
      syncState: listing.sync_state,
      error: { code: 'is_live', message: 'This item is live on eBay — end the listing first, then un-stage it.' },
    };
  }
  try {
    const { accessToken } = await ensureFreshAccessToken(service);
    try {
      await deleteOfferCall(accessToken, listing.ebay_offer_id);
    } catch (err) {
      // 404 = the offer is already gone on eBay; still reset local state.
      if (!(err instanceof EbayApiError && err.status === 404)) throw err;
    }
    await upsertListing(service, productId, {
      sync_state: 'pending',
      ebay_offer_id: null,
      ebay_listing_id: null,
      content_hash: null,
      last_pushed_price: null,
      last_pushed_qty: null,
      last_error: null,
      error_count: 0,
    });
    await insertSyncLog(service, { product_id: productId, action: 'unstage', outcome: 'ok', message: 'Discarded the prepared eBay offer — reset to not-listed.' });
    return { done: true, syncState: 'pending' };
  } catch (err) {
    return handleSyncError(service, productId, listing, err, 'unstage');
  }
}

// ---------------------------------------------------------------------------
// Reconciliation — read-only calls that pull local state back in line with
// what eBay actually shows, for out-of-band changes (manual Seller Hub edits,
// a listing eBay auto-ended, etc.).
// ---------------------------------------------------------------------------
export interface CheckListingStatusResult {
  found: boolean;
  syncState: EbaySyncState;
  message: string;
}

/**
 * PURE: given our current sync_state and what eBay's GetOffer actually
 * reports, the reconciled sync_state + whether the listing is live. The
 * authoritative "is it live" signal is `listing.listingStatus`, NOT the mere
 * presence of a listingId — eBay keeps returning the old listingId on an
 * ENDED offer (confirmed live 2026-07-10, the reported bug: a listing the
 * owner deleted on eBay kept showing "Confirmed live" because the prior check
 * treated any listingId as proof of publication). Mirrors the Etsy
 * reconcileSyncStateFromEtsy discipline: map eBay's real state, never guess.
 */
export function reconcileEbayStateFromOffer(
  current: EbaySyncState,
  offerStatus: string | undefined,
  listingStatus: string | undefined,
): { syncState: EbaySyncState; live: boolean } {
  const ls = (listingStatus ?? '').toUpperCase();
  const os = (offerStatus ?? '').toUpperCase();

  if (ls === 'ENDED') return { syncState: 'ended', live: false };
  if (ls === 'OUT_OF_STOCK') return { syncState: 'hidden_oos', live: false };
  // Genuinely live: eBay shows an ACTIVE listing (or a PUBLISHED offer with no
  // finer listing status). Preserve a local hidden_oos (quantity-zeroed via
  // Out-of-Stock control but still an active listing on eBay's side).
  if (ls === 'ACTIVE' || (os === 'PUBLISHED' && ls === '')) {
    return { syncState: current === 'hidden_oos' ? 'hidden_oos' : 'published', live: true };
  }
  // Offer exists but is UNPUBLISHED with no active/ended listing. If we thought
  // it was live, eBay ended it out of band → 'ended'; if it was never
  // published, it's a prepared offer awaiting publish → 'review'.
  if (['published', 'out_of_date', 'hidden_oos'].includes(current)) return { syncState: 'ended', live: false };
  return { syncState: 'review', live: false };
}

export async function checkListingStatus(productId: string): Promise<CheckListingStatusResult> {
  const service = createServiceClient();
  const listing = await getListing(service, productId);
  if (!listing?.ebay_offer_id) {
    return { found: false, syncState: listing?.sync_state ?? 'pending', message: 'No linked eBay offer yet.' };
  }
  try {
    const { accessToken } = await ensureFreshAccessToken(service);
    const offer = await getOfferCall(accessToken, listing.ebay_offer_id);
    const { syncState, live } = reconcileEbayStateFromOffer(listing.sync_state, offer.status, offer.listing?.listingStatus);
    // Only trust eBay's listingId, never our stale stored one.
    const remoteListingId = offer.listing?.listingId ?? listing.ebay_listing_id;
    await upsertListing(service, productId, {
      sync_state: syncState,
      ebay_listing_id: remoteListingId,
      last_error: null,
    });
    await insertSyncLog(service, { product_id: productId, listing_id: remoteListingId, action: 'verify', outcome: 'ok' });
    const message = live
      ? 'Confirmed live on eBay.'
      : syncState === 'ended'
        ? 'This listing has ended on eBay (ended or removed there) — marked as ended here.'
        : syncState === 'hidden_oos'
          ? 'This listing is out of stock / hidden on eBay.'
          : 'Offer exists but is not published yet.';
    return { found: true, syncState, message };
  } catch (err) {
    // The whole OFFER is gone (deleted on eBay), not just the listing — reset
    // to not-listed so a fresh "Sync to eBay" re-creates it, mirroring the
    // Etsy 404 path. A non-404 error leaves state untouched (transient).
    if (err instanceof EbayApiError && err.status === 404) {
      await upsertListing(service, productId, {
        sync_state: 'pending',
        ebay_offer_id: null,
        ebay_listing_id: null,
        content_hash: null,
        last_error: null,
        error_count: 0,
      });
      await insertSyncLog(service, { product_id: productId, action: 'verify', outcome: 'ok', message: 'Offer no longer exists on eBay — reset to not-listed.' });
      return { found: false, syncState: 'pending', message: 'This offer no longer exists on eBay — reset to not-listed. You can sync it fresh.' };
    }
    const message = err instanceof EbayApiError ? err.operatorMessage : err instanceof Error ? err.message : 'Could not verify.';
    return { found: false, syncState: listing.sync_state, message };
  }
}

export interface CheckAllStatusResult {
  checked: number;
  updated: number;
  reset: number;
  errors: number;
}

export async function checkAllListingStatuses(): Promise<CheckAllStatusResult> {
  const service = createServiceClient();
  const { data } = await service.from('ebay_listings').select('product_id, sync_state').not('ebay_offer_id', 'is', null);
  const rows = (data ?? []) as Array<{ product_id: string; sync_state: EbaySyncState }>;
  let updated = 0;
  let reset = 0;
  let errors = 0;
  for (const row of rows) {
    try {
      const result = await checkListingStatus(row.product_id);
      if (row.sync_state !== result.syncState) updated += 1;
      if (row.sync_state === 'error' && result.syncState !== 'error') reset += 1;
    } catch {
      errors += 1;
    }
  }
  return { checked: rows.length, updated, reset, errors };
}

// ---------------------------------------------------------------------------
// Phase 2 — bulk queue + drain.
// ---------------------------------------------------------------------------
export async function enqueueProducts(productIds: string[]): Promise<number> {
  const service = createServiceClient();
  let count = 0;
  for (const productId of productIds) {
    // Re-enqueuing an already-listed item as 'pending' is safe: runSyncStep's
    // effectiveMode reinterpretation treats it as an update, never a
    // re-publish, so it can never spin forever in the drain loop.
    await upsertListing(service, productId, { sync_state: 'pending', ebay_sku: productId });
    count += 1;
  }
  return count;
}

export async function enqueueAllEligible(): Promise<number> {
  const service = createServiceClient();
  const { data: products } = await service.from('products').select('*').eq('status', 'available');
  const connectionRow = await getConnection(service);
  const connection = connectionRow ? toConnectionDefaults(connectionRow) : null;
  const spotData = await fetchSpotData().catch(() => null);

  const eligibleIds: string[] = [];
  for (const product of (products ?? []) as Product[]) {
    const checks = buildPreflightChecks(product, connection, spotData);
    if (isPreflightPassing(checks)) eligibleIds.push(product.id);
  }
  return enqueueProducts(eligibleIds);
}

export interface DrainDeps {
  claimNext: () => Promise<string | null>;
  runStep: (productId: string) => Promise<SyncStepResult>;
  now: () => number;
  budgetMs: number;
}

export interface DrainCoreResult {
  results: Array<{ productId: string; syncState: EbaySyncState }>;
  exhausted: boolean;
}

// Pure orchestration loop — unit-tested with fake deps. Ports the Etsy
// build's production runaway-fix intent (a seen-guard so a re-claimed item
// can't cycle a drain pass forever) as a day-one requirement.
export async function drainQueueCore(deps: DrainDeps): Promise<DrainCoreResult> {
  const start = deps.now();
  const results: DrainCoreResult['results'] = [];
  const seen = new Set<string>();
  for (;;) {
    if (deps.now() - start > deps.budgetMs) return { results, exhausted: false };
    const productId = await deps.claimNext();
    if (!productId) return { results, exhausted: true };
    if (seen.has(productId)) return { results, exhausted: false };
    seen.add(productId);
    const result = await deps.runStep(productId);
    results.push({ productId, syncState: result.syncState });
    if (!result.done) break;
  }
  return { results, exhausted: false };
}

const DRAIN_TIME_BUDGET_MS = 8000;

export interface DrainResult {
  done: boolean;
  remaining: number;
  results: DrainCoreResult['results'];
}

export async function drainQueue(): Promise<DrainResult> {
  const service = createServiceClient();
  const core = await drainQueueCore({
    claimNext: () => claimNextPendingListing(service),
    runStep: (productId) => runSyncStep(productId, 'publish'),
    now: () => Date.now(),
    budgetMs: DRAIN_TIME_BUDGET_MS,
  });
  const remaining = await countPendingListings(service);
  return { done: core.exhausted && remaining === 0, remaining, results: core.results };
}

// Bulk-publish drain — publishes every already-prepared 'review' listing
// live, in the same time-budgeted, resumable, seen-guarded shape as
// drainQueue (reuses drainQueueCore). Distinct from drainQueue because
// publishing is a deliberate go-live action (Q1), never folded into sync.
export async function drainPublishQueue(): Promise<DrainResult> {
  const service = createServiceClient();
  const core = await drainQueueCore({
    claimNext: () => claimNextReviewListing(service),
    runStep: (productId) => runSyncStep(productId, 'publish-live'),
    now: () => Date.now(),
    budgetMs: DRAIN_TIME_BUDGET_MS,
  });
  const remaining = await countReviewListings(service);
  return { done: core.exhausted && remaining === 0, remaining, results: core.results };
}

// ---------------------------------------------------------------------------
// Content-hash change detection — no eBay reads needed.
//
// Mirrors the Etsy fix (lib/etsy/sync.ts scanAndMarkOutOfDate): this was
// fully built and unit-tested but never actually CALLED from anywhere, so a
// price edit on an already-published listing was never detected — confirmed
// live 2026-07-10 via the identical Etsy bug report. Wired into the same
// adminRevalidateProduct/adminRevalidateProducts chokepoint as the Etsy
// version (see admin-products.ts). Pass `productIds` to check just those
// products (the intended per-save call shape) instead of the full catalog.
// ---------------------------------------------------------------------------
export async function scanAndMarkOutOfDate(productIds?: string[]): Promise<number> {
  const service = createServiceClient();
  const connectionRow = await getConnection(service);
  if (!connectionRow) return 0;
  const connection = toConnectionDefaults(connectionRow);
  const spotData = await fetchSpotData().catch(() => null);

  let query = service.from('ebay_listings').select('*').in('sync_state', ['published', 'hidden_oos']);
  if (productIds) query = query.in('product_id', productIds);
  const { data: listings } = await query;
  let flagged = 0;
  for (const listing of (listings ?? []) as EbayListingRow[]) {
    const product = await loadProduct(service, listing.product_id);
    if (!product) continue;
    const payload = buildMappedPayload(product, connection, spotData);
    const hash = computeContentHash(payload);
    if (hash !== listing.content_hash) {
      await upsertListing(service, listing.product_id, { sync_state: 'out_of_date' });
      flagged += 1;
    }
  }
  return flagged;
}

// ---------------------------------------------------------------------------
// Price-push threshold (Q3) — pure, exported standalone for unit testing.
// ---------------------------------------------------------------------------
export function shouldPushPrice(newPrice: number, lastPushedPrice: number | null, thresholdPct: number): boolean {
  if (lastPushedPrice == null || lastPushedPrice <= 0) return true;
  const changePct = (Math.abs(newPrice - lastPushedPrice) / lastPushedPrice) * 100;
  return changePct >= thresholdPct;
}

export async function runScheduledPricePush(): Promise<{ pushed: number; skipped: number }> {
  const service = createServiceClient();
  const connectionRow = await getConnection(service);
  if (!connectionRow || connectionRow.status !== 'connected' || !connectionRow.price_push_enabled) {
    return { pushed: 0, skipped: 0 };
  }
  const connection = toConnectionDefaults(connectionRow);
  const spotData = await fetchSpotData().catch(() => null);
  const { data: listings } = await service.from('ebay_listings').select('*').in('sync_state', ['published', 'out_of_date']);

  let pushed = 0;
  let skipped = 0;
  const { accessToken } = await ensureFreshAccessToken(service);
  for (const listing of (listings ?? []) as EbayListingRow[]) {
    const product = await loadProduct(service, listing.product_id);
    if (!product) continue;
    const priceResult = computeEbayPrice(product, spotData, connection.price_markup_pct);
    if (priceResult.price == null || !shouldPushPrice(priceResult.price, listing.last_pushed_price, connectionRow.price_push_threshold_pct)) {
      skipped += 1;
      continue;
    }
    try {
      await bulkUpdatePriceQuantity(accessToken, [{ sku: listing.ebay_sku, offerId: listing.ebay_offer_id ?? undefined, price: priceResult.price }]);
      await upsertListing(service, listing.product_id, { last_pushed_price: priceResult.price });
      await insertSyncLog(service, {
        product_id: listing.product_id,
        listing_id: listing.ebay_listing_id,
        action: 'price_push',
        outcome: 'ok',
        detail: { price: priceResult.price },
      });
      pushed += 1;
    } catch (err) {
      skipped += 1;
      const message = err instanceof EbayApiError ? err.operatorMessage : 'Price push failed.';
      await insertSyncLog(service, { product_id: listing.product_id, action: 'price_push', outcome: 'error', message });
    }
  }
  return { pushed, skipped };
}

// Manual "Push prices to eBay now" — one bounded batch, client polls until done.
export async function pushPricesBatch(): Promise<{ done: boolean; pushed: number; failed: number; remaining: number }> {
  const service = createServiceClient();
  const connectionRow = await getConnection(service);
  if (!connectionRow || connectionRow.status !== 'connected') return { done: true, pushed: 0, failed: 0, remaining: 0 };
  const connection = toConnectionDefaults(connectionRow);
  const spotData = await fetchSpotData().catch(() => null);

  const { data: listings } = await service
    .from('ebay_listings')
    .select('*')
    .in('sync_state', ['published', 'out_of_date'])
    .limit(25);
  const { count: totalRemaining } = await service
    .from('ebay_listings')
    .select('product_id', { count: 'exact', head: true })
    .in('sync_state', ['published', 'out_of_date']);

  let pushed = 0;
  let failed = 0;
  if (listings?.length) {
    const { accessToken } = await ensureFreshAccessToken(service);
    for (const listing of listings as EbayListingRow[]) {
      const product = await loadProduct(service, listing.product_id);
      if (!product) continue;
      const priceResult = computeEbayPrice(product, spotData, connection.price_markup_pct);
      if (priceResult.price == null) continue;
      try {
        await bulkUpdatePriceQuantity(accessToken, [{ sku: listing.ebay_sku, offerId: listing.ebay_offer_id ?? undefined, price: priceResult.price }]);
        await upsertListing(service, listing.product_id, { last_pushed_price: priceResult.price });
        pushed += 1;
      } catch {
        failed += 1;
      }
    }
  }
  const remaining = Math.max(0, (totalRemaining ?? 0) - (listings?.length ?? 0));
  return { done: remaining === 0, pushed, failed, remaining };
}

// ---------------------------------------------------------------------------
// Phase 2 — auto hide/withdraw on product-status change (Q7). Fire-and-forget
// and never throws, exactly like Etsy's handleProductStatusChange — a
// marketplace hiccup must never block the caller's cache revalidation. Only
// acts on products that already have a live/hidden eBay listing.
// ---------------------------------------------------------------------------
export async function handleProductStatusChange(productIds: string[]): Promise<void> {
  try {
    const service = createServiceClient();
    const connectionRow = await getConnection(service);
    if (!connectionRow || connectionRow.status !== 'connected') return;

    for (const productId of productIds) {
      try {
        const listing = await getListing(service, productId);
        if (!listing?.ebay_listing_id) continue;

        const { data: productRow } = await service.from('products').select('status, quantity').eq('id', productId).maybeSingle();
        if (!productRow) continue;
        const status = normalizeProductStatus(productRow.status);
        const quantity = normalizeProductQuantity(productRow.quantity);
        const isSoldOut = status === 'sold' || quantity <= 0;

        if (status === 'archived' || status === 'draft') {
          if (listing.sync_state !== 'ended') await withdrawListing(service, listing, productId);
        } else if (isSoldOut) {
          if (listing.sync_state === 'published' || listing.sync_state === 'out_of_date') {
            if (connectionRow.sold_handling === 'withdraw') {
              await withdrawListing(service, listing, productId);
            } else {
              await hideListingQuantityZero(service, listing, productId);
            }
          }
        } else if (status === 'available' && quantity > 0 && listing.sync_state === 'hidden_oos') {
          await restoreListingQuantity(service, listing, productId, productRow.quantity);
        }
      } catch (err) {
        const service2 = createServiceClient();
        await insertSyncLog(service2, {
          product_id: productId,
          action: 'status_change_hook',
          outcome: 'error',
          message: err instanceof Error ? err.message : 'Unknown error.',
        });
      }
    }
  } catch {
    // Never throw — fire-and-forget contract.
  }
}
