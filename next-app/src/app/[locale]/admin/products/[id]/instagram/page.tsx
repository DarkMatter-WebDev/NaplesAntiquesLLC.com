import type { Metadata } from 'next';
import { renderAdminProductMarketplacePage } from '../marketplace-page';

export const metadata: Metadata = { title: 'Admin - Manage Instagram' };

interface Props {
  params: Promise<{ locale: string; id: string }>;
}

export default async function AdminProductInstagramPage({ params }: Props) {
  const { locale, id } = await params;
  return renderAdminProductMarketplacePage({
    locale,
    productId: decodeURIComponent(id),
    marketplace: 'instagram',
  });
}
