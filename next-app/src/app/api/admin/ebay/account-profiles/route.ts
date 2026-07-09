import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { ensureFreshAccessToken } from '@/lib/ebay/auth';
import { EbayApiError, ebayFetch } from '@/lib/ebay/client';

// Proxy-read fulfillment/payment/return policies + inventory locations for
// the settings-panel dropdowns (the Etsy panel's shop-profiles twin). See
// ebay-sync-plan/rest-endpoints-used.md.

export const runtime = 'nodejs';
export const maxDuration = 30;

interface PolicySummary {
  id: string;
  name: string;
}

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const service = createServiceClient();
  try {
    const { accessToken } = await ensureFreshAccessToken(service);
    const [fulfillment, payment, returns, locations] = await Promise.all([
      ebayFetch<{ fulfillmentPolicies?: Array<{ fulfillmentPolicyId: string; name: string }> }>({
        method: 'GET',
        path: '/sell/account/v1/fulfillment_policy',
        accessToken,
        query: { marketplace_id: 'EBAY_US' },
      }),
      ebayFetch<{ paymentPolicies?: Array<{ paymentPolicyId: string; name: string }> }>({
        method: 'GET',
        path: '/sell/account/v1/payment_policy',
        accessToken,
        query: { marketplace_id: 'EBAY_US' },
      }),
      ebayFetch<{ returnPolicies?: Array<{ returnPolicyId: string; name: string }> }>({
        method: 'GET',
        path: '/sell/account/v1/return_policy',
        accessToken,
        query: { marketplace_id: 'EBAY_US' },
      }),
      ebayFetch<{ locations?: Array<{ merchantLocationKey: string; name?: string }> }>({
        method: 'GET',
        path: '/sell/inventory/v1/location',
        accessToken,
      }),
    ]);

    const fulfillmentPolicies: PolicySummary[] = (fulfillment.data.fulfillmentPolicies ?? []).map((p) => ({
      id: p.fulfillmentPolicyId,
      name: p.name,
    }));
    const paymentPolicies: PolicySummary[] = (payment.data.paymentPolicies ?? []).map((p) => ({ id: p.paymentPolicyId, name: p.name }));
    const returnPolicies: PolicySummary[] = (returns.data.returnPolicies ?? []).map((p) => ({ id: p.returnPolicyId, name: p.name }));
    const merchantLocations: PolicySummary[] = (locations.data.locations ?? []).map((l) => ({
      id: l.merchantLocationKey,
      name: l.name ?? l.merchantLocationKey,
    }));

    return NextResponse.json({ fulfillmentPolicies, paymentPolicies, returnPolicies, merchantLocations });
  } catch (err) {
    const message = err instanceof EbayApiError ? err.operatorMessage : err instanceof Error ? err.message : 'Could not load eBay account profiles.';
    const status = err instanceof EbayApiError ? err.status : 500;
    return NextResponse.json({ error: { code: err instanceof EbayApiError ? err.code : 'unknown', message } }, { status });
  }
}
