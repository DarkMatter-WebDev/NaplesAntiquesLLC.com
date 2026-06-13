import { NextResponse } from 'next/server';
import { fetchSpotData } from '@/lib/spot-price';

const GRAMS_PER_TROY_OZ = 31.1034768;

export async function GET() {
  const spot = await fetchSpotData();
  return NextResponse.json({
    ...spot,
    goldPerGram: spot.goldPerTroyOz / GRAMS_PER_TROY_OZ,
  });
}
