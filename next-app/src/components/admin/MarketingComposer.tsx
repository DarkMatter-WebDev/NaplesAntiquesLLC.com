'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AudienceScope, MarketingSenderProfile } from '@/lib/marketing';
import { withMarketingFooter } from '@/lib/marketing-email-html';

type SettingsState = {
  mailingAddress: string | null;
  siteUrl: string;
  fromAddress: string;
  senderProfiles: Record<MarketingSenderProfile, {
    fromAddress: string;
    label: string;
    replyTo: string | null;
  }>;
  transport: 'direct' | 'broadcast';
};

const AUDIENCE_LABELS: Record<AudienceScope, string> = {
  all: 'Newsletter subscribers + account holders + past buyers',
  subscribers: 'Newsletter subscribers only',
  accounts: 'Account holders only',
  buyers: 'Past buyers only',
};

type AudienceCounts = Record<AudienceScope, number | null>;

type CampaignSuccess = {
  campaignId: string | null;
  failed: number;
  scope: AudienceScope;
  sent: number;
  subject: string;
  total: number;
};

export default function MarketingComposer() {
  const [scope, setScope] = useState<AudienceScope>('all');
  const [senderProfile, setSenderProfile] = useState<MarketingSenderProfile>('chris');
  const [subject, setSubject] = useState('');
  const [html, setHtml] = useState('');
  const [audienceCounts, setAudienceCounts] = useState<AudienceCounts>({
    all: null,
    subscribers: null,
    accounts: null,
    buyers: null,
  });
  const [settings, setSettings] = useState<SettingsState | null>(null);
  const [busy, setBusy] = useState<'count' | 'test' | 'send' | null>(null);
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);
  const [campaignSuccess, setCampaignSuccess] = useState<CampaignSuccess | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const fetchAudienceCount = useCallback(async (nextScope: AudienceScope) => {
    const res = await fetch('/api/admin/marketing/audience-count', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope: nextScope }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || `Could not count ${AUDIENCE_LABELS[nextScope].toLowerCase()}.`);
    return Number(data.count ?? 0);
  }, []);

  const refreshCounts = useCallback(async () => {
    setBusy('count');
    setNotice(null);
    try {
      const [all, subscribers, accounts, buyers] = await Promise.all([
        fetchAudienceCount('all'),
        fetchAudienceCount('subscribers'),
        fetchAudienceCount('accounts'),
        fetchAudienceCount('buyers'),
      ]);
      setAudienceCounts({ all, subscribers, accounts, buyers });
    } catch (err) {
      setNotice({ text: err instanceof Error ? err.message : 'Could not count recipients.', ok: false });
    } finally {
      setBusy(null);
    }
  }, [fetchAudienceCount]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [settingsRes, allCount, subscribersCount, accountsCount, buyersCount] = await Promise.all([
          fetch('/api/admin/marketing/settings'),
          fetchAudienceCount('all'),
          fetchAudienceCount('subscribers'),
          fetchAudienceCount('accounts'),
          fetchAudienceCount('buyers'),
        ]);
        const settingsData = await settingsRes.json().catch(() => null);
        if (!settingsRes.ok) throw new Error(settingsData?.error || 'Could not load marketing settings.');
        if (!cancelled) {
          setSettings(settingsData as SettingsState);
          setAudienceCounts({
            all: allCount,
            subscribers: subscribersCount,
            accounts: accountsCount,
            buyers: buyersCount,
          });
        }
      } catch (err) {
        if (!cancelled) setNotice({ text: err instanceof Error ? err.message : 'Could not load marketing settings.', ok: false });
      }
    })();
    return () => { cancelled = true; };
  }, [fetchAudienceCount]);

  useEffect(() => {
    if (!previewOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPreviewOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [previewOpen]);

  async function send(endpoint: 'test' | 'send') {
    if (busy !== null) return;
    if (!subject.trim()) {
      setNotice({ text: 'Add a subject before sending.', ok: false });
      return;
    }
    if (!html.trim()) {
      setNotice({ text: 'Add an email body before sending.', ok: false });
      return;
    }
    if (endpoint === 'send' && !settings?.mailingAddress) {
      setNotice({ text: 'Add a physical mailing address in Admin Settings before sending a campaign.', ok: false });
      return;
    }
    if (endpoint === 'send' && recipientCount === 0) {
      setNotice({ text: 'There are no eligible recipients for the selected audience.', ok: false });
      return;
    }

    setBusy(endpoint);
    setNotice(null);
    setCampaignSuccess(null);
    try {
      const res = await fetch(`/api/admin/marketing/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, html, scope, senderProfile }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Could not send email.');
      setNotice({
        text: endpoint === 'test'
          ? 'Test email sent to your admin email.'
          : 'Campaign sent successfully.',
        ok: true,
      });
      if (endpoint === 'send') {
        setCampaignSuccess({
          campaignId: typeof data.campaignId === 'string' ? data.campaignId : null,
          failed: Number(data.failed ?? 0),
          scope,
          sent: Number(data.sent ?? 0),
          subject,
          total: Number(data.total ?? 0),
        });
        setSubject('');
        setHtml('');
        void refreshCounts();
      }
    } catch (err) {
      setNotice({ text: err instanceof Error ? err.message : 'Could not send email.', ok: false });
    } finally {
      setBusy(null);
    }
  }

  function openPreview() {
    if (!html.trim()) {
      setNotice({ text: 'Add an email body before previewing.', ok: false });
      return;
    }
    setNotice(null);
    setPreviewOpen(true);
  }

  const recipientCount = audienceCounts[scope];
  const canAttemptAction = busy === null;
  const countLabel = (nextScope: AudienceScope) => {
    const count = audienceCounts[nextScope];
    return count === null ? 'Counting...' : `${count} ${count === 1 ? 'recipient' : 'recipients'}`;
  };
  const previewUnsubscribeUrl = `${settings?.siteUrl ?? 'https://naplesestatejewelry.com'}/unsubscribe?email=preview%40naplesestatejewelry.co`;
  const previewMailingAddress = settings?.mailingAddress || 'Mailing address preview - add the live address in Admin Settings before sending.';
  const previewSubject = subject.trim() || 'Untitled Campaign';
  const selectedSender = settings?.senderProfiles?.[senderProfile];
  const selectedFromAddress = selectedSender?.fromAddress
    ?? (senderProfile === 'chris'
      ? 'Chris at Naples Estate Jewelry <info@naplesestatejewelry.com>'
      : 'Naples Estate Jewelry <noreply@naplesestatejewelry.com>');
  const selectedReplyTo = selectedSender?.replyTo
    ?? (senderProfile === 'chris' ? 'info@naplesestatejewelry.com' : null);
  const previewHtml = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { margin: 0; background: #f6f2ea; color: #241f1a; font-family: Arial, sans-serif; }
      .email-shell { max-width: 680px; margin: 0 auto; padding: 28px 18px; }
      .email-paper { background: #fff; border: 1px solid #e4d8c3; border-radius: 18px; box-shadow: 0 18px 45px rgba(36, 31, 26, 0.08); padding: 28px; overflow-wrap: anywhere; }
      img { max-width: 100%; height: auto; }
      a { color: #735c00; }
      @media (max-width: 540px) {
        .email-shell { padding: 14px 10px; }
        .email-paper { border-radius: 14px; padding: 18px; }
      }
    </style>
  </head>
  <body>
    <div class="email-shell">
      <div class="email-paper">
        ${withMarketingFooter(html, previewUnsubscribeUrl, previewMailingAddress)}
      </div>
    </div>
  </body>
</html>`;

  return (
    <section className="rounded-[1.25rem] border bg-white p-5 md:p-6" style={{ borderColor: 'var(--color-outline-variant)' }}>
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-xl font-bold" style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}>
            Compose Campaign
          </h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
            Sends only to the centralized eligible audience and appends unsubscribe/address footer automatically.
          </p>
        </div>
        <div className="rounded-full px-3 py-1 text-xs font-bold" style={{ background: 'rgba(115, 92, 0, 0.1)', color: 'var(--color-primary)' }}>
          {recipientCount === null ? 'Counting...' : `${recipientCount} recipients`}
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

      {campaignSuccess && (
        <div
          className="mb-4 rounded-2xl border px-4 py-3"
          role="status"
          aria-live="polite"
          style={{
            background: 'color-mix(in srgb, var(--color-primary) 9%, white)',
            borderColor: 'color-mix(in srgb, var(--color-primary) 28%, transparent)',
            color: 'var(--color-on-surface)',
          }}
        >
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <p
                className="text-[0.62rem] font-bold uppercase tracking-[0.18em]"
                style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}
              >
                Campaign Sent Successfully
              </p>
              <strong className="mt-1 block text-base">{campaignSuccess.subject}</strong>
              <p className="mt-1 text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
                Sent to {AUDIENCE_LABELS[campaignSuccess.scope].toLowerCase()}.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                ['Sent', campaignSuccess.sent],
                ['Failed', campaignSuccess.failed],
                ['Total', campaignSuccess.total],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border px-3 py-2" style={{ borderColor: 'rgba(115, 92, 0, 0.14)', background: 'white' }}>
                  <span className="block text-[0.58rem] font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}>
                    {label}
                  </span>
                  <strong className="mt-1 block">{value}</strong>
                </div>
              ))}
            </div>
          </div>
          {campaignSuccess.campaignId && (
            <p className="mt-3 text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
              Campaign ID: <span className="font-mono">{campaignSuccess.campaignId}</span>
            </p>
          )}
        </div>
      )}

      {!settings?.mailingAddress && (
        <div className="mb-4 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'rgba(173, 93, 0, 0.32)', color: '#8a4f00', background: 'rgba(173, 93, 0, 0.08)' }}>
          Add a physical mailing address in Admin Settings before sending.
        </div>
      )}

      <div className="grid gap-4">
        <label>
          <span className="form-label">Audience</span>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 md:grid-cols-4" aria-label="Audience recipient counts">
            {(['all', 'subscribers', 'accounts', 'buyers'] as AudienceScope[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setScope(item)}
                className="rounded-2xl border px-3 py-2 text-left transition"
                style={{
                  borderColor: scope === item ? 'var(--color-primary)' : 'var(--color-outline-variant)',
                  background: scope === item ? 'rgba(115, 92, 0, 0.08)' : 'var(--color-surface-container-lowest)',
                  color: 'var(--color-on-surface)',
                }}
              >
                <span className="block text-[0.58rem] font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}>
                  {item === 'all' ? 'Combined' : item === 'subscribers' ? 'Newsletter' : item === 'accounts' ? 'Accounts' : 'Buyers'}
                </span>
                <strong className="mt-1 block text-sm">{countLabel(item)}</strong>
                <span className="mt-0.5 block text-[0.72rem]" style={{ color: 'var(--color-on-surface-variant)' }}>
                  {AUDIENCE_LABELS[item]}
                </span>
              </button>
            ))}
          </div>
          <select
            className="form-field mt-2 w-full"
            value={scope}
            onChange={(event) => {
              const nextScope = event.target.value as AudienceScope;
              setScope(nextScope);
            }}
          >
            <option value="all">{AUDIENCE_LABELS.all} ({countLabel('all')})</option>
            <option value="subscribers">{AUDIENCE_LABELS.subscribers} ({countLabel('subscribers')})</option>
            <option value="accounts">{AUDIENCE_LABELS.accounts} ({countLabel('accounts')})</option>
            <option value="buyers">{AUDIENCE_LABELS.buyers} ({countLabel('buyers')})</option>
          </select>
        </label>
        <label>
          <span className="form-label">Sender</span>
          <select
            className="form-field mt-2 w-full"
            value={senderProfile}
            onChange={(event) => setSenderProfile(event.target.value as MarketingSenderProfile)}
          >
            <option value="chris">Chris reply-enabled</option>
            <option value="no_reply">No-reply address</option>
          </select>
          <span className="mt-2 block text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
            From: {selectedFromAddress}
            {selectedReplyTo ? ` | Replies go to ${selectedReplyTo}` : ' | Replies are not directed to a monitored inbox'}
          </span>
        </label>
        <label>
          <span className="form-label">Subject</span>
          <input className="form-field mt-2 w-full" value={subject} onChange={(event) => setSubject(event.target.value)} maxLength={180} />
        </label>
        <label>
          <span className="form-label">Email HTML</span>
          <textarea
            className="form-field mt-2 min-h-[18rem] w-full font-mono text-sm"
            value={html}
            onChange={(event) => setHtml(event.target.value)}
            placeholder="<h1>New arrivals</h1><p>Write the campaign body here.</p>"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="outline-button"
            disabled={busy !== null}
            onClick={openPreview}
            title="Opens a rendered preview of the email HTML with the automatic footer."
          >
            Preview Email
          </button>
          <button
            type="button"
            className="outline-button"
            disabled={!canAttemptAction}
            onClick={() => void send('test')}
            title="Sends a test to your signed-in admin email after subject and body are entered."
          >
            {busy === 'test' ? 'Sending Test...' : 'Send Test'}
          </button>
          <button
            type="button"
            className="gold-button"
            disabled={!canAttemptAction}
            onClick={() => void send('send')}
            title="Sends to the selected eligible audience after subject, body, mailing address, and recipients are ready."
          >
            {busy === 'send' ? 'Sending Campaign...' : 'Send Campaign'}
          </button>
          <button type="button" className="outline-button" disabled={busy !== null} onClick={() => void refreshCounts()}>
            Refresh Counts
          </button>
        </div>
        <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
          Send buttons validate that subject, email body, mailing address, and selected audience are present before any email is sent.
        </p>
      </div>

      {previewOpen && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/45 p-3 md:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="marketing-preview-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPreviewOpen(false);
          }}
        >
          <div
            className="flex h-[86vh] w-full max-w-4xl flex-col overflow-hidden rounded-[1.25rem] border bg-white shadow-2xl"
            style={{ borderColor: 'var(--color-outline-variant)' }}
          >
            <div className="flex flex-col gap-3 border-b px-4 py-3 md:flex-row md:items-center md:justify-between" style={{ borderColor: 'var(--color-outline-variant)' }}>
              <div>
                <p className="text-[0.6rem] font-bold uppercase tracking-[0.18em]" style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}>
                  Email Preview
                </p>
                <h3 id="marketing-preview-title" className="mt-1 text-lg font-bold" style={{ color: 'var(--color-on-surface)' }}>
                  {previewSubject}
                </h3>
                <p className="mt-1 text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                  Rendered preview with unsubscribe and mailing-address footer.
                </p>
              </div>
              <button
                type="button"
                className="outline-button self-start md:self-auto"
                onClick={() => setPreviewOpen(false)}
                aria-label="Close email preview"
              >
                Close
              </button>
            </div>
            <div className="border-b px-4 py-2 text-xs" style={{ borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface-variant)' }}>
              <strong style={{ color: 'var(--color-on-surface)' }}>Subject:</strong> {previewSubject}
            </div>
            <iframe
              title="Rendered marketing email preview"
              className="min-h-0 flex-1 bg-[#f6f2ea]"
              sandbox=""
              srcDoc={previewHtml}
            />
          </div>
        </div>
      )}
    </section>
  );
}
