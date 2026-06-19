import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import {
  inferProductJewelryType,
  isProductPurchasable,
  isProductSold,
  productJewelryTypeLabel,
  productImagePaddingForImage,
  productLengthSizeDisplay,
  productMetalVariantLabel,
  productStatusLabel,
  productSupportsLinkType,
  type Product,
} from '@/types/product';
import { fetchSpotData } from '@/lib/spot-price';
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

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from('products')
    .select('title, description, images')
    .eq('id', id)
    .single();

  if (!data) return { title: 'Product Not Found' };

  return {
    title: data.title,
    description: data.description ?? `${data.title} — Naples Estate Jewelry Co`,
    openGraph: {
      images: data.images?.[0] ? [{ url: data.images[0] }] : [],
    },
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
  if (purity > 100) return `${(purity / 10).toFixed(1)}‰`;
  return `${purity}%`;
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

  const supabase = await createClient();
  const { data: product, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !product) notFound();

  const p = product as Product;
  const spotData = await fetchSpotData();

  const title = isEs && p.title_es ? p.title_es : p.title;
  const description = isEs && p.description_es ? p.description_es : p.description;
  const publicNotes = p.public_notes?.trim();
  const metalLabel = productMetalVariantLabel(p.metal_variant, p.category, locale);
  const price = getDisplayPrice(p, spotData);
  const isSold = isProductSold(p.status);
  const isPurchasable = isProductPurchasable(p.status);
  const productImages = p.image_urls?.length ? p.image_urls : p.images ?? [];
  const firstImagePadding = productImagePaddingForImage(p.image_padding, p.image_padding_by_image, productImages[0], 0);
  const productWeight = p.gram_weight ?? p.weight_grams;
  const inventoryReference = formatInventoryReference(p.inventory_number);

  const meltValue = productWeight && p.purity ? calcSpotMeltValue(p, spotData) : null;
  const scrapValue = meltValue == null ? null : formatUsdPrice(meltValue);
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

  const gender = p.gender ?? 'Unisex';
  if (gender !== 'Unisex') {
    specs.push({
      label: isEs ? 'Para' : 'For',
      value: isEs
        ? gender === 'Men' ? 'Hombres' : 'Mujeres'
        : gender,
    });
  }

  const cartItem: CartItem = {
    id: p.id,
    title: p.title,
    title_es: p.title_es,
    description: p.description,
    description_es: p.description_es,
    public_notes: p.public_notes,
    image: productImages[0] ?? null,
    image_padding: firstImagePadding,
    status: p.status,
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
    status: p.status,
    price_mode: p.price_mode,
    purity: p.purity,
    weight_grams: p.weight_grams,
    pricing_multiplier: p.pricing_multiplier,
    manual_price_label: p.manual_price_label,
  };


  const priceNumeric = price.replace(/[$,]/g, '').trim();
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: title,
    ...(inventoryReference ? { sku: inventoryReference } : {}),
    ...(description ? { description } : {}),
    ...(productImages[0] ? { image: productImages[0] } : {}),
    brand: { '@type': 'Organization', name: 'Naples Estate Jewelry Co' },
    offers: {
      '@type': 'Offer',
      url: `https://naplesestatejewelry.co${locale === 'es' ? '/es' : ''}/shop/${p.id}`,
      priceCurrency: 'USD',
      ...(/^\d+(\.\d+)?$/.test(priceNumeric) ? { price: priceNumeric } : {}),
      availability: isPurchasable ? 'https://schema.org/InStock' : 'https://schema.org/SoldOut',
      itemCondition: 'https://schema.org/UsedCondition',
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SiteHeader />
      <main className="pt-24 md:pt-28 pb-20">

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
                    {isEs ? 'Articulo #' : 'Item #'}{inventoryReference}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-3">
                <span
                  className="text-[0.6rem] font-bold uppercase tracking-widest px-2 py-0.5"
                  style={{
                    background: isPurchasable ? 'var(--color-primary)' : 'var(--color-on-surface)',
                    color: isPurchasable ? 'var(--color-on-primary)' : 'var(--color-surface)',
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
                <p
                  className="flex items-center gap-1 mt-1.5"
                  style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}
                >
                  <span className="material-symbols-outlined text-sm" style={{ color: 'var(--color-primary)', fontVariationSettings: "'FILL' 1" }} aria-hidden="true">
                    check_circle
                  </span>
                  {isEs ? 'Este es su precio' : 'This is your price'}
                </p>
                {isPurchasable && (
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
                )}
                {scrapValue && (
                  <div
                    className="mt-3 border p-1.5"
                    style={{
                      borderColor: '#e2d2aa',
                      background: '#fbf7ee',
                      borderRadius: '8px',
                    }}
                  >
                    <div className="grid gap-1.5 sm:grid-cols-2">
                      <div
                        className="px-3 py-2.5"
                        style={{
                          background: 'linear-gradient(135deg, #c9a13d 0%, #a9821e 100%)',
                          borderRadius: '8px',
                          boxShadow: '0 8px 18px rgba(169, 130, 30, 0.18)',
                        }}
                      >
                        <span
                          className="block text-[0.58rem] font-bold uppercase tracking-[0.12em]"
                          style={{ color: 'rgba(255, 249, 232, 0.82)', fontFamily: 'var(--font-label)' }}
                        >
                          {isEs
                            ? `Valor de ${p.category === 'Silver' ? 'plata' : 'oro'}`
                            : `Scrap ${p.category === 'Silver' ? 'silver' : 'gold'} value`}
                        </span>
                        <span
                          className="mt-1 block text-[0.95rem] font-extrabold"
                          style={{ color: '#ffffff', fontFamily: 'var(--font-label)' }}
                        >
                          {scrapValue}
                        </span>
                      </div>
                      {spotValueLabel && (
                        <div
                          className="border px-3 py-2.5"
                          style={{
                            borderColor: '#eadfca',
                            background: '#f4eddf',
                            borderRadius: '8px',
                          }}
                        >
                          <span
                            className="block text-[0.58rem] font-bold uppercase tracking-[0.12em]"
                            style={{ color: '#8b7b5a', fontFamily: 'var(--font-label)' }}
                          >
                            {isEs ? 'Basado en spot' : 'Based on spot'}
                          </span>
                          <span
                            className="mt-1 block text-[0.95rem] font-extrabold"
                            style={{ color: '#3b3324', fontFamily: 'var(--font-label)' }}
                          >
                            {spotValueLabel}/oz
                          </span>
                        </div>
                      )}
                    </div>
                    {nextSpotUpdateAt && <PriceUpdateTicker nextUpdateAt={nextSpotUpdateAt} locale={locale} />}
                  </div>
                )}
              </div>

              {/* Store credit line */}
              {scrapValue && isPurchasable && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    padding: '0.65rem 0.9rem',
                    background: 'color-mix(in srgb, var(--color-primary) 7%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--color-primary) 22%, transparent)',
                    borderRadius: '2px',
                  }}
                >
                  <span style={{ fontSize: '1rem', lineHeight: 1, flexShrink: 0 }}>⬡</span>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--color-on-surface)', margin: 0, lineHeight: 1.4 }}>
                    {isEs ? (
                      <>Llévalo por <strong style={{ color: 'var(--color-primary)' }}>{scrapValue}</strong> cuando aplicas tu valor de intercambio</>
                    ) : (
                      <>Get this item for <strong style={{ color: 'var(--color-primary)' }}>{scrapValue}</strong> when you apply your trade-in value</>
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
              {specs.length > 0 && (
                <div className="border-t pt-4" style={{ borderColor: 'var(--color-outline-variant)' }}>
                  <p
                    className="text-[0.62rem] font-bold uppercase tracking-[0.2em] mb-3"
                    style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}
                  >
                    {isEs ? 'Especificaciones' : 'Specifications'}
                  </p>
                  <dl className="flex flex-col gap-2">
                    {specs.map(({ label, value }) => (
                      <div key={label} className="flex gap-3 text-sm">
                        <dt
                          className="w-20 flex-shrink-0 font-semibold text-xs uppercase tracking-wide pt-px"
                          style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}
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
