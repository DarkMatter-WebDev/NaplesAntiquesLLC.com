import { describe, expect, it } from 'vitest';
import {
  formatSocialScheduleChoice,
  formatSocialScheduleInput,
  getDefaultSocialScheduledFor,
  parseSocialScheduleChoice,
  parseSocialScheduleInput,
  SOCIAL_QUEUE_POSTING_SLOTS,
  SOCIAL_SCHEDULED_DRIP_BATCH_SIZE,
  validateSocialScheduledFor,
} from '@/lib/social-queue-schedule';

describe('social queue schedule', () => {
  it('offers only the seven approved posting slots', () => {
    expect(SOCIAL_QUEUE_POSTING_SLOTS).toEqual([
      { value: '12:00', label: '12:00 PM - noon' },
      { value: '14:00', label: '2:00 PM' },
      { value: '16:00', label: '4:00 PM' },
      { value: '18:00', label: '6:00 PM' },
      { value: '20:00', label: '8:00 PM' },
      { value: '22:00', label: '10:00 PM' },
      { value: '24:00', label: '12:00 AM - midnight' },
    ]);
  });

  it('uses a per-worker safety batch instead of a daily queue cap', () => {
    expect(SOCIAL_SCHEDULED_DRIP_BATCH_SIZE).toBe(25);
  });

  it('defaults to the next available posting slot', () => {
    expect(getDefaultSocialScheduledFor('instagram', new Date('2026-08-02T15:00:00.000Z')).toISOString())
      .toBe('2026-08-02T16:00:00.000Z'); // 11 AM -> noon EDT
    expect(getDefaultSocialScheduledFor('facebook', new Date('2026-08-02T16:05:00.000Z')).toISOString())
      .toBe('2026-08-02T18:00:00.000Z'); // 12:05 PM -> 2 PM EDT
    expect(getDefaultSocialScheduledFor('instagram', new Date('2026-08-02T21:00:00.000Z')).toISOString())
      .toBe('2026-08-02T22:00:00.000Z'); // 5 PM -> 6 PM EDT
    expect(getDefaultSocialScheduledFor('facebook', new Date('2026-08-03T02:05:00.000Z')).toISOString())
      .toBe('2026-08-03T04:00:00.000Z'); // 10:05 PM -> midnight EDT
    expect(getDefaultSocialScheduledFor('facebook', new Date('2026-08-03T03:58:00.000Z')).toISOString())
      .toBe('2026-08-03T16:00:00.000Z'); // midnight is too close -> next noon
  });

  it('round-trips Eastern wall time across daylight-saving changes', () => {
    const summer = parseSocialScheduleInput('2026-08-02T18:00');
    const winter = parseSocialScheduleInput('2026-12-02T18:00');
    expect(summer?.toISOString()).toBe('2026-08-02T22:00:00.000Z');
    expect(winter?.toISOString()).toBe('2026-12-02T23:00:00.000Z');
    expect(formatSocialScheduleInput(summer!)).toBe('2026-08-02T18:00');
  });

  it('treats midnight as the end of the selected date', () => {
    const midnight = parseSocialScheduleChoice('2026-08-02', '24:00');
    expect(midnight?.toISOString()).toBe('2026-08-03T04:00:00.000Z');
    expect(formatSocialScheduleChoice(midnight!)).toEqual({ date: '2026-08-02', slot: '24:00' });
  });

  it('accepts the new daytime slots and rejects any other valid instant', () => {
    const now = new Date('2026-08-02T14:00:00.000Z');
    expect(validateSocialScheduledFor('2026-08-02T16:00:00.000Z', now).error).toBeNull();
    expect(validateSocialScheduledFor('2026-08-02T18:00:00.000Z', now).error).toBeNull();
    expect(validateSocialScheduledFor('2026-08-02T20:00:00.000Z', now).error).toBeNull();
    expect(validateSocialScheduledFor('2026-08-02T23:00:00.000Z', now).error)
      .toMatch(/noon, 2 PM, 4 PM, 6 PM, 8 PM, 10 PM, or midnight/i);
    expect(validateSocialScheduledFor('2026-08-03T00:00:00.000Z', now).error).toBeNull();
  });

  it('rejects past, invalid, and excessively distant schedules', () => {
    const now = new Date('2026-08-02T14:00:00.000Z');
    expect(validateSocialScheduledFor('not-a-date', now).error).toMatch(/invalid/i);
    expect(validateSocialScheduledFor('2026-08-02T13:59:00.000Z', now).error).toMatch(/future/i);
    expect(validateSocialScheduledFor('2028-08-02T22:00:00.000Z', now).error).toMatch(/12 months/i);
  });
});
