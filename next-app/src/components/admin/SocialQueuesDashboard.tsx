'use client';

import Image from 'next/image';
import { useState } from 'react';
import { AppIcon } from '@/components/AppIcon';
import {
  type SocialQueueChannel,
} from '@/lib/social-queue-schedule';
import SocialQueuesRefreshButton from './SocialQueuesRefreshButton';
import SocialQueueRowActions from './SocialQueueRowActions';
import AdminModal from './AdminModal';
import { useSocialBackgroundPublish } from './SocialBackgroundPublishProvider';
import SocialLatestPostsModal from './SocialLatestPostsModal';

export interface SocialQueueProductSummary {
  id: string;
  title: string;
  inventory_number: number | null;
  status: string;
  images: string[] | null;
  image_urls: string[] | null;
}

export interface SocialQueueRowSummary {
  product_id: string;
  sync_state: string;
  queued_at: string;
  scheduled_for: string | null;
  posted_caption: string | null;
  rendition_paths: string[] | null;
}

export interface SocialLatestPostSummary {
  product_id: string;
  posted_at: string;
  permalink: string | null;
}

export interface SocialQueueChannelSummary {
  channel: SocialQueueChannel;
  connected: boolean;
  accountName: string | null;
  cronConfigured: boolean;
  recentPublishedAt: string[];
  lastScheduledRunAt: string | null;
  lastScheduledRunMessage: string | null;
  rows: SocialQueueRowSummary[];
  latestPosts: SocialLatestPostSummary[];
  loadError?: string | null;
}

interface Props {
  adminBasePath: string;
  channels: SocialQueueChannelSummary[];
  products: SocialQueueProductSummary[];
  nowIso: string;
}

const EASTERN_TIME_ZONE = 'America/New_York';

function channelLabel(channel: SocialQueueChannel) {
  return channel === 'instagram' ? 'Instagram' : 'Facebook';
}

function formatDateTime(value: Date | string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: EASTERN_TIME_ZONE,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(value instanceof Date ? value : new Date(value));
}

