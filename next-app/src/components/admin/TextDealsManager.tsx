'use client';

import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { formatUsPhone } from '@/lib/subscriber-phone';
import { DEFAULT_DEAL_MESSAGE, DEAL_MESSAGE_MAX, DEAL_TITLE_MAX } from '@/lib/text-alerts/deal-input';
import { DEFAULT_SOLD_REPLY, dealText } from '@/lib/text-alerts/messages';

/**
 * Admin → Text Deals (owner mockup v2 sections 3b + 3c, 2026-09-15).
 *
 * Left: the composer (photo, price, one line, message) → Preview renders the
 * picture on the server → Send a test to the owner's cell → Send to N.
 * Right: the deal list; a selected deal shows its send tally and the replies
 * in clock order with the first flagged, plus Mark sold / Mark available.
 * Sold sends the polite one-liner to anyone who answers late (wording
 * editable, owner's call 2026-09-15).
 */
type Deal = {
  id: string;
  title: string;
  price_text: string;
  message: string;
  photo_path: string | null;
  card_path: string | null;
  status: 'draft' | 'sending' | 'sent' | 'sold';
  recipients_count: number;
  sent_at: string | null;
  sold_at: string | null;
  sold_to_phone: string | null;
  sold_reply_text: string | null;
  created_at: string;
};

type Reply = {
  id: number;
  from_phone: string;
  body: string | null;
  num_media: number;
  received_at: string;
  forwarded_at: string | null;
  forward_error: string | null;
  auto_reply_sent_at: string | null;
  name: string | null;
  first: boolean;
};

type Detail = { deal: Deal & { card_url: string | null; photo_url: string | null }; tally: Record<string, number>; replies: Reply[] };

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York',
});
const formatWhen = (value: string | null) => (value ? dateFormatter.format(new Date(value)) : '');

const STATUS_LABEL: Record<Deal['status'], string> = { draft: 'Draft', sending: 'Sending…', sent: 'Sent', sold: 'Sold' };

