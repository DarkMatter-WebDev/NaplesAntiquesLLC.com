import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceClient } from '@/lib/supabase/service';
import { fetchSpotData } from '@/lib/spot-price';
import { getMarketplaceShippingProfileMap } from '@/lib/marketplace-shipping';
import type { Product, SpotData } from '@/types/product';
import { normalizeProductQuantity, normalizeProductStatus } from '@/types/product';
import { EbayApiError, ebayFetch, ebayTradingGetItemStatus, type EbayTradingItemStatus } from './client';
import { EBAY_BULK_ENQUEUE_LIMIT } from './guards';
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
  pruneOldSyncLogs,
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

export const RELISTED_LISTING_WARNING =
  'This item is live through an eBay relist that is no longer attached to the app-managed offer. Manage it on eBay until it is reattached.';

/**
 * Hard, data-independent write block. The detached-relist guard below infers
 * its block from `last_error` still holding RELISTED_LISTING_WARNING — which is
 * true today but evaporates the moment anything overwrites that column (a
 * different error, a manual clear, a partial sync). For a listing the owner has
 * deliberately quarantined, that is too fragile, so the product id is pinned
 * here as well. Both checks must pass before any eBay write.
 *
 * Inventory #82 / eBay listing 800354878200: live through an external relist
 * that is not attached to stored offer 204558136011. Writing to it could end or
 * duplicate the live listing. Remove this entry ONLY after the owner-approved
 * reattachment (or end-and-republish) is tested — see project-docs/TASKS.md.
 */
export const EBAY_WRITE_BLOCKED_PRODUCT_IDS: ReadonlySet<string> = new Set([
  'antique-georgian-sterling-silver-handled-mug-london-1824-edward-farrell-82',
]);

export const EBAY_WRITE_BLOCKED_WARNING =
  'This listing is write-blocked pending an owner-approved reattachment on eBay. Manage it on eBay until the block is lifted.';

function isDetachedRelistedListing(listing: EbayListingRow | null): boolean {
  return listing?.last_error === RELISTED_LISTING_WARNING;
}

/**
 * The single question every eBay write path must ask. Pinned block first so it
 * holds even when listing state is missing or `last_error` has been rewritten.
 */
export function isEbayWriteBlocked(productId: string, listing: EbayListingRow | null): boolean {
  return EBAY_WRITE_BLOCKED_PRODUCT_IDS.has(productId) || isDetachedRelistedListing(listing);
}

function writeBlockedResult(productId: string, listing: EbayListingRow | null): SyncStepResult {
  const pinned = EBAY_WRITE_BLOCKED_PRODUCT_IDS.has(productId);
  return {
    done: true,
    syncState: listing?.sync_state ?? 'pending',
    error: {
      code: pinned ? 'write_blocked' : 'detached_relist',
      message: pinned ? EBAY_WRITE_BLOCKED_WARNING : RELISTED_LISTING_WARNING,
    },
  };
}

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

