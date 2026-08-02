import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  getMarketplaceShippingTier,
  MARKETPLACE_SHIPPING_TIERS,
  type MarketplaceShippingTier,
} from '@/lib/checkout-shipping';

// Site-owned bridge between the checkout shipping tiers and the provisioned
// per-marketplace shipping objects (supabase/marketplace-shipping-tiers-2026-07.sql).
// The Etsy and eBay syncs stay independent channels — each consumes only its
// own marketplace's rows through this module; nothing here imports from
// either sync. Until a marketplace is provisioned its map is empty and every
// resolver returns null, so callers keep their existing single-default
// behavior.

export type ShippingTierMarketplace = 'etsy' | 'ebay';

/**
 * Canonical display/object name for a provisioned tier, stable across runs.
 * Takes only the fee on purpose: this string is the idempotency key that
 * matches existing Etsy profiles / eBay policies, so it must never shift when
 * unrelated tier fields (delivery-day window, etc.) change.
 */
export function marketplaceShippingTierLabel(tier: Pick<MarketplaceShippingTier, 'fee'>): string {
  return `NEJ Insured Shipping $${tier.fee}`;
}

function isMissingSchemaError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return error.code === '42P01' || error.code === '42703' || /schema cache|does not exist/i.test(error.message ?? '');
}

export class MarketplaceShippingNotMigratedError extends Error {
  constructor() {
    super('The marketplace shipping-tier table has not been created yet. Run supabase/marketplace-shipping-tiers-2026-07.sql in the Supabase SQL Editor.');
    this.name = 'MarketplaceShippingNotMigratedError';
  }
}

/**
 * Provisioning precondition: verifies the mapping table exists BEFORE any
 * external marketplace object is created, so a missing migration can never
 * leave orphaned Etsy profiles / eBay policies with no local mapping row.
 */
export async function assertMarketplaceShippingMigrated(service: SupabaseClient): Promise<void> {
  const { error } = await service
    .from('marketplace_shipping_profiles')
    .select('fee_key', { count: 'exact', head: true });
  if (error) {
    if (isMissingSchemaError(error)) throw new MarketplaceShippingNotMigratedError();
    throw new Error(error.message);
  }
}

/**
 * fee_key -> external object id for one marketplace. Empty map when the
 * migration has not been applied or nothing is provisioned — callers treat
 * that as "tiers not in use" and fall back to their legacy default.
 */
export async function getMarketplaceShippingProfileMap(
  service: SupabaseClient,
  marketplace: ShippingTierMarketplace,
): Promise<Record<string, string>> {
  const { data, error } = await service
    .from('marketplace_shipping_profiles')
    .select('fee_key, external_id')
    .eq('marketplace', marketplace);
  if (error) {
    if (isMissingSchemaError(error)) return {};
    throw new Error(error.message);
  }
  const map: Record<string, string> = {};
  for (const row of (data ?? []) as { fee_key: string; external_id: string }[]) {
    if (row.fee_key && row.external_id) map[row.fee_key] = row.external_id;
  }
  return map;
}

export async function upsertMarketplaceShippingProfile(
  service: SupabaseClient,
  input: {
    marketplace: ShippingTierMarketplace;
    feeKey: string;
    fee: number;
    externalId: string;
    label?: string | null;
  },
): Promise<void> {
  const { error } = await service.from('marketplace_shipping_profiles').upsert({
    marketplace: input.marketplace,
    fee_key: input.feeKey,
    fee: input.fee,
    external_id: input.externalId,
    label: input.label ?? null,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    if (isMissingSchemaError(error)) throw new MarketplaceShippingNotMigratedError();
    throw new Error(error.message);
  }
}

/**
 * The provisioned external shipping object for a listing priced at
 * `itemPrice`, or null when the price is unusable or that tier is not
 * provisioned. Callers must treat null as "use the legacy default" — never
 * guess a different tier's object.
 */
export function resolveTierExternalId(
  map: Record<string, string>,
  itemPrice: number | null | undefined,
): { externalId: string; tier: MarketplaceShippingTier } | null {
  if (itemPrice == null) return null;
  const tier = getMarketplaceShippingTier(itemPrice);
  if (!tier) return null;
  const externalId = map[tier.key];
  return externalId ? { externalId, tier } : null;
}

/** Summary used by the admin settings panels. */
export function shippingTierProvisionSummary(map: Record<string, string>): {
  provisioned: number;
  total: number;
  complete: boolean;
} {
  const provisioned = MARKETPLACE_SHIPPING_TIERS.filter((tier) => Boolean(map[tier.key])).length;
  return {
    provisioned,
    total: MARKETPLACE_SHIPPING_TIERS.length,
    complete: provisioned === MARKETPLACE_SHIPPING_TIERS.length,
  };
}
