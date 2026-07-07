import type { Metadata } from 'next';
import { cache, type CSSProperties } from 'react';
import { alternatesFor } from '@/lib/seo';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createPublicClient } from '@/lib/supabase/public';
import {
  inferProductJewelryType,
  formatProductItemYear,
  isProductPurchasable,
  isProductSold,
  isProductVisibleInShop,
  normalizeProductStatus,
  productJewelryTypeLabel,
  productImagePaddingBackground,
  productImagePaddingForImage,
  productLengthSizeDisplay,
  productMetalVariantLabel,
  productStatusLabel,
  productSupportsLinkType,
  shouldShowSpotPrice,
  getSpecialPriceOverrideAmount,
  type Product,
} from '@/types/product';
import { fetchSpotData } from '@/lib/spot-price';
import { jsonLdHtml } from '@/lib/json-ld';
import { calcSpotMeltValue, formatUsdPrice, getDisplayPrice, purityToFraction } from '@/lib/pricing';
import SiteHeader from '@/components/layout/SiteHeader';
import SiteFooter from '@/components/layout/SiteFooter';
import ProductImageGallery from '@/components/shop/ProductImageGallery';
import WishlistButton from '@/components/shop/WishlistButton';
import type { WishlistItem } from '@/context/WishlistContext';
import CartButton from '@/components/shop/CartButton';
import type { CartItem } from '@/context/CartContext';
import PriceUpdateTicker from '@/components/shop/PriceUpdateTicker';

interface Props {
  params: Promise<{ locale: string; id: string }>;
  searchParams?: Promise<{ returnTo?: string }>;
}

export const revalidate = 300;

const PRODUCT_DETAIL_COLUMNS = [
  'id',
  'category',
  'metal_type',
  'metal_variant',
  'title',
  'title_es',
  'description',
  'description_es',
  'public_notes',
  'public_notes_es',
  'price_label',
  'manual_price_label',
  'price_mode',
  'purity',
  'weight_grams',
  'gram_weight',
  'pricing_multiplier',
  'inventory_number',
  'sku',
  'slug',
  'brand',
  'product_type',
  'jewelry_type',
  'chain_type',
  'length',
  'status',
  'images',
  'image_urls',
  'image_padding',
  'image_padding_by_image',
  'tags',
  'tags_es',
  'gender',
  'item_year',
  'show_spot_price',
  'special_price_override_enabled',
  'special_price_override_amount',
].join(', ');

// Columns introduced by later migrations that may not exist yet on an
// un-migrated database. If any is missing, retry without all of them and
// backfill nulls so the product page keeps working before the migration runs.
const OPTIONAL_PRODUCT_DETAIL_COLUMNS = [
  'item_year',
  'public_notes_es',
  'show_spot_price',
  'special_price_override_enabled',
  'special_price_override_amount',
];

const PRODUCT_DETAIL_COLUMNS_REQUIRED = PRODUCT_DETAIL_COLUMNS
  .split(', ')
  .filter((column) => !OPTIONAL_PRODUCT_DETAIL_COLUMNS.includes(column))
  .join(', ');

function isMissingOptionalColumnError(error: { message?: string | null } | null | undefined) {
  const message = error?.message?.toLowerCase() ?? '';
  return OPTIONAL_PRODUCT_DETAIL_COLUMNS.some((column) => message.includes(column));
}

// Wrapped in React.cache so generateMetadata() and the page component share a
// single DB query per request instead of each firing their own (this route calls
// it in both places to resolve the product + the 404 decision).
const fetchPublicProduct = cache(async (id: string) => {
  const supabase = createPublicClient();
  const result = await supabase
    .from('products')
    .select(PRODUCT_DETAIL_COLUMNS)
    .eq('id', id)
    .single();

  if (isMissingOptionalColumnError(result.error)) {
    const fallback = await supabase
      .from('products')
      .select(PRODUCT_DETAIL_COLUMNS_REQUIRED)
      .eq('id', id)
      .single();
    return {
      data: fallback.data
        ? {
            ...(fallback.data as unknown as Record<string, unknown>),
            item_year: null,
            public_notes_es: null,
            show_spot_price: true,
            special_price_override_enabled: false,
            special_price_override_amount: null,
          } as Product
        : null,
      error: fallback.error,
    };
  }

  return {
    data: result.data as unknown as Product | null,
    error: result.error,
  };
});

