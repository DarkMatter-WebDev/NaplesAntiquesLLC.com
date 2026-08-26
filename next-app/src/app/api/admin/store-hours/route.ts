import { NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { requireAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { SHOP_SETTINGS_TABLE } from '@/lib/shop-settings';
import { WEEK_ORDER, type StoreDayHours, type StoreHoursSchedule } from '@/lib/business-location';
import { DEFAULT_STORE_HOURS, STORE_HOURS_CACHE_TAG, TIME_RE, parseStoreHours } from '@/lib/store-hours';

export const runtime = 'nodejs';

const MIGRATION_HINT = 'Run supabase/store-hours-2026-08.sql in the Supabase SQL Editor first.';

function isMissingColumnError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String((err as { message?: string })?.message ?? '');
  return message.toLowerCase().includes('store_hours');
}

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const service = createServiceClient();
    const { data, error: dbError } = await service
      .from(SHOP_SETTINGS_TABLE)
      .select('store_hours')
      .eq('id', true)
      .maybeSingle();
    // Pre-migration (missing column) still serves the defaults so the panel
    // works; the save is what surfaces the actionable migration message.
    const schedule = dbError ? null : parseStoreHours(data?.store_hours);
    return NextResponse.json({
      schedule: schedule ?? DEFAULT_STORE_HOURS,
      isDefault: schedule === null,
    });
  } catch {
    return NextResponse.json({ schedule: DEFAULT_STORE_HOURS, isDefault: true });
  }
}

/**
 * Validate a PUT body into a schedule with a PER-FIELD error message —
 * `parseStoreHours()` is the same rule set but collapses every defect to null,
 * which is right for reads and useless for a form. Keep the two in sync.
 */
function validateScheduleBody(value: unknown): { schedule: StoreHoursSchedule } | { error: string } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { error: 'A weekly schedule object is required.' };
  }
  const record = value as Record<string, unknown>;
  const unknownKey = Object.keys(record).find((key) => !(WEEK_ORDER as readonly string[]).includes(key));
  if (unknownKey) return { error: `Unknown day "${unknownKey}".` };

  const schedule = {} as StoreHoursSchedule;
  for (const day of WEEK_ORDER) {
    const entry = record[day];
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      return { error: `${day} is missing.` };
    }
    const { open, opens, closes } = entry as Partial<StoreDayHours>;
    if (typeof open !== 'boolean') return { error: `${day}: open must be true or false.` };
    if (typeof opens !== 'string' || !TIME_RE.test(opens)) {
      return { error: `${day}: opening time must be HH:MM (24-hour).` };
    }
    if (typeof closes !== 'string' || !TIME_RE.test(closes)) {
      return { error: `${day}: closing time must be HH:MM (24-hour).` };
    }
    // Zero-padded HH:MM sorts lexicographically, so string compare is exact.
    if (open && closes <= opens) {
      return { error: `${day}: the closing time must be after the opening time.` };
    }
    schedule[day] = { open, opens, closes };
  }
  // All-closed is deliberately ALLOWED — the site then reads "By appointment
  // only" everywhere. The panel warns; the API does not block.
  return { schedule };
}

export async function PUT(req: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json().catch(() => null);
  const validated = validateScheduleBody((body as { schedule?: unknown } | null)?.schedule);
  if ('error' in validated) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  try {
    const service = createServiceClient();
    const { error: dbError } = await service
      .from(SHOP_SETTINGS_TABLE)
      .upsert(
        { id: true, store_hours: validated.schedule, updated_at: new Date().toISOString() },
        { onConflict: 'id' },
      );
    if (dbError) {
      return NextResponse.json(
        { error: isMissingColumnError(dbError) ? MIGRATION_HINT : dbError.message },
        { status: 500 },
      );
    }

    // Hours print on EVERY page (the footer), in both locales, and most pages
    // are statically prerendered — so bust the data-layer cache and then the
    // whole page tree. Edits are rare; a sitewide regeneration is the honest
    // invalidation, and enumerating ~20 paths × 2 locales would be strictly
    // more fragile.
    revalidateTag(STORE_HOURS_CACHE_TAG, { expire: 0 });
    revalidatePath('/', 'layout');

    return NextResponse.json({ schedule: validated.schedule, isDefault: false });
  } catch (err) {
    return NextResponse.json(
      {
        error: isMissingColumnError(err)
          ? MIGRATION_HINT
          : err instanceof Error
            ? err.message
            : 'Failed to save store hours.',
      },
      { status: 500 },
    );
  }
}
