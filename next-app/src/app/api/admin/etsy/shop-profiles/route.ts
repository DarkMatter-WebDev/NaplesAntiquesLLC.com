import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { ensureFreshAccessToken } from '@/lib/etsy/auth';
import { EtsyApiError, etsyFetch } from '@/lib/etsy/client';

export const runtime = 'nodejs';

/** Proxy-reads shipping profiles / return policies / readiness states for the Settings dropdowns. */
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const service = createServiceClient();
  try {
    const { accessToken, shopId } = await ensureFreshAccessToken(service);

    const [shipping, returns, readiness] = await Promise.all([
      etsyFetch<{ results: { shipping_profile_id: number; title: string }[] }>({
        path: `/v3/application/shops/${shopId}/shipping-profiles`,
        accessToken,
      }),
      etsyFetch<{ results: { return_policy_id: number; accepts_returns: boolean; accepts_exchanges: boolean }[] }>({
        path: `/v3/application/shops/${shopId}/policies/return`,
        accessToken,
      }),
      // Confirmed 2026-07-08 against the full local OpenAPI spec:
      // getShopReadinessStateDefinitions, GET on this exact path, response
      // schema ShopProcessingProfiles -> ShopProcessingProfile[]. No `name`
      // field exists (an earlier guess assumed one) — the real label fields
      // are `readiness_state` (enum: ready_to_ship | made_to_order) and
      // `processing_days_display_label` (e.g. "3 - 5 days").
      etsyFetch<{
        results: { readiness_state_id: number; readiness_state?: string; processing_days_display_label?: string }[];
      }>({
        path: `/v3/application/shops/${shopId}/readiness-state-definitions`,
        accessToken,
      }),
    ]);

    return NextResponse.json({
      shippingProfiles: shipping.data.results ?? [],
      returnPolicies: returns.data.results ?? [],
      readinessStates: readiness.data.results ?? [],
    });
  } catch (err) {
    const message = err instanceof EtsyApiError ? err.operatorMessage : err instanceof Error ? err.message : 'Could not load shop profiles.';
    return NextResponse.json({ error: message }, { status: err instanceof EtsyApiError ? err.status : 500 });
  }
}
