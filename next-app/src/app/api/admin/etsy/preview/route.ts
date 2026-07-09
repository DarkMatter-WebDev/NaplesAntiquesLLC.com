import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { fetchSpotData } from '@/lib/spot-price';
import { buildMappedPayload, buildPreflightChecks, isPreflightPassing } from '@/lib/etsy/mapping';
import { getConnection, getListing } from '@/lib/etsy/store';
import { parseWearableLengthInches } from '@/lib/etsy/length-experiment';
import { parseRingSize, decimalToRingSizeFraction } from '@/lib/etsy/ring-size-experiment';
import type { Product } from '@/types/product';
import { normalizeProductJewelryType } from '@/types/product';

export const runtime = 'nodejs';

/** Dry-run: mapped payload + pre-flight results. No Etsy writes, no Etsy reads. */
export async function POST(req: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json().catch(() => null);
  const productId = typeof body?.productId === 'string' ? body.productId : null;
  if (!productId) return NextResponse.json({ error: 'Missing productId.' }, { status: 400 });

  const service = createServiceClient();
  const { data: product, error: productError } = await service.from('products').select('*').eq('id', productId).maybeSingle();
  if (productError || !product) return NextResponse.json({ error: 'Product not found.' }, { status: 404 });

  const connection = await getConnection(service);
  const spotData = await fetchSpotData();
  const typedProduct = product as Product;

  // Best-effort: a missing etsy_listings table (pre-migration) just means
  // "no override yet", not a broken preview.
  const listing = await getListing(service, productId).catch(() => null);
  const taxonomyOverride = listing?.taxonomy_override_id
    ? { id: listing.taxonomy_override_id, path: listing.taxonomy_override_path ?? '' }
    : null;
  const extraTags = listing?.extra_tags ?? null;

  const preflight = buildPreflightChecks(typedProduct, connection, spotData, taxonomyOverride);
  const payload = buildMappedPayload(typedProduct, connection, spotData, taxonomyOverride, extraTags);
  // Authoritative product-type signal for the admin UI (e.g. deciding whether
  // to show the length vs ring-size preview row) — more reliable than the
  // client trying to pattern-match taxonomyPath text.
  const productType = normalizeProductJewelryType(typedProduct.product_type ?? typedProduct.jewelry_type);

  // Structured properties that auto-push during sync (length / ring size),
  // surfaced in the dry-run so the owner reviews and approves them by syncing
  // — no separate manual test. Pure, no Etsy calls: the real property-id/scale
  // discovery and read-back verification happen at sync time (see
  // length-experiment.ts / ring-size-experiment.ts). Gating matches sync.ts
  // exactly against the closed ProductJewelryType union — Ring => ring size;
  // every other real type (i.e. not Ring/Other/null, == LENGTH_BEARING_PRODUCT_TYPES)
  // => wearable length.
  let lengthPreview: string | null = null;
  let ringSizePreview: string | null = null;
  if (productType === 'Ring') {
    const size = parseRingSize(typedProduct.length);
    ringSizePreview = size != null ? decimalToRingSizeFraction(size) : null;
  } else if (productType != null && productType !== 'Other') {
    const inches = parseWearableLengthInches(typedProduct.length);
    lengthPreview = inches != null ? `${inches} in` : null;
  }

  return NextResponse.json({
    eligible: isPreflightPassing(preflight),
    preflight,
    payload,
    productType,
    structuredProperties: { length: lengthPreview, ringSize: ringSizePreview },
    // The raw owner-supplied custom tags (not the merged set in payload.tags) so
    // the admin drawer can prefill its editable "additional tags" field.
    extraTags: extraTags ?? [],
  });
}
