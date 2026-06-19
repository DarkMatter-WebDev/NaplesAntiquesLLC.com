"use client";

// Storefront 3D carousel. Renders the admin-curated selection from Supabase.
// Background color and the price caption are controlled by the admin's saved
// settings (white background + images-only by default).
//
// Usage in a page:
//   import { Carousel } from "@/components/Carousel";
//   <Carousel />
//
// Override the saved settings (e.g. for previews):
//   <Carousel showPrice bg="#fff3ed" />
//
// Or pass items yourself to bypass the Supabase fetch entirely:
//   <Carousel items={myItems} showPrice bg="#ffffff" />

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Image from "next/image";
import styles from "./Carousel.module.css";
import {
  fetchSelectedItems,
  fetchSettings,
  type CarouselItem,
} from "../lib/carouselData";
import { DEFAULT_BG } from "../lib/carouselConfig";

type Props = {
  /** Provide items directly to bypass the Supabase fetch. */
  items?: CarouselItem[];
  /** Force the price caption on/off. If omitted, uses the saved setting. */
  showPrice?: boolean;
  /** Force the background color. If omitted, uses the saved setting. */
  bg?: string;
  /** Seconds per full rotation. */
  spin?: number;
  /** Base card width in em. */
  cardWidth?: number;
  /** Card aspect ratio, e.g. "1 / 1" (square, default) or "7 / 10" (portrait). */
  aspect?: string;
  /** Perspective in em (smaller = more extreme). */
  perspective?: number;
  /**
   * Max cards rendered on the ring at once. When the list is longer than this,
   * the carousel becomes a windowed/infinite ring: only this many cards exist
   * (on a tight, intimate radius), and the long list cycles through them as
   * cards pass the hidden back. Keeps the close "few-item" feel at any length.
   */
  visibleCount?: number;
  /**
   * Fires whenever a different card rotates into the front-CENTER position.
   * Used to switch the hero's TEXT theme (light/dark) to match the photo
   * currently behind the headline. Fires only when the centered color changes.
   * Keep the handler stable (useCallback) to avoid re-subscribing each render.
   */
  onFrontItemChange?: (item: CarouselItem, index: number) => void;
  /**
   * Fires every animation frame with a CSS background value for the hero. With
   * photos grouped into a white arc and a black arc, this is a horizontal
   * gradient whose seam sweeps across as a block boundary rotates through the
   * front — so the incoming color leads the incoming photo and the outgoing
   * color fades off the far side. Apply it imperatively (set element.style) to
   * avoid a React re-render every frame. Keep the handler stable.
   */
  onBackgroundChange?: (cssBackground: string) => void;
};

const WHITE = "#ffffff";

/** The per-photo background color, defaulting to white when unset. */
function itemBg(item: CarouselItem | undefined): string {
  return item?.bgColor || WHITE;
}

/**
 * Build the hero background for the current rotation.
 *  - Solid color when the visible front arc is all one block.
 *  - A horizontal gradient when a block boundary (seam) is crossing the front:
 *    each seam is projected to a screen x (via sin of its net angle) and the
 *    incoming color fills from the side the photos enter (right), so it leads
 *    the photo's arrival while the outgoing color fades off the left.
 */
function computeSweepBackground(
  items: CarouselItem[],
  ringAngle: number,
  fallbackColor: string,
): string {
  const n = items.length;
  if (n === 0) return fallbackColor;
  const step = 360 / n;
  const seams: { x: number; left: string; right: string }[] = [];
  for (let a = 0; a < n; a++) {
    const colorA = itemBg(items[a]);
    const colorB = itemBg(items[(a + 1) % n]);
    if (colorA === colorB) continue; // no boundary between these two
    let theta = ringAngle + (a + 0.5) * step;
    theta = (((theta % 360) + 540) % 360) - 180; // normalize to (-180, 180]
    const rad = (theta * Math.PI) / 180;
    if (Math.cos(rad) <= 0.04) continue; // seam is behind the front hemisphere
    const x = (1 - Math.sin(rad)) / 2; // 0 = left edge, 1 = right edge
    // item a sits at the lower angle (higher x = right); item a+1 to its left.
    seams.push({ x, right: colorA, left: colorB });
  }
  if (seams.length === 0) return fallbackColor;
  seams.sort((p, q) => p.x - q.x);
  const BAND = 0.13; // half-width of each seam's soft blend (screen fraction)
  const stops: string[] = [`${seams[0].left} 0%`];
  for (const seam of seams) {
    const lo = Math.max(0, seam.x - BAND) * 100;
    const hi = Math.min(1, seam.x + BAND) * 100;
    stops.push(`${seam.left} ${lo.toFixed(1)}%`);
    stops.push(`${seam.right} ${hi.toFixed(1)}%`);
  }
  stops.push(`${seams[seams.length - 1].right} 100%`);
  return `linear-gradient(to right, ${stops.join(", ")})`;
}

