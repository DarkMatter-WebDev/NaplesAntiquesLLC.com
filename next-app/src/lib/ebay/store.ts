import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

// Typed access to the ebay_* tables (supabase/ebay-sync.sql). These tables
// have no anon/authenticated RLS policies — every caller here must be given a
// service-role SupabaseClient (see next-app/src/lib/supabase/service.ts).
// Mirrors next-app/src/lib/etsy/store.ts's shape; never imports from it.

export type EbayConnectionStatus = 'disconnected' | 'connected' | 'needs_reauth';

export interface EbayConnectionRow {
  id: 1;
  status: EbayConnectionStatus;
  ebay_username: string | null;
  marketplace_id: string;
  scopes: string[] | null;
  access_token_enc: string | null;
  access_token_expires_at: string | null;
  refresh_token_enc: string | null;
  refresh_token_expires_at: string | null;
  fulfillment_policy_id: string | null;
  payment_policy_id: string | null;
  return_policy_id: string | null;
  merchant_location_key: string | null;
  express_fulfillment_policy_id: string | null;
  high_value_shipping_threshold: number;
  selling_limit_amount: number | null;
  selling_limit_quantity: number | null;
  selling_limit_checked_at: string | null;
  auto_publish: boolean;
  sold_handling: 'quantity_zero' | 'withdraw';
  best_offer_enabled: boolean;
  price_push_enabled: boolean;
  price_push_threshold_pct: number;
  price_markup_pct: number;
  orders_cursor: string | null;
  connected_at: string | null;
  updated_at: string;
}

export type EbaySyncState =
  | 'pending'
  | 'item_synced'
  | 'offer_created'
  | 'review'
  | 'published'
  | 'out_of_date'
  | 'hidden_oos'
  | 'ended'
  | 'error';

export interface EbayListingRow {
  product_id: string;
  ebay_sku: string;
  ebay_offer_id: string | null;
  ebay_listing_id: string | null;
  sync_state: EbaySyncState;
  content_hash: string | null;
  last_pushed_price: number | null;
  last_pushed_qty: number | null;
  category_id: string | null;
  last_error: string | null;
  error_count: number;
  created_at: string;
  updated_at: string;
}

export type EbaySyncLogOutcome = 'ok' | 'warning' | 'error';

export interface EbaySyncLogInput {
  product_id?: string | null;
  listing_id?: string | null;
  action: string;
  outcome: EbaySyncLogOutcome;
  message?: string | null;
  detail?: Record<string, unknown> | null;
}

export interface EbaySyncLogRow extends EbaySyncLogInput {
  id: number;
  created_at: string;
}

export interface OauthStateRow {
  state: string;
  admin_user_id: string;
  created_at: string;
}

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

export class EbayNotMigratedError extends Error {
  constructor() {
    super('The eBay sync tables have not been created yet. Run supabase/ebay-sync.sql in the Supabase SQL Editor.');
    this.name = 'EbayNotMigratedError';
  }
}

function isMissingSchemaError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  // 42P01 = undefined_table, 42703 = undefined_column (Postgres); PostgREST
  // also surfaces schema-cache misses as PGRST errors with "schema cache" text.
  return error.code === '42P01' || error.code === '42703' || /schema cache|does not exist/i.test(error.message ?? '');
}

export async function getConnection(service: SupabaseClient): Promise<EbayConnectionRow | null> {
  const { data, error } = await service.from('ebay_connection').select('*').eq('id', 1).maybeSingle();
  if (error) {
    if (isMissingSchemaError(error)) return null;
    throw new Error(error.message);
  }
  return (data as EbayConnectionRow | null) ?? null;
}

export async function updateConnection(service: SupabaseClient, patch: Partial<EbayConnectionRow>): Promise<void> {
  const { error } = await service
    .from('ebay_connection')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', 1);
  if (error) {
    if (isMissingSchemaError(error)) throw new EbayNotMigratedError();
    throw new Error(error.message);
  }
}

export async function getListing(service: SupabaseClient, productId: string): Promise<EbayListingRow | null> {
  const { data, error } = await service.from('ebay_listings').select('*').eq('product_id', productId).maybeSingle();
  if (error) {
    if (isMissingSchemaError(error)) return null;
    throw new Error(error.message);
  }
  return (data as EbayListingRow | null) ?? null;
}

export async function getListingsMap(service: SupabaseClient): Promise<Record<string, EbayListingRow>> {
  const { data, error } = await service.from('ebay_listings').select('*');
  if (error) {
    // Bulk chip fetch must never break the product table — pre-migration or
    // any read error just means "nothing synced yet".
    return {};
  }
  const rows = (data ?? []) as EbayListingRow[];
  return Object.fromEntries(rows.map((row) => [row.product_id, row]));
}

// Deliberately NOT a single .upsert(...): Postgres validates NOT NULL
// constraints against the row `INSERT ... ON CONFLICT DO UPDATE` WOULD have
// inserted before it even checks for a conflict — so a one-shot upsert with
// a partial patch (any call site not passing ebay_sku, e.g. the
// offer/publish state-transition calls below) throws a NOT NULL violation
// even when updating an existing row. Confirmed live 2026-07-09 (Failing row
// showed ebay_sku=null despite the row already existing). Try a real UPDATE
// first — a genuine partial update, no such validation — and only fall back
// to INSERT (which does need every NOT NULL column) when no row exists yet.
export async function upsertListing(
  service: SupabaseClient,
  productId: string,
  patch: Partial<Omit<EbayListingRow, 'product_id'>>,
): Promise<EbayListingRow> {
  const { data: updated, error: updateError } = await service
    .from('ebay_listings')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('product_id', productId)
    .select('*')
    .maybeSingle();
  if (updateError) {
    if (isMissingSchemaError(updateError)) throw new EbayNotMigratedError();
    throw new Error(updateError.message);
  }
  if (updated) return updated as EbayListingRow;

  const { data: inserted, error: insertError } = await service
    .from('ebay_listings')
    .insert({ product_id: productId, ebay_sku: productId, ...patch, updated_at: new Date().toISOString() })
    .select('*')
    .single();
  if (insertError) {
    if (isMissingSchemaError(insertError)) throw new EbayNotMigratedError();
    throw new Error(insertError.message);
  }
  return inserted as EbayListingRow;
}