async function readJson(res: Response) {
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status}).`);
  return data;
}

export default function TextDealsManager({ configured, forwardTo }: { configured: boolean; forwardTo: string }) {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [confirmed, setConfirmed] = useState(0);
  const [pending, setPending] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // Composer state (a draft is created on the first save so the photo has a home).
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [message, setMessage] = useState(DEFAULT_DEAL_MESSAGE);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [cardUrl, setCardUrl] = useState<string | null>(null);
  const [cardBytes, setCardBytes] = useState<number | null>(null);
  const [soldReply, setSoldReply] = useState(DEFAULT_SOLD_REPLY);

  const loadList = useCallback(async () => {
    const data = await readJson(await fetch('/api/admin/text-deals'));
    setDeals(data.deals ?? []);
    setConfirmed(data.confirmed ?? 0);
    setPending(data.pending ?? 0);
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    setDetail((current) => (current?.deal.id === id ? current : null));
    const data = (await readJson(await fetch(`/api/admin/text-deals/${id}`))) as Detail;
    setDetail(data);
    setSoldReply(data.deal.sold_reply_text || DEFAULT_SOLD_REPLY);
  }, []);

  // Loads run from a queued callback, not the effect body (react-hooks/set-state-in-effect).
  useEffect(() => {
    queueMicrotask(() => {
      loadList().catch((err) => setNotice({ text: err instanceof Error ? err.message : 'Could not load deals.', ok: false }));
    });
  }, [loadList]);

  useEffect(() => {
    if (!selectedId) return;
    queueMicrotask(() => {
      loadDetail(selectedId).catch((err) => setNotice({ text: err instanceof Error ? err.message : 'Could not load the deal.', ok: false }));
    });
  }, [selectedId, loadDetail]);

  // Live text preview of what rides with the picture.
  const previewText = useMemo(() => dealText({ title: title || '…', price: price ? (price.startsWith('$') ? price : `$${price}`) : '$…', message }), [title, price, message]);

  async function saveDraft(): Promise<string> {
    const payload = { title, price, message };
    if (draftId) {
      const data = await readJson(await fetch(`/api/admin/text-deals/${draftId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }));
      setCardUrl(null);
      setDeals((current) => current.map((d) => (d.id === draftId ? data.deal : d)));
      return draftId;
    }
    const data = await readJson(await fetch('/api/admin/text-deals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }));
    setDraftId(data.deal.id);
    setDeals((current) => [data.deal, ...current]);
    return data.deal.id as string;
  }

  async function onPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy('photo');
    setNotice(null);
    try {
      const id = await saveDraft();
      const data = await readJson(await fetch(`/api/admin/text-deals/photo?dealId=${encodeURIComponent(id)}`, { method: 'POST', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file }));
      setPhotoUrl(data.url);
      setCardUrl(null);
      setNotice({ text: 'Photo saved. Preview to see the price on it.', ok: true });
    } catch (err) {
      setNotice({ text: err instanceof Error ? err.message : 'Could not upload the photo.', ok: false });
    } finally {
      setBusy(null);
    }
  }

  async function onPreview(event?: FormEvent) {
    event?.preventDefault();
    setBusy('preview');
    setNotice(null);
    try {
      const id = await saveDraft();
      if (!photoUrl) throw new Error('Add a photo first.');
      const data = await readJson(await fetch('/api/admin/text-deals/preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dealId: id }) }));
      setCardUrl(`${data.url}?v=${Date.now()}`);
      setCardBytes(data.bytes);
      setNotice({ text: `Picture ready (${Math.round(data.bytes / 1024)} KB).`, ok: true });
    } catch (err) {
      setNotice({ text: err instanceof Error ? err.message : 'Could not render the picture.', ok: false });
    } finally {
      setBusy(null);
    }
  }

  async function onTest() {
    if (!draftId) { setNotice({ text: 'Preview first.', ok: false }); return; }
    setBusy('test');
    setNotice(null);
    try {
      const data = await readJson(await fetch(`/api/admin/text-deals/${draftId}/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ test: true }) }));
      setNotice({ text: `Test sent to ${formatUsPhone(data.to)}.`, ok: true });
    } catch (err) {
      setNotice({ text: err instanceof Error ? err.message : 'Could not send the test.', ok: false });
    } finally {
      setBusy(null);
    }
  }

  async function onSend() {
    if (!draftId || !cardUrl) { setNotice({ text: 'Preview first, then send.', ok: false }); return; }
    if (!window.confirm(`Send this deal to ${confirmed} confirmed number${confirmed === 1 ? '' : 's'}?`)) return;
    setBusy('send');
    setNotice(null);
    try {
      const data = await readJson(await fetch(`/api/admin/text-deals/${draftId}/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) }));
      setNotice({ text: data.finished ? `Sent to ${data.sent}${data.failed ? `, ${data.failed} failed` : ''}.` : `Sending: ${data.sent} so far, ${data.remaining} to go (the sweep finishes it).`, ok: true });
      const id = draftId;
      setDraftId(null); setTitle(''); setPrice(''); setMessage(DEFAULT_DEAL_MESSAGE); setPhotoUrl(null); setCardUrl(null); setCardBytes(null);
      await loadList();
      setSelectedId(id);
    } catch (err) {
      setNotice({ text: err instanceof Error ? err.message : 'Could not send the deal.', ok: false });
    } finally {
      setBusy(null);
    }
  }

  async function setSold(action: 'sold' | 'available', soldToPhone?: string) {
    if (!detail) return;
    setBusy(action);
    setNotice(null);
    try {
      await readJson(await fetch(`/api/admin/text-deals/${detail.deal.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, soldToPhone, replyText: soldReply }) }));
      await Promise.all([loadList(), loadDetail(detail.deal.id)]);
      setNotice({ text: action === 'sold' ? 'Marked sold. Late replies get the auto-reply.' : 'Marked available again.', ok: true });
    } catch (err) {
      setNotice({ text: err instanceof Error ? err.message : 'Could not update the deal.', ok: false });
    } finally {
      setBusy(null);
    }
  }

  const label = 'block text-[0.62rem] font-bold uppercase tracking-[0.2em] mb-1';
  const labelStyle = { color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' } as const;

  return (
    <>
      {notice && (
        <div className="mb-4 rounded-lg px-3 py-2 text-sm" role="status" style={{ background: notice.ok ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)' : 'color-mix(in srgb, var(--color-error) 10%, transparent)', color: notice.ok ? 'var(--color-primary)' : 'var(--color-error)' }}>
          {notice.text}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <form className="rounded-[1.25rem] border bg-white p-5 grid gap-4" style={{ borderColor: 'var(--color-outline-variant)' }} onSubmit={onPreview}>
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-lg font-bold" style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}>New text deal</h2>
            <span className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>{confirmed} confirmed · {pending} pending YES</span>
          </div>

          <label className="block">
            <span className={label} style={labelStyle}>Photo</span>
            <input type="file" accept="image/*" onChange={onPhoto} disabled={busy !== null} className="block w-full text-sm" />
            <span className="mt-1 block text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>Any phone photo. It is resized and kept small enough for every carrier.</span>
          </label>

          <div className="grid gap-3 sm:grid-cols-[130px_1fr]">
            <label className="block">
              <span className={label} style={labelStyle}>Price</span>
              <input className="form-field w-full" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="1460" required />
            </label>
            <label className="block">
              <span className={label} style={labelStyle}>One line</span>
              <input className="form-field w-full" value={title} maxLength={DEAL_TITLE_MAX} onChange={(e) => setTitle(e.target.value)} placeholder="14K rope chain · 22 in · 18.4 g" required />
            </label>
          </div>

          <label className="block">
            <span className={label} style={labelStyle}>Message</span>
            <textarea className="form-field w-full min-h-[72px]" value={message} maxLength={DEAL_MESSAGE_MAX} onChange={(e) => setMessage(e.target.value)} />
            <span className="mt-1 block text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>&quot;Reply STOP to opt out&quot; is added automatically.</span>
          </label>

          <div className="rounded-lg border px-3 py-2 text-xs" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-low)', color: 'var(--color-on-surface)' }}>
            <span className="font-bold">Text as it will read:</span> {previewText}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 items-start">
            <div>
              <span className={label} style={labelStyle}>Photo</span>
              {photoUrl ? <img src={photoUrl} alt="" className="w-full rounded-lg border" style={{ borderColor: 'var(--color-outline-variant)' }} /> : <div className="rounded-lg border border-dashed p-6 text-center text-xs" style={{ borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface-variant)' }}>No photo yet</div>}
            </div>
            <div>
              <span className={label} style={labelStyle}>Picture message{cardBytes ? ` · ${Math.round(cardBytes / 1024)} KB` : ''}</span>
              {cardUrl ? <img src={cardUrl} alt="Deal picture preview" className="w-full rounded-lg border" style={{ borderColor: 'var(--color-outline-variant)' }} /> : <div className="rounded-lg border border-dashed p-6 text-center text-xs" style={{ borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface-variant)' }}>Preview to render</div>}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="submit" className="outline-button text-xs" disabled={busy !== null}>{busy === 'preview' ? 'Rendering…' : 'Preview'}</button>
            <button type="button" className="outline-button text-xs" onClick={onTest} disabled={busy !== null || !configured || !cardUrl} title={configured ? '' : 'Twilio is not configured yet'}>
              {busy === 'test' ? 'Sending…' : `Send a test to ${formatUsPhone(forwardTo)}`}
            </button>
            <button type="button" className="gold-button text-xs" onClick={onSend} disabled={busy !== null || !configured || !cardUrl || confirmed === 0}>
              {busy === 'send' ? 'Sending…' : `Send to ${confirmed}`}
            </button>
          </div>
        </form>

        <div className="grid gap-4 content-start">
          <div className="rounded-[1.25rem] border bg-white p-5" style={{ borderColor: 'var(--color-outline-variant)' }}>
            <h2 className="text-lg font-bold mb-3" style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}>Deals</h2>
            {deals.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>No deals yet.</p>
            ) : (
              <ul className="divide-y" style={{ borderColor: 'var(--color-outline-variant)' }}>
                {deals.map((deal) => (
                  <li key={deal.id}>
                    <button type="button" onClick={() => setSelectedId(deal.id)} className="w-full text-left py-2 flex items-center justify-between gap-3 hover:opacity-80" style={{ color: 'var(--color-on-surface)' }}>
                      <span className="text-sm"><span className="font-semibold">{deal.price_text}</span> · {deal.title}</span>
                      <span className="text-[0.6rem] font-bold uppercase tracking-[0.12em] whitespace-nowrap" style={{ color: deal.status === 'sold' ? 'var(--color-error)' : 'var(--color-on-surface-variant)' }}>
                        {STATUS_LABEL[deal.status]}{deal.sent_at ? ` · ${formatWhen(deal.sent_at)}` : ''}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {detail && selectedId === detail.deal.id && (
            <div className="rounded-[1.25rem] border bg-white p-5 grid gap-3" style={{ borderColor: 'var(--color-outline-variant)' }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold" style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}>{detail.deal.price_text} · {detail.deal.title}</h3>
                  <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                    {STATUS_LABEL[detail.deal.status]}{detail.deal.sent_at ? ` · sent ${formatWhen(detail.deal.sent_at)} to ${detail.deal.recipients_count}` : ''}
                    {Object.keys(detail.tally).length > 0 && ` · ${Object.entries(detail.tally).map(([k, v]) => `${v} ${k}`).join(', ')}`}
                  </p>
                </div>
                {detail.deal.card_url && <img src={detail.deal.card_url} alt="" className="w-20 rounded border" style={{ borderColor: 'var(--color-outline-variant)' }} />}
              </div>

              <div>
                <span className={label} style={labelStyle}>Replies · first one flagged · all forwarded to {formatUsPhone(forwardTo)}</span>
                {detail.replies.length === 0 ? (
                  <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>No replies yet.</p>
                ) : (
                  <ul className="divide-y" style={{ borderColor: 'var(--color-outline-variant)' }}>
                    {detail.replies.map((reply) => (
                      <li key={reply.id} className="py-2 grid grid-cols-[auto_1fr_auto] gap-3 items-baseline text-sm" style={reply.first ? { background: '#fffbe8', margin: '0 -0.75rem', padding: '0.5rem 0.75rem', borderLeft: '3px solid var(--color-primary-container)' } : undefined}>
                        <span className="font-semibold whitespace-nowrap">{reply.name ?? formatUsPhone(reply.from_phone)}{reply.first && <span className="ml-1 text-[0.55rem] font-extrabold uppercase tracking-[0.16em]" style={{ color: 'var(--color-primary)' }}>1st</span>}</span>
                        <span>{reply.body || (reply.num_media ? '(photo)' : '(empty)')}{reply.auto_reply_sent_at ? <span className="ml-1 text-xs italic" style={{ color: 'var(--color-on-surface-variant)' }}>· sold reply sent</span> : null}{reply.forward_error ? <span className="ml-1 text-xs" style={{ color: 'var(--color-error)' }}>· not forwarded</span> : null}</span>
                        <span className="text-xs whitespace-nowrap" style={{ color: 'var(--color-on-surface-variant)' }}>{formatWhen(reply.received_at)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {detail.deal.status !== 'draft' && (
                <div className="grid gap-2">
                  <label className="block">
                    <span className={label} style={labelStyle}>Auto-reply to late responders</span>
                    <input className="form-field w-full" value={soldReply} onChange={(e) => setSoldReply(e.target.value)} maxLength={200} />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {detail.deal.status === 'sold' ? (
                      <button type="button" className="outline-button text-xs" onClick={() => setSold('available')} disabled={busy !== null}>Mark still available</button>
                    ) : (
                      <button type="button" className="gold-button text-xs" onClick={() => setSold('sold', detail.replies.find((r) => r.first)?.from_phone)} disabled={busy !== null}>
                        {detail.replies.find((r) => r.first) ? `Mark sold to ${detail.replies.find((r) => r.first)?.name ?? formatUsPhone(detail.replies.find((r) => r.first)!.from_phone)}` : 'Mark sold'}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
