export const PRODUCT_IMAGES_BUCKET = 'product-images';
export const PRODUCT_IMAGES_PREFIX = 'products';

const STORAGE_MARKERS = [
  `/storage/v1/object/public/${PRODUCT_IMAGES_BUCKET}/`,
  `/storage/v1/object/sign/${PRODUCT_IMAGES_BUCKET}/`,
];

export function getProductImageStoragePath(value: string | null | undefined): string | null {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  if (raw.startsWith(`${PRODUCT_IMAGES_PREFIX}/`)) {
    return raw.split('?')[0];
  }

  const marker = STORAGE_MARKERS.find((item) => raw.includes(item));
  if (!marker) return null;
  const path = raw.slice(raw.indexOf(marker) + marker.length).split('?')[0];
  return path ? decodeURIComponent(path) : null;
}

export function uniqueProductImageStoragePaths(values: Iterable<string | null | undefined>): string[] {
  return Array.from(
    new Set(
      Array.from(values)
        .map((value) => getProductImageStoragePath(value))
        .filter((value): value is string => Boolean(value)),
    ),
  );
}
