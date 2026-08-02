'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import AdminModal from './AdminModal';

/**
 * Review-and-publish surface for BOTH social channels at once, opened from
 * either product panel ("Publish to both…").
 *
 * Read-only by design: captions and slides are shown side by side for one
 * final review, but all editing (lineup, crops, card) stays in the per-channel
 * panels. The one action here besides Publish is a per-channel Prepare, since
 * publishing requires prepared renditions on each channel.
 *
 * Publish order is Instagram first, deliberately: it is the permanent channel
 * (no API delete or edit) with the most failure modes (quota, async container
 * processing), so if it fails nothing has gone out anywhere. Facebook —
 * synchronous and deletable — only publishes after Instagram succeeded, and a
 * Facebook failure is trivially retried from its panel. Instagram's
 * "still processing" responses are retried here a few times so the operator
 * is not asked to babysit the container poll.
 */

type Channel = 'instagram' | 'facebook';
const CHANNELS: Channel[] = ['instagram', 'facebook'];
const LABELS: Record<Channel, string> = { instagram: 'Instagram', facebook: 'Facebook' };

interface ChannelPreview {
  /** Caption (Instagram) / message (Facebook) — unified here. */
  text: string;
  renditionUrls: string[];
  renditionIsCard: boolean[];
  blockedReason: string | null;
  warnings: string[];
  syncState: string | null;
  permalink: string | null;
}

type ChannelStatus = 'loading' | 'ready' | 'published' | 'needs-prepare' | 'blocked';

interface ChannelResult {
  ok: boolean;
  message: string;
  permalink: string | null;
}

function statusOf(p: ChannelPreview | null): ChannelStatus {
  if (!p) return 'loading';
  if (p.syncState === 'published') return 'published';
  if (p.blockedReason) return 'blocked';
  if (p.syncState === 'review' && p.renditionUrls.length > 0) return 'ready';
  return 'needs-prepare';
}

const STATUS_LABELS: Record<ChannelStatus, string> = {
  loading: 'Loading…',
  ready: 'Ready to publish',
  published: 'Already published',
  'needs-prepare': 'Needs prepare',
  blocked: 'Blocked',
};

export default function SocialPublishBothModal({
  productId,
  onClose,
  onDone,
}: {
  productId: string;
  onClose: () => void;
  /** Called after a publish run so the opening panel can refresh its state. */
  onDone: () => void;
}) {
  const [previews, setPreviews] = useState<Record<Channel, ChannelPreview | null>>({
    instagram: null,
    facebook: null,
  });
  const [loadError, setLoadError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState<Channel | null>(null);
  const [phase, setPhase] = useState<'review' | 'publishing' | 'done'>('review');
  const [progress, setProgress] = useState<string | null>(null);
  const [results, setResults] = useState<Partial<Record<Channel, ChannelResult>>>({});

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
        renditionUrls: Array.isArray(data?.renditionUrls) ? data.renditionUrls : [],
        renditionIsCard: Array.isArray(data?.renditionIsCard) ? data.renditionIsCard : [],
        blockedReason: data?.blockedReason ?? null,
        warnings: Array.isArray(data?.warnings) ? data.warnings : [],
        syncState: data?.current?.syncState ?? null,
        permalink: data?.current?.permalink ?? null,
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

  const prepare = async (channel: Channel) => {
    setPreparing(channel);
    try {
      const res = await fetch(`/api/admin/${channel}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, action: 'prepare' }),
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

  const statuses: Record<Channel, ChannelStatus> = {
    instagram: statusOf(previews.instagram),
    facebook: statusOf(previews.facebook),
  };
  const toPublish = CHANNELS.filter((channel) => statuses[channel] === 'ready');
  const publishLabel =
    toPublish.length === 2
      ? 'Yes, publish to both'
      : toPublish.length === 1
        ? `Yes, publish to ${LABELS[toPublish[0]]}`
        : 'Nothing ready to publish';

  const runPublish = async () => {
    setPhase('publishing');
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

  return (
    <AdminModal title="Publish to both channels" onClose={onClose} maxWidth="max-w-3xl">
      <div className="flex flex-col gap-4">
        {loadError && (
          <p className="text-xs font-semibold" style={{ color: 'var(--color-error)' }}>
            {loadError}
          </p>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          {CHANNELS.map((channel) => {
            const p = previews[channel];
            const status = statuses[channel];
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
                        status === 'ready' || status === 'published'
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
                        {preparing === channel ? 'Preparing…' : `Prepare ${LABELS[channel]}`}
                      </button>
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

        <div
          className="flex flex-wrap items-center justify-between gap-2 border-t pt-3"
          style={{ borderColor: 'var(--color-outline-variant)' }}
        >
          {phase !== 'done' ? (
            <>
              <span className="text-xs font-semibold" style={{ color: 'var(--color-error)' }}>
                Publishes publicly. Instagram posts cannot be edited or deleted afterwards.
              </span>
              <button
                type="button"
                onClick={runPublish}
                disabled={phase !== 'review' || toPublish.length === 0 || preparing !== null}
                className="gold-button text-sm disabled:opacity-50"
              >
                {phase === 'publishing' ? 'Publishing…' : publishLabel}
              </button>
            </>
          ) : (
            <>
              <span className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                Done — each channel&rsquo;s result is shown above.
              </span>
              <button type="button" onClick={onClose} className="gold-button text-sm">
                Close
              </button>
            </>
          )}
        </div>
      </div>
    </AdminModal>
  );
}
