// Data access for the carousel: fetch products, fetch/save the curated
// selection. All Supabase-shape details live here and in carouselConfig.ts.

import { supabase } from "./supabaseClient";
import {
  PRODUCTS_TABLE,
  PRODUCT_COLUMNS,
  PRODUCT_CATEGORY_COLUMN,
  PRODUCT_PADDING_COLUMNS,
  SETTINGS_TABLE,
  DEFAULT_BG,
  DEFAULT_VISIBLE_COUNT,
  MIN_VISIBLE_COUNT,
  MAX_VISIBLE_COUNT,
  RANDOM_CANDIDATE_LIMIT,
  RANDOM_LINEUP_SIZE,
  SOLD_STATUS,
  PUBLIC_CAROUSEL_STATUSES,
  normalizeSelectionMode,
  paddingBgForProductRow,
  pickPrimaryImage,
  productHref,
  selectionTableFor,
  statusesForFilter,
  type CarouselLineup,
  type CarouselSelectionMode,
  type CarouselStatusFilter,
  type RandomLineupScope,
} from "./carouselConfig";
import { isProductJewelryItem } from "@/types/product";

export type {
  CarouselLineup,
  CarouselSelectionMode,
  CarouselStatusFilter,
  RandomLineupScope,
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
  // Includes the image-padding columns so a CURATED card whose selection row has
  // no White/Black group set can still paint its own backdrop (see
  // `paddingBgForProductRow`). Without them such a row fell through to the global
  // white and put white bars around a black-backdrop photograph. Kept in step
  // with the same fallback in src/lib/home-carousel-server.ts, which is what the
  // live hero reads — the admin preview must not disagree with the storefront.
  return Array.from(
    new Set([C.id, C.images, C.name, C.priceLabel, C.href, C.status, ...PRODUCT_PADDING_COLUMNS])
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

/**
 * True when an error means the whole table does not exist yet (the
 * add-second-lineup.sql migration hasn't been run). Alt-lineup reads degrade
 * to an empty list in that case; the hero then reuses the primary lineup.
 */
export function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  return /(does not exist|could not find the table|schema cache)/i.test(error.message ?? "");
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
 * Reads the lineup's selection table (public-readable) joined to products, and
 * drops anything without an image or outside the public statuses — available
 * and sold both render (a sold card links to its product page, which shows it
 * is sold), while draft/pending/archived stay private. Sold items never carry
 * a price caption, matching the sold-price masking policy. A later lineup
 * returns [] while its table is unmigrated so callers can fall back.
 */
export async function fetchSelectedItems(lineup: CarouselLineup = "primary"): Promise<CarouselItem[]> {
  const table = selectionTableFor(lineup);
  const withBg = await supabase
    .from(table)
    .select(`position, bg_color, product:${PRODUCTS_TABLE}(${productSelect()})`)
    .order("position", { ascending: true });

  let rows = withBg.data as
    | Array<{ bg_color: string | null; product: Record<string, unknown> | null }>
    | null;

  if (withBg.error) {
    if (lineup !== "primary" && isMissingTable(withBg.error)) return [];
    if (!isMissingBgColumn(withBg.error)) throw withBg.error;
    // Pre-migration: query without bg_color and treat every item as "inherit".
    const legacy = await supabase
      .from(table)
      .select(`position, product:${PRODUCTS_TABLE}(${productSelect()})`)
      .order("position", { ascending: true });
    if (legacy.error) throw legacy.error;
    rows = ((legacy.data ?? []) as unknown as Array<{ product: Record<string, unknown> | null }>).map(
      (r) => ({ ...r, bg_color: null }),
    );
  }

  return (rows ?? [])
    .filter((r) => Boolean(r.product))
    .map((r) => {
      const product = r.product as Record<string, unknown>;
      const item = normalize(product);
      return {
        ...item,
        // Curation row wins; otherwise use the product's own stored padding.
        bgColor: normalizeItemBg(r.bg_color) ?? paddingBgForProductRow(product, item.imageUrl),
      };
    })
    .filter((item) => item.imageUrl && PUBLIC_CAROUSEL_STATUSES.includes(item.status ?? ""))
    .map((item) => (item.status === SOLD_STATUS ? { ...item, priceLabel: null } : item));
}

/**
 * ADMIN: products to choose from. `search` filters by title; `statusFilter`
 * selects which list the admin works from — all (available + sold), available
 * only, or sold only. Private statuses are never returned regardless.
 * Paginated to keep large catalogs responsive.
 */
export async function fetchAllProducts(
  search = "",
  limit = 200,
  statusFilter: CarouselStatusFilter = "available",
): Promise<CarouselItem[]> {
  let q = supabase
    .from(PRODUCTS_TABLE)
    .select(productSelect())
    .in(C.status, [...statusesForFilter(statusFilter)])
    .limit(limit);
  if (search.trim()) q = q.ilike(C.name, `%${search.trim()}%`);

  const { data, error } = await q;
  if (error) throw error;
  return ((data ?? []) as unknown as Array<Record<string, unknown>>)
    .map(normalize)
    .filter((item) => item.imageUrl);
}

/**
 * ADMIN: an illustrative sample of what a random mode would draw, for the
 * settings preview. Mirrors the storefront's scope rule — metal pushed to the
 * database, wearable-jewelry inferred in code — but this draw is panel-local:
 * the storefront makes its own on every cache rebuild.
 */
export async function fetchRandomSampleItems(
  scope: RandomLineupScope,
  statusFilter: CarouselStatusFilter = "available",
): Promise<CarouselItem[]> {
  const columns = Array.from(
    new Set([
      C.id, C.images, C.name, C.priceLabel, C.href, C.status,
      "title_es", "chain_type", "tags", "tags_es", "jewelry_type", "product_type",
      // Give each drawn piece its own backdrop colour instead of the global
      // white; see paddingBgForProductRow.
      ...PRODUCT_PADDING_COLUMNS,
    ]),
  ).join(", ");

  let q = supabase
    .from(PRODUCTS_TABLE)
    .select(columns)
    .in(C.status, [...statusesForFilter(statusFilter)])
    .limit(RANDOM_CANDIDATE_LIMIT);
  if (scope.category) q = q.eq(PRODUCT_CATEGORY_COLUMN, scope.category);

  const { data, error } = await q;
  if (error) throw error;

  const items = ((data ?? []) as unknown as Array<Record<string, unknown>>)
    .filter((row) => isProductJewelryItem({
      title: String(row.title ?? ""),
      title_es: (row.title_es as string | null) ?? null,
      chain_type: (row.chain_type as string | null) ?? null,
      tags: (row.tags as string[] | null) ?? [],
      tags_es: (row.tags_es as string[] | null) ?? [],
      jewelry_type: (row.jewelry_type as string | null) ?? null,
      product_type: (row.product_type as string | null) ?? null,
    }) === scope.jewelry)
    .map((row) => {
      const item = normalize(row);
      return { ...item, bgColor: paddingBgForProductRow(row, item.imageUrl) };
    })
    .filter((item) => item.imageUrl);

  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items.slice(0, RANDOM_LINEUP_SIZE);
}

/** ADMIN: the curated entries (id + per-photo bg), in display order. */
export async function fetchSelectionEntries(lineup: CarouselLineup = "primary"): Promise<SelectionEntry[]> {
  const table = selectionTableFor(lineup);
  const withBg = await supabase
    .from(table)
    .select("product_id, position, bg_color")
    .order("position", { ascending: true });

  let data = withBg.data as Array<{ product_id: string; bg_color: string | null }> | null;

  if (withBg.error) {
    // Any later lineup's table may not be migrated yet; read it as empty.
    if (lineup !== "primary" && isMissingTable(withBg.error)) return [];
    if (!isMissingBgColumn(withBg.error)) throw withBg.error;
    const legacy = await supabase
      .from(table)
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
export async function fetchSelectionIds(lineup: CarouselLineup = "primary"): Promise<string[]> {
  return (await fetchSelectionEntries(lineup)).map((entry) => entry.productId);
}

/**
 * ADMIN: replace the lineup's entire selection with `entries` (order +
 * per-photo bg). Requires an authenticated admin session (enforced by RLS).
 * Saving the alt lineup before add-second-lineup.sql has run throws the
 * missing-table error so the panel can tell the admin which SQL to run.
 */
export async function saveSelection(
  entries: SelectionEntry[],
  lineup: CarouselLineup = "primary",
): Promise<void> {
  const table = selectionTableFor(lineup);
  // Clear existing selection. Supabase requires a filter on delete;
  // position is always >= 0, so this matches every row.
  const del = await supabase.from(table).delete().gte("position", 0);
  if (del.error) throw del.error;

  if (entries.length === 0) return;

  const rows = entries.map((entry, position) => ({
    product_id: entry.productId,
    position,
    bg_color: entry.bgColor,
  }));
  const ins = await supabase.from(table).insert(rows);
  if (ins.error) {
    if (!isMissingBgColumn(ins.error)) throw ins.error;
    // Pre-migration: persist order without the per-item color so the admin
    // isn't blocked. Colors start saving once add-per-item-bg.sql is run.
    const legacyRows = entries.map((entry, position) => ({
      product_id: entry.productId,
      position,
    }));
    const legacyIns = await supabase.from(table).insert(legacyRows);
    if (legacyIns.error) throw legacyIns.error;
  }
}

/* ---------------- admin gate (UX only; RLS is the real guard) ---------------- */

/**
 * Whether the currently logged-in Supabase user is the store admin.
 * Use this to show/hide the admin form. This is the THIRD gate and the weakest:
 * the admin settings page already redirects non-admins server-side on the same
 * `profiles.is_admin` signal, and `is_carousel_admin()` in the database is the
 * actual enforcement for every write. This only decides whether to render the
 * panel or its "not authorized" state.
 *
 * Reads `profiles.is_admin` rather than comparing the session email to a
 * hard-coded address. The old form shipped the owner's PERSONAL email address
 * into the public client bundle — readable by anyone viewing source and
 * harvestable by spam bots — to re-check something the server had already
 * proven (2026-08-08 audit).
 *
 * Correct for both cases under the live policy in
 * `supabase/admin-profile-read-policy.sql`, which grants SELECT on `profiles`
 * via `is_admin_user(auth.uid())`: an admin reads their own row and gets true;
 * a non-admin reads zero rows and gets false.
 */
export async function isCurrentUserAdmin(): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) return false;

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", id)
    .maybeSingle();

  return profile?.is_admin === true;
}

/* ---------------- display settings (show price, background) ---------------- */

export type CarouselSettings = {
  showPrice: boolean;
  bgColor: string;
  /** Cards visible on the ring at once on desktop (windowed carousel). */
  visibleCountDesktop: number;
  /** Cards visible on the ring at once on mobile. */
  visibleCountMobile: number;
  /** How Slideshow 1 picks its items (manual lineup or a random scoped draw). */
  selectionModePrimary: CarouselSelectionMode;
  /** How Slideshow 2 picks its items. */
  selectionModeAlt: CarouselSelectionMode;
  /** How Slideshow 3 picks its items. */
  selectionModeThird: CarouselSelectionMode;
};

type SettingsRow = {
  show_price?: boolean;
  bg_color?: string | null;
  visible_count?: number | null;
  visible_count_mobile?: number | null;
  selection_mode?: string | null;
  selection_mode_alt?: string | null;
  selection_mode_third?: string | null;
};

/**
 * STOREFRONT + ADMIN: the display settings. Falls back to sensible defaults.
 * Tiered select so it survives whichever optional columns have been migrated:
 * all -> drop modes -> drop mobile -> drop both counts.
 */
export async function fetchSettings(): Promise<CarouselSettings> {
  const read = (cols: string) =>
    supabase.from(SETTINGS_TABLE).select(cols).eq("id", 1).maybeSingle();

  let data: SettingsRow | null = null;
  const withThird = await read(
    "show_price, bg_color, visible_count, visible_count_mobile, selection_mode, selection_mode_alt, selection_mode_third",
  );
  const withModes = withThird.error
    ? await read("show_price, bg_color, visible_count, visible_count_mobile, selection_mode, selection_mode_alt")
    : withThird;
  if (!withModes.error) {
    data = withModes.data as SettingsRow | null;
  } else {
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
  }

  const desktop = normalizeVisibleCount(data?.visible_count);
  return {
    showPrice: Boolean(data?.show_price),
    bgColor: (data?.bg_color as string | null) || DEFAULT_BG,
    visibleCountDesktop: desktop,
    visibleCountMobile: normalizeVisibleCount(data?.visible_count_mobile ?? data?.visible_count),
    selectionModePrimary: normalizeSelectionMode(data?.selection_mode),
    selectionModeAlt: normalizeSelectionMode(data?.selection_mode_alt),
    selectionModeThird: normalizeSelectionMode(data?.selection_mode_third),
  };
}

/**
 * ADMIN: persist the display settings. Requires the admin session (RLS).
 * Tiered update mirroring fetchSettings so a missing column never blocks a
 * save. Returns whether the selection-mode columns were persisted, so the
 * panel can warn when add-random-lineup-modes.sql still needs to be run
 * instead of a random toggle silently not saving.
 */
export async function saveSettings(
  settings: CarouselSettings,
): Promise<{ modesPersisted: boolean; thirdModePersisted: boolean }> {
  const base = { show_price: settings.showPrice, bg_color: settings.bgColor };
  const desktop = normalizeVisibleCount(settings.visibleCountDesktop);
  const mobile = normalizeVisibleCount(settings.visibleCountMobile);
  const write = (payload: Record<string, unknown>) =>
    supabase.from(SETTINGS_TABLE).update(payload).eq("id", 1);
  const modeColumns = {
    selection_mode: normalizeSelectionMode(settings.selectionModePrimary),
    selection_mode_alt: normalizeSelectionMode(settings.selectionModeAlt),
  };

  const withThird = await write({
    ...base,
    visible_count: desktop,
    visible_count_mobile: mobile,
    ...modeColumns,
    selection_mode_third: normalizeSelectionMode(settings.selectionModeThird),
  });
  if (!withThird.error) return { modesPersisted: true, thirdModePersisted: true };

  const withModes = await write({
    ...base,
    visible_count: desktop,
    visible_count_mobile: mobile,
    ...modeColumns,
  });
  if (!withModes.error) return { modesPersisted: true, thirdModePersisted: false };

  const full = await write({ ...base, visible_count: desktop, visible_count_mobile: mobile });
  if (!full.error) return { modesPersisted: false, thirdModePersisted: false };

  const desktopOnly = await write({ ...base, visible_count: desktop });
  if (!desktopOnly.error) return { modesPersisted: false, thirdModePersisted: false };

  const legacy = await write(base);
  if (legacy.error) throw legacy.error;
  return { modesPersisted: false, thirdModePersisted: false };
}
