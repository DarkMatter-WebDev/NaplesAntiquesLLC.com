import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { ensureFreshAccessToken } from '@/lib/ebay/auth';
import { EbayApiError, ebayFetch } from '@/lib/ebay/client';
import { updateConnection } from '@/lib/ebay/store';

// One-time inventory-location setup (ebay-sync-plan/06-account-prerequisites.md
// step 6, ebay-sync-plan/OWNER-SETUP.md step 8 item 4). Not run automatically
// at connect time — createInventoryLocation needs the business's real postal
// code, which isn't stored anywhere else in this codebase, so an admin
// supplies it explicitly here rather than the code guessing at one. Uses the
// already-connected session's access token (ensureFreshAccessToken) — no
// separate credentials needed.

export const runtime = 'nodejs';
export const maxDuration = 30;

// Immutable once created (eBay rule) — a stable, human-readable key.
const MERCHANT_LOCATION_KEY = 'nej-naples-fl';

export async function POST(req: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  let body: { postalCode?: string; country?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: { code: 'invalid_json', message: 'Invalid JSON body.' } }, { status: 400 });
  }

  const postalCode = (body.postalCode ?? '').trim();
  if (!postalCode) {
    return NextResponse.json({ error: { code: 'missing_postal_code', message: 'A postal code is required.' } }, { status: 400 });
  }
  const country = (body.country ?? 'US').trim().toUpperCase();

  const service = createServiceClient();
  try {
    const { accessToken } = await ensureFreshAccessToken(service);
    await ebayFetch({
      method: 'POST',
      path: `/sell/inventory/v1/location/${encodeURIComponent(MERCHANT_LOCATION_KEY)}`,
      accessToken,
      contentLanguage: true,
      json: {
        location: { address: { postalCode, country } },
        locationTypes: ['WAREHOUSE'],
      },
    });
    await updateConnection(service, { merchant_location_key: MERCHANT_LOCATION_KEY });
    return NextResponse.json({ success: true, merchantLocationKey: MERCHANT_LOCATION_KEY });
  } catch (err) {
    // A second attempt with the same key/address is expected to be a no-op
    // or a "location already exists" style error from eBay — treat it as
    // success and adopt the key locally rather than surfacing a scary error
    // for a harmless retry.
    if (err instanceof EbayApiError && (err.status === 409 || /already exists|duplicate/i.test(err.operatorMessage))) {
      await updateConnection(service, { merchant_location_key: MERCHANT_LOCATION_KEY });
      return NextResponse.json({ success: true, merchantLocationKey: MERCHANT_LOCATION_KEY, alreadyExisted: true });
    }
    const message = err instanceof EbayApiError ? err.operatorMessage : err instanceof Error ? err.message : 'Could not create the inventory location.';
    const status = err instanceof EbayApiError ? err.status : 500;
    return NextResponse.json({ error: { code: err instanceof EbayApiError ? err.code : 'unknown', message } }, { status });
  }
}
