'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { PRODUCT_METAL_VARIANTS, type SpotData } from '@/types/product';
import ShopSortSelect from '@/components/shop/ShopSortSelect';
import { useShopNavigation } from '@/components/shop/ShopNavigationProgress';

const GOLD = '#735c00';
const BORDER = 'rgba(115, 92, 0, 0.35)';
const PRICE_STEP = 50;

type LengthOption = {
  value: string;
  label: string;
  labelEs?: string;
  labelEn?: string;
};

type PurityOption = {
  value: string;
  label: string;
  labelEs?: string;
};

const NECKLACE_LENGTH_OPTIONS: LengthOption[] = [
  { value: '16 in', label: '16 in' },
  { value: '18 in', label: '18 in' },
  { value: '20 in', label: '20 in' },
  { value: '22 in', label: '22 in' },
  { value: '24 in', label: '24 in' },
  { value: '26 in', label: '26 in' },
  { value: '28 in', label: '28 in' },
  { value: '30 in', label: '30 in' },
];

const BRACELET_LENGTH_OPTIONS: LengthOption[] = [
  { value: '7 in', label: '7 in', labelEs: '7 in (pulsera)', labelEn: '7 in (bracelet)' },
  { value: '7.5 in', label: '7.5 in', labelEs: '7.5 in (pulsera)', labelEn: '7.5 in (bracelet)' },
  { value: '8 in', label: '8 in', labelEs: '8 in (pulsera)', labelEn: '8 in (bracelet)' },
];

const GOLD_PURITY_OPTIONS: PurityOption[] = [
  { value: '18', label: '18K' },
  { value: '14', label: '14K' },
  { value: '10', label: '10K' },
];

const SILVER_PURITY_OPTIONS: PurityOption[] = [
  { value: '925', label: '925 Sterling', labelEs: '925 Esterlina' },
];

function getLengthOptionsForItemType(itemType: string | undefined) {
  if (itemType === 'necklace') return NECKLACE_LENGTH_OPTIONS;
  if (itemType === 'bracelet') return BRACELET_LENGTH_OPTIONS;
  return [];
}

function itemTypeSupportsLinkType(itemType: string | undefined) {
  return itemType === 'necklace' || itemType === 'bracelet';
}

function normalizeLengths(length: string | string[] | undefined): string[] {
  const values = Array.isArray(length) ? length : length ? [length] : [];
  return values
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter(Boolean);
}

function getMetalColorOptions(metal: string | undefined) {
  if (metal === 'gold') return PRODUCT_METAL_VARIANTS.Gold;
  if (metal === 'silver') return PRODUCT_METAL_VARIANTS.Silver;
  return [...PRODUCT_METAL_VARIANTS.Gold, ...PRODUCT_METAL_VARIANTS.Silver];
}

interface Props {
  locale: string;
  currentFilters: {
    metal?: string;
    metalColor?: string;
    metalType?: string;
    purity?: string;
    status?: string;
    itemType?: string;
    chainType?: string;
    length?: string | string[];
    gender?: string;
    brand?: string;
    q?: string;
    sort?: string;
    page?: string;
    perPage?: string;
    priceMin?: string;
    priceMax?: string;
    itemGroup?: string;
  };
  brandOptions: string[];
  filteredCount: number;
  allCount: number;
  spotData: SpotData | null;
  priceRange: { min: number; max: number } | null;
  itemTypeOptions?: ItemTypeOption[];
  variant?: 'classic' | 'modern';
  yearFilterNode?: ReactNode;
}

