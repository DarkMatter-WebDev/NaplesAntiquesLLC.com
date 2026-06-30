'use client';

import Link from 'next/link';
import { type CSSProperties, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const GOLD = '#735c00';

function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span
      aria-label={`${count} order${count === 1 ? '' : 's'} awaiting fulfillment`}
      style={{
        minWidth: '1rem',
        height: '1rem',
        padding: '0 0.28rem',
        borderRadius: '999px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: GOLD,
        color: 'white',
        fontSize: '0.58rem',
        fontWeight: 800,
        lineHeight: 1,
        boxShadow: '0 0 0 2px white',
      }}
    >
      {count > 9 ? '9+' : count}
    </span>
  );
}

/**
 * Orders nav item with a "needs attention" badge. Self-fetches the count of paid
 * orders still awaiting fulfillment via the admin browser client, so the badge
 * works on every admin page without each page having to compute it. This is where
 * a new paid order surfaces — order notifications no longer go to the Messages
 * center.
 */
export default function AdminOrdersLink({
  href,
  active = false,
  className,
  style,
}: {
  href: string;
  active?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        // Ensure the auth session is hydrated from cookies before querying, or the
        // count runs as anon (RLS hides orders) and the badge reads 0.
        await supabase.auth.getSession();
        const { count: pending, error } = await supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('payment_status', 'paid')
          .eq('fulfillment_status', 'pending');
        if (!cancelled && !error && typeof pending === 'number') setCount(pending);
      } catch {
        /* badge is best-effort */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const content = (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
      <span>Orders</span>
      <Badge count={count} />
    </span>
  );

  if (active) {
    return (
      <span
        className={className}
        style={{
          fontSize: '0.8125rem',
          color: '#555',
          fontWeight: 600,
          textDecoration: 'underline',
          textUnderlineOffset: '3px',
          ...style,
        }}
      >
        {content}
      </span>
    );
  }

  return (
    <Link href={href} className={className} style={style}>
      {content}
    </Link>
  );
}
