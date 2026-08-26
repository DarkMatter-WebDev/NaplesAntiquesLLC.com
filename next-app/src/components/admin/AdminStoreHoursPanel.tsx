'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_STORE_HOURS,
  WEEK_ORDER,
  hoursLine,
  type StoreHoursSchedule,
  type WeekDay,
} from '@/lib/business-location';

/**
 * Admin-editable weekly showroom hours (mockup approved 2026-08-25).
 *
 * Explicit Save, not save-on-change: a schedule edit usually touches several
 * rows, and the site should never render a half-edited week. Native
 * `<input type="time">` emits the exact `HH:MM` storage format. Closed days
 * keep their times (dimmed + disabled) so reopening restores them.
 */
export default function AdminStoreHoursPanel() {
  const [schedule, setSchedule] = useState<StoreHoursSchedule>(DEFAULT_STORE_HOURS);
  const [savedSchedule, setSavedSchedule] = useState<StoreHoursSchedule>(DEFAULT_STORE_HOURS);
  const [isDefault, setIsDefault] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/admin/store-hours');
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error || 'Failed to load store hours.');
        if (!cancelled && data?.schedule) {
          setSchedule(data.schedule);
          setSavedSchedule(data.schedule);
          setIsDefault(Boolean(data.isDefault));
        }
      } catch (err) {
        if (!cancelled) setNotice({ text: err instanceof Error ? err.message : 'Failed to load store hours.', ok: false });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const setDay = (day: WeekDay, patch: Partial<StoreHoursSchedule[WeekDay]>) => {
    setSchedule((prev) => ({ ...prev, [day]: { ...prev[day], ...patch } }));
  };

  // Zero-padded HH:MM sorts lexicographically, so string compare is exact.
  const rowErrors = useMemo(() => {
    const errors = {} as Record<WeekDay, string | null>;
    for (const day of WEEK_ORDER) {
      const d = schedule[day];
      errors[day] = d.open && (!d.opens || !d.closes || d.closes <= d.opens)
        ? 'closing must be after opening'
        : null;
    }
    return errors;
  }, [schedule]);

  const hasErrors = WEEK_ORDER.some((day) => rowErrors[day]);
  const allClosed = WEEK_ORDER.every((day) => !schedule[day].open);
  const dirty = useMemo(
    () => JSON.stringify(schedule) !== JSON.stringify(savedSchedule) || isDefault,
    [schedule, savedSchedule, isDefault],
  );
  const previewLine = useMemo(() => hoursLine(schedule, false), [schedule]);

  const save = async () => {
    if (hasErrors || saving) return;
    setSaving(true);
    setNotice(null);
    try {
      const res = await fetch('/api/admin/store-hours', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ schedule }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Failed to save store hours.');
      setSavedSchedule(data.schedule ?? schedule);
      setSchedule(data.schedule ?? schedule);
      setIsDefault(false);
      setNotice({ text: 'Hours saved. Public pages update within a few minutes as they regenerate.', ok: true });
      window.setTimeout(() => setNotice(null), 6000);
    } catch (err) {
      setNotice({ text: err instanceof Error ? err.message : 'Failed to save store hours.', ok: false });
    } finally {
      setSaving(false);
    }
  };

  const timeInputStyle = (disabled: boolean, invalid: boolean) => ({
    border: `1px solid ${invalid ? 'var(--color-error)' : 'var(--color-outline-variant)'}`,
    padding: '0.25rem 0.4rem',
    fontSize: '0.85rem',
    background: disabled ? 'var(--color-surface-variant, #f6f5f1)' : '#fff',
    color: disabled ? 'var(--color-on-surface-variant)' : 'var(--color-on-surface)',
    fontVariantNumeric: 'tabular-nums' as const,
  });

  return (
    <section className="mt-6 border bg-white" style={{ borderColor: 'var(--color-outline-variant)' }}>
      <div className="border-b px-5 py-4" style={{ borderColor: 'var(--color-outline-variant)' }}>
        <h2
          className="text-xl font-bold"
          style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}
        >
          Store Hours
        </h2>
        <p className="mt-1 text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
          Set the weekly showroom hours shown across the whole site — footer, homepage, contact,
          checkout pickup, receipts, and the schema Google reads.
        </p>
      </div>
      <div className="p-5 flex flex-col gap-4">
        {/* NAP consistency is a local-SEO ranking factor — permanent warning,
            same reasoning as the ⚠️ on HOURS in lib/business-location.ts. */}
        <div
          className="px-3 py-2 text-xs"
          style={{
            background: 'color-mix(in srgb, #ba7517 10%, transparent)',
            border: '1px solid color-mix(in srgb, #ba7517 32%, transparent)',
            color: '#633806',
            fontFamily: 'var(--font-label)',
            lineHeight: 1.5,
          }}
        >
          These hours must stay identical to the Google Business Profile, the eBay merchant
          location, and the Etsy shop location. If you change them here, change all three the
          same day.
        </div>

        {notice && (
          <div
            className="px-3 py-2 text-xs font-medium"
            role="status"
            style={{
              background: notice.ok ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)' : 'color-mix(in srgb, var(--color-error) 10%, transparent)',
              border: `1px solid ${notice.ok ? 'color-mix(in srgb, var(--color-primary) 28%, transparent)' : 'color-mix(in srgb, var(--color-error) 28%, transparent)'}`,
              color: notice.ok ? 'var(--color-primary)' : 'var(--color-error)',
              fontFamily: 'var(--font-label)',
            }}
          >
            {notice.text}
          </div>
        )}

        {isDefault && !loading && (
          <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
            Showing the built-in default hours — nothing has been saved yet.
          </p>
        )}

        <div>
          <div
            className="grid items-center gap-x-3 py-1.5 text-[0.65rem] uppercase"
            style={{ gridTemplateColumns: 'minmax(6.5rem, 1.4fr) auto 1fr auto 1fr', letterSpacing: '0.06em', color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}
          >
            <span>Day</span>
            <span>Open</span>
            <span>Opens</span>
            <span />
            <span>Closes</span>
          </div>
          {WEEK_ORDER.map((day) => {
            const d = schedule[day];
            const error = rowErrors[day];
            const disabled = loading || saving;
            return (
              <div
                key={day}
                className="grid items-center gap-x-3 border-t py-2 text-sm"
                style={{
                  gridTemplateColumns: 'minmax(6.5rem, 1.4fr) auto 1fr auto 1fr',
                  borderColor: 'var(--color-outline-variant)',
                  opacity: d.open ? 1 : 0.62,
                  color: 'var(--color-on-surface)',
                }}
              >
                <span className="font-bold">
                  {day}
                  {error && (
                    <span className="ml-2 text-xs font-normal" style={{ color: 'var(--color-error)' }}>
                      {error}
                    </span>
                  )}
                </span>
                <input
                  type="checkbox"
                  checked={d.open}
                  disabled={disabled}
                  onChange={(event) => setDay(day, { open: event.target.checked })}
                  aria-label={`${day} open`}
                  style={{ accentColor: '#a98208', width: '1.05rem', height: '1.05rem', cursor: disabled ? 'not-allowed' : 'pointer' }}
                />
                <input
                  type="time"
                  value={d.opens}
                  disabled={disabled || !d.open}
                  onChange={(event) => setDay(day, { opens: event.target.value })}
                  aria-label={`${day} opening time`}
                  style={timeInputStyle(disabled || !d.open, Boolean(error))}
                />
                <span aria-hidden="true" style={{ color: 'var(--color-on-surface-variant)' }}>–</span>
                <input
                  type="time"
                  value={d.closes}
                  disabled={disabled || !d.open}
                  onChange={(event) => setDay(day, { closes: event.target.value })}
                  aria-label={`${day} closing time`}
                  style={timeInputStyle(disabled || !d.open, Boolean(error))}
                />
              </div>
            );
          })}
          <div className="border-t" style={{ borderColor: 'var(--color-outline-variant)' }} />
        </div>

        {allClosed && (
          <div
            className="px-3 py-2 text-xs"
            style={{
              background: 'color-mix(in srgb, #ba7517 10%, transparent)',
              border: '1px solid color-mix(in srgb, #ba7517 32%, transparent)',
              color: '#633806',
              fontFamily: 'var(--font-label)',
            }}
          >
            Every day is marked closed — the site will show “By appointment only” everywhere.
          </div>
        )}

        <div>
          <span
            className="text-[0.65rem] uppercase"
            style={{ letterSpacing: '0.06em', color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}
          >
            Sitewide preview
          </span>
          {/* hoursLine is pure and client-safe — this is EXACTLY the sentence
              checkout, shipping, and product pages will print. */}
          <p className="mt-0.5 text-sm" style={{ color: 'var(--color-on-surface)' }}>{previewLine}</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void save()}
            disabled={loading || saving || hasErrors || !dirty}
            className="px-5 py-2 text-xs font-bold uppercase"
            style={{
              background: loading || saving || hasErrors || !dirty ? 'var(--color-outline-variant)' : '#a98208',
              color: '#fff',
              letterSpacing: '0.04em',
              fontFamily: 'var(--font-label)',
              cursor: loading || saving || hasErrors || !dirty ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? 'Saving…' : 'Save Hours'}
          </button>
          {!loading && dirty && !saving && (
            <span className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
              Unsaved changes
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
