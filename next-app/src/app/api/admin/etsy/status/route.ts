import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { getConnection, getRecentSyncLog } from '@/lib/etsy/store';

export const runtime = 'nodejs';

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const service = createServiceClient();
  const connection = await getConnection(service);
  const log = await getRecentSyncLog(service, 25);

  return NextResponse.json({
    connected: connection?.status === 'connected',
    status: connection?.status ?? 'disconnected',
    shopId: connection?.shop_id ?? null,
    shopName: connection?.shop_name ?? null,
    connectedAt: connection?.connected_at ?? null,
    defaults: {
      shippingProfileId: connection?.shipping_profile_id ?? null,
      returnPolicyId: connection?.return_policy_id ?? null,
      readinessStateId: connection?.readiness_state_id ?? null,
    },
    policy: {
      autoActivate: connection?.auto_activate ?? false,
      autoDelistOnSold: connection?.auto_delist_on_sold ?? false,
      pricePushEnabled: connection?.price_push_enabled ?? false,
      pricePushThresholdPct: connection?.price_push_threshold_pct ?? 1,
      priceMarkupPct: connection?.price_markup_pct ?? 8,
    },
    recentActivity: log.map((row) => ({
      id: row.id,
      createdAt: row.created_at,
      productId: row.product_id,
      listingId: row.listing_id,
      action: row.action,
      outcome: row.outcome,
      message: row.message,
    })),
  });
}
