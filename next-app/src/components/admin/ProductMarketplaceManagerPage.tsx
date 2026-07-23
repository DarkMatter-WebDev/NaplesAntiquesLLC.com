'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  normalizeProductQuantity,
  productImagePaddingBackground,
  productImagePaddingForImage,
  productStatusLabel,
  type Product,
  type ProductImagePaddingMap,
} from '@/types/product';
import EtsyProductPanel from './EtsyProductPanel';
import EbayProductPanel from './EbayProductPanel';

export type ProductMarketplaceName = 'etsy' | 'ebay';

export interface ProductMarketplaceSummary {
  id: string;
  title: string;
  inventory_number: number | null;
  status: Product['status'];
  quantity: number | null;
  images: string[];
  image_urls: string[];
  image_padding: string | null;
  image_padding_by_image: ProductImagePaddingMap | null;
}

function getImages(product: ProductMarketplaceSummary): string[] {
  return product.image_urls?.length ? product.image_urls : product.images ?? [];
}

function formatInventoryNumber(value: string | number | null | undefined): string {
  if (value == null || value === '') return '-';
  const numeric = Number(String(value).replace(/\D/g, ''));
  return Number.isInteger(numeric) && numeric > 0 ? String(numeric) : '-';
}

export default function ProductMarketplaceManagerPage({
  product,
  marketplace,
  locale,
}: {
  product: ProductMarketplaceSummary;
  marketplace: ProductMarketplaceName;
  locale: string;
}) {
  const adminBasePath = locale === 'es' ? '/es/admin' : '/admin';
  const images = getImages(product);
  const coverImage = images[0] ?? null;
  const coverPadding = productImagePaddingForImage(product.image_padding, product.image_padding_by_image, coverImage, 0);
  const productPath = `${adminBasePath}/products/${encodeURIComponent(product.id)}`;
  const activeTitle = marketplace === 'etsy' ? 'Manage Etsy' : 'Manage eBay';

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-3 py-4 md:px-6 md:py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={adminBasePath} className="outline-button text-xs">
          Back to Products
        </Link>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`${productPath}/etsy`}
            className={marketplace === 'etsy' ? 'gold-button text-xs' : 'outline-button text-xs'}
            aria-current={marketplace === 'etsy' ? 'page' : undefined}
          >
            Manage Etsy
          </Link>
          <Link
            href={`${productPath}/ebay`}
            className={marketplace === 'ebay' ? 'gold-button text-xs' : 'outline-button text-xs'}
            aria-current={marketplace === 'ebay' ? 'page' : undefined}
          >
            Manage eBay
          </Link>
        </div>
      </div>

      <section
        className="grid gap-4 border p-4 md:grid-cols-[180px_1fr] md:p-5"
        style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}
      >
        <div
          className="relative aspect-square w-full max-w-[180px] overflow-hidden border max-md:max-w-[140px]"
          style={{
            borderColor: 'var(--color-outline-variant)',
            background: coverImage ? productImagePaddingBackground(coverPadding) : 'var(--color-surface-container)',
          }}
        >
          {coverImage ? (
            <Image
              src={coverImage}
              alt={product.title}
              fill
              sizes="(max-width: 768px) 140px, 180px"
              className="object-contain object-center"
              unoptimized={coverImage.startsWith('/assets/')}
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}>
              No photo
            </span>
          )}
        </div>
        <div className="min-w-0">
          <p className="text-[0.65rem] font-bold uppercase tracking-widest" style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}>
            Item {formatInventoryNumber(product.inventory_number)}
          </p>
          <h1 className="mt-1 text-2xl font-bold md:text-3xl" style={{ color: 'var(--color-on-surface)', fontFamily: 'var(--font-headline)' }}>
            {activeTitle}
          </h1>
          <p className="mt-1 text-base font-semibold" style={{ color: 'var(--color-on-surface)' }}>
            {product.title}
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
            <span className="border px-2 py-1" style={{ borderColor: 'var(--color-outline-variant)' }}>
              {productStatusLabel(product.status)}
            </span>
            <span className="border px-2 py-1" style={{ borderColor: 'var(--color-outline-variant)' }}>
              Qty {normalizeProductQuantity(product.quantity)}
            </span>
          </div>
        </div>
      </section>

      <section
        className="border p-4 md:p-5"
        style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-background)' }}
      >
        {marketplace === 'etsy' ? (
          <EtsyProductPanel productId={product.id} />
        ) : (
          <EbayProductPanel productId={product.id} />
        )}
      </section>
    </main>
  );
}