// Site shipping tiers -> provisioned eBay fulfillment policies. Best-effort:
// an unreadable map must never block a sync — an empty map simply keeps the
// legacy standard/express policy resolution.
async function loadTierPolicyMap(service: SupabaseClient): Promise<Record<string, string>> {
  try {
    return await getMarketplaceShippingProfileMap(service, 'ebay');
  } catch {
    return {};
  }
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

export function offerBody(payload: MappedEbayPayload) {
  return {
    sku: payload.sku,
    marketplaceId: payload.marketplaceId,
    format: 'FIXED_PRICE',
    listingDuration: 'GTC',
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

interface ExistingOfferSummary {
  offerId: string;
  format?: string;
  marketplaceId?: string;
}

export function selectExistingFixedPriceOfferId(
  offers: ExistingOfferSummary[] | undefined,
  marketplaceId: string,
): string | null {
  return offers?.find((offer) => offer.format === 'FIXED_PRICE' && offer.marketplaceId === marketplaceId)?.offerId ?? null;
}

async function findExistingOfferId(accessToken: string, sku: string, marketplaceId: string): Promise<string | null> {
  try {
    const res = await ebayFetch<{ offers?: ExistingOfferSummary[] }>({
      method: 'GET',
      path: '/sell/inventory/v1/offer',
      accessToken,
      query: { sku },
    });
    return selectExistingFixedPriceOfferId(res.data.offers, marketplaceId);
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

interface BulkPriceQuantityResponse {
  responses?: Array<{
    statusCode?: number;
    offerId?: string;
    sku?: string;
    errors?: Array<{ message?: string }>;
  }>;
}

export function bulkPriceQuantityFailureMessage(
  response: BulkPriceQuantityResponse,
  expectedResponses: number,
): string | null {
  const responses = response.responses ?? [];
  if (responses.length < expectedResponses) return 'eBay returned an incomplete bulk price/quantity response.';
  const failed = responses.find((entry) => entry.statusCode == null || entry.statusCode < 200 || entry.statusCode >= 300);
  if (!failed) return null;
  const target = failed.offerId ? `offer ${failed.offerId}` : failed.sku ? `SKU ${failed.sku}` : 'an offer';
  return failed.errors?.find((error) => error.message)?.message ?? `eBay rejected the price/quantity update for ${target}.`;
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
  const res = await ebayFetch<BulkPriceQuantityResponse>({
    method: 'POST',
    path: '/sell/inventory/v1/bulk_update_price_quantity',
    accessToken,
    json: { requests },
  });
  const failure = bulkPriceQuantityFailureMessage(res.data, entries.length);
  if (failure) {
    throw new EbayApiError({
      status: 400,
      code: 'bulk_item_failed',
      operatorMessage: failure,
      retryable: false,
      detail: { responses: res.data.responses },
    });
  }
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
  if (isEbayWriteBlocked(productId, listing)) return writeBlockedResult(productId, listing);

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

  const payload = buildMappedPayload(product, connection, spotData, undefined, await loadTierPolicyMap(service));

  try {
    const { accessToken } = await ensureFreshAccessToken(service);
    let remoteOfferState: ReturnType<typeof reconcileEbayStateFromOffer> | null = null;
    let remoteListingId = listing?.ebay_listing_id ?? null;

    if (listing?.ebay_offer_id) {
      const offer = await getOfferCall(accessToken, listing.ebay_offer_id);
      remoteOfferState = reconcileEbayStateFromOffer(listing.sync_state, offer.status, offer.listing?.listingStatus);
      remoteListingId = offer.listing?.listingId ?? remoteListingId;

      // Never write an ended managed offer when eBay has an active external
      // relist. That old offer can accept updates without changing the listing
      // buyers actually see.
      if (!remoteOfferState.live && remoteOfferState.syncState === 'ended' && remoteListingId) {
        const relist = await resolveEbayRelistChain({
          startingListingId: remoteListingId,
          expectedSku: listing.ebay_sku,
          lookup: (listingId) => ebayTradingGetItemStatus(accessToken, listingId),
        });
        if (relist.state === 'active') {
          await upsertListing(service, productId, {
            sync_state: 'published',
            ebay_listing_id: relist.listingId,
            last_error: RELISTED_LISTING_WARNING,
          });
          await insertSyncLog(service, {
            product_id: productId,
            listing_id: relist.listingId,
            action: 'sync',
            outcome: 'warning',
            message: RELISTED_LISTING_WARNING,
          });
          return {
            done: true,
            syncState: 'published',
            listingId: relist.listingId,
            listingUrl: listingUrlFor(relist.listingId),
            error: { code: 'detached_relist', message: RELISTED_LISTING_WARNING },
          };
        }
      }
    }

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
        const adopted = await findExistingOfferId(accessToken, payload.sku, payload.marketplaceId);
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
    const isLiveOnEbay = remoteOfferState
      ? remoteOfferState.live || remoteOfferState.syncState === 'hidden_oos'
      : listing?.ebay_listing_id != null && listing.sync_state !== 'ended';
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
    const liveListingId = remoteListingId ?? listing!.ebay_listing_id!;
    const hash = computeContentHash(payload);
    const nextState: EbaySyncState = listing!.sync_state === 'hidden_oos' ? 'hidden_oos' : 'published';
    await upsertListing(service, productId, {
      sync_state: nextState,
      ebay_listing_id: liveListingId,
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
  if (isEbayWriteBlocked(productId, listing)) return writeBlockedResult(productId, listing);
  if (!listing?.ebay_offer_id) {
    return {
      done: true,
      syncState: listing?.sync_state ?? 'pending',
      error: { code: 'no_offer', message: 'Sync this item first to prepare an offer before publishing.' },
    };
  }
  if (listing.ebay_listing_id && ['published', 'out_of_date', 'hidden_oos'].includes(listing.sync_state)) {
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
      const payload = buildMappedPayload(product, connection, spotData, undefined, await loadTierPolicyMap(service));
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
  if (isEbayWriteBlocked(productId, listing)) return writeBlockedResult(productId, listing);
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

async function findDetachedRelistListingId(accessToken: string, listing: EbayListingRow): Promise<string | null> {
  if (!listing.ebay_offer_id || !listing.ebay_listing_id) return null;
  const offer = await getOfferCall(accessToken, listing.ebay_offer_id);
  const state = reconcileEbayStateFromOffer(listing.sync_state, offer.status, offer.listing?.listingStatus);
  if (state.live || state.syncState !== 'ended') return null;
  const relist = await resolveEbayRelistChain({
    startingListingId: offer.listing?.listingId ?? listing.ebay_listing_id,
    expectedSku: listing.ebay_sku,
    lookup: (listingId) => ebayTradingGetItemStatus(accessToken, listingId),
  });
  return relist.state === 'active' ? relist.listingId : null;
}

async function restoreEndedListing(
  service: SupabaseClient,
  listing: EbayListingRow,
  product: Product,
  connectionRow: EbayConnectionRow,
  productId: string,
): Promise<string> {
  if (!listing.ebay_offer_id) throw new Error('This ended listing no longer has an eBay offer to republish.');
  const connection = toConnectionDefaults(connectionRow);
  const spotData = await fetchSpotData().catch(() => null);
  const checks = buildPreflightChecks(product, connection, spotData);
  const failing = checks.find((check) => !check.ok);
  if (failing) throw new Error(failing.message ?? 'This item is not ready to be restored on eBay.');

  const payload = buildMappedPayload(product, connection, spotData, undefined, await loadTierPolicyMap(service));
  const { accessToken } = await ensureFreshAccessToken(service);
  await putInventoryItem(accessToken, payload);
  await updateOffer(accessToken, listing.ebay_offer_id, payload);
  const published = await publishOfferCall(accessToken, listing.ebay_offer_id);
  await upsertListing(service, productId, {
    sync_state: 'published',
    ebay_listing_id: published.listingId,
    content_hash: computeContentHash(payload),
    last_pushed_price: payload.price,
    last_pushed_qty: payload.quantity,
    last_error: null,
    error_count: 0,
  });
  await insertSyncLog(service, {
    product_id: productId,
    listing_id: published.listingId,
    action: 'restore',
    outcome: 'ok',
    detail: { priorListingId: listing.ebay_listing_id },
  });
  return published.listingId;
}

export async function runDelist(productId: string, action: 'hide' | 'withdraw' | 'restore'): Promise<SyncStepResult> {
  const service = createServiceClient();
  const connectionRow = await getConnection(service);
  const listing = await getListing(service, productId);
  if (isEbayWriteBlocked(productId, listing)) return writeBlockedResult(productId, listing);
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
    const { accessToken } = await ensureFreshAccessToken(service);
    const detachedRelistId = await findDetachedRelistListingId(accessToken, listing);
    if (detachedRelistId) {
      await upsertListing(service, productId, {
        sync_state: 'published',
        ebay_listing_id: detachedRelistId,
        last_error: RELISTED_LISTING_WARNING,
      });
      await insertSyncLog(service, {
        product_id: productId,
        listing_id: detachedRelistId,
        action: `delist_${action}`,
        outcome: 'warning',
        message: RELISTED_LISTING_WARNING,
      });
      return {
        done: true,
        syncState: 'published',
        listingId: detachedRelistId,
        listingUrl: listingUrlFor(detachedRelistId),
        error: { code: 'detached_relist', message: RELISTED_LISTING_WARNING },
      };
    }
    if (action === 'withdraw') {
      await withdrawListing(service, listing, productId);
      return { done: true, syncState: 'ended' };
    }
    if (action === 'hide') {
      await hideListingQuantityZero(service, listing, productId);
      return { done: true, syncState: 'hidden_oos' };
    }
    const product = await loadProduct(service, productId);
    if (!product) throw new Error('Product not found.');
    if (listing.sync_state === 'ended') {
      const listingId = await restoreEndedListing(service, listing, product, connectionRow, productId);
      return { done: true, syncState: 'published', listingId, listingUrl: listingUrlFor(listingId) };
    }
    await restoreListingQuantity(service, listing, productId, product.quantity);
    return {
      done: true,
      syncState: 'published',
      listingId: listing.ebay_listing_id ?? undefined,
      listingUrl: listing.ebay_listing_id ? listingUrlFor(listing.ebay_listing_id) : undefined,
    };
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
  error?: boolean;
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
  // Out-of-Stock control but still an active listing on eBay's side). Preserve
  // out_of_date too: lifecycle status does not prove content freshness.
  if (ls === 'ACTIVE' || (os === 'PUBLISHED' && ls === '')) {
    return {
      syncState: current === 'hidden_oos' || current === 'out_of_date' ? current : 'published',
      live: true,
    };
  }
  // Offer exists but is UNPUBLISHED with no active/ended listing. If we thought
  // it was live, eBay ended it out of band → 'ended'; if it was never
  // published, it's a prepared offer awaiting publish → 'review'.
  if (['published', 'out_of_date', 'hidden_oos'].includes(current)) return { syncState: 'ended', live: false };
  return { syncState: 'review', live: false };
}

export type EbayRelistChainResult =
  | { state: 'active'; listingId: string; hops: number }
  | { state: 'inactive'; listingId: string; hops: number; listingStatus: string | null }
  | { state: 'sku_mismatch'; listingId: string; hops: number; actualSku: string | null }
  | { state: 'loop_or_limit'; listingId: string; hops: number };

/** Follow eBay's old-listing -> RelistedItemID chain without adopting another product. */
export async function resolveEbayRelistChain(params: {
  startingListingId: string;
  expectedSku: string;
  lookup: (listingId: string) => Promise<EbayTradingItemStatus>;
  maxHops?: number;
}): Promise<EbayRelistChainResult> {
  const maxHops = params.maxHops ?? 8;
  const seen = new Set<string>();
  let listingId = params.startingListingId;

  for (let hops = 0; hops < maxHops; hops += 1) {
    if (seen.has(listingId)) return { state: 'loop_or_limit', listingId, hops };
    seen.add(listingId);
    const item = await params.lookup(listingId);
    if (item.sku !== params.expectedSku) {
      return { state: 'sku_mismatch', listingId, hops, actualSku: item.sku };
    }
    if ((item.listingStatus ?? '').toUpperCase() === 'ACTIVE') {
      return { state: 'active', listingId: item.itemId, hops };
    }
    if (!item.relistedItemId) {
      return { state: 'inactive', listingId: item.itemId, hops, listingStatus: item.listingStatus };
    }
    listingId = item.relistedItemId;
  }
  return { state: 'loop_or_limit', listingId, hops: maxHops };
}

export async function checkListingStatus(productId: string): Promise<CheckListingStatusResult> {
  const service = createServiceClient();
  const listing = await getListing(service, productId);
  if (!listing?.ebay_offer_id) {
    return { found: false, syncState: listing?.sync_state ?? 'pending', message: 'No linked eBay offer yet.' };
  }
  try {
    const { accessToken } = await ensureFreshAccessToken(service);
    let offer: GetOfferResponse;
    try {
      offer = await getOfferCall(accessToken, listing.ebay_offer_id);
    } catch (err) {
      // Only GetOffer can prove that the managed offer itself is gone. A 404
      // from the later Trading relist lookup must not sever a valid offer link.
      if (!(err instanceof EbayApiError && err.status === 404)) throw err;
      await upsertListing(service, productId, {
        sync_state: 'pending',
        ebay_offer_id: null,
        ebay_listing_id: null,
        content_hash: null,
        last_error: null,
        error_count: 0,
      });
      await insertSyncLog(service, { product_id: productId, action: 'verify', outcome: 'ok', message: 'Offer no longer exists on eBay - reset to not-listed.' });
      return { found: false, syncState: 'pending', message: 'This offer no longer exists on eBay - reset to not-listed. You can sync it fresh.' };
    }
    const offerState = reconcileEbayStateFromOffer(listing.sync_state, offer.status, offer.listing?.listingStatus);
    let syncState = offerState.syncState;
    let live = offerState.live;
    // Only trust eBay's listingId, never our stale stored one.
    let remoteListingId = offer.listing?.listingId ?? listing.ebay_listing_id;
    let relisted = false;

    // The Inventory offer remains ENDED when a seller relists that item in
    // eBay. Trading GetItem exposes the replacement ID, so follow that chain
    // before deciding the product is truly gone.
    if (!live && syncState === 'ended' && (listing.ebay_listing_id ?? remoteListingId)) {
      const relist = await resolveEbayRelistChain({
        startingListingId: listing.ebay_listing_id ?? remoteListingId!,
        expectedSku: listing.ebay_sku,
        lookup: (listingId) => ebayTradingGetItemStatus(accessToken, listingId),
      });
      if (relist.state === 'sku_mismatch') {
        throw new Error('eBay relisted this item under a different SKU, so it was not adopted automatically.');
      }
      if (relist.state === 'loop_or_limit') {
        throw new Error('eBay returned an invalid or unusually long relist chain; local status was left unchanged.');
      }
      remoteListingId = relist.listingId;
      if (relist.state === 'active') {
        syncState = 'published';
        live = true;
        relisted = true;
      }
    }

    await upsertListing(service, productId, {
      sync_state: syncState,
      ebay_listing_id: remoteListingId,
      last_error: relisted ? RELISTED_LISTING_WARNING : null,
      error_count: 0,
    });
    await insertSyncLog(service, {
      product_id: productId,
      listing_id: remoteListingId,
      action: 'verify',
      outcome: relisted ? 'warning' : 'ok',
      message: relisted ? RELISTED_LISTING_WARNING : null,
      detail: relisted ? { source: 'trading_relist', activeListingId: remoteListingId } : null,
    });
    const message = relisted
      ? `Confirmed live on eBay as relisted item ${remoteListingId}. The linked listing ID was corrected here.`
      : live && syncState === 'out_of_date'
        ? 'Confirmed live on eBay; local updates still need to be synced.'
      : live
        ? 'Confirmed live on eBay.'
      : syncState === 'ended'
        ? 'This listing has ended on eBay (ended or removed there) — marked as ended here.'
        : syncState === 'hidden_oos'
          ? 'This listing is out of stock / hidden on eBay.'
          : 'Offer exists but is not published yet.';
    return { found: true, syncState, message };
  } catch (err) {
    const message = err instanceof EbayApiError ? err.operatorMessage : err instanceof Error ? err.message : 'Could not verify.';
    return { found: false, syncState: listing.sync_state, message, error: true };
  }
}

export interface CheckAllStatusResult {
  checked: number;
  updated: number;
  reset: number;
  errors: number;
  /** Requested products that do not have a linked eBay offer. */
  skipped: number;
  items: Array<{
    productId: string;
    syncState: EbaySyncState;
    linked: boolean;
    checkError: boolean;
  }>;
}

export async function checkAllListingStatuses(productIds?: string[]): Promise<CheckAllStatusResult> {
  const service = createServiceClient();
  if (productIds && productIds.length === 0) {
    return { checked: 0, updated: 0, reset: 0, errors: 0, skipped: 0, items: [] };
  }

  let query = service.from('ebay_listings').select('product_id, sync_state').not('ebay_offer_id', 'is', null);
  if (productIds) query = query.in('product_id', productIds);
  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []) as Array<{ product_id: string; sync_state: EbaySyncState }>;
  const skipped = productIds ? Math.max(0, productIds.length - rows.length) : 0;
  const requestedIds = productIds ?? rows.map((row) => row.product_id);
  const itemStatus = new Map(rows.map((row) => [row.product_id, {
    productId: row.product_id,
    syncState: row.sync_state,
    linked: true,
    checkError: false,
  }]));
  let updated = 0;
  let reset = 0;
  let errors = 0;
  for (const row of rows) {
    try {
      const result = await checkListingStatus(row.product_id);
      if (row.sync_state !== result.syncState) updated += 1;
      if (!result.found && !result.error && result.syncState === 'pending') reset += 1;
      if (result.error) errors += 1;
      itemStatus.set(row.product_id, {
        productId: row.product_id,
        syncState: result.syncState,
        linked: result.error ? true : result.found,
        checkError: Boolean(result.error),
      });
    } catch {
      errors += 1;
      itemStatus.set(row.product_id, { productId: row.product_id, syncState: row.sync_state, linked: true, checkError: true });
    }
  }
  return {
    checked: rows.length,
    updated,
    reset,
    errors,
    skipped,
    items: requestedIds.map((productId) => itemStatus.get(productId)
      ?? { productId, syncState: 'pending', linked: false, checkError: false }),
  };
}

// ---------------------------------------------------------------------------
// Phase 2 — bulk queue + drain.
// ---------------------------------------------------------------------------
/**
 * Largest number of listings one bulk enqueue may stage for live eBay writes.
 * "Never blanket re-sync" is a standing project rule: a single click that
 * rewrites the entire catalog on a live marketplace has no undo, and one bad
 * mapping would be multiplied across every listing. Work proceeds in reviewable
 * batches instead — drain, check the results on eBay, enqueue the next batch.
 */
export { EBAY_BULK_ENQUEUE_LIMIT } from './guards';

export interface EnqueueResult {
  /** Listings actually staged for a write. */
  queued: number;
  /** Skipped because the product id is write-blocked (e.g. inventory #82). */
  blocked: number;
  /** Skipped because the product is no longer available (sold/held/removed). */
  notAvailable: number;
  /** Eligible but withheld by EBAY_BULK_ENQUEUE_LIMIT; enqueue again for more. */
  withheld: number;
}

/**
 * Bounded, guarded bulk enqueue. Three filters run before anything is staged:
 * pinned write-blocks, non-available products, then the batch cap. Together
 * they are the mechanical form of the standing cautions — never blanket
 * re-sync, and never write a quarantined or sold listing.
 */
export async function enqueueProducts(productIds: string[]): Promise<EnqueueResult> {
  const service = createServiceClient();
  // Write-blocked ids never enter the queue at all — the per-step guard would
  // stop them anyway, but keeping them out avoids parking a permanently
  // un-drainable row in 'pending'.
  const blocked = productIds.filter((id) => EBAY_WRITE_BLOCKED_PRODUCT_IDS.has(id)).length;
  const notBlocked = productIds.filter((id) => !EBAY_WRITE_BLOCKED_PRODUCT_IDS.has(id));

  // Sold pieces would fail runSyncStep's pre-flight anyway ("Only available
  // items can be published to eBay") — but only after flipping the row to
  // 'error' and writing a log line each. A catalog-wide re-sync would bury the
  // real failures under dozens of those, so drop them before they are queued.
  const available = new Set<string>();
  for (let index = 0; index < notBlocked.length; index += 200) {
    const { data, error } = await service
      .from('products')
      .select('id')
      .eq('status', 'available')
      .in('id', notBlocked.slice(index, index + 200));
    if (error) throw new Error(error.message);
    for (const row of (data ?? []) as { id: string }[]) available.add(row.id);
  }
  const allowed = notBlocked.filter((id) => available.has(id));
  const batch = allowed.slice(0, EBAY_BULK_ENQUEUE_LIMIT);

  let queued = 0;
  for (const productId of batch) {
    // Re-enqueuing an already-listed item as 'pending' is safe: runSyncStep's
    // effectiveMode reinterpretation treats it as an update, never a
    // re-publish, so it can never spin forever in the drain loop.
    await upsertListing(service, productId, { sync_state: 'pending', ebay_sku: productId });
    queued += 1;
  }
  return {
    queued,
    blocked,
    notAvailable: notBlocked.length - allowed.length,
    withheld: allowed.length - batch.length,
  };
}

export async function enqueueAllEligible(): Promise<EnqueueResult> {
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
/**
 * What the freshness scan should do with one row, before any hashing.
 *
 * A sold/hidden piece is never a content-push candidate: `out_of_date` means
 * "this listing needs a push", and pushing a sold piece is precisely what must
 * never happen — so hashing one can only ever produce a false flag.
 *
 * Until 2026-08-04 the scan hashed `hidden_oos` rows too. The tier
 * shipping-policy change duly flipped all 36 sold-and-hidden listings to
 * `out_of_date`, destroying the state that records "hidden on eBay because it
 * sold" and inflating the re-sync campaign by a third.
 *
 * `repair-hidden` undoes exactly that. `last_pushed_qty === 0` is durable proof
 * that `hideListingQuantityZero()` really did zero the listing on eBay (the
 * scan never touches that column), so it separates a mis-flagged hidden row
 * from a just-sold row whose auto-hide has not run yet — the latter must stay
 * visible as work to do rather than be relabelled as already hidden.
 */
export type FreshnessScanAction = 'hash' | 'skip' | 'repair-hidden';

export function resolveFreshnessScanAction(
  listing: Pick<EbayListingRow, 'sync_state' | 'last_pushed_qty'>,
  productStatus: string | null | undefined,
): FreshnessScanAction {
  if (normalizeProductStatus(productStatus) !== 'available') {
    return listing.sync_state === 'out_of_date' && listing.last_pushed_qty === 0 ? 'repair-hidden' : 'skip';
  }
  // Already flagged — re-hashing would only rewrite the same value.
  if (listing.sync_state === 'out_of_date') return 'skip';
  return 'hash';
}

export async function scanAndMarkOutOfDate(productIds?: string[]): Promise<number> {
  const service = createServiceClient();
  const connectionRow = await getConnection(service);
  if (!connectionRow) return 0;
  const connection = toConnectionDefaults(connectionRow);
  const spotData = await fetchSpotData().catch(() => null);

  // 'out_of_date' is selected only so the repair branch below can see rows this
  // scan itself mis-flagged; an already-flagged available row is skipped.
  let query = service.from('ebay_listings').select('*').in('sync_state', ['published', 'hidden_oos', 'out_of_date']);
  if (productIds) query = query.in('product_id', productIds);
  const { data: listings } = await query;
  let flagged = 0;
  const tierPolicyMap = await loadTierPolicyMap(service);
  for (const listing of (listings ?? []) as EbayListingRow[]) {
    const product = await loadProduct(service, listing.product_id);
    if (!product) continue;

    const action = resolveFreshnessScanAction(listing, product.status);
    if (action === 'repair-hidden') {
      await upsertListing(service, listing.product_id, { sync_state: 'hidden_oos' });
      continue;
    }
    if (action === 'skip') continue;

    // The shipping policy is price-tiered and participates in the content
    // hash. During a live-spot outage, skip spot-priced rows instead of
    // falsely marking them out of date with a fallback/unknown tier.
    if (product.price_mode === 'spot-multiplier'
      && computeEbayPrice(product, spotData, connection.price_markup_pct).price == null) {
      continue;
    }
    const payload = buildMappedPayload(product, connection, spotData, undefined, tierPolicyMap);
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

const PRICE_PRODUCT_COLUMNS = [
  'id',
  'category',
  'price_mode',
  'manual_price_label',
  'asking_price',
  'pricing_multiplier',
  'gram_weight',
  'weight_grams',
  'purity',
  'status',
  'sold_price',
].join(',');

export interface EbayPricePushCandidate {
  listing: EbayListingRow;
  price: number;
}

export interface EbayPricePushResult {
  done: boolean;
  pushed: number;
  skipped: number;
  failed: number;
  blocked: number;
  remaining: number;
}

function emptyPricePushResult(): EbayPricePushResult {
  return { done: true, pushed: 0, skipped: 0, failed: 0, blocked: 0, remaining: 0 };
}

async function loadPriceProducts(service: SupabaseClient, productIds: string[]): Promise<Map<string, Product>> {
  if (!productIds.length) return new Map();
  const { data, error } = await service.from('products').select(PRICE_PRODUCT_COLUMNS).in('id', productIds);
  if (error) throw new Error(error.message);
  return new Map(((data ?? []) as unknown as Product[]).map((product) => [product.id, product]));
}

export function planEbayPricePush(
  listings: EbayListingRow[],
  products: Map<string, Product>,
  spotData: SpotData,
  markupPct: number,
  thresholdPct: number | null,
): { candidates: EbayPricePushCandidate[]; skipped: number; blocked: number } {
  const candidates: EbayPricePushCandidate[] = [];
  let skipped = 0;
  let blocked = 0;

  for (const listing of listings) {
    if (isEbayWriteBlocked(listing.product_id, listing) || !listing.ebay_offer_id) {
      blocked += 1;
      continue;
    }
    const product = products.get(listing.product_id);
    if (!product) {
      skipped += 1;
      continue;
    }
    const priceResult = computeEbayPrice(product, spotData, markupPct);
    if (priceResult.price == null) {
      blocked += 1;
      continue;
    }
    const shouldPush = thresholdPct == null
      ? priceResult.price !== listing.last_pushed_price
      : shouldPushPrice(priceResult.price, listing.last_pushed_price, thresholdPct);
    if (!shouldPush) {
      skipped += 1;
      continue;
    }
    candidates.push({ listing, price: priceResult.price });
  }

  return { candidates, skipped, blocked };
}

async function recordEbayPricePushSuccess(
  service: SupabaseClient,
  candidate: EbayPricePushCandidate,
): Promise<void> {
  await upsertListing(service, candidate.listing.product_id, { last_pushed_price: candidate.price });
  await insertSyncLog(service, {
    product_id: candidate.listing.product_id,
    listing_id: candidate.listing.ebay_listing_id,
    action: 'price_push',
    outcome: 'ok',
    detail: { price: candidate.price },
  });
}

async function recordEbayPricePushFailure(
  service: SupabaseClient,
  candidate: EbayPricePushCandidate,
  err: unknown,
): Promise<void> {
  const message = err instanceof EbayApiError ? err.operatorMessage : err instanceof Error ? err.message : 'Price push failed.';
  // Rotate the failed row behind untouched rows without changing its pushed
  // price, so a single bad offer cannot block the rest of a manual run.
  await upsertListing(service, candidate.listing.product_id, {}).catch(() => {});
  await insertSyncLog(service, {
    product_id: candidate.listing.product_id,
    listing_id: candidate.listing.ebay_listing_id,
    action: 'price_push',
    outcome: 'error',
    message,
  });
}

async function pushEbayPriceCandidates(params: {
  service: SupabaseClient;
  candidates: EbayPricePushCandidate[];
  maxItems?: number;
  budgetMs?: number;
}): Promise<{ pushed: number; failed: number; remaining: number }> {
  const startedAt = Date.now();
  const limit = Math.min(params.maxItems ?? params.candidates.length, params.candidates.length);
  const { accessToken } = limit > 0
    ? await ensureFreshAccessToken(params.service)
    : { accessToken: '' };
  let attempted = 0;
  let pushed = 0;
  let failed = 0;

  while (attempted < limit) {
    if (params.budgetMs != null && attempted > 0 && Date.now() - startedAt >= params.budgetMs) break;
    const chunk = params.candidates.slice(attempted, Math.min(attempted + 25, limit));
    const entries = chunk.map((candidate) => ({
      sku: candidate.listing.ebay_sku,
      offerId: candidate.listing.ebay_offer_id!,
      price: candidate.price,
    }));

    try {
      await bulkUpdatePriceQuantity(accessToken, entries);
      for (const candidate of chunk) {
        await recordEbayPricePushSuccess(params.service, candidate);
        pushed += 1;
      }
      attempted += chunk.length;
    } catch {
      // A mixed eBay bulk response can contain one bad offer. Retry this chunk
      // one item at a time so the valid offers still advance.
      for (const candidate of chunk) {
        if (params.budgetMs != null && attempted > 0 && Date.now() - startedAt >= params.budgetMs) break;
        try {
          await bulkUpdatePriceQuantity(accessToken, [{
            sku: candidate.listing.ebay_sku,
            offerId: candidate.listing.ebay_offer_id!,
            price: candidate.price,
          }]);
          await recordEbayPricePushSuccess(params.service, candidate);
          pushed += 1;
        } catch (err) {
          await recordEbayPricePushFailure(params.service, candidate, err);
          failed += 1;
        }
        attempted += 1;
      }
    }
  }

  return { pushed, failed, remaining: params.candidates.length - attempted };
}

const SCHEDULED_PRICE_PUSH_BUDGET_MS = 22_000;

export async function runScheduledPricePush(): Promise<EbayPricePushResult> {
  const service = createServiceClient();
  await pruneOldSyncLogs(service).catch(() => {});

  try {
    const connectionRow = await getConnection(service);
    if (!connectionRow || connectionRow.status !== 'connected' || !connectionRow.price_push_enabled) {
      const message = !connectionRow || connectionRow.status !== 'connected'
        ? 'Scheduled eBay price push skipped because eBay is not connected.'
        : 'Scheduled eBay price push ran, but daily price pushes are disabled.';
      await insertSyncLog(service, { action: 'scheduled_price_push', outcome: 'warning', message });
      return emptyPricePushResult();
    }

    const connection = toConnectionDefaults(connectionRow);
    const [spotData, listingResult] = await Promise.all([
      fetchSpotData(),
      service
        .from('ebay_listings')
        .select('*')
        .in('sync_state', ['published', 'out_of_date'])
        .order('updated_at', { ascending: true }),
    ]);
    if (listingResult.error) throw new Error(listingResult.error.message);

    const listings = (listingResult.data ?? []) as EbayListingRow[];
    const products = await loadPriceProducts(service, listings.map((listing) => listing.product_id));
    const plan = planEbayPricePush(
      listings,
      products,
      spotData,
      connection.price_markup_pct,
      connectionRow.price_push_threshold_pct,
    );
    const processed = await pushEbayPriceCandidates({
      service,
      candidates: plan.candidates,
      budgetMs: SCHEDULED_PRICE_PUSH_BUDGET_MS,
    });
    const result: EbayPricePushResult = {
      done: processed.remaining === 0,
      pushed: processed.pushed,
      skipped: plan.skipped,
      failed: processed.failed,
      blocked: plan.blocked,
      remaining: processed.remaining,
    };
    const outcome = result.failed || result.blocked || result.remaining ? 'warning' : 'ok';
    const message = `Scheduled eBay price push: ${result.pushed} pushed, ${result.skipped} unchanged, ${result.blocked} blocked, ${result.failed} failed, ${result.remaining} deferred.`;
    await insertSyncLog(service, { action: 'scheduled_price_push', outcome, message, detail: { ...result } });
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Scheduled eBay price push failed.';
    await insertSyncLog(service, { action: 'scheduled_price_push', outcome: 'error', message });
    throw err;
  }
}

// Manual "Push prices to eBay now" — one bounded batch, client polls until done.
export async function pushPricesBatch(): Promise<EbayPricePushResult> {
  const service = createServiceClient();
  const connectionRow = await getConnection(service);
  if (!connectionRow || connectionRow.status !== 'connected') return emptyPricePushResult();
  const connection = toConnectionDefaults(connectionRow);
  const [spotData, listingResult] = await Promise.all([
    fetchSpotData(),
    service
      .from('ebay_listings')
      .select('*')
      .in('sync_state', ['published', 'out_of_date'])
      .order('updated_at', { ascending: true }),
  ]);
  if (listingResult.error) throw new Error(listingResult.error.message);

  const listings = (listingResult.data ?? []) as EbayListingRow[];
  const products = await loadPriceProducts(service, listings.map((listing) => listing.product_id));
  const plan = planEbayPricePush(listings, products, spotData, connection.price_markup_pct, null);
  const processed = await pushEbayPriceCandidates({
    service,
    candidates: plan.candidates,
    maxItems: 25,
  });
  return {
    done: processed.remaining === 0,
    pushed: processed.pushed,
    skipped: plan.skipped,
    failed: processed.failed,
    blocked: plan.blocked,
    remaining: processed.remaining,
  };
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
