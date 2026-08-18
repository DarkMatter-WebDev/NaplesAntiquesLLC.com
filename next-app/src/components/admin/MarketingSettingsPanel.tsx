'use client';

import { useEffect, useState } from 'react';
import { addressOneLine } from '@/lib/business-location';

type MarketingSettingsResponse = {
  mailingAddress: string | null;
  siteUrl: string;
  fromAddress: string;
  senderProfiles?: {
    chris?: {
      fromAddress: string;
      label: string;
      replyTo: string | null;
    };
    no_reply?: {
      fromAddress: string;
      label: string;
      replyTo: string | null;
    };
  };
  transport: 'direct' | 'broadcast';
};

export default function MarketingSettingsPanel() {
  const [settings, setSettings] = useState<MarketingSettingsResponse | null>(null);
  const [mailingAddress, setMailingAddress] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/admin/marketing/settings');
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error || 'Could not load marketing settings.');
        if (!cancelled) {
          setSettings(data as MarketingSettingsResponse);
          setMailingAddress(data.mailingAddress ?? '');
        }
      } catch (err) {
        if (!cancelled) setNotice({ text: err instanceof Error ? err.message : 'Could not load marketing settings.', ok: false });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function save() {
    setSaving(true);
    setNotice(null);
    try {
      const res = await fetch('/api/admin/marketing/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mailingAddress }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Could not save marketing settings.');
      setSettings(data as MarketingSettingsResponse);
      setMailingAddress(data.mailingAddress ?? '');
      setNotice({ text: 'Marketing settings saved.', ok: true });
    } catch (err) {
      setNotice({ text: err instanceof Error ? err.message : 'Could not save marketing settings.', ok: false });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-8 rounded-[1.25rem] border bg-white" style={{ borderColor: 'var(--color-outline-variant)' }}>
      <div className="border-b px-5 py-4" style={{ borderColor: 'var(--color-outline-variant)' }}>
        <h2 className="text-xl font-bold" style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}>
          Email Marketing Compliance
        </h2>
        <p className="mt-1 text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
          Physical mailing address used in every marketing email footer.
        </p>
      </div>
      <div className="grid gap-4 p-5">
        {notice && (
          <div
            className="rounded-lg px-3 py-2 text-xs font-medium"
            role="status"
            style={{
              background: notice.ok ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)' : 'color-mix(in srgb, var(--color-error) 10%, transparent)',
              color: notice.ok ? 'var(--color-primary)' : 'var(--color-error)',
            }}
          >
            {notice.text}
          </div>
        )}
        <label>
          <span className="form-label">Physical Mailing Address</span>
          <textarea
            className="form-field mt-2 min-h-[7rem] w-full"
            value={loading ? 'Loading...' : mailingAddress}
            onChange={(event) => setMailingAddress(event.target.value)}
            disabled={loading}
            placeholder="Business name, street address, city, state, ZIP"
          />
        </label>
        {/* Without this, a blank box looks like non-compliance while the emails
            actually carry the showroom address — the field is an OVERRIDE now,
            not the only source. */}
        {!loading && !mailingAddress.trim() && (
          <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
            Leave blank to use the showroom address, <strong>{addressOneLine()}</strong>.
            Marketing email legally needs a physical address, so this never sends empty.
            Anything you type here overrides it.
          </p>
        )}
        <div className="grid gap-2 text-xs md:grid-cols-3" style={{ color: 'var(--color-on-surface-variant)' }}>
          <span><strong>Site URL:</strong> {settings?.siteUrl ?? 'https://naplesestatejewelry.com'}</span>
          <span><strong>Chris sender:</strong> {settings?.senderProfiles?.chris?.fromAddress ?? 'Chris at Naples Estate Jewelry <info@naplesestatejewelry.com>'}</span>
          <span><strong>Transport:</strong> {settings?.transport ?? 'direct'}</span>
          <span className="md:col-span-3">
            <strong>Reply-To:</strong> {settings?.senderProfiles?.chris?.replyTo ?? 'info@naplesestatejewelry.com'} | <strong>No-reply:</strong> {settings?.senderProfiles?.no_reply?.fromAddress ?? settings?.fromAddress ?? 'Not configured'}
          </span>
        </div>
        <button type="button" onClick={save} disabled={saving || loading} className="gold-button w-fit disabled:opacity-60">
          {saving ? 'Saving...' : 'Save Marketing Settings'}
        </button>
      </div>
    </section>
  );
}
