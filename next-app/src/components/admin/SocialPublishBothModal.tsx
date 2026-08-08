'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import AdminModal from './AdminModal';
import SocialScheduleModal, { type SocialScheduleValues } from './SocialScheduleModal';
import {
  canQueueBothSocialChannels,
  otherSocialPublishChannel,
  selectCrossChannelCaptionOpening,
  socialCaptionOpeningsMatch,
  type SocialPublishChannel,
  type SocialCombinedChannelStatus,
} from '@/lib/social-publish-both';

/**
 * Review, queue, and publish surface for BOTH social channels at once, opened from
 * either product panel ("Publish to both…").
 *
 * Read-only by design: captions and slides are shown side by side for one
 * final review, but all editing (lineup, crops, card) stays in the per-channel
 * panels. Prepare and the three explicit cross-channel sync choices rebuild
 * the destination review without publishing anything.
 *
 * Publish order is Instagram first, deliberately: it is the permanent channel
 * (no API delete or edit) with the most failure modes (quota, async container
 * processing), so if it fails nothing has gone out anywhere. Facebook —
 * synchronous and deletable — only publishes after Instagram succeeded, and a
 * Facebook failure is trivially retried from its panel. Instagram's
 * "still processing" responses are retried here a few times so the operator
 * is not asked to babysit the container poll.
 */

type Channel = SocialPublishChannel;
type CrossChannelSyncMode = 'wording' | 'photos' | 'both';
const CHANNELS: Channel[] = ['instagram', 'facebook'];
const LABELS: Record<Channel, string> = { instagram: 'Instagram', facebook: 'Facebook' };

interface ChannelPreview {
  /** Caption (Instagram) / message (Facebook) — unified here. */
  text: string;
  captionOpening: string;
  renditionUrls: string[];
  renditionIsCard: boolean[];
  blockedReason: string | null;
  warnings: string[];
  syncState: string | null;
  permalink: string | null;
  queuedAt: string | null;
  scheduledFor: string | null;
}

type ChannelStatus = SocialCombinedChannelStatus;

interface ChannelResult {
  ok: boolean;
  message: string;
  permalink: string | null;
}

function statusOf(p: ChannelPreview | null): ChannelStatus {
  if (!p) return 'loading';
  if (p.syncState === 'published') return 'published';
  if (p.blockedReason) return 'blocked';
  if (p.queuedAt) return 'queued';
  if (p.syncState === 'review' && p.renditionUrls.length > 0) return 'ready';
  return 'needs-prepare';
}

const STATUS_LABELS: Record<ChannelStatus, string> = {
  loading: 'Loading…',
  ready: 'Ready to publish',
  queued: 'In posting queue',
  published: 'Already published',
  'needs-prepare': 'Needs prepare',
  blocked: 'Blocked',
};

