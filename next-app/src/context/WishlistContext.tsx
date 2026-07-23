'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import WishlistDrawer from '@/components/wishlist/WishlistDrawer';
import { productImagePaddingForImage, type Product, type ProductStatus } from '@/types/product';
import { createClient } from '@/lib/supabase/client';
import { normalizeLegacyLocalImageUrl } from '@/lib/image-url';

export interface WishlistItem {
  id: string;
  title: string;
  title_es: string | null;
  image: string | null;
  image_padding?: Product['image_padding'];
  status: ProductStatus;
  price_mode: 'spot-multiplier' | 'manual';
  purity: number | null;
  weight_grams: number | null;
  pricing_multiplier: number | null;
  manual_price_label: string | null;
  sold_price?: number | null;
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

function normalizeWishlistItem(item: WishlistItem): WishlistItem {
  return { ...item, image: normalizeLegacyLocalImageUrl(item.image) };
}

function loadFromStorage(): WishlistItem[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as WishlistItem[]).map(normalizeWishlistItem) : [];
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
  const productIdsKey = items.map((item) => item.id).sort().join('|');

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

  useEffect(() => {
    if (!hydrated || !productIdsKey) return;
    const productIds = productIdsKey.split('|');
    let cancelled = false;

    async function loadCurrentProductState() {
      const { data } = await createClient()
        .from('products')
        .select('id, status, sold_price, image_padding, image_padding_by_image')
        .in('id', productIds);

      if (cancelled || !data) return;
      const productById = new Map(data.map((product) => [product.id, product]));

      setItems((current) => {
        let changed = false;
        const next = current.map((item) => {
          const product = productById.get(item.id);
          if (!product) return item;
          const imagePadding = item.image_padding === undefined
            ? productImagePaddingForImage(product.image_padding, product.image_padding_by_image, item.image, 0)
            : item.image_padding;
          const status = product.status as ProductStatus;
          const soldPrice = product.sold_price ?? null;
          if (imagePadding === item.image_padding && status === item.status && soldPrice === (item.sold_price ?? null)) return item;
          changed = true;
          return { ...item, image_padding: imagePadding, status, sold_price: soldPrice };
        });
        return changed ? next : current;
      });
    }

    void loadCurrentProductState();

    return () => {
      cancelled = true;
    };
  }, [hydrated, productIdsKey]);

  const isIn = useCallback((id: string) => items.some((i) => i.id === id), [items]);

  const toggle = useCallback((item: WishlistItem) => {
    const normalized = normalizeWishlistItem(item);
    setItems((prev) =>
      prev.some((i) => i.id === normalized.id)
        ? prev.filter((i) => i.id !== normalized.id)
        : [...prev, normalized]
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
