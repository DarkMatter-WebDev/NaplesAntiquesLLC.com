'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { copyTextToClipboard } from '@/lib/clipboard';

export type BuyerRow = {
  email: string;
  name: string | null;
  phone: string | null;
  orderCount: number;
  totalSpent: number;
  lastOrderAt: string | null;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function formatDate(value: string | null) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

export default function BuyersManager({ initialRows }: { initialRows: BuyerRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busyEmail, setBusyEmail] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);

  const allSelected = rows.length > 0 && selected.size === rows.length;
  const someSelected = selected.size > 0 && !allSelected;
  const selectedEmails = useMemo(
    () => rows.filter((row) => selected.has(row.email)).map((row) => row.email),
    [rows, selected]
  );

  function toggleOne(email: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(rows.map((row) => row.email)));
  }

  async function copySelectedEmails() {
    const copied = await copyTextToClipboard(selectedEmails.join(', '));
    setNotice({
      text: copied
        ? `Copied ${selectedEmails.length} email${selectedEmails.length === 1 ? '' : 's'}.`
        : 'Could not copy automatically.',
      ok: copied,
    });
  }

  async function remove(row: BuyerRow) {
    const confirmed = window.confirm(
      `Delete ${row.name || row.email} from the Buyers list? This only removes them from this list — their past orders are not affected. If they place another order, they'll be added back as a new row.`
    );
    if (!confirmed) return;

    setBusyEmail(row.email);
    setNotice(null);
    try {
      const res = await fetch('/api/admin/buyers', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: row.email }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Could not delete buyer.');

      setRows((current) => current.filter((item) => item.email !== row.email));
      setSelected((current) => {
        if (!current.has(row.email)) return current;
        const next = new Set(current);
        next.delete(row.email);
        return next;
      });
      setNotice({ text: 'Buyer deleted.', ok: true });
      router.refresh();
    } catch (err) {
      setNotice({ text: err instanceof Error ? err.message : 'Could not delete buyer.', ok: false });
    } finally {
      setBusyEmail(null);
    }
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
          {rows.length} buyer{rows.length === 1 ? '' : 's'}
          {selected.size > 0 ? ` · ${selected.size} selected` : ''}
        </p>
        <button
          type="button"
          className="outline-button text-sm"
          onClick={() => void copySelectedEmails()}
          disabled={selected.size === 0}
        >
          Copy Selected Emails{selected.size > 0 ? ` (${selected.size})` : ''}
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
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead style={{ background: 'var(--color-surface-container-low)' }}>
            <tr>
              <th className="px-4 py-3" style={{ width: '2.5rem' }}>
                <input
                  type="checkbox"
                  aria-label="Select all buyers"
                  checked={allSelected}
                  ref={(el) => { if (el) el.indeterminate = someSelected; }}
                  onChange={toggleAll}
                  disabled={rows.length === 0}
                  style={{ accentColor: 'var(--color-primary)', width: '1.05rem', height: '1.05rem', cursor: rows.length === 0 ? 'default' : 'pointer' }}
                />
              </th>
              {['Name', 'Email', 'Phone', 'Orders', 'Total Spent', 'Last Order', 'Actions'].map((heading) => (
                <th
                  key={heading}
                  className="px-4 py-3 text-[0.68rem] uppercase tracking-widest font-bold"
                  style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((buyer) => {
              const busy = busyEmail === buyer.email;
              const isSelected = selected.has(buyer.email);
              return (
                <tr
                  key={buyer.email}
                  className="border-t"
                  style={{
                    borderColor: 'var(--color-outline-variant)',
                    background: isSelected ? 'color-mix(in srgb, var(--color-primary) 6%, transparent)' : undefined,
                  }}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      aria-label={`Select ${buyer.name || buyer.email}`}
                      checked={isSelected}
                      onChange={() => toggleOne(buyer.email)}
                      style={{ accentColor: 'var(--color-primary)', width: '1.05rem', height: '1.05rem', cursor: 'pointer' }}
                    />
                  </td>
                  <td className="px-4 py-3 font-semibold" style={{ color: 'var(--color-on-surface)' }}>
                    {buyer.name || '-'}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--color-on-surface)' }}>
                    {buyer.email}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--color-on-surface-variant)' }}>
                    {buyer.phone || '-'}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--color-on-surface-variant)' }}>
                    {buyer.orderCount}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--color-on-surface-variant)' }}>
                    {formatCurrency(buyer.totalSpent)}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--color-on-surface-variant)' }}>
                    {formatDate(buyer.lastOrderAt)}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      className="outline-button text-xs"
                      onClick={() => void remove(buyer)}
                      disabled={busyEmail !== null}
                      style={{ color: 'var(--color-error)' }}
                    >
                      {busy ? 'Deleting...' : 'Delete'}
                    </button>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center" style={{ color: 'var(--color-on-surface-variant)' }}>
                  No buyers yet. This list fills in automatically as orders are paid.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
