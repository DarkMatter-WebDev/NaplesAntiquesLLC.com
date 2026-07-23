'use client';

import { useEffect, useMemo, useState } from 'react';

interface Props {
  nextUpdateAt: number;
  locale: string;
  /** Render light text/border for placement on a dark (black) block. */
  onDark?: boolean;
}

export function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export default function PriceUpdateTicker({ nextUpdateAt, locale, onDark = false }: Props) {
  const [now, setNow] = useState<number | null>(null);
  const isEs = locale === 'es';

  useEffect(() => {
    const initialTimer = window.setTimeout(() => setNow(Date.now()), 0);
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
    };
  }, []);

  const updateTime = useMemo(() => (
    new Intl.DateTimeFormat(locale === 'es' ? 'es-US' : 'en-US', {
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(nextUpdateAt))
  ), [locale, nextUpdateAt]);

  return (
    <p
      className="mt-2 border-t pt-2 text-[0.62rem] font-semibold uppercase tracking-[0.12em]"
      style={{
        borderColor: onDark ? 'rgba(255,255,255,0.16)' : '#e2e6ec',
        color: onDark ? 'rgba(255,255,255,0.72)' : '#6b7280',
        fontFamily: 'var(--font-label)',
      }}
    >
      {now == null
        ? (isEs ? `Próxima actualización · ${updateTime}` : `Next update · ${updateTime}`)
        : isEs
          ? `Actualiza en ${formatRemaining(nextUpdateAt - now)} · ${updateTime}`
          : `Updates in ${formatRemaining(nextUpdateAt - now)} · ${updateTime}`}
    </p>
  );
}
