import Image from 'next/image';
import Link from 'next/link';
import { createPublicClient } from '@/lib/supabase/public';
import { getStorefrontDisplayPrice } from '@/lib/pricing';
import { normalizeLegacyLocalImageUrl } from '@/lib/image-url';
import { pickPrimaryImage } from '../../../carousel/lib/carouselConfig';
import {
  inferProductJewelryType,
  productImagePaddingBackground,
  productImagePaddingForImage,
  productLengthSizeDisplay,
  productWidthDisplay,
  type Product,
  type SpotData,
} from '@/types/product';
import {
  formatLengthChip,
  formatPurity,
  formatWeight,
  getPurityChipStyle,
  MEASUREMENT_CHIP_STYLE,
  NEUTRAL_CHIP_STYLE,
} from '@/lib/product-spec-chips';

// "You might also like" strip for product detail pages (2026-08-04, from the
// mels-treasures.com review). Server-rendered inside the page's existing
// 300-second revalidation window. Per the DECISIONS card-performance
// guidance: one lean query of only the columns the cards and price math
// need, lazy images with accurate sizes, and no virtualization.

// Candidate pool. Larger than the display count so the same-type ranking has
// something to choose from without a second query.
const CANDIDATE_LIMIT = 24;
const DISPLAY_COUNT = 4;

const RELATED_COLUMN_LIST = [
  'id',
  'category',
  'title',
  'title_es',
  'status',
  'images',
  'image_padding',
  'image_padding_by_image',
  'price_label',
  'manual_price_label',
  'price_mode',
  'purity',
  'weight_grams',
  'gram_weight',
  'pricing_multiplier',
  'product_type',
  'jewelry_type',
  'chain_type',
  'length',
  'tags',
  'tags_es',
  'width_mm',
];

const RELATED_COLUMNS = RELATED_COLUMN_LIST.join(', ');
// `width_mm` arrived in a later migration. On a database that has not run it the
// select would 400 and this strip fails soft — which would silently remove the
// whole section rather than one chip — so it is retried without that column.
const RELATED_COLUMNS_WITHOUT_WIDTH = RELATED_COLUMN_LIST
  .filter((column) => column !== 'width_mm')
  .join(', ');

type Props = {
  current: Product;
  spotData: SpotData | null;
  locale: string;
};

