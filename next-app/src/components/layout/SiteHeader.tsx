'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { useWishlist } from '@/context/WishlistContext';
import { useCart } from '@/context/CartContext';

const GOLD = '#735c00';
const SECONDARY = '#5e5e5d';

const navLinkBase =
  'text-sm font-medium tracking-wide px-1 py-2 transition-colors hover:text-[#735c00]';

const HEADER_STYLES = `
  /* Desktop dropdown — white card matching the auth/shop modernization */
  .nav-dropdown {
    left: 0;
    top: calc(100% + 6px);
    min-width: 210px;
    background: #ffffff;
    border: 1px solid rgba(115, 92, 0, 0.15);
    border-radius: 8px;
    box-shadow: 0 18px 52px rgba(42, 34, 12, 0.12);
    padding: 0.4rem;
  }
  /* Invisible bridge so hover survives the gap between trigger and panel */
  .nav-dropdown::before {
    content: '';
    position: absolute;
    top: -8px;
    left: 0;
    right: 0;
    height: 8px;
  }
  .nav-dropdown-link {
    display: block;
    padding: 0.6rem 0.85rem;
    border-radius: 6px;
    font-family: var(--font-label);
    font-size: 0.82rem;
    color: var(--color-on-surface);
    text-decoration: none;
    transition: background 150ms ease, color 150ms ease;
  }
  .nav-dropdown-link:hover {
    background: linear-gradient(135deg, #dcb336, #b5890c);
    color: #fffdf7;
  }

  /* Gold-gradient call CTA */
  .nav-cta {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.65rem 1.4rem;
    border-radius: 6px;
    background: linear-gradient(135deg, #dcb336, #b5890c);
    color: #fffdf7;
    font-family: var(--font-label);
    font-size: 0.68rem;
    font-weight: 800;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    text-decoration: none;
    box-shadow: 0 10px 24px rgba(181, 137, 12, 0.18);
    transition: filter 160ms ease, box-shadow 160ms ease, transform 160ms ease;
  }
  .nav-cta:hover {
    filter: brightness(1.04);
    box-shadow: 0 14px 30px rgba(181, 137, 12, 0.24);
    transform: translateY(-1px);
  }

  /* Menu toggle (mobile) */
  .menu-toggle {
    border: 1px solid rgba(115, 92, 0, 0.5);
    border-radius: 6px;
    color: ${GOLD};
    font-family: var(--font-label);
    transition: background 150ms ease, color 150ms ease, border-color 150ms ease, box-shadow 150ms ease;
  }
  .menu-toggle[data-open="true"] {
    background: linear-gradient(135deg, #dcb336, #b5890c);
    border-color: transparent;
    color: #fffdf7;
    box-shadow: 0 8px 20px rgba(181, 137, 12, 0.2);
  }

  /* Mobile menu panel — elevated, warm-tinted, rounded */
  .mobile-menu-panel {
    border-top: 1px solid rgba(115, 92, 0, 0.12);
    border-radius: 0 0 14px 14px;
    box-shadow: 0 24px 44px rgba(42, 34, 12, 0.12);
    background:
      radial-gradient(circle at 92% 0%, rgba(220, 188, 96, 0.12), transparent 16rem),
      rgba(252, 251, 247, 0.98);
    overflow: hidden;
  }
  .mobile-row {
    border-bottom: 1px solid rgba(115, 92, 0, 0.10);
  }
  .mobile-row:last-child {
    border-bottom: none;
  }
  .mobile-nav-link {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 0.85rem 0.65rem;
    border-radius: 6px;
    font-family: var(--font-label);
    transition: background 150ms ease, color 150ms ease;
  }
  .mobile-nav-link:hover,
  .mobile-nav-link:active {
    color: ${GOLD};
    background: rgba(212, 175, 55, 0.10);
  }
  .mobile-accordion-btn[data-open="true"] {
    background: rgba(212, 175, 55, 0.12);
    color: ${GOLD};
  }
  .mobile-sub-list {
    margin: 0.15rem 0 0.5rem;
    padding: 0.3rem;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.7);
    border: 1px solid rgba(115, 92, 0, 0.1);
  }
  .mobile-sub-link {
    display: block;
    padding: 0.6rem 0.75rem;
    border-radius: 6px;
    font-family: var(--font-label);
    font-size: 0.9rem;
    color: ${GOLD};
    text-decoration: none;
    transition: background 150ms ease, color 150ms ease;
  }
  .mobile-sub-link:hover,
  .mobile-sub-link:active {
    background: linear-gradient(135deg, #dcb336, #b5890c);
    color: #fffdf7;
  }
`;

