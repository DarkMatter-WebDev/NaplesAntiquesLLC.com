import {
  generateShopMetadata,
  renderShopPage,
  type ShopPageProps,
} from './shop-page-renderer';

export const revalidate = 300;

export const generateMetadata = generateShopMetadata;

export default async function ShopPage({ params, searchParams }: ShopPageProps) {
  return renderShopPage({ params, searchParams, variant: 'modern' });
}
