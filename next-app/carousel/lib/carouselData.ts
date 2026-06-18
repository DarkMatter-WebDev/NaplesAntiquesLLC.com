// Data access for the carousel: fetch products, fetch/save the curated
// selection. All Supabase-shape details live here and in carouselConfig.ts.

import { supabase } from "./supabaseClient";
import {
  PRODUCTS_TABLE,
  PRODUCT_COLUMNS,
  SELECTION_TABLE,
  SETTINGS_TABLE,
  AVAILABLE_STATUS,
  ADMIN_EMAIL,
  DEFAULT_BG,
  DEFAULT_VISIBLE_COUNT,
  MIN_VISIBLE_COUNT,
  MAX_VISIBLE_COUNT,
  pickPrimaryImage,
  productHref,
} from "./carouselConfig";

/** Normalized shape the UI works with, regardless of DB column names. */
export type CarouselItem = {
  id: string;
  imageUrl: string;
  name: string;
  priceLabel: string | null;
  href: string | null;
  status: string | null;
  /**
   * Per-photo hero background. null = inherit the global carousel setting.
   * Lives on carousel_selection, not the product, so it's only populated for
   * items returned by fetchSelectedItems (the curated list).
   */
  bgColor: string | null;
};

/** A curated entry: which product, in what order, with its per-photo bg. */
export type SelectionEntry = { productId: string; bgColor: string | null };

const C = PRODUCT_COLUMNS;

/** Whether a per-item background color is black. */
export function isBlackBg(value: string | null | undefined): boolean {
  const n = (value ?? "").trim().toLowerCase();
  return n === "#000000" || n === "#000" || n === "black";
}

/**
 * Order items into two contiguous arcs — every white-background photo first,
 * then every black-background photo — so the rotating ring has exactly two
 * seams. The home hero's background sweep relies on this grouping. Relative
 * order within each group is preserved.
 */
export function groupByBackground(items: CarouselItem[]): CarouselItem[] {
  const white = items.filter((item) => !isBlackBg(item.bgColor));
  const black = items.filter((item) => isBlackBg(item.bgColor));
  return [...white, ...black];
}

/**
 * Normalize a per-item background value to a known hex (or null = inherit).
 * Accepts hex (#fff/#ffffff), the words white/black, or empty (-> null).
 */
export function normalizeItemBg(value: unknown): string | null {
  if (value == null) return null;
  const n = String(value).trim().toLowerCase();
  if (n === "") return null;
  if (n === "#000" || n === "#000000" || n === "black") return "#000000";
  if (n === "#fff" || n === "#ffffff" || n === "white") return "#ffffff";
  return n; // allow a custom hex to pass through unchanged
}

/** Columns to request from the products table (deduped). */
function productSelect(): string {
  return Array.from(
    new Set([C.id, C.images, C.name, C.priceLabel, C.href, C.status])
  ).join(", ");
}

/**
 * True when an error is caused by a column not existing yet (i.e. a migration
 * hasn't been run). Lets reads/writes degrade gracefully to the legacy shape
 * instead of breaking the whole carousel.
 */
function isMissingColumn(error: { code?: string; message?: string } | null, column: string): boolean {
  if (!error) return false;
  return error.code === "42703" || new RegExp(column, "i").test(error.message ?? "");
}

function isMissingBgColumn(error: { code?: string; message?: string } | null): boolean {
  return isMissingColumn(error, "bg_color");
}

/** Clamp a stored visible-count to the supported range, defaulting sensibly. */
export function normalizeVisibleCount(value: unknown): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return DEFAULT_VISIBLE_COUNT;
  return Math.min(MAX_VISIBLE_COUNT, Math.max(MIN_VISIBLE_COUNT, n));
}

/** Map a raw DB row into a CarouselItem (bgColor defaults to inherit). */
function normalize(row: Record<string, unknown>): CarouselItem {
  return {
    id: String(row[C.id]),
    imageUrl: pickPrimaryImage(row[C.images]),
    name: String(row[C.name] ?? ""),
    priceLabel: row[C.priceLabel] != null ? String(row[C.priceLabel]) : null,
    href: productHref((row[C.href] as string | null) ?? null),
    status: row[C.status] != null ? String(row[C.status]) : null,
    bgColor: null,
  };
}

