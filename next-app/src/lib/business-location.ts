/**
 * The showroom's name, address, hours and wayfinding copy — one source of truth.
 *
 * The phone number was never centralised and is now hardcoded in 105 places
 * across 37 files. The address arrived later and must not repeat that: every
 * surface that prints it imports from here, so a suite change or an hours
 * change is one edit, not a grep.
 *
 * ⚠️ NAP consistency is a local-SEO ranking factor. The strings below must stay
 * byte-identical to the Google Business Profile, the eBay merchant location and
 * the Etsy shop location. If you change one, change all four.
 */

export const BUSINESS_NAME = 'Naples Estate Jewelry';

/** The business we share the suite with. See SHARED_SPACE_NOTE for why it is named. */
export const SHARED_SPACE_NAME = 'Sharon Lynch Collections';

export const ADDRESS = {
  street: '6240 Shirley St',
  suite: 'Ste 104',
  locality: 'Naples',
  region: 'FL',
  postalCode: '34109',
  country: 'US',
} as const;

/**
 * Real coordinates for the Shirley St suite, owner-supplied 2026-08-17.
 *
 * ⚠️ Replaced 26.142/-81.795, which was the Naples-DOWNTOWN approximation and
 * sat 5.6 miles south-southwest of the actual door — a pin that contradicted
 * the street address in the same schema block. The value was held at `null`
 * (omitting `geo` entirely) rather than estimated, because a wrong pin sends
 * customers to the wrong part of town.
 *
 * If the suite ever moves, take the new pair from Google Maps. Do not
 * interpolate one from the ZIP code.
 */
export const GEO: { latitude: number; longitude: number } | null = {
  latitude: 26.222053,
  longitude: -81.781429,
};

/**
 * Mon–Sat 11:00–15:00 — the BUILT-IN DEFAULT schedule. Since 2026-08 the live
 * hours are admin-editable (Admin → Settings → Store Hours, stored on
 * `shop_settings.store_hours`); this constant survives only as the source of
 * `DEFAULT_STORE_HOURS` in `store-hours.ts`, served whenever the DB value is
 * null, malformed, or unreachable. `opens`/`closes` are 24h `HH:MM`.
 *
 * ⛔ This is a FALLBACK, not the schedule. The admin panel is the source of
 * truth and the owner changes these on the fly — do not read this constant to
 * answer "when is the store open", and do not reintroduce day names into
 * prose or metadata. Keep it matching the CURRENT real hours anyway, because
 * it is what renders if the DB row is ever null or unreachable.
 * Updated 2026-08-27: Monday added (owner opened Mondays).
 *
 * ⚠️ These must match the Google Business Profile exactly. Google compares the
 * two once the profile is verified, and a mismatch is a self-inflicted wound.
 * The same applies to ADMIN-EDITED hours — the admin panel carries the warning.
 */
export const HOURS = {
  days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  opens: '11:00',
  closes: '15:00',
} as const;

/**
 * The business's verified Google Business Profile (CID 17050430560749692864).
 * This is the ENTITY url — it belongs in `sameAs`, and nowhere else.
 */
export const GOOGLE_BUSINESS_PROFILE_URL =
  'https://maps.google.com/?cid=17050430560749692864';

/**
 * One-click "leave a review" form, from Business Profile → "Ask for reviews".
 * Served by the /review route handler.
 *
 * ✅ Verified to be THIS business: the link resolves to a Maps place URL whose
 * embedded hex id `0xec9f4c4208f327c0` decodes to 17050430560749692864 — the
 * same CID as the profile above. Re-run that check if the link is ever
 * replaced; a review link for the wrong profile would send customers to a
 * competitor's page.
 *
 * ⛔ Never put this in `sameAs`. That field is an identity claim about the
 * business, not a call to action — a review FORM is not "another official
 * presence of this entity".
 */
export const GOOGLE_REVIEW_URL = 'https://g.page/r/CcAn8whCTJ_sEBM/review';

