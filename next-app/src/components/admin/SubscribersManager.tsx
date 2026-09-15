'use client';

import type { FormEvent } from 'react';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  DEFAULT_SUBSCRIBER_SORT,
  nextSubscriberSort,
  sortSubscriberRows,
  subscriberRowKey,
  subscriberSourceLabel,
  type SubscriberRow,
  type SubscriberSortKey,
} from '@/lib/subscriber-sort';
import { formatUsPhone, smsStatusLabel, subscriberChannelLabel } from '@/lib/subscriber-phone';

export type { SubscriberRow } from '@/lib/subscriber-sort';

// Column headers; a `sortKey` makes the header a sort button (lib/subscriber-sort.ts).
// Phone + Alerts since 2026-09-15: the "Join the List" window can sign a
// visitor up for text deals, with or without an email.
const COLUMNS: { label: string; sortKey: SubscriberSortKey | null }[] = [
  { label: 'Name', sortKey: 'name' },
  { label: 'Email', sortKey: 'email' },
  { label: 'Phone', sortKey: 'phone' },
  { label: 'Alerts', sortKey: 'alerts' },
  { label: 'Source', sortKey: 'source' },
  { label: 'Subscribed', sortKey: 'subscribed' },
  { label: 'Actions', sortKey: null },
];

// The Alerts column: which channel the row is on, then where the number stands.
const STATUS_COLORS: Record<string, string> = {
  confirmed: '#2f6b3a',
  pending: '#8a5a00',
  stopped: 'var(--color-error)',
};

function Pill({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span
      className="inline-block rounded-full border px-2 py-0.5 text-[0.58rem] font-bold uppercase tracking-[0.12em]"
      style={{ color, borderColor: color, fontFamily: 'var(--font-label)' }}
    >
      {children}
    </span>
  );
}

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
  const [textOnly, setTextOnly] = useState(false);

  const sortedRows = useMemo(() => sortSubscriberRows(rows, sort), [rows, sort]);
  const visibleRows = useMemo(() => (textOnly ? sortedRows.filter((row) => row.phone) : sortedRows), [sortedRows, textOnly]);
  // "Copy All Emails" follows the visible order so a pasted list reads like the table.
  const emailList = useMemo(() => sortedRows.filter((row) => row.email).map((row) => row.email).join(', '), [sortedRows]);
  // Only numbers that replied YES are ever texted, so only those are copied.
  const confirmedNumbers = useMemo(
    () => sortedRows.filter((row) => row.phone && row.smsStatus === 'confirmed').map((row) => formatUsPhone(row.phone)),
    [sortedRows],
  );
  const emailCount = useMemo(() => rows.filter((row) => row.email).length, [rows]);
  const textCount = useMemo(() => rows.filter((row) => row.phone).length, [rows]);

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
            phone: null,
            smsStatus: null,
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
    // An email row is removed by its email (the number goes with it); a
    // text-only row has no email and is removed by its number.
    const byPhone = !row.subscriberEmail && row.phone;
    if (!row.subscriberEmail && !byPhone) return;
    const who = row.subscriberEmail ?? formatUsPhone(row.phone);
    const confirmed = window.confirm(`Delete ${who} from subscribers? Account-holder records will not be deleted.`);
    if (!confirmed) return;

    const busyKey = row.subscriberEmail ?? (row.phone as string);
    setBusyEmail(busyKey);
    setNotice(null);
    try {
      const res = await fetch('/api/admin/subscribers', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(byPhone ? { phone: row.phone } : { email: row.subscriberEmail }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Could not delete subscriber.');

      setRows((current) => current
        .map((item) => {
          if (byPhone) return item.phone === row.phone && !item.subscriberEmail ? null : item;
          if (item.subscriberEmail !== row.subscriberEmail) return item;
          if (item.source === 'both') return { ...item, source: 'account', subscriberEmail: null, phone: null, smsStatus: null };
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
        text: copied ? `Copied ${emailCount} email${emailCount === 1 ? '' : 's'}.` : 'Could not copy automatically.',
        ok: copied,
      });
    } catch {
      setNotice({ text: 'Could not copy automatically.', ok: false });
    }
  }

  async function copyNumbers() {
    try {
      const copied = await copyText(confirmedNumbers.join(', '));
      setNotice({
        text: copied ? `Copied ${confirmedNumbers.length} confirmed number${confirmedNumbers.length === 1 ? '' : 's'}.` : 'Could not copy automatically.',
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
          {emailCount} reachable by email · {textCount} on the text list
          {textOnly ? ` · showing ${visibleRows.length} with a number` : ''}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="outline-button text-sm"
            onClick={() => setTextOnly((current) => !current)}
            aria-pressed={textOnly}
            style={textOnly ? { background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)' } : undefined}
          >
            {textOnly ? 'Showing: text list' : 'Show: text list only'}
          </button>
          <button type="button" className="outline-button text-sm" onClick={copyNumbers} disabled={confirmedNumbers.length === 0} title="Only numbers that replied YES">
            Copy Confirmed Numbers
          </button>
          <button type="button" className="outline-button text-sm" onClick={copyEmails} disabled={emailCount === 0}>
            Copy All Emails
          </button>
        </div>
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
        <table className="w-full min-w-[1180px] text-left text-sm">
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
            {visibleRows.map((subscriber) => {
              const canManage = Boolean(subscriber.subscriberEmail);
              const canRemoveByPhone = !canManage && Boolean(subscriber.phone);
              const isEditing = editingEmail === subscriber.subscriberEmail && canManage;
              const busy = busyEmail === (subscriber.subscriberEmail ?? subscriber.phone);
              const channel = subscriberChannelLabel({ email: subscriber.email || null, phone: subscriber.phone });
              const statusLabel = subscriber.phone ? smsStatusLabel(subscriber.smsStatus) : '';

              return (
                <tr key={`${subscriber.source}-${subscriberRowKey(subscriber)}-${subscriber.subscriberEmail ?? ''}`} className="border-t" style={{ borderColor: 'var(--color-outline-variant)' }}>
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
                      subscriber.email || '-'
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap tabular-nums" style={{ color: 'var(--color-on-surface)' }}>
                    {formatUsPhone(subscriber.phone) || '-'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="inline-flex flex-wrap items-center gap-1.5">
                      <Pill color="var(--color-on-surface-variant)">{channel}</Pill>
                      {statusLabel && (
                        <Pill color={STATUS_COLORS[subscriber.smsStatus ?? ''] ?? 'var(--color-on-surface-variant)'}>{statusLabel}</Pill>
                      )}
                    </span>
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
                    ) : canRemoveByPhone ? (
                      <button type="button" className="outline-button text-xs" onClick={() => void remove(subscriber)} disabled={busyEmail !== null} style={{ color: 'var(--color-error)' }}>
                        {busy ? 'Deleting...' : 'Delete'}
                      </button>
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
            {visibleRows.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length} className="px-4 py-12 text-center" style={{ color: 'var(--color-on-surface-variant)' }}>
                  {textOnly ? 'Nobody has asked for text alerts yet.' : 'No reachable marketing recipients yet.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
