/**
 * Loading hints for one carousel ring card.
 *
 * `loading` stays EAGER even for an offscreen pane, deliberately. These cards
 * are 3D-transformed inside a pinned, overflow-hidden frame, so the browser's
 * lazy-loading viewport test does not describe whether they are about to be
 * seen — and a card that decodes as it rotates in shows exactly the pop-in the
 * hero is built to avoid.
 *
 * `deferred` marks a slideshow that is mounted but parked offscreen (hero panes
 * B and C at rest). Those must not claim `fetchPriority: high`: it is the LCP
 * lane, and an offscreen pane competing for it delays the hero image the
 * visitor is actually looking at. They still load, just not ahead of it.
 */
export function carouselImageLoading(slot: number, deferred = false) {
  return {
    loading: 'eager' as const,
    fetchPriority: slot === 0 && !deferred ? 'high' as const : 'auto' as const,
  };
}

export function productThumbnailLoading(index: number) {
  return index === 0 ? 'eager' as const : 'lazy' as const;
}
