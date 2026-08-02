import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { ensureFreshAccessToken } from '@/lib/ebay/auth';
import { EbayApiError, ebayFetch } from '@/lib/ebay/client';
import { buildTierFulfillmentPolicyPayload } from '@/lib/ebay/mapping';
import { getConnection, insertSyncLog } from '@/lib/ebay/store';
import { MARKETPLACE_SHIPPING_TIERS } from '@/lib/checkout-shipping';
import {
  assertMarketplaceShippingMigrated,
  marketplaceShippingTierLabel,
  MarketplaceShippingNotMigratedError,
  upsertMarketplaceShippingProfile,
} from '@/lib/marketplace-shipping';

// Admin "Provision shipping tiers" action: create or refresh one FLAT_RATE
// eBay fulfillment policy per distinct site shipping tier and record the
// tier -> policy mapping in marketplace_shipping_profiles. Idempotent —
// existing policies are matched by their canonical name and updated in
// place, so re-running after a tier-fee change re-aligns everything.
// Listing writes are untouched; policy changes reach listings through the
// normal content-hash out-of-date -> review-first sync path.

export const runtime = 'nodejs';
export const maxDuration = 60;

interface FulfillmentPolicySummary {
  fulfillmentPolicyId: string;
  name: string;
}

export async function POST() {
  const { error } = await requireAdmin();
  if (error) return error;

  const service = createServiceClient();
  try {
    // Fail BEFORE creating anything on eBay if the mapping table is missing.
    await assertMarketplaceShippingMigrated(service);
    const connection = await getConnection(service);
    if (!connection || connection.status !== 'connected') {
      return NextResponse.json(
        { error: { code: 'not_connected', message: 'Connect eBay in Settings before provisioning shipping tiers.' } },
        { status: 409 },
      );
    }
    const marketplaceId = connection.marketplace_id || 'EBAY_US';
    const { accessToken } = await ensureFreshAccessToken(service);

    const existing = await ebayFetch<{ fulfillmentPolicies?: FulfillmentPolicySummary[] }>({
      method: 'GET',
      path: '/sell/account/v1/fulfillment_policy',
      accessToken,
      query: { marketplace_id: marketplaceId },
    });
    const byName = new Map(
      (existing.data.fulfillmentPolicies ?? []).map((policy) => [policy.name, policy.fulfillmentPolicyId]),
    );

    let created = 0;
    let updated = 0;
    const tiers: Array<{ key: string; fee: number; policyId: string; action: 'created' | 'updated' }> = [];

    // Sequential on purpose: 7 small Account API calls, and a mid-run failure
    // leaves every completed tier durably mapped (safe to re-run).
    for (const tier of MARKETPLACE_SHIPPING_TIERS) {
      const name = marketplaceShippingTierLabel(tier);
      const payload = buildTierFulfillmentPolicyPayload({ name, fee: tier.fee, marketplaceId });
      const existingId = byName.get(name);
      let policyId: string;
      let action: 'created' | 'updated';

      if (existingId) {
        await ebayFetch({
          method: 'PUT',
          path: `/sell/account/v1/fulfillment_policy/${encodeURIComponent(existingId)}`,
          accessToken,
          contentLanguage: true,
          json: payload,
        });
        policyId = existingId;
        action = 'updated';
        updated += 1;
      } else {
        const res = await ebayFetch<{ fulfillmentPolicyId: string }>({
          method: 'POST',
          path: '/sell/account/v1/fulfillment_policy',
          accessToken,
          contentLanguage: true,
          json: payload,
        });
        policyId = res.data.fulfillmentPolicyId;
        action = 'created';
        created += 1;
      }

      await upsertMarketplaceShippingProfile(service, {
        marketplace: 'ebay',
        feeKey: tier.key,
        fee: tier.fee,
        externalId: policyId,
        label: name,
      });
      tiers.push({ key: tier.key, fee: tier.fee, policyId, action });
    }

    await insertSyncLog(service, {
      action: 'provision_shipping_tiers',
      outcome: 'ok',
      message: `Provisioned ${tiers.length} shipping-tier policies (${created} created, ${updated} updated).`,
      detail: { tiers },
    });

    return NextResponse.json({ created, updated, tiers });
  } catch (err) {
    const message = err instanceof MarketplaceShippingNotMigratedError
      ? err.message
      : err instanceof EbayApiError
        ? err.operatorMessage
        : err instanceof Error
          ? err.message
          : 'Could not provision eBay shipping tiers.';
    await insertSyncLog(service, {
      action: 'provision_shipping_tiers',
      outcome: 'error',
      message,
    }).catch(() => {});
    const status = err instanceof MarketplaceShippingNotMigratedError ? 503 : err instanceof EbayApiError ? err.status : 500;
    return NextResponse.json({ error: { code: 'provision_failed', message } }, { status });
  }
}
