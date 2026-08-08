import 'server-only';

import { unstable_cache } from 'next/cache';
import type { CarouselItem, CarouselSettings } from '../../carousel/lib/carouselData';
import {
  ALT_SELECTION_TABLE,
  AVAILABLE_STATUS,
  DEFAULT_BG,
  DEFAULT_VISIBLE_COUNT,
  MAX_VISIBLE_COUNT,
  MIN_VISIBLE_COUNT,
  PRODUCT_CATEGORY_COLUMN,
  PRODUCT_COLUMNS,
  PRODUCT_PADDING_COLUMNS,
  PRODUCTS_TABLE,
  PUBLIC_CAROUSEL_STATUSES,
  RANDOM_CANDIDATE_LIMIT,
  paddingBgForProductRow,
  RANDOM_LINEUP_SIZE,
  SELECTION_TABLE,
  SOLD_STATUS,
  SETTINGS_TABLE,
  THIRD_SELECTION_TABLE,
  normalizeSelectionMode,
  pickPrimaryImage,
  productHref,
  randomModeScope,
  type CarouselSelectionMode,
  type RandomLineupScope,
} from '../../carousel/lib/carouselConfig';
import { isProductJewelryItem } from '@/types/product';
import { createPublicClient } from '@/lib/supabase/public';
import {
  HOME_CAROUSEL_FALLBACK_SETTINGS,
  resolveHomeCarouselPayload,
  type HomeCarouselPayload,
  type HomeCarouselQueryResult,
} from '@/lib/home-carousel-payload';

export const HOME_CAROUSEL_CACHE_TAG = 'home-carousel';

const C = PRODUCT_COLUMNS;

type SettingsRow = {
  show_price?: boolean;
  bg_color?: string | null;
  visible_count?: number | null;
  visible_count_mobile?: number | null;
  selection_mode?: string | null;
  selection_mode_alt?: string | null;
  selection_mode_third?: string | null;
};

function productSelect(): string {
  // The padding columns are requested for CURATED entries too, not just random
  // draws. A curated row is supposed to carry its own White/Black group, but it
  // is only as reliable as whoever added it: rows added without the swatch set
  // stored NULL, fell through to the global white, and painted white bars around
  // black-backdrop photographs. The product already knows its own backdrop —
  // this lets a curated card use it when its selection row has no opinion.
  return Array.from(
    new Set([C.id, C.images, C.name, C.priceLabel, C.href, C.status, ...PRODUCT_PADDING_COLUMNS]),
  ).join(', ');
}

function isMissingColumn(error: { code?: string; message?: string } | null, column: string): boolean {
  if (!error) return false;
  return error.code === '42703' || new RegExp(column, 'i').test(error.message ?? '');
}

function normalizeItemBg(value: unknown): string | null {
  if (value == null) return null;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === '#000' || normalized === '#000000' || normalized === 'black') return '#000000';
  if (normalized === '#fff' || normalized === '#ffffff' || normalized === 'white') return '#ffffff';
  return normalized;
}

function normalizeVisibleCount(value: unknown): number {
  const count = Math.round(Number(value));
  if (!Number.isFinite(count)) return DEFAULT_VISIBLE_COUNT;
  return Math.min(MAX_VISIBLE_COUNT, Math.max(MIN_VISIBLE_COUNT, count));
}

function normalizeProduct(row: Record<string, unknown>): CarouselItem {
  return {
    id: String(row[C.id]),
    imageUrl: pickPrimaryImage(row[C.images]),
    name: String(row[C.name] ?? ''),
    priceLabel: row[C.priceLabel] != null ? String(row[C.priceLabel]) : null,
    href: productHref((row[C.href] as string | null) ?? null),
    status: row[C.status] != null ? String(row[C.status]) : null,
    bgColor: null,
  };
}

function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === '42P01' || error.code === 'PGRST205') return true;
  return /(does not exist|could not find the table|schema cache)/i.test(error.message ?? '');
}

