import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import {
  isDiscountType,
  isValidDiscountCodeFormat,
  MAX_DISCOUNT_CODE_LENGTH,
  normalizeDiscountCode,
  type DiscountType,
} from '@/lib/discount-codes';

export const runtime = 'nodejs';

const SELECT_COLUMNS =
  'id, code, discount_type, discount_value, min_order_subtotal, expires_at, max_redemptions, times_used, active, notes, created_at, updated_at';

type ParsedFields = {
  code: string;
  discount_type: DiscountType;
  discount_value: number;
  min_order_subtotal: number | null;
  expires_at: string | null;
  max_redemptions: number | null;
  active: boolean;
  notes: string | null;
};

/** Optional positive number, or null when the field is blank/absent. */
function optionalNumber(raw: unknown): { ok: true; value: number | null } | { ok: false } {
  if (raw === null || raw === undefined || raw === '') return { ok: true, value: null };
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) return { ok: false };
  return { ok: true, value };
}

/**
 * Validate a create/update payload. Mirrors the CHECK constraints in
 * supabase/discount-codes-2026-08.sql — the database is the real guarantee,
 * this exists so the admin gets a readable message instead of a raw
 * constraint-violation string.
 */
function parseFields(body: Record<string, unknown>): { ok: true; fields: ParsedFields } | { ok: false; error: string } {
  const code = normalizeDiscountCode(typeof body.code === 'string' ? body.code : '');
  if (!code) return { ok: false, error: 'A code is required.' };
  if (!isValidDiscountCodeFormat(code)) {
    return {
      ok: false,
      error: `A code must start with a letter or number, use only letters, numbers, dashes and underscores, and be at most ${MAX_DISCOUNT_CODE_LENGTH} characters.`,
    };
  }

  const discountType = body.discount_type;
  if (!isDiscountType(discountType)) {
    return { ok: false, error: 'Choose either a percentage or a fixed dollar amount.' };
  }

  const rawValue = Number(body.discount_value);
  if (!Number.isFinite(rawValue) || rawValue <= 0) {
    return { ok: false, error: 'Enter a discount value greater than zero.' };
  }
  if (discountType === 'percent' && (rawValue < 1 || rawValue > 100)) {
    return { ok: false, error: 'A percentage discount must be between 1 and 100.' };
  }
  const discountValue = Math.round(rawValue * 100) / 100;

  const minOrder = optionalNumber(body.min_order_subtotal);
  if (!minOrder.ok) return { ok: false, error: 'The minimum order subtotal must be a positive amount.' };

  const maxRedemptions = optionalNumber(body.max_redemptions);
  if (!maxRedemptions.ok) return { ok: false, error: 'The redemption limit must be a positive whole number.' };
  if (maxRedemptions.value != null && (!Number.isInteger(maxRedemptions.value) || maxRedemptions.value < 1)) {
    return { ok: false, error: 'The redemption limit must be a whole number of 1 or more.' };
  }

  let expiresAt: string | null = null;
  if (typeof body.expires_at === 'string' && body.expires_at.trim()) {
    const parsed = new Date(body.expires_at);
    if (Number.isNaN(parsed.getTime())) {
      return { ok: false, error: 'The expiry date could not be read.' };
    }
    expiresAt = parsed.toISOString();
  }

  return {
    ok: true,
    fields: {
      code,
      discount_type: discountType,
      discount_value: discountValue,
      min_order_subtotal: minOrder.value,
      expires_at: expiresAt,
      max_redemptions: maxRedemptions.value,
      active: body.active === undefined ? true : Boolean(body.active),
      notes: typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim() : null,
    },
  };
}

function isMissingTableError(message: string | null | undefined): boolean {
  return Boolean(message && /discount_codes/i.test(message) && /(does not exist|schema cache|relation)/i.test(message));
}

const MISSING_TABLE_MESSAGE =
  'The discount_codes table does not exist yet. Run supabase/discount-codes-2026-08.sql in Supabase, then reload this page.';

export async function GET() {
  const { supabase, error } = await requireAdmin();
  if (error) return error;

  const { data, error: queryError } = await supabase
    .from('discount_codes')
    .select(SELECT_COLUMNS)
    .order('created_at', { ascending: false });

  if (queryError) {
    if (isMissingTableError(queryError.message)) {
      return NextResponse.json({ error: MISSING_TABLE_MESSAGE }, { status: 503 });
    }
    return NextResponse.json({ error: queryError.message }, { status: 500 });
  }

  return NextResponse.json({ codes: data ?? [] });
}

export async function POST(req: Request) {
  const { supabase, error } = await requireAdmin();
  if (error) return error;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const parsed = parseFields(body as Record<string, unknown>);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const { data, error: insertError } = await supabase
    .from('discount_codes')
    .insert(parsed.fields)
    .select(SELECT_COLUMNS)
    .single();

  if (insertError) {
    if (isMissingTableError(insertError.message)) {
      return NextResponse.json({ error: MISSING_TABLE_MESSAGE }, { status: 503 });
    }
    // 23505 = unique violation on discount_codes_code_key.
    if (insertError.code === '23505') {
      return NextResponse.json(
        { error: `The code ${parsed.fields.code} already exists.` },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ code: data });
}

export async function PATCH(req: Request) {
  const { supabase, error } = await requireAdmin();
  if (error) return error;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const id = typeof (body as Record<string, unknown>).id === 'string'
    ? String((body as Record<string, unknown>).id)
    : '';
  if (!id) return NextResponse.json({ error: 'A discount code id is required.' }, { status: 400 });

  const record = body as Record<string, unknown>;

  // Activate/deactivate toggle: a lone `active` field updates just that, so the
  // row's other values do not have to be resent (and cannot be lost).
  const isToggleOnly = Object.keys(record).every((key) => key === 'id' || key === 'active');
  const payload = isToggleOnly
    ? { active: Boolean(record.active) }
    : (() => {
        const parsed = parseFields(record);
        return parsed.ok ? parsed.fields : parsed;
      })();

  if ('ok' in payload && payload.ok === false) {
    return NextResponse.json({ error: payload.error }, { status: 400 });
  }

  const { data, error: updateError } = await supabase
    .from('discount_codes')
    .update(payload)
    .eq('id', id)
    .select(SELECT_COLUMNS)
    .single();

  if (updateError) {
    if (isMissingTableError(updateError.message)) {
      return NextResponse.json({ error: MISSING_TABLE_MESSAGE }, { status: 503 });
    }
    if (updateError.code === '23505') {
      return NextResponse.json({ error: 'Another code already uses that name.' }, { status: 409 });
    }
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ code: data });
}

export async function DELETE(req: Request) {
  const { supabase, error } = await requireAdmin();
  if (error) return error;

  const body = await req.json().catch(() => null);
  const id = typeof body?.id === 'string' ? body.id : '';
  if (!id) return NextResponse.json({ error: 'A discount code id is required.' }, { status: 400 });

  const { error: deleteError } = await supabase.from('discount_codes').delete().eq('id', id);

  if (deleteError) {
    if (isMissingTableError(deleteError.message)) {
      return NextResponse.json({ error: MISSING_TABLE_MESSAGE }, { status: 503 });
    }
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
