import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { fetchSpotData } from '@/lib/spot-price';
import { buildPreflightChecks, isPreflightPassing } from '@/lib/etsy/mapping';
import { getConnection, getListingsMap } from '@/lib/etsy/store';
import { isReadyToPublishEtsyListing, scanAndMarkOutOfDate } from '@/lib/etsy/sync';
import type { Product } from '@/types/product';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * Pre-flight summary for the "Sync all to Etsy" confirm screen
 * (etsy-sync-plan/07-admin-ux.md §3: "32 eligible · 9 ineligible · 4 already
 * up to date · 3 errors"). Free — no Etsy calls, same dry-run mapper the
 * per-product preview uses.
 */
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  // Defensive backstop: the primary content-change detection runs on every
  // product save (adminRevalidateProduct/-Products, fire-and-forget), but a
  // save-time hiccup shouldn't leave a real price change permanently
  // invisible to "Sync all" — confirmed live 2026-07-10 (scanAndMarkOutOfDate
  // existed but was never called from anywhere, so no price edit was ever
  // detected). Re-checking here whenever the owner opens this dialog closes
  // that gap regardless of what happened before.
  await scanAndMarkOutOfDate().catch(() => {});

  const service = createServiceClient();
  const connection = await getConnection(service);
  const spotData = await fetchSpotData();
  const { data } = await service.from('products').select('*').eq('status', 'available');
  const products = (data ?? []) as Product[];
  const listings = await getListingsMap(service);

  let eligible = 0;
  let ineligible = 0;
  let upToDate = 0;
  let errors = 0;
  // Title + the first failing check's message, so the owner sees WHY an item is
  // ineligible (not just its name) — e.g. "No Etsy category is mapped…".
  const ineligibleSamples: { title: string; reason: string }[] = [];

  for (const product of products) {
    const listing = listings[product.id];
    if (listing?.sync_state === 'error') {
      errors += 1;
      continue;
    }
    if (listing?.sync_state === 'active' || listing?.sync_state === 'draft_review') {
      upToDate += 1;
      continue;
    }
    const taxonomyOverride = listing?.taxonomy_override_id
      ? { id: listing.taxonomy_override_id, path: listing.taxonomy_override_path ?? '' }
      : null;
    const preflight = buildPreflightChecks(product, connection, spotData, taxonomyOverride);
    if (isPreflightPassing(preflight)) {
      eligible += 1;
    } else {
      ineligible += 1;
      if (ineligibleSamples.length < 10) {
        const firstFail = preflight.find((c) => !c.ok);
        ineligibleSamples.push({ title: product.title, reason: firstFail?.message ?? firstFail?.check ?? 'ineligible' });
      }
    }
  }

  const readyToPublish = Object.values(listings).filter(isReadyToPublishEtsyListing).length;

  return NextResponse.json({ total: products.length, eligible, ineligible, upToDate, errors, readyToPublish, ineligibleSamples });
}
