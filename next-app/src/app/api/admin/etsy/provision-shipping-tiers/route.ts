import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { ensureFreshAccessToken } from '@/lib/etsy/auth';
import { EtsyApiError, etsyFetch } from '@/lib/etsy/client';
import { insertSyncLog } from '@/lib/etsy/store';
import { MARKETPLACE_SHIPPING_TIERS } from '@/lib/checkout-shipping';
import {
  assertMarketplaceShippingMigrated,
  marketplaceShippingTierLabel,
  MarketplaceShippingNotMigratedError,
  upsertMarketplaceShippingProfile,
} from '@/lib/marketplace-shipping';

// Admin "Provision shipping tiers" action: create or refresh one flat-cost
// Etsy shipping profile per distinct site shipping tier and record the
// tier -> profile mapping in marketplace_shipping_profiles. Idempotent —
// profiles are matched by their canonical title; a fee drift updates the
// existing profile's destination costs in place. No listing is touched here;
// listings pick up tier profiles through the normal sync/price-push paths.

export const runtime = 'nodejs';
export const maxDuration = 60;

// Owner ships from Naples, FL (confirmed 2026-07-30). Etsy requires an origin
// ZIP on US-origin shipping profiles.
const ORIGIN_POSTAL_CODE = '34116';

interface EtsyMoney {
  amount?: number;
  divisor?: number;
  currency_code?: string;
}

interface EtsyShippingProfile {
  shipping_profile_id: number;
  title: string;
  shipping_profile_destinations?: Array<{
    shipping_profile_destination_id: number;
    primary_cost?: EtsyMoney;
  }>;
}

function moneyToDollars(money: EtsyMoney | undefined): number | null {
  if (!money || typeof money.amount !== 'number') return null;
  const divisor = typeof money.divisor === 'number' && money.divisor > 0 ? money.divisor : 100;
  return Math.round(((money.amount / divisor) + Number.EPSILON) * 100) / 100;
}

export async function POST() {
  const { error } = await requireAdmin();
  if (error) return error;

  const service = createServiceClient();
  try {
    // Fail BEFORE creating anything on Etsy if the mapping table is missing.
    await assertMarketplaceShippingMigrated(service);
    const { accessToken, shopId } = await ensureFreshAccessToken(service);

    const existing = await etsyFetch<{ results: EtsyShippingProfile[] }>({
      path: `/v3/application/shops/${shopId}/shipping-profiles`,
      accessToken,
    });
    const byTitle = new Map((existing.data.results ?? []).map((profile) => [profile.title, profile]));

    let created = 0;
    let updated = 0;
    let unchanged = 0;
    const warnings: string[] = [];
    const tiers: Array<{ key: string; fee: number; profileId: number; action: 'created' | 'updated' | 'unchanged' }> = [];

    // Sequential on purpose: a handful of small calls, and a mid-run failure
    // leaves every completed tier durably mapped (safe to re-run).
    for (const tier of MARKETPLACE_SHIPPING_TIERS) {
      const title = marketplaceShippingTierLabel(tier);
      const found = byTitle.get(title);
      let profileId: number;
      let action: 'created' | 'updated' | 'unchanged';

      if (!found) {
        const res = await etsyFetch<{ shipping_profile_id: number }>({
          method: 'POST',
          path: `/v3/application/shops/${shopId}/shipping-profiles`,
          accessToken,
          json: {
            title,
            origin_country_iso: 'US',
            origin_postal_code: ORIGIN_POSTAL_CODE,
            primary_cost: tier.fee,
            // One-of-one estate pieces: each additional unit still carries the
            // full insured-tier fee.
            secondary_cost: tier.fee,
            min_processing_time: 1,
            max_processing_time: 3,
            destination_country_iso: 'US',
          },
        });
        profileId = res.data.shipping_profile_id;
        action = 'created';
        created += 1;
      } else {
        profileId = found.shipping_profile_id;
        const destination = found.shipping_profile_destinations?.[0];
        const currentCost = moneyToDollars(destination?.primary_cost);
        if (destination && currentCost !== null && Math.abs(currentCost - tier.fee) >= 0.01) {
          await etsyFetch({
            method: 'PUT',
            path: `/v3/application/shops/${shopId}/shipping-profiles/${profileId}/destinations/${destination.shipping_profile_destination_id}`,
            accessToken,
            json: { primary_cost: tier.fee, secondary_cost: tier.fee },
          });
          action = 'updated';
          updated += 1;
        } else {
          if (!destination) {
            warnings.push(`Profile "${title}" has no destination row to update — verify its cost on Etsy.`);
          }
          action = 'unchanged';
          unchanged += 1;
        }
      }

      await upsertMarketplaceShippingProfile(service, {
        marketplace: 'etsy',
        feeKey: tier.key,
        fee: tier.fee,
        externalId: String(profileId),
        label: title,
      });
      tiers.push({ key: tier.key, fee: tier.fee, profileId, action });
    }

    await insertSyncLog(service, {
      action: 'provision_shipping_tiers',
      outcome: warnings.length ? 'warning' : 'ok',
      message: `Provisioned ${tiers.length} shipping-tier profiles (${created} created, ${updated} updated, ${unchanged} unchanged).`
        + (warnings.length ? ` ${warnings.join(' ')}` : ''),
      detail: { tiers },
    });

    return NextResponse.json({ created, updated, unchanged, tiers, warnings });
  } catch (err) {
    const message = err instanceof MarketplaceShippingNotMigratedError
      ? err.message
      : err instanceof EtsyApiError
        ? err.operatorMessage
        : err instanceof Error
          ? err.message
          : 'Could not provision Etsy shipping tiers.';
    await insertSyncLog(service, {
      action: 'provision_shipping_tiers',
      outcome: 'error',
      message,
    }).catch(() => {});
    const status = err instanceof MarketplaceShippingNotMigratedError ? 503 : err instanceof EtsyApiError ? err.status : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
