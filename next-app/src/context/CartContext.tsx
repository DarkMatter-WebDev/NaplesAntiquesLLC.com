'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import CartDrawer from '@/components/cart/CartDrawer';
import { productImagePaddingForImage, type Product, type ProductStatus } from '@/types/product';
import { createClient } from '@/lib/supabase/client';

export interface CartItem {
  id: string;
  title: string;
  title_es: string | null;
  description?: string | null;
  description_es?: string | null;
  public_notes?: string | null;
  image: string | null;
  image_padding?: Product['image_padding'];
  status: ProductStatus;
  priceLabel: string;
  category?: Product['category'];
  metal_type?: string | null;
  metal_variant?: string | null;
  purity?: number | null;
  weight_grams?: number | null;
  gram_weight?: number | null;
  product_type?: string | null;
  jewelry_type?: string | null;
  chain_type?: string | null;
  length?: string | null;
  brand?: string | null;
  tags?: string[];
  tags_es?: string[];
  gender?: string | null;
}

interface CartContextValue {
  items: CartItem[];
  count: number;
  isIn: (id: string) => boolean;
  add: (item: CartItem) => void;
  remove: (id: string) => void;
  clear: () => void;
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  recentlyAdded: string | null;
  notifyAdded: (title: string) => void;
  dismissAdded: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

const LS_KEY = 'nej-cart';

function loadFromStorage(): CartItem[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch {
    return [];
  }
}

export function CartProvider({
  children,
  locale,
}: {
  children: React.ReactNode;
  locale: string;
}) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [recentlyAdded, setRecentlyAdded] = useState<string | null>(null);
  const addedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setItems(loadFromStorage());
      setHydrated(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(LS_KEY, JSON.stringify(items));
  }, [items, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    const missingPaddingIds = items
      .filter((item) => item.image && item.image_padding === undefined)
      .map((item) => item.id);
    if (missingPaddingIds.length === 0) return;

    let cancelled = false;

    async function loadImagePadding() {
      const supabase = createClient();
      const { data } = await supabase
        .from('products')
        .select('id, image_padding, image_padding_by_image')
        .in('id', missingPaddingIds);

      if (cancelled || !data) return;
      const productById = new Map(data.map((product) => [product.id, product]));

      setItems((current) => {
        let changed = false;
        const next = current.map((item) => {
          const product = productById.get(item.id);
          if (item.image_padding !== undefined || !product) return item;
          changed = true;
          return { ...item, image_padding: productImagePaddingForImage(product.image_padding, product.image_padding_by_image, item.image, 0) };
        });
        return changed ? next : current;
      });
    }

    loadImagePadding();

    return () => {
      cancelled = true;
    };
  }, [hydrated, items]);

  const isIn = useCallback((id: string) => items.some((i) => i.id === id), [items]);

  const add = useCallback((item: CartItem) => {
    setItems((prev) => prev.some((i) => i.id === item.id) ? prev : [...prev, item]);
  }, []);

  const remove = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const dismissAdded = useCallback(() => {
    if (addedTimer.current) clearTimeout(addedTimer.current);
    setRecentlyAdded(null);
  }, []);

  const notifyAdded = useCallback((title: string) => {
    if (addedTimer.current) clearTimeout(addedTimer.current);
    setRecentlyAdded(title);
    addedTimer.current = setTimeout(() => setRecentlyAdded(null), 3500);
  }, []);

  return (
    <CartContext.Provider value={{ items, count: items.length, isIn, add, remove, clear, drawerOpen, openDrawer, closeDrawer, recentlyAdded, notifyAdded, dismissAdded }}>
      {children}
      <CartDrawer locale={locale} />
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