export async function deleteListingRow(service: SupabaseClient, productId: string): Promise<void> {
  const { error } = await service.from('ebay_listings').delete().eq('product_id', productId);
  if (error && !isMissingSchemaError(error)) throw new Error(error.message);
}

export async function insertSyncLog(service: SupabaseClient, input: EbaySyncLogInput): Promise<void> {
  // Logging must never break the caller — swallow (but surface) any failure.
  const { error } = await service.from('ebay_sync_log').insert({
    product_id: input.product_id ?? null,
    listing_id: input.listing_id ?? null,
    action: input.action,
    outcome: input.outcome,
    message: input.message ?? null,
    detail: input.detail ?? null,
  });
  if (error && !isMissingSchemaError(error)) {
    console.error('ebay_sync_log insert error:', error.message);
  }
}

export async function getRecentSyncLog(
  service: SupabaseClient,
  limit = 50,
  options: { excludeActions?: string[] } = {},
): Promise<EbaySyncLogRow[]> {
  let query = service
    .from('ebay_sync_log')
    .select('*')
    .order('created_at', { ascending: false });

  for (const action of options.excludeActions ?? []) {
    query = query.neq('action', action);
  }

  const { data, error } = await query.limit(limit);
  if (error) {
    if (isMissingSchemaError(error)) return [];
    throw new Error(error.message);
  }
  return (data ?? []) as EbaySyncLogRow[];
}

export async function pruneOldSyncLogs(service: SupabaseClient): Promise<void> {
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await service.from('ebay_sync_log').delete().lt('created_at', cutoff);
  if (error && !isMissingSchemaError(error)) {
    console.error('ebay_sync_log prune error:', error.message);
  }
}

export async function claimNextPendingListing(service: SupabaseClient): Promise<string | null> {
  const { data, error } = await service.rpc('claim_next_pending_ebay_listing');
  if (error) {
    if (isMissingSchemaError(error)) return null;
    throw new Error(error.message);
  }
  return (data as string | null) ?? null;
}

export async function countPendingListings(service: SupabaseClient): Promise<number> {
  const { count, error } = await service
    .from('ebay_listings')
    .select('product_id', { count: 'exact', head: true })
    .eq('sync_state', 'pending');
  if (error) {
    if (isMissingSchemaError(error)) return 0;
    throw new Error(error.message);
  }
  return count ?? 0;
}

// Bulk-publish queue: items already prepared to a reviewable offer
// (sync_state 'review') that the owner can push live. No dedicated claim RPC
// like the pending queue needs — publishLiveStep is idempotent and always
// transitions the row OUT of 'review' (to 'published' on success, 'error' on
// failure), so selecting the oldest remaining 'review' row each pass never
// re-serves the same one; drainQueueCore's seen-guard is the backstop.
export async function claimNextReviewListing(service: SupabaseClient): Promise<string | null> {
  const { data, error } = await service
    .from('ebay_listings')
    .select('product_id')
    .eq('sync_state', 'review')
    .order('updated_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) {
    if (isMissingSchemaError(error)) return null;
    throw new Error(error.message);
  }
  return (data as { product_id: string } | null)?.product_id ?? null;
}

export async function countReviewListings(service: SupabaseClient): Promise<number> {
  const { count, error } = await service
    .from('ebay_listings')
    .select('product_id', { count: 'exact', head: true })
    .eq('sync_state', 'review');
  if (error) {
    if (isMissingSchemaError(error)) return 0;
    throw new Error(error.message);
  }
  return count ?? 0;
}

export async function createOauthState(
  service: SupabaseClient,
  input: { state: string; adminUserId: string },
): Promise<void> {
  // Opportunistic purge of expired rows — no cron dependency, same pattern as etsy_oauth_states.
  const expiredBefore = new Date(Date.now() - OAUTH_STATE_TTL_MS).toISOString();
  await service.from('ebay_oauth_states').delete().lt('created_at', expiredBefore);

  const { error } = await service.from('ebay_oauth_states').insert({
    state: input.state,
    admin_user_id: input.adminUserId,
  });
  if (error) {
    if (isMissingSchemaError(error)) throw new EbayNotMigratedError();
    throw new Error(error.message);
  }
}

export async function consumeOauthState(service: SupabaseClient, state: string): Promise<OauthStateRow | null> {
  const { data, error } = await service.from('ebay_oauth_states').select('*').eq('state', state).maybeSingle();
  if (error) {
    if (isMissingSchemaError(error)) return null;
    throw new Error(error.message);
  }
  if (!data) return null;

  // Single-use: delete on read regardless of TTL outcome below.
  await service.from('ebay_oauth_states').delete().eq('state', state);

  const row = data as OauthStateRow;
  const age = Date.now() - new Date(row.created_at).getTime();
  if (age > OAUTH_STATE_TTL_MS) return null;
  return row;
}
