import type { Metadata } from 'next';
import { renderShopPage } from '@/app/[locale]/shop/(list)/shop-page-renderer';

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
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
    itemGroup?: string;
  }>;
}

export const metadata: Metadata = {
  title: 'Shop Modern Preview',
  description: 'Preview a modernized Naples Estate Jewelry shop layout with live product data.',
  // Internal preview route — never index it as a duplicate of /shop.
  robots: { index: false, follow: false },
};

export default async function ShopModernPage({ params, searchParams }: Props) {
  return renderShopPage({ params, searchParams, variant: 'modern' });
}