export async function generateStaticParams() {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from('products')
    .select('id')
    .in('status', ['available', 'Available', 'sold', 'Sold'])
    .order('sort_order', { ascending: true });

  return (data ?? []).flatMap((product) => [
    { locale: 'en', id: product.id },
    { locale: 'es', id: product.id },
  ]);
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale, id } = await params;
  const query = searchParams ? await searchParams : {};
  const { data } = await fetchPublicProduct(id);

  // Throw notFound() here — before the streaming boundary (loading.tsx) commits a
  // 200 shell — so unknown/hidden product URLs return a real 404 instead of a
  // soft-404. (A notFound() in the page body below would already be too late.)
  if (!data) notFound();

  const returnHref = safeReturnHref(query.returnTo, locale);
  const visible = isProductVisibleInShop(data.status);
  if (!visible && !returnHref) notFound();

  const isEs = locale === 'es';
  const title = (isEs && data.title_es) ? data.title_es : data.title;
  const description =
    (isEs && data.description_es ? data.description_es : data.description) ?? `${title} — Naples Estate Jewelry`;
  const rawImage = data.image_urls?.[0] ?? data.images?.[0];
  const image = rawImage
    ? (rawImage.startsWith('http') ? rawImage : `https://naplesestatejewelry.co${rawImage}`)
    : undefined;

  return {
    title,
    description,
    // A hidden product reachable only via an admin/account return link must stay
    // out of the index even though we render full metadata for the preview.
    ...(visible ? {} : { robots: { index: false, follow: false } }),
    alternates: alternatesFor(`/shop/${id}`, locale),
    openGraph: {
      type: 'website',
      url: `https://naplesestatejewelry.co${isEs ? '/es' : ''}/shop/${id}`,
      title,
      description,
      images: image ? [{ url: image }] : [],
    },
    twitter: { card: 'summary_large_image', title, description, images: image ? [image] : [] },
  };
}

const GRAMS_PER_TROY_OZ = 31.1034768;
const SPOT_PRICE_UPDATE_INTERVAL_MS = 5 * 60 * 1000;

const SILVER_PURITY_LABELS: Record<number, string> = {
  999: '99.9%', 950: '95%', 925: '92.5%', 900: '90%', 850: '85%', 800: '80%',
};

function formatKarat(purity: number): string {
  if (purity <= 24) return `${purity}k`;
  if (SILVER_PURITY_LABELS[purity]) return SILVER_PURITY_LABELS[purity];
  // Millesimal fineness (parts per 1000) shown as a percentage, e.g. 835 -> 83.5%.
  if (purity > 100) return `${Number((purity / 10).toFixed(1))}%`;
  return `${purity}%`;
}

