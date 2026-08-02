'use client';

import { useCallback, useEffect, useState } from 'react';

interface StatusResponse {
  connected: boolean;
  status: 'disconnected' | 'connected' | 'needs_reauth';
  account: {
    igUserId: string | null;
    username: string | null;
    accountType: string | null;
    connectedAt: string | null;
  };
  token: {
    expiresAt: string | null;
    refreshedAt: string | null;
    daysUntilExpiry: number | null;
    encryptionKeyConfigured: boolean;
    refreshCronSecretConfigured: boolean;
  };
  policy: {
    autoPublish: boolean;
    dailyPostLimit: number;
    captionIncludePrice: boolean;
    captionSpanishLine: boolean;
    captionCta: string | null;
    baseHashtags: string[];
    soldCommentEnabled: boolean;
    soldCommentText: string;
  };
  queue: { approvedCount: number; nextProductId: string | null };
  recentActivity: {
    id: number;
    createdAt: string;
    productId: string | null;
    mediaId: string | null;
    action: string;
    outcome: string;
    message: string | null;
  }[];
}

/**
 * Instagram posting settings panel — composed into AdminSettingsPanel.tsx
 * alongside the Etsy and eBay panels, following the same self-contained-fetch
 * pattern.
 */
export default function InstagramSettingsPanel() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);
  const [tokenInput, setTokenInput] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [savingPolicy, setSavingPolicy] = useState(false);

  const showNotice = (text: string, ok = true) => {
    setNotice({ text, ok });
    window.setTimeout(() => setNotice(null), 5000);
  };

  const loadStatus = useCallback(async () => {
    // No setState before the first await (react-hooks/set-state-in-effect).
    try {
      const res = await fetch('/api/admin/instagram/status');
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Could not load Instagram status.');
      setStatus(data as StatusResponse);
    } catch (err) {
      showNotice(err instanceof Error ? err.message : 'Could not load Instagram status.', false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Wrapped so the first setState lands after an await rather than
    // synchronously in the effect body (react-hooks/set-state-in-effect),
    // matching EtsySettingsPanel/EbaySettingsPanel.
    const run = async () => {
      await loadStatus();
    };
    void run();
  }, [loadStatus]);

  const connect = async () => {
    const token = tokenInput.trim();
    if (!token) {
      showNotice('Paste the access token from the Meta App Dashboard first.', false);
      return;
    }
    setConnecting(true);
    try {
      const res = await fetch('/api/admin/instagram/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Could not verify that token.');
      // Clear immediately: the token must not linger in a form field.
      setTokenInput('');
      showNotice(`Connected @${data?.account?.username ?? 'account'}.`);
      await loadStatus();
    } catch (err) {
      showNotice(err instanceof Error ? err.message : 'Could not verify that token.', false);
    } finally {
      setConnecting(false);
    }
  };

  const savePolicy = async (patch: Record<string, unknown>) => {
    setSavingPolicy(true);
    try {
      const res = await fetch('/api/admin/instagram/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Could not save settings.');
      showNotice('Saved.');
      await loadStatus();
    } catch (err) {
      showNotice(err instanceof Error ? err.message : 'Could not save settings.', false);
    } finally {
      setSavingPolicy(false);
    }
  };

  const disconnect = async () => {
    setDisconnecting(true);
    try {
      const res = await fetch('/api/admin/instagram/disconnect', { method: 'POST' });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Could not disconnect.');
      showNotice('Instagram disconnected. Posts already on Instagram are unaffected.');
      setConfirmDisconnect(false);
      await loadStatus();
    } catch (err) {
      showNotice(err instanceof Error ? err.message : 'Could not disconnect.', false);
    } finally {
      setDisconnecting(false);
    }
  };

  const tokenWarning =
    status?.token.daysUntilExpiry != null && status.token.daysUntilExpiry <= 10
      ? `Token expires in ${status.token.daysUntilExpiry} day(s).`
      : null;

  return (
    <section className="mt-6 border bg-white" style={{ borderColor: 'var(--color-outline-variant)' }}>
      <div className="border-b px-5 py-4" style={{ borderColor: 'var(--color-outline-variant)' }}>
        <h2 className="text-xl font-bold" style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}>
          Instagram Posting
        </h2>
        <p className="mt-1 text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
          Post products to Instagram as image carousels. Captions cannot be edited after publishing, so every post is
          reviewed before it goes live.
        </p>
      </div>

      <div className="p-5 flex flex-col gap-5">
        {notice && (
          <div
            className="px-3 py-2 text-xs font-medium"
            role="status"
            style={{
              background: notice.ok
                ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)'
                : 'color-mix(in srgb, var(--color-error) 10%, transparent)',
              border: `1px solid ${notice.ok ? 'color-mix(in srgb, var(--color-primary) 28%, transparent)' : 'color-mix(in srgb, var(--color-error) 28%, transparent)'}`,
              color: notice.ok ? 'var(--color-primary)' : 'var(--color-error)',
            }}
          >
            {notice.text}
          </div>
        )}

        {loading && (
          <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
            Loading…
          </p>
        )}

        {!loading && status && !status.token.encryptionKeyConfigured && (
          <div
            className="px-3 py-2 text-xs font-medium"
            style={{
              background: 'color-mix(in srgb, var(--color-error) 10%, transparent)',
              border: '1px solid color-mix(in srgb, var(--color-error) 28%, transparent)',
              color: 'var(--color-error)',
            }}
          >
            INSTAGRAM_TOKEN_ENC_KEY is not set in Netlify, so a token cannot be stored securely yet.
          </div>
        )}

        {!loading && status && !status.connected && (
          <div className="flex flex-col gap-3">
            <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
              Not connected. In the Meta App Dashboard open <strong>Naples Estate Jewelry Social</strong> → Instagram →
              API setup with Instagram login → <strong>Generate access tokens</strong>, then paste the token here. It is
              encrypted before storage and refreshed automatically from then on.
            </p>
            <label className="flex flex-col gap-1">
              <span className="text-[0.7rem] font-bold uppercase tracking-wide" style={{ color: 'var(--color-on-surface-variant)' }}>
                Instagram access token
              </span>
              <input
                type="password"
                autoComplete="off"
                spellCheck={false}
                className="form-field text-sm font-mono"
                value={tokenInput}
                onChange={(event) => setTokenInput(event.target.value)}
                placeholder="IGAA…"
              />
            </label>
            <button
              type="button"
              onClick={connect}
              disabled={connecting || !status.token.encryptionKeyConfigured}
              className="gold-button w-fit text-sm disabled:opacity-50"
            >
              {connecting ? 'Verifying…' : 'Connect Instagram'}
            </button>
          </div>
        )}

        {!loading && status?.status === 'needs_reauth' && (
          <div
            className="px-3 py-2 text-xs font-medium"
            style={{
              background: 'color-mix(in srgb, #b8860b 14%, transparent)',
              border: '1px solid color-mix(in srgb, #b8860b 30%, transparent)',
              color: '#8a6400',
            }}
          >
            The stored token expired or was rejected. Generate a new one in the Meta App Dashboard and paste it above.
          </div>
        )}

        {!loading && status?.connected && (
          <>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              <span style={{ color: 'var(--color-on-surface)' }}>
                Connected as <strong>@{status.account.username ?? status.account.igUserId}</strong>
                {status.account.accountType ? ` · ${status.account.accountType}` : ''}
              </span>
              {status.token.expiresAt && (
                <span style={{ color: tokenWarning ? 'var(--color-error)' : 'var(--color-on-surface-variant)' }}>
                  Token valid until {new Date(status.token.expiresAt).toLocaleDateString()}
                  {status.token.daysUntilExpiry != null ? ` (${status.token.daysUntilExpiry}d)` : ''}
                </span>
              )}
            </div>

            {!status.token.refreshCronSecretConfigured && (
              <p className="text-xs" style={{ color: 'var(--color-error)' }}>
                INSTAGRAM_CRON_SECRET is not set, so the weekly automatic token refresh cannot run. The connection will
                break when the token expires.
              </p>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={status.policy.captionIncludePrice}
                  disabled={savingPolicy}
                  onChange={(event) => void savePolicy({ captionIncludePrice: event.target.checked })}
                />
                <span style={{ color: 'var(--color-on-surface)' }}>
                  Include price in caption (&ldquo;≈ $1,718 at time of posting&rdquo;)
                </span>
              </label>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={status.policy.captionSpanishLine}
                  disabled={savingPolicy}
                  onChange={(event) => void savePolicy({ captionSpanishLine: event.target.checked })}
                />
                <span style={{ color: 'var(--color-on-surface)' }}>Add a short Spanish line</span>
              </label>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={status.policy.soldCommentEnabled}
                  disabled={savingPolicy}
                  onChange={(event) => void savePolicy({ soldCommentEnabled: event.target.checked })}
                />
                <span style={{ color: 'var(--color-on-surface)' }}>
                  Comment &ldquo;{status.policy.soldCommentText}&rdquo; when an item sells
                </span>
              </label>

              <label className="flex items-center gap-2 text-sm">
                <span style={{ color: 'var(--color-on-surface)' }}>Posts per day</span>
                <input
                  type="number"
                  min={1}
                  max={25}
                  className="form-field w-20 text-sm"
                  defaultValue={status.policy.dailyPostLimit}
                  disabled={savingPolicy}
                  onBlur={(event) => {
                    const value = Number(event.target.value);
                    if (value !== status.policy.dailyPostLimit) void savePolicy({ dailyPostLimit: value });
                  }}
                />
              </label>
            </div>

            <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
              {status.queue.approvedCount} product(s) approved and waiting in the posting queue.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              {confirmDisconnect ? (
                <>
                  <span className="text-xs" style={{ color: 'var(--color-error)' }}>
                    Disconnect Instagram? Posts already published stay on Instagram.
                  </span>
                  <button
                    type="button"
                    onClick={disconnect}
                    disabled={disconnecting}
                    className="text-xs font-bold uppercase tracking-wide disabled:opacity-50"
                    style={{ color: 'var(--color-error)', fontFamily: 'var(--font-label)' }}
                  >
                    {disconnecting ? 'Working…' : 'Yes, disconnect'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDisconnect(false)}
                    className="text-xs font-bold uppercase tracking-wide"
                    style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDisconnect(true)}
                  className="text-xs font-bold uppercase tracking-wide"
                  style={{ color: 'var(--color-error)', fontFamily: 'var(--font-label)' }}
                >
                  Disconnect
                </button>
              )}
            </div>
          </>
        )}

        {!loading && status && status.recentActivity.length > 0 && (
          <div className="border-t pt-4" style={{ borderColor: 'var(--color-outline-variant)' }}>
            <p
              className="mb-2 text-[0.65rem] font-bold uppercase tracking-[0.2em]"
              style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}
            >
              Recent activity
            </p>
            <ul className="flex flex-col gap-1 text-xs">
              {status.recentActivity.slice(0, 8).map((row) => (
                <li key={row.id} className="flex flex-wrap gap-2">
                  <span style={{ color: 'var(--color-on-surface-variant)' }}>
                    {new Date(row.createdAt).toLocaleString()}
                  </span>
                  <span
                    style={{
                      color:
                        row.outcome === 'error'
                          ? 'var(--color-error)'
                          : row.outcome === 'warning'
                            ? '#8a6400'
                            : 'var(--color-primary)',
                    }}
                  >
                    {row.action}
                  </span>
                  {row.message && <span style={{ color: 'var(--color-on-surface)' }}>{row.message}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
