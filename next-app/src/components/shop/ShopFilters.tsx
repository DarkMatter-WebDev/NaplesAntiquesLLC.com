'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useState } from 'react';
import type { CSSProperties } from 'react';
import { PRODUCT_METAL_VARIANTS, type SpotData } from '@/types/product';

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
  { value: 'silverware', label: 'Silverware / Sterling', labelEs: 'Plateria / sterling' },
];

type ItemTypeOption = (typeof ITEM_TYPE_OPTIONS)[number];

const EVERYTHING_ELSE_ITEM_TYPES = ['watch', 'coin', 'silverware'];

function getItemGroupForItemType(itemType: string | undefined) {
  if (itemType === 'all') return undefined;
  if (itemType && EVERYTHING_ELSE_ITEM_TYPES.includes(itemType)) return 'everything-else';
  return itemType ? 'jewelry' : undefined;
}

export default function ShopFilters({ locale, currentFilters, brandOptions, filteredCount, allCount, spotData, priceRange, itemTypeOptions, variant = 'classic' }: Props) {
  const router = useRouter();
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
  const hasDrawerFilters = !!(
    currentFilters.metal ||
    visibleMetalColor ||
    currentFilters.purity ||
    currentFilters.status ||
    currentFilters.itemType ||
    (showLinkTypeFilter && currentFilters.chainType) ||
    visibleSelectedLengths.length > 0 ||
    currentFilters.gender ||
    currentFilters.brand ||
    priceFilterActive ||
    currentFilters.sort ||
    currentFilters.itemGroup
  );
  const [filtersOpen, setFiltersOpen] = useState(hasDrawerFilters);
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
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams]
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
      }
      if (value === 'silverware') {
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
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
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
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const updateItemGroupFilter = useCallback(
    (value: 'jewelry' | 'everything-else') => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('itemGroup', value);
      params.delete('itemType');
      params.delete('chainType');
      params.delete('length');
      params.delete('page');
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
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
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
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [currentFilters.itemType, pathname, router, searchParams]
  );

  function clearAll() {
    router.push(pathname, { scroll: false });
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
    ? allItemTypeOptions.filter((option) => option.value === 'silverware')
    : allItemTypeOptions.filter((option) => option.value !== 'silverware');
  const itemGroupOptions = [
    { value: 'jewelry' as const, label: isEs ? 'Joyeria y relojes' : 'Jewelry & Watches' },
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
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, priceCeiling, priceFloor, priceRange, router, searchParams],
  );
  const priceTrackSpan = priceRange && priceCeiling > priceFloor ? priceCeiling - priceFloor : 1;
  const priceTrackLeft = ((draftPriceMin - priceFloor) / priceTrackSpan) * 100;
  const priceTrackRight = 100 - ((draftPriceMax - priceFloor) / priceTrackSpan) * 100;

  return (
    <div className={`shop-filters${isModern ? ' shop-filters-modern' : ''}`} style={{ marginBottom: '1.5rem' }}>

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

      {isModern && (
        <div className="modern-sidebar-gender" data-filters-open={filtersOpen ? 'true' : 'false'}>
          <span className="modern-sidebar-label">{isEs ? 'Categoria' : 'Category'}</span>
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
                <label style={labelStyle}>{isEs ? 'Genero' : 'Gender'}</label>
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
                  router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
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
            <div>
              <label style={labelStyle}>{isEs ? 'Ordenar' : 'Sort'}</label>
              <select
                value={currentFilters.sort ?? ''}
                onChange={(e) => updateFilter('sort', e.target.value)}
                style={selectStyle}
              >
                <option value="">{isEs ? 'Inventario' : 'Inventory order'}</option>
                <option value="price-asc">{isEs ? 'Precio: menor a mayor' : 'Price: low to high'}</option>
                <option value="price-desc">{isEs ? 'Precio: mayor a menor' : 'Price: high to low'}</option>
                <option value="weight-asc">{isEs ? 'Peso: menor a mayor' : 'Weight: low to high'}</option>
                <option value="weight-desc">{isEs ? 'Peso: mayor a menor' : 'Weight: high to low'}</option>
                <option value="brand-asc">{isEs ? 'Marca: A a Z' : 'Brand: A to Z'}</option>
                <option value="brand-desc">{isEs ? 'Marca: Z a A' : 'Brand: Z to A'}</option>
              </select>
            </div>

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
                  aria-label={isEs ? 'Precio minimo' : 'Minimum price'}
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
                  aria-label={isEs ? 'Precio maximo' : 'Maximum price'}
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
        </div>

      {/* Meta: count + clear */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.75rem 1.25rem',
          fontSize: '0.8125rem',
          color: 'var(--color-on-surface-variant)',
          fontFamily: 'var(--font-label)',
          border: '1px solid rgba(115, 92, 0, 0.12)',
          borderRadius: 'var(--radius-xl)',
          background: 'rgba(255, 255, 255, 0.72)',
          padding: '0.55rem 0.85rem',
        }}
      >
        <span>
          {isEs
            ? `Mostrando ${filteredCount} de ${allCount} piezas`
            : `Showing ${filteredCount} of ${allCount} pieces`}
        </span>
        {hasFilters && (
          <button
            type="button"
            onClick={clearAll}
            style={{
              fontSize: '0.6875rem',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              textDecoration: 'underline',
              textUnderlineOffset: '3px',
              color: GOLD,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              fontFamily: 'var(--font-label)',
            }}
          >
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
          /* Hide the sidebar gender buttons until the Filters panel is opened */
          .shop-filters-modern .modern-sidebar-gender[data-filters-open="false"] {
            display: none;
          }
          /* Place the gold + silver spot pills side by side on mobile */
          .shop-filters-modern .shop-search-spot-row {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            max-width: 24rem;
          }
          .shop-filters-modern .shop-search-spot-row > div:nth-child(2) {
            grid-row: 1;
            grid-column: 1 / -1;
          }
          .shop-filters-modern .shop-search-spot-row > div:nth-child(1) {
            grid-row: 2;
            grid-column: 1;
          }
          .shop-filters-modern .shop-search-spot-row > div:nth-child(3) {
            grid-row: 2;
            grid-column: 2;
          }
        }
        @media (min-width: 768px) and (max-width: 1023px) {
          /* Tablet: hide the sidebar gender buttons until the Filters panel is opened */
          .shop-filters-modern .modern-sidebar-gender[data-filters-open="false"] {
            display: none;
          }
          /* Tablet: lay search + spot prices out horizontally (silver · search · gold) */
          .shop-filters-modern .shop-search-spot-row {
            grid-template-columns: minmax(9rem, 0.55fr) minmax(0, 2fr) minmax(9rem, 0.55fr);
            max-width: none;
            gap: 0.65rem;
          }
          .shop-filters-modern .shop-search-spot-row > div:nth-child(1) {
            grid-row: 1;
            grid-column: 1;
          }
          .shop-filters-modern .shop-search-spot-row > div:nth-child(2) {
            grid-row: 1;
            grid-column: 2;
            max-width: none !important;
          }
          .shop-filters-modern .shop-search-spot-row > div:nth-child(3) {
            grid-row: 1;
            grid-column: 3;
          }
        }
      `}</style>
    </div>
  );
}