/**
 * STOREFRONT: the curated, ordered list of products to show in the carousel.
 * Reads carousel_selection (public-readable) joined to products, and drops
 * anything that's no longer available or has no image.
 */
export async function fetchSelectedItems(): Promise<CarouselItem[]> {
  const withBg = await supabase
    .from(SELECTION_TABLE)
    .select(`position, bg_color, product:${PRODUCTS_TABLE}(${productSelect()})`)
    .order("position", { ascending: true });

  let rows = withBg.data as
    | Array<{ bg_color: string | null; product: Record<string, unknown> | null }>
    | null;

  if (withBg.error) {
    if (!isMissingBgColumn(withBg.error)) throw withBg.error;
    // Pre-migration: query without bg_color and treat every item as "inherit".
    const legacy = await supabase
      .from(SELECTION_TABLE)
      .select(`position, product:${PRODUCTS_TABLE}(${productSelect()})`)
      .order("position", { ascending: true });
    if (legacy.error) throw legacy.error;
    rows = ((legacy.data ?? []) as unknown as Array<{ product: Record<string, unknown> | null }>).map(
      (r) => ({ ...r, bg_color: null }),
    );
  }

  return (rows ?? [])
    .filter((r) => Boolean(r.product))
    .map((r) => ({
      ...normalize(r.product as Record<string, unknown>),
      bgColor: normalizeItemBg(r.bg_color),
    }))
    .filter((item) => item.imageUrl && item.status === AVAILABLE_STATUS);
}

/**
 * ADMIN: products available to choose from. `search` filters by title.
 * Paginated to keep large catalogs responsive.
 */
export async function fetchAllProducts(
  search = "",
  limit = 200
): Promise<CarouselItem[]> {
  let q = supabase
    .from(PRODUCTS_TABLE)
    .select(productSelect())
    .eq(C.status, AVAILABLE_STATUS)
    .limit(limit);
  if (search.trim()) q = q.ilike(C.name, `%${search.trim()}%`);

  const { data, error } = await q;
  if (error) throw error;
  return ((data ?? []) as unknown as Array<Record<string, unknown>>)
    .map(normalize)
    .filter((item) => item.imageUrl);
}

/** ADMIN: the curated entries (id + per-photo bg), in display order. */
export async function fetchSelectionEntries(): Promise<SelectionEntry[]> {
  const withBg = await supabase
    .from(SELECTION_TABLE)
    .select("product_id, position, bg_color")
    .order("position", { ascending: true });

  let data = withBg.data as Array<{ product_id: string; bg_color: string | null }> | null;

  if (withBg.error) {
    if (!isMissingBgColumn(withBg.error)) throw withBg.error;
    const legacy = await supabase
      .from(SELECTION_TABLE)
      .select("product_id, position")
      .order("position", { ascending: true });
    if (legacy.error) throw legacy.error;
    data = ((legacy.data ?? []) as Array<{ product_id: string }>).map((r) => ({
      ...r,
      bg_color: null,
    }));
  }

  return (data ?? []).map((r) => ({
    productId: String(r.product_id),
    bgColor: normalizeItemBg(r.bg_color),
  }));
}

/** ADMIN: the currently-selected product ids, in display order. */
export async function fetchSelectionIds(): Promise<string[]> {
  return (await fetchSelectionEntries()).map((entry) => entry.productId);
}

/**
 * ADMIN: replace the entire selection with `entries` (order + per-photo bg).
 * Requires an authenticated admin session (enforced by RLS in setup.sql).
 */
