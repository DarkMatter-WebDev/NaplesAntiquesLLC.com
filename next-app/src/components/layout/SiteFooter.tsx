import Link from 'next/link';

interface Props {
  locale?: string;
}

export default function SiteFooter({ locale = 'en' }: Props) {
  const isEs = locale === 'es';
  const p = (path: string) => (isEs ? `/es${path}` : path);

  const year = new Date().getFullYear();

  return (
    <footer
      className="border-t mt-auto"
      style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-low)' }}
    >
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-8">

          {/* Brand */}
          <div className="flex flex-col gap-3">
            <p
              className="text-sm font-bold uppercase tracking-widest"
              style={{ fontFamily: 'var(--font-label)', color: 'var(--color-primary)' }}
            >
              Naples Estate Jewelry Co
            </p>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>
              {isEs
                ? 'Compramos y vendemos joyería de patrimonio fina en Naples, Florida. Evaluaciones gratuitas.'
                : 'Buying and selling fine estate jewelry in Naples, Florida. Free walk-in appraisals.'}
            </p>
            <a
              href="tel:2394048505"
              className="text-sm font-bold mt-1"
              style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}
            >
              (239) 404-8505
            </a>
          </div>

          {/* Shop links */}
          <div className="flex flex-col gap-3">
            <p
              className="text-[0.65rem] font-bold uppercase tracking-[0.3em]"
              style={{ fontFamily: 'var(--font-label)', color: 'var(--color-on-surface-variant)' }}
            >
              {isEs ? 'Tienda' : 'Shop'}
            </p>
            {[
              { label: isEs ? 'Joyería de Oro' : 'Gold Jewelry', href: p('/shop') + '?metal=gold' },
              { label: isEs ? 'Joyería de Plata' : 'Silver Jewelry', href: p('/shop') + '?metal=silver' },
              { label: isEs ? 'Todos los Artículos' : 'All Items', href: p('/shop') },
              { label: isEs ? 'Evaluación Gratuita' : 'Free Evaluation', href: p('/free-evaluation') },
              { label: isEs ? 'Servicios de Oro' : 'Gold Services', href: p('/gold-services') },
            ].map(({ label, href }) => (
              <Link
                key={href}
                href={href}
                className="text-sm hover:underline underline-offset-2 transition-colors w-fit"
                style={{ color: 'var(--color-on-surface-variant)' }}
              >
                {label}
              </Link>
            ))}
          </div>

          {/* Company links */}
          <div className="flex flex-col gap-3">
            <p
              className="text-[0.65rem] font-bold uppercase tracking-[0.3em]"
              style={{ fontFamily: 'var(--font-label)', color: 'var(--color-on-surface-variant)' }}
            >
              {isEs ? 'Empresa' : 'Company'}
            </p>
            {[
              { label: isEs ? 'Nosotros' : 'About', href: p('/about') },
              { label: isEs ? 'Contacto' : 'Contact', href: p('/contact') },
              { label: isEs ? 'Mi Cuenta' : 'My Account', href: p('/account') },
              { label: isEs ? 'Privacidad' : 'Privacy Policy', href: p('/privacy') },
            ].map(({ label, href }) => (
              <Link
                key={href}
                href={href}
                className="text-sm hover:underline underline-offset-2 transition-colors w-fit"
                style={{ color: 'var(--color-on-surface-variant)' }}
              >
                {label}
              </Link>
            ))}
          </div>

        </div>

        {/* Bottom bar */}
        <div
          className="mt-10 pt-6 border-t flex flex-col md:flex-row items-start md:items-center justify-between gap-3"
          style={{ borderColor: 'var(--color-outline-variant)' }}
        >
          <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}>
            © {year} Naples Estate Jewelry Co · Naples, FL · {isEs ? 'Todos los derechos reservados' : 'All rights reserved'}
          </p>
          <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}>
            naplesestatejewelry.co
          </p>
        </div>
      </div>
    </footer>
  );
}
