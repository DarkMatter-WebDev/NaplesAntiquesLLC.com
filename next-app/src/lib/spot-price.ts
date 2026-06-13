import type { SpotData } from '@/types/product';

const FALLBACK_GOLD_SPOT = 3300;

export async function fetchSpotData(): Promise<SpotData> {
  try {
    const [goldRes, silverRes] = await Promise.all([
      fetch('https://api.gold-api.com/price/XAU/USD', { next: { revalidate: 300 } }),
      fetch('https://api.gold-api.com/price/XAG/USD', { next: { revalidate: 300 } }),
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
