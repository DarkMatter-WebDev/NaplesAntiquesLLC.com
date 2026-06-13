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
  searchParams: Promise<{
    metal?: string;
    purity?: string;
    status?: string;
    chainType?: string;
    length?: string;
    gender?: string;
    q?: string;
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

const LENGTH_PATTERNS: Record<string, string[]> = {
  '22':       ['22 inch', '22"'],
  '23':       ['23 inch', '23"'],
  '24':       ['24 inch', '24"'],
  '25-plus':  ['25 inch', '25.5 inch', '26 inch', '27 inch', '27.5 inch', '28 inch', '29 inch'],
  '30':       ['30 inch', '30"'],
  'bracelet': ['bracelet'],
};

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
      const txt = [p.title, p.title_es, ...(p.tags ?? []), ...(p.tags_es ?? [])].join(' ').toLowerCase();
      if (!txt.includes(q)) return false;
    }
    if (filters.chainType) {
      const kws = CHAIN_KEYWORDS[filters.chainType];
      if (kws) {
        const txt = [p.title, ...(p.tags ?? [])].join(' ').toLowerCase();
        if (!kws.some(k => txt.includes(k))) return false;
      }
    }
    if (filters.length) {
      const lenTag = (p.tags ?? []).find((t: string) => t.startsWith('len:'));
      if (!lenTag || lenTag.slice(4) !== filters.length) return false;
    }
    if (filters.gender) {
      const g = p.gender ?? 'Unisex';
      // Unisex items appear in all gender categories
      if (g !== 'Unisex' && g !== filters.gender) return false;
    }
    return true;
  });

  // Available items first, then sold — preserving sort_order within each group
  const sorted = [...filtered].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'Available' ? -1 : 1;
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
        <div className="max-w-6xl mx-auto px-4 md:px-8">

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
            allCount={allProducts.length}
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
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5 mt-8">
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
        </div>
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}
