import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import {
  PRODUCT_METAL_VARIANTS,
  inferProductJewelryType,
  isProductPurchasable,
  normalizeProductMetalVariant,
  normalizeProductStatus,
  productMetalVariantLabel,
  productSupportsLinkType,
  type Product,
  type ProductStatus,
} from '@/types/product';
import { fetchSpotData } from '@/lib/spot-price';
import { calcSpotPriceValue } from '@/lib/pricing';
import ProductCard from '@/components/shop/ProductCard';
import ShopFilters from '@/components/shop/ShopFilters';
import ShopPagination from '@/components/shop/ShopPagination';
import SiteHeader from '@/components/layout/SiteHeader';
import SiteFooter from '@/components/layout/SiteFooter';

export const metadata: Metadata = {
  title: 'Shop',
  description: 'Browse estate gold jewelry, chains, bracelets, and rings with live pricing.',
};

type ShopCollection = 'default' | 'silverTableware';

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

const CHAIN_KEYWORDS: Record<string, string[]> = {
  'cuban-link':    ['cuban'],
  'figaro-link':   ['figaro'],
  'rope-chain':    ['rope'],
  'anchor-link':   ['anchor', 'gucci'],
  'oval-link':     ['oval link'],
  'byzantine-link':['byzantine'],
  'box-link':      ['box link'],
};

const ITEM_TYPE_KEYWORDS: Record<string, string[]> = {
  necklace: ['necklace', 'chain'],
  bracelet: ['bracelet', 'bangle'],
  earrings: ['earring', 'earrings'],
  ring: ['ring'],
  pendant: ['pendant'],
  charm: ['charm', 'charms'],
  brooch: ['brooch', 'pin'],
  watch: ['watch', 'wristwatch', 'wrist watch', 'timepiece'],
  coin: ['coin'],
  bullion: ['bullion', 'bar', 'round', 'ingot'],
  silverware: ['silverware', 'flatware', 'hollowware'],
};

const ITEM_TYPE_VALUES: Record<string, ReturnType<typeof inferProductJewelryType>> = {
  necklace: 'Necklace',
  bracelet: 'Bracelet',
  earrings: 'Earrings',
  ring: 'Ring',
  pendant: 'Pendant',
  charm: 'Charm',
  brooch: 'Brooch',
  watch: 'Watch',
  coin: 'Coin',
  bullion: 'Bullion',
  silverware: 'Silverware',
};

function getProductLinkType(product: Product): string {
  const jewelryType = inferProductJewelryType(product);
  if (!productSupportsLinkType(jewelryType)) return '';
  return product.chain_type ?? (product.tags ?? []).find((t: string) => t.startsWith('ct:'))?.slice(3) ?? '';
}

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

function getEffectiveMetalColor(metal: string | undefined, metalColor: string | undefined): string | undefined {
  if (!metalColor) return undefined;
  if (metal === 'gold') {
    return PRODUCT_METAL_VARIANTS.Gold.some((variant) => variant.value === metalColor) ? metalColor : undefined;
  }
  if (metal === 'silver') {
    return PRODUCT_METAL_VARIANTS.Silver.some((variant) => variant.value === metalColor) ? metalColor : undefined;
  }
  return [...PRODUCT_METAL_VARIANTS.Gold, ...PRODUCT_METAL_VARIANTS.Silver].some((variant) => variant.value === metalColor)
    ? metalColor
    : undefined;
}

function productMatchesBroadMetal(product: Product, metal: string | undefined): boolean {
  if (!metal) return true;
  const metalVariant = normalizeProductMetalVariant(product.metal_variant, product.category);
  if (metalVariant === 'bicolor_gold') return metal === 'gold' || metal === 'silver';
  if (metal === 'gold') return product.category === 'Gold';
  if (metal === 'silver') return product.category === 'Silver';
  return true;
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

const PER_PAGE_OPTIONS = [12, 24, 48, 96];
const DEFAULT_PER_PAGE = 48;
type ShopFiltersSearchParams = Awaited<Props['searchParams']>;

function buildGenderTabHref(
  locale: string,
  filters: ShopFiltersSearchParams,
  gender: 'Men' | 'Women' | '',
  routeSegment = 'shop',
): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value == null || key === 'gender' || key === 'page') return;
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item) params.append(key, item);
      });
      return;
    }
    if (value) params.set(key, value);
  });
  if (gender) params.set('gender', gender);
  const query = params.toString();
  const path = locale === 'es' ? `/es/${routeSegment}` : `/${routeSegment}`;
  return query ? `${path}?${query}` : path;
}

