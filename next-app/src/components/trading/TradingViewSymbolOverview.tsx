'use client';
import { useEffect, useRef } from 'react';

interface Props {
  symbol: string;
  label: string;
  height?: number;
}

/**
 * TradingView "Symbol Overview" widget — the full-size chart with date-range
 * tabs (1D · 1M · 3M · 12M · 5Y · All). Used by /spot-prices, one per metal
 * (owner, 2026-09-06: "show each one larger"). `TradingViewMini` stays the
 * compact 12-month sparkline for the sell pages. Same embed pattern: the
 * script tag carries its JSON config as innerHTML and TradingView renders
 * into the container. Colours match the mini widget's gold trend line.
 */
export default function TradingViewSymbolOverview({ symbol, label, height = 380 }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js';
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbols: [[label, `${symbol}|12M`]],
      chartOnly: false,
      width: '100%',
      height,
      locale: 'en',
      colorTheme: 'dark',
      autosize: true,
      showVolume: false,
      showMA: false,
      hideDateRanges: false,
      hideMarketStatus: false,
      hideSymbolLogo: true,
      scalePosition: 'right',
      scaleMode: 'Normal',
      fontFamily: 'Hanken Grotesk, system-ui, sans-serif',
      fontSize: '11',
      noTimeScale: false,
      valuesTracking: '1',
      changeMode: 'price-and-percent',
      chartType: 'area',
      lineWidth: 2,
      lineColor: 'rgba(242, 202, 80, 1)',
      topColor: 'rgba(212, 175, 55, 0.25)',
      bottomColor: 'rgba(19, 19, 19, 0)',
      backgroundColor: 'rgba(26, 28, 28, 1)',
      gridLineColor: 'rgba(115, 92, 0, 0.18)',
      dateRanges: ['1d|1', '1m|30', '3m|60', '12m|1D', '60m|1W', 'all|1M'],
    });
    el.appendChild(script);
    return () => {
      if (el.contains(script)) el.removeChild(script);
    };
  }, [symbol, label, height]);

  return (
    <div style={{ height: `${height}px` }}>
      <div ref={ref} className="h-full w-full" />
    </div>
  );
}
