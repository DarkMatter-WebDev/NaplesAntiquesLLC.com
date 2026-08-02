const SHOP_RETURN_STORAGE_KEY = 'nej:shop-return';

interface ShopReturnState {
  href: string;
  productId: string;
  restoreRequested: boolean;
  scrollY: number;
}

function readState(): ShopReturnState | null {
  if (typeof window === 'undefined') return null;

  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(SHOP_RETURN_STORAGE_KEY) ?? 'null') as Partial<ShopReturnState> | null;
    if (
      !parsed
      || typeof parsed.href !== 'string'
      || typeof parsed.productId !== 'string'
      || typeof parsed.restoreRequested !== 'boolean'
      || typeof parsed.scrollY !== 'number'
      || !Number.isFinite(parsed.scrollY)
    ) {
      return null;
    }

    return parsed as ShopReturnState;
  } catch {
    return null;
  }
}

function writeState(state: ShopReturnState) {
  try {
    window.sessionStorage.setItem(SHOP_RETURN_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Session storage is only an enhancement; a normal Back to Shop link still
    // works in private/restricted browser contexts.
  }
}

export function rememberShopReturn(productId: string) {
  if (typeof window === 'undefined') return;

  writeState({
    href: window.location.pathname + window.location.search,
    productId,
    restoreRequested: false,
    scrollY: Math.max(0, window.scrollY),
  });
}

export function requestShopReturn(productId: string, shopHref: string): string | null {
  const state = readState();
  if (
    !state
    || state.productId !== productId
    || (state.href !== shopHref && !state.href.startsWith(shopHref + '?'))
  ) {
    return null;
  }

  writeState({ ...state, restoreRequested: true });
  return state.href;
}

export function readRequestedShopReturn(): number | null {
  const state = readState();
  if (!state?.restoreRequested) return null;

  const currentHref = window.location.pathname + window.location.search;
  if (state.href !== currentHref) return null;

  return Math.max(0, state.scrollY);
}

export function clearRequestedShopReturn() {
  const state = readState();
  if (!state?.restoreRequested) return;

  const currentHref = window.location.pathname + window.location.search;
  if (state.href !== currentHref) return;

  try {
    window.sessionStorage.removeItem(SHOP_RETURN_STORAGE_KEY);
  } catch {
    // The scroll restoration has already been authorized by the stored state.
  }
}
