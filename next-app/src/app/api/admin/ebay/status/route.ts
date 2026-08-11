import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { getConnection, getLastScheduledPricePush, getRecentSyncLog } from '@/lib/ebay/store';
import { resolvePricePushHealth } from '@/lib/marketplace-price-push-health';

export const runtime = 'nodejs';

// Matches netlify/functions/ebay-price-push.mts (`schedule: '45 11 * * *'`).
const SCHEDULE_UTC_HOUR = 11;
const SCHEDULE_UTC_MINUTE = 45;

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const service = createServiceClient();
  const connection = await getConnection(service);
  const recentActivity = await getRecentSyncLog(service, 25, { excludeActions: ['account_deletion'] });
  // Queried directly, not found inside `recentActivity` — see
  // getLastScheduledPricePush. This log is the worse case of the two: the
  // account-deletion webhook alone has written 56k rows.
  const lastScheduledRun = await getLastScheduledPricePush(service);
  const cronSecretConfigured = Boolean(process.env.EBAY_CRON_SECRET);
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
    priceAutomation: {
      cronSecretConfigured,
      schedule: 'Daily at 11:45 UTC',
      health,
      lastRun: lastScheduledRun
        ? {
            createdAt: lastScheduledRun.created_at,
            outcome: lastScheduledRun.outcome,
            message: lastScheduledRun.message,
          }
        : null,
    },
    sellingLimit: {
      amount: connection?.selling_limit_amount ?? null,
      quantity: connection?.selling_limit_quantity ?? null,
      checkedAt: connection?.selling_limit_checked_at ?? null,
    },
    recentActivity,
  });
}
