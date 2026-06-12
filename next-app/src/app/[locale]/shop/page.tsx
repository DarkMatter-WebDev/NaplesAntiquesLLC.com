import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import type { Product } from '@/types/product';
import { fetchSpotData } from '@/lib/spot-price';
import ProductCard from '@/components/shop/ProductCard';
import ShopFilters from '@/components/shop/ShopFilters';
import SiteHeader from '@/components/layout/SiteHeader';
import SiteFooter from '@/components/layout/SiteFooter';

export const metadata: Metadata = {
  title: 'Shop',
  description: 'Browse estate gold jewelry, chains, bracelets, and rings with live pricing.',
};

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ metal?: string; purity?: string; status?: string; q?: string }>;
}

export default async function ShopPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const filters = await searchParams;

  const supabase = await createClient();
  const { data: products, error } = await supabase
    .from('products')
    .select('*')
    .order('sort_order', { ascending: true });

  const spotData = await fetchSpotData();

  const allProducts: Product[] = (products ?? []) as Product[];

  // Apply server-side filters from searchParams
  const filtered = allProducts.filter((p) => {
    if (filters.metal) {
      if (filters.metal === 'gold' && p.category !== 'Gold') return false;
      if (filters.metal === 'silver' && p.category !== 'Silver') return false;
    }
    if (filters.purity) {
      if (p.purity !== parseInt(filters.purity)) return false;
    }
    if (filters.status && p.status !== filters.status) return false;
    if (filters.q) {
      const q = filters.q.toLowerCase();
      const searchText = [p.title, p.title_es, ...(p.tags ?? []), ...(p.tags_es ?? [])].join(' ').toLowerCase();
      if (!searchText.includes(q)) return false;
    }
    return true;
  });

  const isEs = locale === 'es';

  if (error) {
    return (
      <>
        <SiteHeader />
        <main className="pt-28 md:pt-32 pb-16 px-4 md:px-8 max-w-7xl mx-auto">
          <p style={{ color: 'var(--color-error)' }}>Failed to load products. Please try again.</p>
        </main>
      </>
    );
  }

  return (
    <>
      <SiteHeader />
      <main className="pt-28 md:pt-32 pb-20">
      <div className="max-w-7xl mx-auto px-4 md:px-8">

        {/* Page header */}
        <div className="mb-8 md:mb-12">
          <span
            className="text-[0.65rem] font-bold uppercase tracking-[0.35em]"
            style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}
          >
            {isEs ? 'Colección' : 'Collection'}
          </span>
          <h1
            className="text-4xl md:text-5xl mt-3 font-bold"
            style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}
          >
            {isEs ? 'Joyería de Patrimonio' : 'Estate Jewelry'}
          </h1>
          <p
            className="mt-3 text-sm max-w-xl"
            style={{ color: 'var(--color-on-surface-variant)' }}
          >
            {isEs
              ? 'Oro fino, plata de diseñador y piezas de colección con precios en vivo.'
              : 'Fine gold, designer silver, and collectible pieces with live gold pricing.'}
          </p>
        </div>

        {/* Filters + grid */}
        <ShopFilters locale={locale} currentFilters={filters} totalCount={filtered.length} />

        {filtered.length === 0 ? (
          <p
            className="py-24 text-center text-sm"
            style={{ color: 'var(--color-on-surface-variant)' }}
          >
            {isEs ? 'Ningún artículo coincide con sus filtros.' : 'No items match your filters.'}
          </p>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5 mt-8">
            {filtered.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                spotData={spotData}
                locale={locale}
              />
            ))}
          </div>
        )}
      </div>
    </main>
    <SiteFooter locale={locale} />
    </>
  );
}
