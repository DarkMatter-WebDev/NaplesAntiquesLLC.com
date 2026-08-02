import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';

/**
 * Short product links for social posts: /p/<inventory#> -> /shop/<product>.
 *
 * Facebook (and most social surfaces) linkify whatever URL text is in the
 * post — anchor text with a hidden href is not possible — so the only way to
 * show a tidy link is for the URL itself to be short. Inventory numbers are
 * the shortest stable public handle a piece has.
 *
 * 302 rather than 301 on purpose: product slugs have been re-slugged before
 * (see the reslug redirects in next.config.ts), and a cached permanent
 * redirect in someone's browser would outlive such a change.
 *
 * Unknown or ambiguous codes land on /shop rather than a 404 — a social click
 * should always end somewhere sellable.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const numeric = Number(String(code).replace(/\D/g, ''));

  if (Number.isInteger(numeric) && numeric > 0) {
    const service = createServiceClient();
    const { data } = await service
      .from('products')
      .select('id')
      .eq('inventory_number', numeric)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data?.id) {
      return NextResponse.redirect(
        new URL(`/shop/${encodeURIComponent(data.id)}`, _req.url),
        302,
      );
    }
  }

  return NextResponse.redirect(new URL('/shop', _req.url), 302);
}
