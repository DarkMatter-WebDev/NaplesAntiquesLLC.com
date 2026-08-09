/**
 * Which shop card is allowed to show a non-cover photo.
 *
 * A swiped card keeps the photo the visitor chose — indefinitely, not on a
 * timer. It returns to its cover only when a DIFFERENT card is swiped, so at
 * most one card in the grid is ever off its cover photo. That is why this lives
 * outside the component: no card can know another was swiped, and the grid
 * should not have to thread a "who is active" prop through every card to say so.
 *
 * Deliberately plain module state rather than React context: the notification
 * must reach sibling cards without re-rendering the whole grid on every swipe,
 * and only the one card that is actually off its cover does any work in
 * response.
 */

type ShopCardPhotoFocusListener = (focusedCardId: string) => void;

const listeners = new Set<ShopCardPhotoFocusListener>();
let focusedCardId: string | null = null;

export function subscribeShopCardPhotoFocus(listener: ShopCardPhotoFocusListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Hand focus to `cardId`, telling every other card to return to its cover.
 * Re-claiming by the same card is a no-op — a second swipe on the card that
 * already holds focus must not re-notify, or every swipe would cost a pass over
 * the whole grid for no change.
 */
export function claimShopCardPhotoFocus(cardId: string): void {
  if (focusedCardId === cardId) return;
  focusedCardId = cardId;
  // Iterate a copy: a listener may unsubscribe while being notified (a card
  // unmounting as the grid paginates), which would otherwise skip its neighbour.
  for (const listener of [...listeners]) listener(cardId);
}

export function getShopCardPhotoFocus(): string | null {
  return focusedCardId;
}

/** Test seam. Not used by the app — focus is released by claiming elsewhere. */
export function resetShopCardPhotoFocus(): void {
  focusedCardId = null;
  listeners.clear();
}
