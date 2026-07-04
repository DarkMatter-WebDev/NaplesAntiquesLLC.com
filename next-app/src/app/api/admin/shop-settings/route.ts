import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { requireAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { fetchShowSoldItems, saveShowSoldItems } from '@/lib/shop-settings';

export const runtime = 'nodejs';

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const service = createServiceClient();
    const showSoldItems = await fetchShowSoldItems(service);
    return NextResponse.json({ showSoldItems });
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
  if (typeof body?.showSoldItems !== 'boolean') {
    return NextResponse.json({ error: 'showSoldItems (boolean) is required.' }, { status: 400 });
  }

  try {
    const service = createServiceClient();
    await saveShowSoldItems(service, body.showSoldItems);
    // The public shop catalog read is cached under the `shop-catalog` tag and
    // reads this setting; bust it so the change is reflected immediately.
    revalidateTag('shop-catalog', { expire: 0 });
    return NextResponse.json({ showSoldItems: body.showSoldItems });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to save shop settings.' },
      { status: 500 },
    );
  }
}
