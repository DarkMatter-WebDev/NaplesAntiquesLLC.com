import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { countDraftReviewListings } from '@/lib/etsy/store';

export const runtime = 'nodejs';

/** Cheap local count for the explicit Etsy go-live confirmation screen. */
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const readyToPublish = await countDraftReviewListings(createServiceClient());
    return NextResponse.json({ readyToPublish });
  } catch (caught) {
    return NextResponse.json(
      { error: caught instanceof Error ? caught.message : 'Could not count Etsy drafts ready to publish.' },
      { status: 500 },
    );
  }
}
