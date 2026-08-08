import type { Metadata } from 'next';
import { renderAdminProductMarketplacePage } from '../marketplace-page';

export const metadata: Metadata = { title: 'Admin - Manage eBay' };

interface Props {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}

export default async function AdminProductEbayPage({ params, searchParams }: Props) {
  const { locale, id } = await params;
  const { returnTo } = await searchParams;
  return renderAdminProductMarketplacePage({
    locale,
    productId: decodeURIComponent(id),
    marketplace: 'ebay',
    returnTo,
  });
}
