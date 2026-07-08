import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { requireAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/service';
import {
  fetchShowSoldItems,
  saveShowSoldItems,
  fetchSpecialPriceDefault,
  saveSpecialPriceDefault,
} from '@/lib/shop-settings';

export const runtime = 'nodejs';

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const service = createServiceClient();
    const [showSoldItems, specialPriceDefault] = await Promise.all([
      fetchShowSoldItems(service),
      fetchSpecialPriceDefault(service),
    ]);
    return NextResponse.json({ showSoldItems, specialPriceDefault });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load shop settings.' },
      { status: 500 },
    );
  }
}

export async function PUT(req: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'A settings patch is required.' }, { status: 400 });
  }

  const service = createServiceClient();
  let touched = false;

  try {
    if (typeof body.showSoldItems === 'boolean') {
      await saveShowSoldItems(service, body.showSoldItems);
      touched = true;
    }

    // Site-wide trade-in default — either field present means "update it".
    if ('specialPriceDefaultEnabled' in body || 'specialPriceDefaultPercent' in body) {
      const enabled = Boolean(body.specialPriceDefaultEnabled);
      const raw = body.specialPriceDefaultPercent;
      let percent: number | null = null;
      if (raw !== null && raw !== undefined && raw !== '') {
        const n = Number(raw);
        if (!Number.isFinite(n)) {
          return NextResponse.json({ error: 'The percent must be a number (e.g. 10, or -5 for below spot).' }, { status: 400 });
        }
        percent = n;
      }
      await saveSpecialPriceDefault(service, { enabled, percent });
      touched = true;
    }

    if (!touched) {
      return NextResponse.json({ error: 'No recognized settings to update.' }, { status: 400 });
    }

    // The public storefront reads these; bust the cached shop-catalog read so
    // list-view changes reflect immediately. Individual product pages are
    // time-revalidated (ISR, ~5 min) like the spot-price values they show.
    revalidateTag('shop-catalog', { expire: 0 });

    const [showSoldItems, specialPriceDefault] = await Promise.all([
      fetchShowSoldItems(service),
      fetchSpecialPriceDefault(service),
    ]);
    return NextResponse.json({ showSoldItems, specialPriceDefault });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to save shop settings.' },
      { status: 500 },
    );
  }
}
