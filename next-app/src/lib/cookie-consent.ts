/**
 * The cookie-notice consent gate — one owner for the storage key, the <html>
 * attribute, and every read/write of them.
 *
 * The banner is SERVER-rendered visible and hidden purely by an attribute on
 * <html> (see `components/legal/CookieNotice.tsx` for why — it is LCP-load-
 * bearing and must not wait for hydration). That makes the attribute a cache
 * of localStorage rather than state React owns, and it is written from four
 * places: the inline <head> script in `[locale]/layout.tsx`, the banner's
 * Accept button, the accept/reset controls on `/cookie-preferences`, and the
 * pre-paint re-stamp that survives a client-side language switch.
 *
 * ⚠️ The inline script CANNOT import these constants — it ships as a string of
 * JavaScript in the document head, before any module has loaded. Same for the
 * `html[data-nej-cookies-ok]` selector in `globals.css`. Both hardcode the
 * literals, so a rename here silently desynchronizes them and the banner comes
 * back for everyone who already accepted. `__tests__/cookie-consent-gate.test.ts`
 * pins those two copies against these constants; keep it passing rather than
 * updating the literals by hand.
 */

export const COOKIE_NOTICE_KEY = 'nej_cookie_notice_v1';
export const COOKIE_NOTICE_ATTR = 'data-nej-cookies-ok';
export const COOKIE_NOTICE_ACCEPTED = 'accepted';

type StorageLike = Pick<Storage, 'getItem'>;

type RootLike = {
  setAttribute(name: string, value: string): void;
};

/**
 * `window.localStorage` when it is reachable, otherwise null.
 *
 * Accessing the property itself throws in a browser with storage disabled —
 * not just reading a key — so this is deliberately more defensive than a
 * `typeof window` check alone.
 */
export function safeLocalStorage(): StorageLike | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Whether this visitor has recorded consent. Storage failures read as "no". */
export function hasStoredConsent(storage: StorageLike | null = safeLocalStorage()): boolean {
  if (!storage) return false;
  try {
    return storage.getItem(COOKIE_NOTICE_KEY) === COOKIE_NOTICE_ACCEPTED;
  } catch {
    return false;
  }
}

/**
 * Re-apply the gate from stored consent. Returns whether it stamped.
 *
 * ⚠️ ADDITIVE ONLY — it never removes the attribute. Removal is a deliberate
 * act (the reset control on `/cookie-preferences`), and a "sync both ways"
 * version of this would be able to UN-hide a banner the Accept handler just
 * hid in a browser with storage blocked, where the write cannot be read back.
 * localStorage stays the source of truth; the attribute is only its cache.
 */
export function applyStoredConsentGate(
  root: RootLike,
  storage: StorageLike | null = safeLocalStorage(),
): boolean {
  if (!hasStoredConsent(storage)) return false;
  root.setAttribute(COOKIE_NOTICE_ATTR, '');
  return true;
}
