'use client';

import Link from 'next/link';
import { type CSSProperties, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const GOLD = '#735c00';
const STORAGE_KEY_PREFIX = 'admin-orders-last-seen-at';

function getStorageKey(userEmail?: string | null) {
  return `${STORAGE_KEY_PREFIX}:${(userEmail ?? 'current-admin').trim().toLowerCase()}`;
}

function getStoredLastSeenAt(storageKey: string): string | null {
  try {
    const value = localStorage.getItem(storageKey);
    if (!value) return null;
    return Number.isNaN(Date.parse(value)) ? null : value;
  } catch {
    return null;
  }
}

function markOrdersSeen(storageKey: string) {
  const seenAt = new Date().toISOString();
  try {
    localStorage.setItem(storageKey, seenAt);
  } catch {
    // Best effort only; if storage is blocked, active Orders still hides the badge.
  }
  return seenAt;
}

function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span
      aria-label={`${count} new order${count === 1 ? '' : 's'} not yet seen`}
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
 * Orders nav item with a "new orders" badge. The badge counts active order rows
 * created since this admin last viewed the active Orders area, so the number clears
 * when orders have been seen instead of tracking fulfillment work.
 */
export default function AdminOrdersLink({
  href,
  active = false,
  userEmail,
  className,
  style,
}: {
  href: string;
  active?: boolean;
  userEmail?: string | null;
  className?: string;
  style?: CSSProperties;
}) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const storageKey = getStorageKey(userEmail);

    (async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const viewingTrash = params.get('view') === 'trash';
        if (active && !viewingTrash) {
          markOrdersSeen(storageKey);
          if (!cancelled) setCount(0);
          return;
        }

        const lastSeenAt = getStoredLastSeenAt(storageKey);
        const supabase = createClient();
        // Ensure the auth session is hydrated from cookies before querying, or the
        // count runs as anon (RLS hides orders) and the badge reads 0.
        await supabase.auth.getSession();
        let query = supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .is('deleted_at', null);
        if (lastSeenAt) query = query.gt('created_at', lastSeenAt);
        const { count: newOrders, error } = await query;
        if (!cancelled && !error && typeof newOrders === 'number') setCount(newOrders);
      } catch {
        /* badge is best-effort */
      }
    })();

    return () => { cancelled = true; };
  }, [active, userEmail]);

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
