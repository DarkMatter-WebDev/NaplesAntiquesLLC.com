import type { SpotData } from '@/types/product';

const FALLBACK_GOLD_SPOT = 3300;

// Cap how long a cold render will wait on the upstream metal API. The values are
// cached for 300s, so only the first request per window pays the network cost —
// but a slow/cold upstream must never hold the whole page render hostage.
const SPOT_FETCH_TIMEOUT_MS = 1500;

export const GRAMS_PER_TROY_OZ = 31.1034768;
export const GRAMS_PER_PENNYWEIGHT = 1.55517384;

export interface MetalSpotPrices {
  gold: number | null;
  silver: number | null;
  platinum: number | null;
  palladium: number | null;
  /** ISO timestamp from the feed (the gold quote), null on fallback. */
  updatedAt: string | null;
  source: 'api' | 'fallback';
}

const METAL_SYMBOLS = { gold: 'XAU', silver: 'XAG', platinum: 'XPT', palladium: 'XPD' } as const;

/**
 * All four metals for /spot-prices (2026-09-06). Separate from
 * `fetchSpotData()` on purpose: that one feeds product pricing and carries a
 * hard gold fallback so a checkout never sees null; a live-prices page must
 * NOT print a fallback number as if it were live, so this returns nulls and
 * `source: 'fallback'` instead and the page says the feed is unavailable.
 * Same endpoint, cache window and timeout as the pricing fetch.
 */
export async function fetchMetalSpotPrices(): Promise<MetalSpotPrices> {
  try {
    const entries = await Promise.all(
      (Object.keys(METAL_SYMBOLS) as Array<keyof typeof METAL_SYMBOLS>).map(async (key) => {
        const res = await fetch(`https://api.gold-api.com/price/${METAL_SYMBOLS[key]}/USD`, {
          next: { revalidate: 300 },
          signal: AbortSignal.timeout(SPOT_FETCH_TIMEOUT_MS),
        });
        const data = res.ok ? await res.json() : null;
        const price = typeof data?.price === 'number' && data.price > 0 ? (data.price as number) : null;
        return [key, price, typeof data?.updatedAt === 'string' ? (data.updatedAt as string) : null] as const;
      }),
    );
    const byKey = Object.fromEntries(entries.map(([k, v]) => [k, v])) as Record<keyof typeof METAL_SYMBOLS, number | null>;
    if (byKey.gold != null) {
      const goldEntry = entries.find(([k]) => k === 'gold');
      return { ...byKey, updatedAt: goldEntry?.[2] ?? null, source: 'api' };
    }
  } catch {
    // fall through
  }
  return { gold: null, silver: null, platinum: null, palladium: null, updatedAt: null, source: 'fallback' };
}

export async function fetchSpotData(): Promise<SpotData> {
  try {
    const [goldRes, silverRes] = await Promise.all([
      fetch('https://api.gold-api.com/price/XAU/USD', {
        next: { revalidate: 300 },
        signal: AbortSignal.timeout(SPOT_FETCH_TIMEOUT_MS),
      }),
      fetch('https://api.gold-api.com/price/XAG/USD', {
        next: { revalidate: 300 },
        signal: AbortSignal.timeout(SPOT_FETCH_TIMEOUT_MS),
      }),
    ]);

    const goldData = goldRes.ok ? await goldRes.json() : null;
    const silverData = silverRes.ok ? await silverRes.json() : null;

    if (goldData?.price) {
      return {
        goldPerTroyOz: goldData.price as number,
        silverPerTroyOz: silverData?.price ?? null,
        fetchedAt: Date.now(),
        source: 'api',
      };
    }
  } catch {
    // fall through to fallback
  }

  return {
    goldPerTroyOz: FALLBACK_GOLD_SPOT,
    silverPerTroyOz: null,
    fetchedAt: Date.now(),
    source: 'fallback',
  };
}