export default function SiteHeader() {
  const t = useTranslations('nav');
  const locale = useLocale();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [sellOpen, setSellOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const { count: wishlistCount, openDrawer: openWishlist } = useWishlist();
  const { count: cartCount, openDrawer: openCart, clear: clearCart, recentlyAdded, dismissAdded } = useCart();

  function href(path: string) {
    return `${locale === 'es' ? '/es' : ''}${path}`;
  }

  const altLocale = locale === 'en' ? 'es' : 'en';
  const altPath = pathname.replace(/^\/(es)(\/|$)/, '/').replace(/^(?!\/)/, '/');
  const altHref = altLocale === 'es' ? `/es${altPath === '/' ? '' : altPath}` : altPath;

  const SHOP_ITEMS = [
    { key: 'store' as const, path: '/store' },
    { key: 'auctions' as const, path: '/auctions' },
  ];

  const SELL_ITEMS = [
    { key: 'estateJewelry' as const, path: '/estate-jewelry' },
    { key: 'goldServices' as const, path: '/gold-services' },
    { key: 'silverServices' as const, path: '/silver-services' },
    { key: 'bullion' as const, path: '/bullion' },
  ];

  const ABOUT_ITEMS = [
    { key: 'aboutUs' as const, path: '/about' },
    { key: 'otherServices' as const, path: '/services' },
  ];

  function closeAll() {
    setMenuOpen(false);
    setShopOpen(false);
    setSellOpen(false);
    setAboutOpen(false);
  }

  return (
    <header
      className="fixed top-0 w-full z-50 backdrop-blur-sm"
      style={{
        background: 'rgba(249,249,247,0.95)',
        borderBottom: '1px solid rgba(115,92,0,0.12)',
        boxShadow: '0 6px 24px rgba(42,34,12,0.05)',
      }}
    >
      <div className="flex items-center justify-between gap-2 px-3 py-3 md:px-8 md:py-5 w-full max-w-[1440px] mx-auto">

        {/* Brand */}
        <Link href={href('/')} className="flex items-center gap-2 min-w-0 shrink">
          <Image
            src="/assets/images/branding/logo.webp"
            alt="Naples Estate Jewelry Logo"
            width={40}
            height={40}
            className="hidden md:block h-8 w-auto md:h-10 object-contain flex-shrink-0"
            priority
            unoptimized
          />
          {/* Full name on md+; abbreviated on mobile */}
          <span
            className="hidden sm:block md:text-[22px] text-[13px] tracking-normal uppercase whitespace-nowrap"
            style={{ fontFamily: 'var(--font-headline)', color: GOLD }}
          >
            Naples Estate Jewelry.Co
          </span>
          <span
            className="block sm:hidden text-[11px] tracking-normal uppercase whitespace-nowrap"
            style={{ fontFamily: 'var(--font-headline)', color: GOLD }}
          >
            Naples Estate Jewelry.Co
          </span>
        </Link>

        {/* Desktop nav — 2xl and up */}
        <nav className="hidden 2xl:flex items-center gap-5" style={{ fontFamily: 'var(--font-label)' }}>
          <Link href={href('/')} className={navLinkBase} style={{ color: SECONDARY }}>{t('home')}</Link>
          <div className="group relative flex items-center">
            <Link href={href('/store')} className={navLinkBase} style={{ color: SECONDARY }}>
              {t('shop')}
            </Link>
            <DesktopDropdown items={SHOP_ITEMS} t={t} href={href} />
          </div>

          {/* Sell To Us dropdown */}
          <div className="group relative flex items-center">
            <Link href={href('/estate-jewelry')} className={navLinkBase} style={{ color: SECONDARY }}>
              {t('sellToUs')}
            </Link>
            <DesktopDropdown items={SELL_ITEMS} t={t} href={href} />
          </div>

          {/* About dropdown */}
          <div className="group relative flex items-center">
            <Link href={href('/about')} className={navLinkBase} style={{ color: SECONDARY }}>
              {t('about')}
            </Link>
            <DesktopDropdown items={ABOUT_ITEMS} t={t} href={href} />
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

          {/* Wishlist heart — desktop only */}
          <button
            type="button"
            onClick={openWishlist}
            className="relative hidden 2xl:flex items-center justify-center w-8 h-8 transition-colors"
            style={{ color: wishlistCount > 0 ? GOLD : '#5e5e5d' }}
            aria-label="Saved items"
          >
            <span
              className="material-symbols-outlined"
              style={{
                fontSize: '20px',
                lineHeight: 1,
                fontVariationSettings: wishlistCount > 0 ? "'FILL' 1" : "'FILL' 0",
              }}
            >
              favorite
            </span>
            {wishlistCount > 0 && (
              <span
                className="absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center text-[0.5rem] font-bold rounded-full"
                style={{ background: GOLD, color: '#fff', fontFamily: 'var(--font-label)' }}
              >
                {wishlistCount > 9 ? '9+' : wishlistCount}
              </span>
            )}
          </button>

          {/* Cart button + added popup */}
          <div className="relative">
            <button
              type="button"
              onClick={openCart}
              className="relative flex items-center justify-center w-8 h-8 transition-colors"
              style={{ color: cartCount > 0 ? GOLD : '#5e5e5d' }}
              aria-label="Cart"
            >
              <span
                className="material-symbols-outlined"
                style={{
                  fontSize: '20px',
                  lineHeight: 1,
                  fontVariationSettings: cartCount > 0 ? "'FILL' 1" : "'FILL' 0",
                }}
              >
                shopping_bag
              </span>
              {cartCount > 0 && (
                <span
                  className="absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center text-[0.5rem] font-bold rounded-full"
                  style={{ background: GOLD, color: '#fff', fontFamily: 'var(--font-label)' }}
                >
                  {cartCount > 9 ? '9+' : cartCount}
                </span>
              )}
            </button>

            {/* "Item added" mini popup */}
            {recentlyAdded && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 10px)',
                  right: 0,
                  width: '220px',
                  background: 'white',
                  border: '1px solid rgba(115,92,0,0.15)',
                  borderRadius: '8px',
                  boxShadow: '0 18px 52px rgba(42,34,12,0.12)',
                  padding: '0.85rem',
                  zIndex: 60,
                }}
              >
                {/* Arrow */}
                <div style={{
                  position: 'absolute',
                  top: '-6px',
                  right: '10px',
                  width: '10px',
                  height: '10px',
                  background: 'white',
                  border: '1px solid rgba(115,92,0,0.15)',
                  borderBottom: 'none',
                  borderRight: 'none',
                  transform: 'rotate(45deg)',
                }} />
                <p style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: GOLD, fontFamily: 'var(--font-label)', marginBottom: '0.2rem' }}>
                  {locale === 'es' ? 'Agregado al carrito' : 'Item added'}
                </p>
                <p style={{ fontSize: '0.75rem', color: '#555', marginBottom: '0.6rem', lineHeight: 1.3 }} className="line-clamp-2">
                  {recentlyAdded}
                </p>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => { dismissAdded(); openCart(); }}
                    style={{ flex: 1, fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0.45rem 0.5rem', background: 'linear-gradient(135deg, #dcb336, #b5890c)', color: '#fffdf7', border: 'none', borderRadius: '6px', cursor: 'pointer', fontFamily: 'var(--font-label)', boxShadow: '0 8px 18px rgba(181,137,12,0.18)' }}
                  >
                    {locale === 'es' ? 'Ver carrito' : 'Go to cart'}
                  </button>
                  {cartCount > 0 && (
                    <button
                      type="button"
                      onClick={() => { clearCart(); dismissAdded(); }}
                      style={{ flex: '1 1 100%', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0.4rem 0.5rem', background: 'rgba(186,26,26,0.06)', border: '1px solid rgba(186,26,26,0.32)', color: 'var(--color-error)', borderRadius: '6px', cursor: 'pointer', fontFamily: 'var(--font-label)' }}
                    >
                      {locale === 'es' ? 'Vaciar carrito' : 'Clear Cart'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={dismissAdded}
                    style={{ fontSize: '0.7rem', padding: '0.4rem 0.55rem', background: 'none', border: '1px solid rgba(115,92,0,0.3)', color: GOLD, borderRadius: '6px', cursor: 'pointer' }}
                    aria-label="Dismiss"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Call Now — hidden on mobile; inline-flex at 2xl. Wrapped in span so the
              span controls visibility and .nav-cta's display doesn't override `hidden`. */}
          <span className="hidden 2xl:inline-flex">
            <a href="tel:2394048505" className="nav-cta">{t('callNow')}</a>
          </span>


          <button
            type="button"
            onClick={() => {
              if (menuOpen) { closeAll(); } else { setMenuOpen(true); }
            }}
            className="menu-toggle 2xl:hidden px-2.5 py-1.5 md:px-3 md:py-2 text-[10px] md:text-xs font-bold tracking-widest uppercase"
            data-open={menuOpen ? 'true' : 'false'}
            aria-expanded={menuOpen}
            aria-label={menuOpen ? t('close') : t('menu')}
          >
            {menuOpen ? t('close') : t('menu')}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="mobile-menu-panel 2xl:hidden">
          <div className="flex flex-col px-4 py-3" style={{ fontFamily: 'var(--font-label)' }}>

            <MobileLink href={href('/')} onClick={closeAll} style={{ color: GOLD }}>{t('home')}</MobileLink>
            <MobileAccordion
              label={t('shop')}
              open={shopOpen}
              onToggle={() => setShopOpen(o => !o)}
            >
              {SHOP_ITEMS.map(({ key, path }) => (
                <Link key={key} href={href(path)} onClick={closeAll} className="mobile-sub-link">{t(key)}</Link>
              ))}
            </MobileAccordion>

            {/* Sell To Us — collapsible */}
            <MobileAccordion
              label={t('sellToUs')}
              open={sellOpen}
              onToggle={() => setSellOpen(o => !o)}
            >
              {SELL_ITEMS.map(({ key, path }) => (
                <Link key={key} href={href(path)} onClick={closeAll} className="mobile-sub-link">{t(key)}</Link>
              ))}
            </MobileAccordion>

            {/* Services — collapsible */}
            <MobileAccordion
              label={t('about')}
              open={aboutOpen}
              onToggle={() => setAboutOpen(o => !o)}
            >
              {ABOUT_ITEMS.map(({ key, path }) => (
                <Link key={key} href={href(path)} onClick={closeAll} className="mobile-sub-link">{t(key)}</Link>
              ))}
            </MobileAccordion>

            <MobileLink href={href('/contact')} onClick={closeAll}>{t('contact')}</MobileLink>
            <MobileLink href={href('/account')} onClick={closeAll}>{t('myAccount')}</MobileLink>

            {/* Wishlist — opens drawer */}
            <div className="mobile-row">
              <button
                type="button"
                onClick={() => { closeAll(); openWishlist(); }}
                className="mobile-nav-link text-xs font-bold uppercase tracking-[0.08em]"
                style={{ color: '#1a1c1c' }}
              >
                <span>{locale === 'en' ? 'Saved Items' : 'Lista de deseos'}</span>
                {wishlistCount > 0 && (
                  <span
                    className="text-[0.5rem] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: GOLD, color: '#fff' }}
                  >
                    {wishlistCount}
                  </span>
                )}
              </button>
            </div>

            <MobileLink href={altHref} onClick={closeAll} style={{ color: GOLD }}>
              {locale === 'en' ? 'Español' : 'English'}
            </MobileLink>

          </div>
        </div>
      )}

      <style>{HEADER_STYLES}</style>
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
      className="nav-dropdown absolute z-50 opacity-0 pointer-events-none -translate-y-1 transition-all duration-150 group-hover:opacity-100 group-hover:pointer-events-auto group-hover:translate-y-0 group-focus-within:opacity-100 group-focus-within:pointer-events-auto group-focus-within:translate-y-0"
    >
      {items.map(({ key, path }) => (
        <Link key={key} href={href(path)} className="nav-dropdown-link">
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
    <div className="mobile-row">
      <button
        type="button"
        onClick={onToggle}
        className="mobile-nav-link mobile-accordion-btn"
        data-open={open ? 'true' : 'false'}
        aria-expanded={open}
      >
        <span
          className="text-xs font-bold uppercase tracking-[0.08em]"
          style={{ color: 'inherit' }}
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
      {open && <div className="mobile-sub-list flex flex-col">{children}</div>}
    </div>
  );
}

function MobileLink({
  href,
  onClick,
  children,
  style,
}: {
  href: string;
  onClick: () => void;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div className="mobile-row">
      <Link
        href={href}
        onClick={onClick}
        className="mobile-nav-link text-xs font-bold uppercase tracking-[0.08em]"
        style={{ color: '#1a1c1c', ...style }}
      >
        {children}
      </Link>
    </div>
  );
}
