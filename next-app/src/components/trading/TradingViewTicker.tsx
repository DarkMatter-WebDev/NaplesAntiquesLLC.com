'use client';
import { useEffect, useRef } from 'react';

export default function TradingViewTicker() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const script = document.createElement('script');
    script.src =
      'https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js';
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbols: [
        { description: 'Gold', proName: 'OANDA:XAUUSD' },
        { description: 'Silver', proName: 'OANDA:XAGUSD' },
        { description: 'Platinum', proName: 'OANDA:XPTUSD' },
        { description: 'Palladium', proName: 'OANDA:XPDUSD' },
      ],
      showSymbolLogo: false,
      isTransparent: true,
      displayMode: 'regular',
      colorTheme: 'dark',
      locale: 'en',
    });
    el.appendChild(script);
    return () => {
      if (el.contains(script)) el.removeChild(script);
    };
  }, []);

  return (
    <div className="w-full">
      <div ref={ref} className="w-full" />
    </div>
  );
}
