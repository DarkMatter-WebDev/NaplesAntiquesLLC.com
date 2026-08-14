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
 *
 * ⚠️ **Everything except the front card is `fetchPriority: 'low'`, and that is
 * the whole point of this function.** Measured on production 2026-08-14: NINE
 * carousel images (157KB) were downloading BEFORE first contentful paint at
 * `auto` priority, alongside 258KB of scripts and 87KB of fonts — 533KB across
 * 30 requests ahead of the 21KB stylesheet that is the only thing actually
 * blocking paint. The stylesheet did not even begin until 336ms because it was
 * queued behind all of it.
 *
 * `low` keeps them EAGER (so the pop-in problem above stays solved — they still
 * download, and well before the ring rotates them forward) while telling the
 * browser to yield the network to the CSS, fonts and JS that gate the first
 * pixel. On a fast connection this is invisible; on a first-time mobile visitor
 * it was the difference between a blank white screen for seconds and a page.
 *
 * Do NOT restore `auto` here without re-measuring `KBbeforeFCP` on production.
 */
export function carouselImageLoading(slot: number, deferred = false) {
  return {
    loading: 'eager' as const,
    fetchPriority: slot === 0 && !deferred ? 'high' as const : 'low' as const,
  };
}

export function productThumbnailLoading(index: number) {
  return index === 0 ? 'eager' as const : 'lazy' as const;
}
