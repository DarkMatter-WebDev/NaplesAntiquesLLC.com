import type { CSSProperties } from 'react';
import type { Metadata } from 'next';
import Image from 'next/image';
import { pageMetadata } from '@/lib/seo';
import { AppIcon } from '@/components/AppIcon';
import ShowroomAddress from '@/components/ShowroomAddress';
import CopyAddressButton from '@/components/CopyAddressButton';
import CardTodayHours from '@/components/card/CardTodayHours';
import {
  FACEBOOK_URL,
  GOOGLE_REVIEW_URL,
  INSTAGRAM_URL,
  byAppointmentLabel,
  hoursRows,
  hoursSegmentsCompact,
  mapsUrl,
} from '@/lib/business-location';
import { getStoreHours } from '@/lib/store-hours';

/**
 * `/card` — the landing page printed (as a QR code) on the business cards.
 *
 * Why a page and not a redirect: cards are printed once, destinations change.
 * The URL on the card never moves; everything behind it is editable here or
 * in the admin panel (hours). Owner-approved mockup 2026-09-03, rev 3.
 *
 * Design rules, all deliberate:
 *
 * - **No site header, no footer, no breadcrumb.** Someone who just scanned a
 *   card wants one of four taps; the page IS the buttons. The domain link at
 *   the bottom is the way into the full site.
 * - **Slim English/Español toggle at the very top** (owner, 2026-09-03): the
 *   QR prints `/card` only, so a Spanish-speaking customer switches here.
 * - **Review is the gold button** (owner's pick): the card usually changes
 *   hands right after a sale, which is when a review ask lands. Call is the
 *   dark pill, as on the homepage Visit Us block.
 * - **Text is prefilled** ("Hi Chris, I have your card …"): lowers the hurdle
 *   for someone unsure how to start, and tells the owner the lead came from a
 *   card — the site has no scan analytics. `sms:` + `?&body=` is the one
 *   form both iOS and Android honour.
 * - **noindex and OFF the sitemap.** A thin utility page must never compete
 *   with `/contact` or `/sell` in search. Guarded by `card-page.test.ts`.
 * - Every fact on the page comes from `business-location.ts` and the
 *   admin-editable hours — nothing here can drift from the rest of the site.
 */

interface Props {
  params: Promise<{ locale: string }>;
}

const PHONE_DISPLAY = '(239) 404-8505';
const PHONE_TEL = 'tel:2394048505';
const SMS_NUMBER = '2394048505';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const isEs = locale === 'es';
  return {
    ...pageMetadata({
      title: isEs ? 'Tarjeta de Contacto' : 'Contact Card',
      description: isEs
        ? 'Llame, envíe un mensaje, obtenga indicaciones o deje una reseña — Naples Estate Jewelry, 6240 Shirley St, Ste 104, Naples, FL.'
        : 'Call, text, get directions, or leave a review — Naples Estate Jewelry, 6240 Shirley St, Ste 104, Naples, FL.',
      path: '/card',
      locale,
    }),
    // The QR landing page is a utility, not content: never index it.
    robots: { index: false, follow: false },
  };
}

/** The primary pills: full width, thumb-height, a step larger than the site's default pill. */
const BIG_BUTTON: CSSProperties = {
  width: '100%',
  minHeight: '2.9rem',
  fontSize: '0.74rem',
  gap: '0.6rem',
};

function InstagramGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function FacebookGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}

