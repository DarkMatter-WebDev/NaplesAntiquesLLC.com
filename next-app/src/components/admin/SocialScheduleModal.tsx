'use client';

import { useState } from 'react';
import AdminModal from './AdminModal';
import {
  formatSocialScheduleChoice,
  formatSocialScheduleInput,
  getDefaultSocialScheduledFor,
  parseSocialScheduleChoice,
  SOCIAL_QUEUE_POSTING_SLOTS,
  SOCIAL_QUEUE_TIME_ZONE,
  type SocialQueuePostingSlot,
  type SocialQueueChannel,
} from '@/lib/social-queue-schedule';

const LABELS: Record<SocialQueueChannel, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
};

export type SocialScheduleValues = Record<SocialQueueChannel, string | undefined>;

export default function SocialScheduleModal({
  channels,
  initialScheduledFor = {},
  title,
  confirmLabel = 'Schedule post',
  onConfirm,
  onClose,
}: {
  channels: readonly SocialQueueChannel[];
  initialScheduledFor?: Partial<Record<SocialQueueChannel, string | null>>;
  title: string;
  confirmLabel?: string;
  onConfirm: (scheduledFor: SocialScheduleValues) => Promise<boolean>;
  onClose: () => void;
}) {
  const [openedAt] = useState(() => new Date());
  const [values, setValues] = useState(() => {
    return Object.fromEntries(
      channels.map((channel) => {
        const instant = initialScheduledFor[channel] ?? getDefaultSocialScheduledFor(channel, openedAt);
        const choice = formatSocialScheduleChoice(instant)
          ?? formatSocialScheduleChoice(getDefaultSocialScheduledFor(channel, openedAt))!;
        return [channel, choice];
      }),
    ) as Record<SocialQueueChannel, { date: string; slot: SocialQueuePostingSlot }>;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const minimumDate = formatSocialScheduleInput(openedAt).slice(0, 10);

  const submit = async () => {
    const scheduledFor: SocialScheduleValues = { instagram: undefined, facebook: undefined };
    for (const channel of channels) {
      const parsed = parseSocialScheduleChoice(values[channel].date, values[channel].slot);
      if (!parsed || parsed.getTime() < Date.now() + 60_000) {
        setError(`Choose a valid future time for ${LABELS[channel]}.`);
        return;
      }
      scheduledFor[channel] = parsed.toISOString();
    }

    setBusy(true);
    setError(null);
    try {
      const saved = await onConfirm(scheduledFor);
      if (saved) onClose();
      else setError('The schedule could not be saved. Review the page message and try again.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the scheduled time.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminModal title={title} onClose={busy ? () => undefined : onClose} maxWidth="max-w-xl">
      <div className="flex flex-col gap-5">
        <div>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--color-on-surface)' }}>
            The next available posting time is already selected. Keep it to schedule quickly, or
            choose another date and posting time.
          </p>
          <p className="mt-2 text-xs leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>
            Times are shown in Eastern Time ({SOCIAL_QUEUE_TIME_ZONE}). Posts can be scheduled only
            for noon, 2 PM, 4 PM, 6 PM, 8 PM, 10 PM, or midnight.
          </p>
        </div>

        <div className={channels.length > 1 ? 'grid gap-4 sm:grid-cols-2' : ''}>
          {channels.map((channel) => (
            <div key={channel}>
              <span
                className="mb-2 block text-[0.65rem] font-bold uppercase tracking-[0.18em]"
                style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}
              >
                {LABELS[channel]} posting time
              </span>
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(160px,0.8fr)]">
                <label>
                  <span className="sr-only">{LABELS[channel]} posting date</span>
                  <input
                    type="date"
                    value={values[channel].date}
                    min={minimumDate}
                    onChange={(event) => {
                      setValues((current) => ({
                        ...current,
                        [channel]: { ...current[channel], date: event.target.value },
                      }));
                      setError(null);
                    }}
                    disabled={busy}
                    className="w-full border bg-white px-3 py-3 text-sm outline-none focus:ring-2 disabled:opacity-60"
                    style={{ borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface)' }}
                  />
                </label>
                <label>
                  <span className="sr-only">{LABELS[channel]} posting time</span>
                  <select
                    value={values[channel].slot}
                    onChange={(event) => {
                      setValues((current) => ({
                        ...current,
                        [channel]: {
                          ...current[channel],
                          slot: event.target.value as SocialQueuePostingSlot,
                        },
                      }));
                      setError(null);
                    }}
                    disabled={busy}
                    className="w-full border bg-white px-3 py-3 text-sm outline-none focus:ring-2 disabled:opacity-60"
                    style={{ borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface)' }}
                  >
                    {SOCIAL_QUEUE_POSTING_SLOTS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
              </div>
              {values[channel].slot === '24:00' && (
                <p className="mt-1 text-[0.68rem]" style={{ color: 'var(--color-on-surface-variant)' }}>
                  Midnight means the end of the selected date.
                </p>
              )}
            </div>
          ))}
        </div>

        {error && (
          <p className="border px-3 py-2 text-xs font-semibold" style={{ borderColor: 'var(--color-error)', color: 'var(--color-error)' }}>
            {error}
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-2 border-t pt-4" style={{ borderColor: 'var(--color-outline-variant)' }}>
          <button type="button" onClick={onClose} disabled={busy} className="outline-button text-sm disabled:opacity-50">
            Cancel
          </button>
          <button type="button" onClick={() => void submit()} disabled={busy} className="gold-button text-sm disabled:opacity-50">
            {busy ? 'Saving schedule…' : confirmLabel}
          </button>
        </div>
      </div>
    </AdminModal>
  );
}
