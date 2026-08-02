import type { SpotData } from '@/types/product';

const FALLBACK_GOLD_SPOT = 3300;

// Cap how long a cold render will wait on the upstream metal API. The values are
// cached for 300s, so only the first request per window pays the network cost —
// but a slow/cold upstream must never hold the whole page render hostage.
const SPOT_FETCH_TIMEOUT_MS = 1500;

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
