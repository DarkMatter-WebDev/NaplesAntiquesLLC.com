'use client';

import { useState } from 'react';
import Image from 'next/image';

interface Props {
  images: string[];
  title: string;
}

export default function ProductImageGallery({ images, title }: Props) {
  const [active, setActive] = useState(0);

  if (!images.length) {
    return (
      <div
        className="aspect-square flex items-center justify-center text-6xl opacity-20"
        style={{ background: 'var(--color-surface-container)' }}
      >
        📷
      </div>
    );
  }

  const current = images[active];

  return (
    <div className="flex flex-col gap-3">
      {/* Main image */}
      <div
        className="relative aspect-square overflow-hidden"
        style={{ background: 'var(--color-surface-container)' }}
      >
        <Image
          src={current}
          alt={title}
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          className="object-cover object-center"
          priority
          unoptimized={current.startsWith('/assets/')}
        />
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {images.map((img, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActive(i)}
              className="relative w-16 h-16 overflow-hidden flex-shrink-0 border-2 transition-all"
              style={{
                borderColor: i === active ? 'var(--color-primary)' : 'var(--color-outline-variant)',
              }}
              aria-label={`View image ${i + 1}`}
            >
              <Image
                src={img}
                alt={`${title} ${i + 1}`}
                fill
                sizes="64px"
                className="object-cover object-center"
                unoptimized={img.startsWith('/assets/')}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
