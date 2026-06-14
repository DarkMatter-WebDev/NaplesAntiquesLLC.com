import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import type { Product } from '@/types/product';
import { fetchSpotData } from '@/lib/spot-price';
import { getDisplayPrice, purityToFraction } from '@/lib/pricing';
import SiteHeader from '@/components/layout/SiteHeader';
import SiteFooter from '@/components/layout/SiteFooter';
import ProductImageGallery from '@/components/shop/ProductImageGallery';
import WishlistButton from '@/components/shop/WishlistButton';
import type { WishlistItem } from '@/context/WishlistContext';
import CartButton from '@/components/shop/CartButton';
import type { CartItem } from '@/context/CartContext';

interface Props {
  params: Promise<{ locale: string; id: string }>;
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

const SILVER_PURITY_LABELS: Record<number, string> = {
  999: '99.9%', 950: '95%', 925: '92.5%', 900: '90%', 850: '85%', 800: '80%',
};

function formatKarat(purity: number): string {
  if (purity <= 24) return `${purity}k`;
  if (SILVER_PURITY_LABELS[purity]) return SILVER_PURITY_LABELS[purity];
  if (purity > 100) return `${(purity / 10).toFixed(1)}‰`;
  return `${purity}%`;
}

export default async function ProductDetailPage({ params }: Props) {
  const { locale, id } = await params;
  const isEs = locale === 'es';
  const shopHref = isEs ? '/es/shop' : '/shop';
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
  const price = getDisplayPrice(p, spotData);
  const isSold = p.status === 'Sold';

  // Raw melt/scrap value at spot (multiplier = 1.0)
  let scrapValue: string | null = null;
  if (
    p.price_mode === 'spot-multiplier' &&
    p.weight_grams && p.purity &&
    p.pricing_multiplier && p.pricing_multiplier !== 1 &&
    spotData
  ) {
    const spotPerOz = p.category === 'Silver'
      ? (spotData.silverPerTroyOz ?? 33)
      : spotData.goldPerTroyOz;
    const melt = p.weight_grams * purityToFraction(p.purity) * (spotPerOz / GRAMS_PER_TROY_OZ);
    scrapValue = new Intl.NumberFormat('en-US', {
      style: 'currency', currency: 'USD', maximumFractionDigits: 0,
    }).format(melt);
  }

  // Auto-compile specs from structured fields
  const chainType = (p.tags ?? []).find(t => t.startsWith('ct:'))?.slice(3) ?? null;
  const length = (p.tags ?? []).find(t => t.startsWith('len:'))?.slice(4) ?? null;
  const specs: { label: string; value: string }[] = [];

  const metalValue = [
    isEs ? (p.category === 'Gold' ? 'Oro' : 'Plata') : p.category,
    p.purity ? formatKarat(p.purity) : null,
  ].filter(Boolean).join(' · ');
  if (metalValue) specs.push({ label: isEs ? 'Metal' : 'Metal', value: metalValue });

  if (p.weight_grams) {
    let weightValue = `${p.weight_grams.toFixed(2)} g`;
    if (p.purity) {
      const fineGrams = p.weight_grams * purityToFraction(p.purity);
      const fineTroyOz = fineGrams / GRAMS_PER_TROY_OZ;
      weightValue = isEs
        ? `${p.weight_grams.toFixed(2)} g total · ${fineGrams.toFixed(2)} g ${p.category === 'Gold' ? 'oro fino' : 'plata fina'} · ${fineTroyOz.toFixed(4)} oz troy`
        : `${p.weight_grams.toFixed(2)} g total · ${fineGrams.toFixed(2)} g fine ${p.category === 'Gold' ? 'gold' : 'silver'} · ${fineTroyOz.toFixed(4)} troy oz`;
    }
    specs.push({ label: isEs ? 'Peso' : 'Weight', value: weightValue });
  }

  if (chainType) specs.push({ label: isEs ? 'Tipo' : 'Type', value: chainType });
  if (length) specs.push({ label: isEs ? 'Largo' : 'Length', value: length });

  const gender = p.gender ?? 'Unisex';
  if (gender !== 'Unisex') {
    specs.push({
      label: isEs ? 'Para' : 'For',
      value: isEs
        ? gender === 'Men' ? 'Hombres' : 'Mujeres'
        : gender,
    });
  }

  // Extra notes entered in the admin "Extra notes" field (details[0])
  const extraNote = (p.details ?? [])[0] ?? null;

  const cartItem: CartItem = {
    id: p.id,
    title: p.title,
    title_es: p.title_es,
    image: p.images?.[0] ?? null,
    status: p.status,
    priceLabel: price,
  };

  const wishlistItem: WishlistItem = {
    id: p.id,
    title: p.title,
    title_es: p.title_es,
    image: p.images?.[0] ?? null,
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
    ...(description ? { description } : {}),
    ...(p.images?.[0] ? { image: p.images[0] } : {}),
    brand: { '@type': 'Organization', name: 'Naples Estate Jewelry Co' },
    offers: {
      '@type': 'Offer',
      url: `https://naplesestatejewelry.co${locale === 'es' ? '/es' : ''}/shop/${p.id}`,
      priceCurrency: 'USD',
      ...(/^\d+(\.\d+)?$/.test(priceNumeric) ? { price: priceNumeric } : {}),
      availability: isSold ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
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
            href={shopHref}
            className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest hover:underline underline-offset-2"
            style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}
          >
            ← {isEs ? 'Volver a la tienda' : 'Back to Shop'}
          </Link>
        </div>

        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="grid md:grid-cols-2 gap-10 lg:gap-16">

            {/* Gallery */}
            <ProductImageGallery images={p.images ?? []} title={title} />

            {/* Info */}
            <div className="flex flex-col gap-5">

              {/* Category + status */}
              <div className="flex items-center gap-3">
                <span
                  className="text-[0.62rem] font-bold uppercase tracking-[0.3em]"
                  style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}
                >
                  {isEs ? (p.category === 'Gold' ? 'Oro' : 'Plata') : p.category}
                  {p.purity ? ` · ${formatKarat(p.purity)}` : ''}
                </span>
                <span
                  className="text-[0.6rem] font-bold uppercase tracking-widest px-2 py-0.5"
                  style={{
                    background: isSold ? 'var(--color-on-surface)' : 'var(--color-primary)',
                    color: isSold ? 'var(--color-surface)' : 'var(--color-on-primary)',
                  }}
                >
                  {isSold
                    ? (isEs ? 'Vendido' : 'Sold')
                    : (isEs ? 'Disponible' : 'Available')}
                </span>
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
                  <span style={{ color: 'var(--color-primary)' }}>✓</span>
                  {isEs ? 'Este es su precio' : 'This is your price'}
                </p>
                {scrapValue && (
                  <p
                    className="mt-2 text-xs font-semibold"
                    style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}
                  >
                    {isEs
                      ? `Valor actual de ${p.category === 'Silver' ? 'plata' : 'oro'} para fundir: ${scrapValue}`
                      : `Current scrap ${p.category === 'Silver' ? 'silver' : 'gold'} value: ${scrapValue}`}
                  </p>
                )}
              </div>

              {/* Store credit line */}
              {scrapValue && !isSold && (
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
                  {extraNote && (
                    <p
                      className="text-sm mt-3 leading-relaxed"
                      style={{ color: 'var(--color-on-surface-variant)', borderTop: '1px solid var(--color-outline-variant)', paddingTop: '0.75rem', marginTop: '0.75rem' }}
                    >
                      {extraNote}
                    </p>
                  )}
                </div>
              )}

              {/* CTAs */}
              {!isSold && (
                <div className="flex flex-wrap gap-3 pt-2">
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

              {isSold && (
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



            </div>
          </div>
        </div>
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}
