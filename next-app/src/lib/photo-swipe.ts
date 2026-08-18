/**
 * The horizontal photo-swipe gesture, shared by the shop cards and the product
 * gallery.
 *
 * ⚠️ **This exists because the two drifted apart and one of them was broken.**
 * The shop cards were fixed on 2026-08-09 after the owner reported "it tries to
 * scroll me up or down and doesn't easily trigger the swipe"; the product
 * gallery kept its original React `pointermove` implementation and reproduced
 * the same fault for another eight days. Keep both surfaces on this module so a
 * fix lands in both at once.
 *
 * ## Why pointer events cannot do this job
 *
 * By spec, `preventDefault()` on `pointermove` does nothing to scrolling. The
 * only levers are the `touch-action` CSS property and a **non-passive**
 * `touchmove` listener. Both frames set `touch-action: pan-y pinch-zoom`, which
 * hands vertical panning to the browser and keeps horizontal for us — so the
 * browser never steals a purely sideways drag, and the whole problem is what
 * happens to a drag that is *mostly* sideways.
 *
 * Once the browser decides a gesture is a scroll it fires `pointercancel` and
 * `touchmove` stops being cancelable; the swipe is then unrecoverable. Every
 * threshold below is chosen to decide BEFORE that point.
 *
 * ## The arbitration, and why it is asymmetric
 *
 * The previous rule picked an axis at one shared slop with a mild lean toward
 * horizontal (`|dx| * 1.25 >= |dy|`). That still lost the common case: a thumb
 * swiping across a phone arcs, so the first few pixels are often more DOWN than
 * across. With a symmetric test those pixels locked the gesture to 'v' and the
 * swipe was dead before the finger had gone anywhere sideways.
 *
 * So the two axes now need different amounts of evidence:
 *
 * - **Horizontal locks eagerly** — 4px of sideways travel, with vertical drift
 *   allowed up to 1.6x that (a ~58 degree cone). Cheap to trigger, because
 *   triggering it is the thing that was failing.
 * - **Vertical locks reluctantly** — 12px, three times as far. Below that the
 *   gesture stays UNDECIDED rather than committing to a scroll.
 * - **Undecided means hands off.** We never call `preventDefault` while
 *   undecided, so a real page scroll behaves exactly as it always did; the
 *   browser is free to start scrolling and we simply stop competing for it.
 *
 * The undecided window is what rescues the arcing thumb: 2px across and 5px
 * down used to be a lost swipe, and now it is merely "not yet known", still
 * able to resolve horizontal once the finger commits sideways.
 *
 * ⚠️ If the browser has already claimed the gesture we concede immediately —
 * see the `cancelable` check in the move handler. Without it a late horizontal
 * lock could advance a photo while the page was mid-scroll.
 */

export type SwipeAxis = 'h' | 'v';
export type SwipeDirection = 'next' | 'previous';

/**
 * Sideways travel that arms a swipe. Small on purpose: it has to beat the
 * browser's own scroll detection, and horizontal movement is never contested by
 * `touch-action: pan-y` anyway.
 */
export const HORIZONTAL_TRIGGER_PX = 4;

/**
 * Vertical travel before the gesture is conceded to the page as a scroll.
 * Deliberately 3x the horizontal trigger — see the asymmetry note above.
 * Lowering it toward the horizontal trigger reinstates the original bug.
 */
export const VERTICAL_TRIGGER_PX = 12;

/**
 * Vertical drift tolerated relative to sideways travel while locking
 * horizontal. 1 would be a square 45-degree split; 1.6 is a ~58 degree cone.
 * ⚠️ Raising this much further starts stealing genuine page scrolls that begin
 * on a photo, and photos are most of the scrollable surface of the shop grid.
 */
export const HORIZONTAL_LOCK_BIAS = 1.6;

/** Minimum swipe distance to advance a photo: a floor, then a share of width. */
export const SWIPE_ADVANCE_MIN_PX = 20;
export const SWIPE_ADVANCE_WIDTH_SHARE = 0.08;

/**
 * Which axis, if either, this movement has committed to.
 * `null` means keep watching — explicitly NOT "vertical".
 */
export function resolveSwipeAxis(dx: number, dy: number): SwipeAxis | null {
  const across = Math.abs(dx);
  const down = Math.abs(dy);
  if (across >= HORIZONTAL_TRIGGER_PX && across * HORIZONTAL_LOCK_BIAS >= down) return 'h';
  if (down >= VERTICAL_TRIGGER_PX && down > across * HORIZONTAL_LOCK_BIAS) return 'v';
  return null;
}

