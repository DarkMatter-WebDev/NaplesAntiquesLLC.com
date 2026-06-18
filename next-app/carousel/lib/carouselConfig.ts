// ============================================================
//  Carousel <-> Supabase mapping
//  ------------------------------------------------------------
//  Wired to the live "products" schema (text id, images JSON array,
//  price_label string, slug link). Edit here if columns ever change.
// ============================================================

/** Name of the jewelry-products table. */
export const PRODUCTS_TABLE = "products";

/**
 * Map the fields the carousel needs to the products table's columns.
 *  - id        : text primary key (slug-style)
 *  - images    : JSON array of image URLs/paths; the FIRST entry is used
 *  - name      : product title (caption + alt text)
 *  - priceLabel: preformatted price string (e.g. "$4,033.18"); often null
 *  - href      : product id used to build the product-page link
 *  - status    : availability; only "available" rows are shown
 */
export const PRODUCT_COLUMNS = {
  id: "id",
  images: "images",
  name: "title",
  priceLabel: "price_label",
  href: "id",
  status: "status",
} as const;

/** Only products with this status appear in the storefront carousel. */
export const AVAILABLE_STATUS = "available";

/**
 * The store admin's email. Used to gate the admin UI on the client.
 * MUST match the email hard-coded in sql/setup.sql's is_carousel_admin()
 * function — that DB policy is the real enforcement; this is for UX only.
 */
export const ADMIN_EMAIL = "rcman12589@aol.com";

/** Table that stores the admin's curated selection (created by setup.sql). */
export const SELECTION_TABLE = "carousel_selection";

/** Single-row table holding carousel display options (show price, background). */
export const SETTINGS_TABLE = "carousel_settings";

/** Default carousel background when the admin hasn't set one. */
export const DEFAULT_BG = "#ffffff";

/**
 * How many cards are on the ring at once (the windowed/infinite carousel).
 * Fewer = closer/more intimate; the rest of the list cycles through.
 */
export const DEFAULT_VISIBLE_COUNT = 6;
export const MIN_VISIBLE_COUNT = 3;
export const MAX_VISIBLE_COUNT = 12;

/**
 * Pick the primary image from the `images` array column.
 * Handles a real JSON array, a JSON-encoded string, or a bare string.
 * Returns "" if nothing usable is found.
 */
export function pickPrimaryImage(images: unknown): string {
  let arr: unknown = images;
  if (typeof arr === "string") {
    const s = arr.trim();
    if (s.startsWith("[")) {
      try {
        arr = JSON.parse(s);
      } catch {
        return s; // a bare URL string
      }
    } else {
      return s;
    }
  }
  if (Array.isArray(arr)) {
    const first = arr.find((u) => typeof u === "string" && u.trim());
    return typeof first === "string" ? first : "";
  }
  return "";
}

/** Build a product-page link from the product id. */
export function productHref(productId: string | null): string | null {
  if (!productId) return null;
  return `/shop/${productId}`;
}
