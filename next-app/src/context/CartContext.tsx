'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import CartDrawer from '@/components/cart/CartDrawer';

export interface CartItem {
  id: string;
  title: string;
  title_es: string | null;
  image: string | null;
  status: 'Available' | 'Sold';
  priceLabel: string;
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

  useEffect(() => {
    setItems(loadFromStorage());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(LS_KEY, JSON.stringify(items));
  }, [items, hydrated]);

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

  return (
    <CartContext.Provider value={{ items, count: items.length, isIn, add, remove, clear, drawerOpen, openDrawer, closeDrawer }}>
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