async function fetchSelectedItems(table: string): Promise<CarouselItem[]> {
  const supabase = createPublicClient();
  const withBg = await supabase
    .from(table)
    .select(`position, bg_color, product:${PRODUCTS_TABLE}(${productSelect()})`)
    .order('position', { ascending: true });

  let rows = withBg.data as
    | Array<{ bg_color: string | null; product: Record<string, unknown> | null }>
    | null;

  if (withBg.error) {
    // A later lineup's table may not be migrated yet; that slideshow then
    // reuses the primary lineup rather than failing the whole payload.
    if (table !== SELECTION_TABLE && isMissingTable(withBg.error)) return [];
    if (!isMissingColumn(withBg.error, 'bg_color')) throw withBg.error;
    const legacy = await supabase
      .from(table)
      .select(`position, product:${PRODUCTS_TABLE}(${productSelect()})`)
      .order('position', { ascending: true });
    if (legacy.error) throw legacy.error;
    rows = ((legacy.data ?? []) as unknown as Array<{ product: Record<string, unknown> | null }>).map(
      (row) => ({ ...row, bg_color: null }),
    );
  }

  return (rows ?? [])
    .filter((row) => Boolean(row.product))
    .map((row) => {
      const product = row.product as Record<string, unknown>;
      const item = normalizeProduct(product);
      return {
        ...item,
        // The curation row wins when it has an opinion; otherwise fall back to
        // the product's own stored image padding rather than the global white.
        bgColor: normalizeItemBg(row.bg_color) ?? paddingBgForProductRow(product, item.imageUrl),
      };
    })
    // Available AND sold both render (owner decision 2026-08-04): a sold card
    // links to its product page, which shows it is sold. Draft/pending/archived
    // stay private. Sold items never carry a price caption, matching the
    // sold-price masking policy.
    .filter((item) => Boolean(item.imageUrl) && PUBLIC_CAROUSEL_STATUSES.includes(item.status ?? ''))
    .map((item) => (item.status === SOLD_STATUS ? { ...item, priceLabel: null } : item));
}

async function fetchSettings(): Promise<CarouselSettings> {
  const supabase = createPublicClient();
  const read = (columns: string) =>
    supabase.from(SETTINGS_TABLE).select(columns).eq('id', 1).maybeSingle();

  let data: SettingsRow | null = null;
  const withThird = await read(
    'show_price, bg_color, visible_count, visible_count_mobile, selection_mode, selection_mode_alt, selection_mode_third',
  );
  const withModes = withThird.error
    ? await read('show_price, bg_color, visible_count, visible_count_mobile, selection_mode, selection_mode_alt')
    : withThird;
  if (!withModes.error) {
    data = withModes.data as SettingsRow | null;
  } else {
    const full = await read('show_price, bg_color, visible_count, visible_count_mobile');
    if (!full.error) {
      data = full.data as SettingsRow | null;
    } else {
      const desktopOnly = await read('show_price, bg_color, visible_count');
      if (!desktopOnly.error) {
        const row = desktopOnly.data as SettingsRow | null;
        data = row ? { ...row, visible_count_mobile: row.visible_count } : row;
      } else {
        const legacy = await read('show_price, bg_color');
        if (legacy.error) throw legacy.error;
        data = legacy.data as SettingsRow | null;
      }
    }
  }

  const desktop = normalizeVisibleCount(data?.visible_count);
  return {
    showPrice: Boolean(data?.show_price),
    bgColor: data?.bg_color || DEFAULT_BG,
    visibleCountDesktop: desktop,
    visibleCountMobile: normalizeVisibleCount(data?.visible_count_mobile ?? data?.visible_count),
    selectionModePrimary: normalizeSelectionMode(data?.selection_mode),
    selectionModeAlt: normalizeSelectionMode(data?.selection_mode_alt),
    selectionModeThird: normalizeSelectionMode(data?.selection_mode_third),
  };
}

/**
 * Jewelry classification reads title/tags/type fields, not a single column, so
 * a random draw has to request them on top of the display columns. It also
 * requests the image-padding columns, which are what give a drawn card its own
 * backdrop colour (see `paddingBgForProductRow`). The curated query requests them
 * too, as of 2026-08-07 — a curated entry is MEANT to carry its colour on the
 * selection row, but rows added without the swatch set stored NULL and painted
 * white bars behind black-backdrop photos.
 */
