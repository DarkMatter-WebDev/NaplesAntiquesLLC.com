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
    priceMin?: string;
    priceMax?: string;
  }>;
}

export const metadata: Metadata = {
  title: 'Sterling Silver Tableware | Naples Estate Jewelry',
  description:
    'Browse sterling silver tableware, flatware, hollowware, trays, cups, and serving pieces from Naples Estate Jewelry.',
};

export default async function SilverTablewarePage({ params, searchParams }: Props) {
  return renderShopPage({
    params,
    searchParams,
    variant: 'modern',
    routeSegment: 'silver-tableware',
    collection: 'silverTableware',
  });
}
