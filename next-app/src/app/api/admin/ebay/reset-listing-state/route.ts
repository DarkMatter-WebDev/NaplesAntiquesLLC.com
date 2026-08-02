import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/service';
import {
  deleteAllListingRows,
  getAllListingRowSummaries,
  insertSyncLog,
  summarizeEbayListingRows,
  updateConnection,
} from '@/lib/ebay/store';

// Account-change reset for the eBay sync (owner runbook in TASKS.md /
// features/ebay-sync.md): clears every local ebay_listings row — and the
// account-scoped orders cursor — so a NEWLY CONNECTED eBay account can
// publish the catalog as fresh offers. Without this, existing rows are
// deliberately treated as updates against the old account's offers
// (sync.ts enqueue semantics), which the new token cannot see.
//
// Destructive-operation safety (AGENTS.md): the default call is a DRY RUN
// that only reports what would be deleted; the deletion runs only when the
// body carries { confirm: true }. Listings on eBay itself are never touched
// — end/delist the old account's live listings before disconnecting it.
// The action is recorded in ebay_sync_log either way deletion runs.

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json().catch(() => null) as { confirm?: boolean } | null;
  const confirm = body?.confirm === true;

  const service = createServiceClient();
  try {
    const summary = summarizeEbayListingRows(await getAllListingRowSummaries(service));

    if (!confirm) {
      return NextResponse.json({ dryRun: true, ...summary });
    }

    const deleted = await deleteAllListingRows(service);
    // The order-polling cursor is account-scoped state on the connection row;
    // a new account starts from a fresh cursor.
    await updateConnection(service, { orders_cursor: null });
    await insertSyncLog(service, {
      action: 'reset_listing_state',
      outcome: 'ok',
      message: `Account-change reset: deleted ${deleted} local listing record(s) and cleared the orders cursor. eBay listings themselves were not touched.`,
      detail: { deleted, byState: summary.byState, withListingIds: summary.withListingIds },
    });

    return NextResponse.json({ reset: true, deleted, byState: summary.byState });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not reset eBay listing state.';
    await insertSyncLog(service, { action: 'reset_listing_state', outcome: 'error', message }).catch(() => {});
    return NextResponse.json({ error: { code: 'reset_failed', message } }, { status: 500 });
  }
}
