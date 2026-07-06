import Link from 'next/link';

interface Props {
  locale?: string;
}

export default function SiteFooter({ locale = 'en' }: Props) {
  const isEs = locale === 'es';
  const p = (path: string) => (isEs ? `/es${path}` : path);

  const year = new Date().getFullYear();

  const shopLinks = [
    { label: isEs ? 'Joyería de Oro' : 'Gold Jewelry', href: p('/shop') + '?metal=gold' },
    { label: isEs ? 'Joyería de Plata' : 'Silver Jewelry', href: p('/shop') + '?metal=silver' },
    { label: isEs ? 'Todos los Artículos' : 'All Items', href: p('/shop') },
    { label: isEs ? 'Evaluación Gratuita' : 'Free Evaluation', href: p('/free-evaluation') },
    { label: isEs ? 'Servicios de Oro' : 'Gold Services', href: p('/gold-services') },
  ];

  const companyLinks = [
    { label: isEs ? 'Nosotros' : 'About', href: p('/about') },
    { label: isEs ? 'Contacto' : 'Contact', href: p('/contact') },
    { label: isEs ? 'Mi Cuenta' : 'My Account', href: p('/account') },
  ];

  const legalLinks = [
    { label: isEs ? 'Privacidad' : 'Privacy Policy', href: p('/privacy') },
    { label: isEs ? 'Términos' : 'Terms of Service', href: p('/terms') },
    { label: isEs ? 'Cookies' : 'Cookie Preferences', href: p('/cookie-preferences') },
    { label: isEs ? 'Accesibilidad' : 'Accessibility', href: p('/accessibility') },
    { label: isEs ? 'Contacto' : 'Contact Us', href: p('/contact') },
    { label: isEs ? 'Devoluciones' : 'Returns & Refunds', href: p('/returns-refunds') },
    { label: isEs ? 'Envíos' : 'Shipping Policy', href: p('/shipping') },
    { label: isEs ? 'Términos de subasta' : 'Auction Terms', href: p('/auction-terms') },
  ];

  return (
    <footer
      className="mt-auto border-t"
      style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-low)' }}
    >
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 md:px-8 md:py-16">
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4 md:gap-8">
          <div className="col-span-2 flex flex-col items-center gap-2 text-center md:col-span-1 md:items-start md:gap-3 md:text-left">
            <p
              className="text-[0.68rem] font-bold uppercase tracking-[0.18em] md:text-sm md:tracking-widest"
              style={{ fontFamily: 'var(--font-label)', color: 'var(--color-primary)' }}
            >
              Naples Estate Jewelry
            </p>
            <p className="max-w-[20rem] text-xs leading-snug md:text-sm md:leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>
              {isEs
                ? 'Compramos y vendemos joyería de patrimonio fina en Naples, Florida. Evaluaciones gratuitas.'
                : 'Buying and selling fine estate jewelry in Naples, Florida. Free, on-the-spot appraisals — we come to you.'}
            </p>
            <a
              href="tel:2394048505"
              className="inline-flex min-h-8 items-center justify-center border px-3 text-xs font-bold md:mt-1 md:min-h-0 md:border-0 md:px-0 md:text-sm"
              style={{
                borderColor: 'var(--color-outline-variant)',
                color: 'var(--color-primary)',
                fontFamily: 'var(--font-label)',
              }}
            >
              (239) 404-8505
            </a>
            <a
              href="mailto:info@naplesestatejewelry.co"
              className="text-xs md:text-sm md:mt-1"
              style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}
            >
              info@naplesestatejewelry.co
            </a>
          </div>

          <nav className="hidden md:flex md:flex-col md:gap-3" aria-label={isEs ? 'Enlaces de tienda' : 'Shop links'}>
            <p
              className="text-[0.65rem] font-bold uppercase tracking-[0.3em]"
              style={{ fontFamily: 'var(--font-label)', color: 'var(--color-on-surface-variant)' }}
            >
              {isEs ? 'Tienda' : 'Shop'}
            </p>
            {shopLinks.map(({ label, href }) => (
              <Link
                key={href}
                href={href}
                className="w-fit py-0.5 text-xs leading-tight transition-colors hover:underline md:py-0 md:text-sm md:underline-offset-2"
                style={{ color: 'var(--color-on-surface-variant)' }}
              >
                {label}
              </Link>
            ))}
          </nav>

          <nav className="col-span-2 grid grid-cols-3 items-start gap-x-3 gap-y-1 text-center md:col-span-1 md:flex md:flex-col md:items-start md:gap-3 md:text-left" aria-label={isEs ? 'Enlaces de empresa' : 'Company links'}>
            <p
              className="col-span-3 text-[0.56rem] font-bold uppercase tracking-[0.2em] md:col-span-1 md:text-[0.65rem] md:tracking-[0.3em]"
              style={{ fontFamily: 'var(--font-label)', color: 'var(--color-on-surface-variant)' }}
            >
              {isEs ? 'Empresa' : 'Company'}
            </p>
            {companyLinks.map(({ label, href }) => (
              <Link
                key={href}
                href={href}
                className="justify-self-center py-0.5 text-[0.68rem] leading-tight transition-colors hover:underline md:w-fit md:justify-self-auto md:py-0 md:text-sm md:underline-offset-2"
                style={{ color: 'var(--color-on-surface-variant)' }}
              >
                {label}
              </Link>
            ))}
          </nav>

          <nav className="col-span-2 grid grid-cols-2 gap-x-4 gap-y-1 md:col-span-1 md:flex md:flex-col md:gap-3" aria-label={isEs ? 'Enlaces legales' : 'Legal links'}>
            <p
              className="col-span-2 text-center text-[0.56rem] font-bold uppercase tracking-[0.2em] md:col-span-1 md:text-left md:text-[0.65rem] md:tracking-[0.3em]"
              style={{ fontFamily: 'var(--font-label)', color: 'var(--color-on-surface-variant)' }}
            >
              {isEs ? 'Legal' : 'Legal'}
            </p>
            {legalLinks.map(({ label, href }) => (
              <Link
                key={href}
                href={href}
                className="justify-self-center py-0.5 text-center text-[0.68rem] leading-tight transition-colors hover:underline md:w-fit md:justify-self-auto md:py-0 md:text-left md:text-sm md:underline-offset-2"
                style={{ color: 'var(--color-on-surface-variant)' }}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>

        <div
          className="mt-4 flex flex-col items-center justify-between gap-1 border-t pt-3 text-center md:mt-10 md:flex-row md:items-center md:gap-3 md:pt-6 md:text-left"
          style={{ borderColor: 'var(--color-outline-variant)' }}
        >
          <p
            className="max-w-[22rem] text-[0.6rem] leading-snug md:max-w-none md:text-xs md:leading-relaxed"
            style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}
          >
            © {year} Naples Estate Jewelry · Naples, FL · {isEs ? 'Todos los derechos reservados' : 'All rights reserved'}
          </p>
          <p
            className="text-[0.6rem] leading-snug md:text-xs md:leading-relaxed"
            style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}
          >
            naplesestatejewelry.co
          </p>
        </div>
      </div>
    </footer>
  );
}
