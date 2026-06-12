'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

interface Props {
  locale: string;
  currentFilters: { metal?: string; purity?: string; status?: string; q?: string };
  totalCount: number;
}

export default function ShopFilters({ locale, currentFilters, totalCount }: Props) {
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

  const sel = (key: string, value: string) =>
    (currentFilters as Record<string, string | undefined>)[key] === value;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Search */}
      <input
        type="search"
        defaultValue={currentFilters.q ?? ''}
        placeholder={isEs ? 'Buscar joyería…' : 'Search jewelry…'}
        onChange={(e) => updateFilter('q', e.target.value)}
        className="form-field"
        style={{ width: 200 }}
      />

      {/* Metal */}
      <select
        value={currentFilters.metal ?? ''}
        onChange={(e) => updateFilter('metal', e.target.value)}
        className="form-field"
        style={{ width: 140 }}
      >
        <option value="">{isEs ? 'Todos los metales' : 'All Metals'}</option>
        <option value="gold">{isEs ? 'Oro' : 'Gold'}</option>
        <option value="silver">{isEs ? 'Plata' : 'Silver'}</option>
      </select>

      {/* Purity */}
      <select
        value={currentFilters.purity ?? ''}
        onChange={(e) => updateFilter('purity', e.target.value)}
        className="form-field"
        style={{ width: 140 }}
      >
        <option value="">{isEs ? 'Todas las purezas' : 'All Purities'}</option>
        <option value="18">18K</option>
        <option value="14">14K</option>
        <option value="10">10K</option>
        <option value="925">925 {isEs ? 'Esterlina' : 'Sterling'}</option>
      </select>

      {/* Status */}
      <select
        value={currentFilters.status ?? ''}
        onChange={(e) => updateFilter('status', e.target.value)}
        className="form-field"
        style={{ width: 140 }}
      >
        <option value="">{isEs ? 'Todos' : 'All Statuses'}</option>
        <option value="Available">{isEs ? 'Disponible' : 'Available'}</option>
        <option value="Sold">{isEs ? 'Vendido' : 'Sold'}</option>
      </select>

      {/* Count */}
      <span
        className="text-xs ml-auto"
        style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}
      >
        {totalCount} {isEs ? 'artículos' : 'items'}
      </span>
    </div>
  );
}