export async function saveSelection(entries: SelectionEntry[]): Promise<void> {
  // Clear existing selection. Supabase requires a filter on delete;
  // position is always >= 0, so this matches every row.
  const del = await supabase.from(SELECTION_TABLE).delete().gte("position", 0);
  if (del.error) throw del.error;

  if (entries.length === 0) return;

  const rows = entries.map((entry, position) => ({
    product_id: entry.productId,
    position,
    bg_color: entry.bgColor,
  }));
  const ins = await supabase.from(SELECTION_TABLE).insert(rows);
  if (ins.error) {
    if (!isMissingBgColumn(ins.error)) throw ins.error;
    // Pre-migration: persist order without the per-item color so the admin
    // isn't blocked. Colors start saving once add-per-item-bg.sql is run.
    const legacyRows = entries.map((entry, position) => ({
      product_id: entry.productId,
      position,
    }));
    const legacyIns = await supabase.from(SELECTION_TABLE).insert(legacyRows);
    if (legacyIns.error) throw legacyIns.error;
  }
}

/* ---------------- admin gate (UX only; RLS is the real guard) ---------------- */

/**
 * Whether the currently logged-in Supabase user is the store admin.
 * Use this to show/hide the admin form. The database RLS policy is the
 * actual enforcement — this just keeps the UI tidy for non-admins.
 */
export async function isCurrentUserAdmin(): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  const email = data.session?.user.email?.toLowerCase() ?? null;
  return email === ADMIN_EMAIL.toLowerCase();
}

/* ---------------- display settings (show price, background) ---------------- */

export type CarouselSettings = {
  showPrice: boolean;
  bgColor: string;
  /** Cards visible on the ring at once on desktop (windowed carousel). */
  visibleCountDesktop: number;
  /** Cards visible on the ring at once on mobile. */
  visibleCountMobile: number;
};

type SettingsRow = {
  show_price?: boolean;
  bg_color?: string | null;
  visible_count?: number | null;
  visible_count_mobile?: number | null;
};

/**
 * STOREFRONT + ADMIN: the display settings. Falls back to sensible defaults.
 * Tiered select so it survives whichever optional columns have been migrated:
 * all four -> drop mobile -> drop both counts.
 */
export async function fetchSettings(): Promise<CarouselSettings> {
  const read = (cols: string) =>
    supabase.from(SETTINGS_TABLE).select(cols).eq("id", 1).maybeSingle();

  let data: SettingsRow | null = null;
  const full = await read("show_price, bg_color, visible_count, visible_count_mobile");
  if (!full.error) {
    data = full.data as SettingsRow | null;
  } else {
    const desktopOnly = await read("show_price, bg_color, visible_count");
    if (!desktopOnly.error) {
      const row = desktopOnly.data as SettingsRow | null;
      // No mobile column yet: mirror the desktop value until it's set.
      data = row ? { ...row, visible_count_mobile: row.visible_count } : row;
    } else {
      const legacy = await read("show_price, bg_color");
      if (legacy.error) throw legacy.error;
      data = legacy.data as SettingsRow | null;
    }
  }

  const desktop = normalizeVisibleCount(data?.visible_count);
  return {
    showPrice: Boolean(data?.show_price),
    bgColor: (data?.bg_color as string | null) || DEFAULT_BG,
    visibleCountDesktop: desktop,
    visibleCountMobile: normalizeVisibleCount(data?.visible_count_mobile ?? data?.visible_count),
  };
}

/**
 * ADMIN: persist the display settings. Requires the admin session (RLS).
 * Tiered update mirroring fetchSettings so a missing column never blocks a save.
 */
export async function saveSettings(settings: CarouselSettings): Promise<void> {
  const base = { show_price: settings.showPrice, bg_color: settings.bgColor };
  const desktop = normalizeVisibleCount(settings.visibleCountDesktop);
  const mobile = normalizeVisibleCount(settings.visibleCountMobile);
  const write = (payload: Record<string, unknown>) =>
    supabase.from(SETTINGS_TABLE).update(payload).eq("id", 1);

  const full = await write({ ...base, visible_count: desktop, visible_count_mobile: mobile });
  if (!full.error) return;

  const desktopOnly = await write({ ...base, visible_count: desktop });
  if (!desktopOnly.error) return;

  const legacy = await write(base);
  if (legacy.error) throw legacy.error;
}
