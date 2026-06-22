'use client';

import { useEffect, useState } from 'react';
import ProductCard from '@/components/shop/ProductCard';
import type { Product, SpotData } from '@/types/product';

interface Props {
  products: Product[];
  spotData: SpotData | null;
  locale: string;
  variant?: 'classic' | 'modern';
}

function getShopGridColumnCount() {
  if (typeof window === 'undefined') return 3;

  const width = window.innerWidth;
  if (width >= 2320) return 7;
  if (width >= 1960) return 6;
  if (width >= 1720) return 5;
  if (width >= 1280) return 4;
  if (width >= 768) return 3;
  if (width >= 360) return 2;
  return 1;
}

export default function ShopProductGrid({ products, spotData, locale, variant = 'classic' }: Props) {
  const [columnCount, setColumnCount] = useState(3);

  useEffect(() => {
    const updateColumnCount = () => {
      setColumnCount(getShopGridColumnCount());
    };

    updateColumnCount();
    window.addEventListener('resize', updateColumnCount);
    return () => window.removeEventListener('resize', updateColumnCount);
  }, []);

  return (
    <div className="shop-product-grid grid gap-2 sm:gap-5">
      {products.map((product, index) => (
        <ProductCard
          key={product.id}
          product={product}
          spotData={spotData}
          locale={locale}
          variant={variant}
          revealIndex={index}
          revealColumnCount={columnCount}
          prioritizeImage={index < columnCount}
          includeModernStyles={index === 0}
        />
      ))}
    </div>
  );
}
