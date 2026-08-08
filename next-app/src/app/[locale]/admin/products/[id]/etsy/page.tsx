import type { Metadata } from 'next';
import { renderAdminProductMarketplacePage } from '../marketplace-page';

export const metadata: Metadata = { title: 'Admin - Manage Etsy' };

interface Props {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}

export default async function AdminProductEtsyPage({ params, searchParams }: Props) {
  const { locale, id } = await params;
  const { returnTo } = await searchParams;
  return renderAdminProductMarketplacePage({
    locale,
    productId: decodeURIComponent(id),
    marketplace: 'etsy',
    returnTo,
  });
}
