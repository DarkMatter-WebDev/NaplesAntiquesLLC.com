'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import type { CSSProperties } from 'react';
import { useShopNavigation } from '@/components/shop/ShopNavigationProgress';

const SORT_OPTIONS = [
  { value: '', label: 'Inventory order', labelEs: 'Inventario' },
  { value: 'price-asc', label: 'Price: low to high', labelEs: 'Precio: menor a mayor' },
  { value: 'price-desc', label: 'Price: high to low', labelEs: 'Precio: mayor a menor' },
  { value: 'weight-asc', label: 'Weight: low to high', labelEs: 'Peso: menor a mayor' },
  { value: 'weight-desc', label: 'Weight: high to low', labelEs: 'Peso: mayor a menor' },
  { value: 'brand-asc', label: 'Brand: A to Z', labelEs: 'Marca: A a Z' },
  { value: 'brand-desc', label: 'Brand: Z to A', labelEs: 'Marca: Z a A' },
] as const;

interface Props {
  locale: string;
  currentSort?: string;
  appearance?: 'filter' | 'gallery';
  labelStyle?: CSSProperties;
  selectStyle?: CSSProperties;
}

export default function ShopSortSelect({
  locale,
  currentSort,
  appearance = 'gallery',
  labelStyle,
  selectStyle,
}: Props) {
  const { getSearchParams, push } = useShopNavigation();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isEs = locale === 'es';

  function updateSort(value: string) {
    const params = getSearchParams(searchParams.toString());
    if (value) {
      params.set('sort', value);
    } else {
      params.delete('sort');
    }
    params.delete('page');
    const qs = params.toString();
    push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  if (appearance === 'filter') {
    return (
      <div>
        <label style={labelStyle}>{isEs ? 'Ordenar' : 'Sort'}</label>
        <select
          value={currentSort ?? ''}
          onChange={(event) => updateSort(event.target.value)}
          style={selectStyle}
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value || 'inventory'} value={option.value}>
              {isEs ? option.labelEs : option.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <label className="shop-gallery-sort">
      <span>{isEs ? 'Ordenar' : 'Sort'}</span>
      <select value={currentSort ?? ''} onChange={(event) => updateSort(event.target.value)}>
        {SORT_OPTIONS.map((option) => (
          <option key={option.value || 'inventory'} value={option.value}>
            {isEs ? option.labelEs : option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
