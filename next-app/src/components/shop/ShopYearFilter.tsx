'use client';

import { useCallback, useMemo, useState, type CSSProperties } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { getJewelryEras, getJewelryEraBoundaries, getJewelryEraLevels } from '@/lib/jewelry-eras';

const GOLD = '#735c00';

interface Props {
  locale: string;
  minYear: number;
  maxYear: number;
  selectedMin: number | null;
  selectedMax: number | null;
}

export default function ShopYearFilter({ locale, minYear, maxYear, selectedMin, selectedMax }: Props) {
  const isEs = locale === 'es';
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Drafts initialize from the committed selection. The parent remounts this
  // component (via key) whenever the committed range changes, so navigation
  // re-seeds the drafts without a state-syncing effect.
  const [draftMin, setDraftMin] = useState(selectedMin ?? minYear);
  const [draftMax, setDraftMax] = useState(selectedMax ?? maxYear);

  const span = Math.max(1, maxYear - minYear);
  const eras = useMemo(() => getJewelryEras(maxYear), [maxYear]);
  const levels = useMemo(() => getJewelryEraLevels(), []);
  const boundaries = useMemo(() => getJewelryEraBoundaries(maxYear), [maxYear]);

  const commit = useCallback(
    (min: number, max: number) => {
      const lo = Math.min(min, max);
      const hi = Math.max(min, max);
      const params = new URLSearchParams(searchParams.toString());
      if (lo <= minYear && hi >= maxYear) {
        params.delete('yearMin');
        params.delete('yearMax');
      } else {
        params.set('yearMin', String(lo));
        params.set('yearMax', String(hi));
      }
      params.delete('page');
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams, minYear, maxYear],
  );

  const selectEra = useCallback(
    (start: number, end: number) => {
      setDraftMin(start);
      setDraftMax(end);
      commit(start, end);
    },
    [commit],
  );

  const reset = useCallback(() => {
    setDraftMin(minYear);
    setDraftMax(maxYear);
    const params = new URLSearchParams(searchParams.toString());
    params.delete('yearMin');
    params.delete('yearMax');
    params.delete('page');
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }, [pathname, router, searchParams, minYear, maxYear]);

  const leftPct = ((draftMin - minYear) / span) * 100;
  const rightPct = 100 - ((draftMax - minYear) / span) * 100;
  const isFullSpan = draftMin <= minYear && draftMax >= maxYear;

  const trackStyle = {
    '--year-left': `${leftPct}%`,
    '--year-right': `${rightPct}%`,
  } as CSSProperties;

  return (
    <section
      className="shop-year-filter shop-entry-reveal shop-entry-reveal-hero"
      aria-label={isEs ? 'Filtrar por época o año' : 'Filter by era or year'}
    >
      <div className="shop-year-head">
        <span className="shop-year-title">{isEs ? 'Época / Año' : 'Era / Year'}</span>
        <span className="shop-year-readout">
          {isFullSpan
            ? (isEs ? 'Todos los años' : 'All years')
            : `${draftMin <= minYear ? `${minYear} ${isEs ? 'y antes' : '& earlier'}` : draftMin} – ${draftMax}`}
        </span>
        <button
          type="button"
          className="shop-year-reset"
          onClick={reset}
          disabled={isFullSpan}
          aria-label={isEs ? 'Restablecer rango de año' : 'Reset year range'}
        >
          {isEs ? 'Restablecer' : 'Reset'}
        </button>
      </div>

      <div className="shop-year-eras">
        {levels.map((level) => (
          <div key={level} className="shop-year-era-row">
            {eras
              .filter((era) => era.level === level)
              .map((era) => {
                const left = ((era.start - minYear) / span) * 100;
                const width = ((era.end - era.start) / span) * 100;
                const label = isEs ? era.labelEs : era.label;
                const isActive = selectedMin === era.start && selectedMax === era.end;
                const isOverlap = era.level > 1;
                return (
                  <button
                    type="button"
                    key={era.key}
                    className={`shop-year-era${isOverlap ? ' shop-year-era-overlap' : ''}${isActive ? ' shop-year-era-active' : ''}`}
                    style={{ left: `${left}%`, width: `${width}%` }}
                    aria-pressed={isActive}
                    aria-label={isEs
                      ? `Filtrar a ${label}, ${era.start} a ${era.end}`
                      : `Filter to ${label}, ${era.start} to ${era.end}`}
                    onClick={() => selectEra(era.start, era.end)}
                  >
                    {isOverlap && <span className="shop-year-era-cap shop-year-era-cap-start" aria-hidden="true" />}
                    <span className="shop-year-era-full">{label}</span>
                    <span className="shop-year-era-short">{isEs ? era.shortLabelEs : era.shortLabel}</span>
                    {isOverlap && <span className="shop-year-era-cap shop-year-era-cap-end" aria-hidden="true" />}
                  </button>
                );
              })}
          </div>
        ))}
      </div>

      <div className="shop-year-slider" style={trackStyle}>
        <input
          type="range"
          min={minYear}
          max={maxYear}
          step={1}
          value={draftMin}
          aria-label={isEs ? 'Año mínimo' : 'Minimum year'}
          onChange={(event) => setDraftMin(Math.min(Number(event.target.value), draftMax))}
          onMouseUp={() => commit(draftMin, draftMax)}
          onTouchEnd={() => commit(draftMin, draftMax)}
          onBlur={() => commit(draftMin, draftMax)}
        />
        <input
          type="range"
          min={minYear}
          max={maxYear}
          step={1}
          value={draftMax}
          aria-label={isEs ? 'Año máximo' : 'Maximum year'}
          onChange={(event) => setDraftMax(Math.max(Number(event.target.value), draftMin))}
          onMouseUp={() => commit(draftMin, draftMax)}
          onTouchEnd={() => commit(draftMin, draftMax)}
          onBlur={() => commit(draftMin, draftMax)}
        />
      </div>

      <div className="shop-year-ticks" aria-hidden="true">
        {boundaries.map((year, index) => {
          const left = ((year - minYear) / span) * 100;
          const edge = index === 0 ? 'start' : index === boundaries.length - 1 ? 'end' : 'mid';
          return (
            <span key={year} className={`shop-year-tick shop-year-tick-${edge}`} style={{ left: `${left}%` }}>
              <span className="shop-year-tick-mark" />
              <span className="shop-year-tick-label">
                {index === 0 ? (isEs ? `${year} y antes` : `${year} & earlier`) : year}
              </span>
            </span>
          );
        })}
      </div>

      <style>{`
        .shop-year-filter {
          margin: 0 0 1.5rem;
          padding: 1rem 1.15rem 0.85rem;
          border: 1px solid rgba(115, 92, 0, 0.22);
          border-radius: 10px;
          background: color-mix(in srgb, var(--color-primary) 3%, var(--color-background));
        }
        .shop-year-head {
          display: flex;
          align-items: baseline;
          gap: 0.85rem;
          margin-bottom: 0.65rem;
        }
        .shop-year-title {
          color: ${GOLD};
          font-family: var(--font-label);
          font-size: 0.62rem;
          font-weight: 800;
          letter-spacing: 0.18em;
          text-transform: uppercase;
        }
        .shop-year-readout {
          color: var(--color-on-surface);
          font-family: var(--font-label);
          font-size: 0.82rem;
          font-weight: 800;
          letter-spacing: 0.04em;
        }
        .shop-year-reset {
          margin-left: auto;
          color: var(--color-on-surface-variant);
          font-family: var(--font-label);
          font-size: 0.58rem;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          text-decoration: underline;
          text-underline-offset: 3px;
          cursor: pointer;
        }
        .shop-year-reset:disabled {
          opacity: 0.4;
          cursor: default;
          text-decoration: none;
        }
        .shop-year-eras {
          display: flex;
          flex-direction: column;
          gap: 0.22rem;
          margin-bottom: 0.1rem;
        }
        .shop-year-era-row {
          position: relative;
          height: 1.2rem;
        }
        .shop-year-era {
          position: absolute;
          top: 0;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 0.2rem;
          appearance: none;
          background: transparent;
          border: 0;
          border-left: 1px solid rgba(115, 92, 0, 0.18);
          overflow: hidden;
          white-space: nowrap;
          cursor: pointer;
          font: inherit;
        }
        .shop-year-era:last-child {
          border-right: 1px solid rgba(115, 92, 0, 0.18);
        }
        /* Overlapping bands are narrow, so let labels spill past their edges
           (each overlap row holds a single band with empty space around it). */
        .shop-year-era-overlap {
          overflow: visible;
        }
        .shop-year-era-cap {
          position: absolute;
          bottom: -0.3rem;
          width: 1px;
          height: 0.3rem;
          background: rgba(115, 92, 0, 0.4);
        }
        .shop-year-era-cap-start { left: -0.5px; }
        .shop-year-era-cap-end { right: -0.5px; }
        .shop-year-era-active .shop-year-era-cap {
          background: ${GOLD};
        }
        .shop-year-era-full,
        .shop-year-era-short {
          color: var(--color-on-surface-variant);
          font-family: var(--font-label);
          font-size: 0.56rem;
          font-weight: 800;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          transition: color 0.15s ease, transform 0.15s ease;
        }
        .shop-year-era-short { display: none; }
        .shop-year-era:hover .shop-year-era-full,
        .shop-year-era:hover .shop-year-era-short,
        .shop-year-era:focus-visible .shop-year-era-full,
        .shop-year-era:focus-visible .shop-year-era-short {
          color: ${GOLD};
          transform: translateY(-3px);
        }
        @media (prefers-reduced-motion: reduce) {
          .shop-year-era-full,
          .shop-year-era-short { transition: none; }
          .shop-year-era:hover .shop-year-era-full,
          .shop-year-era:hover .shop-year-era-short,
          .shop-year-era:focus-visible .shop-year-era-full,
          .shop-year-era:focus-visible .shop-year-era-short { transform: none; }
        }
        .shop-year-era-active .shop-year-era-full,
        .shop-year-era-active .shop-year-era-short {
          color: ${GOLD};
          text-decoration: underline;
          text-underline-offset: 2px;
        }
        .shop-year-era:focus-visible {
          outline: 2px solid rgba(115, 92, 0, 0.34);
          outline-offset: -2px;
          border-radius: 4px;
        }
        .shop-year-slider {
          position: relative;
          height: 1.7rem;
        }
        .shop-year-slider::before,
        .shop-year-slider::after {
          content: '';
          position: absolute;
          left: 0;
          right: 0;
          top: 50%;
          height: 0.28rem;
          border-radius: 999px;
          transform: translateY(-50%);
        }
        .shop-year-slider::before {
          background: rgba(115, 92, 0, 0.16);
        }
        .shop-year-slider::after {
          left: var(--year-left);
          right: var(--year-right);
          background: linear-gradient(90deg, #d8ad2d, #9c7608);
        }
        .shop-year-slider input[type='range'] {
          position: absolute;
          inset: 0;
          z-index: 2;
          width: 100%;
          height: 1.7rem;
          margin: 0;
          appearance: none;
          background: transparent;
          pointer-events: none;
        }
        .shop-year-slider input[type='range']::-webkit-slider-runnable-track {
          height: 0.28rem;
          background: transparent;
        }
        .shop-year-slider input[type='range']::-webkit-slider-thumb {
          width: 1rem;
          height: 1rem;
          margin-top: -0.36rem;
          appearance: none;
          border: 2px solid #fffdf7;
          border-radius: 999px;
          background: ${GOLD};
          box-shadow: 0 3px 10px rgba(42, 34, 12, 0.24);
          cursor: grab;
          pointer-events: auto;
        }
        .shop-year-slider input[type='range']::-moz-range-track {
          height: 0.28rem;
          background: transparent;
        }
        .shop-year-slider input[type='range']::-moz-range-thumb {
          width: 1rem;
          height: 1rem;
          border: 2px solid #fffdf7;
          border-radius: 999px;
          background: ${GOLD};
          box-shadow: 0 3px 10px rgba(42, 34, 12, 0.24);
          cursor: grab;
          pointer-events: auto;
        }
        .shop-year-slider input[type='range']:focus-visible::-webkit-slider-thumb {
          outline: 2px solid rgba(115, 92, 0, 0.34);
          outline-offset: 3px;
        }
        .shop-year-ticks {
          position: relative;
          height: 1.1rem;
          margin-top: 0.15rem;
        }
        .shop-year-tick {
          position: absolute;
          top: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          transform: translateX(-50%);
        }
        .shop-year-tick-start { transform: translateX(0); align-items: flex-start; }
        .shop-year-tick-end { transform: translateX(-100%); align-items: flex-end; }
        .shop-year-tick-mark {
          width: 1px;
          height: 0.3rem;
          background: rgba(115, 92, 0, 0.4);
        }
        .shop-year-tick-label {
          color: var(--color-on-surface-variant);
          font-family: var(--font-label);
          font-size: 0.56rem;
          font-weight: 700;
          letter-spacing: 0.02em;
          white-space: nowrap;
        }
        @media (max-width: 767px) {
          .shop-year-era-full { display: none; }
          .shop-year-era-short { display: inline; }
          .shop-year-tick-mid .shop-year-tick-label { display: none; }
        }
      `}</style>
    </section>
  );
}
