'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

// Branded error boundary for public routes. Without this, a render-time throw
// falls back to Next's unstyled default error screen.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main
      style={{
        minHeight: '70vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '2rem',
        gap: '1rem',
        background: 'var(--color-background, #fafaf8)',
      }}
    >
      <p
        style={{
          fontSize: '0.68rem',
          fontWeight: 700,
          letterSpacing: '0.35em',
          textTransform: 'uppercase',
          color: '#735c00',
        }}
      >
        Naples Estate Jewelry
      </p>
      <h1 style={{ fontFamily: 'var(--font-headline, Georgia, serif)', fontSize: '2rem', margin: 0 }}>
        Something went wrong
      </h1>
      <p style={{ color: '#4d4635', maxWidth: '32rem' }}>
        Sorry — this page hit an unexpected error. Please try again, or call or text us at{' '}
        <a href="tel:2394048505" style={{ color: '#735c00', textDecoration: 'underline' }}>
          (239) 404-8505
        </a>
        .
      </p>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        <button
          type="button"
          onClick={() => {
            setIsRetrying(true);
            reset();
          }}
          disabled={isRetrying}
          aria-busy={isRetrying}
          className="gold-button"
        >
          {isRetrying ? 'Trying again...' : 'Try again'}
        </button>
        <Link href="/" className="gold-button">
          Home
        </Link>
      </div>
    </main>
  );
}
