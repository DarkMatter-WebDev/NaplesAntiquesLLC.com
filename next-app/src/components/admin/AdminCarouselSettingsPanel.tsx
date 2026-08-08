'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Carousel } from '../../../carousel/components/Carousel';
import {
  fetchAllProducts,
  fetchRandomSampleItems,
  fetchSelectionEntries,
  fetchSettings,
  groupByBackground,
  isCurrentUserAdmin,
  isMissingTable,
  saveSelection,
  saveSettings,
  type CarouselItem,
  type CarouselLineup,
  type CarouselStatusFilter,
  type RandomLineupScope,
  type SelectionEntry,
} from '../../../carousel/lib/carouselData';
import { RANDOM_LINEUP_SIZE } from '../../../carousel/lib/carouselConfig';
import {
  DEFAULT_BG,
  DEFAULT_VISIBLE_COUNT,
  MIN_VISIBLE_COUNT,
  MAX_VISIBLE_COUNT,
} from '../../../carousel/lib/carouselConfig';

// Each photo belongs to the White group or the Black group. The carousel
// auto-arranges them into a white arc + a black arc for the sweeping fade.
const ITEM_BG_OPTIONS = [
  { label: 'White', value: '#ffffff' },
  { label: 'Black', value: '#000000' },
] as const;

// The three curated lineups, in the order the visitor scrolls through them.
// Selection, order, and per-photo colors are edited one lineup at a time via
// these tabs.
const LINEUPS: Array<{ key: CarouselLineup; label: string; hint: string }> = [
  { key: 'primary', label: 'Slideshow 1', hint: 'Shown when the page loads' },
  { key: 'alt', label: 'Slideshow 2', hint: 'Revealed first as the visitor scrolls; empty = same as Slideshow 1' },
  { key: 'third', label: 'Slideshow 3', hint: 'Revealed last as the visitor scrolls; empty = same as Slideshow 1' },
];

// Random draws FILL the editable lineup rather than acting as a live source.
// The admin asked to adjust the drawn pieces and their order, which only works
// if the arrangement is saved — a mode that re-drew server-side every cache
// rebuild would throw those edits away. So each button seeds the list below and
// the saved lineup stays manual. Non-jewelry deliberately spans both metals —
// it is the catalog's "everything else" (coins, bullion, flatware), which is
// not a metal-first choice.
const RANDOM_FILL_OPTIONS: Array<{
  key: string;
  label: string;
  scope: RandomLineupScope;
  hint: string;
}> = [
  {
    key: 'gold-jewelry',
    label: 'Gold jewelry',
    scope: { category: 'Gold', jewelry: true },
    hint: 'necklaces, bracelets, rings, pendants, earrings, brooches, cufflinks and watches',
  },
  {
    key: 'silver-jewelry',
    label: 'Silver jewelry',
    scope: { category: 'Silver', jewelry: true },
    hint: 'necklaces, bracelets, rings, pendants, earrings, brooches, cufflinks and watches',
  },
  {
    key: 'non-jewelry',
    label: 'Non-jewelry items',
    scope: { category: null, jewelry: false },
    hint: 'coins, bullion, silverware and other non-wearable pieces, either metal',
  },
];

// Which status list the picker and random fills work from. Exactly one is
// checked at a time; "all" spans the two public statuses (available + sold) —
// draft/pending/archived never appear here or in a slideshow. A sold piece in
// a lineup links to its product page, where the shopper sees it is sold.
const STATUS_FILTERS: Array<{ value: CarouselStatusFilter; label: string; noun: string }> = [
  { value: 'all', label: 'All items', noun: '' },
  { value: 'available', label: 'Available items', noun: 'available' },
  { value: 'sold', label: 'Sold items', noun: 'sold' },
];

function moveId(ids: string[], id: string, direction: -1 | 1): string[] {
  const index = ids.indexOf(id);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= ids.length) return ids;
  const next = [...ids];
  [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
  return next;
}

