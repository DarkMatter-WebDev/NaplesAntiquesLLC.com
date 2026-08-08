import type { Product } from '@/types/product';

// Shared formatting for the compact spec chips that identify a piece at a
// glance — purity, weight, length. Extracted 2026-08-04 when the related-
// products strip became the THIRD surface to need them: `ProductCard` and
// `ProductListRow` already carried byte-identical private copies, so a third
// would have made a drift in one of them invisible.
//
// Deliberately a plain module with no directives: `ProductCard`/`ProductListRow`
// are client components while `RelatedProductsStrip` is a server component, and
// all three must be able to import this.
//
// Width has no formatter here on purpose — `productWidthDisplay` in
// types/product.ts owns both its formatting AND the "Necklace and Bracelet only"
// rule, so every surface calls that one function instead.

export function formatPurity(product: Product, isEs: boolean): string {
  if (!product.purity) return isEs ? 'No indicado' : 'Not listed';
  if (product.category === 'Silver' && product.purity >= 100) {
    return `${product.purity}`;
  }
  return `${product.purity}K`;
}

export function getPurityChipStyle(product: Product) {
  if (!product.purity || product.category !== 'Gold' || product.purity > 24) {
    return {
      background: 'rgba(194, 155, 45, 0.1)',
      borderColor: 'rgba(115, 92, 0, 0.22)',
      color: 'var(--color-primary)',
    };
  }

  const karat = Math.min(24, Math.max(10, product.purity));
  const intensity = (karat - 10) / 12;
  const fillPercent = Math.round(18 + intensity * 42);
  const borderPercent = Math.round(32 + intensity * 38);

  return {
    background: `color-mix(in srgb, #ffd84d ${fillPercent}%, var(--color-background))`,
    borderColor: `color-mix(in srgb, #c99800 ${borderPercent}%, rgba(115, 92, 0, 0.22))`,
    color: karat >= 18 ? '#6f4e00' : karat >= 14 ? '#735c00' : '#6f622f',
  };
}

// Intentionally NOT locale-formatted. The unit `g` is identical in both
// languages, and the Spanish spec table renders weights with a period decimal
// too (`53.91 gramos en total`, shop/[id]/page.tsx). Switching this to `es-ES`
// would print `53,91g` on the chip beside `53.91 gramos` in the table — a new
// inconsistency, not a fix.
export function formatWeight(weight: number | null): string {
  if (!weight) return '—';
  const maximumFractionDigits = weight >= 100 ? 1 : weight >= 10 ? 1 : 2;
  return `${new Intl.NumberFormat('en-US', {
    maximumFractionDigits: weight % 1 === 0 ? 0 : maximumFractionDigits,
  }).format(weight)}g`;
}

// Units are localized to match the product page's spec table, which maps
// `in` -> ` pulg` and `Size:` -> `Talla: ` (shop/[id]/page.tsx). Without the
// locale these chips read `7.3in` directly beneath a table row saying
// `Largo 7.75 pulg`.
export function formatLengthChip(value: string | null, isEs: boolean): string | null {
  if (!value) return null;
  const ringSize = value.match(/^Size:\s*(.+)$/i);
  if (ringSize) return isEs ? `Talla ${ringSize[1]}` : `Sz ${ringSize[1]}`;

  const inchValue = value.match(/^(\d+(?:\.\d+)?)\s*in$/i);
  if (!inchValue) return value;

  const numeric = Number(inchValue[1]);
  if (!Number.isFinite(numeric)) return value;
  const compact = numeric >= 10
    ? Math.round(numeric)
    : Number.isInteger(numeric) ? numeric : Number(numeric.toFixed(1));
  return isEs ? `${compact} pulg` : `${compact}in`;
}

/** The neutral chip treatment shared by the weight and width chips. */
export const NEUTRAL_CHIP_STYLE = {
  background: 'rgba(72, 65, 52, 0.07)',
  borderColor: 'rgba(72, 65, 52, 0.18)',
  color: 'var(--color-on-surface-variant)',
} as const;

/** The measurement chip treatment shared by the length and width chips. */
export const MEASUREMENT_CHIP_STYLE = {
  background: 'rgba(139, 85, 36, 0.08)',
  borderColor: 'rgba(139, 85, 36, 0.2)',
  color: '#7a4a1f',
} as const;