/**
 * `sameAs` for the JewelryStore entity — an IDENTITY claim, not a link list.
 * Every URL here tells Google "this is another official presence of this exact
 * business", which is what it uses to merge or split entities.
 *
 * ⛔ NEVER list `naplesjewelrybuyers.com` here (removed 2026-08-28). A different,
 * real business trades as "Naples Jewelry Buyers" in Naples with its own
 * VERIFIED Google Business Profile and more reviews. Claiming that name as our
 * own presence invites Google to merge the two entities — and a visitor who
 * reads the name may search it and land on the competitor's panel. The owner
 * owns that domain, so the claim was not false, merely dangerous; the risk is
 * one-sided and `sameAs` carries no PageRank, so there is nothing to lose by
 * omitting it.
 *
 * ⛔ Do not list naplesestatejewelry.com or the legacy .co here either — a page
 * does not need to declare itself, and the .co 301-redirects to this domain.
 */
export const SAME_AS: readonly string[] = [
  GOOGLE_BUSINESS_PROFILE_URL,
  'https://www.instagram.com/naples_estate_jewelry/',
  'https://www.facebook.com/naplesestatejewelry',
];

/** `6240 Shirley St, Ste 104` */
export function streetLine(): string {
  return `${ADDRESS.street}, ${ADDRESS.suite}`;
}

/** `Naples, FL 34109` */
export function cityLine(): string {
  return `${ADDRESS.locality}, ${ADDRESS.region} ${ADDRESS.postalCode}`;
}

/** `6240 Shirley St, Ste 104, Naples, FL 34109` — no landmark. */
export function addressOneLine(): string {
  return `${streetLine()}, ${cityLine()}`;
}

/**
 * `… · inside Sharon Lynch Collections`
 *
 * ⚠️ Naming the other business is WAYFINDING, not courtesy. The sign out front
 * reads Sharon Lynch Collections, so a customer looking for our name drives
 * past. "Inside" was chosen over "we share a space with" on purpose: it reads
 * as a destination rather than as a business arrangement, and it is the word
 * that actually helps someone find the door. Do not shorten this away.
 */
export function addressWithLandmark(isEs: boolean): string {
  return `${addressOneLine()} · ${landmarkPhrase(isEs)}`;
}

/**
 * `inside Sharon Lynch Collections` — the landmark clause on its own.
 *
 * Split out of `addressWithLandmark()` so a display surface can lay the clause
 * out as its own line instead of letting it wrap mid-name ("… inside Sharon /
 * Lynch Collections", which is how the footer read until 2026-08-18). The two
 * functions share this one string so they cannot drift.
 *
 * Prefer `<ShowroomAddress>` for anything a visitor reads as an address block;
 * `addressWithLandmark()` remains correct inside a prose sentence or an email,
 * where a React element cannot go.
 */
export function landmarkPhrase(isEs: boolean): string {
  const { lead, name } = landmarkParts(isEs);
  return `${lead}${name}`;
}

/**
 * The landmark clause split at the seam a layout needs: the preposition, which
 * may wrap, and the business name, which may not.
 *
 * `<ShowroomAddress>` renders these as two runs so "Sharon Lynch Collections"
 * can never break across lines while the clause as a whole still reflows in a
 * narrow column. `landmarkPhrase()` joins them back for prose and email.
 */
export function landmarkParts(isEs: boolean): { lead: string; name: string } {
  return { lead: isEs ? 'dentro de ' : 'inside ', name: SHARED_SPACE_NAME };
}

/** The full two-sentence version, for pages with room to explain the door. */
export function wayfindingSentence(isEs: boolean): string {
  return isEs
    ? `Nuestro salón en Naples está dentro de ${SHARED_SPACE_NAME}, en ${ADDRESS.street}, Suite 104 — busque su letrero y luego la Suite 104.`
    : `Our Naples showroom is inside ${SHARED_SPACE_NAME} at ${ADDRESS.street}, Suite 104 — look for their sign, then Suite 104.`;
}

export function byAppointmentLabel(isEs: boolean): string {
  return isEs ? 'o con cita' : 'or by appointment';
}

/**
 * Monday-first, so the two closed days bookend the open week instead of
 * stacking two "Closed" rows at the top of the list, which is what a
 * Sunday-first US calendar order would do.
 */
export const WEEK_ORDER = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

export type WeekDay = (typeof WEEK_ORDER)[number];

/**
 * One day of the admin-editable weekly schedule. `opens`/`closes` are 24h
 * `HH:MM` strings (the schema.org format AND the `<input type="time">` format).
 * A closed day keeps its last times so reopening it restores them.
 */
export interface StoreDayHours {
  open: boolean;
  opens: string;
  closes: string;
}