export default async function CardPage({ params }: Props) {
  const { locale } = await params;
  const isEs = locale === 'es';
  const schedule = await getStoreHours();
  const rows = hoursRows(schedule, isEs);
  const segments = hoursSegmentsCompact(schedule, isEs);

  const smsBody = isEs
    ? 'Hola Chris, tengo su tarjeta y quisiera preguntar sobre '
    : 'Hi Chris, I have your card and I’d like to ask about ';
  // `?&body=`: iOS wants `&`, Android wants `?`; this form satisfies both.
  const smsHref = `sms:${SMS_NUMBER}?&body=${encodeURIComponent(smsBody)}`;

  const prefix = isEs ? '/es' : '';
  const tileClass =
    'flex items-center justify-center gap-2 rounded-xl border px-2 py-3 text-[0.7rem] font-semibold uppercase tracking-[0.08em] no-underline';
  const tileStyle: CSSProperties = {
    background: 'var(--color-surface-container-lowest)',
    borderColor: 'var(--color-outline-variant)',
    color: 'var(--color-on-surface)',
    fontFamily: 'var(--font-label)',
  };
  const tileIconStyle: CSSProperties = { color: 'var(--color-primary)' };

  return (
    <main className="flex flex-1 flex-col" style={{ background: 'var(--color-background)' }}>
      {/* Language toggle — slim, at the very top, both languages always
          visible. Plain anchors (full navigation): the page is static and a
          client router adds nothing here. */}
      <nav
        aria-label={isEs ? 'Idioma' : 'Language'}
        className="flex items-stretch justify-center border-b"
        style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}
      >
        {(['en', 'es'] as const).map((lang) => {
          const current = lang === locale;
          return (
            <a
              key={lang}
              href={lang === 'es' ? '/es/card' : '/card'}
              hrefLang={lang}
              lang={lang}
              aria-current={current ? 'page' : undefined}
              className="px-6 py-2.5 text-[0.7rem] font-bold uppercase tracking-[0.16em] no-underline"
              style={{
                fontFamily: 'var(--font-label)',
                color: current ? 'var(--color-primary)' : 'var(--color-on-surface-variant)',
                borderBottom: `2px solid ${current ? 'var(--color-primary)' : 'transparent'}`,
                marginBottom: '-1px',
              }}
            >
              {lang === 'es' ? 'Español' : 'English'}
            </a>
          );
        })}
      </nav>

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-6 pb-6 pt-5">
        {/* Brand — name above the mark (owner, 2026-09-03), in the header's
            Caslon uppercase so it reads as the same wordmark. */}
        <div className="flex flex-col items-center text-center">
          {/* The wordmark is a home link, as on every other page. */}
          <a href={prefix || '/'} className="flex flex-col items-center no-underline" style={{ color: 'inherit' }}>
          <h1
            className="text-[1.2rem] uppercase leading-none tracking-[0.08em]"
            style={{ color: 'var(--color-on-surface)', fontFamily: 'var(--font-headline)' }}
          >
            Naples Estate Jewelry
          </h1>
          <Image
            src="/assets/images/branding/nav-logo.webp"
            alt=""
            width={157}
            height={120}
            priority
            className="mt-2 h-11 w-auto"
          />
          </a>
          {/* Two deliberate lines: the full phrase cannot fit one line at
              375px at this size, and a wrap leaves the separator dangling. */}
          <p
            className="mt-2 text-[0.8125rem] font-bold uppercase leading-snug tracking-[0.12em]"
            style={{ color: 'var(--color-on-surface)', fontFamily: 'var(--font-label)' }}
          >
            {isEs ? 'Compradores de Oro, Plata y Joyas' : 'Gold, Sterling & Jewelry Buyers'}
            <span
              className="mt-0.5 block text-[0.7rem] font-semibold tracking-[0.18em]"
              style={{ color: 'var(--color-on-surface-variant)' }}
            >
              Naples, FL
            </span>
          </p>
        </div>

        {/* Hours */}
        <div className="mt-4 text-center">
          <CardTodayHours
            rows={rows}
            openLabel={isEs ? 'Abierto hoy' : 'Open today'}
            closedLabel={isEs ? 'Cerrado hoy' : 'Closed today'}
            badgeLabel={isEs ? 'Hoy' : 'Today'}
          />
          <p
            className="mt-1 flex flex-wrap items-center justify-center gap-x-1.5 text-[0.8125rem]"
            style={{ color: 'var(--color-on-surface-variant)' }}
          >
            {/* Separators TRAIL each segment rather than lead the next one:
                the Spanish line wraps at 375px, and a wrapped line must not
                start with a lone middot. */}
            {segments.map((segment) => (
              <span key={segment.days} className="whitespace-nowrap">
                <b className="font-bold" style={{ color: 'var(--color-on-surface)' }}>{segment.days}</b>{' '}
                {segment.times}
                <span aria-hidden="true" className="ml-1.5 opacity-60">·</span>
              </span>
            ))}
            <span className="whitespace-nowrap">{byAppointmentLabel(isEs)}</span>
          </p>
        </div>

        {/* The primary taps */}
        <div className="mt-4 flex flex-col gap-2">
          <a href={PHONE_TEL} className="dark-button" style={BIG_BUTTON}>
            <AppIcon name="call" className="text-[1.15rem]" />
            {isEs ? `Llamar ${PHONE_DISPLAY}` : `Call ${PHONE_DISPLAY}`}
          </a>
          <a href={smsHref} className="outline-button" style={BIG_BUTTON}>
            <AppIcon name="sms" className="text-[1.15rem]" />
            {isEs ? 'Mensaje de Texto' : 'Text Chris'}
          </a>
          <a href={GOOGLE_REVIEW_URL} target="_blank" rel="noopener noreferrer" className="gold-button" style={BIG_BUTTON}>
            <AppIcon name="star" className="text-[1.15rem]" />
            {isEs ? 'Dejar una Reseña en Google' : 'Leave a Google Review'}
          </a>
        </div>

        {/* Secondary links */}
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <a href={`${prefix}/sell`} className={tileClass} style={tileStyle}>
            <AppIcon name="diamond" className="text-[1.25rem]" style={tileIconStyle} />
            {isEs ? 'Qué Compramos' : 'What We Buy'}
          </a>
          <a href={`${prefix}/shop`} className={tileClass} style={tileStyle}>
            <AppIcon name="shopping_bag" className="text-[1.25rem]" style={tileIconStyle} />
            {isEs ? 'Tienda' : 'Shop'}
          </a>
          <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className={tileClass} style={tileStyle}>
            <span style={tileIconStyle}><InstagramGlyph /></span>
            Instagram
          </a>
          <a href={FACEBOOK_URL} target="_blank" rel="noopener noreferrer" className={tileClass} style={tileStyle}>
            <span style={tileIconStyle}><FacebookGlyph /></span>
            Facebook
          </a>
        </div>

        {/* Address — pinned to the bottom of the screen on a tall phone. The
            landmark line is included on purpose (approved in the mockup): the
            sign out front is the other business's, and this page is read by
            someone standing in the parking lot. */}
        <div className="mt-5 text-center text-[0.9rem] leading-relaxed" style={{ color: 'var(--color-on-surface)' }}>
          <div className="flex items-start justify-center gap-2">
            <ShowroomAddress locale={locale} />
            <CopyAddressButton locale={locale} className="mt-0.5" />
          </div>
          {/* Directions live with the address they point at (owner, 2026-09-03). */}
          <a
            href={mapsUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="outline-button mt-3"
            style={{ width: '100%', minHeight: '2.75rem', fontSize: '0.72rem', gap: '0.5rem' }}
          >
            <AppIcon name="location_on" className="text-[1.05rem]" />
            {isEs ? 'Cómo Llegar' : 'Get Directions'}
          </a>
        </div>

        {/* An unmistakable way off the card and into the full site (owner ask). */}
        <a
          href={prefix || '/'}
          className="outline-button mt-2.5"
          style={{ width: '100%', minHeight: '2.75rem', fontSize: '0.72rem', gap: '0.5rem' }}
        >
          {isEs ? 'Visitar Nuestro Sitio Web' : 'Visit Our Website'}
          <AppIcon name="trending_flat" className="text-[1rem]" />
        </a>
      </div>
    </main>
  );
}