function parseFilterPrice(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function clampPrice(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

const ITEM_TYPE_OPTIONS = [
  { value: 'necklace', label: 'Necklaces', labelEs: 'Collares' },
  { value: 'bracelet', label: 'Bracelets', labelEs: 'Pulseras' },
  { value: 'earrings', label: 'Earrings', labelEs: 'Aretes' },
  { value: 'ring', label: 'Rings', labelEs: 'Anillos' },
  { value: 'pendant', label: 'Pendants', labelEs: 'Dijes' },
  { value: 'charm', label: 'Charms', labelEs: 'Charms' },
  { value: 'brooch', label: 'Brooches', labelEs: 'Broches' },
  { value: 'cufflinks', label: 'Cufflinks', labelEs: 'Gemelos' },
  { value: 'watch', label: 'Watches', labelEs: 'Relojes' },
  { value: 'coin', label: 'Coins', labelEs: 'Monedas' },
  { value: 'silverware', label: 'Silverware / Sterling', labelEs: 'Platería / sterling' },
];

type ItemTypeOption = (typeof ITEM_TYPE_OPTIONS)[number];

// Jewelry & Watches covers wearable jewelry plus watches; every other item type
// (coins, bullion, silverware, and tableware like spoons, trays, goblets, cups)
// belongs to the Sterling Silver group.
const JEWELRY_ITEM_TYPE_KEYS = ['necklace', 'bracelet', 'earrings', 'ring', 'pendant', 'charm', 'brooch', 'cufflinks', 'watch'];

function isJewelryItemType(itemType: string | undefined): boolean {
  return !!itemType && JEWELRY_ITEM_TYPE_KEYS.includes(itemType);
}

function getItemGroupForItemType(itemType: string | undefined) {
  if (!itemType || itemType === 'all') return undefined;
  return isJewelryItemType(itemType) ? 'jewelry' : 'everything-else';
}

export default function ShopFilters({ locale, currentFilters, brandOptions, filteredCount, allCount, spotData, priceRange, itemTypeOptions, variant = 'classic', yearFilterNode }: Props) {
  const { push } = useShopNavigation();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isEs = locale === 'es';
  const priceFloor = priceRange?.min ?? 0;
  const priceCeiling = priceRange?.max ?? 0;
  const parsedPriceMin = parseFilterPrice(currentFilters.priceMin);
  const parsedPriceMax = parseFilterPrice(currentFilters.priceMax);
  const currentPriceMin = priceRange ? clampPrice(parsedPriceMin ?? priceFloor, priceFloor, priceCeiling) : 0;
  const currentPriceMax = priceRange ? clampPrice(parsedPriceMax ?? priceCeiling, priceFloor, priceCeiling) : 0;
  const selectedPriceMin = Math.min(currentPriceMin, currentPriceMax);
  const selectedPriceMax = Math.max(currentPriceMin, currentPriceMax);
  const priceFilterActive = !!priceRange && (
    selectedPriceMin > priceFloor ||
    selectedPriceMax < priceCeiling
  );
  const selectedMetalColor = currentFilters.metalColor ?? currentFilters.metalType;
  const metalColorOptions = getMetalColorOptions(currentFilters.metal);
  const silverwareOnlyMetal = currentFilters.itemType === 'silverware';
  const purityOptions = currentFilters.metal === 'silver'
    ? SILVER_PURITY_OPTIONS
    : currentFilters.metal === 'gold'
      ? GOLD_PURITY_OPTIONS
      : [...GOLD_PURITY_OPTIONS, ...SILVER_PURITY_OPTIONS];
  const visiblePurity = purityOptions.some((option) => option.value === currentFilters.purity)
    ? currentFilters.purity
    : '';
  const visibleMetalColor = metalColorOptions.some((variant) => variant.value === selectedMetalColor)
    ? selectedMetalColor
    : undefined;
  const selectedLengths = normalizeLengths(currentFilters.length);
  const lengthOptions = getLengthOptionsForItemType(currentFilters.itemType);
  const visibleLengthValues = lengthOptions.map((option) => option.value);
  const visibleSelectedLengths = selectedLengths.filter((value) => visibleLengthValues.includes(value));
  const showLengthFilter = lengthOptions.length > 0;
  const showLinkTypeFilter = itemTypeSupportsLinkType(currentFilters.itemType);
  const currentItemGroup = currentFilters.itemGroup ?? getItemGroupForItemType(currentFilters.itemType);
  const showMetalFilter = currentItemGroup !== 'everything-else';
  const showGenderFilter = currentItemGroup !== 'everything-else';
  const [filtersOpen, setFiltersOpen] = useState(false);
  const selectedPriceSource = `${selectedPriceMin}:${selectedPriceMax}`;
  const [draftPrice, setDraftPrice] = useState({
    source: selectedPriceSource,
    min: selectedPriceMin,
    max: selectedPriceMax,
  });
  const activeDraftPrice = draftPrice.source === selectedPriceSource
    ? draftPrice
    : { source: selectedPriceSource, min: selectedPriceMin, max: selectedPriceMax };
  const draftPriceMin = activeDraftPrice.min;
  const draftPriceMax = activeDraftPrice.max;

  const updateFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      params.delete('page');
      push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, push, searchParams]
  );

  const updateItemTypeFilter = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set('itemType', value);
      } else {
        params.delete('itemType');
      }
      params.delete('itemGroup');
      params.delete('length');
      params.delete('page');
      if (!itemTypeSupportsLinkType(value)) params.delete('chainType');
      if (value === 'all') {
        params.delete('metal');
        params.delete('metalColor');
        params.delete('metalType');
        params.delete('purity');
      } else if (value && !isJewelryItemType(value)) {
        // Sterling Silver item types (silverware, coins, tableware like spoons,
        // trays, goblets, cups, …) live under the silver group — constrain metal.
        params.set('metal', 'silver');
        if (params.get('purity') && !SILVER_PURITY_OPTIONS.some((option) => option.value === params.get('purity'))) {
          params.delete('purity');
        }
        const selectedColor = params.get('metalColor') ?? params.get('metalType');
        const silverTypes = new Set<string>(PRODUCT_METAL_VARIANTS.Silver.map((variant) => variant.value));
        if (selectedColor && !silverTypes.has(selectedColor)) {
          params.delete('metalColor');
          params.delete('metalType');
        }
      }
      const qs = params.toString();
      push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, push, searchParams]
  );

  const updateMetalFilter = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set('metal', value);
      } else {
        params.delete('metal');
      }

      const selectedColor = params.get('metalColor') ?? params.get('metalType');
      const goldTypes = new Set<string>(PRODUCT_METAL_VARIANTS.Gold.map((variant) => variant.value));
      const silverTypes = new Set<string>(PRODUCT_METAL_VARIANTS.Silver.map((variant) => variant.value));
      if ((value === 'gold' && selectedColor && !goldTypes.has(selectedColor)) ||
          (value === 'silver' && selectedColor && !silverTypes.has(selectedColor))) {
        params.delete('metalColor');
        params.delete('metalType');
      }
      const selectedPurity = params.get('purity');
      if ((value === 'gold' && selectedPurity && !GOLD_PURITY_OPTIONS.some((option) => option.value === selectedPurity)) ||
          (value === 'silver' && selectedPurity && !SILVER_PURITY_OPTIONS.some((option) => option.value === selectedPurity))) {
        params.delete('purity');
      }
      params.delete('page');

      const qs = params.toString();
      push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, push, searchParams]
  );

  const updateItemGroupFilter = useCallback(
    (value: 'jewelry' | 'everything-else') => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete('itemType');
      params.delete('chainType');
      params.delete('length');
      params.delete('page');

      // Re-clicking the already-active category deselects it instead of
      // re-pinning the same value — clears back to "no category filter"
      // rather than toggling to the other option.
      if (currentItemGroup === value) {
        params.delete('itemGroup');
        params.delete('metal');
        params.delete('metalColor');
        params.delete('metalType');
        params.delete('purity');
        const qs = params.toString();
        push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
        return;
      }

      params.set('itemGroup', value);
      if (value === 'jewelry') {
        params.delete('metal');
        params.delete('metalColor');
        params.delete('metalType');
        params.delete('purity');
      } else {
        params.set('metal', 'silver');
        params.delete('gender');
        const selectedPurity = params.get('purity');
        if (selectedPurity && !SILVER_PURITY_OPTIONS.some((option) => option.value === selectedPurity)) {
          params.delete('purity');
        }
        const selectedColor = params.get('metalColor') ?? params.get('metalType');
        const silverTypes = new Set<string>(PRODUCT_METAL_VARIANTS.Silver.map((variant) => variant.value));
        if (selectedColor && !silverTypes.has(selectedColor)) {
          params.delete('metalColor');
          params.delete('metalType');
        }
      }
      const qs = params.toString();
      push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [currentItemGroup, pathname, push, searchParams],
  );

  const toggleLengthFilter = useCallback(
    (value: string) => {
      const params = new URLSearchParams(
        typeof window === 'undefined' ? searchParams.toString() : window.location.search,
      );
      const allowedValues = getLengthOptionsForItemType(currentFilters.itemType).map((option) => option.value);
      const current = normalizeLengths(params.getAll('length')).filter((item) => allowedValues.includes(item));
      const next = current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value];
      if (next.length > 0) {
        params.set('length', next.join(','));
      } else {
        params.delete('length');
      }
      params.delete('page');
      const qs = params.toString();
      push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [currentFilters.itemType, pathname, push, searchParams]
  );

  function clearAll() {
    push(pathname, { scroll: false });
  }

  const hasFilters = !!(
    currentFilters.metal ||
    visibleMetalColor ||
    currentFilters.purity ||
    currentFilters.status ||
    currentFilters.itemType ||
    (showLinkTypeFilter && currentFilters.chainType) ||
    visibleSelectedLengths.length > 0 ||
    currentFilters.gender ||
    currentFilters.brand ||
    currentFilters.q ||
    priceFilterActive ||
    currentFilters.sort ||
    currentFilters.itemGroup
  );

  const activeDrawerFilterCount = [
    currentFilters.metal,
    visibleMetalColor,
    currentFilters.purity,
    currentFilters.status,
    currentFilters.itemType,
    showLinkTypeFilter ? currentFilters.chainType : undefined,
    ...visibleSelectedLengths,
    currentFilters.gender,
    currentFilters.brand,
    priceFilterActive ? 'price' : undefined,
    currentFilters.sort,
    currentFilters.itemGroup,
  ].filter(Boolean).length;
  const isModern = variant === 'modern';
  const visibleItemType = currentFilters.itemType ?? '';
  const allItemTypeOptions = (() => {
    const seen = new Set<string>();
    return [...ITEM_TYPE_OPTIONS, ...(itemTypeOptions ?? [])].filter((option) => {
      if (seen.has(option.value)) return false;
      seen.add(option.value);
      return true;
    });
  })();
  const visibleItemTypeOptions = currentItemGroup === 'everything-else'
    ? allItemTypeOptions.filter((option) => !isJewelryItemType(option.value))
    : currentItemGroup === 'jewelry'
      ? allItemTypeOptions.filter((option) => isJewelryItemType(option.value))
      : allItemTypeOptions;
  const itemGroupOptions = [
    { value: 'jewelry' as const, label: isEs ? 'Joyería y relojes' : 'Jewelry & Watches' },
    { value: 'everything-else' as const, label: isEs ? 'Plata sterling' : 'Sterling Silver' },
  ];

  const labelStyle = {
    color: GOLD,
    fontFamily: 'var(--font-label)',
    fontSize: '0.58rem',
    fontWeight: 700,
    letterSpacing: '0.14em',
    textTransform: 'uppercase' as const,
    display: 'block',
    marginBottom: '0.2rem',
  };

  const selectStyle = {
    width: '100%',
    border: `1px solid ${BORDER}`,
    borderRadius: '2px',
    background: 'var(--color-background)',
    color: 'var(--color-on-surface)',
    fontFamily: 'var(--font-label)',
    fontSize: '0.8125rem',
    padding: '0.4rem 0.6rem',
    outline: 'none',
  };

  const formatSpot = (value: number | null | undefined) => {
    if (!value) return '--';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: value >= 100 ? 0 : 2,
    }).format(value);
  };

  const priceBadgeBaseStyle: CSSProperties = {
    minWidth: '8.75rem',
    padding: '0.42rem 0.7rem',
    textAlign: 'center',
    fontFamily: 'var(--font-label)',
  };

  const silverBadgeStyle: CSSProperties = {
    ...priceBadgeBaseStyle,
    border: '1px solid rgba(129, 138, 146, 0.46)',
    background:
      'linear-gradient(135deg, rgba(255,255,255,0.96), rgba(232,236,239,0.82) 48%, rgba(247,248,248,0.96))',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.88), 0 8px 22px rgba(95,105,113,0.08)',
  };

  const goldBadgeStyle: CSSProperties = {
    ...priceBadgeBaseStyle,
    border: '1px solid rgba(181, 137, 12, 0.46)',
    background:
      'linear-gradient(135deg, rgba(255,253,247,0.98), rgba(250,240,201,0.86) 48%, rgba(255,250,235,0.98))',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9), 0 8px 22px rgba(143,108,6,0.1)',
  };

  const silverLabelStyle: CSSProperties = {
    display: 'block',
    color: '#58626a',
    fontSize: '0.52rem',
    fontWeight: 700,
    letterSpacing: '0.14em',
    lineHeight: 1,
    marginBottom: '0.22rem',
    textTransform: 'uppercase',
  };

  const goldLabelStyle: CSSProperties = {
    ...silverLabelStyle,
    color: '#735c00',
  };

  const silverPriceStyle: CSSProperties = {
    display: 'block',
    color: '#3f4a52',
    fontSize: '0.86rem',
    fontWeight: 800,
    lineHeight: 1.05,
  };

  const goldPriceStyle: CSSProperties = {
    ...silverPriceStyle,
    color: GOLD,
  };

  const formatPrice = (value: number) => new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);

  const commitPriceRange = useCallback(
    (low: number, high: number) => {
      if (!priceRange) return;
      const nextLow = clampPrice(Math.min(low, high), priceFloor, priceCeiling);
      const nextHigh = clampPrice(Math.max(low, high), priceFloor, priceCeiling);
      const params = new URLSearchParams(searchParams.toString());
      if (nextLow > priceFloor) {
        params.set('priceMin', String(nextLow));
      } else {
        params.delete('priceMin');
      }
      if (nextHigh < priceCeiling) {
        params.set('priceMax', String(nextHigh));
      } else {
        params.delete('priceMax');
      }
      params.delete('page');
      const qs = params.toString();
      push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, priceCeiling, priceFloor, priceRange, push, searchParams],
  );
  const applyAndCloseFilters = useCallback(() => {
    if (priceRange) commitPriceRange(draftPriceMin, draftPriceMax);
    setFiltersOpen(false);
  }, [commitPriceRange, draftPriceMax, draftPriceMin, priceRange]);
  const priceTrackSpan = priceRange && priceCeiling > priceFloor ? priceCeiling - priceFloor : 1;
  const priceTrackLeft = ((draftPriceMin - priceFloor) / priceTrackSpan) * 100;
  const priceTrackRight = 100 - ((draftPriceMax - priceFloor) / priceTrackSpan) * 100;

  return (
    <div className={`shop-filters${isModern ? ' shop-filters-modern' : ''}`} style={{ marginBottom: '1.5rem' }} data-filters-open={filtersOpen ? 'true' : 'false'}>

      {/* Filters toggle — always visible on mobile/tablet, hidden on desktop */}
      <div className="shop-filter-toggle-row" style={{ display: 'flex', justifyContent: 'center', marginBottom: filtersOpen ? '0.85rem' : '0.5rem' }}>
        <button
          type="button"
          aria-expanded={filtersOpen}
          aria-controls="shop-filter-panel"
          onClick={() => setFiltersOpen((open) => !open)}
          className="outline-button text-xs"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            minHeight: '2.25rem',
            paddingInline: '0.95rem',
          }}
        >
          <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: '17px' }}>filter_list</span>
          {isEs ? 'Filtros' : 'Filters'}
          {activeDrawerFilterCount > 0 && (
            <span
              style={{
                minWidth: '1.15rem',
                height: '1.15rem',
                borderRadius: '999px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--color-primary)',
                color: 'var(--color-on-primary)',
                fontSize: '0.65rem',
                lineHeight: 1,
              }}
            >
              {activeDrawerFilterCount}
            </span>
          )}
        </button>
      </div>

      <div id="shop-filter-panel" className={`shop-filter-panel${filtersOpen ? ' is-open' : ''}`}>
        {hasFilters && (
          <div className="shop-clear-filters-top">
            <button type="button" onClick={clearAll}>
              <span className="material-symbols-outlined" aria-hidden="true">close</span>
              {isEs ? 'Limpiar filtros' : 'Clear filters'}
            </button>
          </div>
        )}

        {/* Search + live metal prices */}
        <div className="shop-search-spot-row">
          <div
            style={silverBadgeStyle}
            aria-label={isEs ? 'Precio de plata en vivo por onza troy' : 'Live silver price per troy ounce'}
          >
            <span style={silverLabelStyle}>{isEs ? 'Plata / oz' : 'Silver / oz'}</span>
            <span style={silverPriceStyle}>{formatSpot(spotData?.silverPerTroyOz)}</span>
          </div>

          <div style={{ width: '100%', maxWidth: '24rem' }}>
            <input
              type="search"
              defaultValue={currentFilters.q ?? ''}
              placeholder={isEs
                ? 'Buscar oro, cadena, pulsera, collar, anillo…'
                : 'Search gold, chain, bracelet, necklace, ring…'}
              onChange={(e) => updateFilter('q', e.target.value)}
              style={{
                width: '100%',
                padding: '0.45rem 0.8rem',
                border: `1px solid rgba(115, 92, 0, 0.5)`,
                borderRadius: '2px',
                background: 'var(--color-background)',
                color: 'var(--color-on-surface)',
                fontFamily: 'var(--font-label)',
                fontSize: '0.875rem',
              }}
            />
          </div>

          <div
            style={goldBadgeStyle}
            aria-label={isEs ? 'Precio de oro en vivo por onza troy' : 'Live gold price per troy ounce'}
          >
            <span style={goldLabelStyle}>{isEs ? 'Oro / oz' : 'Gold / oz'}</span>
            <span style={goldPriceStyle}>{formatSpot(spotData?.goldPerTroyOz)}</span>
          </div>
        </div>

        {/* ERA/Year slider — mobile/tablet only; desktop shows it above the catalog */}
        {yearFilterNode && (
          <div className="shop-year-filter-in-panel">
            {yearFilterNode}
          </div>
        )}

        {/* Category */}
        {isModern && (
          <div className="modern-sidebar-gender">
            <span className="modern-sidebar-label">{isEs ? 'Categoría' : 'Category'}</span>
            <div className="modern-sidebar-gender-grid">
              {itemGroupOptions.map((option) => {
                const active = currentItemGroup === option.value;
                return (
                  <button
                    key={option.label}
                    type="button"
                    onClick={() => updateItemGroupFilter(option.value)}
                    aria-pressed={active}
                    className="modern-sidebar-gender-button"
                    data-active={active ? 'true' : 'false'}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

          {/* Labeled dropdowns */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
              gap: '0.6rem',
              maxWidth: '66rem',
              margin: '0 auto 0.85rem',
            }}
            className="shop-filter-grid"
          >
            {showGenderFilter && (
              <div>
                <label style={labelStyle}>{isEs ? 'Género' : 'Gender'}</label>
                <select
                  value={currentFilters.gender ?? ''}
                  onChange={(e) => updateFilter('gender', e.target.value)}
                  style={selectStyle}
                >
                  <option value="">{isEs ? 'Todos' : 'All'}</option>
                  <option value="Unisex">{isEs ? 'Unisex' : 'Unisex'}</option>
                  <option value="Men">{isEs ? 'Hombres' : 'Men'}</option>
                  <option value="Women">{isEs ? 'Mujeres' : 'Women'}</option>
                </select>
              </div>
            )}

            {/* Item Type */}
            <div>
              <label style={labelStyle}>{isEs ? 'Artículo' : 'Item Type'}</label>
              <select
                value={visibleItemType}
                onChange={(e) => updateItemTypeFilter(e.target.value)}
                style={selectStyle}
              >
                <option value="">{isEs ? 'Todos' : 'All items'}</option>
                {visibleItemTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {isEs ? option.labelEs : option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Link Type */}
            {showLinkTypeFilter && (
              <div>
                <label style={labelStyle}>{isEs ? 'Tipo de enlace' : 'Link Type'}</label>
                <select
                  value={currentFilters.chainType ?? ''}
                  onChange={(e) => updateFilter('chainType', e.target.value)}
                  style={selectStyle}
                >
                  <option value="">{isEs ? 'Todos los enlaces' : 'All link types'}</option>
                  <option value="cuban-link">{isEs ? 'Cubana' : 'Cuban link'}</option>
                  <option value="figaro-link">{isEs ? 'Figaro' : 'Figaro link'}</option>
                  <option value="rope-chain">{isEs ? 'Cuerda' : 'Rope chain'}</option>
                  <option value="anchor-link">{isEs ? 'Ancla / Gucci' : 'Anchor / Gucci'}</option>
                  <option value="oval-link">{isEs ? 'Ovalada' : 'Oval link'}</option>
                  <option value="byzantine-link">{isEs ? 'Bizantina' : 'Byzantine'}</option>
                  <option value="box-link">{isEs ? 'Caja' : 'Box link'}</option>
                </select>
              </div>
            )}

            {/* Brand */}
            <div>
              <label style={labelStyle}>{isEs ? 'Marca' : 'Brand'}</label>
              <select
                value={currentFilters.brand ?? ''}
                onChange={(e) => updateFilter('brand', e.target.value)}
                style={selectStyle}
              >
                <option value="">{isEs ? 'Todas las marcas' : 'All brands'}</option>
                {brandOptions.map((brand) => (
                  <option key={brand} value={brand}>{brand}</option>
                ))}
              </select>
            </div>

            {showMetalFilter && (
              <div>
                <label style={labelStyle}>{isEs ? 'Metal' : 'Metal'}</label>
                <select
                  value={currentFilters.metal ?? ''}
                  onChange={(e) => updateMetalFilter(e.target.value)}
                  style={selectStyle}
                >
                  {!silverwareOnlyMetal && <option value="">{isEs ? 'Todos los metales' : 'All metals'}</option>}
                  {!silverwareOnlyMetal && <option value="gold">{isEs ? 'Oro' : 'Gold'}</option>}
                  <option value="silver">{isEs ? 'Plata' : 'Silver'}</option>
                </select>
              </div>
            )}

            {/* Metal Color */}
            <div>
              <label style={labelStyle}>{isEs ? 'Color del metal' : 'Metal Color'}</label>
              <select
                value={visibleMetalColor ?? ''}
                onChange={(e) => {
                  const params = new URLSearchParams(searchParams.toString());
                  if (e.target.value) {
                    params.set('metalColor', e.target.value);
                  } else {
                    params.delete('metalColor');
                  }
                  params.delete('metalType');
                  params.delete('page');
                  const qs = params.toString();
                  push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
                }}
                style={selectStyle}
              >
                <option value="">{isEs ? 'Todos los colores' : 'All colors'}</option>
                {metalColorOptions.map((variant) => (
                  <option key={variant.value} value={variant.value}>{isEs ? variant.labelEs : variant.label}</option>
                ))}
              </select>
            </div>

            {/* Purity */}
            <div>
              <label style={labelStyle}>{isEs ? 'Pureza' : 'Purity'}</label>
              <select
                value={visiblePurity}
                onChange={(e) => updateFilter('purity', e.target.value)}
                style={selectStyle}
              >
                <option value="">{isEs ? 'Todas' : 'All purities'}</option>
                {purityOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {isEs ? option.labelEs ?? option.label : option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Sort */}
            <ShopSortSelect
              locale={locale}
              currentSort={currentFilters.sort}
              appearance="filter"
              labelStyle={labelStyle}
              selectStyle={selectStyle}
            />

          </div>

          {priceRange && priceCeiling > priceFloor && (
            <div className="shop-price-filter">
              <div className="shop-price-filter-header">
                <div>
                  <span style={labelStyle}>{isEs ? 'Precio' : 'Price'}</span>
                  <strong>{formatPrice(draftPriceMin)} - {formatPrice(draftPriceMax)}</strong>
                </div>
                {priceFilterActive && (
                  <button
                    type="button"
                    onClick={() => commitPriceRange(priceFloor, priceCeiling)}
                  >
                    {isEs ? 'Restablecer' : 'Reset'}
                  </button>
                )}
              </div>
              <div
                className="shop-price-slider"
                style={{
                  '--price-left': `${priceTrackLeft}%`,
                  '--price-right': `${priceTrackRight}%`,
                } as CSSProperties}
              >
                <input
                  type="range"
                  min={priceFloor}
                  max={priceCeiling}
                  step={PRICE_STEP}
                  value={draftPriceMin}
                  aria-label={isEs ? 'Precio mínimo' : 'Minimum price'}
                  onChange={(event) => setDraftPrice({
                    source: selectedPriceSource,
                    min: Math.min(Number(event.target.value), draftPriceMax),
                    max: draftPriceMax,
                  })}
                  onMouseUp={() => commitPriceRange(draftPriceMin, draftPriceMax)}
                  onTouchEnd={() => commitPriceRange(draftPriceMin, draftPriceMax)}
                  onBlur={() => commitPriceRange(draftPriceMin, draftPriceMax)}
                />
                <input
                  type="range"
                  min={priceFloor}
                  max={priceCeiling}
                  step={PRICE_STEP}
                  value={draftPriceMax}
                  aria-label={isEs ? 'Precio máximo' : 'Maximum price'}
                  onChange={(event) => setDraftPrice({
                    source: selectedPriceSource,
                    min: draftPriceMin,
                    max: Math.max(Number(event.target.value), draftPriceMin),
                  })}
                  onMouseUp={() => commitPriceRange(draftPriceMin, draftPriceMax)}
                  onTouchEnd={() => commitPriceRange(draftPriceMin, draftPriceMax)}
                  onBlur={() => commitPriceRange(draftPriceMin, draftPriceMax)}
                />
              </div>
              <div className="shop-price-input-row">
                <label>
                  <span>{isEs ? 'Min' : 'Min'}</span>
                  <input
                    type="number"
                    min={priceFloor}
                    max={priceCeiling}
                    step={PRICE_STEP}
                    value={draftPriceMin}
                    onChange={(event) => setDraftPrice({
                      source: selectedPriceSource,
                      min: clampPrice(Number(event.target.value), priceFloor, draftPriceMax),
                      max: draftPriceMax,
                    })}
                    onBlur={() => commitPriceRange(draftPriceMin, draftPriceMax)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') commitPriceRange(draftPriceMin, draftPriceMax);
                    }}
                  />
                </label>
                <label>
                  <span>{isEs ? 'Max' : 'Max'}</span>
                  <input
                    type="number"
                    min={priceFloor}
                    max={priceCeiling}
                    step={PRICE_STEP}
                    value={draftPriceMax}
                    onChange={(event) => setDraftPrice({
                      source: selectedPriceSource,
                      min: draftPriceMin,
                      max: clampPrice(Number(event.target.value), draftPriceMin, priceCeiling),
                    })}
                    onBlur={() => commitPriceRange(draftPriceMin, draftPriceMax)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') commitPriceRange(draftPriceMin, draftPriceMax);
                    }}
                  />
                </label>
              </div>
            </div>
          )}

          {showLengthFilter && (
            <div style={{ maxWidth: '56rem', margin: '0 auto 0.85rem' }}>
              <span style={labelStyle}>{isEs ? 'Longitud' : 'Length'}</span>
              <div
                className="shop-length-multi"
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.4rem',
                  alignItems: 'center',
                }}
              >
                {lengthOptions.map((option) => {
                  const selected = visibleSelectedLengths.includes(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => toggleLengthFilter(option.value)}
                      aria-pressed={selected}
                      className="shop-length-button"
                      style={{
                        minHeight: '2rem',
                        minWidth: currentFilters.itemType === 'bracelet' ? '6.2rem' : '4.3rem',
                        padding: '0.38rem 0.65rem',
                        border: `1px solid ${selected ? GOLD : BORDER}`,
                        borderRadius: '2px',
                        background: selected
                          ? 'color-mix(in srgb, var(--color-primary) 10%, var(--color-background))'
                          : 'var(--color-background)',
                        color: selected ? GOLD : 'var(--color-on-surface)',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.35rem',
                        fontFamily: 'var(--font-label)',
                        fontSize: '0.74rem',
                        fontWeight: selected ? 800 : 700,
                        lineHeight: 1.1,
                        textAlign: 'center',
                      }}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          width: '0.8rem',
                          height: '0.8rem',
                          border: `1px solid ${selected ? GOLD : 'rgba(115, 92, 0, 0.5)'}`,
                          borderRadius: '2px',
                          background: selected ? GOLD : 'transparent',
                          color: selected ? 'var(--color-background)' : 'transparent',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flex: '0 0 auto',
                          fontSize: '0.72rem',
                          fontWeight: 900,
                          lineHeight: 1,
                        }}
                        className="material-symbols-outlined"
                      >
                        check
                      </span>
                      <span>{isEs ? (option.labelEs ?? option.label) : (option.labelEn ?? option.label)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Available only toggle */}
          <div className="shop-available-row" style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer', fontSize: '0.8125rem', fontFamily: 'var(--font-label)', color: 'var(--color-on-surface-variant)' }}>
              <input
                type="checkbox"
                checked={currentFilters.status === 'available' || currentFilters.status === 'Available'}
                onChange={(e) => updateFilter('status', e.target.checked ? 'available' : '')}
                style={{ accentColor: '#735c00', width: '0.9rem', height: '0.9rem' }}
              />
              {isEs ? 'Solo disponibles' : 'Available only'}
            </label>
          </div>

          <div className="shop-apply-filters-row">
            <button
              type="button"
              className="shop-apply-filters-button"
              onClick={applyAndCloseFilters}
            >
              <span className="material-symbols-outlined" aria-hidden="true">check</span>
              <span>{isEs ? 'Guardar y aplicar filtros' : 'Save and Apply Filters'}</span>
            </button>
          </div>
        </div>

      {/* Meta row. Desktop: piece-count pill (+ clear) in the sidebar.
          Mobile/tablet: this long field becomes the always-visible search bar
          and the piece count moves down to the results toolbar. */}
      <div className="shop-filters-meta">
        <span className="shop-filters-meta-count">
          {isEs
            ? (filteredCount === allCount ? `${allCount} piezas` : `${filteredCount} de ${allCount} piezas`)
            : (filteredCount === allCount ? `${allCount} pieces` : `${filteredCount} of ${allCount} pieces`)}
        </span>
        <div className="shop-filters-meta-search">
          <input
            type="search"
            defaultValue={currentFilters.q ?? ''}
            placeholder={isEs
              ? 'Buscar oro, cadena, pulsera, collar, anillo…'
              : 'Search gold, chain, bracelet, necklace, ring…'}
            onChange={(e) => updateFilter('q', e.target.value)}
            aria-label={isEs ? 'Buscar productos' : 'Search products'}
          />
        </div>
        {hasFilters && (
          <button type="button" onClick={clearAll} className="shop-filters-meta-clear">
            {isEs ? 'Limpiar filtros' : 'Clear filters'}
          </button>
        )}
      </div>

      <style>{`
        .shop-search-spot-row {
          display: grid;
          grid-template-columns: minmax(8.75rem, 0.45fr) minmax(16rem, 24rem) minmax(8.75rem, 0.45fr);
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          margin: 0 auto 0.85rem;
          max-width: 48rem;
        }
        .shop-filter-panel {
          display: none;
        }
        .shop-filter-panel.is-open {
          display: block;
        }
        /* Results meta. Mobile/tablet: the field is a full-width search bar
           (the piece count moves to the results toolbar). Desktop: restores the
           count pill in the sidebar. */
        .shop-filters-meta {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: center;
          gap: 0.6rem 1rem;
          font-size: 0.8125rem;
          color: var(--color-on-surface-variant);
          font-family: var(--font-label);
        }
        .shop-filters-meta-count {
          display: none;
        }
        .shop-filters-meta-search {
          flex: 1 1 100%;
          min-width: 0;
        }
        .shop-filters-meta-search input[type='search'] {
          width: 100%;
          padding: 0.6rem 1rem;
          border: 1px solid rgba(115, 92, 0, 0.5);
          border-radius: 999px;
          background: var(--color-background);
          color: var(--color-on-surface);
          font-family: var(--font-label);
          font-size: 0.9rem;
        }
        .shop-filters-meta-clear {
          font-size: 0.6875rem;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          text-decoration: underline;
          text-underline-offset: 3px;
          color: ${GOLD};
          background: none;
          border: none;
          cursor: pointer;
          padding: 0;
          font-family: var(--font-label);
        }
        @media (min-width: 1024px) {
          .shop-filters-meta {
            gap: 0.75rem 1.25rem;
            border: 1px solid rgba(115, 92, 0, 0.12);
            border-radius: var(--radius-xl);
            background: rgba(255, 255, 255, 0.72);
            padding: 0.55rem 0.85rem;
          }
          .shop-filters-meta-count {
            display: inline;
          }
          .shop-filters-meta-search {
            display: none;
          }
        }
        .shop-clear-filters-top {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 0.75rem;
        }
        .shop-clear-filters-top button {
          min-height: 2.15rem;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.35rem;
          border: 1px solid rgba(115, 92, 0, 0.18);
          border-radius: 7px;
          background: #ffffff;
          box-shadow: 0 8px 18px rgba(42, 34, 12, 0.05);
          color: ${GOLD};
          cursor: pointer;
          font-family: var(--font-label);
          font-size: 0.64rem;
          font-weight: 800;
          letter-spacing: 0.12em;
          line-height: 1;
          padding: 0.35rem 0.7rem;
          text-transform: uppercase;
        }
        .shop-clear-filters-top .material-symbols-outlined {
          font-size: 1rem;
          line-height: 1;
        }
        .shop-apply-filters-row {
          display: flex;
          justify-content: center;
          margin: 1rem auto 0.15rem;
          max-width: 32rem;
        }
        .shop-apply-filters-button {
          min-height: 3.2rem;
          width: 100%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.55rem;
          border: 1px solid rgba(145, 105, 0, 0.18);
          border-radius: 8px;
          background: linear-gradient(135deg, #dcb336, #b5890c);
          color: #fffdf7;
          cursor: pointer;
          font-family: var(--font-label);
          font-size: 0.78rem;
          font-weight: 900;
          letter-spacing: 0.1em;
          line-height: 1.15;
          padding: 0.75rem 1rem;
          text-align: center;
          text-transform: uppercase;
          box-shadow: 0 14px 30px rgba(181, 137, 12, 0.22);
          transition: transform 160ms ease, box-shadow 160ms ease, filter 160ms ease;
        }
        .shop-apply-filters-button:hover {
          filter: brightness(1.04);
          box-shadow: 0 16px 34px rgba(181, 137, 12, 0.28);
          transform: translateY(-1px);
        }
        .shop-apply-filters-button .material-symbols-outlined {
          font-size: 1.15rem;
          line-height: 1;
        }
        .shop-price-filter {
          max-width: 38rem;
          margin: 0 auto 0.95rem;
          padding: 0.8rem 0.9rem 0.9rem;
          border: 1px solid rgba(115, 92, 0, 0.18);
          border-radius: 7px;
          background: rgba(255, 255, 255, 0.76);
          box-shadow: 0 10px 24px rgba(42, 34, 12, 0.05);
        }
        .shop-price-filter-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 0.75rem;
          margin-bottom: 0.85rem;
        }
        .shop-price-filter-header strong {
          display: block;
          color: var(--color-on-surface);
          font-family: var(--font-label);
          font-size: 0.9rem;
          font-weight: 900;
          line-height: 1.1;
        }
        .shop-price-filter-header button {
          border: 0;
          background: none;
          color: ${GOLD};
          cursor: pointer;
          font-family: var(--font-label);
          font-size: 0.62rem;
          font-weight: 800;
          letter-spacing: 0.12em;
          line-height: 1.4;
          padding: 0.05rem 0;
          text-decoration: underline;
          text-transform: uppercase;
          text-underline-offset: 3px;
        }
        .shop-price-slider {
          position: relative;
          height: 1.7rem;
          margin: 0.15rem 0 0.75rem;
        }
        .shop-price-slider::before,
        .shop-price-slider::after {
          content: '';
          position: absolute;
          left: 0;
          right: 0;
          top: 50%;
          height: 0.28rem;
          border-radius: 999px;
          transform: translateY(-50%);
        }
        .shop-price-slider::before {
          background: rgba(115, 92, 0, 0.16);
        }
        .shop-price-slider::after {
          left: var(--price-left);
          right: var(--price-right);
          background: linear-gradient(90deg, #d8ad2d, #9c7608);
        }
        .shop-price-slider input[type='range'] {
          position: absolute;
          inset: 0;
          z-index: 2;
          width: 100%;
          height: 1.7rem;
          margin: 0;
          appearance: none;
          background: transparent;
          pointer-events: none;
        }
        .shop-price-slider input[type='range']::-webkit-slider-runnable-track {
          height: 0.28rem;
          background: transparent;
        }
        .shop-price-slider input[type='range']::-webkit-slider-thumb {
          width: 1rem;
          height: 1rem;
          margin-top: -0.36rem;
          appearance: none;
          border: 2px solid #fffdf7;
          border-radius: 999px;
          background: ${GOLD};
          box-shadow: 0 3px 10px rgba(42, 34, 12, 0.24);
          cursor: grab;
          pointer-events: auto;
        }
        .shop-price-slider input[type='range']::-moz-range-track {
          height: 0.28rem;
          background: transparent;
        }
        .shop-price-slider input[type='range']::-moz-range-thumb {
          width: 1rem;
          height: 1rem;
          border: 2px solid #fffdf7;
          border-radius: 999px;
          background: ${GOLD};
          box-shadow: 0 3px 10px rgba(42, 34, 12, 0.24);
          cursor: grab;
          pointer-events: auto;
        }
        .shop-price-slider input[type='range']:focus-visible::-webkit-slider-thumb {
          outline: 2px solid rgba(115, 92, 0, 0.34);
          outline-offset: 3px;
        }
        .shop-price-input-row {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.6rem;
        }
        .shop-price-input-row label {
          display: grid;
          gap: 0.25rem;
          color: var(--color-on-surface-variant);
          font-family: var(--font-label);
          font-size: 0.58rem;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }
        .shop-price-input-row input {
          min-height: 2.25rem;
          width: 100%;
          border: 1px solid rgba(115, 92, 0, 0.22);
          border-radius: 5px;
          background: #ffffff;
          color: var(--color-on-surface);
          font-family: var(--font-label);
          font-size: 0.82rem;
          font-weight: 800;
          padding: 0.3rem 0.55rem;
        }
        @media (min-width: 1024px) {
          .shop-filters {
            border: 1px solid rgba(115, 92, 0, 0.22);
            background: color-mix(in srgb, var(--color-primary) 3%, var(--color-background));
            padding: 0.85rem;
            margin-bottom: 0 !important;
          }
          .shop-filter-toggle-row {
            display: none !important;
          }
          .shop-filter-panel {
            display: block;
          }
          .shop-search-spot-row {
            grid-template-columns: 1fr;
            max-width: none;
            gap: 0.5rem;
            margin-bottom: 0.9rem;
          }
          .shop-search-spot-row > div {
            width: 100% !important;
            max-width: none !important;
          }
          .shop-search-spot-row > div:nth-child(2) {
            grid-row: 1;
          }
          .shop-filter-grid {
            grid-template-columns: 1fr !important;
            max-width: none !important;
            margin-bottom: 0.9rem !important;
          }
          .shop-length-multi {
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .shop-length-button {
            width: 100%;
            min-width: 0 !important;
          }
          .shop-available-row {
            justify-content: flex-start !important;
          }
          .shop-apply-filters-row {
            display: none;
          }
        }
        .shop-filters-modern {
          border: none !important;
          background: transparent !important;
          padding: 0 !important;
        }
        .shop-filters-modern .shop-search-spot-row {
          gap: 0.55rem;
        }
        .shop-filters-modern .shop-search-spot-row > div {
          border-radius: 7px !important;
          box-shadow: 0 10px 24px rgba(42, 34, 12, 0.06);
        }
        /* Stacked sidebar order, top to bottom: gold, silver, search.
           DOM order is silver(1), search(2), gold(3); rows reorder them. */
        .shop-filters-modern .shop-search-spot-row > div:nth-child(1) {
          grid-row: 2;
        }
        .shop-filters-modern .shop-search-spot-row > div:nth-child(2) {
          grid-row: 3;
        }
        .shop-filters-modern .shop-search-spot-row > div:nth-child(3) {
          grid-row: 1;
        }
        .shop-filters-modern input[type="search"] {
          min-height: 2.75rem;
          border-color: rgba(115, 92, 0, 0.16) !important;
          border-radius: 7px !important;
          background: #ffffff !important;
          box-shadow: 0 10px 24px rgba(42, 34, 12, 0.05);
        }
        .modern-sidebar-gender {
          margin: 0.9rem 0;
        }
        .modern-sidebar-label {
          display: block;
          margin-bottom: 0.45rem;
          color: var(--color-on-surface-variant);
          font-family: var(--font-label);
          font-size: 0.62rem;
          font-weight: 800;
          letter-spacing: 0.14em;
          line-height: 1;
          text-transform: uppercase;
        }
        .modern-sidebar-gender-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.55rem;
        }
        .modern-sidebar-gender-button {
          min-height: 2.7rem;
          border: 1px solid rgba(115, 92, 0, 0.16);
          border-radius: var(--radius-lg);
          background: #ffffff;
          color: var(--color-on-surface-variant);
          cursor: pointer;
          font-family: var(--font-label);
          font-size: 0.68rem;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          box-shadow: 0 8px 18px rgba(42, 34, 12, 0.05);
          transition: background 160ms ease, color 160ms ease, box-shadow 160ms ease, transform 160ms ease;
        }
        .modern-sidebar-gender-button[data-active="true"] {
          background: linear-gradient(135deg, #dbb236, #b88a0b);
          border-color: transparent;
          color: #fffdf7;
          box-shadow: 0 12px 22px rgba(181, 137, 12, 0.18);
        }
        .modern-sidebar-gender-button:hover {
          transform: translateY(-1px);
        }
        .shop-filters-modern .shop-filter-grid {
          gap: 0.72rem !important;
        }
        .shop-filters-modern select {
          min-height: 2.65rem;
          border-color: rgba(115, 92, 0, 0.18) !important;
          border-radius: 7px !important;
          background-color: #ffffff !important;
          box-shadow: 0 8px 18px rgba(42, 34, 12, 0.04);
        }
        .shop-filters-modern .shop-available-row {
          padding-top: 0.1rem;
        }
        .shop-filters-modern > div:last-of-type {
          justify-content: space-between !important;
          border-top: 1px solid rgba(115, 92, 0, 0.12);
          margin-top: 0.9rem;
          padding-top: 0.8rem;
        }
        @media (max-width: 900px) {
          .shop-filter-grid { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
        }
        @media (max-width: 600px) {
          .shop-search-spot-row {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            max-width: 24rem;
          }
          .shop-search-spot-row > div:nth-child(2) {
            grid-column: 1 / -1;
            grid-row: 1;
          }
          .shop-filter-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
          .shop-length-button { flex: 1 1 calc(33.333% - 0.4rem); min-width: 0 !important; }
          .shop-price-filter {
            padding: 0.7rem;
          }
        }
        @media (max-width: 400px) {
          .shop-filter-grid { grid-template-columns: 1fr !important; }
          .shop-length-button { flex-basis: calc(50% - 0.4rem); }
        }
        @media (max-width: 767px) {
          /* Spot prices moved above the era slider; show only search bar here */
          .shop-filters-modern .shop-search-spot-row > div:nth-child(1),
          .shop-filters-modern .shop-search-spot-row > div:nth-child(3) {
            display: none;
          }
          .shop-filters-modern .shop-search-spot-row {
            grid-template-columns: 1fr;
            max-width: none;
          }
          .shop-filters-modern .shop-search-spot-row > div:nth-child(2) {
            grid-row: 1;
            grid-column: 1;
          }
        }
        @media (min-width: 768px) and (max-width: 1023px) {
          /* Tablet: spot prices moved above the era slider; show only search bar here */
          .shop-filters-modern .shop-search-spot-row > div:nth-child(1),
          .shop-filters-modern .shop-search-spot-row > div:nth-child(3) {
            display: none;
          }
          .shop-filters-modern .shop-search-spot-row {
            grid-template-columns: 1fr;
            max-width: none;
          }
          .shop-filters-modern .shop-search-spot-row > div:nth-child(2) {
            grid-row: 1;
            grid-column: 1;
            max-width: none !important;
          }
        }
        /* ERA/Year slider embedded in the filter panel (mobile/tablet only) */
        .shop-year-filter-in-panel {
          margin-bottom: 0.85rem;
        }
        .shop-year-filter-in-panel .shop-year-toggle {
          display: none !important;
        }
        .shop-year-filter-in-panel .shop-year-body {
          display: block !important;
        }
        @media (min-width: 1024px) {
          .shop-year-filter-in-panel {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}
