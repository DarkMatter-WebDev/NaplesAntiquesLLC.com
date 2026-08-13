'use client';

import { useState } from 'react';
import { AppIcon } from '@/components/AppIcon';
import {
  formatDiscountValue,
  isDiscountExhausted,
  isDiscountExpired,
  type DiscountCodeRecord,
  type DiscountType,
} from '@/lib/discount-codes';

const GOLD = '#735c00';
const BORDER = 'var(--color-outline-variant)';

type FormState = {
  id: string | null;
  code: string;
  discountType: DiscountType;
  discountValue: string;
  minOrderSubtotal: string;
  expiresAt: string;
  maxRedemptions: string;
  notes: string;
};

const EMPTY_FORM: FormState = {
  id: null,
  code: '',
  discountType: 'percent',
  discountValue: '',
  minOrderSubtotal: '',
  expiresAt: '',
  maxRedemptions: '',
  notes: '',
};

function money(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** `expires_at` is an ISO instant; the form field is a `date`. */
function toDateInput(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function statusOf(code: DiscountCodeRecord): { label: string; color: string } {
  if (!code.active) return { label: 'Inactive', color: 'var(--color-on-surface-variant)' };
  if (isDiscountExpired(code.expires_at)) return { label: 'Expired', color: '#b3261e' };
  if (isDiscountExhausted(code)) return { label: 'Limit reached', color: '#b3261e' };
  return { label: 'Active', color: '#2e7d32' };
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.62rem',
  fontWeight: 700,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  color: 'var(--color-on-surface-variant)',
  fontFamily: 'var(--font-label)',
  marginBottom: '0.35rem',
};

/**
 * ⚠️ Tailwind font-size/font-weight utilities DO NOTHING on a <button> here.
 * `globals.css:144` sets `button, input, select, textarea { font: inherit }`
 * OUTSIDE any cascade layer, and un-layered rules beat `@layer utilities`
 * regardless of specificity. `letter-spacing` and `text-decoration` still work
 * (neither is in the `font` shorthand), so a broken button looks half-styled
 * rather than unstyled. Put button font properties in `style`, never in a class.
 */
const buttonLabelFont: React.CSSProperties = {
  fontFamily: 'var(--font-label)',
  fontWeight: 700,
  textTransform: 'uppercase',
};

const primaryButtonStyle: React.CSSProperties = {
  ...buttonLabelFont,
  fontSize: '0.72rem',
  letterSpacing: '0.12em',
  background: GOLD,
  color: 'white',
  border: `1px solid ${GOLD}`,
};

const secondaryButtonStyle: React.CSSProperties = {
  ...buttonLabelFont,
  fontSize: '0.72rem',
  letterSpacing: '0.12em',
  border: `1px solid ${BORDER}`,
  background: 'white',
  color: 'var(--color-on-surface)',
};

const rowButtonStyle: React.CSSProperties = {
  ...buttonLabelFont,
  fontSize: '0.66rem',
  letterSpacing: '0.1em',
  border: `1px solid ${BORDER}`,
  background: 'white',
  color: 'var(--color-on-surface)',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  border: `1px solid ${BORDER}`,
  background: 'white',
  padding: '0.55rem 0.65rem',
  fontSize: '0.875rem',
  color: 'var(--color-on-surface)',
};

export default function DiscountCodesManager({
  initialCodes,
  loadError,
}: {
  initialCodes: DiscountCodeRecord[];
  loadError?: string | null;
}) {
  const [codes, setCodes] = useState<DiscountCodeRecord[]>(initialCodes);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(loadError ?? null);
  const [notice, setNotice] = useState<string | null>(null);

  const isEditing = form.id !== null;

  function resetForm() {
    setForm(EMPTY_FORM);
    setError(null);
  }

  function startEdit(code: DiscountCodeRecord) {
    setForm({
      id: code.id,
      code: code.code,
      discountType: code.discount_type,
      discountValue: String(code.discount_value),
      minOrderSubtotal: code.min_order_subtotal == null ? '' : String(code.min_order_subtotal),
      expiresAt: toDateInput(code.expires_at),
      maxRedemptions: code.max_redemptions == null ? '' : String(code.max_redemptions),
      notes: code.notes ?? '',
    });
    setError(null);
    setNotice(null);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function upsertLocal(saved: DiscountCodeRecord) {
    setCodes((current) => {
      const index = current.findIndex((row) => row.id === saved.id);
      if (index === -1) return [saved, ...current];
      const next = [...current];
      next[index] = saved;
      return next;
    });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);

    const payload = {
      ...(form.id ? { id: form.id } : {}),
      code: form.code,
      discount_type: form.discountType,
      discount_value: form.discountValue,
      min_order_subtotal: form.minOrderSubtotal,
      max_redemptions: form.maxRedemptions,
      // A date input gives a local calendar day; expire at the END of that day
      // so a code dated today still works for the whole day.
      expires_at: form.expiresAt ? `${form.expiresAt}T23:59:59` : '',
      notes: form.notes,
    };

    try {
      const response = await fetch('/api/admin/discount-codes', {
        method: form.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data?.error ?? 'Could not save the discount code.');
        return;
      }
      upsertLocal(data.code as DiscountCodeRecord);
      setNotice(form.id ? `Updated ${data.code.code}.` : `Created ${data.code.code}.`);
      resetForm();
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(code: DiscountCodeRecord) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch('/api/admin/discount-codes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: code.id, active: !code.active }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data?.error ?? 'Could not update the discount code.');
        return;
      }
      upsertLocal(data.code as DiscountCodeRecord);
      setNotice(`${data.code.code} is now ${data.code.active ? 'active' : 'inactive'}.`);
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(code: DiscountCodeRecord) {
    const used = code.times_used > 0;
    const warning = used
      ? `Delete ${code.code}? It has been redeemed ${code.times_used} time${code.times_used === 1 ? '' : 's'}, and deleting it also removes that redemption history. Past orders keep their own record of the discount. Deactivating instead keeps the history.`
      : `Delete ${code.code}? This cannot be undone.`;
    if (!window.confirm(warning)) return;

    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch('/api/admin/discount-codes', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: code.id }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data?.error ?? 'Could not delete the discount code.');
        return;
      }
      setCodes((current) => current.filter((row) => row.id !== code.id));
      setNotice(`Deleted ${code.code}.`);
      if (form.id === code.id) resetForm();
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {error && (
        <div
          className="border px-4 py-3 text-sm"
          style={{ borderColor: 'var(--color-error)', color: 'var(--color-error)', background: 'white' }}
        >
          {error}
        </div>
      )}
      {notice && (
        <div
          className="border px-4 py-3 text-sm"
          style={{ borderColor: '#2e7d32', color: '#2e7d32', background: 'white' }}
        >
          {notice}
        </div>
      )}

      {/* ---- Create / edit form */}
      <section className="border p-5 md:p-6" style={{ borderColor: BORDER, background: 'white' }}>
        <h2
          className="text-lg font-bold mb-5"
          style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}
        >
          {isEditing ? `Edit ${form.code}` : 'Create a discount code'}
        </h2>

        <form onSubmit={submit} className="flex flex-col gap-5">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label style={labelStyle} htmlFor="discount-code">Code</label>
              <input
                id="discount-code"
                style={{ ...inputStyle, textTransform: 'uppercase' }}
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="THANKYOU"
                autoComplete="off"
                required
              />
              <p className="mt-1 text-[0.68rem]" style={{ color: 'var(--color-on-surface-variant)' }}>
                Not case sensitive for shoppers.
              </p>
            </div>

            <div>
              <label style={labelStyle} htmlFor="discount-type">Discount type</label>
              <select
                id="discount-type"
                style={inputStyle}
                value={form.discountType}
                onChange={(e) => setForm({ ...form, discountType: e.target.value as DiscountType })}
              >
                <option value="percent">Percentage off</option>
                <option value="fixed">Dollar amount off</option>
              </select>
            </div>

            <div>
              <label style={labelStyle} htmlFor="discount-value">
                {form.discountType === 'percent' ? 'Percentage (1-100)' : 'Amount in dollars'}
              </label>
              <div style={{ position: 'relative' }}>
                {form.discountType === 'fixed' && (
                  <span
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      left: '0.65rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      fontSize: '0.875rem',
                      color: 'var(--color-on-surface-variant)',
                    }}
                  >
                    $
                  </span>
                )}
                <input
                  id="discount-value"
                  style={{
                    ...inputStyle,
                    paddingLeft: form.discountType === 'fixed' ? '1.5rem' : inputStyle.padding as string,
                  }}
                  type="number"
                  min={form.discountType === 'percent' ? 1 : 0.01}
                  max={form.discountType === 'percent' ? 100 : undefined}
                  step={form.discountType === 'percent' ? 1 : 0.01}
                  value={form.discountValue}
                  onChange={(e) => setForm({ ...form, discountValue: e.target.value })}
                  placeholder={form.discountType === 'percent' ? '15' : '50.00'}
                  required
                />
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label style={labelStyle} htmlFor="discount-min">Minimum order (optional)</label>
              <input
                id="discount-min"
                style={inputStyle}
                type="number"
                min={0}
                step={0.01}
                value={form.minOrderSubtotal}
                onChange={(e) => setForm({ ...form, minOrderSubtotal: e.target.value })}
                placeholder="No minimum"
              />
              <p className="mt-1 text-[0.68rem]" style={{ color: 'var(--color-on-surface-variant)' }}>
                Worth setting on dollar-amount codes.
              </p>
            </div>

            <div>
              <label style={labelStyle} htmlFor="discount-max">Total uses allowed (optional)</label>
              <input
                id="discount-max"
                style={inputStyle}
                type="number"
                min={1}
                step={1}
                value={form.maxRedemptions}
                onChange={(e) => setForm({ ...form, maxRedemptions: e.target.value })}
                placeholder="Unlimited"
              />
              <p className="mt-1 text-[0.68rem]" style={{ color: 'var(--color-on-surface-variant)' }}>
                A hard limit across all shoppers.
              </p>
            </div>

            <div>
              <label style={labelStyle} htmlFor="discount-expires">Expires (optional)</label>
              <input
                id="discount-expires"
                style={inputStyle}
                type="date"
                value={form.expiresAt}
                onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
              />
              <p className="mt-1 text-[0.68rem]" style={{ color: 'var(--color-on-surface-variant)' }}>
                Works through the end of this day.
              </p>
            </div>
          </div>

          <div>
            <label style={labelStyle} htmlFor="discount-notes">Internal note (optional)</label>
            <input
              id="discount-notes"
              style={inputStyle}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="What this code is for — shoppers never see this."
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={busy}
              className="px-5 py-2.5"
              style={{
                ...primaryButtonStyle,
                opacity: busy ? 0.6 : 1,
                cursor: busy ? 'wait' : 'pointer',
              }}
            >
              {isEditing ? 'Save changes' : 'Create code'}
            </button>
            {isEditing && (
              <button
                type="button"
                onClick={resetForm}
                disabled={busy}
                className="px-4 py-2.5"
                style={secondaryButtonStyle}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </section>

      {/* ---- Existing codes */}
      <section>
        <h2
          className="text-lg font-bold mb-4"
          style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}
        >
          Codes ({codes.length})
        </h2>

        {codes.length === 0 ? (
          <div
            className="border px-4 py-8 text-center text-sm"
            style={{ borderColor: BORDER, background: 'white', color: 'var(--color-on-surface-variant)' }}
          >
            No discount codes yet. Create one above.
          </div>
        ) : (
          <div className="overflow-x-auto border" style={{ borderColor: BORDER, background: 'white' }}>
            <table className="w-full" style={{ borderCollapse: 'collapse', minWidth: '780px' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                  {['Code', 'Discount', 'Minimum', 'Used', 'Expires', 'Status', ''].map((heading) => (
                    <th
                      key={heading}
                      className="px-3 py-2.5 text-left text-[0.6rem] font-bold uppercase tracking-[0.18em]"
                      style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {codes.map((code) => {
                  const status = statusOf(code);
                  return (
                    <tr key={code.id} style={{ borderBottom: `1px solid ${BORDER}` }}>
                      <td className="px-3 py-3">
                        <span className="font-bold text-sm" style={{ color: 'var(--color-on-surface)' }}>
                          {code.code}
                        </span>
                        {code.notes && (
                          <span className="block text-[0.7rem]" style={{ color: 'var(--color-on-surface-variant)' }}>
                            {code.notes}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-sm" style={{ color: 'var(--color-on-surface)' }}>
                        {formatDiscountValue(code.discount_type, code.discount_value)}
                      </td>
                      <td className="px-3 py-3 text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
                        {code.min_order_subtotal == null ? '—' : money(code.min_order_subtotal)}
                      </td>
                      <td className="px-3 py-3 text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
                        {code.times_used}
                        {code.max_redemptions == null ? '' : ` / ${code.max_redemptions}`}
                      </td>
                      <td className="px-3 py-3 text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
                        {code.expires_at ? toDateInput(code.expires_at) : '—'}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className="text-[0.62rem] font-bold uppercase tracking-[0.14em]"
                          style={{ color: status.color, fontFamily: 'var(--font-label)' }}
                        >
                          {status.label}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => startEdit(code)}
                            disabled={busy}
                            className="px-2.5 py-1.5"
                            style={rowButtonStyle}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleActive(code)}
                            disabled={busy}
                            className="px-2.5 py-1.5"
                            style={rowButtonStyle}
                          >
                            {code.active ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            type="button"
                            onClick={() => remove(code)}
                            disabled={busy}
                            aria-label={`Delete ${code.code}`}
                            className="px-2 py-1.5"
                            style={{
                              border: `1px solid ${BORDER}`,
                              background: 'white',
                              color: 'var(--color-error)',
                            }}
                          >
                            <AppIcon name="delete" style={{ fontSize: '1rem' }} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
