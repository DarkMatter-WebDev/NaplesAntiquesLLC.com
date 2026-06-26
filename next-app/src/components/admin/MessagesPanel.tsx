'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { formatOrderDate } from '@/types/sales';

const GOLD = '#735c00';
const BORDER = 'var(--color-outline-variant)';
const RED = '#b91c1c';

export type AdminNotification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  order_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  image_urls?: string[] | null;
  is_read: boolean;
  created_at: string;
  deleted_at?: string | null;
};

function imageList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

const TYPE_META: Record<string, { label: string; color: string }> = {
  inquiry: { label: 'Inquiry', color: GOLD },
  message: { label: 'Message', color: '#2563eb' },
  order: { label: 'Order', color: '#166534' },
};

function typeMeta(type: string): { label: string; color: string } {
  if (TYPE_META[type]) return TYPE_META[type];
  return { label: type ? `${type.charAt(0).toUpperCase()}${type.slice(1)}` : 'Note', color: 'var(--color-on-surface-variant)' };
}

function TypeChip({ type }: { type: string }) {
  const meta = typeMeta(type);
  return (
    <span
      className="shrink-0 px-2 py-0.5 text-[0.55rem] font-bold uppercase tracking-[0.14em] rounded-full"
      style={{
        color: meta.color,
        border: `1px solid color-mix(in srgb, ${meta.color} 45%, transparent)`,
        background: `color-mix(in srgb, ${meta.color} 8%, white)`,
      }}
    >
      {meta.label}
    </span>
  );
}

type View = 'inbox' | 'trash';