export default function SocialPublishBothModal({
  productId,
  sourceChannel,
  onClose,
  onDone,
}: {
  productId: string;
  /** The manager page that opened this modal; its reviewed setup is the sync source. */
  sourceChannel: Channel;
  onClose: () => void;
  /** Called after a queue or publish run so the opening panel can refresh its state. */
  onDone: () => void;
}) {
  const [previews, setPreviews] = useState<Record<Channel, ChannelPreview | null>>({
    instagram: null,
    facebook: null,
  });
  const [loadError, setLoadError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState<Channel | null>(null);
  const [phase, setPhase] = useState<'review' | 'queuing' | 'publishing' | 'done'>('review');
  const [completedAction, setCompletedAction] = useState<'queue' | 'publish' | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [results, setResults] = useState<Partial<Record<Channel, ChannelResult>>>({});
  const [showSchedule, setShowSchedule] = useState(false);

  const loadChannel = useCallback(
    async (channel: Channel) => {
      const res = await fetch(`/api/admin/${channel}/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || `Could not load the ${LABELS[channel]} preview.`);
      const preview: ChannelPreview = {
        text: String(data?.caption ?? data?.message ?? ''),
        captionOpening: String(data?.captionOpening ?? ''),
        renditionUrls: Array.isArray(data?.renditionUrls) ? data.renditionUrls : [],
        renditionIsCard: Array.isArray(data?.renditionIsCard) ? data.renditionIsCard : [],
        blockedReason: data?.blockedReason ?? null,
        warnings: Array.isArray(data?.warnings) ? data.warnings : [],
        syncState: data?.current?.syncState ?? null,
        permalink: data?.current?.permalink ?? null,
        queuedAt: data?.current?.queuedAt ?? null,
        scheduledFor: data?.current?.scheduledFor ?? null,
      };
      setPreviews((prev) => ({ ...prev, [channel]: preview }));
    },
    [productId],
  );

  useEffect(() => {
    const run = async () => {
      try {
        await Promise.all(CHANNELS.map((channel) => loadChannel(channel)));
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : 'Could not load the previews.');
      }
    };
    void run();
  }, [loadChannel]);

  const prepare = async (channel: Channel, mode: CrossChannelSyncMode = 'both') => {
    setPreparing(channel);
    setLoadError(null);
    try {
      const sourceChannel = otherSocialPublishChannel(channel);
      const sourceIsReady = statusOf(previews[sourceChannel]) === 'ready';
      // A ready source is authoritative for whichever parts the operator
      // explicitly selects. The server rebuilds target renditions after
      // applying that wording/photo choice.
      const captionOpening = selectCrossChannelCaptionOpening({
        targetOpening: previews[channel]?.captionOpening,
        sourceOpening: previews[sourceChannel]?.captionOpening,
        sourceIsReady,
      });
      const res = await fetch(
        sourceIsReady
          ? '/api/admin/social/prepare-from-channel'
          : `/api/admin/${channel}/sync`,
        {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          ...(sourceIsReady
            ? { from: sourceChannel, mode }
            : {
                action: 'prepare',
                ...(captionOpening ? { captionOpening } : {}),
              }),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message || data?.error || 'Prepare failed.');
      await loadChannel(channel);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Prepare failed.');
    } finally {
      setPreparing(null);
    }
  };

  /** One channel's publish, re-POSTing through "still processing" responses. */
  const publishChannel = async (channel: Channel): Promise<ChannelResult> => {
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      const res = await fetch(`/api/admin/${channel}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, action: 'publish' }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        return { ok: false, message: data?.message || data?.error || 'Publish failed.', permalink: null };
      }
      if (data?.state === 'published') {
        return { ok: true, message: data?.message ?? 'Published.', permalink: data?.permalink ?? null };
      }
      if (data?.done === false && data?.state === 'publishing') {
        setProgress(`${LABELS[channel]}: ${data?.message ?? 'still processing the images…'}`);
        await new Promise((resolve) => setTimeout(resolve, 4000));
        continue;
      }
      return { ok: false, message: data?.message ?? 'The publish did not complete.', permalink: null };
    }
    return {
      ok: false,
      message: 'Still processing after several checks — finish from this channel\'s own Publish button.',
      permalink: null,
    };
  };

  const queueChannel = async (channel: Channel, scheduledFor: string): Promise<ChannelResult> => {
    try {
      const res = await fetch(`/api/admin/${channel}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, action: 'queue', scheduledFor }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || data?.queued !== true) {
        return {
          ok: false,
          message: data?.message || data?.error || 'Could not add this channel to its posting queue.',
          permalink: null,
        };
      }
      return { ok: true, message: `Scheduled for ${new Date(scheduledFor).toLocaleString()}.`, permalink: null };
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : 'Could not add this channel to its posting queue.',
        permalink: null,
      };
    }
  };

  const statuses: Record<Channel, ChannelStatus> = {
    instagram: statusOf(previews.instagram),
    facebook: statusOf(previews.facebook),
  };
  const bothReady = CHANNELS.every((channel) => statuses[channel] === 'ready');
  const readyCaptionsMismatch = bothReady && !socialCaptionOpeningsMatch(
    previews.instagram?.captionOpening,
    previews.facebook?.captionOpening,
  );
  const canQueueBoth = canQueueBothSocialChannels(statuses, !readyCaptionsMismatch);
  const alignmentTarget = otherSocialPublishChannel(sourceChannel);
  const toPublish = readyCaptionsMismatch
    ? []
    : CHANNELS.filter((channel) => statuses[channel] === 'ready');
  const publishLabel =
    readyCaptionsMismatch
      ? 'Sync wording before publishing'
      : toPublish.length === 2
      ? 'Yes, publish to both'
      : toPublish.length === 1
        ? `Yes, publish to ${LABELS[toPublish[0]]}`
        : 'Nothing ready to publish';

  const runPublish = async () => {
    setPhase('publishing');
    setCompletedAction('publish');
    const out: Partial<Record<Channel, ChannelResult>> = {};

    if (toPublish.includes('instagram')) {
      setProgress('Publishing to Instagram…');
      out.instagram = await publishChannel('instagram');
    }
    if (toPublish.includes('facebook')) {
      if (toPublish.includes('instagram') && !out.instagram?.ok) {
        out.facebook = {
          ok: false,
          message: 'Not attempted — Instagram failed first, so nothing was published anywhere.',
          permalink: null,
        };
      } else {
        setProgress('Publishing to Facebook…');
        out.facebook = await publishChannel('facebook');
      }
    }

    setResults(out);
    setProgress(null);
    setPhase('done');
    await Promise.all(CHANNELS.map((channel) => loadChannel(channel).catch(() => undefined)));
    onDone();
  };

  const runQueueBoth = async (scheduledFor: SocialScheduleValues): Promise<boolean> => {
    setPhase('queuing');
    setCompletedAction('queue');
    setProgress('Adding Instagram and Facebook to their posting queues…');

    const queuedResults = await Promise.all(
      CHANNELS.map(async (channel) => [
        channel,
        await queueChannel(channel, scheduledFor[channel]!),
      ] as const),
    );
    const nextResults = Object.fromEntries(queuedResults) as Record<Channel, ChannelResult>;
    setResults(nextResults);
    const queuedAt = new Date().toISOString();
    setPreviews((current) => ({
      instagram: nextResults.instagram.ok && current.instagram
        ? { ...current.instagram, syncState: 'pending', queuedAt, scheduledFor: scheduledFor.instagram ?? null }
        : current.instagram,
      facebook: nextResults.facebook.ok && current.facebook
        ? { ...current.facebook, syncState: 'pending', queuedAt, scheduledFor: scheduledFor.facebook ?? null }
        : current.facebook,
    }));
    setProgress(null);
    setPhase('done');
    onDone();
    return true;
  };

  return (
    <AdminModal title="Publish or queue both channels" onClose={onClose} maxWidth="max-w-3xl">
      <div className="flex flex-col gap-4">
        {showSchedule && (
          <SocialScheduleModal
            channels={CHANNELS}
            initialScheduledFor={{
              instagram: previews.instagram?.scheduledFor ?? null,
              facebook: previews.facebook?.scheduledFor ?? null,
            }}
            title="Schedule both social posts"
            confirmLabel="Schedule both posts"
            onClose={() => setShowSchedule(false)}
            onConfirm={runQueueBoth}
          />
        )}
        {loadError && (
          <p className="text-xs font-semibold" style={{ color: 'var(--color-error)' }}>
            {loadError}
          </p>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          {CHANNELS.map((channel) => {
            const p = previews[channel];
            const status = statuses[channel];
            const sourceChannel = otherSocialPublishChannel(channel);
            const usesSourceSetup = statusOf(previews[sourceChannel]) === 'ready'
              && Boolean(previews[sourceChannel]?.captionOpening.trim());
            return (
              <div
                key={channel}
                className="flex flex-col gap-2 border p-3"
                style={{ borderColor: 'var(--color-outline-variant)' }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="text-[0.7rem] font-bold uppercase tracking-[0.2em]"
                    style={{ fontFamily: 'var(--font-label)' }}
                  >
                    {LABELS[channel]}
                  </span>
                  <span
                    className="text-[0.62rem] font-bold uppercase tracking-wide"
                    style={{
                      color:
                        status === 'ready' || status === 'queued' || status === 'published'
                          ? 'var(--color-primary)'
                          : status === 'blocked'
                            ? 'var(--color-error)'
                            : 'var(--color-on-surface-variant)',
                      fontFamily: 'var(--font-label)',
                    }}
                  >
                    {STATUS_LABELS[status]}
                  </span>
                </div>

                {!p ? (
                  <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                    Loading…
                  </p>
                ) : (
                  <>
                    <pre
                      key={`${channel}:${p.text}`}
                      className="max-h-44 overflow-auto whitespace-pre-wrap border p-2 text-[0.66rem] leading-relaxed"
                      style={{
                        borderColor: 'var(--color-outline-variant)',
                        fontFamily: 'ui-monospace, monospace',
                      }}
                    >
                      {p.text || '(no caption)'}
                    </pre>

                    {p.renditionUrls.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {p.renditionUrls.map((url, index) => (
                          <div
                            key={url}
                            className="relative h-10 w-10 overflow-hidden border"
                            style={{
                              borderColor: p.renditionIsCard?.[index]
                                ? 'var(--color-primary)'
                                : 'var(--color-outline-variant)',
                            }}
                          >
                            <Image
                              src={url}
                              alt={`${LABELS[channel]} slide ${index + 1}`}
                              fill
                              sizes="40px"
                              className="object-cover"
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[0.68rem]" style={{ color: 'var(--color-on-surface-variant)' }}>
                        No prepared slides yet.
                      </p>
                    )}

                    {p.blockedReason && (
                      <p className="text-[0.68rem] font-semibold" style={{ color: 'var(--color-error)' }}>
                        {p.blockedReason}
                      </p>
                    )}

                    {status === 'needs-prepare' && phase === 'review' && (
                      <button
                        type="button"
                        onClick={() => prepare(channel)}
                        disabled={preparing !== null}
                        className="outline-button self-start text-xs disabled:opacity-50"
                      >
                        {preparing === channel
                          ? 'Preparing…'
                          : `Prepare ${LABELS[channel]}${usesSourceSetup
                            ? ` from ${LABELS[sourceChannel]} setup`
                            : ''}`}
                      </button>
                    )}

                    {bothReady && channel === alignmentTarget && phase === 'review' && (
                      <div
                        className="flex flex-col gap-2 border-t pt-2"
                        style={{ borderColor: 'var(--color-outline-variant)' }}
                      >
                        <p
                          className="text-[0.66rem] font-semibold"
                          style={{ color: 'var(--color-on-surface-variant)' }}
                        >
                          Copy from {LABELS[sourceChannel]} to {LABELS[channel]}:
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {([
                            ['wording', 'Sync wording'],
                            ['photos', 'Sync photos'],
                            ['both', 'Sync wording & photos'],
                          ] as const).map(([syncMode, label]) => (
                            <button
                              key={syncMode}
                              type="button"
                              onClick={() => prepare(channel, syncMode)}
                              disabled={preparing !== null}
                              className="outline-button text-xs disabled:opacity-50"
                            >
                              {preparing === channel ? 'Syncing…' : label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {status === 'published' && p.permalink && (
                      <a
                        href={p.permalink}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[0.68rem] font-bold underline"
                        style={{ color: 'var(--color-primary)' }}
                      >
                        View the live post
                      </a>
                    )}

                    {results[channel] && (
                      <p
                        className="text-[0.68rem] font-semibold"
                        style={{ color: results[channel]!.ok ? 'var(--color-primary)' : 'var(--color-error)' }}
                      >
                        {results[channel]!.ok ? '✓ ' : '✗ '}
                        {results[channel]!.message}{' '}
                        {results[channel]!.permalink && (
                          <a
                            href={results[channel]!.permalink!}
                            target="_blank"
                            rel="noreferrer"
                            className="underline"
                          >
                            View post
                          </a>
                        )}
                      </p>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>

        {progress && (
          <p className="text-xs font-semibold" style={{ color: 'var(--color-on-surface-variant)' }}>
            {progress}
          </p>
        )}

        {readyCaptionsMismatch && phase === 'review' && (
          <p className="text-xs font-semibold" style={{ color: 'var(--color-error)' }}>
            The reviewed opening sentences do not match. Use Sync wording or Sync wording &amp;
            photos before publishing or queueing both.
          </p>
        )}

        <div
          className="flex flex-col gap-3 border-t pt-3"
          style={{ borderColor: 'var(--color-outline-variant)' }}
        >
          {phase !== 'done' ? (
            <>
              <span className="text-xs font-semibold" style={{ color: 'var(--color-error)' }}>
                Publishes publicly. Instagram posts cannot be edited or deleted afterwards.
              </span>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowSchedule(true)}
                  disabled={phase !== 'review' || !canQueueBoth || preparing !== null}
                  className="outline-button text-sm disabled:opacity-50"
                >
                  {phase === 'queuing'
                    ? 'Adding to queues…'
                    : readyCaptionsMismatch
                      ? 'Sync wording before queueing'
                      : !bothReady
                        ? 'Prepare both before queueing'
                        : 'Schedule both posts'}
                </button>
                <button
                  type="button"
                  onClick={runPublish}
                  disabled={phase !== 'review' || toPublish.length === 0 || preparing !== null}
                  className="gold-button text-sm disabled:opacity-50"
                >
                  {phase === 'publishing' ? 'Publishing…' : publishLabel}
                </button>
              </div>
            </>
          ) : (
            <>
              <span className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                {completedAction === 'queue'
                  ? 'Done — each channel’s queue result is shown above.'
                  : 'Done — each channel’s publish result is shown above.'}
              </span>
              <button type="button" onClick={onClose} className="gold-button self-end text-sm">
                Close
              </button>
            </>
          )}
        </div>
      </div>
    </AdminModal>
  );
}
