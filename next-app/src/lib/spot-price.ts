import type { SpotData } from '@/types/product';

const FALLBACK_GOLD_SPOT = 5500;
const GRAMS_PER_TROY_OZ = 31.1034768;

export async function fetchSpotData(): Promise<SpotData> {
  const apiKey = process.env.GOLD_API_KEY;

  if (apiKey) {
    try {
      const res = await fetch('https://www.goldapi.io/api/XAU/USD', {
        headers: { 'x-access-token': apiKey, 'Content-Type': 'application/json' },
        next: { revalidate: 300 },
      });

      if (res.ok) {
        const data = await res.json();
        const goldPerTroyOz = data.price ?? data.close_yesterday;
        if (goldPerTroyOz) {
          return {
            goldPerTroyOz,
            fetchedAt: Date.now(),
            source: 'api',
          };
        }
      }
    } catch {
      // fall through to fallback
    }
  }

  return {
    goldPerTroyOz: FALLBACK_GOLD_SPOT,
    fetchedAt: Date.now(),
    source: 'fallback',
  };
}
