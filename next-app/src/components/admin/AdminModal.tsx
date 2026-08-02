'use client';

import { useEffect } from 'react';

/**
 * Standard admin pop-up window.
 *
 * Site convention (owner, 2026-08-01): editing surfaces open OVER the page in
 * a dialog — never by expanding new space inline underneath, which shoves the
 * rest of the page around. Use this wrapper for any admin flow that needs its
 * own working area (crop editors, previews, confirmations with content).
 *
 * Closes on backdrop click, the ✕ button, or Escape.
 */
export default function AdminModal({
  title,
  onClose,
  children,
  maxWidth = 'max-w-lg',
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Tailwind max-width class for the dialog panel. */
  maxWidth?: string;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto px-3 py-6 md:py-10"
      style={{ background: 'rgba(0,0,0,0.52)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={`w-full ${maxWidth} border bg-white`}
        style={{ borderColor: 'var(--color-outline-variant)' }}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className="flex items-center justify-between gap-3 border-b px-4 py-3"
          style={{ borderColor: 'var(--color-outline-variant)' }}
        >
          <h3
            className="text-[0.7rem] font-bold uppercase tracking-[0.2em]"
            style={{ fontFamily: 'var(--font-label)', color: 'var(--color-on-surface)' }}
          >
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="px-1 text-base font-bold"
            style={{ color: 'var(--color-on-surface-variant)' }}
          >
            ✕
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
