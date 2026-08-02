import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { fetchSpotData } from '@/lib/spot-price';
import type { Product } from '@/types/product';
import { buildMappedPayload, buildPreflightChecks, isPreflightPassing, type EbayConnectionDefaults } from '@/lib/ebay/mapping';
import { getConnection, getListing, type EbayConnectionRow } from '@/lib/ebay/store';
import { getMarketplaceShippingProfileMap } from '@/lib/marketplace-shipping';

// Dry-run: what WOULD be pushed, with pre-flight results. No eBay writes.

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

export async function POST(req: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  let body: { productId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: { code: 'invalid_json', message: 'Invalid JSON body.' } }, { status: 400 });
  }
  if (!body.productId) {
    return NextResponse.json({ error: { code: 'missing_product_id', message: 'productId is required.' } }, { status: 400 });
  }

  const service = createServiceClient();
  const { data: productRow } = await service.from('products').select('*').eq('id', body.productId).maybeSingle();
  if (!productRow) {
    return NextResponse.json({ error: { code: 'not_found', message: 'Product not found.' } }, { status: 404 });
  }
  const product = productRow as Product;

  const [connectionRow, spotData, listing, tierPolicyMap] = await Promise.all([
    getConnection(service),
    fetchSpotData().catch(() => null),
    getListing(service, body.productId),
    getMarketplaceShippingProfileMap(service, 'ebay').catch(() => ({} as Record<string, string>)),
  ]);
  const connection = toConnectionDefaults(connectionRow);

  const preflight = buildPreflightChecks(product, connection, spotData);
  const payload = buildMappedPayload(product, connection, spotData, undefined, tierPolicyMap);

  return NextResponse.json({
    eligible: isPreflightPassing(preflight),
    preflight,
    payload,
    listing: listing
      ? { syncState: listing.sync_state, ebayListingId: listing.ebay_listing_id, ebayOfferId: listing.ebay_offer_id, lastError: listing.last_error }
      : null,
    // getListingFees is only meaningful once a live unpublished offer exists
    // — not called from dry-run to avoid an eBay round trip before an item
    // is even queued (see ebay-sync-plan/09-api-routes.md's preview shape).
    fees: null,
  });
}
