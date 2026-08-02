import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { updateConnection } from '@/lib/etsy/store';

export const runtime = 'nodejs';

/** Saves shop defaults + sync policy (etsy-sync-plan/07-admin-ux.md "Defaults block"). */
export async function PUT(req: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if ('shippingProfileId' in body) patch.shipping_profile_id = body.shippingProfileId ? Number(body.shippingProfileId) : null;
  if ('returnPolicyId' in body) patch.return_policy_id = body.returnPolicyId ? Number(body.returnPolicyId) : null;
  if ('readinessStateId' in body) patch.readiness_state_id = body.readinessStateId ? Number(body.readinessStateId) : null;
  if ('autoActivate' in body) patch.auto_activate = Boolean(body.autoActivate);
  if ('autoDelistOnSold' in body) patch.auto_delist_on_sold = Boolean(body.autoDelistOnSold);
  if ('pricePushEnabled' in body) patch.price_push_enabled = Boolean(body.pricePushEnabled);

  if ('pricePushThresholdPct' in body) {
    const value = Number(body.pricePushThresholdPct);
    if (!Number.isFinite(value) || value < 0) {
      return NextResponse.json({ error: 'Price push threshold must be a non-negative number.' }, { status: 400 });
    }
    patch.price_push_threshold_pct = value;
  }
  if ('priceMarkupPct' in body) {
    const value = Number(body.priceMarkupPct);
    if (!Number.isFinite(value) || value < 0) {
      return NextResponse.json({ error: 'Price markup must be a non-negative number.' }, { status: 400 });
    }
    patch.price_markup_pct = value;
  }

  const service = createServiceClient();
  try {
    await updateConnection(service, patch);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not save settings.' }, { status: 500 });
  }
}
