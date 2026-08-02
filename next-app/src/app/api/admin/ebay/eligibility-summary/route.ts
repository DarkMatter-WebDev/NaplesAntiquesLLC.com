import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { fetchSpotData } from '@/lib/spot-price';
import type { Product } from '@/types/product';
import { buildPreflightChecks, isPreflightPassing, type EbayConnectionDefaults } from '@/lib/ebay/mapping';
import { getConnection, getListingsMap, type EbayConnectionRow } from '@/lib/ebay/store';
import { scanAndMarkOutOfDate } from '@/lib/ebay/sync';

// Free (no eBay calls) bulk pre-flight counts for the "Sync all to eBay"
// confirm screen — the Etsy eligibility-summary route's twin.

export const runtime = 'nodejs';
export const maxDuration = 30;

function toConnectionDefaults(connection: EbayConnectionRow | null): EbayConnectionDefaults | null {
  if (!connection) return null;
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

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  // Defensive backstop — same reasoning as the Etsy twin route: the primary
  // content-change detection runs on every product save (fire-and-forget),
  // so re-check here too whenever the owner opens "Sync all to eBay".
  await scanAndMarkOutOfDate().catch(() => {});

  const service = createServiceClient();
  const [{ data: products }, connectionRow, spotData, listingsMap] = await Promise.all([
    service.from('products').select('*').eq('status', 'available'),
    getConnection(service),
    fetchSpotData().catch(() => null),
    getListingsMap(service),
  ]);
  const connection = toConnectionDefaults(connectionRow);

  let eligible = 0;
  let ineligible = 0;
  let upToDate = 0;
  let errors = 0;
  const ineligibleSamples: Array<{ title: string; reason: string }> = [];

  for (const productRow of (products ?? []) as Product[]) {
    const listing = listingsMap[productRow.id];
    if (listing?.sync_state === 'error') errors += 1;

    const checks = buildPreflightChecks(productRow, connection, spotData);
    if (isPreflightPassing(checks)) {
      eligible += 1;
      if (listing && (listing.sync_state === 'published' || listing.sync_state === 'hidden_oos')) upToDate += 1;
    } else {
      ineligible += 1;
      if (ineligibleSamples.length < 10) {
        const reason = checks.find((check) => !check.ok)?.message ?? 'Not eligible.';
        ineligibleSamples.push({ title: productRow.title, reason });
      }
    }
  }

  // Prepared-but-not-live listings the owner can bulk-publish. Counted across
  // the whole listings map (not just available products) so an item that went
  // unavailable after being prepared still shows up for the publish flow.
  const readyToPublish = Object.values(listingsMap).filter((listing) => listing.sync_state === 'review').length;

  return NextResponse.json({
    total: (products ?? []).length,
    eligible,
    ineligible,
    upToDate,
    errors,
    readyToPublish,
    ineligibleSamples,
  });
}
