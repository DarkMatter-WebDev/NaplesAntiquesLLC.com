import { isProductPurchasable } from '@/types/product';

interface CartAvailabilityItem {
  status: string | null | undefined;
  stockQuantity?: number | string | null;
}

export function findUnavailableCartItems<T extends CartAvailabilityItem>(items: readonly T[]): T[] {
  return items.filter((item) => !isProductPurchasable(item.status, item.stockQuantity));
}
