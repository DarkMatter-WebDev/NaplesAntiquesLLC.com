import type { Metadata } from 'next';
import { renderShopPage } from '@/app/[locale]/shop/page';

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
  }>;
}

export const metadata: Metadata = {
  title: 'Shop Modern Preview',
  description: 'Preview a modernized Naples Estate Jewelry shop layout with live product data.',
};

export default async function ShopModernPage({ params, searchParams }: Props) {
  return renderShopPage({ params, searchParams, variant: 'modern', routeSegment: 'shop-modern' });
}
