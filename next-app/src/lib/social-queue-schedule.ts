export type SocialQueueChannel = 'instagram' | 'facebook';

export const SOCIAL_QUEUE_TIME_ZONE = 'America/New_York';
export const SOCIAL_QUEUE_MIN_LEAD_MINUTES = 5;
export const SOCIAL_QUEUE_MAX_MONTHS_AHEAD = 12;
/** Per-worker safety bound only; there is intentionally no local daily cap. */
export const SOCIAL_SCHEDULED_DRIP_BATCH_SIZE = 25;

/** Midnight means the end of the date selected in the scheduling dialog. */
export const SOCIAL_QUEUE_POSTING_SLOTS = [
  { value: '12:00', label: '12:00 PM - noon' },
  { value: '14:00', label: '2:00 PM' },
  { value: '16:00', label: '4:00 PM' },
  { value: '18:00', label: '6:00 PM' },
  { value: '20:00', label: '8:00 PM' },
  { value: '22:00', label: '10:00 PM' },
  { value: '24:00', label: '12:00 AM - midnight' },
] as const;

export type SocialQueuePostingSlot = (typeof SOCIAL_QUEUE_POSTING_SLOTS)[number]['value'];

function easternParts(value: Date): Record<string, string> {
  return Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: SOCIAL_QUEUE_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(value)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );
}

function addCalendarDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return next.toISOString().slice(0, 10);
}

/** Format an instant as an Eastern datetime-local value. */
export function formatSocialScheduleInput(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const parts = easternParts(date);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/**
 * Convert an Eastern datetime-local value to an instant without depending on
 * the admin computer's timezone. The second pass handles DST offset changes.
 */
export function parseSocialScheduleInput(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match;
  if (+hour > 23 || +minute > 59) return null;
  const desiredUtc = Date.UTC(+year, +month - 1, +day, +hour, +minute, 0, 0);

  const offsetAt = (instant: Date) => {
    const parts = easternParts(instant);
    const representedUtc = Date.UTC(
      +parts.year,
      +parts.month - 1,
      +parts.day,
      +parts.hour,
      +parts.minute,
      +parts.second,
    );
    return representedUtc - instant.getTime();
  };

  let candidate = new Date(desiredUtc - offsetAt(new Date(desiredUtc)));
  candidate = new Date(desiredUtc - offsetAt(candidate));
  return formatSocialScheduleInput(candidate) === value ? candidate : null;
}

export function parseSocialScheduleChoice(
  date: string,
  slot: SocialQueuePostingSlot,
): Date | null {
  if (slot === '24:00') return parseSocialScheduleInput(`${addCalendarDays(date, 1)}T00:00`);
  return parseSocialScheduleInput(`${date}T${slot}`);
}

/** Convert a stored instant back into the date + fixed slot used by the UI. */
export function formatSocialScheduleChoice(value: Date | string): {
  date: string;
  slot: SocialQueuePostingSlot;
} | null {
  const input = formatSocialScheduleInput(value);
  if (!input) return null;
  const [date, time] = input.split('T');
  if (time === '00:00') return { date: addCalendarDays(date, -1), slot: '24:00' };
  const slot = SOCIAL_QUEUE_POSTING_SLOTS.find((option) => option.value === time)?.value;
  return slot ? { date, slot } : null;
}

/** Default to the next selectable posting slot, with a small setup buffer. */
export function getDefaultSocialScheduledFor(
  _channel: SocialQueueChannel,
  now = new Date(),
): Date {
  const earliest = now.getTime() + SOCIAL_QUEUE_MIN_LEAD_MINUTES * 60_000;
  const today = formatSocialScheduleInput(now).slice(0, 10);
  for (let dayOffset = 0; dayOffset < 370; dayOffset += 1) {
    const date = addCalendarDays(today, dayOffset);
    for (const option of SOCIAL_QUEUE_POSTING_SLOTS) {
      const candidate = parseSocialScheduleChoice(date, option.value);
      if (candidate && candidate.getTime() >= earliest) return candidate;
    }
  }
  throw new Error('Could not calculate the next social posting time.');
}

export function validateSocialScheduledFor(
  value: unknown,
  now = new Date(),
): { date: Date | null; error: string | null } {
  if (typeof value !== 'string' || !value.trim()) {
    return { date: null, error: 'Choose a scheduled posting time.' };
  }
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return { date: null, error: 'The scheduled posting time is invalid.' };
  }
  const minimum = now.getTime() + 60_000;
  if (date.getTime() < minimum) {
    return { date: null, error: 'Choose a posting time at least one minute in the future.' };
  }
  const maximum = new Date(now);
  maximum.setUTCMonth(maximum.getUTCMonth() + SOCIAL_QUEUE_MAX_MONTHS_AHEAD);
  if (date.getTime() > maximum.getTime()) {
    return { date: null, error: 'Scheduled posts can be set up to 12 months ahead.' };
  }
  if (!formatSocialScheduleChoice(date)) {
    return {
      date: null,
      error: 'Choose one of the available Eastern posting times: noon, 2 PM, 4 PM, 6 PM, 8 PM, 10 PM, or midnight.',
    };
  }
  return { date, error: null };
}
