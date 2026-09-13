'use client';

import type { FormEvent } from 'react';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  DEFAULT_SUBSCRIBER_SORT,
  nextSubscriberSort,
  sortSubscriberRows,
  subscriberSourceLabel,
  type SubscriberRow,
  type SubscriberSortKey,
} from '@/lib/subscriber-sort';

export type { SubscriberRow } from '@/lib/subscriber-sort';

// Column headers; a `sortKey` makes the header a sort button (lib/subscriber-sort.ts).
const COLUMNS: { label: string; sortKey: SubscriberSortKey | null }[] = [
  { label: 'Name', sortKey: 'name' },
  { label: 'Email', sortKey: 'email' },
  { label: 'Source', sortKey: 'source' },
  { label: 'Subscribed', sortKey: 'subscribed' },
  { label: 'Actions', sortKey: null },
];

// Pinned to Eastern so the server render and the owner's browser agree (a
// hydration mismatch otherwise) and so the time reads as the showroom's clock,
// not the Netlify region's.
const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'America/New_York',
});

function formatDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : dateFormatter.format(date);
}

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return true;
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  return copied;
}

export default function SubscribersManager({ initialRows }: { initialRows: SubscriberRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [editingEmail, setEditingEmail] = useState<string | null>(null);
  const [form, setForm] = useState({ email: '', name: '' });
  const [addForm, setAddForm] = useState({ email: '', name: '' });
  const [adding, setAdding] = useState(false);
  const [busyEmail, setBusyEmail] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);
  const [sort, setSort] = useState(DEFAULT_SUBSCRIBER_SORT);

  const sortedRows = useMemo(() => sortSubscriberRows(rows, sort), [rows, sort]);
  // "Copy All Emails" follows the visible order so a pasted list reads like the table.
  const emailList = useMemo(() => sortedRows.map((row) => row.email).join(', '), [sortedRows]);

  function beginEdit(row: SubscriberRow) {
    setEditingEmail(row.subscriberEmail);
    setForm({ email: row.subscriberEmail ?? row.email, name: row.name ?? '' });
    setNotice(null);
  }

  function cancelEdit() {
    setEditingEmail(null);
    setForm({ email: '', name: '' });
  }

  async function addSubscriber(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (adding) return;

    setAdding(true);
    setNotice(null);
    try {
      const normalizedEmail = addForm.email.trim().toLowerCase();
      const trimmedName = addForm.name.trim();
      const res = await fetch('/api/admin/subscribers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: normalizedEmail,
          fullName: trimmedName,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Could not add subscriber.');

      setRows((current) => {
        const existing = current.find((row) => row.email === normalizedEmail || row.subscriberEmail === normalizedEmail);
        if (existing) {
          return current.map((row) => {
            if (row !== existing) return row;
            return {
              ...row,
              email: row.source === 'account' ? row.email : normalizedEmail,
              name: trimmedName || row.name,
              source: row.source === 'account' ? 'both' : row.source,
              subscriberSource: 'admin_manual',
              subscriberEmail: normalizedEmail,
              subscribedAt: new Date().toISOString(),
            };
          });
        }
        return [
          {
            email: normalizedEmail,
            name: trimmedName || null,
            source: 'subscriber',
            subscriberSource: 'admin_manual',
            subscriberEmail: normalizedEmail,
            subscribedAt: new Date().toISOString(),
            accountCreatedAt: null,
          },
          ...current,
        ];
      });
      setAddForm({ email: '', name: '' });
      setNotice({ text: 'Subscriber added.', ok: true });
      router.refresh();
    } catch (err) {
      setNotice({ text: err instanceof Error ? err.message : 'Could not add subscriber.', ok: false });
    } finally {
      setAdding(false);
    }
  }

  async function save(row: SubscriberRow) {
    if (!row.subscriberEmail) return;
    setBusyEmail(row.subscriberEmail);
    setNotice(null);
    try {
      const res = await fetch('/api/admin/subscribers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalEmail: row.subscriberEmail,
          email: form.email,
          fullName: form.name,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Could not update subscriber.');

      setRows((current) => current.map((item) => (
        item.subscriberEmail === row.subscriberEmail
          ? {
              ...item,
              email: item.source === 'subscriber' ? form.email.trim().toLowerCase() : item.email,
              name: form.name.trim() || null,
              subscriberEmail: form.email.trim().toLowerCase(),
            }
          : item
      )));
      cancelEdit();
      setNotice({ text: 'Subscriber updated.', ok: true });
      router.refresh();
    } catch (err) {
      setNotice({ text: err instanceof Error ? err.message : 'Could not update subscriber.', ok: false });
    } finally {
      setBusyEmail(null);
    }
  }

  async function remove(row: SubscriberRow) {
    if (!row.subscriberEmail) return;
    const confirmed = window.confirm(`Delete ${row.subscriberEmail} from newsletter subscribers? Account-holder records will not be deleted.`);
    if (!confirmed) return;

    setBusyEmail(row.subscriberEmail);
    setNotice(null);
    try {
      const res = await fetch('/api/admin/subscribers', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: row.subscriberEmail }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Could not delete subscriber.');

      setRows((current) => current
        .map((item) => {
          if (item.subscriberEmail !== row.subscriberEmail) return item;
          if (item.source === 'both') return { ...item, source: 'account', subscriberEmail: null };
          return null;
        })
        .filter((item): item is SubscriberRow => item !== null));
      setNotice({ text: 'Subscriber deleted.', ok: true });
      router.refresh();
    } catch (err) {
      setNotice({ text: err instanceof Error ? err.message : 'Could not delete subscriber.', ok: false });
    } finally {
      setBusyEmail(null);
    }
  }

  async function copyEmails() {
    try {
      const copied = await copyText(emailList);
      setNotice({
        text: copied ? `Copied ${rows.length} email${rows.length === 1 ? '' : 's'}.` : 'Could not copy automatically.',
        ok: copied,
      });
    } catch {
      setNotice({ text: 'Could not copy automatically.', ok: false });
    }
  }

  return (
    <>
      <form
        className="mb-5 rounded-[1.25rem] border bg-white p-4"
        style={{ borderColor: 'var(--color-outline-variant)' }}
        onSubmit={(event) => void addSubscriber(event)}
      >
        <div className="mb-3">
          <h2 className="text-lg font-bold" style={{ color: 'var(--color-on-surface)', fontFamily: 'var(--font-headline)' }}>
            Add Subscriber
          </h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
            Manually add a newsletter recipient by name and email.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_1.2fr_auto] md:items-end">
          <label>
            <span className="form-label">Name</span>
            <input
              className="form-field mt-2 w-full"
              value={addForm.name}
              onChange={(event) => setAddForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Optional"
            />
          </label>
          <label>
            <span className="form-label">Email</span>
            <input
              className="form-field mt-2 w-full"
              type="email"
              value={addForm.email}
              onChange={(event) => setAddForm((current) => ({ ...current, email: event.target.value }))}
              placeholder="customer@example.com"
              required
            />
          </label>
          <button type="submit" className="gold-button md:mb-0" disabled={adding}>
            {adding ? 'Adding...' : 'Add Subscriber'}
          </button>
        </div>
      </form>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
          {rows.length} reachable recipient{rows.length === 1 ? '' : 's'}
        </p>
        <button type="button" className="outline-button text-sm" onClick={copyEmails} disabled={rows.length === 0}>
          Copy All Emails
        </button>
      </div>

      {notice && (
        <div
          className="mb-4 rounded-lg px-3 py-2 text-sm"
          role="status"
          style={{
            background: notice.ok ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)' : 'color-mix(in srgb, var(--color-error) 10%, transparent)',
            color: notice.ok ? 'var(--color-primary)' : 'var(--color-error)',
          }}
        >
          {notice.text}
        </div>
      )}

      <div className="responsive-table-wrap border" style={{ borderColor: 'var(--color-outline-variant)', background: 'white' }}>
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead style={{ background: 'var(--color-surface-container-low)' }}>
            <tr>
              {COLUMNS.map(({ label, sortKey }) => {
                const active = sortKey !== null && sort.key === sortKey;
                return (
                  <th
                    key={label}
                    aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined}
                    className="px-4 py-3 text-[0.68rem] uppercase tracking-widest font-bold whitespace-nowrap"
                    style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}
                  >
                    {sortKey ? (
                      <button
                        type="button"
                        onClick={() => setSort((current) => nextSubscriberSort(current, sortKey))}
                        className="flex items-center gap-1 uppercase tracking-widest hover:opacity-75"
                        style={{ fontFamily: 'var(--font-label)' }}
                        title={`Sort by ${label.toLowerCase()}`}
                      >
                        <span>{label}</span>
                        <span
                          aria-hidden="true"
                          className="text-[0.65rem]"
                          style={{ color: active ? 'var(--color-primary)' : 'var(--color-on-surface-variant)' }}
                        >
                          {active ? (sort.direction === 'asc' ? '▲' : '▼') : '↕'}
                        </span>
                      </button>
                    ) : label}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((subscriber) => {
              const canManage = Boolean(subscriber.subscriberEmail);
              const isEditing = editingEmail === subscriber.subscriberEmail && canManage;
              const busy = busyEmail === subscriber.subscriberEmail;

              return (
                <tr key={`${subscriber.source}-${subscriber.email}-${subscriber.subscriberEmail ?? ''}`} className="border-t" style={{ borderColor: 'var(--color-outline-variant)' }}>
                  <td className="px-4 py-3 font-semibold" style={{ color: 'var(--color-on-surface)' }}>
                    {isEditing ? (
                      <input className="form-field w-full" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
                    ) : (
                      subscriber.name || '-'
                    )}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--color-on-surface)' }}>
                    {isEditing ? (
                      <input className="form-field w-full" type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
                    ) : (
                      subscriber.email
                    )}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--color-on-surface-variant)' }}>
                    {subscriberSourceLabel(subscriber)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--color-on-surface-variant)' }}>
                    {formatDate(subscriber.subscribedAt) ?? (
                      formatDate(subscriber.accountCreatedAt) ? (
                        <span>
                          {formatDate(subscriber.accountCreatedAt)}
                          <span className="ml-1 text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>(account)</span>
                        </span>
                      ) : '-'
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {canManage ? (
                      <div className="flex flex-wrap gap-2">
                        {isEditing ? (
                          <>
                            <button type="button" className="gold-button text-xs" onClick={() => void save(subscriber)} disabled={busy}>
                              {busy ? 'Saving...' : 'Save'}
                            </button>
                            <button type="button" className="outline-button text-xs" onClick={cancelEdit} disabled={busy}>
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button type="button" className="outline-button text-xs" onClick={() => beginEdit(subscriber)} disabled={busyEmail !== null}>
                              Edit
                            </button>
                            <button type="button" className="outline-button text-xs" onClick={() => void remove(subscriber)} disabled={busyEmail !== null} style={{ color: 'var(--color-error)' }}>
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                        {[
                          subscriber.source?.includes('account') ? 'Account profile' : null,
                          subscriber.source?.includes('buyer') ? 'Buyer record' : null,
                        ].filter(Boolean).join(' + ') || 'Not editable here'}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center" style={{ color: 'var(--color-on-surface-variant)' }}>
                  No reachable marketing recipients yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
