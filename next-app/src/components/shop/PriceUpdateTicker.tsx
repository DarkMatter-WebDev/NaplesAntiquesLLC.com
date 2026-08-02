'use client';

import { useEffect, useMemo, useState } from 'react';

interface Props {
  nextUpdateAt: number;
  /** When the spot quote powering this page was fetched (spotData.fetchedAt).
   *  Renders a "Last updated <time>" prefix when provided. */
  lastUpdatedAt?: number | null;
  locale: string;
  /** Render light text/border for placement on a dark (black) block. */
  onDark?: boolean;
}

const BUSINESS_TIME_ZONE = 'America/New_York';

export function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function formatUpdateTime(nextUpdateAt: number, locale: string): string {
  return new Intl.DateTimeFormat(locale === 'es' ? 'es-US' : 'en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: BUSINESS_TIME_ZONE,
  }).format(new Date(nextUpdateAt));
}

export default function PriceUpdateTicker({ nextUpdateAt, lastUpdatedAt = null, locale, onDark = false }: Props) {
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

  const updateTime = useMemo(
    () => formatUpdateTime(nextUpdateAt, locale),
    [locale, nextUpdateAt],
  );
  // "Last updated <time> · " prefix (owner request 2026-07-31): shows when the
  // current quote landed, ahead of the countdown to the next one. Same pinned
  // business time zone as the next-update time, so the pair can never disagree.
  const lastUpdatedPrefix = useMemo(() => {
    if (lastUpdatedAt == null) return '';
    const time = formatUpdateTime(lastUpdatedAt, locale);
    return isEs ? `Actualizado ${time} · ` : `Last updated ${time} · `;
  }, [isEs, lastUpdatedAt, locale]);

  return (
    <p
      className="price-update-ticker mt-2 border-t pt-2 font-semibold uppercase"
      style={{
        borderColor: onDark ? 'rgba(255,255,255,0.16)' : '#e2e6ec',
        color: onDark ? 'rgba(255,255,255,0.72)' : '#6b7280',
        fontFamily: 'var(--font-label)',
        fontSize: 'clamp(0.5rem, 2.5vw, 0.62rem)',
        letterSpacing: '0.1em',
        lineHeight: 1.35,
        whiteSpace: 'nowrap',
      }}
    >
      {now == null
        ? (isEs ? `${lastUpdatedPrefix}Próxima actualización · ${updateTime}` : `${lastUpdatedPrefix}Next update · ${updateTime}`)
        : isEs
          ? `${lastUpdatedPrefix}Actualiza en ${formatRemaining(nextUpdateAt - now)} · ${updateTime}`
          : `${lastUpdatedPrefix}Updates in ${formatRemaining(nextUpdateAt - now)} · ${updateTime}`}
    </p>
  );
}
