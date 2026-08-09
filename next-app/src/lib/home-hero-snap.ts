/**
 * Snap geometry for the pinned three-slideshow hero.
 *
 * On touch the hero snaps: one gesture advances exactly one slideshow, however
 * hard it is flung. That needs to know where a slideshow is "in place", and only
 * two of the three are obvious — A is flush at p=0 and C at p=1, but B NEVER
 * RESTS. The two crossings overlap on purpose (PHASE_2_START is before
 * PHASE_1_END, so motion never stops), which means B is already being pulled
 * away by crossing two while crossing one is still seating it. There is no p at
 * which both its terms are settled; it only passes through flush.
 *
 * So B's snap point is SOLVED, not declared: it is the p where B's transform
 * crosses zero. Deriving it from the same constants the scroll handler uses
 * means retuning PHASE_*, PANE_A_TRAVEL, or the easing curve moves the snap
 * point with them instead of silently leaving it pointing at open frame.
 *
 * These are pure functions taking the geometry as an argument rather than
 * importing it, so the component stays the single source of truth for its own
 * tuning constants.
 */

export interface HeroPhaseGeometry {
  phase1End: number;
  phase2Start: number;
  phase2End: number;
  paneATravel: number;
  /** The active curve. Touch and pointer differ, and so does B's flush point. */
  ease: (t: number) => number;
}

const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1);

/**
 * Pane B's vertical offset at progress `p`, in percent of frame height, using
 * the same expression as the scroll handler. 0 means exactly flush with the
 * frame; positive is still below it, negative is already leaving above.
 */
export function paneBOffsetPercent(p: number, geometry: HeroPhaseGeometry): number {
  const { phase1End, phase2Start, phase2End, paneATravel, ease } = geometry;
  const t1 = clamp01(p / phase1End);
  const t2 = clamp01((p - phase2Start) / (phase2End - phase2Start));
  return (1 - ease(t1)) * 100 - ease(t2) * paneATravel;
}

/**
 * The progress values at which each slideshow is in place: [A, B, C].
 *
 * B is found by bisection. That is sound because the offset is strictly
 * decreasing in p — both terms fall as p rises (ease is monotonic, so (1-e1)
 * shrinks and -e2 grows more negative) — so it crosses zero exactly once, from
 * +100 at p=0 to -paneATravel at p=1.
 */
export function resolveHeroSnapPoints(geometry: HeroPhaseGeometry): number[] {
  let low = 0;
  let high = 1;
  // 60 halvings takes the bracket far below any pixel this maps onto; the cost
  // is a few microseconds, once.
  for (let i = 0; i < 60; i += 1) {
    const mid = (low + high) / 2;
    if (paneBOffsetPercent(mid, geometry) > 0) low = mid;
    else high = mid;
  }
  return [0, (low + high) / 2, 1];
}

/**
 * The snap point one step from `fromProgress` in `direction`.
 *
 * Measured from where the GESTURE BEGAN, not where it ended — that is the whole
 * point. A hard flick can cross most of the runway before the finger lifts, and
 * stepping from the release position would let exactly the reported problem
 * through: one scroll carrying the visitor straight past a slideshow. Stepping
 * from the start position caps any single gesture at one slideshow.
 *
 * Returns null when there is nothing further in that direction, which is what
 * lets the visitor scroll out of the hero normally at either end.
 */
export function nextHeroSnapPoint(
  points: number[],
  fromProgress: number,
  direction: 1 | -1,
  epsilon = 0.02,
): number | null {
  if (direction === 1) {
    for (const point of points) if (point > fromProgress + epsilon) return point;
    return null;
  }
  for (let i = points.length - 1; i >= 0; i -= 1) {
    if (points[i] < fromProgress - epsilon) return points[i];
  }
  return null;
}