export default async function RelatedProductsStrip({ current, spotData, locale }: Props) {
  const isEs = locale === 'es';
  const prefix = isEs ? '/es' : '';

  const supabase = createPublicClient();
  const query = (columns: string) => supabase
    .from('products')
    .select(columns)
    .eq('status', 'available')
    .eq('category', current.category)
    .neq('id', current.id)
    .order('id')
    .limit(CANDIDATE_LIMIT);

  const primary = await query(RELATED_COLUMNS);
  const missingWidthColumn = Boolean(primary.error?.message?.toLowerCase().includes('width_mm'));
  const fallback = missingWidthColumn ? await query(RELATED_COLUMNS_WITHOUT_WIDTH) : null;
  const result = fallback ?? primary;

  // A merchandising strip must never break the product page.
  if (result.error || !result.data || result.data.length === 0) return null;

  const rows = (result.data as unknown as Product[]).map(
    (row) => (missingWidthColumn ? { ...row, width_mm: null } : row),
  );
  const candidates = rows.filter((item) => pickPrimaryImage(item.images));

  // Same inferred type first (a bracelet suggests bracelets), then the rest
  // of the same metal category — stable within each group for a calm page.
  const currentType = inferProductJewelryType(current);
  const related = [
    ...candidates.filter((item) => inferProductJewelryType(item) === currentType),
    ...candidates.filter((item) => inferProductJewelryType(item) !== currentType),
  ].slice(0, DISPLAY_COUNT);

  if (related.length === 0) return null;

  return (
    <section
      className="border-t px-6 py-12 md:px-8 md:py-16"
      style={{ borderColor: 'var(--color-outline-variant)' }}
      aria-label={isEs ? 'Piezas relacionadas' : 'Related pieces'}
    >
      {/* ultrawide-page = the standard 1800px ultra-wide tier; the source
          guard requires every large canvas to pick a tier explicitly. */}
      <div className="ultrawide-page mx-auto w-full max-w-6xl">
        <p
          className="text-center text-[0.65rem] font-bold uppercase tracking-[0.35em] mb-3"
          style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}
        >
          {isEs ? 'Siga Explorando' : 'Keep Exploring'}
        </p>
        <h2
          className="text-center text-2xl font-bold mb-10 tracking-tight"
          style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}
        >
          {isEs ? 'También Le Puede Gustar' : 'You Might Also Like'}
        </h2>
        <div className="related-product-grid">
          {related.map((item) => {
            const title = isEs && item.title_es ? item.title_es : item.title;
            // Candidates were filtered to have a primary image; the ?? '' is
            // for the type system, not a real path.
            const image = normalizeLegacyLocalImageUrl(pickPrimaryImage(item.images)) ?? '';
            if (!image) return null;
            const frameBackground = productImagePaddingBackground(
              productImagePaddingForImage(item.image_padding, item.image_padding_by_image, image, 0),
            );
            const price = getStorefrontDisplayPrice(item, spotData, false, locale);
            // Same at-a-glance specs the shop cards carry, through the same
            // shared formatters, so a piece reads identically wherever it
            // appears. Purity and weight are always shown (weight prints an
            // em dash when unset); length and width appear only when the piece
            // actually has them — productWidthDisplay keeps width to necklaces
            // and bracelets.
            const purityLabel = formatPurity(item, isEs);
            const purityChipStyle = getPurityChipStyle(item);
            const weightLabel = formatWeight(item.gram_weight ?? item.weight_grams);
            const lengthLabel = formatLengthChip(productLengthSizeDisplay(item), isEs);
            const widthLabel = productWidthDisplay(item);
            const chips: Array<{ key: string; text: string; label: string; style: Record<string, string> }> = [
              { key: 'purity', text: purityLabel, label: isEs ? 'Pureza' : 'Purity', style: purityChipStyle },
              { key: 'weight', text: weightLabel, label: isEs ? 'Peso' : 'Weight', style: NEUTRAL_CHIP_STYLE },
            ];
            if (lengthLabel) {
              chips.push({
                key: 'length',
                text: lengthLabel,
                label: inferProductJewelryType(item) === 'Ring' ? (isEs ? 'Talla' : 'Size') : (isEs ? 'Largo' : 'Length'),
                style: MEASUREMENT_CHIP_STYLE,
              });
            }
            if (widthLabel) {
              chips.push({
                key: 'width',
                text: widthLabel.replace(/\s*mm$/, 'mm'),
                label: isEs ? 'Ancho' : 'Width',
                style: MEASUREMENT_CHIP_STYLE,
              });
            }
            return (
              <Link
                key={item.id}
                href={`${prefix}/shop/${item.id}`}
                // `product-light-surface`: the card paints its own light
                // background, so on a dark product page it has to restore the
                // light text tokens or it inherits near-white type onto white.
                className="related-product-card product-light-surface group flex flex-col gap-2 rounded-2xl border p-3 transition-shadow hover:shadow-[0_14px_38px_rgba(38,28,6,0.10)]"
                style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}
              >
                <span className="relative block aspect-square w-full overflow-hidden rounded-xl" style={{ background: frameBackground }}>
                  <Image
                    src={image}
                    alt={title}
                    fill
                    sizes="(max-width: 768px) 45vw, 22vw"
                    className="object-contain transition-transform duration-300 group-hover:scale-[1.03]"
                    unoptimized={image.startsWith('/assets/')}
                  />
                </span>
                <span
                  className="related-product-title font-bold"
                  style={{
                    fontFamily: 'var(--font-headline)',
                    color: 'var(--color-on-surface)',
                    display: '-webkit-box',
                    WebkitBoxOrient: 'vertical',
                    WebkitLineClamp: 2,
                    overflow: 'hidden',
                  }}
                >
                  {title}
                </span>
                {/* Price and pills share one wrapping row: the pill group is a
                    single flex item, so it either sits beside the price or drops
                    below it whole — it can never split across two lines. */}
                <span className="related-product-meta">
                  <span className="text-xs font-bold" style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}>
                    {price}
                  </span>
                  <span className="related-product-chips">
                    {chips.map((chip) => (
                      <span
                        key={chip.key}
                        className="related-product-chip"
                        style={chip.style}
                        aria-label={`${chip.label}: ${chip.text}`}
                      >
                        {chip.text}
                      </span>
                    ))}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