function randomCandidateSelect(): string {
  return Array.from(
    new Set([
      C.id,
      C.images,
      C.name,
      C.priceLabel,
      C.href,
      C.status,
      'title_es',
      'chain_type',
      'tags',
      'tags_es',
      'jewelry_type',
      'product_type',
      ...PRODUCT_PADDING_COLUMNS,
    ]),
  ).join(', ');
}

/**
 * Draw a bounded random lineup for a scope. Runs inside the cached payload
 * build, so the draw refreshes every ~5 minutes (and on every admin save via
 * revalidation) — sold pieces drop out and new inventory rotates in with no
 * curation. The metal constraint is pushed to the database; the jewelry test is
 * applied here because it is inferred in application code (the same rule the
 * shop's Jewelry & Watches filter uses). A drawn item has no curation row, so
 * its per-photo background comes from the product's own stored image padding
 * (2026-08-04) rather than defaulting to the global white — a black-backdrop
 * photo on a white card showed white bars around it.
 */
async function fetchRandomLineupItems(scope: RandomLineupScope): Promise<CarouselItem[]> {
  const supabase = createPublicClient();
  let query = supabase
    .from(PRODUCTS_TABLE)
    .select(randomCandidateSelect())
    .eq(C.status, AVAILABLE_STATUS)
    .limit(RANDOM_CANDIDATE_LIMIT);
  if (scope.category) query = query.eq(PRODUCT_CATEGORY_COLUMN, scope.category);

  const { data, error } = await query;
  if (error) throw error;

  const items = ((data ?? []) as unknown as Array<Record<string, unknown>>)
    .filter((row) => isProductJewelryItem({
      title: String(row.title ?? ''),
      title_es: (row.title_es as string | null) ?? null,
      chain_type: (row.chain_type as string | null) ?? null,
      tags: (row.tags as string[] | null) ?? [],
      tags_es: (row.tags_es as string[] | null) ?? [],
      jewelry_type: (row.jewelry_type as string | null) ?? null,
      product_type: (row.product_type as string | null) ?? null,
    }) === scope.jewelry)
    .map((row) => {
      const item = normalizeProduct(row);
      return { ...item, bgColor: paddingBgForProductRow(row, item.imageUrl) };
    })
    .filter((item) => Boolean(item.imageUrl));

  // Fisher-Yates shuffle, then keep a hero-sized lineup.
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items.slice(0, RANDOM_LINEUP_SIZE);
}

/** Resolve one lineup's items for its configured mode. */
async function fetchLineupItems(mode: CarouselSelectionMode, table: string): Promise<CarouselItem[]> {
  const scope = randomModeScope(mode);
  if (scope) return fetchRandomLineupItems(scope);
  return fetchSelectedItems(table);
}

const fetchCachedHomeCarousel = unstable_cache(
  async (): Promise<HomeCarouselQueryResult> => {
    // Settings first: each lineup's mode decides whether it reads its curated
    // selection table or draws a fresh random metal lineup.
    const settings = await fetchSettings();
    const [items, altItems, thirdItems] = await Promise.all([
      fetchLineupItems(settings.selectionModePrimary, SELECTION_TABLE),
      fetchLineupItems(settings.selectionModeAlt, ALT_SELECTION_TABLE),
      fetchLineupItems(settings.selectionModeThird, THIRD_SELECTION_TABLE),
    ]);
    return { items, altItems, thirdItems, settings };
  },
  ['home-carousel-payload-v4'],
  {
    tags: [HOME_CAROUSEL_CACHE_TAG],
    revalidate: 300,
  },
);

export async function getHomeCarouselPayload(
  fallbackItems: CarouselItem[],
): Promise<HomeCarouselPayload> {
  try {
    return resolveHomeCarouselPayload(await fetchCachedHomeCarousel(), fallbackItems);
  } catch (error) {
    console.error('Home carousel server query failed; using local fallback assets.', error);
    return resolveHomeCarouselPayload(
      { items: [], altItems: [], thirdItems: [], settings: HOME_CAROUSEL_FALLBACK_SETTINGS },
      fallbackItems,
    );
  }
}
