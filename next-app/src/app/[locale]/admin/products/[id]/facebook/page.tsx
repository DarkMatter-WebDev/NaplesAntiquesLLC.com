import type { Metadata } from 'next';
import { renderAdminProductMarketplacePage } from '../marketplace-page';

export const metadata: Metadata = { title: 'Admin - Manage Facebook' };

interface Props {
  params: Promise<{ locale: string; id: string }>;
}

export default async function AdminProductFacebookPage({ params }: Props) {
  const { locale, id } = await params;
  return renderAdminProductMarketplacePage({
    locale,
    productId: decodeURIComponent(id),
    marketplace: 'facebook',
  });
}
