'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';

const GOLD = '#735c00';
const SECONDARY = '#5e5e5d';
const BORDER = '#d8d0c2';

const navLinkBase =
  'text-sm font-medium tracking-wide px-1 py-2 transition-colors hover:text-[#735c00]';

export default function SiteHeader() {
  const t = useTranslations('nav');
  const locale = useLocale();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [sellOpen, setSellOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);

  function href(path: string) {
    return `${locale === 'es' ? '/es' : ''}${path}`;
  }

  const altLocale = locale === 'en' ? 'es' : 'en';
  const altPath = pathname.replace(/^\/(es)(\/|$)/, '/').replace(/^(?!\/)/, '/');
  const altHref = altLocale === 'es' ? `/es${altPath === '/' ? '' : altPath}` : altPath;

  const SELL_ITEMS = [
    { key: 'estateJewelry' as const, path: '/estate-jewelry' },
    { key: 'goldServices' as const, path: '/gold-services' },
    { key: 'silverServices' as const, path: '/silver-services' },
    { key: 'bullion' as const, path: '/bullion' },
  ];

  const SERVICE_ITEMS = [
    { key: 'freeEvaluation' as const, path: '/free-evaluation' },
    { key: 'estateServices' as const, path: '/estate-services' },
  ];

  function closeAll() {
    setMenuOpen(false);
    setSellOpen(false);
    setServicesOpen(false);
  }

  return (
    <header
      className="fixed top-0 w-full z-50 backdrop-blur-sm"
      style={{ background: 'rgba(249,249,247,0.95)', borderBottom: `1px solid ${BORDER}` }}
    >
      <div className="flex items-center justify-between gap-2 px-3 py-3 md:px-8 md:py-5 w-full max-w-[1440px] mx-auto">

        {/* Brand */}
        <Link href={href('/')} className="flex items-center gap-2 min-w-0 shrink">
          <Image
            src="/assets/images/branding/logo.webp"
            alt="Naples Estate Jewelry Logo"
            width={40}
            height={40}
            className="h-8 w-auto md:h-10 object-contain flex-shrink-0"
            priority
            unoptimized
          />
          {/* Full name on md+; abbreviated on mobile */}
          <span
            className="hidden sm:block md:text-[22px] text-[13px] tracking-normal uppercase whitespace-nowrap"
            style={{ fontFamily: 'var(--font-headline)', color: GOLD }}
          >
            Naples Estate Jewelry Co
          </span>
          <span
            className="block sm:hidden text-[11px] tracking-normal uppercase whitespace-nowrap"
            style={{ fontFamily: 'var(--font-headline)', color: GOLD }}
          >
            Naples Estate Jewelry
          </span>
        </Link>

        {/* Desktop nav — 2xl and up */}
        <nav className="hidden 2xl:flex items-center gap-5" style={{ fontFamily: 'var(--font-label)' }}>
          <Link href={href('/')} className={navLinkBase} style={{ color: SECONDARY }}>{t('home')}</Link>
          <Link href={href('/shop')} className={navLinkBase} style={{ color: SECONDARY }}>{t('shop')}</Link>

          {/* Sell To Us dropdown */}
          <div className="group relative flex items-center">
            <Link href={href('/estate-jewelry')} className={navLinkBase} style={{ color: SECONDARY }}>
              {t('sellToUs')}
            </Link>
            <DesktopDropdown items={SELL_ITEMS} t={t} href={href} />
          </div>

          <Link href={href('/about')} className={navLinkBase} style={{ color: SECONDARY }}>{t('about')}</Link>

          {/* Services dropdown */}
          <div className="group relative flex items-center">
            <Link href={href('/free-evaluation')} className={navLinkBase} style={{ color: SECONDARY }}>
              {t('services')}
            </Link>
            <DesktopDropdown items={SERVICE_ITEMS} t={t} href={href} />
          </div>

          <Link href={href('/contact')} className={navLinkBase} style={{ color: SECONDARY }}>{t('contact')}</Link>
          <Link href={href('/account')} className={navLinkBase} style={{ color: SECONDARY }}>{t('myAccount')}</Link>
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
          <Link
            href={altHref}
            className="text-[10px] md:text-xs font-bold tracking-widest uppercase px-1.5 py-1 transition-colors"
            style={{ color: GOLD, fontFamily: 'var(--font-label)' }}
          >
            {locale === 'en' ? 'ES' : 'EN'}
          </Link>

          {/* Call Now — hidden on mobile; inline-flex at 2xl. Wrapped in span to prevent gold-button display override */}
          <span className="hidden 2xl:inline-flex">
            <a href="tel:2394048505" className="gold-button">{t('callNow')}</a>
          </span>

          {/* Phone icon link — mobile only, compact */}
          <a
            href="tel:2394048505"
            className="2xl:hidden flex items-center justify-center w-8 h-8 rounded-full border transition-colors"
            style={{ borderColor: `${GOLD}60`, color: GOLD }}
            aria-label="Call us"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '17px', lineHeight: 1 }}>call</span>
          </a>

          <button
            type="button"
            onClick={() => {
              if (menuOpen) { closeAll(); } else { setMenuOpen(true); }
            }}
            className="2xl:hidden border px-2.5 py-1.5 md:px-3 md:py-2 text-[10px] md:text-xs font-bold tracking-widest uppercase"
            style={{ borderColor: `${GOLD}80`, color: GOLD, fontFamily: 'var(--font-label)' }}
            aria-expanded={menuOpen}
            aria-label={menuOpen ? t('close') : t('menu')}
          >
            {menuOpen ? t('close') : t('menu')}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div
          className="2xl:hidden border-t"
          style={{ borderColor: BORDER, background: 'rgba(249,249,247,0.98)' }}
        >
          <div className="flex flex-col px-4 py-3" style={{ fontFamily: 'var(--font-label)' }}>

            <MobileLink href={href('/')} onClick={closeAll} style={{ color: GOLD }}>{t('home')}</MobileLink>
            <MobileLink href={href('/shop')} onClick={closeAll}>{t('shop')}</MobileLink>

            {/* Sell To Us — collapsible */}
            <MobileAccordion
              label={t('sellToUs')}
              open={sellOpen}
              onToggle={() => setSellOpen(o => !o)}
            >
              {SELL_ITEMS.map(({ key, path }) => (
                <MobileLink key={key} href={href(path)} onClick={closeAll} sub>{t(key)}</MobileLink>
              ))}
            </MobileAccordion>

            <MobileLink href={href('/about')} onClick={closeAll}>{t('about')}</MobileLink>

            {/* Services — collapsible */}
            <MobileAccordion
              label={t('services')}
              open={servicesOpen}
              onToggle={() => setServicesOpen(o => !o)}
            >
              {SERVICE_ITEMS.map(({ key, path }) => (
                <MobileLink key={key} href={href(path)} onClick={closeAll} sub>{t(key)}</MobileLink>
              ))}
            </MobileAccordion>

            <MobileLink href={href('/contact')} onClick={closeAll}>{t('contact')}</MobileLink>
            <MobileLink href={href('/account')} onClick={closeAll}>{t('myAccount')}</MobileLink>

            <MobileLink href={altHref} onClick={closeAll} style={{ color: GOLD }}>
              {locale === 'en' ? 'Español' : 'English'}
            </MobileLink>

          </div>
        </div>
      )}
    </header>
  );
}

