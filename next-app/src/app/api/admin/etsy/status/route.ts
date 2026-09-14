import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/service';
import {
  getConnection,
  getLastSalesCheck,
  getLastScheduledPricePush,
  getLastStatusCheck,
  getRecentSyncLog,
  type EtsySyncLogRow,
} from '@/lib/etsy/store';
import { resolvePricePushHealth } from '@/lib/marketplace-price-push-health';
import { hasSalesScope } from '@/lib/marketplace-sales';
import type { StatusCheckRow } from '@/lib/marketplace-status-checks';

function toStatusCheckRow(row: EtsySyncLogRow | null): StatusCheckRow | null {
  return row ? { createdAt: row.created_at, outcome: row.outcome, message: row.message ?? null, detail: row.detail ?? null } : null;
}

export const runtime = 'nodejs';

// Matches the pg_cron Etsy price-push job in
// supabase/scheduled-jobs-pg-cron-2026-09.sql (`'15 11 * * *'`, UTC).
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
  // The 30-minute sales sweep + status reconcile heartbeat (Admin "30-minute checks" card).
  const [lastStatusCheck, lastSalesCheck] = await Promise.all([getLastStatusCheck(service), getLastSalesCheck(service)]);
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
      autoMarkSold: connection?.auto_mark_sold ?? true,
    },
    // Marketplace sales → site sold (2026-09-12). `scopeGranted` false means
    // the connection predates the transactions_r scope: reconnect to enable.
    salesSync: {
      scopeGranted: hasSalesScope('etsy', connection?.scopes),
      watchingSince: connection?.sales_cursor ?? null,
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
    statusChecks: {
      lastCheck: toStatusCheckRow(lastStatusCheck),
      lastSales: toStatusCheckRow(lastSalesCheck),
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
