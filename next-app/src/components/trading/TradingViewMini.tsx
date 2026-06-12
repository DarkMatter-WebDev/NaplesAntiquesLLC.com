'use client';
import { useEffect, useRef } from 'react';

interface Props {
  symbol: string;
  height?: number;
  transparent?: boolean;
}

export default function TradingViewMini({ symbol, height = 220, transparent = true }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const script = document.createElement('script');
    script.src =
      'https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js';
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbol,
      width: '100%',
      height,
      locale: 'en',
      dateRange: '12M',
      colorTheme: 'dark',
      trendLineColor: 'rgba(242, 202, 80, 1)',
      underLineColor: 'rgba(212, 175, 55, 0.15)',
      underLineBottomColor: 'rgba(19, 19, 19, 0)',
      isTransparent: transparent,
      autosize: true,
      largeChartUrl: '',
    });
    el.appendChild(script);
    return () => {
      if (el.contains(script)) el.removeChild(script);
    };
  }, [symbol, height, transparent]);

  return (
    <div style={{ height: `${height}px` }}>
      <div ref={ref} className="w-full h-full" />
    </div>
  );
}
