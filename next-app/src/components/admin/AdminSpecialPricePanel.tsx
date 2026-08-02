'use client';

import { useEffect, useState } from 'react';

/**
 * Site-wide default for the product-page trade-in line ("Own gold or silver?
 * … pay as little as ___"). By default that line shows the item's computed
 * melt/spot value; this sets ONE default for every item at once — a signed %
 * over/under melt. The per-item override on any listing still wins.
 */
export default function AdminSpecialPricePanel() {
  const [enabled, setEnabled] = useState(false);
  const [percent, setPercent] = useState(''); // string for the input
  const [saved, setSaved] = useState<{ enabled: boolean; percent: string }>({ enabled: false, percent: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    let cancelled = false;
    // setState only after the await (matches AdminShopVisibilityPanel — the
    // react-hooks/set-state-in-effect rule only flags a synchronous set).
    (async () => {
      try {
        const res = await fetch('/api/admin/shop-settings');
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error || 'Failed to load settings.');
        if (cancelled) return;
        const d = data.specialPriceDefault ?? { enabled: false, percent: null };
        const pct = d.percent != null ? String(d.percent) : '';
        setEnabled(Boolean(d.enabled));
        setPercent(pct);
        setSaved({ enabled: Boolean(d.enabled), percent: pct });
      } catch (err) {
        if (!cancelled) setNotice({ text: err instanceof Error ? err.message : 'Failed to load settings.', ok: false });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const percentNum = Number(percent);
  const percentInvalid = enabled && percent.trim() !== '' && !Number.isFinite(percentNum);
  const dirty = enabled !== saved.enabled || percent.trim() !== saved.percent.trim();

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/shop-settings', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          specialPriceDefaultEnabled: enabled,
          specialPriceDefaultPercent: percent.trim() === '' ? null : percentNum,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Failed to save.');
      const d = data.specialPriceDefault ?? { enabled, percent: percent.trim() === '' ? null : percentNum };
      const pct = d.percent != null ? String(d.percent) : '';
      setEnabled(Boolean(d.enabled));
      setPercent(pct);
      setSaved({ enabled: Boolean(d.enabled), percent: pct });
      setNotice({ text: 'Saved. Product pages update within ~5 minutes.', ok: true });
      window.setTimeout(() => setNotice(null), 4000);
    } catch (err) {
      setNotice({ text: err instanceof Error ? err.message : 'Failed to save.', ok: false });
    } finally {
      setSaving(false);
    }
  };

  // Live example on a $1,000 melt value, so the sign/direction is unambiguous.
  const examplePreview =
    enabled && percent.trim() !== '' && Number.isFinite(percentNum)
      ? `On a $1,000 melt value, the line would read $${(1000 * (1 + percentNum / 100)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`
      : null;

  return (
    <section className="mt-6 border bg-white" style={{ borderColor: 'var(--color-outline-variant)' }}>
      <div className="border-b px-5 py-4" style={{ borderColor: 'var(--color-outline-variant)' }}>
        <h2 className="text-xl font-bold" style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}>
          Customer Trade-in Price
        </h2>
        <p className="mt-1 text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
          Controls the site-wide default for the “Own gold or silver? … pay as little as ___” line on every product page. By
          default it shows the item’s spot melt value. Turn this on to advertise a different price for all items at once — a
          percentage over or under melt. The per-item override on any individual listing still takes precedence.
        </p>
      </div>
      <div className="p-5 flex flex-col gap-4">
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

        <label className="flex items-start gap-3 text-sm" style={{ cursor: loading || saving ? 'default' : 'pointer', color: 'var(--color-on-surface)' }}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            disabled={loading || saving}
            className="mt-0.5"
            style={{ accentColor: '#a98208', width: '1.05rem', height: '1.05rem', cursor: loading || saving ? 'not-allowed' : 'pointer' }}
          />
          <span>
            <span className="font-bold">Set a site-wide trade-in price instead of the spot melt value</span>
            <span className="block text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
              {loading ? 'Loading…' : 'When off, every item’s line shows its plain melt value (the historical behavior).'}
            </span>
          </span>
        </label>

        {enabled && (
          <div className="flex flex-col gap-2 pl-8">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm" style={{ color: 'var(--color-on-surface)' }}>Trade-in price = melt value</span>
              <span className="text-sm" style={{ color: 'var(--color-on-surface)' }}>{percentNum < 0 ? '−' : '+'}</span>
              <input
                type="number"
                step="0.5"
                className="form-field w-24"
                value={percent}
                disabled={loading || saving}
                onChange={(e) => setPercent(e.target.value)}
                placeholder="e.g. 10"
                aria-label="Trade-in percent over melt value"
              />
              <span className="text-sm" style={{ color: 'var(--color-on-surface)' }}>%</span>
            </div>
            <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
              Use a negative number (e.g. −10) to advertise <em>below</em> spot. {examplePreview}
            </p>
            {percentInvalid && (
              <p className="text-xs" style={{ color: 'var(--color-error)' }}>Enter a number (e.g. 10, or -5 for below spot).</p>
            )}
          </div>
        )}

        <div>
          <button
            type="button"
            onClick={() => void save()}
            disabled={loading || saving || !dirty || percentInvalid}
            className="gold-button text-sm disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </section>
  );
}
