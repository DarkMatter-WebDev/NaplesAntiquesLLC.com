export function buildShopPaginationHref(
  pathname: string,
  searchParams: string | URLSearchParams,
  page: number,
): string {
  const params = new URLSearchParams(searchParams);
  if (page <= 1) {
    params.delete('page');
  } else {
    params.set('page', String(page));
  }
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export type ShopPaginationItem = number | 'ellipsis';

export function getShopPaginationItems(
  currentPage: number,
  totalPages: number,
): ShopPaginationItem[] {
  const safeTotal = Math.max(1, Math.floor(totalPages));
  const safeCurrent = Math.min(safeTotal, Math.max(1, Math.floor(currentPage)));

  if (safeTotal <= 7) {
    return Array.from({ length: safeTotal }, (_, index) => index + 1);
  }

  const visiblePages = new Set<number>([1, safeTotal, safeCurrent]);
  if (safeCurrent > 1) visiblePages.add(safeCurrent - 1);
  if (safeCurrent < safeTotal) visiblePages.add(safeCurrent + 1);

  const sortedPages = Array.from(visiblePages).sort((a, b) => a - b);
  const items: ShopPaginationItem[] = [];

  sortedPages.forEach((page, index) => {
    const previousPage = sortedPages[index - 1];
    if (previousPage !== undefined) {
      const gap = page - previousPage;
      if (gap === 2) {
        items.push(previousPage + 1);
      } else if (gap > 2) {
        items.push('ellipsis');
      }
    }
    items.push(page);
  });

  return items;
}