export function Carousel({
  items,
  showPrice,
  bg,
  spin = 32,
  cardWidth = 17.5,
  aspect = "1 / 1",
  perspective = 35,
  visibleCount = 6,
  onFrontItemChange,
  onBackgroundChange,
}: Props) {
  const ringRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  // Only the self-fetched (uncontrolled) items live in state. In controlled
  // mode the `items` prop is the source of truth and is read directly during
  // render below, so a later items change (e.g. async-loaded selection)
  // renders immediately without mirroring props into state via an effect.
  const [fetched, setFetched] = useState<CarouselItem[]>([]);
  const [priceOn, setPriceOn] = useState<boolean>(showPrice ?? false);
  const [bgColor, setBgColor] = useState<string>(bg ?? DEFAULT_BG);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (items) return; // controlled mode: caller supplies the items
    let cancelled = false;
    fetchSelectedItems()
      .then((rows) => !cancelled && setFetched(rows))
      .catch((e) => !cancelled && setError(e.message ?? String(e)));
    return () => {
      cancelled = true;
    };
  }, [items]);

  const data = items ?? fetched;

  useEffect(() => {
    // Skip the settings fetch only if BOTH are forced via props.
    if (showPrice !== undefined && bg !== undefined) return;
    let cancelled = false;
    fetchSettings()
      .then((s) => {
        if (cancelled) return;
        if (showPrice === undefined) setPriceOn(s.showPrice);
        if (bg === undefined) setBgColor(s.bgColor);
      })
      .catch(() => {}); // missing settings just means defaults
    return () => {
      cancelled = true;
    };
  }, [showPrice, bg]);

  // ---- Windowed / infinite ring --------------------------------------------
  // When the list is longer than `visibleCount`, only that many cards live on
  // the ring (a tight, intimate radius). Each slot's photo advances by
  // `effectiveVisible` as it passes the hidden back, so the whole list cycles
  // past the camera while the close few-item look stays constant.
  const effectiveVisible = Math.min(visibleCount, Math.max(data.length, 1));

  // slotItems[p] = index into `data` currently shown by ring slot p.
  const windowKey = `${data.length}:${effectiveVisible}`;
  const initialSlotItems = useMemo(() => {
    const len = Math.max(data.length, 1);
    return Array.from({ length: effectiveVisible }, (_, p) => p % len);
  }, [data.length, effectiveVisible]);

  const [slotItemsState, setSlotItemsState] = useState<{ key: string; items: number[] }>(() => ({
    key: windowKey,
    items: initialSlotItems,
  }));
  const slotItems = slotItemsState.key === windowKey ? slotItemsState.items : initialSlotItems;

  // Always-fresh refs so the single rAF loop below reads the latest values
  // without re-subscribing (re-subscribing mid-animation caused stale closures).
  const dataRef = useRef(data);
  const onFrontItemChangeRef = useRef(onFrontItemChange);
  const onBackgroundChangeRef = useRef(onBackgroundChange);
  const slotItemsRef = useRef(slotItems);
  const windowKeyRef = useRef(windowKey);
  const prevSlotAnglesRef = useRef<number[]>([]);
  const lastFrontKeyRef = useRef("");
  const startedAtRef = useRef(0);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    onFrontItemChangeRef.current = onFrontItemChange;
  }, [onFrontItemChange]);

  useEffect(() => {
    onBackgroundChangeRef.current = onBackgroundChange;
  }, [onBackgroundChange]);

  useEffect(() => {
    slotItemsRef.current = slotItems;
  }, [slotItems]);

  // Reset the imperative window state whenever the list length or visible count
  // changes. Render uses `initialSlotItems` immediately for the new key, so this
  // effect only resets refs used by the animation loop.
  useEffect(() => {
    windowKeyRef.current = windowKey;
    slotItemsRef.current = initialSlotItems;
    prevSlotAnglesRef.current = [];
    lastFrontKeyRef.current = "";
    startedAtRef.current = typeof performance !== "undefined" ? performance.now() : 0;
  }, [windowKey, initialSlotItems]);

  // Per-frame sample: advance the window as slots cross the hidden back, find
  // the centered card (text theme), and compute the swept background. Reads the
  // live CSS-animation clock so it stays in sync even under reduced-motion.
  const sample = useCallback(() => {
    const ring = ringRef.current;
    const items = dataRef.current;
    const slots = slotItemsRef.current;
    const onFront = onFrontItemChangeRef.current;
    const onBg = onBackgroundChangeRef.current;
    const n = items.length;
    const ev = slots.length;
    if (!ring || n === 0 || ev === 0) return;

    let ringAngle = 0;
    const anims = ring.getAnimations?.() ?? [];
    const anim = anims.find((a) => {
      const d = a.effect?.getComputedTiming?.().duration;
      return typeof d === "number" && d > 0;
    });
    if (anim && anim.currentTime != null) {
      const duration = Number(anim.effect!.getComputedTiming().duration);
      ringAngle = (((Number(anim.currentTime) % duration) + duration) % duration / duration) * 360;
    } else {
      const elapsed = (performance.now() - startedAtRef.current) / 1000;
      ringAngle = (elapsed / spin) * 360;
    }

    const step = 360 / ev;
    const cycle = n > ev;
    const prev = prevSlotAnglesRef.current;
    let best = 0;
    let bestScore = Infinity;
    let nextSlots: number[] | null = null;

    for (let p = 0; p < ev; p++) {
      let a = (ringAngle + p * step) % 360;
      if (a < 0) a += 360; // [0, 360)
      // Centered, front-facing slot (for the text theme).
      const rad = (a * Math.PI) / 180;
      if (Math.cos(rad) > 0) {
        const score = Math.abs(Math.sin(rad)); // 0 = dead center
        if (score < bestScore) {
          bestScore = score;
          best = p;
        }
      }
      // Advance this slot's photo as it crosses the hidden back (180deg).
      const pa = prev[p];
      if (cycle && pa != null && pa < 180 && a >= 180) {
        if (!nextSlots) nextSlots = slots.slice();
        nextSlots[p] = (slots[p] + ev) % n;
      }
      prev[p] = a;
    }

    if (nextSlots) {
      slotItemsRef.current = nextSlots;
      setSlotItemsState({ key: windowKeyRef.current, items: nextSlots });
    }

    const front = items[slots[best]];

    if (onFront) {
      const key = `${best}:${front?.bgColor ?? ""}`;
      if (key !== lastFrontKeyRef.current) {
        lastFrontKeyRef.current = key;
        onFront(front, best);
      }
    }
    if (onBg) {
      const visibleItems = slots.map((idx) => items[idx]);
      onBg(computeSweepBackground(visibleItems, ringAngle, itemBg(front)));
    }
  }, [spin]);

  // Continuous tracking while the animation runs — but only while the carousel
  // is on screen. An IntersectionObserver pauses the CSS spin and stops the rAF
  // loop when the hero scrolls out of view, so item count barely affects scroll
  // performance (and it saves battery). Both resume when it scrolls back in.
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    let raf = 0;
    let running = false;
    const loop = () => {
      sample();
      raf = requestAnimationFrame(loop);
    };
    const start = () => {
      if (running) return;
      running = true;
      raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        const visible = entry.isIntersecting;
        const ring = ringRef.current;
        if (ring) ring.style.animationPlayState = visible ? 'running' : 'paused';
        if (visible) start();
        else stop();
      },
      { threshold: 0 },
    );
    io.observe(scene);

    return () => {
      io.disconnect();
      stop();
    };
    // data.length so the observer (re)attaches when the ring first mounts (0 -> N).
  }, [sample, data.length]);

  // Fire immediately whenever the items change (initial paint, a recolor, or
  // reduced-motion where rAF may not advance) so the background is correct even
  // before the first animation frame.
  useEffect(() => {
    sample();
  }, [sample, data]);

  const showThePrice = showPrice ?? priceOn;
  const theBg = bg ?? bgColor;

  const sceneStyle = {
    "--spin": `${spin}s`,
    "--cardW": `${cardWidth}em`,
    "--ar": aspect,
    "--bg": theBg,
    "--perspective": `${perspective}em`,
  } as CSSProperties;

  if (error) {
    return (
      <div className={styles.scene} style={sceneStyle}>
        <p className={styles.empty}>Couldn’t load carousel: {error}</p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className={styles.scene} style={sceneStyle}>
        <p className={styles.empty}>No featured pieces selected yet.</p>
      </div>
    );
  }

  // The next photo each slot will show when it next crosses the back. Preload
  // these (off-screen) so they're decoded before they swap in — no pop-in.
  const preloadItems =
    data.length > effectiveVisible
      ? (() => {
          const seen = new Set(slotItems);
          const out: CarouselItem[] = [];
          for (const s of slotItems) {
            const next = (s + effectiveVisible) % data.length;
            if (!seen.has(next)) {
              seen.add(next);
              const item = data[next];
              if (item) out.push(item);
            }
          }
          return out;
        })()
      : [];

  return (
    <div ref={sceneRef} className={styles.scene} style={sceneStyle} aria-label="Featured jewelry carousel">
      <div ref={ringRef} className={styles.ring} style={{ "--n": effectiveVisible } as CSSProperties}>
        {slotItems.map((itemIndex, slot) => {
          const item = data[itemIndex];
          if (!item) return null;
          const inner = (
            <>
              <Image
                className={styles.img}
                src={item.imageUrl}
                alt={item.name}
                fill
                // Each card renders far smaller than the source; this tells the
                // optimizer the display size so it ships a right-sized AVIF/WebP
                // instead of the full-resolution original.
                sizes="(max-width: 640px) 80vw, (max-width: 1024px) 50vw, 35vw"
                quality={90}
                draggable={false}
              />
              {showThePrice && item.priceLabel && (
                <span className={styles.caption}>{item.priceLabel}</span>
              )}
            </>
          );

          // Keyed by SLOT (not item) so cards persist as their photo cycles —
          // the ring keeps spinning and only the image swaps (at the back).
          const cardStyle = {
            "--i": slot,
            ...(item.bgColor ? { "--card-bg": item.bgColor } : {}),
          } as CSSProperties;

          return item.href ? (
            <a
              key={slot}
              href={item.href}
              className={`${styles.card} ${styles.link}`}
              style={cardStyle}
            >
              {inner}
            </a>
          ) : (
            <div key={slot} className={styles.card} style={cardStyle}>
              {inner}
            </div>
          );
        })}
      </div>

      {/* Off-screen preloader: warms the upcoming images (same sizes/quality as
          the cards, so it fetches the exact same optimized variant). */}
      {preloadItems.length > 0 && (
        <div
          aria-hidden
          style={{ position: "fixed", left: "-9999px", top: 0, width: 1, height: 1, overflow: "hidden", opacity: 0, pointerEvents: "none" }}
        >
          {preloadItems.map((item) => (
            <span key={`preload-${item.id}`} style={{ position: "relative", display: "block", width: 48, height: 48 }}>
              <Image
                src={item.imageUrl}
                alt=""
                fill
                sizes="(max-width: 640px) 80vw, (max-width: 1024px) 50vw, 35vw"
                quality={90}
              />
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
