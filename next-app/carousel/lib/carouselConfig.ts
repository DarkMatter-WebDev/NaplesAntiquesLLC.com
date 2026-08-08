// ============================================================
//  Carousel <-> Supabase mapping
//  ------------------------------------------------------------
//  Wired to the live "products" schema (text id, images JSON array,
//  price_label string, slug link). Edit here if columns ever change.
// ============================================================

import {
  productImagePaddingBackground,
  productImagePaddingForImage,
  type ProductImagePaddingMap,
} from "@/types/product";

/** Name of the jewelry-products table. */
export const PRODUCTS_TABLE = "products";

/**
 * Extra product columns a RANDOM draw must request so each drawn card can paint
 * its own backdrop colour. The curated query does not need them — a curated
 * entry stores its White/Black group on the selection row.
 */
export const PRODUCT_PADDING_COLUMNS = ["image_padding", "image_padding_by_image"] as const;

/**
 * The per-photo card background for a product row, taken from the product's own
 * stored image padding — the same field that paints its product-page
 * background.
 *
 * Why this exists: a curated lineup keeps its per-photo White/Black group on the
 * selection row, but a random draw has no such row, so every randomly drawn card
 * fell back to the global white. Behind a black-backdrop photo that painted
 * white letterbox bars, which is what exposed the `object-fit: contain` seam —
 * a photo whose bars are wider than the card's 1.5em corner radius shows its own
 * square corners, while a near-square photo gets clipped round. Matching the
 * padding to the photo makes the bars invisible again, so cards read as one
 * rounded tile whatever their aspect ratio.
 *
 * Returns null for an unset ('none') padding so the card still inherits the
 * global carousel colour.
 */
export function paddingBgForProductRow(
  row: Record<string, unknown>,
  imageUrl: string,
): string | null {
  const padding = productImagePaddingForImage(
    (row.image_padding as string | null) ?? null,
    (row.image_padding_by_image as ProductImagePaddingMap | null) ?? null,
    imageUrl,
    0,
  );
  if (padding === "none") return null;
  const resolved = productImagePaddingBackground(padding);
  // Anything that does not resolve to a literal colour (e.g. the surface-token
  // fallback) is treated as "no opinion" rather than pushed into a card style.
  return resolved.startsWith("#") ? resolved.toLowerCase() : null;
}

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

/** Products in either of these statuses may appear in the storefront carousel.
 *  Sold pieces are deliberately allowed (owner decision 2026-08-04): a sold
 *  card links to its product page, where the buyer sees it is sold. Draft,
 *  pending-payment, and archived stay private everywhere. */
export const AVAILABLE_STATUS = "available";
export const SOLD_STATUS = "sold";
export const PUBLIC_CAROUSEL_STATUSES: readonly string[] = [AVAILABLE_STATUS, SOLD_STATUS];

/** Which status list the admin picker/random draws work from. */
export type CarouselStatusFilter = "all" | "available" | "sold";

/** The statuses a filter admits (always within the public pair). */
export function statusesForFilter(filter: CarouselStatusFilter): readonly string[] {
  if (filter === "available") return [AVAILABLE_STATUS];
  if (filter === "sold") return [SOLD_STATUS];
  return PUBLIC_CAROUSEL_STATUSES;
}

/**
 * Top-level metal category column on products ('Gold' | 'Silver'). Drives the
 * random-lineup modes and the admin panel's random-sample preview.
 */
export const PRODUCT_CATEGORY_COLUMN = "category";

/** How a lineup's items are chosen. */
export type CarouselSelectionMode =
  | "manual"
  | "random_gold_jewelry"
  | "random_silver_jewelry"
  | "random_non_jewelry";

/** Products drawn into a random lineup on each server cache rebuild. */
export const RANDOM_LINEUP_SIZE = 10;

/** Candidate pool cap for a random draw (keeps the query bounded). */
export const RANDOM_CANDIDATE_LIMIT = 200;

/**
 * Coerce a stored mode value; anything unknown fails closed to manual. The two
 * legacy metal-only values are mapped forward rather than dropped, so a setting
 * saved before the jewelry/non-jewelry split keeps working instead of silently
 * reverting a random slideshow to its curated lineup.
 */
export function normalizeSelectionMode(value: unknown): CarouselSelectionMode {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "random_gold_jewelry" || normalized === "random_gold") return "random_gold_jewelry";
  if (normalized === "random_silver_jewelry" || normalized === "random_silver") return "random_silver_jewelry";
  if (normalized === "random_non_jewelry") return "random_non_jewelry";
  return "manual";
}

/**
 * What a random mode draws from: an optional products.category constraint plus
 * whether the piece must read as wearable jewelry. Non-jewelry deliberately
 * spans both metals — it is the catalog's "everything else" (coins, bullion,
 * flatware), which is not a metal-first choice.
 */
export type RandomLineupScope = {
  category: "Gold" | "Silver" | null;
  jewelry: boolean;
};

/** The draw scope for a random mode, or null when the lineup is manual. */
export function randomModeScope(mode: CarouselSelectionMode): RandomLineupScope | null {
  if (mode === "random_gold_jewelry") return { category: "Gold", jewelry: true };
  if (mode === "random_silver_jewelry") return { category: "Silver", jewelry: true };
  if (mode === "random_non_jewelry") return { category: null, jewelry: false };
  return null;
}

/**
 * There is deliberately NO ADMIN_EMAIL constant here.
 *
 * It used to hold the store owner's personal email address and was imported by
 * `carouselData.ts`'s `isCurrentUserAdmin()` — a client-side module — so the
 * literal address was compiled into the PUBLIC browser bundle, readable by
 * anyone viewing source and harvestable by spam bots (2026-08-08 audit).
 *
 * The client gate now reads `profiles.is_admin` instead, which is the signal
 * the rest of the app already uses. Do not reintroduce an email constant here:
 * anything in this folder reaches the browser.
 *
 * The email hard-coded in `sql/setup.sql`'s `is_carousel_admin()` is untouched
 * and remains the real enforcement — it lives in the database, not the bundle.
 */

/** Table that stores the admin's curated selection (created by setup.sql). */
export const SELECTION_TABLE = "carousel_selection";

/**
 * Twin table for the SECOND hero slideshow's lineup (the one the scroll
 * parallax reveals), created by sql/add-second-lineup.sql. A separate table —
 * not a slot column — so the live table's primary key is untouched and the
 * same product may appear in both lineups.
 */
export const ALT_SELECTION_TABLE = "carousel_selection_alt";

/**
 * Twin table for the THIRD hero slideshow's lineup, created by
 * sql/add-third-lineup.sql. Same twin-table reasoning as the second.
 */
export const THIRD_SELECTION_TABLE = "carousel_selection_third";

/** Which curated lineup a read/write targets. */
export type CarouselLineup = "primary" | "alt" | "third";

/** Every lineup, in the order the visitor scrolls through them. */
export const CAROUSEL_LINEUPS: readonly CarouselLineup[] = ["primary", "alt", "third"];

/** Resolve a lineup to its selection table. */
export function selectionTableFor(lineup: CarouselLineup): string {
  if (lineup === "alt") return ALT_SELECTION_TABLE;
  if (lineup === "third") return THIRD_SELECTION_TABLE;
  return SELECTION_TABLE;
}

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
