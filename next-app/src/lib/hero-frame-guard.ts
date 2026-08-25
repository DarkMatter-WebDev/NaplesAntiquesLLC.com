/**
 * Frame-rate guard for the hero carousel (2026-08-24).
 *
 * The hero's 3D ring re-composites 8–10 large clipped layers every frame while
 * it spins. On a weak or software-rendered GPU that runs at 10–20fps no matter
 * what the JS does — the spin SPEED is irrelevant, because the transform
 * changes every frame at any speed. The only degraded mode that actually helps
 * is one where the ring stops moving, so the guard watches real frame cadence
 * and freezes the ring on machines that demonstrably cannot keep up.
 *
 * Design constraints, all deliberate:
 *
 * - **Warm-up.** The first seconds after load are janky on EVERY machine
 *   (AVIF decode, the reveal blur, hydration). Deltas inside `warmupMs` are
 *   ignored so a fast machine's load spike cannot trip the guard. The clock
 *   starts at the guard's FIRST frame — for hero panes B/C that is when they
 *   first become visible, not when they mount.
 * - **Median, not mean.** A single long frame (GC, tab switch-back) must not
 *   trip it. Only a sustained majority of slow frames moves the median.
 * - **Gap discard.** A delta above `gapMs` is a suspended page, a hidden pane
 *   or a paused loop — not a slow render. Recording it would poison the
 *   window with numbers that say nothing about GPU cost.
 * - **Threshold 40ms (~25fps).** A 30Hz display's honest cadence is ~33ms and
 *   must not trip; a genuinely struggling GPU sits at 50–100ms+. Mid-scroll
 *   crossings on healthy machines measured ~16.7ms median (CHANGELOG
 *   2026-08-06), so ordinary scroll load clears the bar with a wide margin.
 * - **One-way latch.** Once a machine proves it cannot keep up, the verdict is
 *   remembered for the session (`sessionStorage`) so later page views freeze
 *   immediately instead of re-janking through another measurement window.
 *
 * Debug override, usable on the affected machine itself:
 *   `?heroFreeze=1` — force the frozen presentation (preview what trips look like)
 *   `?heroFreeze=0` — disable the guard AND ignore the latch (A/B comparison)
 */

export type FrameGuardOptions = {
  /** Median frame time above this trips the guard. */
  thresholdMs?: number;
  /** Frames per evaluation window. */
  windowSize?: number;
  /** Deltas inside this many ms of the first frame are ignored. */
  warmupMs?: number;
  /** Deltas above this are gaps (hidden tab, paused loop), not slow frames. */
  gapMs?: number;
};

export type FrameGuard = {
  /**
   * Feed one requestAnimationFrame timestamp. Returns true once the guard has
   * tripped; the verdict is a latch and never reverts.
   */
  frame(now: number): boolean;
};

export function createFrameGuard({
  thresholdMs = 40,
  windowSize = 60,
  warmupMs = 4000,
  gapMs = 250,
}: FrameGuardOptions = {}): FrameGuard {
  let startedAt: number | null = null;
  let prev = 0;
  let deltas: number[] = [];
  let tripped = false;

  return {
    frame(now: number): boolean {
      if (tripped) return true;
      if (startedAt === null) {
        startedAt = now;
        prev = now;
        return false;
      }
      const delta = now - prev;
      prev = now;
      if (now - startedAt < warmupMs) return false;
      if (delta <= 0 || delta > gapMs) return false;
      deltas.push(delta);
      if (deltas.length < windowSize) return false;
      // Tumbling window: evaluate one full window, then start fresh. Sorting
      // 60 numbers once every ~window is negligible; doing it per frame is not.
      const sorted = [...deltas].sort((a, b) => a - b);
      const median = sorted[sorted.length >> 1];
      deltas = [];
      if (median > thresholdMs) tripped = true;
      return tripped;
    },
  };
}

export type HeroFreezeOverride = 'force' | 'off' | null;

/** Pure parser so the override is testable without a DOM. */
export function parseHeroFreezeOverride(search: string): HeroFreezeOverride {
  const value = new URLSearchParams(search).get('heroFreeze');
  if (value === '1') return 'force';
  if (value === '0') return 'off';
  return null;
}

const STORAGE_KEY = 'nej-hero-frozen';

// Module flag so a trip in one carousel instance is seen by the others (all
// three hero panes share this module) even if sessionStorage is unavailable.
let frozenFlag = false;

function currentOverride(): HeroFreezeOverride {
  if (typeof window === 'undefined') return null;
  return parseHeroFreezeOverride(window.location.search);
}

/** Should the hero rings render frozen right now? Safe to call every frame. */
export function isHeroFrozen(): boolean {
  const override = currentOverride();
  if (override === 'force') return true;
  if (override === 'off') return false;
  if (frozenFlag) return true;
  try {
    return typeof window !== 'undefined' && window.sessionStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/** Latch the frozen verdict for this session. */
export function freezeHero(): void {
  frozenFlag = true;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, '1');
  } catch {
    // Storage can be unavailable (private mode); the module flag still covers
    // this page view.
  }
}

/** `?heroFreeze=0` — measurement disabled for A/B comparison on a slow machine. */
export function isFrameGuardDisabled(): boolean {
  return currentOverride() === 'off';
}