function mergeCatalog(current: Map<string, CarouselItem>, items: CarouselItem[]): Map<string, CarouselItem> {
  const next = new Map(current);
  items.forEach((item) => next.set(item.id, item));
  return next;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    const message = record.message || record.details || record.hint || record.code;
    if (typeof message === 'string' && message.trim()) return message;
    return JSON.stringify(record);
  }
  return String(error);
}

export default function AdminCarouselSettingsPanel() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [products, setProducts] = useState<CarouselItem[]>([]);
  const [catalog, setCatalog] = useState<Map<string, CarouselItem>>(() => new Map());
  // Selection + per-photo colors are stored PER LINEUP; the tabs below switch
  // which lineup the picker, order list, and preview act on.
  const [activeLineup, setActiveLineup] = useState<CarouselLineup>('primary');
  const [selections, setSelections] = useState<Record<CarouselLineup, string[]>>({
    primary: [],
    alt: [],
    third: [],
  });
  const [itemBgs, setItemBgs] = useState<Record<CarouselLineup, Map<string, string | null>>>({
    primary: new Map(),
    alt: new Map(),
    third: new Map(),
  });
  const selectedIds = selections[activeLineup];
  const itemBg = itemBgs[activeLineup];

  const updateActiveIds = (updater: (current: string[]) => string[]) => {
    setSelections((current) => ({ ...current, [activeLineup]: updater(current[activeLineup]) }));
  };

  const activeLineupLabel = LINEUPS.find((lineup) => lineup.key === activeLineup)?.label ?? 'Slideshow';
  // Which fill button is mid-draw, so it can show progress without blocking the
  // rest of the panel.
  const [filling, setFilling] = useState<string | null>(null);
  // Which status list the picker AND the random fills work from: all items
  // (available + sold), available only, or sold only. A sold piece in a
  // slideshow links to its product page, where the shopper sees it is sold.
  const [statusFilter, setStatusFilter] = useState<CarouselStatusFilter>('available');
  const [visibleCountDesktop, setVisibleCountDesktop] = useState(String(DEFAULT_VISIBLE_COUNT));
  const [visibleCountMobile, setVisibleCountMobile] = useState('4');
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const showNotice = useCallback((text: string, ok = true) => {
    setNotice({ text, ok });
    window.setTimeout(() => setNotice(null), 4200);
  }, []);

  const parseVisibleCountInput = (value: string): number | null => {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Math.round(Number(trimmed));
    return Number.isFinite(parsed) ? parsed : null;
  };

  const previewVisibleCount = (value: string): number => {
    const parsed = parseVisibleCountInput(value);
    if (parsed == null) return DEFAULT_VISIBLE_COUNT;
    return Math.min(MAX_VISIBLE_COUNT, Math.max(MIN_VISIBLE_COUNT, parsed));
  };

  // Anything already in this lineup leaves the picker (owner request
  // 2026-08-04), so "available" means genuinely still addable. Removing a piece
  // from the order list — or switching lineup tabs — brings it straight back,
  // because this derives from the current selection rather than a second list.
  const availableProducts = useMemo(
    () => products.filter((item) => !selectedIds.includes(item.id)),
    [products, selectedIds],
  );

  // Selected items carry their per-photo bgColor, grouped into a white arc and a
  // black arc so the preview shows the same sweeping fade as the home hero.
  const previewItems = useMemo(
    () =>
      groupByBackground(
        selectedIds
          .map((id) => {
            const item = catalog.get(id);
            return item ? { ...item, bgColor: itemBg.get(id) || DEFAULT_BG } : null;
          })
          .filter((item): item is CarouselItem & { bgColor: string } => item !== null),
      ),
    [catalog, selectedIds, itemBg],
  );

  /**
   * Replace the active lineup with a fresh random draw of one scope. The drawn
   * pieces land in the ordinary editable list — reorder, recolor, remove, or add
   * to them exactly as with a hand-picked lineup — and they are merged into the
   * catalog first so their thumbnails and titles render immediately even if they
   * were not in the loaded picker page.
   */
  const fillWithRandom = useCallback(
    async (key: string, label: string, scope: RandomLineupScope) => {
      setFilling(key);
      try {
        // Draw from the same status list the picker is showing.
        const rows = await fetchRandomSampleItems(scope, statusFilter);
        if (rows.length === 0) {
          showNotice(
            `No ${STATUS_FILTERS.find((f) => f.value === statusFilter)?.noun ?? ''} ${label.toLowerCase()} found to draw from.`.replace(/\s+/g, ' '),
            false,
          );
          return;
        }
        setCatalog((current) => mergeCatalog(current, rows));
        const ids = rows.map((row) => row.id);
        setSelections((current) => ({ ...current, [activeLineup]: ids }));
        // A fresh draw has no colour curation of its own, so each piece starts
        // on the backdrop its own product photo was shot against (from the
        // product's stored image padding), falling back to the white arc when
        // the product never set one. Hardcoding white here put white bars around
        // every black-backdrop photo; the admin can still recolour any piece.
        setItemBgs((current) => ({
          ...current,
          [activeLineup]: new Map(rows.map((row) => [row.id, row.bgColor || '#ffffff'])),
        }));
        showNotice(
          `${activeLineupLabel} filled with ${rows.length} random ${label.toLowerCase()}. Adjust the order or swap pieces, then save.`,
        );
      } catch (error) {
        showNotice(getErrorMessage(error), false);
      } finally {
        setFilling(null);
      }
    },
    [activeLineup, activeLineupLabel, showNotice, statusFilter],
  );

  const setItemColor = (id: string, value: string) => {
    setItemBgs((current) => {
      const next = new Map(current[activeLineup]);
      next.set(id, value);
      return { ...current, [activeLineup]: next };
    });
  };

  // Paint the preview backdrop imperatively (the swept gradient), mirroring home.
  const handlePreviewBackground = useCallback((css: string) => {
    if (previewRef.current) previewRef.current.style.background = css;
  }, []);

  useEffect(() => {
    let cancelled = false;

    isCurrentUserAdmin()
      .then((allowed) => {
        if (!cancelled) setIsAdmin(allowed);
      })
      .finally(() => {
        if (!cancelled) setCheckingAdmin(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (checkingAdmin || !isAdmin) return;
    let cancelled = false;

    Promise.allSettled([
      // Fetch ALL public statuses so the catalog can resolve thumbnails/titles
      // for saved lineups that contain sold pieces; the visible picker list is
      // the default Available subset until the admin switches lists.
      fetchAllProducts('', 200, 'all'),
      fetchSelectionEntries('primary'),
      fetchSelectionEntries('alt'),
      fetchSelectionEntries('third'),
      fetchSettings(),
    ])
      .then(([productsResult, entriesResult, altEntriesResult, thirdEntriesResult, settingsResult]) => {
        if (cancelled) return;

        if (productsResult.status === 'fulfilled') {
          setProducts(productsResult.value.filter((item) => item.status === 'available'));
          setCatalog((current) => mergeCatalog(current, productsResult.value));
        } else {
          showNotice(getErrorMessage(productsResult.reason), false);
        }

        if (entriesResult.status === 'fulfilled') {
          const entries = entriesResult.value;
          setSelections((current) => ({ ...current, primary: entries.map((entry) => entry.productId) }));
          setItemBgs((current) => ({
            ...current,
            primary: new Map(entries.map((entry) => [entry.productId, entry.bgColor])),
          }));
        } else {
          showNotice(`Carousel selection table is not ready: ${getErrorMessage(entriesResult.reason)}`, false);
        }

        // Missing alt table reads as an empty lineup (fetch returns []), which
        // is also exactly how the storefront behaves before the migration.
        if (altEntriesResult.status === 'fulfilled') {
          const entries = altEntriesResult.value;
          setSelections((current) => ({ ...current, alt: entries.map((entry) => entry.productId) }));
          setItemBgs((current) => ({
            ...current,
            alt: new Map(entries.map((entry) => [entry.productId, entry.bgColor])),
          }));
        } else {
          showNotice(`Second slideshow lineup failed to load: ${getErrorMessage(altEntriesResult.reason)}`, false);
        }

        if (thirdEntriesResult.status === 'fulfilled') {
          const entries = thirdEntriesResult.value;
          setSelections((current) => ({ ...current, third: entries.map((entry) => entry.productId) }));
          setItemBgs((current) => ({
            ...current,
            third: new Map(entries.map((entry) => [entry.productId, entry.bgColor])),
          }));
        } else {
          showNotice(`Third slideshow lineup failed to load: ${getErrorMessage(thirdEntriesResult.reason)}`, false);
        }

        if (settingsResult.status === 'fulfilled') {
          setVisibleCountDesktop(String(settingsResult.value.visibleCountDesktop));
          setVisibleCountMobile(String(settingsResult.value.visibleCountMobile));
          // Selection modes are no longer surfaced: random draws seed the
          // editable lineup instead of acting as a live source, so every save
          // writes 'manual'. A legacy random value simply converts on next save.
        } else {
          showNotice(`Carousel settings table is not ready: ${getErrorMessage(settingsResult.reason)}`, false);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [checkingAdmin, isAdmin, showNotice]);

  useEffect(() => {
    if (checkingAdmin || !isAdmin) return;
    const timeout = window.setTimeout(() => {
      fetchAllProducts(search, 200, statusFilter)
        .then((rows) => {
          setProducts(rows);
          setCatalog((current) => mergeCatalog(current, rows));
        })
        .catch((error: unknown) => showNotice(getErrorMessage(error), false));
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [checkingAdmin, isAdmin, search, statusFilter, showNotice]);

  const toggleProduct = (id: string) => {
    updateActiveIds((current) =>
      current.includes(id) ? current.filter((selectedId) => selectedId !== id) : [...current, id],
    );
  };

  const handleSave = async () => {
    const desktop = parseVisibleCountInput(visibleCountDesktop);
    const mobile = parseVisibleCountInput(visibleCountMobile);

    if (desktop == null || desktop < MIN_VISIBLE_COUNT || desktop > MAX_VISIBLE_COUNT) {
      showNotice(
        `Desktop "cards visible at once" must be a whole number from ${MIN_VISIBLE_COUNT} to ${MAX_VISIBLE_COUNT}.`,
        false,
      );
      return;
    }

    if (mobile == null || mobile < MIN_VISIBLE_COUNT || mobile > MAX_VISIBLE_COUNT) {
      showNotice(
        `Mobile "cards visible at once" must be a whole number from ${MIN_VISIBLE_COUNT} to ${MAX_VISIBLE_COUNT}.`,
        false,
      );
      return;
    }

    setSaving(true);
    try {
      const entriesFor = (lineup: CarouselLineup): SelectionEntry[] =>
        selections[lineup].map((id) => ({
          productId: id,
          bgColor: itemBgs[lineup].get(id) ?? null,
        }));
      await saveSelection(entriesFor('primary'), 'primary');
      // Don't fail the whole save over a later lineup: the primary slideshow is
      // already saved and the storefront falls back to it. Each missing table
      // names the SQL file that creates it.
      const warnings: string[] = [];
      const saveLater = async (lineup: 'alt' | 'third', label: string, sqlFile: string) => {
        try {
          await saveSelection(entriesFor(lineup), lineup);
        } catch (error) {
          warnings.push(
            isMissingTable(error as { code?: string; message?: string })
              ? `${label} was NOT saved: its table is missing. Run ${sqlFile} in Supabase, then save again.`
              : `${label} was NOT saved: ${getErrorMessage(error)}`,
          );
        }
      };
      await saveLater('alt', 'Slideshow 2', 'carousel/sql/add-second-lineup.sql');
      await saveLater('third', 'Slideshow 3', 'carousel/sql/add-third-lineup.sql');

      // bgColor is fixed to the default now that each photo sets its own.
      // Every lineup is saved as an explicit list. Random draws only seed that
      // list in the panel, so the stored mode is always manual — a live random
      // mode would re-draw server-side and discard the admin's arrangement.
      await saveSettings({
        showPrice: false,
        bgColor: DEFAULT_BG,
        visibleCountDesktop: desktop,
        visibleCountMobile: mobile,
        selectionModePrimary: 'manual',
        selectionModeAlt: 'manual',
        selectionModeThird: 'manual',
      });
      const altSaveWarning = warnings.length > 0 ? warnings.join(' ') : null;
      setVisibleCountDesktop(String(desktop));
      setVisibleCountMobile(String(mobile));
      let storefrontRefreshed = false;
      try {
        const response = await fetch('/api/admin/carousel/revalidate', { method: 'POST' });
        storefrontRefreshed = response.ok;
      } catch {
        // The database save succeeded. The server cache also expires on its
        // five-minute timer, so a revalidation hiccup should not report the
        // whole save as failed.
      }
      if (altSaveWarning) {
        showNotice(`Saved with warnings: ${altSaveWarning}`, false);
      } else {
        showNotice(
          storefrontRefreshed
            ? 'All slideshow lineups and settings saved; the storefront cache was refreshed.'
            : 'All slideshow lineups and settings saved. The storefront may take up to five minutes to refresh.',
        );
      }
    } catch (error) {
      showNotice(getErrorMessage(error), false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mt-8 border bg-white" style={{ borderColor: 'var(--color-outline-variant)' }}>
      <div className="border-b px-5 py-4" style={{ borderColor: 'var(--color-outline-variant)' }}>
        <h2
          className="text-xl font-bold"
          style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}
        >
          Store Carousel Hero
        </h2>
      </div>

      <div className="p-5">
        {notice && (
          <div
            className="mb-4 px-3 py-2 text-xs font-medium"
            role="status"
            style={{
              background: notice.ok ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)' : 'color-mix(in srgb, var(--color-error) 10%, transparent)',
              border: `1px solid ${notice.ok ? 'color-mix(in srgb, var(--color-primary) 28%, transparent)' : 'color-mix(in srgb, var(--color-error) 28%, transparent)'}`,
              color: notice.ok ? 'var(--color-primary)' : 'var(--color-error)',
              fontFamily: 'var(--font-label)',
            }}
          >
            {notice.text}
          </div>
        )}

        {checkingAdmin || loading ? (
          <div className="border px-4 py-5 text-sm" style={{ borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface-variant)' }}>
            Loading carousel settings...
          </div>
        ) : !isAdmin ? (
          <div className="border px-4 py-5 text-sm" style={{ borderColor: 'var(--color-error)', color: 'var(--color-error)' }}>
            Carousel controls are available only to the configured carousel admin account.
          </div>
        ) : (
          <div className="grid gap-6">
            {/* Lineup tabs: which slideshow the picker/order/preview act on. */}
            <div>
              <div className="flex flex-wrap gap-2" role="tablist" aria-label="Slideshow lineup">
                {LINEUPS.map((lineup) => {
                  const active = activeLineup === lineup.key;
                  return (
                    <button
                      key={lineup.key}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setActiveLineup(lineup.key)}
                      className="border px-4 py-2 text-sm font-semibold transition-colors"
                      style={{
                        borderColor: active ? 'var(--color-primary)' : 'var(--color-outline-variant)',
                        background: active
                          ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)'
                          : 'var(--color-surface-container-lowest)',
                        color: active ? 'var(--color-primary)' : 'var(--color-on-surface)',
                        fontFamily: 'var(--font-label)',
                      }}
                    >
                      {lineup.label}
                      <span className="ml-2 text-xs font-normal" style={{ color: 'var(--color-on-surface-variant)' }}>
                        {selections[lineup.key].length} selected
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                {LINEUPS.find((lineup) => lineup.key === activeLineup)?.hint}
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,0.85fr)]">
              <div className="border p-4" style={{ borderColor: 'var(--color-outline-variant)' }}>
                <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <label className="form-label" htmlFor="carousel-product-search">
                      Search products
                    </label>
                    <input
                      id="carousel-product-search"
                      className="form-field mt-1 w-full min-w-[16rem]"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search by title"
                    />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}>
                    {availableProducts.length} to choose from · {selectedIds.length} in lineup
                  </span>
                </div>

                {/* Which list to work from. Checking one box unchecks the
                    others — the picker and the random fill buttons both draw
                    from this list. */}
                <div
                  className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 border px-3 py-2"
                  style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}
                  role="group"
                  aria-label="Product list"
                >
                  {STATUS_FILTERS.map((filter) => (
                    <label key={filter.value} className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-on-surface)' }}>
                      <input
                        type="checkbox"
                        checked={statusFilter === filter.value}
                        onChange={() => setStatusFilter(filter.value)}
                      />
                      {filter.label}
                    </label>
                  ))}
                  {statusFilter !== 'available' && (
                    <span className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                      A sold piece in a slideshow links to its product page, where shoppers see it&apos;s sold.
                    </span>
                  )}
                </div>

                <div className="grid max-h-[28rem] gap-2 overflow-y-auto pr-1">
                  {availableProducts.length === 0 && (
                    <div className="border px-3 py-4 text-sm" style={{ borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface-variant)' }}>
                      {products.length === 0
                        ? `No ${STATUS_FILTERS.find((f) => f.value === statusFilter)?.noun || ''} products found.`.replace(/\s+/g, ' ')
                        : `Every matching product is already in ${activeLineupLabel}. Remove one from the order list to bring it back here.`}
                    </div>
                  )}
                  {availableProducts.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => toggleProduct(item.id)}
                      title={item.name}
                      className="flex items-center gap-2 border p-1.5 text-left transition-colors"
                      style={{
                        borderColor: 'var(--color-outline-variant)',
                        background: 'var(--color-surface-container-lowest)',
                      }}
                    >
                      <span className="relative h-10 w-10 shrink-0 overflow-hidden border bg-white" style={{ borderColor: 'var(--color-outline-variant)' }}>
                        {item.imageUrl ? (
                          <Image src={item.imageUrl} alt="" fill sizes="40px" className="object-contain" unoptimized={item.imageUrl.startsWith('/assets/')} />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-[0.55rem]">No image</span>
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          className="text-sm font-semibold leading-tight"
                          style={{
                            color: 'var(--color-on-surface)',
                            display: '-webkit-box',
                            WebkitBoxOrient: 'vertical',
                            WebkitLineClamp: 2,
                            overflow: 'hidden',
                          }}
                        >
                          {item.name}
                        </span>
                      </span>
                      {item.status === 'sold' && (
                        <span className="carousel-sold-chip shrink-0">SOLD</span>
                      )}
                      <span className="shrink-0 text-sm font-bold" style={{ color: 'var(--color-primary)' }} aria-hidden="true">
                        +
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="border p-4" style={{ borderColor: 'var(--color-outline-variant)' }}>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}>
                    {`${activeLineupLabel} order`}
                  </h3>
                  <span className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                    8-12 pieces works best
                  </span>
                </div>

                <div
                  className="grid max-h-[22rem] gap-2 overflow-y-auto pr-1"
                >
                  {selectedIds.length === 0 && (
                    <div className="border px-3 py-4 text-sm" style={{ borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface-variant)' }}>
                      No products selected yet.
                    </div>
                  )}
                  {selectedIds.map((id, index) => {
                    const item = catalog.get(id);
                    const currentItemBg = itemBg.get(id) || '#ffffff';
                    return (
                      <div key={id} className="flex items-center gap-1.5 border p-1.5" style={{ borderColor: 'var(--color-outline-variant)' }}>
                        <span className="w-5 shrink-0 text-center text-xs font-bold" style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}>
                          {index + 1}
                        </span>
                        <span className="relative h-10 w-10 shrink-0 overflow-hidden border bg-white" style={{ borderColor: 'var(--color-outline-variant)' }}>
                          {item?.imageUrl ? (
                            <Image src={item.imageUrl} alt="" fill sizes="40px" className="object-contain" unoptimized={item.imageUrl.startsWith('/assets/')} />
                          ) : (
                            <span className="flex h-full w-full items-center justify-center text-[0.55rem]" style={{ color: 'var(--color-on-surface-variant)' }}>
                              —
                            </span>
                          )}
                        </span>
                        <span className="min-w-0 flex-1" title={item?.name || id}>
                          <span
                            className="text-sm font-semibold leading-tight"
                            style={{
                              color: 'var(--color-on-surface)',
                              display: '-webkit-box',
                              WebkitBoxOrient: 'vertical',
                              WebkitLineClamp: 2,
                              overflow: 'hidden',
                            }}
                          >
                            {item?.name || id}
                          </span>
                        </span>
                        {item?.status === 'sold' && (
                          <span className="carousel-sold-chip shrink-0">SOLD</span>
                        )}
                        {/* Group: white / black swatch toggles */}
                        {ITEM_BG_OPTIONS.map((option) => {
                          const active = currentItemBg === option.value;
                          return (
                            <button
                              key={option.label}
                              type="button"
                              title={`${option.label} background`}
                              aria-label={`${option.label} background`}
                              onClick={() => setItemColor(id, option.value)}
                              className="h-6 w-6 shrink-0"
                              style={{
                                background: option.value,
                                border: active ? '2px solid var(--color-primary)' : '1px solid var(--color-outline-variant)',
                                boxShadow: active ? '0 0 0 1px var(--color-primary)' : 'none',
                              }}
                            />
                          );
                        })}
                        <span className="mx-0.5 w-px self-stretch" style={{ background: 'var(--color-outline-variant)' }} aria-hidden="true" />
                        <button type="button" title="Move up" aria-label="Move up" className="outline-button px-1.5 py-0.5 text-xs leading-none" onClick={() => updateActiveIds((current) => moveId(current, id, -1))} disabled={index === 0}>
                          ↑
                        </button>
                        <button type="button" title="Move down" aria-label="Move down" className="outline-button px-1.5 py-0.5 text-xs leading-none" onClick={() => updateActiveIds((current) => moveId(current, id, 1))} disabled={index === selectedIds.length - 1}>
                          ↓
                        </button>
                        <button type="button" title="Remove" aria-label="Remove" className="outline-button px-1.5 py-0.5 text-xs leading-none" onClick={() => toggleProduct(id)}>
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-5 grid gap-4 border-t pt-4" style={{ borderColor: 'var(--color-outline-variant)' }}>
                  <div className="grid gap-3">
                    <span className="text-sm font-semibold" style={{ color: 'var(--color-on-surface)' }}>
                      Cards visible at once
                    </span>
                    <div className="flex flex-wrap items-center gap-4">
                      <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-on-surface)' }} htmlFor="carousel-visible-desktop">
                        Desktop
                        <input
                          id="carousel-visible-desktop"
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={visibleCountDesktop}
                          onChange={(event) => setVisibleCountDesktop(event.target.value)}
                          className="form-field w-20"
                          aria-describedby="carousel-visible-count-help"
                        />
                      </label>
                      <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-on-surface)' }} htmlFor="carousel-visible-mobile">
                        Mobile
                        <input
                          id="carousel-visible-mobile"
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={visibleCountMobile}
                          onChange={(event) => setVisibleCountMobile(event.target.value)}
                          className="form-field w-20"
                          aria-describedby="carousel-visible-count-help"
                        />
                      </label>
                    </div>
                    <span id="carousel-visible-count-help" className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                      Fewer = closer &amp; more intimate; the rest cycle through ({MIN_VISIBLE_COUNT}&ndash;{MAX_VISIBLE_COUNT}). Values are checked when you save. The preview below uses the desktop value.
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Random draws seed the editable lineup; they are a starting point
                to curate, not a live source. This sits BELOW the picker and the
                order list (owner request 2026-08-04) so it reads as an action on
                the two lists above it — it draws from whichever status list is
                selected up there, and replaces the order list beside it. */}
            <fieldset className="border p-3" style={{ borderColor: 'var(--color-outline-variant)' }}>
              <legend
                className="px-1 text-xs font-bold uppercase tracking-wide"
                style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}
              >
                {`Fill ${activeLineupLabel} with random items`}
              </legend>
              <div className="flex flex-wrap items-center gap-2">
                {RANDOM_FILL_OPTIONS.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    className="outline-button text-xs"
                    title={option.hint}
                    disabled={filling !== null}
                    onClick={() => void fillWithRandom(option.key, option.label, option.scope)}
                  >
                    {filling === option.key ? 'Drawing...' : option.label}
                  </button>
                ))}
                <span className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                  drawn from the <strong>{STATUS_FILTERS.find((f) => f.value === statusFilter)?.label}</strong> list above
                </span>
              </div>
              <p className="mt-2 text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                Replaces the {activeLineupLabel} order above with up to {RANDOM_LINEUP_SIZE} random
                pieces of that kind. Adjust the order, colors, or which pieces are included, then
                save — the slideshow shows exactly what is in the list. Draw again for a different set.
              </p>
            </fieldset>

            <div className="border p-4" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}>
                  Live preview — {activeLineupLabel}
                </h3>
                <button type="button" onClick={handleSave} disabled={saving} className="gold-button text-sm">
                  {saving ? 'Saving...' : 'Save All Slideshows'}
                </button>
              </div>
              <div
                ref={previewRef}
                className="admin-carousel-preview overflow-hidden border"
                style={{ borderColor: 'var(--color-outline-variant)', background: DEFAULT_BG }}
              >
                <Carousel
                  items={previewItems}
                  bg={DEFAULT_BG}
                  cardWidth={7}
                  perspective={20}
                  visibleCount={previewVisibleCount(visibleCountDesktop)}
                  onBackgroundChange={handlePreviewBackground}
                />
              </div>
              <p className="mt-2 text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                Assign each photo to the <strong>White</strong> or <strong>Black</strong> group. They&apos;re
                auto-arranged into a white arc and a black arc, and the hero background sweeps to match as each
                group rotates to the front.
              </p>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .carousel-sold-chip {
          padding: 0.1rem 0.4rem;
          border: 1px solid color-mix(in srgb, var(--color-error) 45%, transparent);
          background: color-mix(in srgb, var(--color-error) 9%, transparent);
          color: var(--color-error);
          font-family: var(--font-label);
          font-size: 0.6rem;
          font-weight: 700;
          letter-spacing: 0.08em;
        }

        .admin-carousel-preview > div:first-child {
          min-height: 22rem;
          block-size: 22rem;
          /* Transparent scene so the wrapper's fading backdrop shows through. */
          background: transparent !important;
        }

        @media (max-width: 640px) {
          .admin-carousel-preview > div:first-child {
            min-height: 18rem;
            block-size: 18rem;
          }
        }
      `}</style>
    </section>
  );
}
