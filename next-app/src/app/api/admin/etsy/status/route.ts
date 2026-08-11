import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { getConnection, getLastScheduledPricePush, getRecentSyncLog } from '@/lib/etsy/store';
import { resolvePricePushHealth } from '@/lib/marketplace-price-push-health';

export const runtime = 'nodejs';

// Matches netlify/functions/etsy-price-push.mts (`schedule: '15 11 * * *'`).
const SCHEDULE_UTC_HOUR = 11;
const SCHEDULE_UTC_MINUTE = 15;

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const service = createServiceClient();
  const connection = await getConnection(service);
  const log = await getRecentSyncLog(service, 25);
  // Queried directly, not found inside `log` — see getLastScheduledPricePush.
  const lastScheduledRun = await getLastScheduledPricePush(service);
  const cronSecretConfigured = Boolean(process.env.ETSY_CRON_SECRET);
  const health = resolvePricePushHealth({
    enabled: connection?.price_push_enabled ?? false,
    cronSecretConfigured,
    lastRunAt: lastScheduledRun?.created_at ?? null,
    scheduleUtcHour: SCHEDULE_UTC_HOUR,
    scheduleUtcMinute: SCHEDULE_UTC_MINUTE,
  });

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
    priceAutomation: {
      cronSecretConfigured,
      schedule: 'Daily at 11:15 UTC',
      health,
      lastRun: lastScheduledRun
        ? {
            createdAt: lastScheduledRun.created_at,
            outcome: lastScheduledRun.outcome,
            message: lastScheduledRun.message,
          }
        : null,
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
