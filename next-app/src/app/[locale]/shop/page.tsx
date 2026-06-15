import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { isProductPurchasable, normalizeProductStatus, type Product, type ProductStatus } from '@/types/product';
import { fetchSpotData } from '@/lib/spot-price';
import { calcSpotPriceValue } from '@/lib/pricing';
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
  searchParams: Promise<{
    metal?: string;
    purity?: string;
    status?: string;
    itemType?: string;
    chainType?: string;
    length?: string | string[];
    gender?: string;
    q?: string;
    sort?: string;
  }>;
}

const CHAIN_KEYWORDS: Record<string, string[]> = {
  'cuban-link':    ['cuban'],
  'figaro-link':   ['figaro'],
  'rope-chain':    ['rope'],
  'anchor-link':   ['anchor', 'gucci'],
  'oval-link':     ['oval link'],
  'byzantine-link':['byzantine'],
  'bracelet':      ['bracelet'],
  'ring':          ['ring'],
};

const ITEM_TYPE_KEYWORDS: Record<string, string[]> = {
  necklace: ['necklace', 'chain'],
  bracelet: ['bracelet', 'bangle'],
  earrings: ['earring', 'earrings'],
  ring: ['ring'],
  pendant: ['pendant', 'charm'],
  watch: ['watch'],
};

const NECKLACE_LENGTH_VALUES = ['16 in', '18 in', '20 in', '22 in', '24 in', '26 in', '28 in', '30 in'];
const BRACELET_LENGTH_VALUES = ['7 in', '7.5 in', '8 in'];

function getAllowedLengthValues(itemType: string | undefined): string[] {
  if (itemType === 'necklace') return NECKLACE_LENGTH_VALUES;
  if (itemType === 'bracelet') return BRACELET_LENGTH_VALUES;
  return [];
}

function normalizeLengths(length: string | string[] | undefined): string[] {
  const values = Array.isArray(length) ? length : length ? [length] : [];
  return values
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter(Boolean);
}

function isVisibleInPublicGallery(product: Product): boolean {
  return normalizeProductStatus(product.status) !== 'pending_payment';
}

