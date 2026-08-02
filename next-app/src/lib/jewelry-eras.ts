// Shared definitions for the shop "Era / Year" range filter. Used by the server
// shop page (to apply the filter and clamp bounds) and the client
// ShopYearFilter slider (to render era bands + boundary ticks).
//
// Eras are organized into levels so overlapping movements can coexist:
//   level 1 — the primary, contiguous, non-overlapping periods (Victorian →
//             Contemporary). Each runs to the start of the next level-1 era;
//             the last runs to the current year. These define the tick marks.
//   levels 2+ — overlapping movements (e.g. Art Nouveau) that straddle level-1
//             boundaries. Each carries an explicit start/end and renders in its
//             own row above the primary one (one level per row).
// The earliest boundary is the start of the Victorian era (1837); the slider's
// left end represents "1837 & earlier", so pre-Victorian pieces are captured
// when the lower handle is at the floor. The current year is passed in so the
// server controls "now" and avoids client hydration drift.

export const JEWELRY_ERA_MIN_YEAR = 1837;

export interface JewelryEra {
  key: string;
  label: string;
  labelEs: string;
  /** Compact label for narrow bands on smaller widths. */
  shortLabel: string;
  shortLabelEs: string;
  start: number;
  end: number;
  level: number;
}

interface EraSeed {
  key: string;
  label: string;
  labelEs: string;
  shortLabel: string;
  shortLabelEs: string;
  start: number;
  /** Explicit end for overlapping eras; level-1 eras derive it from the next era. */
  end?: number;
  level: number;
}

const ERA_SEEDS: EraSeed[] = [
  // Level 1 — primary, contiguous periods.
  { key: 'victorian', label: 'Victorian', labelEs: 'Victoriana', shortLabel: 'Victorian', shortLabelEs: 'Victoriana', start: 1837, level: 1 },
  { key: 'edwardian', label: 'Edwardian', labelEs: 'Eduardiana', shortLabel: 'Edw.', shortLabelEs: 'Edw.', start: 1901, level: 1 },
  { key: 'art-deco', label: 'Art Deco', labelEs: 'Art Déco', shortLabel: 'Deco', shortLabelEs: 'Déco', start: 1915, level: 1 },
  { key: 'retro', label: 'Retro', labelEs: 'Retro', shortLabel: 'Retro', shortLabelEs: 'Retro', start: 1935, level: 1 },
  { key: 'mid-century', label: 'Mid-Century', labelEs: 'Mediados de siglo', shortLabel: 'Mid-Cent.', shortLabelEs: 'Mediados', start: 1950, level: 1 },
  { key: 'modern', label: 'Modern', labelEs: 'Moderna', shortLabel: 'Modern', shortLabelEs: 'Moderna', start: 1970, level: 1 },
  { key: 'contemporary', label: 'Contemporary', labelEs: 'Contemporánea', shortLabel: 'Contemp.', shortLabelEs: 'Contemp.', start: 2000, level: 1 },
];

const LEVEL_1_SEEDS = ERA_SEEDS.filter((seed) => seed.level === 1);

/** The slider's upper bound: the current year, never below the last era start. */
export function jewelryEraMaxYear(currentYear: number): number {
  return Math.max(currentYear, LEVEL_1_SEEDS[LEVEL_1_SEEDS.length - 1].start + 1);
}

/**
 * All eras with resolved `end` values. Level-1 eras run to the next level-1
 * era's start (the last to maxYear); eras with an explicit end keep it.
 */
export function getJewelryEras(maxYear: number): JewelryEra[] {
  return ERA_SEEDS.map((seed) => {
    if (seed.end != null) return { ...seed, end: seed.end };
    const index = LEVEL_1_SEEDS.findIndex((level1) => level1.key === seed.key);
    const end = index < LEVEL_1_SEEDS.length - 1 ? LEVEL_1_SEEDS[index + 1].start : maxYear;
    return { ...seed, end };
  });
}

/** Distinct era levels, highest first (overlapping rows render above primary). */
export function getJewelryEraLevels(): number[] {
  return Array.from(new Set(ERA_SEEDS.map((seed) => seed.level))).sort((a, b) => b - a);
}

/** Boundary years for slider tick marks: each level-1 era start plus the max year. */
export function getJewelryEraBoundaries(maxYear: number): number[] {
  return [...LEVEL_1_SEEDS.map((seed) => seed.start), maxYear];
}

/** Parse a yearMin/yearMax search param into an integer year, or null. */
export function parseYearFilter(value: string | string[] | undefined): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return null;
  const year = Number(raw);
  return Number.isInteger(year) ? year : null;
}