/* ── Sub-components ─────────────────────────────────────── */

function DesktopDropdown({
  items,
  t,
  href,
}: {
  items: { key: string; path: string }[];
  t: (k: string) => string;
  href: (p: string) => string;
}) {
  return (
    <div
      className="absolute left-0 top-full z-50 min-w-[190px] py-2 opacity-0 pointer-events-none -translate-y-1 transition-all duration-150 group-hover:opacity-100 group-hover:pointer-events-auto group-hover:translate-y-0 group-focus-within:opacity-100 group-focus-within:pointer-events-auto group-focus-within:translate-y-0"
      style={{
        background: 'rgba(47,49,49,0.99)',
        border: '1px solid rgba(216,208,194,0.18)',
        boxShadow: '0 18px 40px rgba(0,0,0,0.28)',
      }}
    >
      {items.map(({ key, path }) => (
        <Link
          key={key}
          href={href(path)}
          className="block px-3 py-[0.65rem] text-sm transition-colors hover:bg-white/5"
          style={{ color: '#d7d0c3', fontFamily: 'var(--font-label)' }}
        >
          {t(key)}
        </Link>
      ))}
    </div>
  );
}

function MobileAccordion({
  label,
  open,
  onToggle,
  children,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between border-b py-3 transition-colors hover:text-[#735c00]"
        style={{ borderColor: BORDER, fontFamily: 'var(--font-label)' }}
        aria-expanded={open}
      >
        <span
          className="text-xs font-bold uppercase tracking-[0.08em]"
          style={{ color: '#1a1c1c' }}
        >
          {label}
        </span>
        <span
          className="material-symbols-outlined transition-transform duration-200"
          style={{ fontSize: '18px', lineHeight: 1, color: GOLD, transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          expand_more
        </span>
      </button>
      {open && <div className="flex flex-col">{children}</div>}
    </div>
  );
}

function MobileLink({
  href,
  onClick,
  children,
  sub = false,
  style,
}: {
  href: string;
  onClick: () => void;
  children: React.ReactNode;
  sub?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="py-3 border-b text-sm font-medium transition-colors hover:text-[#735c00]"
      style={{
        borderColor: BORDER,
        color: sub ? GOLD : '#1a1c1c',
        paddingLeft: sub ? '1.75rem' : undefined,
        fontSize: sub ? '0.9rem' : '0.75rem',
        textTransform: sub ? 'none' : 'uppercase',
        letterSpacing: sub ? '0.02em' : '0.08em',
        fontWeight: sub ? 500 : 700,
        ...style,
      }}
    >
      {children}
    </Link>
  );
}
