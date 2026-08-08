'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AppIcon } from '@/components/AppIcon';
import type {
  SocialLatestPostSummary,
  SocialQueueChannelSummary,
  SocialQueueProductSummary,
} from './SocialQueuesDashboard';
import AdminModal from './AdminModal';

type Channel = SocialQueueChannelSummary['channel'];

interface SelectedAction {
  type: 'comment' | 'remove';
  channel: Channel;
  post: SocialLatestPostSummary;
}

interface Props {
  adminBasePath: string;
  channels: SocialQueueChannelSummary[];
  products: SocialQueueProductSummary[];
  onClose: () => void;
}

const LABELS: Record<Channel, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
};

const EASTERN_TIME_ZONE = 'America/New_York';

function postKey(channel: Channel, productId: string) {
  return `${channel}:${productId}`;
}

function formatPostedAt(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: EASTERN_TIME_ZONE,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(value));
}

function productImage(product: SocialQueueProductSummary | undefined) {
  return product?.image_urls?.[0] ?? product?.images?.[0] ?? null;
}

export default function SocialLatestPostsModal({ adminBasePath, channels, products, onClose }: Props) {
  const router = useRouter();
  const productsById = new Map(products.map((product) => [product.id, product]));
  const [selectedAction, setSelectedAction] = useState<SelectedAction | null>(null);
  const [comment, setComment] = useState('');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(() => new Set());
  const [collapsedChannels, setCollapsedChannels] = useState<Set<Channel>>(() => new Set());
  const [messages, setMessages] = useState<Record<string, { tone: 'ok' | 'error'; text: string }>>({});

  const setMessage = (key: string, tone: 'ok' | 'error', text: string) => {
    setMessages((current) => ({ ...current, [key]: { tone, text } }));
  };

  const toggleChannel = (channel: Channel) => {
    setCollapsedChannels((current) => {
      const next = new Set(current);
      if (next.has(channel)) next.delete(channel);
      else next.add(channel);
      return next;
    });
  };

  const request = async (channel: Channel, path: 'refresh-status' | 'delete' | 'comment', body: Record<string, unknown>) => {
    const response = await fetch(`/api/admin/${channel}/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.message || data?.error || `Could not update this ${LABELS[channel]} post.`);
    return data;
  };

  const refreshStatus = async (channel: Channel, post: SocialLatestPostSummary) => {
    const key = postKey(channel, post.product_id);
    setBusyKey(key);
    setMessage(key, 'ok', 'Checking the live post…');
    try {
      const data = await request(channel, 'refresh-status', { productId: post.product_id });
      setMessage(key, 'ok', data?.message || 'Status refreshed.');
      if (data?.syncState && data.syncState !== 'published') {
        setHiddenKeys((current) => new Set(current).add(key));
      }
      router.refresh();
    } catch (error) {
      setMessage(key, 'error', error instanceof Error ? error.message : 'Could not refresh this status.');
    } finally {
      setBusyKey(null);
    }
  };

  const postComment = async () => {
    if (!selectedAction || selectedAction.type !== 'comment') return;
    const trimmed = comment.trim();
    if (!trimmed) return;
    const { channel, post } = selectedAction;
    const key = postKey(channel, post.product_id);
    setBusyKey(key);
    try {
      const data = await request(channel, 'comment', { productId: post.product_id, comment: trimmed });
      setMessage(key, 'ok', data?.message || `Comment posted to ${LABELS[channel]}.`);
      setSelectedAction(null);
      setComment('');
    } catch (error) {
      setMessage(key, 'error', error instanceof Error ? error.message : 'Could not post this comment.');
    } finally {
      setBusyKey(null);
    }
  };

  const removeFacebookPost = async () => {
    if (!selectedAction || selectedAction.type !== 'remove' || selectedAction.channel !== 'facebook') return;
    const { post } = selectedAction;
    const key = postKey('facebook', post.product_id);
    setBusyKey(key);
    try {
      const data = await request('facebook', 'delete', { productId: post.product_id, confirm: true });
      setHiddenKeys((current) => new Set(current).add(key));
      setMessage(key, 'ok', data?.message || 'Facebook post removed.');
      setSelectedAction(null);
      router.refresh();
    } catch (error) {
      setMessage(key, 'error', error instanceof Error ? error.message : 'Could not remove this Facebook post.');
    } finally {
      setBusyKey(null);
    }
  };

  const selectedProduct = selectedAction ? productsById.get(selectedAction.post.product_id) : undefined;
  const selectedLabel = selectedAction ? LABELS[selectedAction.channel] : '';
  const selectedMessage = selectedAction ? messages[postKey(selectedAction.channel, selectedAction.post.product_id)] : undefined;
  const modalTitle = selectedAction?.type === 'comment'
    ? `Comment on ${selectedLabel} post`
    : selectedAction?.type === 'remove'
      ? 'Remove Facebook post'
      : 'Latest Posts';

  return (
    <AdminModal title={modalTitle} onClose={busyKey ? () => undefined : onClose} maxWidth="max-w-[min(1120px,calc(100vw-2rem))]">
      {selectedAction?.type === 'comment' ? (
        <div className="flex flex-col gap-4">
          <div>
            <p className="font-semibold" style={{ color: 'var(--color-on-surface)' }}>{selectedProduct?.title ?? selectedAction.post.product_id}</p>
            <p className="mt-1 text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
              This comment will be posted publicly by Naples Estate Jewelry on {selectedLabel}.
            </p>
          </div>
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            maxLength={1_000}
            rows={5}
            autoFocus
            placeholder="Write a public comment…"
            className="w-full resize-y border bg-white p-3 text-sm outline-none focus:ring-2"
            style={{ borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface)' }}
          />
          <div className="flex items-center justify-between gap-4 text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
            <span>Review carefully before posting.</span>
            <span>{comment.length} / 1000</span>
          </div>
          {selectedMessage && <p className="text-xs font-semibold" style={{ color: selectedMessage.tone === 'error' ? 'var(--color-error)' : 'var(--color-primary)' }}>{selectedMessage.text}</p>}
          <div className="flex flex-wrap justify-end gap-2 border-t pt-4" style={{ borderColor: 'var(--color-outline-variant)' }}>
            <button type="button" onClick={() => { setSelectedAction(null); setComment(''); }} disabled={Boolean(busyKey)} className="outline-button text-sm disabled:opacity-50">Back</button>
            <button type="button" onClick={() => void postComment()} disabled={Boolean(busyKey) || !comment.trim()} className="gold-button text-sm disabled:opacity-50">
              {busyKey ? 'Posting…' : `Post comment to ${selectedLabel}`}
            </button>
          </div>
        </div>
      ) : selectedAction?.type === 'remove' ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm leading-relaxed" style={{ color: 'var(--color-on-surface)' }}>
            Permanently remove <strong>{selectedProduct?.title ?? selectedAction.post.product_id}</strong> from Facebook? Its reactions and comments will also be lost.
          </p>
          <p className="text-xs font-semibold" style={{ color: 'var(--color-error)' }}>This cannot be undone.</p>
          {selectedMessage && <p className="text-xs font-semibold" style={{ color: selectedMessage.tone === 'error' ? 'var(--color-error)' : 'var(--color-primary)' }}>{selectedMessage.text}</p>}
          <div className="flex flex-wrap justify-end gap-2 border-t pt-4" style={{ borderColor: 'var(--color-outline-variant)' }}>
            <button type="button" onClick={() => setSelectedAction(null)} disabled={Boolean(busyKey)} className="outline-button text-sm disabled:opacity-50">Back</button>
            <button type="button" onClick={() => void removeFacebookPost()} disabled={Boolean(busyKey)} className="outline-button social-danger-button text-sm disabled:opacity-50">
              {busyKey ? 'Removing…' : 'Yes, remove Facebook post'}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex max-h-[72vh] flex-col gap-6 overflow-y-auto pr-1">
          <p className="text-sm leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>
            The 12 most recent locally recorded live posts from each channel. Refresh checks Meta without changing a confirmed live post.
          </p>
          {channels.map((channel) => {
            const label = LABELS[channel.channel];
            const visiblePosts = channel.latestPosts.filter((post) => !hiddenKeys.has(postKey(channel.channel, post.product_id)));
            const collapsed = collapsedChannels.has(channel.channel);
            const panelId = `latest-${channel.channel}-posts`;
            return (
              <section key={channel.channel}>
                <button
                  type="button"
                  onClick={() => toggleChannel(channel.channel)}
                  aria-expanded={!collapsed}
                  aria-controls={panelId}
                  className={`flex w-full items-center justify-between gap-3 border-b px-1 py-2 text-left transition-colors hover:bg-black/[0.025] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2${collapsed ? '' : ' mb-3'}`}
                  style={{ borderColor: 'var(--color-outline-variant)', outlineColor: 'var(--color-primary)' }}
                >
                  <h3 className="text-xl font-bold" style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}>{label}</h3>
                  <span className="flex items-center gap-2">
                    <span className="text-xs font-semibold" style={{ color: 'var(--color-on-surface-variant)' }}>{visiblePosts.length} shown</span>
                    <AppIcon name={collapsed ? 'expand_more' : 'expand_less'} className="text-xl" aria-hidden="true" />
                  </span>
                </button>
                <div id={panelId} hidden={collapsed}>
                  {visiblePosts.length === 0 ? (
                    <p className="border px-4 py-6 text-center text-sm" style={{ borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface-variant)' }}>No published {label} posts are currently recorded.</p>
                  ) : (
                    <div className="grid gap-3 lg:grid-cols-2">
                    {visiblePosts.map((post) => {
                      const key = postKey(channel.channel, post.product_id);
                      const product = productsById.get(post.product_id);
                      const image = productImage(product);
                      const message = messages[key];
                      const busy = busyKey === key;
                      return (
                        <article key={key} className="border p-3" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
                          <div className="flex gap-3">
                            <div className="relative h-20 w-20 flex-none overflow-hidden border bg-white" style={{ borderColor: 'var(--color-outline-variant)' }}>
                              {image ? <Image src={image} alt="" fill unoptimized sizes="80px" className="object-contain" /> : <span className="flex h-full items-center justify-center text-[0.55rem] uppercase">No photo</span>}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold leading-snug" style={{ color: 'var(--color-on-surface)' }}>{product?.title ?? post.product_id}</p>
                              <p className="mt-1 text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                                {product?.inventory_number ? `Item ${product.inventory_number} · ` : ''}{formatPostedAt(post.posted_at)}
                              </p>
                            </div>
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                            {post.permalink && <a href={post.permalink} target="_blank" rel="noopener noreferrer" className="outline-button text-[0.62rem]">View post <AppIcon name="arrow_outward" aria-hidden="true" /></a>}
                            <button type="button" onClick={() => { setComment(''); setSelectedAction({ type: 'comment', channel: channel.channel, post }); }} disabled={busy} className="outline-button text-[0.62rem] disabled:opacity-50">Comment</button>
                            <Link href={`${adminBasePath}/products/${encodeURIComponent(post.product_id)}/${channel.channel}?returnTo=social-queues`} className="outline-button text-[0.62rem]">Manage</Link>
                            <button type="button" onClick={() => void refreshStatus(channel.channel, post)} disabled={busy} className="outline-button text-[0.62rem] disabled:opacity-50">{busy ? 'Checking…' : 'Refresh status'}</button>
                            {channel.channel === 'facebook' ? (
                              <button type="button" onClick={() => setSelectedAction({ type: 'remove', channel: 'facebook', post })} disabled={busy} className="outline-button social-danger-button text-[0.62rem] disabled:opacity-50">Remove</button>
                            ) : post.permalink ? (
                              <a href={post.permalink} target="_blank" rel="noopener noreferrer" className="outline-button social-danger-button text-[0.62rem]">Open to remove <AppIcon name="arrow_outward" aria-hidden="true" /></a>
                            ) : null}
                          </div>
                          {channel.channel === 'instagram' && (
                            <p className="mt-2 text-[0.68rem] leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>Instagram removal happens in Instagram; return here and Refresh status afterward.</p>
                          )}
                          {message && <p className="mt-2 text-xs font-semibold" style={{ color: message.tone === 'error' ? 'var(--color-error)' : 'var(--color-primary)' }}>{message.text}</p>}
                        </article>
                      );
                    })}
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </AdminModal>
  );
}
