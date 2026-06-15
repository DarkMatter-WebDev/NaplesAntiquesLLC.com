'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import WishlistDrawer from '@/components/wishlist/WishlistDrawer';
import type { ProductStatus } from '@/types/product';

export interface WishlistItem {
  id: string;
  title: string;
  title_es: string | null;
  image: string | null;
  status: ProductStatus;
  price_mode: 'spot-multiplier' | 'manual';
  purity: number | null;
  weight_grams: number | null;
  pricing_multiplier: number | null;
  manual_price_label: string | null;
}

interface WishlistContextValue {
  items: WishlistItem[];
  count: number;
  isIn: (id: string) => boolean;
  toggle: (item: WishlistItem) => void;
  remove: (id: string) => void;
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
}

const WishlistContext = createContext<WishlistContextValue | null>(null);

const LS_KEY = 'nej-wishlist';

function loadFromStorage(): WishlistItem[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as WishlistItem[]) : [];
  } catch {
    return [];
  }
}

export function WishlistProvider({
  children,
  locale,
}: {
  children: React.ReactNode;
  locale: string;
}) {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Hydrate from localStorage once on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      setItems(loadFromStorage());
      setHydrated(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Persist whenever items change (after hydration)
  useEffect(() => {
    if (hydrated) {
      localStorage.setItem(LS_KEY, JSON.stringify(items));
    }
  }, [items, hydrated]);

  const isIn = useCallback((id: string) => items.some((i) => i.id === id), [items]);

  const toggle = useCallback((item: WishlistItem) => {
    setItems((prev) =>
      prev.some((i) => i.id === item.id)
        ? prev.filter((i) => i.id !== item.id)
        : [...prev, item]
    );
  }, []);

  const remove = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  return (
    <WishlistContext.Provider
      value={{
        items,
        count: items.length,
        isIn,
        toggle,
        remove,
        drawerOpen,
        openDrawer,
        closeDrawer,
      }}
    >
      {children}
      <WishlistDrawer locale={locale} />
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist must be used within WishlistProvider');
  return ctx;
}