/**
 * How far a locked horizontal swipe must travel to actually change the photo.
 * Proportional with a floor, so the gesture feels the same on a 166px card as
 * on a 576px tablet gallery.
 */
export function swipeAdvanceThresholdPx(frameWidth: number): number {
  return Math.max(SWIPE_ADVANCE_MIN_PX, frameWidth * SWIPE_ADVANCE_WIDTH_SHARE);
}

export interface PhotoSwipeHandlers {
  /** A finger landed. Use for "this is a touch device" state. */
  onGestureStart?: () => void;
  /** Would a swipe this way actually change the photo? */
  canSwipe?: (direction: SwipeDirection) => boolean;
  /** Commit the photo change. */
  onSwipe: (direction: SwipeDirection) => void;
  /**
   * The finger MOVED before lifting, in any direction and by any amount that
   * counts as a drag. Both callers use this to swallow the click the browser
   * fires afterwards — a drag is not a tap, and to a click handler the two are
   * indistinguishable.
   */
  onDragged?: () => void;
}

/**
 * Wire the gesture to a frame. Returns a cleanup function.
 *
 * `getHandlers` is called fresh on each event rather than captured, so the
 * listeners never need re-binding when React state changes — re-binding a
 * non-passive listener mid-gesture would drop it.
 */
export function attachPhotoSwipe(
  frame: HTMLElement,
  getHandlers: () => PhotoSwipeHandlers,
): () => void {
  let startX = 0;
  let startY = 0;
  let axis: SwipeAxis | null = null;
  let moved = false;
  let tracking = false;

  const onTouchStart = (event: TouchEvent) => {
    // A second finger is a pinch-zoom, not a swipe.
    if (event.touches.length !== 1) {
      tracking = false;
      return;
    }
    const touch = event.touches[0];
    startX = touch.clientX;
    startY = touch.clientY;
    axis = null;
    moved = false;
    tracking = true;
    getHandlers().onGestureStart?.();
  };

  const onTouchMove = (event: TouchEvent) => {
    if (!tracking || event.touches.length !== 1) return;
    const touch = event.touches[0];
    const dx = touch.clientX - startX;
    const dy = touch.clientY - startY;

    if (Math.hypot(dx, dy) > HORIZONTAL_TRIGGER_PX) moved = true;

    if (axis === null) {
      // The browser has already committed this gesture to scrolling, so there
      // is nothing left to claim. Concede rather than locking horizontal later
      // and advancing a photo mid-scroll.
      if (!event.cancelable) {
        axis = 'v';
        return;
      }
      axis = resolveSwipeAxis(dx, dy);
    }

    // Claiming the gesture. Undecided deliberately does nothing: the page must
    // stay free to scroll until we know this is a swipe.
    if (axis === 'h' && event.cancelable) event.preventDefault();
  };

  const onTouchEnd = (event: TouchEvent) => {
    if (!tracking) return;
    tracking = false;
    const handlers = getHandlers();
    const lockedHorizontal = axis === 'h';
    axis = null;

    // ANY drag swallows the click that follows — including a horizontal one too
    // short to advance. The visitor dragged; they did not tap.
    if (moved) handlers.onDragged?.();
    if (!lockedHorizontal) return;

    const touch = event.changedTouches[0];
    if (!touch) return;
    const dx = touch.clientX - startX;
    if (Math.abs(dx) < swipeAdvanceThresholdPx(frame.getBoundingClientRect().width)) return;

    const direction: SwipeDirection = dx < 0 ? 'next' : 'previous';
    if (handlers.canSwipe && !handlers.canSwipe(direction)) return;
    handlers.onSwipe(direction);
  };

  const onTouchCancel = () => {
    tracking = false;
    axis = null;
  };

  frame.addEventListener('touchstart', onTouchStart, { passive: true });
  // The one listener that MUST be non-passive — a passive listener may not
  // preventDefault, which is the entire mechanism here.
  frame.addEventListener('touchmove', onTouchMove, { passive: false });
  frame.addEventListener('touchend', onTouchEnd, { passive: true });
  frame.addEventListener('touchcancel', onTouchCancel, { passive: true });

  return () => {
    frame.removeEventListener('touchstart', onTouchStart);
    frame.removeEventListener('touchmove', onTouchMove);
    frame.removeEventListener('touchend', onTouchEnd);
    frame.removeEventListener('touchcancel', onTouchCancel);
  };
}
