'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { AppIcon } from '@/components/AppIcon';
import AdminModal from './AdminModal';

/**
 * Full-size prepared social-slide review. Both channel panels use this exact
 * viewer so the operator can move through the final ordered carousel without
 * closing back out to the thumbnail strip.
 */
export default function PreparedSlideViewer({
  slides,
  renditionIsCard,
  initialIndex,
  onClose,
}: {
  slides: string[];
  renditionIsCard?: boolean[];
  initialIndex: number;
  onClose: () => void;
}) {
  const boundedInitialIndex = Math.min(Math.max(initialIndex, 0), Math.max(slides.length - 1, 0));
  // This dialog mounts fresh for each thumbnail click, so its first index is
  // established once instead of synchronizing props through a second render.
  const [index, setIndex] = useState(() => boundedInitialIndex);
  const hasPrevious = index > 0;
  const hasNext = index < slides.length - 1;
  const isCard = Boolean(renditionIsCard?.[index]);
  const title = `Slide ${index + 1}${isCard ? ' · generated card' : ''}`;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' && hasPrevious) {
        event.preventDefault();
        setIndex((current) => current - 1);
      }
      if (event.key === 'ArrowRight' && hasNext) {
        event.preventDefault();
        setIndex((current) => current + 1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [hasNext, hasPrevious]);

  if (!slides[index]) return null;

  return (
    <AdminModal title={title} onClose={onClose} maxWidth="max-w-xl">
      <div className="relative w-full" style={{ aspectRatio: '1 / 1' }}>
        <Image
          src={slides[index]}
          alt={title}
          fill
          sizes="(max-width: 640px) 100vw, 576px"
          className="object-contain"
        />
        <button
          type="button"
          onClick={() => setIndex((current) => current - 1)}
          disabled={!hasPrevious}
          aria-label="Previous prepared slide"
          className="prepared-slide-viewer-nav left-3"
        >
          <AppIcon name="chevron_left" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => setIndex((current) => current + 1)}
          disabled={!hasNext}
          aria-label="Next prepared slide"
          className="prepared-slide-viewer-nav right-3"
        >
          <AppIcon name="chevron_right" aria-hidden="true" />
        </button>
      </div>
      <p
        className="mt-3 text-center text-[0.65rem] font-bold uppercase tracking-[0.16em]"
        style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}
      >
        {index + 1} of {slides.length} · use the arrows or left/right keys
      </p>
    </AdminModal>
  );
}
