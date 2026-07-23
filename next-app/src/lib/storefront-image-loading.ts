export function carouselImageLoading(slot: number) {
  return {
    loading: 'eager' as const,
    fetchPriority: slot === 0 ? 'high' as const : 'auto' as const,
  };
}

export function productThumbnailLoading(index: number) {
  return index === 0 ? 'eager' as const : 'lazy' as const;
}
