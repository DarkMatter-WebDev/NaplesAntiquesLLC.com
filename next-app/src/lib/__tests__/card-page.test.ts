import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_STORE_HOURS,
  FACEBOOK_URL,
  INSTAGRAM_URL,
  SAME_AS,
  WEEK_ORDER,
  hoursSegmentsCompact,
  type StoreHoursSchedule,
} from '@/lib/business-location';

// `/card` is the URL printed on the business cards (2026-09-03). Two things
// about it must not regress silently: it is a noindex utility page that stays
// OUT of the sitemap, and it carries no site chrome by design.

const APP = join(process.cwd(), 'src', 'app');
const PAGE = readFileSync(join(APP, '[locale]', 'card', 'page.tsx'), 'utf8');
const SITEMAP = readFileSync(join(APP, 'sitemap.ts'), 'utf8');

function schedule(open: Partial<Record<(typeof WEEK_ORDER)[number], [string, string]>>): StoreHoursSchedule {
  return Object.fromEntries(
    WEEK_ORDER.map((day) => {
      const times = open[day];
      return [day, { open: Boolean(times), opens: times?.[0] ?? '11:00', closes: times?.[1] ?? '15:00' }];
    }),
  ) as StoreHoursSchedule;
}

describe('/card page — search and chrome rules', () => {
  it('is noindex and never listed in the sitemap', () => {
    expect(PAGE).toContain('robots: { index: false, follow: false }');
    expect(SITEMAP).not.toContain("'/card'");
  });

  it('renders no site header, footer or breadcrumb (the page is the buttons)', () => {
    expect(PAGE).not.toContain('SiteHeader');
    expect(PAGE).not.toContain('SiteFooter');
    expect(PAGE).not.toContain('BreadcrumbTrail');
  });

  it('opts out of the cookie notice via the page attribute + the :has() rule', () => {
    // Two halves that cannot see each other: the page declares, the stylesheet
    // resolves. Losing either brings the banner back over the address.
    const GLOBALS = readFileSync(join(APP, 'globals.css'), 'utf8');
    expect(PAGE).toMatch(/<main [^>]*data-no-cookie-notice[ >]/);
    expect(GLOBALS).toContain('body:has(main[data-no-cookie-notice]) [data-cookie-notice]');
  });

  it('uses the cross-platform sms body form and the shared social URLs', () => {
    expect(PAGE).toContain('?&body=');
    expect(PAGE).toContain('INSTAGRAM_URL');
    expect(PAGE).toContain('FACEBOOK_URL');
    // The named constants feed sameAs too — one place for each URL.
    expect(SAME_AS).toContain(INSTAGRAM_URL);
    expect(SAME_AS).toContain(FACEBOOK_URL);
  });
});

describe('hoursSegmentsCompact — day/time pairs for the bolded hours line', () => {
  it('compresses the default week to one segment in both languages', () => {
    expect(hoursSegmentsCompact(DEFAULT_STORE_HOURS, false)).toEqual([{ days: 'Mon–Sat', times: '11am–3pm' }]);
    expect(hoursSegmentsCompact(DEFAULT_STORE_HOURS, true)).toEqual([{ days: 'Lun–Sáb', times: '11 a.m. – 3 p.m.' }]);
  });

  it('splits on a time change and keeps single days as one abbreviation', () => {
    const real = schedule({
      Monday: ['11:00', '15:00'],
      Tuesday: ['11:00', '15:00'],
      Wednesday: ['11:00', '15:00'],
      Thursday: ['11:00', '15:00'],
      Friday: ['11:00', '15:00'],
      Saturday: ['11:00', '16:00'],
    });
    expect(hoursSegmentsCompact(real, false)).toEqual([
      { days: 'Mon–Fri', times: '11am–3pm' },
      { days: 'Sat', times: '11am–4pm' },
    ]);
    expect(hoursSegmentsCompact(real, true)).toEqual([
      { days: 'Lun–Vie', times: '11 a.m. – 3 p.m.' },
      { days: 'Sáb', times: '11 a.m. – 4 p.m.' },
    ]);
  });

  it('keeps non-zero minutes and returns nothing for an all-closed week', () => {
    expect(hoursSegmentsCompact(schedule({ Tuesday: ['11:30', '15:45'] }), true)).toEqual([
      { days: 'Mar', times: '11:30 a.m. – 3:45 p.m.' },
    ]);
    expect(hoursSegmentsCompact(schedule({}), false)).toEqual([]);
  });
});
