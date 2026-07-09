import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { getConnection, getRecentSyncLog } from '@/lib/ebay/store';

export const runtime = 'nodejs';

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const service = createServiceClient();
  const connection = await getConnection(service);
  const recentActivity = await getRecentSyncLog(service, 25);

  return NextResponse.json({
    connected: connection?.status === 'connected',
    status: connection?.status ?? 'disconnected',
    ebayUsername: connection?.ebay_username ?? null,
    connectedAt: connection?.connected_at ?? null,
    refreshTokenExpiresAt: connection?.refresh_token_expires_at ?? null,
    defaults: {
      fulfillmentPolicyId: connection?.fulfillment_policy_id ?? null,
      expressFulfillmentPolicyId: connection?.express_fulfillment_policy_id ?? null,
      highValueShippingThreshold: connection?.high_value_shipping_threshold ?? 1000,
      paymentPolicyId: connection?.payment_policy_id ?? null,
      returnPolicyId: connection?.return_policy_id ?? null,
      merchantLocationKey: connection?.merchant_location_key ?? null,
    },
    policy: {
      autoPublish: connection?.auto_publish ?? false,
      soldHandling: connection?.sold_handling ?? 'quantity_zero',
      bestOfferEnabled: connection?.best_offer_enabled ?? false,
      pricePushEnabled: connection?.price_push_enabled ?? false,
      pricePushThresholdPct: connection?.price_push_threshold_pct ?? 1,
      priceMarkupPct: connection?.price_markup_pct ?? 15,
    },
    sellingLimit: {
      amount: connection?.selling_limit_amount ?? null,
      quantity: connection?.selling_limit_quantity ?? null,
      checkedAt: connection?.selling_limit_checked_at ?? null,
    },
    recentActivity,
  });
}
