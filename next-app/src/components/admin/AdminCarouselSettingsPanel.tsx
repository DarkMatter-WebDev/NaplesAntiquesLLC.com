'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Carousel } from '../../../carousel/components/Carousel';
import {
  fetchAllProducts,
  fetchSelectionEntries,
  fetchSettings,
  groupByBackground,
  isCurrentUserAdmin,
  saveSelection,
  saveSettings,
  type CarouselItem,
  type SelectionEntry,
} from '../../../carousel/lib/carouselData';
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
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [itemBg, setItemBg] = useState<Map<string, string | null>>(() => new Map());
  const [showPrice, setShowPrice] = useState(false);
  const [visibleCountDesktop, setVisibleCountDesktop] = useState(DEFAULT_VISIBLE_COUNT);
  const [visibleCountMobile, setVisibleCountMobile] = useState(4);
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const clampVisible = (value: string) => {
    const n = Math.round(Number(value));
    return Number.isFinite(n) ? Math.min(MAX_VISIBLE_COUNT, Math.max(MIN_VISIBLE_COUNT, n)) : null;
  };

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

  const setItemColor = (id: string, value: string) => {
    setItemBg((current) => {
      const next = new Map(current);
      next.set(id, value);
      return next;
    });
  };

  // Paint the preview backdrop imperatively (the swept gradient), mirroring home.
  const handlePreviewBackground = useCallback((css: string) => {
    if (previewRef.current) previewRef.current.style.background = css;
  }, []);

  const showNotice = (text: string, ok = true) => {
    setNotice({ text, ok });
    window.setTimeout(() => setNotice(null), 4200);
  };

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

    Promise.allSettled([fetchAllProducts('', 200), fetchSelectionEntries(), fetchSettings()])
      .then(([productsResult, entriesResult, settingsResult]) => {
        if (cancelled) return;

        if (productsResult.status === 'fulfilled') {
          setProducts(productsResult.value);
          setCatalog((current) => mergeCatalog(current, productsResult.value));
        } else {
          showNotice(getErrorMessage(productsResult.reason), false);
        }

        if (entriesResult.status === 'fulfilled') {
          setSelectedIds(entriesResult.value.map((entry) => entry.productId));
          setItemBg(new Map(entriesResult.value.map((entry) => [entry.productId, entry.bgColor])));
        } else {
          showNotice(`Carousel selection table is not ready: ${getErrorMessage(entriesResult.reason)}`, false);
        }

        if (settingsResult.status === 'fulfilled') {
          setShowPrice(settingsResult.value.showPrice);
          setVisibleCountDesktop(settingsResult.value.visibleCountDesktop);
          setVisibleCountMobile(settingsResult.value.visibleCountMobile);
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
  }, [checkingAdmin, isAdmin]);

  useEffect(() => {
    if (checkingAdmin || !isAdmin) return;
    const timeout = window.setTimeout(() => {
      fetchAllProducts(search, 200)
        .then((rows) => {
          setProducts(rows);
          setCatalog((current) => mergeCatalog(current, rows));
        })
        .catch((error: unknown) => showNotice(getErrorMessage(error), false));
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [checkingAdmin, isAdmin, search]);

  const toggleProduct = (id: string) => {
    setSelectedIds((current) => (current.includes(id) ? current.filter((selectedId) => selectedId !== id) : [...current, id]));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const entries: SelectionEntry[] = selectedIds.map((id) => ({
        productId: id,
        bgColor: itemBg.get(id) ?? null,
      }));
      await saveSelection(entries);
      // bgColor is fixed to the default now that each photo sets its own.
      await saveSettings({ showPrice, bgColor: DEFAULT_BG, visibleCountDesktop, visibleCountMobile });
      showNotice('Carousel hero settings saved.');
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
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,0.85fr)]">
              <div className="border p-4" style={{ borderColor: 'var(--color-outline-variant)' }}>
                <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <label className="form-label" htmlFor="carousel-product-search">
                      Search available products
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
                    {selectedIds.length} selected
                  </span>
                </div>

                <div className="grid max-h-[28rem] gap-2 overflow-y-auto pr-1">
                  {products.length === 0 && (
                    <div className="border px-3 py-4 text-sm" style={{ borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface-variant)' }}>
                      No available products found.
                    </div>
                  )}
                  {products.map((item) => {
                    const selected = selectedIds.includes(item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => toggleProduct(item.id)}
                        title={item.name}
                        className="flex items-center gap-2 border p-1.5 text-left transition-colors"
                        style={{
                          borderColor: selected ? 'var(--color-primary)' : 'var(--color-outline-variant)',
                          background: selected ? 'color-mix(in srgb, var(--color-primary) 8%, transparent)' : 'var(--color-surface-container-lowest)',
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
                        {selected && (
                          <span className="shrink-0 text-sm font-bold" style={{ color: 'var(--color-primary)' }} aria-label="Selected">
                            ✓
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="border p-4" style={{ borderColor: 'var(--color-outline-variant)' }}>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}>
                    Carousel order
                  </h3>
                  <span className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                    8-12 pieces works best
                  </span>
                </div>

                <div className="grid max-h-[22rem] gap-2 overflow-y-auto pr-1">
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
                        <button type="button" title="Move up" aria-label="Move up" className="outline-button px-1.5 py-0.5 text-xs leading-none" onClick={() => setSelectedIds((current) => moveId(current, id, -1))} disabled={index === 0}>
                          ↑
                        </button>
                        <button type="button" title="Move down" aria-label="Move down" className="outline-button px-1.5 py-0.5 text-xs leading-none" onClick={() => setSelectedIds((current) => moveId(current, id, 1))} disabled={index === selectedIds.length - 1}>
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
                  <label className="flex items-center gap-3 text-sm font-semibold" style={{ color: 'var(--color-on-surface)' }}>
                    <input
                      type="checkbox"
                      checked={showPrice}
                      onChange={(event) => setShowPrice(event.target.checked)}
                    />
                    Show price on carousel
                  </label>

                  <div className="grid gap-3">
                    <span className="text-sm font-semibold" style={{ color: 'var(--color-on-surface)' }}>
                      Cards visible at once
                    </span>
                    <div className="flex flex-wrap items-center gap-4">
                      <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-on-surface)' }} htmlFor="carousel-visible-desktop">
                        Desktop
                        <input
                          id="carousel-visible-desktop"
                          type="number"
                          min={MIN_VISIBLE_COUNT}
                          max={MAX_VISIBLE_COUNT}
                          value={visibleCountDesktop}
                          onChange={(event) => {
                            const n = clampVisible(event.target.value);
                            if (n != null) setVisibleCountDesktop(n);
                          }}
                          className="form-field w-20"
                        />
                      </label>
                      <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-on-surface)' }} htmlFor="carousel-visible-mobile">
                        Mobile
                        <input
                          id="carousel-visible-mobile"
                          type="number"
                          min={MIN_VISIBLE_COUNT}
                          max={MAX_VISIBLE_COUNT}
                          value={visibleCountMobile}
                          onChange={(event) => {
                            const n = clampVisible(event.target.value);
                            if (n != null) setVisibleCountMobile(n);
                          }}
                          className="form-field w-20"
                        />
                      </label>
                    </div>
                    <span className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                      Fewer = closer &amp; more intimate; the rest cycle through ({MIN_VISIBLE_COUNT}&ndash;{MAX_VISIBLE_COUNT}). The preview below uses the desktop value.
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="border p-4" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}>
                  Live preview
                </h3>
                <button type="button" onClick={handleSave} disabled={saving} className="gold-button text-sm">
                  {saving ? 'Saving...' : 'Save Carousel Hero'}
                </button>
              </div>
              <div
                ref={previewRef}
                className="admin-carousel-preview overflow-hidden border"
                style={{ borderColor: 'var(--color-outline-variant)', background: DEFAULT_BG }}
              >
                <Carousel
                  items={previewItems}
                  showPrice={showPrice}
                  bg={DEFAULT_BG}
                  cardWidth={7}
                  perspective={20}
                  visibleCount={visibleCountDesktop}
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
