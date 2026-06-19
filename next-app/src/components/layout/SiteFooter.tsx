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
    { label: isEs ? 'Privacidad' : 'Privacy Policy', href: p('/privacy') },
  ];

  return (
    <footer
      className="mt-auto border-t"
      style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-low)' }}
    >
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-6 md:px-8 md:py-16">
        <div className="grid grid-cols-2 gap-x-8 gap-y-8 md:grid-cols-3 md:gap-8">
          <div className="col-span-2 flex flex-col items-center gap-3 text-center md:col-span-1 md:items-start md:text-left">
            <p
              className="text-xs font-bold uppercase tracking-[0.22em] md:text-sm md:tracking-widest"
              style={{ fontFamily: 'var(--font-label)', color: 'var(--color-primary)' }}
            >
              Naples Estate Jewelry Co
            </p>
            <p className="max-w-[20rem] text-sm leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>
              {isEs
                ? 'Compramos y vendemos joyería de patrimonio fina en Naples, Florida. Evaluaciones gratuitas.'
                : 'Buying and selling fine estate jewelry in Naples, Florida. Free walk-in appraisals.'}
            </p>
            <a
              href="tel:2394048505"
              className="mt-1 inline-flex min-h-10 items-center justify-center border px-4 text-sm font-bold md:min-h-0 md:border-0 md:px-0"
              style={{
                borderColor: 'var(--color-outline-variant)',
                color: 'var(--color-primary)',
                fontFamily: 'var(--font-label)',
              }}
            >
              (239) 404-8505
            </a>
          </div>

          <nav className="flex flex-col gap-2.5 md:gap-3" aria-label={isEs ? 'Enlaces de tienda' : 'Shop links'}>
            <p
              className="text-[0.62rem] font-bold uppercase tracking-[0.24em] md:text-[0.65rem] md:tracking-[0.3em]"
              style={{ fontFamily: 'var(--font-label)', color: 'var(--color-on-surface-variant)' }}
            >
              {isEs ? 'Tienda' : 'Shop'}
            </p>
            {shopLinks.map(({ label, href }) => (
              <Link
                key={href}
                href={href}
                className="w-fit py-1 text-sm leading-tight transition-colors hover:underline md:py-0 md:underline-offset-2"
                style={{ color: 'var(--color-on-surface-variant)' }}
              >
                {label}
              </Link>
            ))}
          </nav>

          <nav className="flex flex-col gap-2.5 md:gap-3" aria-label={isEs ? 'Enlaces de empresa' : 'Company links'}>
            <p
              className="text-[0.62rem] font-bold uppercase tracking-[0.24em] md:text-[0.65rem] md:tracking-[0.3em]"
              style={{ fontFamily: 'var(--font-label)', color: 'var(--color-on-surface-variant)' }}
            >
              {isEs ? 'Empresa' : 'Company'}
            </p>
            {companyLinks.map(({ label, href }) => (
              <Link
                key={href}
                href={href}
                className="w-fit py-1 text-sm leading-tight transition-colors hover:underline md:py-0 md:underline-offset-2"
                style={{ color: 'var(--color-on-surface-variant)' }}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>

        <div
          className="mt-8 flex flex-col items-center justify-between gap-2 border-t pt-5 text-center md:mt-10 md:flex-row md:items-center md:gap-3 md:pt-6 md:text-left"
          style={{ borderColor: 'var(--color-outline-variant)' }}
        >
          <p
            className="max-w-[22rem] text-[0.68rem] leading-relaxed md:max-w-none md:text-xs"
            style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}
          >
            © {year} Naples Estate Jewelry Co · Naples, FL · {isEs ? 'Todos los derechos reservados' : 'All rights reserved'}
          </p>
          <p
            className="text-[0.68rem] leading-relaxed md:text-xs"
            style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}
          >
            naplesestatejewelry.co
          </p>
        </div>
      </div>
    </footer>
  );
}