// Whether a resolved page background (always a hex once padding is applied) is
// dark enough to need light text — drives the "dark theme" product pages.
function isDarkColor(hex: string): boolean {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return false;
  const int = parseInt(match[1], 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance < 0.4;
}

function formatInventoryReference(value: string | number | null | undefined): string | null {
  if (value == null || value === '') return null;
  const normalized = String(value).trim().replace(/^#\s*/, '');
  return normalized || null;
}

function safeReturnHref(value: string | undefined, locale: string): string | null {
  if (!value) return null;
  const normalized = value.trim();
  const isEs = locale === 'es';
  const allowedPrefixes = [
    isEs ? '/es/admin' : '/admin',
    isEs ? '/es/account' : '/account',
  ];
  const isAllowed = allowedPrefixes.some((prefix) => (
    normalized === prefix ||
    normalized.startsWith(`${prefix}/`) ||
    normalized.startsWith(`${prefix}?`)
  ));

  if (isAllowed) {
    return normalized;
  }
  return null;
}

export default async function ProductDetailPage({ params, searchParams }: Props) {
  const { locale, id } = await params;
  const query = searchParams ? await searchParams : {};
  const isEs = locale === 'es';
  const shopHref = isEs ? '/es/shop' : '/shop';
  const returnHref = safeReturnHref(query.returnTo, locale);
  const accountPrefix = isEs ? '/es/account' : '/account';
  const isAccountReturn = returnHref?.startsWith(accountPrefix);
  const backHref = returnHref ?? shopHref;
  const backLabel = returnHref
    ? (isAccountReturn ? (isEs ? 'Volver a pedidos' : 'Back to Orders') : (isEs ? 'Volver al admin' : 'Back to Admin'))
    : (isEs ? 'Volver a la tienda' : 'Back to Shop');
  const contactHref = isEs ? '/es/contact' : '/contact';

  const { data: product, error } = await fetchPublicProduct(id);

  if (error || !product) notFound();

  const p = product as Product;
  if (!isProductVisibleInShop(p.status) && !returnHref) notFound();

  const spotData = await fetchSpotData();

  const title = isEs && p.title_es ? p.title_es : p.title;
  const description = isEs && p.description_es ? p.description_es : p.description;
  const publicNotes = (isEs && p.public_notes_es?.trim() ? p.public_notes_es : p.public_notes)?.trim();
  const metalLabel = productMetalVariantLabel(p.metal_variant, p.category, locale);
  const price = getDisplayPrice(p, spotData);
  const isSold = isProductSold(p.status);
  const isPurchasable = isProductPurchasable(p.status);
  const productImages = p.image_urls?.length ? p.image_urls : p.images ?? [];
  const firstImagePadding = productImagePaddingForImage(p.image_padding, p.image_padding_by_image, productImages[0], 0);
  // The page background matches the first image's padding color, so the gallery
  // frame blends into the page. An unset padding ('none') resolves to white,
  // matching the gallery's own default for that case.
  const pageBackground = firstImagePadding === 'none' ? '#ffffff' : productImagePaddingBackground(firstImagePadding);
  // Dark-background items get a "dark theme": page text/borders/accents lighten
  // automatically by overriding the color tokens on <main>. Light-backed controls
  // are restored via the `.product-page-dark` rules in globals.css.
  const isDarkPage = isDarkColor(pageBackground);
  const mainStyle: CSSProperties & Record<string, string> = { background: pageBackground };
  if (isDarkPage) {
    mainStyle['--color-on-surface'] = '#f2f2f0';
    mainStyle['--color-on-surface-variant'] = '#cbc8c0';
    mainStyle['--color-primary'] = '#e9c349';
    mainStyle['--color-outline-variant'] = 'rgba(255,255,255,0.20)';
  }
  const productWeight = p.gram_weight ?? p.weight_grams;
  const inventoryReference = formatInventoryReference(p.inventory_number);
  const itemDateLabel = formatProductItemYear(p.item_year);

  const meltValue = productWeight && p.purity ? calcSpotMeltValue(p, spotData) : null;
  const scrapValue = meltValue == null ? null : formatUsdPrice(meltValue);
  // Admin-controlled per item: some pieces aren't 100% precious metal, so a
  // melt value computed off the full item weight would overstate scrap value.
  const showSpotPrice = shouldShowSpotPrice(p);
  // The "Own gold or silver?" trade-in line defaults to the computed scrap
  // value, but an admin can override it with a flat custom price (e.g. to
  // advertise a rounder, more attractive number than the literal melt value).
  // The scrap-value box above stays tied to the real computed value either way.
  const specialPriceOverrideAmount = getSpecialPriceOverrideAmount(p);
  const tradeInValue = specialPriceOverrideAmount != null ? formatUsdPrice(specialPriceOverrideAmount) : scrapValue;
  const spotPerOz = p.category === 'Silver'
    ? spotData?.silverPerTroyOz
    : spotData?.goldPerTroyOz;
  const spotValueLabel = spotPerOz == null ? null : new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(spotPerOz);
  const nextSpotUpdateAt = spotData ? spotData.fetchedAt + SPOT_PRICE_UPDATE_INTERVAL_MS : null;

  // Auto-compile specs from structured fields
  const jewelryType = inferProductJewelryType(p);
  const chainType = productSupportsLinkType(jewelryType)
    ? p.chain_type ?? (p.tags ?? []).find(t => t.startsWith('ct:'))?.slice(3) ?? null
    : null;
  const buyerLength = productLengthSizeDisplay(p);
  const specs: { label: string; value: string }[] = [];

  if (p.brand?.trim()) specs.push({ label: isEs ? 'Marca' : 'Brand', value: p.brand.trim() });
  if (itemDateLabel) specs.push({ label: 'Circa', value: itemDateLabel });

  const metalValue = [
    metalLabel,
    p.purity ? formatKarat(p.purity) : null,
  ].filter(Boolean).join(' · ');
  if (metalValue) specs.push({ label: isEs ? 'Metal' : 'Metal', value: metalValue });

  if (productWeight) {
    let weightValue = `${productWeight.toFixed(2)} g`;
    if (p.purity) {
      const fineGrams = productWeight * purityToFraction(p.purity);
      const fineTroyOz = fineGrams / GRAMS_PER_TROY_OZ;
      weightValue = isEs
        ? `${productWeight.toFixed(2)} g total · ${fineGrams.toFixed(2)} g ${p.category === 'Gold' ? 'oro fino' : 'plata fina'} · ${fineTroyOz.toFixed(4)} oz troy`
        : `${productWeight.toFixed(2)} g total · ${fineGrams.toFixed(2)} g fine ${p.category === 'Gold' ? 'gold' : 'silver'} · ${fineTroyOz.toFixed(4)} troy oz`;
    }
    if (p.purity) {
      weightValue = isEs
        ? weightValue.replace(' oz troy', ` oz troy de ${p.category === 'Gold' ? 'oro fino' : 'plata fina'}`)
        : weightValue.replace(' troy oz', ` troy oz fine ${p.category === 'Gold' ? 'gold' : 'silver'}`);
    }
    specs.push({ label: isEs ? 'Peso' : 'Weight', value: weightValue });
  }

  specs.push({ label: isEs ? 'Tipo de producto' : 'Product Type', value: productJewelryTypeLabel(jewelryType, locale) });
  if (chainType) specs.push({ label: isEs ? 'Tipo de enlace' : 'Link Type', value: chainType });
  if (buyerLength) specs.push({
    label: jewelryType === 'Ring' ? (isEs ? 'Talla' : 'Size') : (isEs ? 'Largo' : 'Length'),
    value: buyerLength,
  });

  const gender = (p.gender ?? '').trim() || 'Unisex';
  if (gender !== 'Unisex') {
    specs.push({
      label: isEs ? 'Para' : 'For',
      value: isEs
        ? gender === 'Men' ? 'Hombres' : 'Mujeres'
        : gender,
    });
  }

  // Only show specs that actually have a value, so a label never renders with an
  // empty space beside it (e.g. "For" with no gender set).
  const visibleSpecs = specs.filter((spec) => spec.value != null && String(spec.value).trim() !== '');

  const normalizedStatus = normalizeProductStatus(p.status);

  const cartItem: CartItem = {
    id: p.id,
    title: p.title,
    title_es: p.title_es,
    description: p.description,
    description_es: p.description_es,
    public_notes: p.public_notes,
    image: productImages[0] ?? null,
    image_padding: firstImagePadding,
    status: normalizedStatus,
    priceLabel: price,
    category: p.category,
    metal_type: p.metal_type,
    metal_variant: p.metal_variant,
    purity: p.purity,
    weight_grams: p.weight_grams,
    gram_weight: p.gram_weight,
    product_type: p.product_type,
    jewelry_type: p.jewelry_type,
    chain_type: p.chain_type,
    length: p.length,
    brand: p.brand,
    item_year: p.item_year,
    tags: p.tags,
    tags_es: p.tags_es,
    gender: p.gender,
  };

  const wishlistItem: WishlistItem = {
    id: p.id,
    title: p.title,
    title_es: p.title_es,
    image: productImages[0] ?? null,
    image_padding: firstImagePadding,
    status: normalizedStatus,
    price_mode: p.price_mode,
    purity: p.purity,
    weight_grams: p.weight_grams,
    pricing_multiplier: p.pricing_multiplier,
    manual_price_label: p.manual_price_label,
  };


  const priceNumeric = price.replace(/[$,]/g, '').trim();
  const isNumericPrice = /^\d+(\.\d+)?$/.test(priceNumeric);
  const localePrefix = locale === 'es' ? '/es' : '';
  const canonicalProductUrl = `https://naplesestatejewelry.co${localePrefix}/shop/${p.id}`;
  const schemaImage = productImages[0]
    ? (productImages[0].startsWith('http') ? productImages[0] : `https://naplesestatejewelry.co${productImages[0]}`)
    : undefined;
  // Spot-linked prices change frequently; give a short validity window so the
  // merchant-listing rich result doesn't warn about a missing priceValidUntil.
  // Derive from the spot fetch timestamp (avoids an impure Date.now() in render).
  const priceValidUntil = new Date(spotData.fetchedAt + 2 * 86_400_000).toISOString().slice(0, 10);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: title,
    ...(inventoryReference ? { sku: inventoryReference } : {}),
    ...(description ? { description } : {}),
    ...(schemaImage ? { image: schemaImage } : {}),
    brand: { '@type': 'Organization', name: 'Naples Estate Jewelry' },
    offers: {
      '@type': 'Offer',
      url: canonicalProductUrl,
      priceCurrency: 'USD',
      ...(isNumericPrice ? { price: priceNumeric, priceValidUntil } : {}),
      availability: isPurchasable ? 'https://schema.org/InStock' : 'https://schema.org/SoldOut',
      itemCondition: 'https://schema.org/UsedCondition',
      seller: { '@type': 'Organization', name: 'Naples Estate Jewelry' },
    },
  };
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `https://naplesestatejewelry.co${localePrefix}` },
      { '@type': 'ListItem', position: 2, name: 'Shop', item: `https://naplesestatejewelry.co${localePrefix}/shop` },
      { '@type': 'ListItem', position: 3, name: title, item: canonicalProductUrl },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(breadcrumbLd) }} />
      <SiteHeader />
      <main className={`pt-24 md:pt-28 pb-20${isDarkPage ? ' product-page-dark' : ''}`} style={mainStyle}>

        {/* Back to shop */}
        <div className="max-w-7xl mx-auto px-4 md:px-8 mb-6">
          <Link
            href={backHref}
            className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest hover:underline underline-offset-2"
            style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}
          >
            ← {backLabel}
          </Link>
        </div>

        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="grid md:grid-cols-2 gap-10 lg:gap-16">

            {/* Gallery */}
            <ProductImageGallery images={productImages} title={title} imagePadding={p.image_padding} imagePaddingByImage={p.image_padding_by_image} />

            {/* Info */}
            <div className="flex flex-col gap-5">

              {/* Category + status */}
              <div className="flex flex-col gap-2">
                {inventoryReference && (
                  <p
                    className="text-[0.62rem] font-bold uppercase tracking-[0.22em]"
                    style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}
                  >
                    {isEs ? 'Artículo #' : 'Item #'}{inventoryReference}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-3">
                <span
                  className="text-[0.6rem] font-bold uppercase tracking-widest px-2 py-0.5"
                  style={{
                    background: isPurchasable
                      ? (isDarkPage ? '#e9c349' : 'var(--color-primary)')
                      : (isDarkPage ? '#dcd9d2' : 'var(--color-on-surface)'),
                    color: isDarkPage ? '#1a1c1c' : (isPurchasable ? 'var(--color-on-primary)' : 'var(--color-surface)'),
                  }}
                >
                  {isPurchasable
                    ? (isEs ? 'Disponible' : 'Available')
                    : isSold ? (isEs ? 'Vendido' : 'Sold') : productStatusLabel(p.status)}
                </span>
                <span
                  className="text-[0.62rem] font-bold uppercase tracking-[0.3em]"
                  style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}
                >
                  {metalLabel}
                  {p.purity ? ` · ${formatKarat(p.purity)}` : ''}
                </span>
                {buyerLength && (
                  <span
                    className="text-[0.62rem] font-bold uppercase tracking-[0.3em]"
                    style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}
                  >
                    &middot; {buyerLength}
                  </span>
                )}
                </div>
              </div>

              {/* Title */}
              <h1
                className="text-xl md:text-4xl font-bold leading-tight"
                style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}
              >
                {title}
              </h1>

              {/* Price */}
              <div className="border-t border-b py-4" style={{ borderColor: 'var(--color-outline-variant)' }}>
                <p
                  className="text-2xl md:text-3xl font-bold"
                  style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-headline)' }}
                >
                  {price}
                </p>
                {isPurchasable ? (
                  <p
                    className="flex items-center gap-1 mt-1.5"
                    style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}
                  >
                    <span className="material-symbols-outlined text-sm" style={{ color: 'var(--color-primary)', fontVariationSettings: "'FILL' 1" }} aria-hidden="true">
                      check_circle
                    </span>
                    {isEs ? 'Este es su precio' : 'This is your price'}
                  </p>
                ) : (
                  <p
                    className="mt-1.5"
                    style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}
                  >
                    {isSold ? (isEs ? 'Vendido — pieza única' : 'Sold — one of a kind') : productStatusLabel(p.status)}
                  </p>
                )}
                {isPurchasable ? (
                  <div className="flex flex-wrap gap-3 pt-3">
                    <CartButton item={cartItem} variant="detail" locale={locale} />
                    <WishlistButton item={wishlistItem} variant="button" locale={locale} />
                    <Link href={`${contactHref}?item=${encodeURIComponent(p.title)}`} className="outline-button">
                      {isEs ? 'Consultar' : 'Inquire'}
                    </Link>
                    <a href="tel:2394048505" className="outline-button">
                      {isEs ? 'Llamar' : 'Call'}
                    </a>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-3 pt-3">
                    <Link href={`${contactHref}?item=${encodeURIComponent(p.title)}`} className="outline-button">
                      {isEs ? 'Consultar pieza similar' : 'Inquire about a similar piece'}
                    </Link>
                    <a href="tel:2394048505" className="outline-button">
                      {isEs ? 'Llamar' : 'Call'}
                    </a>
                  </div>
                )}
                {isPurchasable && (
                  <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.62rem] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--color-on-surface-variant)' }}>
                    <span>✓ {isEs ? 'Envío asegurado' : 'Ships fully insured'}</span>
                    <span>✓ {isEs ? 'Autenticidad garantizada' : 'Authenticity guaranteed'}</span>
                  </p>
                )}
                {scrapValue && !showSpotPrice && (
                  <p
                    className="mt-3 text-[0.72rem] leading-snug"
                    style={{ color: 'var(--color-on-surface-variant)' }}
                  >
                    {isEs
                      ? '*Esta pieza no es 100% oro/plata, por lo que el valor de spot no aplica directamente a este artículo.'
                      : "*This piece isn't 100% gold or silver, so spot pricing doesn't apply directly to this item."}
                  </p>
                )}
                {scrapValue && showSpotPrice && (
                  <div
                    className="mt-3 border p-1.5"
                    style={{
                      borderColor: isDarkPage ? 'rgba(255,255,255,0.16)' : '#e2e6ec',
                      background: isDarkPage ? '#000000' : '#ffffff',
                      borderRadius: '8px',
                    }}
                  >
                    <div className="grid gap-1.5 sm:grid-cols-2">
                      <div
                        className="px-3 py-2.5"
                        style={{
                          background: 'linear-gradient(135deg, #faf5e3 0%, #f1e8c9 100%)',
                          border: '1px solid #ecdfb6',
                          borderRadius: '8px',
                          boxShadow: '0 6px 16px rgba(150, 120, 30, 0.10)',
                        }}
                      >
                        <span
                          className="block text-[0.58rem] font-bold uppercase tracking-[0.12em]"
                          style={{ color: '#8a7634', fontFamily: 'var(--font-label)' }}
                        >
                          {isEs
                            ? `Valor de ${p.category === 'Silver' ? 'plata' : 'oro'}`
                            : `Scrap ${p.category === 'Silver' ? 'silver' : 'gold'} value`}
                        </span>
                        <span
                          className="mt-1 block text-[0.95rem] font-extrabold"
                          style={{ color: '#735c00', fontFamily: 'var(--font-label)' }}
                        >
                          {scrapValue}
                        </span>
                      </div>
                      {spotValueLabel && (
                        <div
                          className="border px-3 py-2.5"
                          style={{
                            borderColor: '#e2e6ec',
                            background: '#f4f7fb',
                            borderRadius: '8px',
                          }}
                        >
                          <span
                            className="block text-[0.58rem] font-bold uppercase tracking-[0.12em]"
                            style={{ color: '#6b7280', fontFamily: 'var(--font-label)' }}
                          >
                            {isEs ? 'Basado en spot' : 'Based on spot'}
                          </span>
                          <span
                            className="mt-1 block text-[0.95rem] font-extrabold"
                            style={{ color: '#374151', fontFamily: 'var(--font-label)' }}
                          >
                            {spotValueLabel}/oz
                          </span>
                        </div>
                      )}
                    </div>
                    {nextSpotUpdateAt && <PriceUpdateTicker nextUpdateAt={nextSpotUpdateAt} locale={locale} onDark={isDarkPage} />}
                  </div>
                )}
              </div>

              {/* Store credit line */}
              {tradeInValue && showSpotPrice && isPurchasable && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    padding: '0.65rem 0.9rem',
                    background: '#f4f7fb',
                    border: '1px solid #e2e6ec',
                    borderRadius: '8px',
                    color: '#374151',
                  }}
                >
                  <span style={{ fontSize: '1rem', lineHeight: 1, flexShrink: 0 }}>⬡</span>
                  <p style={{ fontSize: '0.8125rem', color: '#374151', margin: 0, lineHeight: 1.4 }}>
                    {isEs ? (
                      <>¿Tienes oro o plata? Aplícalo a esta pieza y paga desde <strong style={{ color: '#735c00' }}>{tradeInValue}</strong> — llama al (239) 404-8505.</>
                    ) : (
                      <>Own gold or silver? Put it toward this piece and pay as little as <strong style={{ color: '#735c00' }}>{tradeInValue}</strong> — call (239) 404-8505.</>
                    )}
                  </p>
                </div>
              )}

              {/* Description */}
              {description && (
                <p className="text-sm leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>
                  {description}
                </p>
              )}

              {/* Specifications */}
              {visibleSpecs.length > 0 && (
                <div className="border-t pt-4" style={{ borderColor: 'var(--color-outline-variant)' }}>
                  <p
                    className="text-[0.62rem] font-bold uppercase tracking-[0.2em] mb-3"
                    style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}
                  >
                    {isEs ? 'Especificaciones' : 'Specifications'}
                  </p>
                  <dl className="flex flex-col gap-2">
                    {visibleSpecs.map(({ label, value }) => (
                      <div key={label} className="flex gap-3 text-sm">
                        <dt
                          className="w-20 flex-shrink-0 font-semibold text-xs normal-case tracking-wide pt-px"
                          style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}
                        >
                          {label}
                        </dt>
                        <dd style={{ color: 'var(--color-on-surface)' }}>{value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}

              {!isPurchasable && (
                <div>
                  <p className="text-sm mb-3" style={{ color: 'var(--color-on-surface-variant)' }}>
                    {isEs
                      ? 'Este artículo ya fue vendido. Contáctenos para piezas similares.'
                      : 'This item has been sold. Contact us for similar pieces.'}
                  </p>
                  <Link href={contactHref} className="outline-button">
                    {isEs ? 'Consultar piezas similares' : 'Ask About Similar Pieces'}
                  </Link>
                </div>
              )}

              {/* Public notes */}
              {publicNotes && (
                <div className="border-t pt-4" style={{ borderColor: 'var(--color-outline-variant)' }}>
                  <p
                    className="text-[0.62rem] font-bold uppercase tracking-[0.2em] mb-3"
                    style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}
                  >
                    {isEs ? 'Notas' : 'Notes'}
                  </p>
                  <p className="whitespace-pre-line text-sm leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>
                    {publicNotes}
                  </p>
                </div>
              )}



            </div>
          </div>
        </div>
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}
