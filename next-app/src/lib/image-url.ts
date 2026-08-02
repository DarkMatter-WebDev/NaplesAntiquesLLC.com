export function normalizeLegacyLocalImageUrl(src: string | null | undefined): string | null {
  if (!src) return null;
  if (/^\/assets\/images\/shop\/[^?#]+\.png([?#].*)?$/i.test(src)) {
    return src.replace(/\.png(?=([?#].*)?$)/i, '.webp');
  }
  return src;
}