function formatTimeUntil(value: Date, now: Date): string {
  const elapsedMinutes = Math.max(0, Math.floor((value.getTime() - now.getTime()) / 60_000));
  const days = Math.floor(elapsedMinutes / (24 * 60));
  const hours = Math.floor((elapsedMinutes % (24 * 60)) / 60);
  const minutes = elapsedMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function productImage(product: SocialQueueProductSummary | undefined): string | null {
  return product?.image_urls?.[0] ?? product?.images?.[0] ?? null;
}

function ChannelQueue({
  data,
  productsById,
  adminBasePath,
  now,
}: {
  data: SocialQueueChannelSummary;
  productsById: Map<string, SocialQueueProductSummary>;
  adminBasePath: string;
  now: Date;
}) {
  const label = channelLabel(data.channel);
  const { task: backgroundTask, startPublishBatch } = useSocialBackgroundPublish();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [confirmingBulkPublish, setConfirmingBulkPublish] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const automatic = data.connected && data.cronConfigured;
  const readyRows = data.rows.filter((row) => data.connected && Boolean(row.posted_caption && row.rendition_paths?.length));
  const selectedRows = readyRows.filter((row) => selectedIds.has(row.product_id));
  const allReadySelected = readyRows.length > 0 && selectedRows.length === readyRows.length;
  const bulkPublishRunning = backgroundTask?.status === 'running';
  const nextScheduled = data.rows
    .flatMap((row) => row.scheduled_for ? [new Date(row.scheduled_for)] : [])
    .filter((date) => date.getTime() > now.getTime())
    .sort((a, b) => a.getTime() - b.getTime())[0] ?? null;

  const toggleSelected = (productId: string) => {
    setBulkError(null);
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

  const toggleAllReady = () => {
    setBulkError(null);
    setSelectedIds(allReadySelected ? new Set() : new Set(readyRows.map((row) => row.product_id)));
  };

  const publishSelected = () => {
    setBulkError(null);
    const result = startPublishBatch(selectedRows.map((row) => ({
      channel: data.channel,
      productId: row.product_id,
      productTitle: productsById.get(row.product_id)?.title ?? row.product_id,
    })));
    if (!result.started) {
      setBulkError(result.message ?? 'Could not start these background uploads.');
      return;
    }
    setConfirmingBulkPublish(false);
    setSelectedIds(new Set());
  };

  return (
    <>
    <section className="border bg-white" style={{ borderColor: 'var(--color-outline-variant)' }}>
      <div className="grid gap-5 border-b p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start" style={{ borderColor: 'var(--color-outline-variant)' }}>
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}>
              {label}
            </h2>
            <span
              className="border px-2 py-1 text-[0.58rem] font-bold uppercase tracking-[0.16em]"
              style={{
                borderColor: data.connected ? 'var(--color-primary)' : 'var(--color-outline-variant)',
                color: data.connected ? 'var(--color-primary)' : 'var(--color-on-surface-variant)',
                fontFamily: 'var(--font-label)',
              }}
            >
              {data.connected ? 'Connected' : 'Not connected'}
            </span>
          </div>
          <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
            {data.accountName ? `${data.accountName} · ` : ''}
            Each approved post keeps its own selected posting time.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm sm:grid-cols-3 lg:min-w-[500px]">
          <div>
            <p className="text-[0.58rem] font-bold uppercase tracking-[0.18em]" style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}>Queued</p>
            <p className="mt-1 text-xl font-bold" style={{ color: 'var(--color-on-surface)' }}>{data.rows.length}</p>
          </div>
          <div>
            <p className="text-[0.58rem] font-bold uppercase tracking-[0.18em]" style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}>Last 24 hours</p>
            <p className="mt-1 text-xl font-bold" style={{ color: 'var(--color-on-surface)' }}>{data.recentPublishedAt.length}</p>
          </div>
          <div>
            <p className="text-[0.58rem] font-bold uppercase tracking-[0.18em]" style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}>Next scheduled</p>
            <p className="mt-1 font-semibold" style={{ color: automatic ? 'var(--color-primary)' : 'var(--color-on-surface-variant)' }}>
              {automatic ? (nextScheduled ? formatDateTime(nextScheduled) : 'Nothing upcoming') : 'Unavailable'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 border-b bg-[var(--color-surface-container-lowest,#fcfbf8)] px-5 py-4 text-xs md:grid-cols-3" style={{ borderColor: 'var(--color-outline-variant)' }}>
        <p style={{ color: 'var(--color-on-surface-variant)' }}>
          <strong style={{ color: 'var(--color-on-surface)' }}>Worker:</strong>{' '}
          Runs at noon, 2 PM, 4 PM, 6 PM, 8 PM, 10 PM, and midnight ET
        </p>
        <p style={{ color: 'var(--color-on-surface-variant)' }}>
          <strong style={{ color: 'var(--color-on-surface)' }}>Last worker run:</strong>{' '}
          {data.lastScheduledRunAt ? formatDateTime(data.lastScheduledRunAt) : 'No run recorded'}
        </p>
        <p style={{ color: 'var(--color-on-surface-variant)' }}>
          <strong style={{ color: 'var(--color-on-surface)' }}>Scheduler:</strong>{' '}
          {!data.connected ? `Reconnect ${label} to resume` : data.cronConfigured ? 'Ready' : 'Not configured'}
        </p>
        {data.lastScheduledRunMessage && (
          <p className="md:col-span-3" style={{ color: 'var(--color-on-surface-variant)' }}>
            Latest result: {data.lastScheduledRunMessage}
          </p>
        )}
      </div>

      {!data.loadError && data.rows.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3" style={{ borderColor: 'var(--color-outline-variant)', background: 'white' }}>
          <div className="flex flex-wrap items-center gap-4">
            <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold" style={{ color: 'var(--color-on-surface)' }}>
              <input
                type="checkbox"
                checked={allReadySelected}
                onChange={toggleAllReady}
                disabled={readyRows.length === 0 || bulkPublishRunning}
                className="h-4 w-4 accent-[var(--color-primary)] disabled:cursor-not-allowed"
              />
              Select all ready {label} posts
            </label>
            <span className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
              {selectedRows.length} selected
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setBulkError(null);
              setConfirmingBulkPublish(true);
            }}
            disabled={selectedRows.length === 0 || bulkPublishRunning}
            className="gold-button text-xs disabled:cursor-not-allowed disabled:opacity-45"
          >
            Post selected now{selectedRows.length > 0 ? ` (${selectedRows.length})` : ''}
          </button>
          {bulkError && <p className="w-full text-xs font-semibold" style={{ color: 'var(--color-error)' }}>{bulkError}</p>}
        </div>
      )}

      {data.loadError ? (
        <div className="m-5 border px-4 py-3 text-sm" style={{ borderColor: 'var(--color-error)', color: 'var(--color-error)' }}>
          Could not load the {label} queue: {data.loadError}
        </div>
      ) : data.rows.length === 0 ? (
        <div className="px-5 py-12 text-center">
          <AppIcon name="view_list" aria-hidden="true" className="mb-3 text-3xl" style={{ color: 'var(--color-outline)' }} />
          <p className="font-semibold" style={{ color: 'var(--color-on-surface)' }}>No {label} posts are waiting.</p>
          <p className="mt-1 text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
            Prepared posts appear here after you choose Schedule to posting queue.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1140px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-low)' }}>
                {['Select', 'Order', 'Item', 'Readiness', 'Scheduled for', 'Added to queue', 'Timing', 'Actions'].map((heading) => (
                  <th key={heading} className="px-4 py-3 text-[0.58rem] font-bold uppercase tracking-[0.16em]" style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}>
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row, index) => {
                const product = productsById.get(row.product_id);
                const image = productImage(product);
                const ready = Boolean(row.posted_caption && row.rendition_paths?.length);
                const scheduled = row.scheduled_for ? new Date(row.scheduled_for) : null;
                const due = scheduled ? scheduled.getTime() <= now.getTime() : false;
                const selectable = data.connected && ready;
                return (
                  <tr key={row.product_id} className="border-b last:border-b-0" style={{ borderColor: 'var(--color-outline-variant)' }}>
                    <td className="px-4 py-4 text-center align-middle">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(row.product_id)}
                        onChange={() => toggleSelected(row.product_id)}
                        disabled={!selectable || bulkPublishRunning}
                        aria-label={`Select ${product?.title ?? row.product_id} for immediate ${label} publishing`}
                        title={!selectable ? `Connect ${label} and prepare this post before selecting it.` : undefined}
                        className="h-4 w-4 accent-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-40"
                      />
                    </td>
                    <td className="px-4 py-4 align-middle">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border font-bold" style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}>
                        {index + 1}
                      </span>
                    </td>
                    <td className="px-4 py-4 align-middle">
                      <div className="flex min-w-[280px] items-center gap-3">
                        <div className="relative h-16 w-16 flex-none overflow-hidden border bg-[var(--color-surface-container)]" style={{ borderColor: 'var(--color-outline-variant)' }}>
                          {image ? (
                            <Image src={image} alt="" fill unoptimized sizes="64px" className="object-contain" />
                          ) : (
                            <span className="flex h-full items-center justify-center text-[0.55rem] uppercase tracking-wider" style={{ color: 'var(--color-on-surface-variant)' }}>No photo</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold" style={{ color: 'var(--color-on-surface)' }}>{product?.title ?? row.product_id}</p>
                          <p className="mt-1 text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                            {product?.inventory_number ? `Item ${product.inventory_number} · ` : ''}{product?.status ?? 'Product unavailable'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 align-middle">
                      <span className="border px-2 py-1 text-[0.58rem] font-bold uppercase tracking-[0.14em]" style={{ borderColor: ready ? 'var(--color-primary)' : 'var(--color-error)', color: ready ? 'var(--color-primary)' : 'var(--color-error)', fontFamily: 'var(--font-label)' }}>
                        {ready ? 'Ready' : 'Needs preparation'}
                      </span>
                    </td>
                    <td className="px-4 py-4 align-middle whitespace-nowrap font-semibold" style={{ color: scheduled ? 'var(--color-on-surface)' : 'var(--color-error)' }}>
                      {scheduled ? formatDateTime(scheduled) : 'Choose a time'}
                    </td>
                    <td className="px-4 py-4 align-middle whitespace-nowrap" style={{ color: 'var(--color-on-surface-variant)' }}>
                      {formatDateTime(row.queued_at)}
                    </td>
                    <td className="px-4 py-4 align-middle min-w-[205px]" style={{ color: 'var(--color-on-surface)' }}>
                      {!ready
                        ? 'Needs preparation'
                        : !automatic
                          ? 'Automatic posting unavailable'
                          : !scheduled
                            ? 'Not scheduled'
                            : due
                              ? 'Due now - waiting for the worker'
                              : `Posts in ${formatTimeUntil(scheduled, now)}`}
                    </td>
                    <td className="px-4 py-4 text-right align-middle">
                      <SocialQueueRowActions
                        channel={data.channel}
                        productId={row.product_id}
                        productTitle={product?.title ?? row.product_id}
                        scheduledFor={row.scheduled_for}
                        manageHref={`${adminBasePath}/products/${encodeURIComponent(row.product_id)}/${data.channel}?returnTo=social-queues`}
                        canPublishNow={data.connected && ready}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
    {confirmingBulkPublish && (
      <AdminModal title={`Post ${selectedRows.length} selected ${label} posts now`} onClose={() => setConfirmingBulkPublish(false)}>
        <div className="flex flex-col gap-4">
          <p className="text-sm leading-relaxed" style={{ color: 'var(--color-on-surface)' }}>
            Publish all <strong>{selectedRows.length} selected posts</strong> to {label} now? They will post one at a time in queue order, bypassing their scheduled times. This window will minimize into the background progress widget.
          </p>
          <ol className="max-h-48 list-decimal overflow-y-auto pl-5 text-xs leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>
            {selectedRows.map((row) => (
              <li key={row.product_id}>{productsById.get(row.product_id)?.title ?? row.product_id}</li>
            ))}
          </ol>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--color-error)' }}>
            {data.channel === 'instagram'
              ? 'Instagram captions cannot be edited after publishing, and Instagram’s API cannot delete these posts. If one upload fails, the batch stops there and can resume without reposting completed items.'
              : 'Review every prepared post carefully. If one upload fails, the batch stops there and can resume without reposting completed items.'}
          </p>
          {bulkError && <p className="text-xs font-semibold" style={{ color: 'var(--color-error)' }}>{bulkError}</p>}
          <div className="flex flex-wrap justify-end gap-2 border-t pt-4" style={{ borderColor: 'var(--color-outline-variant)' }}>
            <button type="button" onClick={() => setConfirmingBulkPublish(false)} className="outline-button text-sm">Cancel</button>
            <button type="button" onClick={publishSelected} disabled={selectedRows.length === 0 || bulkPublishRunning} className="gold-button text-sm disabled:opacity-50">
              Yes, post all in background
            </button>
          </div>
        </div>
      </AdminModal>
    )}
    </>
  );
}

export default function SocialQueuesDashboard({ adminBasePath, channels, products, nowIso }: Props) {
  const [latestPostsOpen, setLatestPostsOpen] = useState(false);
  const now = new Date(nowIso);
  const productsById = new Map(products.map((product) => [product.id, product]));
  const totalQueued = channels.reduce((sum, channel) => sum + channel.rows.length, 0);
  const nextScheduledPost = channels
    .filter((channel) => channel.connected && channel.cronConfigured)
    .flatMap((channel) => channel.rows)
    .flatMap((row) => row.scheduled_for ? [new Date(row.scheduled_for)] : [])
    .filter((date) => date.getTime() > now.getTime())
    .sort((a, b) => a.getTime() - b.getTime())[0] ?? null;

  return (
    <>
    <main className="px-4 py-8 md:px-8">
      <div className="ultrawide-page-wide mx-auto max-w-[1800px]">
        <div className="mb-8 grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <p className="mb-3 text-[0.65rem] font-bold uppercase tracking-[0.35em]" style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}>
              Admin Center
            </p>
            <h1 className="text-3xl font-bold md:text-4xl" style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}>
              Social Media Queues
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>
              Review, edit, post now, reschedule, or remove every approved Instagram and Facebook post. All posting times are shown in Eastern Time.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 lg:justify-end">
            <div className="border bg-white px-4 py-3" style={{ borderColor: 'var(--color-outline-variant)' }}>
              <p className="text-[0.58rem] font-bold uppercase tracking-[0.18em]" style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}>Across both channels</p>
              <p className="mt-1 text-lg font-bold" style={{ color: 'var(--color-on-surface)' }}>{totalQueued} queued</p>
            </div>
            <div className="border bg-white px-4 py-3" style={{ borderColor: 'var(--color-outline-variant)' }}>
              <p className="text-[0.58rem] font-bold uppercase tracking-[0.18em]" style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}>Next scheduled post</p>
              <p className="mt-1 text-sm font-bold" style={{ color: 'var(--color-primary)' }}>{nextScheduledPost ? formatDateTime(nextScheduledPost) : 'Nothing upcoming'}</p>
            </div>
            <SocialQueuesRefreshButton />
            <button type="button" onClick={() => setLatestPostsOpen(true)} className="outline-button text-xs">
              Latest Posts
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          {channels.map((channel) => (
            <ChannelQueue key={channel.channel} data={channel} productsById={productsById} adminBasePath={adminBasePath} now={now} />
          ))}
        </div>

        <p className="mt-5 text-xs leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>
          The worker never publishes before the selected time. A disconnected channel, provider failures, Instagram&apos;s provider-enforced publishing quota, or an unavailable worker can delay a due post.
        </p>
      </div>
    </main>
    {latestPostsOpen && (
      <SocialLatestPostsModal
        adminBasePath={adminBasePath}
        channels={channels}
        products={products}
        onClose={() => setLatestPostsOpen(false)}
      />
    )}
    </>
  );
}
