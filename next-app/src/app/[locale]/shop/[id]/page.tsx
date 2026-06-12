import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import type { Product } from '@/types/product';
import { fetchSpotData } from '@/lib/spot-price';
import { getDisplayPrice, getPriceContext, purityToFraction } from '@/lib/pricing';
import SiteHeader from '@/components/layout/SiteHeader';
import SiteFooter from '@/components/layout/SiteFooter';
import ProductImageGallery from '@/components/shop/ProductImageGallery';
import WishlistButton from '@/components/shop/WishlistButton';
import type { WishlistItem } from '@/context/WishlistContext';

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

function formatKarat(purity: number): string {
  if (purity <= 24) return `${purity}k`;
  if (purity > 100) return `${(purity / 10).toFixed(0)}‰ fine`;
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
  const details = (isEs && p.details_es?.length ? p.details_es : p.details) ?? [];
  const price = getDisplayPrice(p, spotData);
  const priceCtx = getPriceContext(p, spotData, locale);
  const isSold = p.status === 'Sold';

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

  // Gold weight context
  let goldWeightLine: string | null = null;
  if (p.weight_grams && p.purity && p.category === 'Gold') {
    const fineGrams = p.weight_grams * purityToFraction(p.purity);
    const fineTroyOz = fineGrams / GRAMS_PER_TROY_OZ;
    goldWeightLine = isEs
      ? `${p.weight_grams.toFixed(2)} g total · ${fineGrams.toFixed(2)} g oro fino · ${fineTroyOz.toFixed(4)} oz troy`
      : `${p.weight_grams.toFixed(2)} g total · ${fineGrams.toFixed(2)} g fine gold · ${fineTroyOz.toFixed(4)} troy oz`;
  }

  return (
    <>
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
                <p className="text-xs mt-1" style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}>
                  {priceCtx}
                </p>
                {goldWeightLine && (
                  <p className="text-xs mt-1" style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}>
                    {goldWeightLine}
                  </p>
                )}
              </div>

              {/* Description */}
              {description && (
                <p className="text-sm leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>
                  {description}
                </p>
              )}

              {/* Details list */}
              {details.length > 0 && (
                <ul className="flex flex-col gap-1.5">
                  {details.map((d, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm" style={{ color: 'var(--color-on-surface)' }}>
                      <span className="mt-1 w-1 h-1 rounded-full flex-shrink-0" style={{ background: 'var(--color-primary)' }} />
                      {d}
                    </li>
                  ))}
                </ul>
              )}

              {/* CTAs */}
              {!isSold && (
                <div className="flex flex-wrap gap-3 pt-2">
                  <Link href={`${contactHref}?item=${encodeURIComponent(p.title)}`} className="gold-button">
                    {isEs ? 'Consultar sobre esta pieza' : 'Inquire About This Piece'}
                  </Link>
                  <a href="tel:2394048505" className="outline-button">
                    {isEs ? 'Llamar: (239) 404-8505' : 'Call: (239) 404-8505'}
                  </a>
                  <WishlistButton item={wishlistItem} variant="button" locale={locale} />
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

              {/* Spot info note */}
              {p.price_mode === 'spot-multiplier' && spotData && (
                <p className="text-[0.6rem] leading-relaxed" style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}>
                  {isEs
                    ? `Precio calculado sobre spot del oro a $${spotData.goldPerTroyOz.toLocaleString()}/oz troy${spotData.source === 'fallback' ? ' (precio de referencia)' : ' (en vivo)'}. El precio puede cambiar con el mercado.`
                    : `Price calculated on gold spot at $${spotData.goldPerTroyOz.toLocaleString()}/troy oz${spotData.source === 'fallback' ? ' (reference price)' : ' (live)'}. Price may change with the market.`}
                </p>
              )}


            </div>
          </div>
        </div>
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}