/**
 * The full weekly schedule, keyed by canonical ENGLISH day name. Stored as
 * jsonb on `shop_settings.store_hours`; fetched via `getStoreHours()` in
 * `store-hours.ts`, which falls back to `DEFAULT_STORE_HOURS` (built from
 * `HOURS` above) whenever the column is null, missing, or unreachable.
 *
 * Every hours formatter below is PURE and takes the schedule as a parameter —
 * this file never fetches, so it stays sync, testable, and client-safe.
 */
export type StoreHoursSchedule = Record<WeekDay, StoreDayHours>;

/**
 * `HOURS` as a schedule — Mon–Sat open 11:00–15:00, Sunday closed (carrying
 * the same times so the admin panel starts from sensible values). Lives HERE,
 * not in `store-hours.ts`, so client code (admin preview, module-scope legal
 * copy) can format the fallback without touching the server-only data layer.
 */
export const DEFAULT_STORE_HOURS: StoreHoursSchedule = Object.fromEntries(
  WEEK_ORDER.map((day) => [
    day,
    {
      open: (HOURS.days as readonly string[]).includes(day),
      opens: HOURS.opens,
      closes: HOURS.closes,
    },
  ]),
) as StoreHoursSchedule;

/**
 * ⚠️ Display only. `HOURS.days` stays English because schema.org
 * `OpeningHoursSpecification` requires English day names — never localize that.
 */
const DAY_LABELS_ES: Record<WeekDay, string> = {
  Monday: 'Lunes',
  Tuesday: 'Martes',
  Wednesday: 'Miércoles',
  Thursday: 'Jueves',
  Friday: 'Viernes',
  Saturday: 'Sábado',
  Sunday: 'Domingo',
};

export interface HoursRow {
  day: string;
  time: string;
  closed: boolean;
  /**
   * Canonical ENGLISH weekday. Separate from `day`, which is localized: the
   * "today" comparison runs against `Intl`'s en-US weekday name, so a Spanish
   * label could never match it. Always set since the grouped-rows variant was
   * removed (2026-08), but kept optional for interface stability.
   */
  dayKey?: string;
}

/**
 * ⚠️ The SHOWROOM's timezone, not the visitor's and not the server's.
 *
 * "Is it open today" is a question about Naples. A visitor in London at 02:00
 * GMT is still asking about the Naples day, and the build machine's timezone is
 * an implementation detail of whenever the page was prerendered.
 */
export const SHOWROOM_TIME_ZONE = 'America/New_York';

/**
 * Today's weekday in the showroom's timezone, as a canonical English name
 * matching `HOURS.days` / `WEEK_ORDER`.
 *
 * ⚠️ Client-side only in practice — see `ShowroomTodayBadge` for why calling
 * this during a prerender would bake in the build date.
 */
export function showroomWeekdayName(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: SHOWROOM_TIME_ZONE,
    weekday: 'long',
  }).format(now);
}

export function closedLabel(isEs: boolean): string {
  return isEs ? 'Cerrado' : 'Closed';
}

/**
 * `'HH:MM'` (24h) → human time, hand-rolled so the output stays byte-identical
 * to the strings this site has always shipped. ⛔ Do NOT swap these for
 * `Intl.DateTimeFormat` — its es-US output is `a. m.` (space between the
 * letters) where the site's convention is `a.m.`, and its en-US output never
 * produces the compact `11am` form.
 *
 * - `'en-compact'`: `11am`, `3pm`, `11:30am` — minutes only when non-zero.
 * - `'en-full'`:    `11:00 AM` — always minutes, space, uppercase.
 * - `'es'`:         `11:00 a.m.` — always minutes, space, lowercase + periods.
 */
function formatTime(hhmm: string, style: 'en-compact' | 'en-full' | 'es'): string {
  const [h24, m] = hhmm.split(':').map(Number);
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const isPm = h24 >= 12;
  const mm = String(m).padStart(2, '0');
  if (style === 'en-compact') {
    return `${h12}${m === 0 ? '' : `:${mm}`}${isPm ? 'pm' : 'am'}`;
  }
  if (style === 'en-full') {
    return `${h12}:${mm} ${isPm ? 'PM' : 'AM'}`;
  }
  return `${h12}:${mm} ${isPm ? 'p.m.' : 'a.m.'}`;
}

