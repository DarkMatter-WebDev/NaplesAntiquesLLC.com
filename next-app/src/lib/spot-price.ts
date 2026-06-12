import type { SpotData } from '@/types/product';

const FALLBACK_GOLD_SPOT = 3300;

export async function fetchSpotData(): Promise<SpotData> {
  try {
    // Free endpoint — no auth required. Cache 5 min; API asks for ≥30s cache.
    const res = await fetch('https://api.gold-api.com/price/XAU/USD', {
      next: { revalidate: 300 },
    });

    if (res.ok) {
      const data = await res.json();
      if (data.price) {
        return {
          goldPerTroyOz: data.price as number,
          fetchedAt: Date.now(),
          source: 'api',
        };
      }
    }
  } catch {
    // fall through to fallback
  }

  return {
    goldPerTroyOz: FALLBACK_GOLD_SPOT,
    fetchedAt: Date.now(),
    source: 'fallback',
  };
}
