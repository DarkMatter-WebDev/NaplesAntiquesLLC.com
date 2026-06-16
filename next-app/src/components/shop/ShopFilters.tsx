'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useState } from 'react';
import { PRODUCT_METAL_VARIANTS, type SpotData } from '@/types/product';

const GOLD = '#735c00';
const BORDER = 'rgba(115, 92, 0, 0.35)';

type LengthOption = {
  value: string;
  label: string;
  labelEs?: string;
  labelEn?: string;
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
  };
  brandOptions: string[];
  filteredCount: number;
  allCount: number;
  spotData: SpotData | null;
}

export default function ShopFilters({ locale, currentFilters, brandOptions, filteredCount, allCount, spotData }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isEs = locale === 'es';
  const selectedMetalColor = currentFilters.metalColor ?? currentFilters.metalType;
  const metalColorOptions = getMetalColorOptions(currentFilters.metal);
  const visibleMetalColor = metalColorOptions.some((variant) => variant.value === selectedMetalColor)
    ? selectedMetalColor
    : undefined;
  const selectedLengths = normalizeLengths(currentFilters.length);
  const lengthOptions = getLengthOptionsForItemType(currentFilters.itemType);
  const visibleLengthValues = lengthOptions.map((option) => option.value);
  const visibleSelectedLengths = selectedLengths.filter((value) => visibleLengthValues.includes(value));
  const showLengthFilter = lengthOptions.length > 0;
  const showLinkTypeFilter = itemTypeSupportsLinkType(currentFilters.itemType);
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
    currentFilters.sort
  );
  const [filtersOpen, setFiltersOpen] = useState(hasDrawerFilters);

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
      params.delete('length');
      params.delete('page');
      if (!itemTypeSupportsLinkType(value)) params.delete('chainType');
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
      params.delete('page');

      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
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
    currentFilters.sort
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
    currentFilters.sort,
  ].filter(Boolean).length;

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

  const priceBadgeStyle = {
    minWidth: '8.75rem',
    border: `1px solid ${BORDER}`,
    background: 'color-mix(in srgb, var(--color-primary) 5%, var(--color-background))',
    padding: '0.42rem 0.7rem',
    textAlign: 'center' as const,
    fontFamily: 'var(--font-label)',
  };

  const spotLabelStyle = {
    display: 'block',
    color: 'var(--color-on-surface-variant)',
    fontSize: '0.52rem',
    fontWeight: 700,
    letterSpacing: '0.14em',
    lineHeight: 1,
    marginBottom: '0.22rem',
    textTransform: 'uppercase' as const,
  };

  const spotPriceStyle = {
    display: 'block',
    color: GOLD,
    fontSize: '0.86rem',
    fontWeight: 800,
    lineHeight: 1.05,
  };

  return (
    <div className="shop-filters" style={{ marginBottom: '1.5rem' }}>

      {/* Search + live metal prices */}
      <div className="shop-search-spot-row">
        <div
          style={priceBadgeStyle}
          aria-label={isEs ? 'Precio de plata en vivo por onza troy' : 'Live silver price per troy ounce'}
        >
          <span style={spotLabelStyle}>{isEs ? 'Plata / oz' : 'Silver / oz'}</span>
          <span style={spotPriceStyle}>{formatSpot(spotData?.silverPerTroyOz)}</span>
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
          style={priceBadgeStyle}
          aria-label={isEs ? 'Precio de oro en vivo por onza troy' : 'Live gold price per troy ounce'}
        >
          <span style={spotLabelStyle}>{isEs ? 'Oro / oz' : 'Gold / oz'}</span>
          <span style={spotPriceStyle}>{formatSpot(spotData?.goldPerTroyOz)}</span>
        </div>
      </div>

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
            {/* Metal */}
            <div>
              <label style={labelStyle}>{isEs ? 'Metal' : 'Metal'}</label>
              <select
                value={currentFilters.metal ?? ''}
                onChange={(e) => updateMetalFilter(e.target.value)}
                style={selectStyle}
              >
                <option value="">{isEs ? 'Todos los metales' : 'All metals'}</option>
                <option value="gold">{isEs ? 'Oro' : 'Gold'}</option>
                <option value="silver">{isEs ? 'Plata' : 'Silver'}</option>
              </select>
            </div>

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
                value={currentFilters.purity ?? ''}
                onChange={(e) => updateFilter('purity', e.target.value)}
                style={selectStyle}
              >
                <option value="">{isEs ? 'Todas' : 'All purities'}</option>
                <option value="18">18K</option>
                <option value="14">14K</option>
                <option value="10">10K</option>
                <option value="925">925 {isEs ? 'Esterlina' : 'Sterling'}</option>
              </select>
            </div>

            {/* Item Type */}
            <div>
              <label style={labelStyle}>{isEs ? 'Artículo' : 'Item Type'}</label>
              <select
                value={currentFilters.itemType ?? ''}
                onChange={(e) => updateItemTypeFilter(e.target.value)}
                style={selectStyle}
              >
                <option value="">{isEs ? 'Todos' : 'All items'}</option>
                <option value="necklace">{isEs ? 'Collares' : 'Necklaces'}</option>
                <option value="bracelet">{isEs ? 'Pulseras' : 'Bracelets'}</option>
                <option value="earrings">{isEs ? 'Aretes' : 'Earrings'}</option>
                <option value="ring">{isEs ? 'Anillos' : 'Rings'}</option>
                <option value="pendant">{isEs ? 'Dijes' : 'Pendants'}</option>
                <option value="brooch">{isEs ? 'Broches' : 'Brooches'}</option>
                <option value="watch">{isEs ? 'Relojes' : 'Watches'}</option>
                <option value="coin">{isEs ? 'Monedas' : 'Coins'}</option>
                <option value="bullion">{isEs ? 'Lingotes' : 'Bullion'}</option>
                <option value="loose-diamond">{isEs ? 'Diamantes sueltos' : 'Loose Diamonds'}</option>
                <option value="loose-gemstone">{isEs ? 'Gemas sueltas' : 'Loose Gemstones'}</option>
                <option value="silverware">{isEs ? 'Plateria' : 'Silverware'}</option>
                <option value="estate-lot">{isEs ? 'Lotes de sucesion' : 'Estate Lots'}</option>
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

            {/* Gender */}
            <div>
              <label style={labelStyle}>{isEs ? 'Para' : 'For'}</label>
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
        }
        @media (max-width: 400px) {
          .shop-filter-grid { grid-template-columns: 1fr !important; }
          .shop-length-button { flex-basis: calc(50% - 0.4rem); }
        }
      `}</style>
    </div>
  );
}