/** `11am–3pm` (compact, no spaces) or `11:00 AM – 3:00 PM` / `11:00 a.m. – 3:00 p.m.`. */
function formatTimeRange(opens: string, closes: string, style: 'en-compact' | 'en-full' | 'es'): string {
  const joiner = style === 'en-compact' ? '–' : ' – ';
  return `${formatTime(opens, style)}${joiner}${formatTime(closes, style)}`;
}

interface OpenSegment {
  days: WeekDay[];
  opens: string;
  closes: string;
}

/**
 * Maximal runs of CONSECUTIVE open days (Monday-first `WEEK_ORDER`) sharing
 * identical times. The default schedule compresses to one `Mon–Sat` segment.
 *
 * No Sunday↔Monday wrap-around merge: a schedule open Sun + Mon yields two
 * segments. `WEEK_ORDER` starts Monday precisely so the default closed days
 * bookend the week, and a wrap merge would buy nothing for real schedules
 * while making the labels ("Sun–Mon"?) ambiguous.
 */
function openSegments(schedule: StoreHoursSchedule): OpenSegment[] {
  const segments: OpenSegment[] = [];
  for (const day of WEEK_ORDER) {
    const d = schedule[day];
    if (!d?.open) continue;
    const last = segments[segments.length - 1];
    const prevDay = WEEK_ORDER[WEEK_ORDER.indexOf(day) - 1];
    if (
      last &&
      prevDay &&
      last.days[last.days.length - 1] === prevDay &&
      last.opens === d.opens &&
      last.closes === d.closes
    ) {
      last.days.push(day);
    } else {
      segments.push({ days: [day], opens: d.opens, closes: d.closes });
    }
  }
  return segments;
}

/**
 * A segment's day label.
 * - EN compact: `Tue` / `Tue–Sat` (3-letter, bare en dash).
 * - EN full: `Tuesday` / `Tuesday – Saturday` (spaced en dash).
 * - ES: `Martes` / `Martes a sábado` (first capitalized, second lowercase).
 */
function segmentDaysLabel(days: WeekDay[], style: 'en-compact' | 'en-full' | 'es'): string {
  const first = days[0];
  const last = days[days.length - 1];
  if (style === 'es') {
    const firstEs = DAY_LABELS_ES[first];
    return days.length === 1 ? firstEs : `${firstEs} a ${DAY_LABELS_ES[last].toLowerCase()}`;
  }
  if (style === 'en-compact') {
    return days.length === 1 ? first.slice(0, 3) : `${first.slice(0, 3)}–${last.slice(0, 3)}`;
  }
  return days.length === 1 ? first : `${first} – ${last}`;
}

/**
 * The one-line hours sentence: `Tue–Sat 11am–3pm, or by appointment` /
 * `Martes a sábado, 11:00 a.m. – 3:00 p.m., o con cita`.
 *
 * Note the deliberate asymmetry: ES separates days from times with a comma,
 * EN with a space — those are the bytes the site has always shipped. Multiple
 * segments join with `'; '`; an all-closed week reads `By appointment only` /
 * `Solo con cita` (no suffix).
 */
export function hoursLine(schedule: StoreHoursSchedule, isEs: boolean): string {
  const segments = openSegments(schedule);
  if (segments.length === 0) {
    return isEs ? 'Solo con cita' : 'By appointment only';
  }
  const parts = segments.map((s) =>
    isEs
      ? `${segmentDaysLabel(s.days, 'es')}, ${formatTimeRange(s.opens, s.closes, 'es')}`
      : `${segmentDaysLabel(s.days, 'en-compact')} ${formatTimeRange(s.opens, s.closes, 'en-compact')}`,
  );
  return `${parts.join('; ')}, ${byAppointmentLabel(isEs)}`;
}

/**
 * `{ days: 'Tuesday – Saturday', times: '11:00 AM – 3:00 PM' }` — the two-line
 * hours block (invoice/receipt pickup panel). Non-null only when the whole
 * week compresses to ONE segment; a split schedule or an all-closed week
 * returns null and the caller falls back to `hoursSegmentsFull()` / a
 * by-appointment line.
 */
