'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { formatOrderDate } from '@/types/sales';

const GOLD = '#735c00';
const BORDER = 'var(--color-outline-variant)';

export type AdminNotification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  order_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  is_read: boolean;
  created_at: string;
};

export default function MessagesPanel({
  notifications,
  locale,
}: {
  notifications: AdminNotification[];
  locale: string;
}) {
  const supabase = createClient();
  const adminBasePath = locale === 'es' ? '/es/admin' : '/admin';
  const [items, setItems] = useState(notifications);
  const unreadCount = items.filter((item) => !item.is_read).length;

  async function markRead(id: string) {
    const { error } = await supabase
      .from('admin_notifications')
      .update({ is_read: true })
      .eq('id', id);

    if (!error) {
      setItems((current) => current.map((item) => item.id === id ? { ...item, is_read: true } : item));
    }
  }

  return (
    <main className="px-4 md:px-8 py-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.35em] mb-3" style={{ color: GOLD, fontFamily: 'var(--font-label)' }}>
            Admin Center
          </p>
          <h1 className="text-3xl md:text-4xl font-bold" style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}>
            Messages
          </h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
            {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}` : 'No unread notifications'}
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <article
              key={item.id}
              className="border p-4"
              style={{
                borderColor: item.is_read ? BORDER : GOLD,
                background: item.is_read ? 'white' : 'color-mix(in srgb, var(--color-primary) 5%, white)',
              }}
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-bold" style={{ color: 'var(--color-on-surface)', fontFamily: 'var(--font-headline)' }}>
                      {item.title}
                    </h2>
                    {!item.is_read && (
                      <span className="px-2 py-0.5 text-[0.58rem] font-bold uppercase tracking-widest" style={{ background: GOLD, color: 'white' }}>
                        New
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs" style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}>
                    {formatOrderDate(item.created_at)}
                    {item.customer_name ? ` · ${item.customer_name}` : ''}
                    {item.customer_email ? ` · ${item.customer_email}` : ''}
                  </p>
                  {item.body && (
                    <p className="mt-3 text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
                      {item.body}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {item.order_id && (
                    <Link href={`${adminBasePath}/orders/${item.order_id}`} className="gold-button text-sm">
                      Open Order
                    </Link>
                  )}
                  {!item.is_read && (
                    <button type="button" onClick={() => markRead(item.id)} className="outline-button text-sm">
                      Mark Read
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}

          {items.length === 0 && (
            <div className="border px-4 py-12 text-center" style={{ borderColor: BORDER, background: 'white', color: 'var(--color-on-surface-variant)' }}>
              No messages yet.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
