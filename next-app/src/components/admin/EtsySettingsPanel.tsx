'use client';

import { useCallback, useEffect, useState } from 'react';

interface StatusResponse {
  connected: boolean;
  status: 'disconnected' | 'connected' | 'needs_reauth';
  shopId: number | null;
  shopName: string | null;
  connectedAt: string | null;
  defaults: { shippingProfileId: number | null; returnPolicyId: number | null; readinessStateId: number | null };
  policy: { autoActivate: boolean; autoDelistOnSold: boolean; pricePushEnabled: boolean; pricePushThresholdPct: number; priceMarkupPct: number };
  recentActivity: { id: number; createdAt: string; productId: string | null; listingId: number | null; action: string; outcome: string; message: string | null }[];
}

interface ShopProfiles {
  shippingProfiles: { shipping_profile_id: number; title: string }[];
  returnPolicies: { return_policy_id: number; accepts_returns: boolean; accepts_exchanges: boolean }[];
  readinessStates: { readiness_state_id: number; readiness_state?: string; processing_days_display_label?: string }[];
}

/** Etsy Sync settings panel — composed into AdminSettingsPanel.tsx, matching AdminCarouselSettingsPanel/MarketingSettingsPanel's self-contained-fetch pattern. */
export default function EtsySettingsPanel() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [profiles, setProfiles] = useState<ShopProfiles | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  // The markup is a controlled field with an explicit Save (unlike the other
  // settings, which auto-save on change) — it re-prices the whole catalog, so
  // the owner types a value and commits it deliberately, not on blur. `null`
  // means "untouched" → the field shows the saved value; typing sets it. This
  // derives everything with no effect (avoids react-hooks/set-state-in-effect)
  // and never clobbers an in-progress edit when another setting reloads status.
  const [markupInput, setMarkupInput] = useState<string | null>(null);
  const savedMarkup = status?.policy.priceMarkupPct;
  const markupValue = markupInput ?? (savedMarkup != null ? String(savedMarkup) : '');
  const markupDirty = markupInput !== null && markupInput.trim() !== '' && markupInput.trim() !== String(savedMarkup);
  const [pushingPrices, setPushingPrices] = useState(false);
  const [priceProgress, setPriceProgress] = useState<{ pushed: number; failed: number } | null>(null);
  // Set when the markup is saved to a NEW value: live Etsy listings still show
  // the OLD prices until "Push prices to Etsy now" runs (saving the markup only
  // changes what future syncs compute). Surfaces a prominent nudge below.
  const [pricesStale, setPricesStale] = useState(false);

  const showNotice = (text: string, ok = true) => {
    setNotice({ text, ok });
    window.setTimeout(() => setNotice(null), 4500);
  };

  const loadStatus = useCallback(async () => {
    // No setState before the first await (react-hooks/set-state-in-effect) —
    // see the identical note in EtsyProductPanel.tsx.
    try {
      const res = await fetch('/api/admin/etsy/status');
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Could not load Etsy status.');
      const typed = data as StatusResponse;
      setStatus(typed);
      if (typed.connected) {
        const profileRes = await fetch('/api/admin/etsy/shop-profiles');
        const profileData = await profileRes.json().catch(() => null);
        if (profileRes.ok) setProfiles(profileData as ShopProfiles);
      }
    } catch (err) {
      showNotice(err instanceof Error ? err.message : 'Could not load Etsy status.', false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const run = async () => {
      await loadStatus();
      const params = new URLSearchParams(window.location.search);
      const etsyParam = params.get('etsy');
      if (etsyParam === 'connected') showNotice('Etsy connected.');
      else if (etsyParam === 'error') showNotice('Could not connect Etsy. Please try again.', false);
    };
    void run();
  }, [loadStatus]);

  const saveSettings = async (patch: Record<string, unknown>): Promise<boolean> => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/etsy/settings', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Could not save.');
      showNotice('Saved.');
      await loadStatus();
      return true;
    } catch (err) {
      showNotice(err instanceof Error ? err.message : 'Could not save.', false);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const saveMarkup = async () => {
    if (markupInput === null) return;
    const changed = markupInput.trim() !== String(savedMarkup);
    const ok = await saveSettings({ priceMarkupPct: markupInput });
    if (ok) {
      setMarkupInput(null); // fall back to the freshly-saved value
      if (changed) setPricesStale(true); // live prices won't reflect it until pushed
    }
  };

  // "Push prices now" — re-sends the current price of every live listing whose
  // price drifted (e.g. after a markup change), batched with the same stall
  // guard as EtsyProductPanel's sync loop so a persistently-failing item can't
  // spin forever. The bulk "Sync All" skips already-live listings, so this is
  // the tool for propagating a markup change to what's already on Etsy.
  const pushAllPrices = async () => {
    setPushingPrices(true);
    setPriceProgress(null);
    let totalPushed = 0;
    let totalFailed = 0;
    let lastRemaining: number | null = null;
    let stall = 0;
    try {
      for (;;) {
        const res = await fetch('/api/admin/etsy/push-prices', { method: 'POST' });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data) throw new Error(data?.error || 'Could not push prices.');
        totalPushed += data.pushed ?? 0;
        totalFailed += data.failed ?? 0;
        setPriceProgress({ pushed: totalPushed, failed: totalFailed });
        if (data.done) break;
        if (data.remaining === lastRemaining) {
          stall += 1;
          if (stall >= 3) break; // no progress across several polls — stop rather than retry forever
        } else {
          stall = 0;
          lastRemaining = data.remaining;
        }
      }
      setPricesStale(false); // live prices now reflect the current markup
      showNotice(
        `Pushed ${totalPushed} price${totalPushed === 1 ? '' : 's'} to Etsy${totalFailed ? ` · ${totalFailed} failed` : ''}.`,
        totalFailed === 0,
      );
    } catch (err) {
      showNotice(err instanceof Error ? err.message : 'Could not push prices.', false);
    } finally {
      setPushingPrices(false);
      await loadStatus();
    }
  };

  const disconnect = async () => {
    setDisconnecting(true);
    try {
      const res = await fetch('/api/admin/etsy/disconnect', { method: 'POST' });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Could not disconnect.');
      showNotice('Etsy disconnected. Listings already on Etsy are unaffected.');
      setConfirmDisconnect(false);
      await loadStatus();
    } catch (err) {
      showNotice(err instanceof Error ? err.message : 'Could not disconnect.', false);
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <section className="mt-6 border bg-white" style={{ borderColor: 'var(--color-outline-variant)' }}>
      <div className="border-b px-5 py-4" style={{ borderColor: 'var(--color-outline-variant)' }}>
        <h2 className="text-xl font-bold" style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}>
          Etsy Sync
        </h2>
        <p className="mt-1 text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
          Push the catalog to Etsy as a secondary sales channel. Supabase stays the source of truth — Etsy never writes back into the site.
        </p>
      </div>
      <div className="p-5 flex flex-col gap-5">
        {notice && (
          <div
            className="px-3 py-2 text-xs font-medium"
            role="status"
            style={{
              background: notice.ok ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)' : 'color-mix(in srgb, var(--color-error) 10%, transparent)',
              border: `1px solid ${notice.ok ? 'color-mix(in srgb, var(--color-primary) 28%, transparent)' : 'color-mix(in srgb, var(--color-error) 28%, transparent)'}`,
              color: notice.ok ? 'var(--color-primary)' : 'var(--color-error)',
            }}
          >
            {notice.text}
          </div>
        )}

        {loading && <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>Loading…</p>}

        {!loading && status && !status.connected && (
          <div className="flex flex-col gap-3">
            <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
              Not connected. Complete the Etsy shop setup first — shipping profile, return policy, readiness state, and confirm Domestic &amp;
              Global Pricing is off (see OWNER-SETUP.md) — then connect.
            </p>
            {/* Plain <a>, not next/link: this must be a real full-page GET so the
                browser follows the server's 302 redirect into Etsy's OAuth consent
                screen — client-side routing would try to render it as a page. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/api/admin/etsy/connect" className="gold-button text-sm inline-flex w-fit">
              Connect Etsy
            </a>
          </div>
        )}

        {!loading && status?.status === 'needs_reauth' && (
          <div
            className="px-3 py-2 text-xs font-medium flex items-center justify-between gap-3 flex-wrap"
            style={{ background: 'color-mix(in srgb, #b8860b 14%, transparent)', border: '1px solid color-mix(in srgb, #b8860b 30%, transparent)', color: '#8a6400' }}
          >
            <span>Etsy connection expired — reconnect to resume syncing.</span>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- see the Connect Etsy button above */}
            <a href="/api/admin/etsy/connect" className="gold-button text-xs">
              Reconnect Etsy
            </a>
          </div>
        )}

        {!loading && status?.connected && (
          <>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--color-on-surface)' }}>
                  {status.shopName ?? `Shop #${status.shopId}`}
                </p>
                <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>Connected · auto-renews</p>
              </div>
              {!confirmDisconnect ? (
                <button type="button" onClick={() => setConfirmDisconnect(true)} className="outline-button text-sm">
                  Disconnect
                </button>
              ) : (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>Listings stay on Etsy. Disconnect?</span>
                  <button type="button" onClick={() => void disconnect()} disabled={disconnecting} className="outline-button text-sm" style={{ color: 'var(--color-error)' }}>
                    {disconnecting ? 'Disconnecting…' : 'Yes, disconnect'}
                  </button>
                  <button type="button" onClick={() => setConfirmDisconnect(false)} className="outline-button text-sm">
                    Cancel
                  </button>
                </div>
              )}
            </div>

            <div className="grid md:grid-cols-3 gap-3">
              <div>
                <label className="form-label" htmlFor="etsy-shipping-profile">Shipping profile</label>
                <select
                  id="etsy-shipping-profile"
                  className="form-field w-full"
                  value={status.defaults.shippingProfileId ?? ''}
                  disabled={saving}
                  onChange={(e) => void saveSettings({ shippingProfileId: e.target.value || null })}
                >
                  <option value="">Choose…</option>
                  {profiles?.shippingProfiles.map((p) => (
                    <option key={p.shipping_profile_id} value={p.shipping_profile_id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label" htmlFor="etsy-return-policy">Return policy</label>
                <select
                  id="etsy-return-policy"
                  className="form-field w-full"
                  value={status.defaults.returnPolicyId ?? ''}
                  disabled={saving}
                  onChange={(e) => void saveSettings({ returnPolicyId: e.target.value || null })}
                >
                  <option value="">Choose…</option>
                  {profiles?.returnPolicies.map((p) => (
                    <option key={p.return_policy_id} value={p.return_policy_id}>
                      #{p.return_policy_id}
                      {p.accepts_returns ? ' · returns' : ''}
                      {p.accepts_exchanges ? ' · exchanges' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label" htmlFor="etsy-readiness-state">Readiness state</label>
                <select
                  id="etsy-readiness-state"
                  className="form-field w-full"
                  value={status.defaults.readinessStateId ?? ''}
                  disabled={saving}
                  onChange={(e) => void saveSettings({ readinessStateId: e.target.value || null })}
                >
                  <option value="">Choose…</option>
                  {profiles?.readinessStates.map((p) => (
                    <option key={p.readiness_state_id} value={p.readiness_state_id}>
                      {p.processing_days_display_label ?? p.readiness_state ?? `#${p.readiness_state_id}`}
                      {p.readiness_state && p.processing_days_display_label ? ` (${p.readiness_state.replace('_', ' ')})` : ''}
                    </option>
                  ))}
                </select>
                {profiles && profiles.readinessStates.length === 0 && (
                  <p className="mt-1 text-[0.65rem]" style={{ color: 'var(--color-on-surface-variant)' }}>
                    No readiness states found yet — create a processing profile on Etsy first (Shop Manager → Settings → Options), then reload this page.
                  </p>
                )}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-3">
              <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--color-on-surface-variant)' }}>
                <input
                  type="checkbox"
                  checked={status.policy.autoActivate}
                  disabled={saving}
                  onChange={(e) => void saveSettings({ autoActivate: e.target.checked })}
                  style={{ accentColor: 'var(--color-primary)' }}
                />
                Auto-activate new listings (default off — draft for review)
              </label>
              <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--color-on-surface-variant)' }}>
                <input
                  type="checkbox"
                  checked={status.policy.autoDelistOnSold}
                  disabled={saving}
                  onChange={(e) => void saveSettings({ autoDelistOnSold: e.target.checked })}
                  style={{ accentColor: 'var(--color-primary)' }}
                />
                Auto-delist when sold/archived on the site
              </label>
              <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--color-on-surface-variant)' }}>
                <input
                  type="checkbox"
                  checked={status.policy.pricePushEnabled}
                  disabled={saving}
                  onChange={(e) => void saveSettings({ pricePushEnabled: e.target.checked })}
                  style={{ accentColor: 'var(--color-primary)' }}
                />
                Daily scheduled price push
              </label>
              <div className="flex items-center gap-2">
                <label className="form-label whitespace-nowrap mb-0" htmlFor="etsy-price-threshold">Push threshold %</label>
                <input
                  id="etsy-price-threshold"
                  type="number"
                  min="0"
                  step="0.5"
                  className="form-field w-24"
                  defaultValue={status.policy.pricePushThresholdPct}
                  onBlur={(e) => void saveSettings({ pricePushThresholdPct: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="form-label whitespace-nowrap mb-0" htmlFor="etsy-markup">Etsy price markup %</label>
                <input
                  id="etsy-markup"
                  type="number"
                  min="0"
                  step="0.5"
                  className="form-field w-24"
                  value={markupValue}
                  disabled={saving}
                  onChange={(e) => setMarkupInput(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => void saveMarkup()}
                  disabled={saving || !markupDirty}
                  className="gold-button text-xs disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>

            <div className="border-t pt-4 flex flex-col gap-2" style={{ borderColor: 'var(--color-outline-variant)' }}>
              {pricesStale && !pushingPrices && (
                <div
                  className="px-3 py-2 text-xs font-medium"
                  style={{ background: 'color-mix(in srgb, #b8860b 14%, transparent)', border: '1px solid color-mix(in srgb, #b8860b 30%, transparent)', color: '#8a6400' }}
                >
                  Markup saved. Your live Etsy listings still show the old prices — saving the markup only changes what future syncs compute.
                  Click <strong>Push prices to Etsy now</strong> to apply it to every live listing. (The bulk &ldquo;Sync All&rdquo; button
                  intentionally skips already-live items, so it won&apos;t re-price them.)
                </div>
              )}
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={() => void pushAllPrices()}
                  disabled={pushingPrices || saving}
                  className={`${pricesStale ? 'gold-button' : 'outline-button'} text-sm`}
                >
                  {pushingPrices ? 'Pushing prices…' : 'Push prices to Etsy now'}
                </button>
                <span className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                  Re-sends the current price of every live listing to Etsy (prices only — no photos or details). Use this after changing the
                  markup, or when spot has moved — the daily scheduled push only fires past the threshold.
                  {priceProgress ? ` · Pushed ${priceProgress.pushed}${priceProgress.failed ? `, ${priceProgress.failed} failed` : ''}.` : ''}
                </span>
              </div>
            </div>

            <div>
              <p className="form-label mb-2">Recent Etsy activity</p>
              {status.recentActivity.length === 0 ? (
                <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>No activity yet.</p>
              ) : (
                <ul className="flex flex-col gap-1 max-h-56 overflow-auto text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                  {status.recentActivity.map((row) => (
                    <li key={row.id} className="flex items-center gap-2 border-b py-1" style={{ borderColor: 'var(--color-outline-variant)' }}>
                      <span
                        className="material-symbols-outlined"
                        style={{ fontSize: '14px', color: row.outcome === 'error' ? 'var(--color-error)' : row.outcome === 'warning' ? '#a9760a' : 'var(--color-primary)' }}
                        aria-hidden="true"
                      >
                        {row.outcome === 'error' ? 'error' : row.outcome === 'warning' ? 'warning' : 'check_circle'}
                      </span>
                      <span className="flex-shrink-0">{new Date(row.createdAt).toLocaleString()}</span>
                      <span className="font-semibold flex-shrink-0">{row.action}</span>
                      {row.message && <span className="truncate">{row.message}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}

        <p className="text-[0.65rem]" style={{ color: 'var(--color-on-surface-variant)' }}>
          The term &quot;Etsy&quot; is a trademark of Etsy, Inc. This application uses the Etsy API but is not endorsed or certified by Etsy, Inc.
        </p>
      </div>
    </section>
  );
}