export function hoursSummary(
  schedule: StoreHoursSchedule,
  isEs: boolean,
): { days: string; times: string } | null {
  const segments = openSegments(schedule);
  if (segments.length !== 1) return null;
  const s = segments[0];
  return {
    days: segmentDaysLabel(s.days, isEs ? 'es' : 'en-full'),
    times: formatTimeRange(s.opens, s.closes, isEs ? 'es' : 'en-full'),
  };
}

/**
 * Full-form segment lines for surfaces that need per-segment rows when
 * `hoursSummary()` is null: `['Tuesday – Wednesday 10:00 AM – 2:00 PM',
 * 'Friday 11:00 AM – 3:00 PM']`. Empty when every day is closed.
 */
export function hoursSegmentsFull(schedule: StoreHoursSchedule, isEs: boolean): string[] {
  return openSegments(schedule).map((s) =>
    isEs
      ? `${segmentDaysLabel(s.days, 'es')}, ${formatTimeRange(s.opens, s.closes, 'es')}`
      : `${segmentDaysLabel(s.days, 'en-full')} ${formatTimeRange(s.opens, s.closes, 'en-full')}`,
  );
}

/**
 * All seven days, each with its own time or "Closed" — the Google-Maps-style
 * list. Closed days are DERIVED from the schedule, never listed separately, so
 * changing the open days changes the list and the schema together.
 */
export function hoursRows(schedule: StoreHoursSchedule, isEs: boolean): HoursRow[] {
  return WEEK_ORDER.map((day) => {
    const d = schedule[day];
    const isOpen = Boolean(d?.open);
    return {
      day: isEs ? DAY_LABELS_ES[day] : day,
      time: isOpen ? formatTimeRange(d.opens, d.closes, isEs ? 'es' : 'en-full') : closedLabel(isEs),
      closed: !isOpen,
      dayKey: day,
    };
  });
}

/**
 * Embeddable map of the showroom, for an inline `<iframe>`.
 *
 * ⚠️ Keyless "classic" embed (`output=embed`) on purpose — the Maps Embed API
 * needs a billable API key, and this widget is decoration around an address we
 * already print. It frames `https://www.google.com`, so BOTH `next.config.ts`
 * and root `netlify.toml` must keep google.com in `frame-src`; without it the
 * frame renders blank with only a console error.
 *
 * Pins the owner-supplied GEO pair rather than geocoding the address, because
 * the coordinates are the verified door (see GEO above) and a geocoder is free
 * to disagree with a suite number. Falls back to the address only if GEO is
 * ever taken back to `null`.
 */
export function mapsEmbedUrl(zoom = 17): string {
  const query = GEO ? `${GEO.latitude},${GEO.longitude}` : addressOneLine();
  return `https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=${zoom}&output=embed`;
}

/** Maps link built from the address text, so it cannot drift from it. */
export function mapsUrl(): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${BUSINESS_NAME}, ${addressOneLine()}`,
  )}`;
}

/** schema.org PostalAddress. */
export function postalAddressSchema() {
  return {
    '@type': 'PostalAddress',
    streetAddress: `${ADDRESS.street}, ${ADDRESS.suite}`,
    addressLocality: ADDRESS.locality,
    addressRegion: ADDRESS.region,
    postalCode: ADDRESS.postalCode,
    addressCountry: ADDRESS.country,
  };
}

/**
 * schema.org OpeningHoursSpecification — one spec per distinct (opens, closes)
 * pair, with every open day sharing that pair listed in its `dayOfWeek` array
 * (grouping need not be contiguous; schema.org allows any day set). Day names
 * stay ENGLISH — never localize them. An all-closed week returns `[]`; the
 * caller should then omit `openingHoursSpecification` entirely rather than
 * publish an empty array.
 */
export function openingHoursSchema(schedule: StoreHoursSchedule) {
  const byTimes = new Map<string, { days: WeekDay[]; opens: string; closes: string }>();
  for (const day of WEEK_ORDER) {
    const d = schedule[day];
    if (!d?.open) continue;
    const key = `${d.opens}|${d.closes}`;
    const group = byTimes.get(key);
    if (group) {
      group.days.push(day);
    } else {
      byTimes.set(key, { days: [day], opens: d.opens, closes: d.closes });
    }
  }
  return [...byTimes.values()].map((g) => ({
    '@type': 'OpeningHoursSpecification',
    dayOfWeek: g.days,
    opens: g.opens,
    closes: g.closes,
  }));
}
