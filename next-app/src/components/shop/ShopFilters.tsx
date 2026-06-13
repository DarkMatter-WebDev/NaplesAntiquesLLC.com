'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

const GOLD = '#735c00';
const BORDER = 'rgba(115, 92, 0, 0.35)';

interface Props {
  locale: string;
  currentFilters: {
    metal?: string;
    purity?: string;
    status?: string;
    chainType?: string;
    length?: string;
    gender?: string;
    q?: string;
  };
  filteredCount: number;
  allCount: number;
}

export default function ShopFilters({ locale, currentFilters, filteredCount, allCount }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isEs = locale === 'es';

  const updateFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  function clearAll() {
    router.push(pathname, { scroll: false });
  }

  const hasFilters = !!(
    currentFilters.metal ||
    currentFilters.purity ||
    currentFilters.status ||
    currentFilters.chainType ||
    currentFilters.length ||
    currentFilters.gender ||
    currentFilters.q
  );

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

  return (
    <div style={{ marginBottom: '1.5rem' }}>

      {/* Search */}
      <div style={{ maxWidth: '24rem', margin: '0 auto 0.85rem' }}>
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

      {/* 5-column labeled dropdowns */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
          gap: '0.6rem',
          maxWidth: '48rem',
          margin: '0 auto 0.85rem',
        }}
        className="shop-filter-grid"
      >
        {/* Metal */}
        <div>
          <label style={labelStyle}>{isEs ? 'Metal' : 'Metal'}</label>
          <select
            value={currentFilters.metal ?? ''}
            onChange={(e) => updateFilter('metal', e.target.value)}
            style={selectStyle}
          >
            <option value="">{isEs ? 'Todos los metales' : 'All metals'}</option>
            <option value="gold">{isEs ? 'Oro' : 'Gold'}</option>
            <option value="silver">{isEs ? 'Plata' : 'Silver'}</option>
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

        {/* Chain Type */}
        <div>
          <label style={labelStyle}>{isEs ? 'Tipo' : 'Chain Type'}</label>
          <select
            value={currentFilters.chainType ?? ''}
            onChange={(e) => updateFilter('chainType', e.target.value)}
            style={selectStyle}
          >
            <option value="">{isEs ? 'Todos los tipos' : 'All types'}</option>
            <option value="cuban-link">{isEs ? 'Cubana' : 'Cuban link'}</option>
            <option value="figaro-link">{isEs ? 'Figaro' : 'Figaro link'}</option>
            <option value="rope-chain">{isEs ? 'Cuerda' : 'Rope chain'}</option>
            <option value="anchor-link">{isEs ? 'Ancla / Gucci' : 'Anchor / Gucci'}</option>
            <option value="oval-link">{isEs ? 'Ovalada' : 'Oval link'}</option>
            <option value="byzantine-link">{isEs ? 'Bizantina' : 'Byzantine'}</option>
            <option value="bracelet">{isEs ? 'Pulsera' : 'Bracelet'}</option>
            <option value="ring">{isEs ? 'Anillo' : 'Ring'}</option>
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

        {/* Length */}
        <div>
          <label style={labelStyle}>{isEs ? 'Longitud' : 'Length'}</label>
          <select
            value={currentFilters.length ?? ''}
            onChange={(e) => updateFilter('length', e.target.value)}
            style={selectStyle}
          >
            <option value="">{isEs ? 'Todas' : 'All lengths'}</option>
            <option value="16 in">16 in</option>
            <option value="18 in">18 in</option>
            <option value="20 in">20 in</option>
            <option value="22 in">22 in</option>
            <option value="24 in">24 in</option>
            <option value="26 in">26 in</option>
            <option value="28 in">28 in</option>
            <option value="30 in">30 in</option>
            <option value="7 in">7 in {isEs ? '(pulsera)' : '(bracelet)'}</option>
            <option value="7.5 in">7.5 in {isEs ? '(pulsera)' : '(bracelet)'}</option>
            <option value="8 in">8 in {isEs ? '(pulsera)' : '(bracelet)'}</option>
          </select>
        </div>
      </div>

      {/* Available only toggle */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer', fontSize: '0.8125rem', fontFamily: 'var(--font-label)', color: 'var(--color-on-surface-variant)' }}>
          <input
            type="checkbox"
            checked={currentFilters.status === 'Available'}
            onChange={(e) => updateFilter('status', e.target.checked ? 'Available' : '')}
            style={{ accentColor: '#735c00', width: '0.9rem', height: '0.9rem' }}
          />
          {isEs ? 'Solo disponibles' : 'Available only'}
        </label>
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
        @media (max-width: 900px) {
          .shop-filter-grid { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
        }
        @media (max-width: 600px) {
          .shop-filter-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
        }
        @media (max-width: 400px) {
          .shop-filter-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