function parsePerPage(value: string | undefined): number {
  const parsed = Number(value);
  return PER_PAGE_OPTIONS.includes(parsed) ? parsed : DEFAULT_PER_PAGE;
}

function parsePage(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function parsePriceFilter(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export default async function ShopPage({ params, searchParams }: Props) {
  return renderShopPage({ params, searchParams, variant: 'modern', routeSegment: 'shop' });
}

export async function renderShopPage({
  params,
  searchParams,
  variant = 'classic',
  routeSegment,
  collection = 'default',
}: Props & { variant?: 'classic' | 'modern'; routeSegment?: 'shop' | 'shop-modern' | 'silver-tableware'; collection?: ShopCollection }) {
  const { locale } = await params;
  const rawFilters = await searchParams;
  const filters = collection === 'silverTableware'
    ? { ...rawFilters, metal: 'silver', itemType: 'silverware' }
    : rawFilters;

  const supabase = await createClient();
  const { data: products, error } = await supabase
    .from('products')
    .select('*')
    .order('sort_order', { ascending: true });

  const spotData = await fetchSpotData();
  const allProducts: Product[] = (products ?? []) as Product[];
  const publicGalleryProducts = allProducts.filter(isVisibleInPublicGallery);
  const collectionProducts = collection === 'silverTableware'
    ? publicGalleryProducts.filter((product) => inferProductJewelryType(product) === 'Silverware' && productMatchesBroadMetal(product, 'silver'))
    : publicGalleryProducts;
  const brandOptions = Array.from(new Set(
    collectionProducts
      .map((product) => product.brand?.trim())
      .filter(Boolean) as string[],
  )).sort((a, b) => a.localeCompare(b));
  const selectedMetalColor = getEffectiveMetalColor(filters.metal, filters.metalColor ?? filters.metalType);
  const selectedLengths = normalizeLengths(filters.length);
  const allowedLengthValues = getAllowedLengthValues(filters.itemType);
  const effectiveSelectedLengths = selectedLengths.filter((length) => allowedLengthValues.includes(length));
  const publicPrices = collectionProducts
    .map((product) => getSortablePrice(product, spotData))
    .filter((price): price is number => price != null && Number.isFinite(price));
  const priceRange = publicPrices.length > 0
    ? {
        min: Math.floor(Math.min(...publicPrices) / 50) * 50,
        max: Math.ceil(Math.max(...publicPrices) / 50) * 50,
      }
    : null;
  const parsedPriceMin = parsePriceFilter(filters.priceMin);
  const parsedPriceMax = parsePriceFilter(filters.priceMax);
  const selectedPriceMin = priceRange && parsedPriceMin != null
    ? Math.min(Math.max(parsedPriceMin, priceRange.min), priceRange.max)
    : null;
  const selectedPriceMax = priceRange && parsedPriceMax != null
    ? Math.min(Math.max(parsedPriceMax, priceRange.min), priceRange.max)
    : null;
  const effectivePriceMin = selectedPriceMin != null && selectedPriceMax != null
    ? Math.min(selectedPriceMin, selectedPriceMax)
    : selectedPriceMin;
  const effectivePriceMax = selectedPriceMin != null && selectedPriceMax != null
    ? Math.max(selectedPriceMin, selectedPriceMax)
    : selectedPriceMax;

  const filtered = collectionProducts.filter((p) => {
    if (filters.metal) {
      if (!productMatchesBroadMetal(p, filters.metal)) return false;
    }
    if (selectedMetalColor && normalizeProductMetalVariant(p.metal_variant, p.category) !== selectedMetalColor) {
      return false;
    }
    if (filters.purity) {
      if (p.purity !== parseInt(filters.purity)) return false;
    }
    if (filters.status && normalizeProductStatus(p.status) !== normalizeProductStatus(filters.status as ProductStatus)) return false;
    if (filters.itemType) {
      const selectedJewelryType = ITEM_TYPE_VALUES[filters.itemType];
      if (selectedJewelryType && inferProductJewelryType(p) !== selectedJewelryType) return false;
      const kws = ITEM_TYPE_KEYWORDS[filters.itemType];
      if (!selectedJewelryType && kws) {
        const txt = [p.title, p.title_es, p.chain_type, p.length, ...(p.tags ?? []), ...(p.tags_es ?? [])].join(' ').toLowerCase();
        if (!kws.some(k => txt.includes(k))) return false;
      }
    }
    if (filters.q) {
      const q = filters.q.toLowerCase();
      const txt = [p.title, p.title_es, p.brand, p.inventory_number, p.sku, productMetalVariantLabel(p.metal_variant, p.category), p.chain_type, p.length, ...(p.tags ?? []), ...(p.tags_es ?? [])].join(' ').toLowerCase();
      if (!txt.includes(q)) return false;
    }
    if (filters.chainType && (filters.itemType === 'necklace' || filters.itemType === 'bracelet')) {
      const kws = CHAIN_KEYWORDS[filters.chainType];
      if (kws) {
        if (!productSupportsLinkType(inferProductJewelryType(p))) return false;
        const txt = [getProductLinkType(p), ...(p.tags ?? [])].join(' ').toLowerCase();
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
    if (filters.brand && p.brand?.trim() !== filters.brand) return false;
    if (effectivePriceMin != null || effectivePriceMax != null) {
      const price = getSortablePrice(p, spotData);
      if (price == null) return false;
      if (effectivePriceMin != null && price < effectivePriceMin) return false;
      if (effectivePriceMax != null && price > effectivePriceMax) return false;
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
    if (filters.sort === 'brand-asc' || filters.sort === 'brand-desc') {
      const aBrand = a.brand?.trim() ?? '';
      const bBrand = b.brand?.trim() ?? '';
      if (!aBrand && bBrand) return 1;
      if (aBrand && !bBrand) return -1;
      const byBrand = aBrand.localeCompare(bBrand, undefined, { sensitivity: 'base' });
      if (byBrand !== 0) return filters.sort === 'brand-asc' ? byBrand : -byBrand;
    }
    return (a.sort_order ?? 0) - (b.sort_order ?? 0);
  });

  const perPage = parsePerPage(filters.perPage);
  const totalPages = Math.max(1, Math.ceil(sorted.length / perPage));
  const currentPage = Math.min(parsePage(filters.page), totalPages);
  const startIndex = (currentPage - 1) * perPage;
  const paginatedProducts = sorted.slice(startIndex, startIndex + perPage);
  const showingStart = sorted.length === 0 ? 0 : startIndex + 1;
  const showingEnd = startIndex + paginatedProducts.length;

  const isEs = locale === 'es';
  const isModern = variant === 'modern';
  const currentRouteSegment = routeSegment ?? (isModern ? 'shop-modern' : 'shop');
  const isSilverTableware = collection === 'silverTableware';
  const heroContent = isSilverTableware
    ? {
        eyebrow: isEs ? 'Plateria sterling seleccionada' : 'Curated sterling silver',
        title: isEs ? 'Plateria Sterling y Mas' : 'Sterling Tableware & More',
        copy: isEs
          ? 'Explore piezas hermosas de plata sterling para la mesa y el hogar, seleccionadas por su calidad, historia, utilidad y valor.'
          : 'Browse beautiful sterling silver pieces for the table and home, chosen for quality, history, usefulness, and value.',
        points: [
          {
            icon: 'diamond',
            label: isEs ? 'Belleza de herencia' : 'Heirloom beauty',
            copy: isEs
              ? 'Bandejas, copas, cubiertos y objetos sterling con caracter real, hechos para usarse, regalarse y conservarse.'
              : 'Trays, cups, flatware, and sterling objects with real character, made to be used, gifted, and kept.',
          },
          {
            icon: 'savings',
            label: isEs ? 'Precios razonables' : 'Reasonable prices',
            copy: isEs
              ? 'Compramos con cuidado y mantenemos precios practicos, para que piezas finas de plata sterling sigan siendo alcanzables.'
              : 'We buy carefully and price practically, so fine sterling pieces remain attainable rather than inflated.',
          },
          {
            icon: 'visibility',
            label: isEs ? 'Compra transparente' : 'Transparent buying',
            copy: isEs
              ? 'Los listados muestran fotos claras, detalles utiles y contexto honesto para que sepa exactamente que esta viendo.'
              : 'Listings show clear photos, useful details, and honest context so you know exactly what you are viewing.',
          },
        ],
      }
    : {
        eyebrow: isEs ? 'Una forma más inteligente de poseer oro' : 'A smarter way to own gold',
        title: isEs ? 'No solo compres. Invierte.' : "Don't just buy. Invest.",
        copy: isEs
          ? 'Cada pieza tiene precio en vivo contra el mercado spot del oro, con el valor exacto de chatarra de oro mostrado junto a tu precio. No solo compras joyería — estás poniendo tu dinero en oro real y usable a un valor que puedes verificar.'
          : "Every piece is priced live against the gold spot market, with the exact gold scrap value shown right next to your price. You're not just buying jewelry — you're putting your money into real, wearable gold at a value you can verify.",
        points: [
          {
            icon: 'monitoring',
            label: isEs ? 'Precios en vivo' : 'Live spot prices',
            copy: isEs
              ? 'Los valores del oro se actualizan mientras compras, usando los mismos datos del mercado que impulsan cada listado.'
              : 'Gold values update as you shop, using the same market data that powers each listing.',
          },
          {
            icon: 'sell',
            label: isEs ? 'Chatarra y precio' : 'Scrap and price',
            copy: isEs
              ? 'Cada listado muestra el valor exacto de chatarra de oro junto a tu precio — nada oculto.'
              : 'Each listing shows the exact gold scrap value next to your price — nothing hidden.',
          },
          {
            icon: 'auto_awesome',
            label: isEs ? 'En cada página' : 'On every product page',
            copy: isEs
              ? 'Ve el multiplicador spot detrás del precio, más una oferta especial de intercambio para tu propio oro.'
              : 'See the spot multiplier behind the price, plus a special trade-in offer for your own gold.',
          },
        ],
      };

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
      <main className={isModern ? 'modern-shop-page pt-20 md:pt-28 pb-20' : 'pt-20 md:pt-32 pb-20'}>
        <div className="max-w-[2400px] mx-auto px-4 md:px-8 2xl:px-10 min-[2200px]:px-12">

          {/* Investment transparency note */}
          <section
            className={isModern
              ? 'modern-shop-hero mb-6 md:mb-8 overflow-hidden text-left'
              : 'mb-2 md:mb-10 text-center px-3 md:px-5 py-2 md:py-8'}
            style={isModern ? undefined : investStyle}
            aria-labelledby="shop-invest-heading"
          >
            {isModern && <div className="modern-shop-hero-media" aria-hidden="true" />}
            <div className={isModern ? 'modern-shop-hero-content px-6 py-8 md:px-14 md:py-16' : ''}>
            <p
              className="text-[0.55rem] md:text-[0.68rem] font-bold uppercase tracking-[0.22em] mb-0.5 md:mb-2"
              style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}
            >
              {heroContent.eyebrow}
            </p>
            <h2
              id="shop-invest-heading"
              className={isModern
                ? 'text-4xl md:text-6xl font-bold mt-3 mb-4 tracking-tight max-w-2xl'
                : 'text-base md:text-4xl font-bold mt-0 mb-0 md:mb-3 tracking-tight'}
              style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}
            >
              {heroContent.title}
            </h2>
            <p
              className={isModern
                ? 'hidden md:block text-base leading-8 max-w-xl mb-9'
                : 'hidden md:block text-sm leading-relaxed max-w-2xl mx-auto mb-5'}
              style={{ color: 'var(--color-on-surface-variant)' }}
            >
              {heroContent.copy}
            </p>

            {/* 3-column points — hidden on mobile */}
            <div
              className={isModern
                ? 'hidden md:grid md:grid-cols-3 gap-4 mt-4 max-w-5xl'
                : 'hidden md:grid md:grid-cols-3 gap-3 mt-4 text-center'}
              style={isModern ? undefined : { borderTop: '1px solid rgba(115, 92, 0, 0.16)', paddingTop: '1rem' }}
            >
              {heroContent.points.map(({ icon, label, copy }) => (
                <div
                  key={label}
                  className={isModern ? 'modern-shop-proof-point' : 'py-3 px-2'}
                  style={isModern ? undefined : { borderTop: '1px solid rgba(115, 92, 0, 0.18)' }}
                >
                  {isModern && (
                    <span className="material-symbols-outlined modern-shop-proof-icon" aria-hidden="true">
                      {icon}
                    </span>
                  )}
                  <div>
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
                </div>
              ))}
            </div>
            </div>
          </section>

          <div className="shop-catalog-layout">
            {/* -- Filters ------------------------------------------ */}
            <aside className="shop-filter-sidebar" aria-label={isEs ? 'Filtros de tienda' : 'Shop filters'}>
              <ShopFilters
                locale={locale}
                currentFilters={filters}
                brandOptions={brandOptions}
                filteredCount={sorted.length}
                allCount={collectionProducts.length}
                spotData={spotData}
                priceRange={priceRange}
                variant={isModern ? 'modern' : 'classic'}
              />
            </aside>

            {/* -- Grid --------------------------------------------- */}
            <section className="min-w-0">
              <nav
                className="shop-gender-tabs"
                aria-label={isEs ? 'Filtro principal de tienda' : 'Main shop filter'}
              >
                {[
                  { value: 'Men' as const, label: isEs ? 'Hombres' : "Men's" },
                  { value: '' as const, label: isEs ? 'Todo' : 'All' },
                  { value: 'Women' as const, label: isEs ? 'Damas' : "Ladies'" },
                ].map((tab) => {
                  const active = tab.value ? filters.gender === tab.value : !filters.gender;
                  return (
                    <Link
                      key={tab.label}
                      href={buildGenderTabHref(locale, filters, tab.value, currentRouteSegment)}
                      aria-current={active ? 'page' : undefined}
                      className="shop-gender-tab"
                      data-active={active ? 'true' : 'false'}
                    >
                      {tab.label}
                    </Link>
                  );
                })}
              </nav>
              {filtered.length === 0 ? (
                <p
                  className="py-24 text-center text-sm"
                  style={{ color: 'var(--color-on-surface-variant)' }}
                >
                  {isEs ? 'Ningún artículo coincide con sus filtros.' : 'No items match your filters.'}
                </p>
              ) : (
                <>
                  <div className="shop-product-grid grid grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-5">
                    {paginatedProducts.map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        spotData={spotData}
                        locale={locale}
                        variant={isModern ? 'modern' : 'classic'}
                      />
                    ))}
                  </div>
                  <ShopPagination
                    locale={locale}
                    currentPage={currentPage}
                    perPage={perPage}
                    totalPages={totalPages}
                    totalCount={sorted.length}
                    showingStart={showingStart}
                    showingEnd={showingEnd}
                  />
                </>
              )}
            </section>
          </div>
          <style>{`
            .modern-shop-page {
              background: #ffffff;
            }
            .modern-shop-hero {
              position: relative;
              min-height: 25rem;
              border: 1px solid rgba(115, 92, 0, 0.15);
              border-radius: var(--radius-xl);
              background: #ffffff;
              box-shadow: 0 18px 52px rgba(42, 34, 12, 0.09);
              isolation: isolate;
            }
            .modern-shop-hero-media {
              position: absolute;
              inset: 0;
              background:
                linear-gradient(90deg, #ffffff 0%, rgba(255, 255, 255, 0.88) 34%, rgba(255, 255, 255, 0.26) 56%, rgba(255, 255, 255, 0.06) 100%),
                url('/assets/images/pages/shop-modern-chain.png') center right / cover no-repeat;
              z-index: -1;
            }
            .modern-shop-hero-content {
              max-width: 64rem;
            }
            .modern-shop-proof-point {
              display: grid;
              grid-template-columns: 3.25rem 1fr;
              gap: 1rem;
              align-items: start;
              padding: 1rem 1.1rem;
              border-left: 1px solid rgba(115, 92, 0, 0.14);
              background: rgba(255, 253, 248, 0.62);
              backdrop-filter: blur(4px);
            }
            .modern-shop-proof-icon {
              display: inline-flex;
              align-items: center;
              justify-content: center;
              width: 2.75rem;
              height: 2.75rem;
              border-radius: 999px;
              color: #a98208;
              background: rgba(212, 175, 55, 0.14);
              font-size: 1.3rem;
              line-height: 1;
            }
            .modern-shop-page .shop-catalog-layout {
              margin-top: 1.25rem;
            }
            .modern-shop-page .shop-filter-sidebar {
              border: 1px solid rgba(115, 92, 0, 0.14);
              border-radius: var(--radius-xl);
              background: #ffffff;
              box-shadow: 0 12px 34px rgba(42, 34, 12, 0.08);
              padding: 1rem;
            }
            .modern-shop-page .shop-gender-tabs {
              max-width: 42rem;
              margin-bottom: 1.6rem;
              border-radius: var(--radius-xl);
              border-color: rgba(115, 92, 0, 0.12);
              background: rgba(255, 255, 255, 0.78);
              box-shadow: 0 10px 30px rgba(42, 34, 12, 0.08);
              overflow: hidden;
            }
            .modern-shop-page .shop-gender-tab {
              min-height: 2.85rem;
              border-radius: var(--radius-lg);
              letter-spacing: 0.13em;
            }
            .modern-shop-page .shop-gender-tab[data-active="true"] {
              background: linear-gradient(135deg, #dcb336, #b5890c);
              color: #fffdf7;
              border-color: transparent;
              box-shadow: 0 10px 24px rgba(181, 137, 12, 0.18);
            }
            .modern-shop-page .shop-filters {
              margin-bottom: 0 !important;
            }
            .modern-shop-page .shop-filter-toggle-row {
              display: none !important;
            }
            .modern-shop-page .shop-filter-panel {
              display: block !important;
            }
            .modern-shop-page .shop-search-spot-row > div,
            .modern-shop-page .shop-filter-panel {
              border-radius: var(--radius-xl) !important;
            }
            @media (max-width: 767px) {
              /* Merge the hero and the filter card into one seamless card */
              .modern-shop-hero {
                min-height: 0;
                margin-bottom: 0;
                border-bottom: none;
                border-bottom-left-radius: 0;
                border-bottom-right-radius: 0;
                box-shadow: none;
              }
              .modern-shop-hero-content {
                padding-top: 1.35rem !important;
                padding-bottom: 0.6rem !important;
              }
              .modern-shop-page .shop-catalog-layout {
                margin-top: 0;
              }
              .modern-shop-page .shop-filter-sidebar {
                border-top: none;
                border-top-left-radius: var(--radius-xl);
                border-top-right-radius: var(--radius-xl);
              }
              .modern-shop-hero-media {
                opacity: 0.18;
                width: 100%;
              }
              .modern-shop-proof-point {
                grid-template-columns: 1fr;
              }
              /* Hide the gender tabs on mobile (gender stays available in the filters panel) */
              .shop-gender-tabs {
                display: none !important;
              }
              /* Collapse filters behind the toggle button on mobile */
              .modern-shop-page .shop-filter-toggle-row {
                display: flex !important;
              }
              .modern-shop-page .shop-filter-panel {
                display: none !important;
              }
              .modern-shop-page .shop-filter-panel.is-open {
                display: block !important;
              }
            }
            .shop-catalog-layout {
              display: block;
              margin-top: 2rem;
            }
            .shop-filter-sidebar {
              min-width: 0;
            }
            .shop-gender-tabs {
              display: grid;
              grid-template-columns: repeat(3, minmax(0, 1fr));
              max-width: 36rem;
              margin: 0 auto 1.15rem;
              padding: 0.25rem;
              border: 1px solid rgba(115, 92, 0, 0.22);
              background: linear-gradient(135deg, rgba(255, 253, 247, 0.92), rgba(247, 242, 228, 0.84));
              box-shadow: 0 14px 34px rgba(48, 38, 12, 0.08);
            }
            .shop-gender-tab {
              min-height: 2.55rem;
              display: inline-flex;
              align-items: center;
              justify-content: center;
              padding: 0.65rem 0.75rem;
              border: 1px solid transparent;
              color: var(--color-on-surface-variant);
              font-family: var(--font-label);
              font-size: 0.72rem;
              font-weight: 800;
              letter-spacing: 0.16em;
              text-transform: uppercase;
              text-decoration: none;
              transition: background-color 160ms ease, border-color 160ms ease, color 160ms ease, box-shadow 160ms ease;
              white-space: nowrap;
            }
            .shop-gender-tab[data-active="true"] {
              background: linear-gradient(135deg, rgba(212, 175, 55, 0.28), rgba(255, 245, 198, 0.72));
              border-color: rgba(115, 92, 0, 0.34);
              color: var(--color-primary);
              box-shadow: 0 8px 22px rgba(115, 92, 0, 0.12);
            }
            .shop-gender-tab:hover {
              background: rgba(212, 175, 55, 0.12);
              color: var(--color-primary);
            }
            @media (min-width: 1024px) {
              .shop-catalog-layout {
                display: grid;
                grid-template-columns: minmax(17rem, 19rem) minmax(0, 1fr);
                align-items: start;
                gap: 1.5rem;
              }
              .modern-shop-page .shop-filter-sidebar {
                margin-top: 0;
              }
              .shop-filter-sidebar {
                position: sticky;
                top: 6.5rem;
                align-self: start;
              }
              /* Gender is handled by the sidebar buttons, so hide the redundant toggle */
              .modern-shop-page .shop-gender-tabs {
                display: none;
              }
            }
            @media (min-width: 768px) and (max-width: 1023px) {
              /* Tablet: the sidebar gender buttons cover gender, so hide the redundant tabs */
              .shop-gender-tabs {
                display: none !important;
              }
              /* Tablet: collapse the filters behind the toggle button (same as mobile) */
              .modern-shop-page .shop-filter-toggle-row {
                display: flex !important;
              }
              .modern-shop-page .shop-filter-panel {
                display: none !important;
              }
              .modern-shop-page .shop-filter-panel.is-open {
                display: block !important;
              }
              /* Tablet: denser product grid */
              .shop-product-grid {
                grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
              }
              /* Tablet: 3-up filter dropdowns so option text (e.g. Sort) isn't clipped */
              .shop-filter-grid {
                grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
              }
              /* Tablet: vertically compact the whole hero */
              .modern-shop-hero-content {
                padding-top: 2rem;
                padding-bottom: 2rem;
              }
              .modern-shop-hero-content #shop-invest-heading {
                font-size: 2.75rem;
                margin-top: 0.4rem;
                margin-bottom: 0.6rem;
              }
              .modern-shop-hero-content > p:last-of-type {
                margin-bottom: 1.1rem;
              }
              .modern-shop-hero-content > div:last-child {
                margin-top: 0.5rem;
              }
              /* Tablet: trim down the hero proof-point blocks */
              .modern-shop-proof-point {
                grid-template-columns: 2rem 1fr;
                gap: 0.6rem;
                padding: 0.55rem 0.7rem;
              }
              .modern-shop-proof-icon {
                width: 1.95rem;
                height: 1.95rem;
                font-size: 1rem;
              }
              .modern-shop-proof-point strong {
                font-size: 0.58rem;
                margin-bottom: 0.2rem;
              }
              .modern-shop-proof-point div span {
                font-size: 0.66rem;
                line-height: 1.3;
              }
            }
            @media (min-width: 1720px) {
              .shop-product-grid {
                grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
              }
            }
            @media (min-width: 1960px) {
              .shop-product-grid {
                grid-template-columns: repeat(6, minmax(0, 1fr)) !important;
              }
            }
            @media (min-width: 2320px) {
              .shop-product-grid {
                grid-template-columns: repeat(7, minmax(0, 1fr)) !important;
              }
            }
          `}</style>
        </div>
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}
