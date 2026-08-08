'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import type { CSSProperties } from 'react';
import { AppIcon } from '@/components/AppIcon';
import AdminModal from './AdminModal';
import SocialScheduleModal from './SocialScheduleModal';
import { useSocialBackgroundPublish } from './SocialBackgroundPublishProvider';
import type { SocialQueueChannel } from '@/lib/social-queue-schedule';

const LABELS: Record<SocialQueueChannel, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
};

const ROW_ACTION_GRID_STYLE: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 'clamp(0.35rem, 0.45vw, 0.5rem)',
  inlineSize: '100%',
  minInlineSize: '10rem',
  maxInlineSize: '17.5rem',
};

const ROW_ACTION_STYLE: CSSProperties = {
  boxSizing: 'border-box',
  inlineSize: '100%',
  minInlineSize: 0,
  maxInlineSize: '100%',
  overflow: 'hidden',
  gap: 'clamp(0.18rem, 0.3vw, 0.4rem)',
  paddingInline: 'clamp(0.3rem, 0.55vw, 0.85rem)',
  fontSize: 'clamp(0.48rem, 0.56vw, 0.68rem)',
  letterSpacing: 'clamp(0.035em, 0.075vw, 0.14em)',
  lineHeight: 1,
  whiteSpace: 'nowrap',
};

export default function SocialQueueRowActions({
  channel,
  productId,
  productTitle,
  scheduledFor,
  manageHref,
  canPublishNow,
}: {
  channel: SocialQueueChannel;
  productId: string;
  productTitle: string;
  scheduledFor: string | null;
  manageHref: string;
  canPublishNow: boolean;
}) {
  const router = useRouter();
  const { task: backgroundTask, startPublish } = useSocialBackgroundPublish();
  const [mode, setMode] = useState<'publish' | 'schedule' | 'remove' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const request = async (action: 'queue' | 'unqueue', nextScheduledFor?: string) => {
    const response = await fetch(`/api/admin/${channel}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId,
        action,
        ...(nextScheduledFor ? { scheduledFor: nextScheduledFor } : {}),
      }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.message || data?.error || 'Could not update this scheduled post.');
  };

  const reschedule = async (values: Record<SocialQueueChannel, string | undefined>) => {
    setError(null);
    await request('queue', values[channel]);
    router.refresh();
    return true;
  };

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      await request('unqueue');
      setMode(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove this scheduled post.');
    } finally {
      setBusy(false);
    }
  };

  const publishNow = () => {
    setError(null);
    const result = startPublish({ channel, productId, productTitle });
    if (!result.started) {
      setError(result.message ?? 'Could not start this background upload.');
      return;
    }
    setMode(null);
  };

  const publishBlocked = !canPublishNow || backgroundTask?.status === 'running';

  return (
    <>
      <div className="social-queue-row-actions" style={ROW_ACTION_GRID_STYLE}>
        <Link href={manageHref} className="outline-button social-queue-row-action" style={ROW_ACTION_STYLE}>
          Edit post <AppIcon name="edit" aria-hidden="true" style={{ flex: '0 0 auto', fontSize: 'clamp(0.58rem, 0.68vw, 0.84rem)' }} />
        </Link>
        <button
          type="button"
          onClick={() => setMode('publish')}
          disabled={publishBlocked}
          title={!canPublishNow
            ? `Connect ${LABELS[channel]} and prepare this post before publishing.`
            : backgroundTask?.status === 'running'
              ? 'Another social post is already uploading in the background.'
              : undefined}
          className="gold-button social-queue-row-action disabled:cursor-not-allowed disabled:opacity-45"
          style={ROW_ACTION_STYLE}
        >
          Post now
        </button>
        <button type="button" onClick={() => setMode('schedule')} className="outline-button social-queue-row-action" style={ROW_ACTION_STYLE}>
          Change time
        </button>
        <button type="button" onClick={() => setMode('remove')} className="outline-button social-danger-button social-queue-row-action" style={ROW_ACTION_STYLE}>
          Remove
        </button>
      </div>

      {mode === 'publish' && (
        <AdminModal title={`Post to ${LABELS[channel]} now`} onClose={busy ? () => undefined : () => setMode(null)}>
          <div className="flex flex-col gap-4">
            <p className="text-sm leading-relaxed" style={{ color: 'var(--color-on-surface)' }}>
              Publish <strong>{productTitle}</strong> to {LABELS[channel]} now? This bypasses its scheduled time and
              makes the post public immediately. After you start it, this window will minimize into a background upload widget.
            </p>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--color-error)' }}>
              {channel === 'instagram'
                ? 'Instagram captions cannot be edited after publishing, and Instagram’s API cannot delete the post.'
                : 'Review the prepared post carefully. Facebook posts can be removed later.'}
            </p>
            {error && <p className="text-xs font-semibold" style={{ color: 'var(--color-error)' }}>{error}</p>}
            <div className="flex flex-wrap justify-end gap-2 border-t pt-4" style={{ borderColor: 'var(--color-outline-variant)' }}>
              <button type="button" onClick={() => setMode(null)} disabled={busy} className="outline-button text-sm disabled:opacity-50">
                Cancel
              </button>
              <button type="button" onClick={publishNow} className="gold-button text-sm">
                Yes, post in background
              </button>
            </div>
          </div>
        </AdminModal>
      )}

      {mode === 'schedule' && (
        <SocialScheduleModal
          channels={[channel]}
          initialScheduledFor={{ [channel]: scheduledFor }}
          title={`Change ${LABELS[channel]} posting time`}
          confirmLabel="Save new time"
          onConfirm={reschedule}
          onClose={() => {
            setMode(null);
            setError(null);
          }}
        />
      )}

      {mode === 'remove' && (
        <AdminModal title={`Remove ${LABELS[channel]} scheduled post`} onClose={busy ? () => undefined : () => setMode(null)}>
          <div className="flex flex-col gap-4">
            <p className="text-sm leading-relaxed" style={{ color: 'var(--color-on-surface)' }}>
              Remove <strong>{productTitle}</strong> from the {LABELS[channel]} posting queue? The prepared caption,
              photos, crops, and card will be kept so it can be scheduled again later.
            </p>
            {error && <p className="text-xs font-semibold" style={{ color: 'var(--color-error)' }}>{error}</p>}
            <div className="flex flex-wrap justify-end gap-2 border-t pt-4" style={{ borderColor: 'var(--color-outline-variant)' }}>
              <button type="button" onClick={() => setMode(null)} disabled={busy} className="outline-button text-sm disabled:opacity-50">
                Cancel
              </button>
              <button type="button" onClick={() => void remove()} disabled={busy} className="outline-button social-danger-button text-sm disabled:opacity-50">
                {busy ? 'Removing…' : 'Yes, remove from queue'}
              </button>
            </div>
          </div>
        </AdminModal>
      )}
    </>
  );
}
