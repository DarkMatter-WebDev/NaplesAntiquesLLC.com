import Link from 'next/link';
import { SERVICE_AREAS } from '@/lib/service-areas';
import { mapsUrl } from '@/lib/business-location';
import ShowroomAddress from '@/components/ShowroomAddress';
import ShowroomHours from '@/components/ShowroomHours';
import CopyAddressButton from '@/components/CopyAddressButton';

interface Props {
  locale?: string;
}

export default function SiteFooter({ locale = 'en' }: Props) {
  const isEs = locale === 'es';
  const p = (path: string) => (isEs ? `/es${path}` : path);

  const year = new Date().getFullYear();

  const shopLinks = [
    { label: isEs ? 'Vender Oro' : 'Sell Gold', href: p('/gold-services') },
    { label: isEs ? 'Vender Plata' : 'Sell Sterling Silver', href: p('/silver-services') },
    { label: isEs ? 'Vender Joyería' : 'Sell Estate Jewelry', href: p('/estate-jewelry') },
    { label: isEs ? 'Programa de Intercambio' : 'Trade-In Program', href: p('/trade-in') },
    { label: isEs ? 'Evaluación Gratuita' : 'Free Evaluation', href: p('/free-evaluation') },
    { label: isEs ? 'Tienda' : 'Shop', href: p('/shop') },
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
  ];

  return (
    <footer
      className="mt-auto border-t"
      style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-low)' }}
    >
      <div className="ultrawide-page-wide mx-auto max-w-7xl px-4 py-4 sm:px-6 md:px-8 md:py-16">
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
                ? 'Compramos y vendemos joyería de patrimonio fina en nuestro salón de Naples, Florida. Evaluaciones gratuitas.'
                : 'Buying and selling fine estate jewelry at our Naples, Florida showroom. Free, on-the-spot appraisals.'}
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
              href="mailto:info@naplesestatejewelry.com"
              className="text-xs md:text-sm md:mt-1"
              style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}
            >
              info@naplesestatejewelry.com
            </a>
          </div>

          <nav className="hidden md:flex md:flex-col md:gap-3" aria-label={isEs ? 'Vender con nosotros' : 'Sell to us'}>
            <p
              className="text-[0.65rem] font-bold uppercase tracking-[0.3em]"
              style={{ fontFamily: 'var(--font-label)', color: 'var(--color-on-surface-variant)' }}
            >
              {isEs ? 'Vender' : 'Sell to Us'}
            </p>
            {shopLinks.map(({ label, href }) => (
              <Link
                key={href}
                href={href}
                // ⚠️ Footer links do NOT prefetch. Measured on production
                // 2026-08-14: the footer's four mapped groups (shop, company,
                // legal, and one per SERVICE_AREA city) fired 58 route
                // prefetches totalling 111KB — several routes repeatedly — while
                // the visitor was still waiting for the first pixel. Footer
                // links are the lowest-intent on the page; paying for them
                // during the most bandwidth-constrained moment of the visit is
                // backwards. Header nav still prefetches: that IS the likely
                // next click.
                prefetch={false}
                className="hover-underline-grow w-fit py-0.5 text-xs leading-tight md:py-0 md:text-sm"
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
            {/* `py-1.5` on mobile (here, Legal, and Areas We Serve) is a WCAG
                2.5.8 tap-target floor, not spacing taste: at text-[0.68rem]
                these links measured ~18px tall and axe flagged them under
                target-size (24px minimum). 12px of padding clears it; md:py-0
                restores the tighter desktop rhythm where pointers are precise. */}
            {companyLinks.map(({ label, href }) => (
              <Link
                key={href}
                href={href}
                prefetch={false}
                className="hover-underline-grow justify-self-center py-1.5 text-[0.68rem] leading-tight md:w-fit md:justify-self-auto md:py-0 md:text-sm"
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
                prefetch={false}
                className="hover-underline-grow justify-self-center py-1.5 text-center text-[0.68rem] leading-tight md:w-fit md:justify-self-auto md:py-0 md:text-left md:text-sm"
                style={{ color: 'var(--color-on-surface-variant)' }}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Sitewide NAP. The footer is on every page, so this is the strongest
            name/address/phone signal the site emits — it must stay
            byte-identical to the Google Business Profile. Rendered as
            <address> so the markup says what it is.

            ⚠️ It lives HERE, centred under the four link columns, rather than
            inside the brand column where it shipped on 2026-08-17. Once the
            hours became a seven-row list, the brand column ran roughly twice
            the height of the other three and the footer read as one long column
            with three stubs beside it. Centring it under the whole row turns
            that dead space into the block's base. Do not move it back into a
            column without shortening the hours first.

            The rule and spacing deliberately match the "Areas We Serve" band
            below, so the footer keeps one rhythm rather than gaining a band
            that looks bolted on.

            Address ABOVE hours, never beside them (owner, 2026-08-18). Side by
            side, the two halves read as two unrelated columns and the centre
            line of the footer falls in the empty gap between them; stacked,
            they read as one address block with its opening times under it. */}
        <address
          className="not-italic mt-4 flex flex-col items-center gap-5 border-t pt-4 text-center text-xs leading-snug md:mt-10 md:pt-6 md:text-sm md:leading-relaxed"
          style={{ borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface-variant)' }}
        >
          <div>
            <p
              className="mb-1.5 text-[0.6rem] font-bold uppercase tracking-[0.3em]"
              style={{ fontFamily: 'var(--font-label)' }}
            >
              {isEs ? 'Visítenos' : 'Visit Us'}
            </p>
            {/* ⚠️ Sibling of the maps link, never inside it — a <button> in an
                <a> is invalid HTML and browsers break one of the two.

                It IS inside the <address> element here, unlike the contact
                page. That is deliberate rather than sloppy: this <address>
                wraps the whole band including the hours, so there is no
                "outside" without splitting the element, and `<address>` accepts
                flow content, so a button in it is valid. */}
            <div className="flex items-start justify-center gap-2">
              <a
                href={mapsUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="hover-underline-grow"
                style={{ color: 'inherit' }}
              >
                <ShowroomAddress locale={locale} />
              </a>
              <CopyAddressButton locale={locale} />
            </div>
          </div>

          <div>
            <p
              className="mb-1.5 text-[0.6rem] font-bold uppercase tracking-[0.3em]"
              style={{ fontFamily: 'var(--font-label)' }}
            >
              {isEs ? 'Horario' : 'Hours'}
            </p>
            <ShowroomHours locale={locale} />
          </div>
        </address>

        <nav
          className="mt-4 border-t pt-4 md:mt-10 md:pt-6"
          style={{ borderColor: 'var(--color-outline-variant)' }}
          aria-label={isEs ? 'Áreas que servimos' : 'Areas we serve'}
        >
          <p
            className="mb-2 text-center text-[0.6rem] font-bold uppercase tracking-[0.3em] md:text-left"
            style={{ fontFamily: 'var(--font-label)', color: 'var(--color-on-surface-variant)' }}
          >
            {isEs ? 'Áreas que Servimos' : 'Areas We Serve'}
          </p>
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 md:justify-start">
            {SERVICE_AREAS.map((a) => (
              <Link
                key={a.slug}
                href={p(`/sell/${a.slug}`)}
                // One city page per service area — the largest single group of
                // prefetches on the page, and the least likely to be clicked.
                prefetch={false}
                className="hover-underline-grow py-1.5 text-[0.68rem] leading-tight md:py-0 md:text-xs"
                style={{ color: 'var(--color-on-surface-variant)' }}
              >
                {isEs ? `Vender en ${a.city}` : `Sell in ${a.city}`}
              </Link>
            ))}
          </div>
        </nav>

        <div
          className="mt-4 flex flex-col items-center justify-between gap-1 border-t pt-3 text-center md:mt-6 md:flex-row md:items-center md:gap-3 md:pt-6 md:text-left"
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
            naplesestatejewelry.com
          </p>
        </div>
      </div>
      <div
        className="border-t px-4 py-2 text-center"
        style={{ borderColor: 'var(--color-outline-variant)' }}
      >
        <a
          href="https://surettesystems.com"
          target="_blank"
          rel="noopener"
          className="hover-underline-grow text-[0.6rem] leading-snug md:text-xs"
          style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}
        >
          {isEs ? 'Sitio web creado por SuretteSystems.com' : 'Website built by SuretteSystems.com'}
        </a>
      </div>
    </footer>
  );
}
