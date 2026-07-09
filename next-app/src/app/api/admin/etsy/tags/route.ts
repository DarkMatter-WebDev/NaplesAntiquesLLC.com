import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { upsertListing } from '@/lib/etsy/store';

export const runtime = 'nodejs';

// Upper bounds are generous — mapTags() re-cleans, clamps to 20 chars, dedupes,
// and enforces Etsy's 13-tag cap at build time. These just keep the stored value
// sane and prevent an unbounded write.
const MAX_STORED_TAGS = 20;
const MAX_TAG_LENGTH = 60;

/**
 * Save (or clear) the owner-supplied custom Etsy tags for a product
 * (etsy_listings.extra_tags). These are merged into the auto-generated tags by
 * mapTags() — see the "Additional tags" field in the product drawer's Etsy
 * section. An empty list clears them.
 */
export async function PUT(req: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json().catch(() => null);
  const productId = typeof body?.productId === 'string' ? body.productId : null;
  if (!productId) return NextResponse.json({ error: 'Missing productId.' }, { status: 400 });

  const rawTags = Array.isArray(body?.tags) ? body.tags : [];
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const raw of rawTags) {
    if (typeof raw !== 'string') continue;
    const cleaned = raw.trim().replace(/\s+/g, ' ').slice(0, MAX_TAG_LENGTH);
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(cleaned);
    if (tags.length >= MAX_STORED_TAGS) break;
  }

  const service = createServiceClient();
  try {
    // Store null (not []) when empty so it reads cleanly as "no custom tags".
    await upsertListing(service, productId, { extra_tags: tags.length ? tags : null });
    return NextResponse.json({ success: true, tags });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not save the tags.' }, { status: 500 });
  }
}
