import 'server-only';

import { unstable_cache } from 'next/cache';
import type { CarouselItem, CarouselSettings } from '../../carousel/lib/carouselData';
import {
  AVAILABLE_STATUS,
  DEFAULT_BG,
  DEFAULT_VISIBLE_COUNT,
  MAX_VISIBLE_COUNT,
  MIN_VISIBLE_COUNT,
  PRODUCT_COLUMNS,
  PRODUCTS_TABLE,
  SELECTION_TABLE,
  SETTINGS_TABLE,
  pickPrimaryImage,
  productHref,
} from '../../carousel/lib/carouselConfig';
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
};

function productSelect(): string {
  return Array.from(new Set([C.id, C.images, C.name, C.priceLabel, C.href, C.status])).join(', ');
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

async function fetchSelectedItems(): Promise<CarouselItem[]> {
  const supabase = createPublicClient();
  const withBg = await supabase
    .from(SELECTION_TABLE)
    .select(`position, bg_color, product:${PRODUCTS_TABLE}(${productSelect()})`)
    .order('position', { ascending: true });

  let rows = withBg.data as
    | Array<{ bg_color: string | null; product: Record<string, unknown> | null }>
    | null;

  if (withBg.error) {
    if (!isMissingColumn(withBg.error, 'bg_color')) throw withBg.error;
    const legacy = await supabase
      .from(SELECTION_TABLE)
      .select(`position, product:${PRODUCTS_TABLE}(${productSelect()})`)
      .order('position', { ascending: true });
    if (legacy.error) throw legacy.error;
    rows = ((legacy.data ?? []) as unknown as Array<{ product: Record<string, unknown> | null }>).map(
      (row) => ({ ...row, bg_color: null }),
    );
  }

  return (rows ?? [])
    .filter((row) => Boolean(row.product))
    .map((row) => ({
      ...normalizeProduct(row.product as Record<string, unknown>),
      bgColor: normalizeItemBg(row.bg_color),
    }))
    .filter((item) => Boolean(item.imageUrl) && item.status === AVAILABLE_STATUS);
}

async function fetchSettings(): Promise<CarouselSettings> {
  const supabase = createPublicClient();
  const read = (columns: string) =>
    supabase.from(SETTINGS_TABLE).select(columns).eq('id', 1).maybeSingle();

  let data: SettingsRow | null = null;
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

  const desktop = normalizeVisibleCount(data?.visible_count);
  return {
    showPrice: Boolean(data?.show_price),
    bgColor: data?.bg_color || DEFAULT_BG,
    visibleCountDesktop: desktop,
    visibleCountMobile: normalizeVisibleCount(data?.visible_count_mobile ?? data?.visible_count),
  };
}

const fetchCachedHomeCarousel = unstable_cache(
  async (): Promise<HomeCarouselQueryResult> => {
    const [items, settings] = await Promise.all([fetchSelectedItems(), fetchSettings()]);
    return { items, settings };
  },
  ['home-carousel-payload-v1'],
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
      { items: [], settings: HOME_CAROUSEL_FALLBACK_SETTINGS },
      fallbackItems,
    );
  }
}
