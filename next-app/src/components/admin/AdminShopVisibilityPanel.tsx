'use client';

import { useEffect, useState } from 'react';

export default function AdminShopVisibilityPanel() {
  const [showSoldItems, setShowSoldItems] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/admin/shop-settings');
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error || 'Failed to load shop settings.');
        if (!cancelled) setShowSoldItems(data.showSoldItems ?? true);
      } catch (err) {
        if (!cancelled) setNotice({ text: err instanceof Error ? err.message : 'Failed to load shop settings.', ok: false });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const save = async (nextValue: boolean) => {
    setSaving(true);
    const previous = showSoldItems;
    setShowSoldItems(nextValue); // optimistic
    try {
      const res = await fetch('/api/admin/shop-settings', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ showSoldItems: nextValue }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Failed to save.');
      setShowSoldItems(data.showSoldItems ?? nextValue);
      setNotice({
        text: (data.showSoldItems ?? nextValue)
          ? 'Sold items are now shown in the shop.'
          : 'Sold items are now hidden from the shop.',
        ok: true,
      });
      window.setTimeout(() => setNotice(null), 3500);
    } catch (err) {
      setShowSoldItems(previous); // revert on failure
      setNotice({ text: err instanceof Error ? err.message : 'Failed to save.', ok: false });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mt-6 border bg-white" style={{ borderColor: 'var(--color-outline-variant)' }}>
      <div className="border-b px-5 py-4" style={{ borderColor: 'var(--color-outline-variant)' }}>
        <h2
          className="text-xl font-bold"
          style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}
        >
          Shop Visibility
        </h2>
        <p className="mt-1 text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
          Choose whether sold items stay visible to buyers in the public shop gallery, or are hidden so only
          available pieces show. Available items are always shown.
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
            checked={showSoldItems}
            onChange={(e) => void save(e.target.checked)}
            disabled={loading || saving}
            className="mt-0.5"
            style={{ accentColor: '#a98208', width: '1.05rem', height: '1.05rem', cursor: loading || saving ? 'not-allowed' : 'pointer' }}
          />
          <span>
            <span className="font-bold">Show sold items in the shop gallery</span>
            <span className="block text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
              {loading
                ? 'Loading…'
                : showSoldItems
                  ? 'Sold pieces are shown to buyers (marked “Sold”).'
                  : 'Sold pieces are hidden — buyers see only available pieces.'}
            </span>
          </span>
        </label>
      </div>
    </section>
  );
}
