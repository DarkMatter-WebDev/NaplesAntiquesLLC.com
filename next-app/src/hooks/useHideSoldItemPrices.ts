'use client';

import { useEffect, useState } from 'react';
import { SHOP_SETTINGS_TABLE } from '@/lib/shop-settings';
import { createClient } from '@/lib/supabase/client';

let cachedValue: boolean | undefined;
let pendingRead: Promise<boolean> | null = null;

function loadHideSoldItemPrices(): Promise<boolean> {
  if (cachedValue !== undefined) return Promise.resolve(cachedValue);
  if (pendingRead) return pendingRead;

  const read = (async () => {
    try {
      const { data, error } = await createClient()
        .from(SHOP_SETTINGS_TABLE)
        .select('hide_sold_item_prices')
        .eq('id', true)
        .maybeSingle();
      const value = error ? false : data?.hide_sold_item_prices ?? false;
      cachedValue = value;
      return value;
    } catch {
      cachedValue = false;
      return false;
    } finally {
      pendingRead = null;
    }
  })();
  pendingRead = read;
  return read;
}

export function useHideSoldItemPrices(enabled = true): boolean {
  const [hideSoldItemPrices, setHideSoldItemPrices] = useState(() => cachedValue ?? false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void loadHideSoldItemPrices().then((value) => {
      if (!cancelled) setHideSoldItemPrices(value);
    });
    return () => { cancelled = true; };
  }, [enabled]);

  return hideSoldItemPrices;
}
