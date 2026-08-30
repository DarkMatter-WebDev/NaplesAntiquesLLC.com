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
 * Do NOT restore `auto` here for the WHOLE ring without re-measuring
 * `KBbeforeFCP` on production. The 2026-08-14 problem was NINE images at 157KB
 * all competing before first paint; the single exception below is not that.
 *
 * ⚠️ **Slot 1 is `auto`, not `low` (2026-08-30).** Priority was binary while
 * urgency is graduated: slot 1 sits adjacent to the front card and is among the
 * first to rotate into view, but it shared the `low` lane with slot 7, which is
 * not seen for far longer. Owner-reported symptom: on a cold load the second
 * card stayed BLANK until it had nearly rotated off-screen. HTTP/2 shares
 * bandwidth between same-priority streams, so a ~10KB image queued behind the
 * rest of the ring plus the script/font/CSS graph genuinely arrives late.
 *
 * `auto` — not `high` — is deliberate: `high` is the LCP lane and belongs to
 * the front card alone. This adds ONE image at default priority (~10-18KB at
 * the delivered width), which is not the 533KB-before-FCP regression the note
 * above exists to prevent.
 */
export function carouselImageLoading(slot: number, deferred = false) {
  const fetchPriority = deferred
    ? ('low' as const)
    : slot === 0
      ? ('high' as const)
      : slot === 1
        ? ('auto' as const)
        : ('low' as const);
  return { loading: 'eager' as const, fetchPriority };
}

export function productThumbnailLoading(index: number) {
  return index === 0 ? 'eager' as const : 'lazy' as const;
}