function parsePriceLabel(value: string | null): number | null {
  if (!value) return null;
  const match = value.replace(/,/g, '').match(/\d+(\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function getSortablePrice(product: Product, spotData: Awaited<ReturnType<typeof fetchSpotData>>): number | null {
  if (product.price_mode === 'spot-multiplier') {
    return calcSpotPriceValue(product, spotData);
  }
  return parsePriceLabel(product.manual_price_label ?? product.price_label);
}

function compareNullableNumbers(
  a: number | null | undefined,
  b: number | null | undefined,
  direction: 'asc' | 'desc',
) {
  const aMissing = a == null || Number.isNaN(a);
  const bMissing = b == null || Number.isNaN(b);
  if (aMissing && bMissing) return 0;
  if (aMissing) return 1;
  if (bMissing) return -1;
  return direction === 'asc' ? a - b : b - a;
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
  const publicGalleryProducts = allProducts.filter(isVisibleInPublicGallery);
  const selectedLengths = normalizeLengths(filters.length);
  const allowedLengthValues = getAllowedLengthValues(filters.itemType);
  const effectiveSelectedLengths = selectedLengths.filter((length) => allowedLengthValues.includes(length));

  const filtered = publicGalleryProducts.filter((p) => {
    if (filters.metal) {
      if (filters.metal === 'gold' && p.category !== 'Gold') return false;
      if (filters.metal === 'silver' && p.category !== 'Silver') return false;
    }
    if (filters.purity) {
      if (p.purity !== parseInt(filters.purity)) return false;
    }
    if (filters.status && normalizeProductStatus(p.status) !== normalizeProductStatus(filters.status as ProductStatus)) return false;
    if (filters.itemType) {
      const kws = ITEM_TYPE_KEYWORDS[filters.itemType];
      if (kws) {
        const txt = [p.title, p.title_es, p.chain_type, p.length, ...(p.tags ?? []), ...(p.tags_es ?? [])].join(' ').toLowerCase();
        if (!kws.some(k => txt.includes(k))) return false;
      }
    }
    if (filters.q) {
      const q = filters.q.toLowerCase();
      const txt = [p.title, p.title_es, p.inventory_number, p.sku, p.chain_type, p.length, ...(p.tags ?? []), ...(p.tags_es ?? [])].join(' ').toLowerCase();
      if (!txt.includes(q)) return false;
    }
    if (filters.chainType) {
      const kws = CHAIN_KEYWORDS[filters.chainType];
      if (kws) {
        const txt = [p.title, p.chain_type, ...(p.tags ?? [])].join(' ').toLowerCase();
        if (!kws.some(k => txt.includes(k))) return false;
      }
    }
    if (effectiveSelectedLengths.length > 0) {
      const lenTag = p.length ?? (p.tags ?? []).find((t: string) => t.startsWith('len:'))?.slice(4);
      if (!lenTag || !effectiveSelectedLengths.includes(lenTag)) return false;
    }
    if (filters.gender) {
      const g = p.gender ?? 'Unisex';
      // Unisex items appear in all gender categories
      if (g !== 'Unisex' && g !== filters.gender) return false;
    }
    return true;
  });

  // Available items first, then selected sort within each group.
  const sorted = [...filtered].sort((a, b) => {
    if (isProductPurchasable(a.status) !== isProductPurchasable(b.status)) return isProductPurchasable(a.status) ? -1 : 1;
    if (filters.sort === 'weight-asc' || filters.sort === 'weight-desc') {
      const byWeight = compareNullableNumbers(
        a.gram_weight ?? a.weight_grams,
        b.gram_weight ?? b.weight_grams,
        filters.sort === 'weight-asc' ? 'asc' : 'desc',
      );
      if (byWeight !== 0) return byWeight;
    }
    if (filters.sort === 'price-asc' || filters.sort === 'price-desc') {
      const byPrice = compareNullableNumbers(
        getSortablePrice(a, spotData),
        getSortablePrice(b, spotData),
        filters.sort === 'price-asc' ? 'asc' : 'desc',
      );
      if (byPrice !== 0) return byPrice;
    }
    return (a.sort_order ?? 0) - (b.sort_order ?? 0);
  });

  const isEs = locale === 'es';

  const investStyle = {
    border: '1px solid rgba(115, 92, 0, 0.24)',
    background: 'linear-gradient(135deg, #fffdf7 0%, #f7f2e4 100%)',
  };

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
      <main className="pt-20 md:pt-32 pb-20">
        <div className="max-w-[1760px] mx-auto px-4 md:px-8 2xl:px-10">

          {/* Investment transparency note */}
          <section
            className="mb-2 md:mb-10 text-center px-3 md:px-5 py-2 md:py-8"
            style={investStyle}
            aria-labelledby="shop-invest-heading"
          >
            <p
              className="text-[0.55rem] md:text-[0.68rem] font-bold uppercase tracking-[0.22em] mb-0.5 md:mb-2"
              style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}
            >
              {isEs ? 'Una forma más inteligente de poseer oro' : 'A smarter way to own gold'}
            </p>
            <h2
              id="shop-invest-heading"
              className="text-base md:text-4xl font-bold mt-0 mb-0 md:mb-3 tracking-tight"
              style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}
            >
              {isEs ? 'No solo compres. Invierte.' : "Don't just buy. Invest."}
            </h2>
            <p
              className="hidden md:block text-sm leading-relaxed max-w-2xl mx-auto mb-5"
              style={{ color: 'var(--color-on-surface-variant)' }}
            >
              {isEs
                ? 'Cada pieza tiene precio en vivo contra el mercado spot del oro, con el valor exacto de chatarra de oro mostrado junto a tu precio. No solo compras joyería — estás poniendo tu dinero en oro real y usable a un valor que puedes verificar.'
                : "Every piece is priced live against the gold spot market, with the exact gold scrap value shown right next to your price. You're not just buying jewelry — you're putting your money into real, wearable gold at a value you can verify."}
            </p>

            {/* 3-column points — hidden on mobile */}
            <div
              className="hidden md:grid md:grid-cols-3 gap-3 mt-4 text-center"
              style={{ borderTop: '1px solid rgba(115, 92, 0, 0.16)', paddingTop: '1rem' }}
            >
              {[
                {
                  label: isEs ? 'Precios en vivo' : 'Live spot prices',
                  copy: isEs
                    ? 'Los valores del oro se actualizan mientras compras, usando los mismos datos del mercado que impulsan cada listado.'
                    : 'Gold values update as you shop, using the same market data that powers each listing.',
                },
                {
                  label: isEs ? 'Chatarra y precio' : 'Scrap and price',
                  copy: isEs
                    ? 'Cada listado muestra el valor exacto de chatarra de oro junto a tu precio — nada oculto.'
                    : 'Each listing shows the exact gold scrap value next to your price — nothing hidden.',
                },
                {
                  label: isEs ? 'En cada página' : 'On every product page',
                  copy: isEs
                    ? 'Ve el multiplicador spot detrás del precio, más una oferta especial de intercambio para tu propio oro.'
                    : 'See the spot multiplier behind the price, plus a special trade-in offer for your own gold.',
                },
              ].map(({ label, copy }) => (
                <div
                  key={label}
                  className="py-3 px-2"
                  style={{ borderTop: '1px solid rgba(115, 92, 0, 0.18)' }}
                >
                  <strong
                    className="block text-[0.68rem] font-bold uppercase tracking-[0.14em] mb-1"
                    style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}
                  >
                    {label}
                  </strong>
                  <span className="text-xs leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>
                    {copy}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* ── Filters ────────────────────────────────────────── */}
          <ShopFilters
            locale={locale}
            currentFilters={filters}
            filteredCount={sorted.length}
            allCount={publicGalleryProducts.length}
            spotData={spotData}
          />

          {/* ── Grid ───────────────────────────────────────────── */}
          {filtered.length === 0 ? (
            <p
              className="py-24 text-center text-sm"
              style={{ color: 'var(--color-on-surface-variant)' }}
            >
              {isEs ? 'Ningún artículo coincide con sus filtros.' : 'No items match your filters.'}
            </p>
          ) : (
            <div className="shop-product-grid grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-5 mt-8">
              {sorted.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  spotData={spotData}
                  locale={locale}
                />
              ))}
            </div>
          )}
          <style>{`
            @media (min-width: 1720px) {
              .shop-product-grid {
                grid-template-columns: repeat(6, minmax(0, 1fr)) !important;
              }
            }
          `}</style>
        </div>
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}
