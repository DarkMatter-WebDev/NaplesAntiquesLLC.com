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
 * Tue–Sat 11:00–15:00. `opens`/`closes` are 24h for schema.org
 * OpeningHoursSpecification; the human strings are built below.
 *
 * ⚠️ These must match the Google Business Profile exactly. Google compares the
 * two once the profile is verified, and a mismatch is a self-inflicted wound.
 */
export const HOURS = {
  days: ['Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  opens: '11:00',
  closes: '15:00',
} as const;

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

/** `Tue–Sat 11am–3pm, or by appointment` */
export function hoursLine(isEs: boolean): string {
  return isEs
    ? 'Martes a sábado, 11:00 a.m. – 3:00 p.m., o con cita'
    : 'Tue–Sat 11am–3pm, or by appointment';
}

/** `Tuesday – Saturday` / `11:00 AM – 3:00 PM`, for a two-line hours block. */
export function hoursDaysLabel(isEs: boolean): string {
  return isEs ? 'Martes a sábado' : 'Tuesday – Saturday';
}

export function hoursTimesLabel(isEs: boolean): string {
  return isEs ? '11:00 a.m. – 3:00 p.m.' : '11:00 AM – 3:00 PM';
}

export function byAppointmentLabel(isEs: boolean): string {
  return isEs ? 'o con cita' : 'or by appointment';
}

/**
 * Monday-first, so the two closed days bookend the open week instead of
 * stacking two "Closed" rows at the top of the list, which is what a
 * Sunday-first US calendar order would do.
 */
const WEEK_ORDER = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

type WeekDay = (typeof WEEK_ORDER)[number];

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
   * Canonical ENGLISH weekday for a single-day row, or undefined on a grouped
   * row that covers several days. Separate from `day`, which is localized: the
   * "today" comparison runs against `Intl`'s en-US weekday name, so a Spanish
   * label could never match it.
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
 * All seven days, each with its own time or "Closed" — the Google-Maps-style
 * list. Closed days are DERIVED from `HOURS.days`, never listed separately, so
 * changing the open days changes the list and the schema together.
 */
export function hoursRows(isEs: boolean): HoursRow[] {
  const open = new Set<string>(HOURS.days);
  return WEEK_ORDER.map((day) => {
    const isOpen = open.has(day);
    return {
      day: isEs ? DAY_LABELS_ES[day] : day,
      time: isOpen ? hoursTimesLabel(isEs) : closedLabel(isEs),
      closed: !isOpen,
      dayKey: day,
    };
  });
}

/**
 * The same information in two rows, for surfaces too tight for seven — a
 * marketing CTA, not a reference block.
 *
 * ⚠️ The closed-day label is hardcoded to "Sunday – Monday" because that is
 * what the current `HOURS.days` leaves over. If the open days ever change so
 * the closed days are no longer a contiguous Sunday/Monday pair, this grouping
 * silently lies — use `hoursRows()` instead, which cannot.
 */
export function hoursRowsGrouped(isEs: boolean): HoursRow[] {
  return [
    { day: hoursDaysLabel(isEs), time: hoursTimesLabel(isEs), closed: false },
    {
      day: isEs ? 'Domingo y lunes' : 'Sunday – Monday',
      time: closedLabel(isEs),
      closed: true,
    },
  ];
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

/** schema.org OpeningHoursSpecification. */
export function openingHoursSchema() {
  return [
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: [...HOURS.days],
      opens: HOURS.opens,
      closes: HOURS.closes,
    },
  ];
}