export default function MessagesPanel({
  notifications,
  locale,
  view = 'inbox',
  trashCount = 0,
  recycleBinSupported = true,
}: {
  notifications: AdminNotification[];
  locale: string;
  view?: View;
  trashCount?: number;
  recycleBinSupported?: boolean;
}) {
  const supabase = createClient();
  const router = useRouter();
  const adminBasePath = locale === 'es' ? '/es/admin' : '/admin';
  const messagesPath = `${adminBasePath}/messages`;
  const isTrash = view === 'trash';

  const [items, setItems] = useState(notifications);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  // Keep the rendered list in sync with the server. Next.js soft-navigation
  // between ?view=inbox and ?view=trash — and router.refresh() after an action —
  // re-renders this component with NEW `notifications` props but does NOT remount
  // it, so local useState would otherwise stay frozen on the first view's data.
  // That caused inbox messages to appear inside the Recycle Bin (and actions to
  // fire against stale rows). Resetting when the incoming array identity changes
  // is React's recommended "adjust state when a prop changes" pattern.
  const [syncedFrom, setSyncedFrom] = useState(notifications);
  if (notifications !== syncedFrom) {
    setSyncedFrom(notifications);
    setItems(notifications);
    setSelected(new Set());
  }

  const unreadCount = items.filter((item) => !item.is_read).length;
  const allSelected = items.length > 0 && selected.size === items.length;
  const someSelected = selected.size > 0;

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(items.map((i) => i.id)));
  }

  async function markRead(id: string) {
    const { error } = await supabase
      .from('admin_notifications')
      .update({ is_read: true })
      .eq('id', id);
    if (!error) {
      setItems((current) => current.map((item) => item.id === id ? { ...item, is_read: true } : item));
    }
  }

  // Calls the messages API with one of the recycle-bin actions and, on success,
  // drops the affected rows out of the current view.
  async function runAction(action: 'trash' | 'restore' | 'purge') {
    if (!someSelected || busy) return;
    if (action === 'purge' && !window.confirm(
      `Permanently delete ${selected.size} message${selected.size === 1 ? '' : 's'}? This cannot be undone.`,
    )) return;

    setBusy(true);
    const ids = [...selected];
    try {
      const res = await fetch('/api/admin/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ids }),
      });
      if (res.ok) {
        setItems((current) => current.filter((item) => !ids.includes(item.id)));
        setSelected(new Set());
        // Reconcile server-derived data (Recycle Bin count, unread badge, the
        // other view's list) with the database so nothing drifts.
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="px-4 md:px-8 py-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.35em] mb-3" style={{ color: GOLD, fontFamily: 'var(--font-label)' }}>
              Admin Center
            </p>
            <h1 className="text-3xl md:text-4xl font-bold" style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}>
              {isTrash ? 'Recycle Bin' : 'Messages'}
            </h1>
            <p className="mt-2 text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
              {isTrash
                ? 'Deleted messages are kept here until you permanently delete them.'
                : unreadCount > 0 ? `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}` : 'No unread notifications'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Action buttons (shown when rows are selected) */}
            {isTrash ? (
              someSelected && (
                <>
                  <button
                    type="button"
                    onClick={() => runAction('restore')}
                    disabled={busy}
                    className="outline-button text-sm"
                  >
                    {busy ? 'Working…' : `Restore (${selected.size})`}
                  </button>
                  <button
                    type="button"
                    onClick={() => runAction('purge')}
                    disabled={busy}
                    className="outline-button text-sm"
                    style={{ color: RED, borderColor: RED }}
                  >
                    {busy ? 'Working…' : `Delete forever (${selected.size})`}
                  </button>
                </>
              )
            ) : (
              someSelected && (
                <button
                  type="button"
                  onClick={() => runAction(recycleBinSupported ? 'trash' : 'purge')}
                  disabled={busy}
                  className="outline-button text-sm"
                  style={{ color: RED, borderColor: RED }}
                >
                  {busy ? 'Working…' : `Delete selected (${selected.size})`}
                </button>
              )
            )}

            {/* View switch */}
            {isTrash ? (
              <Link href={messagesPath} className="text-sm font-semibold" style={{ color: GOLD }}>
                ‹ Back to Messages
              </Link>
            ) : (
              recycleBinSupported && (
                <Link href={`${messagesPath}?view=trash`} className="inline-flex items-center gap-1.5 text-sm font-semibold" style={{ color: GOLD }}>
                  <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: '1.1rem' }}>delete</span>
                  Recycle Bin{trashCount > 0 ? ` (${trashCount})` : ''}
                </Link>
              )
            )}
          </div>
        </div>

        {items.length > 0 && (
          <label className="flex items-center gap-2 mb-3 cursor-pointer select-none" style={{ fontSize: '0.8125rem', color: 'var(--color-on-surface-variant)' }}>
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              className="accent-[#735c00] h-4 w-4 cursor-pointer"
            />
            {allSelected ? 'Deselect all' : 'Select all'}
          </label>
        )}

        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <article
              key={item.id}
              className="border p-4"
              style={{
                borderColor: selected.has(item.id) ? (isTrash ? GOLD : RED) : item.is_read ? BORDER : GOLD,
                background: selected.has(item.id)
                  ? `color-mix(in srgb, ${isTrash ? GOLD : RED} 4%, white)`
                  : item.is_read ? 'white' : 'color-mix(in srgb, var(--color-primary) 5%, white)',
              }}
            >
              <div className="flex gap-3 items-start">
                <input
                  type="checkbox"
                  checked={selected.has(item.id)}
                  onChange={() => toggleOne(item.id)}
                  className="mt-1 accent-[#735c00] h-4 w-4 shrink-0 cursor-pointer"
                  aria-label={`Select: ${item.title}`}
                />

                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between flex-1 min-w-0">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <TypeChip type={item.type} />
                      <h2 className="font-bold" style={{ color: 'var(--color-on-surface)', fontFamily: 'var(--font-headline)' }}>
                        {item.title}
                      </h2>
                      {!isTrash && !item.is_read && (
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
                    {imageList(item.image_urls).length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {imageList(item.image_urls).map((url, i) => (
                          <a
                            key={url}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block overflow-hidden rounded-md border"
                            style={{ width: '5rem', height: '5rem', borderColor: BORDER, background: '#faf7f0' }}
                          >
                            <Image
                              src={url}
                              alt={`${item.title} photo ${i + 1}`}
                              width={80}
                              height={80}
                              unoptimized
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    {!isTrash && item.order_id && (
                      <Link href={`${adminBasePath}/orders/${item.order_id}`} className="gold-button text-sm">
                        Open Order
                      </Link>
                    )}
                    {!isTrash && !item.is_read && (
                      <button type="button" onClick={() => markRead(item.id)} className="outline-button text-sm">
                        Mark Read
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </article>
          ))}

          {items.length === 0 && (
            <div className="border px-4 py-12 text-center" style={{ borderColor: BORDER, background: 'white', color: 'var(--color-on-surface-variant)' }}>
              {isTrash ? 'The recycle bin is empty.' : 'No messages yet.'}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
