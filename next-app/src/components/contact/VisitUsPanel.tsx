import {
  BUSINESS_NAME,
  cityLine,
  mapsUrl,
  streetLine,
  wayfindingSentence,
} from '@/lib/business-location';
import ShowroomMap from '@/components/ShowroomMap';
import ShowroomHours from '@/components/ShowroomHours';
import CopyAddressButton from '@/components/CopyAddressButton';

interface Props {
  locale?: string;
}

/**
 * The showroom's address and hours, for the contact page.
 *
 * Server component on purpose — it is static text and must not cost the
 * contact page a client bundle. All strings come from `lib/business-location`.
 *
 * ⚠️ The shared-suite line is load-bearing. The sign out front reads
 * "Sharon Lynch Collections", so a visitor hunting for our name drives past.
 * `wayfindingSentence()` names the other business as a landmark and then tells
 * them the suite. Do not trim it to just the street address.
 */
export default function VisitUsPanel({ locale = 'en' }: Props) {
  const isEs = locale === 'es';

  return (
    <section
      className="border-t"
      style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-low)' }}
      aria-labelledby="visit-us-heading"
    >
      <div className="mx-auto max-w-3xl px-4 py-14 text-center sm:px-6 md:px-8 md:py-20">
        <span
          className="text-xs font-bold uppercase tracking-[0.4em]"
          style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}
        >
          {isEs ? 'Visítenos' : 'Visit Us'}
        </span>

        <h2
          id="visit-us-heading"
          className="responsive-title-md font-bold mt-4 mb-6 tracking-tight"
          style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}
        >
          {isEs ? 'Nuestro salón en Naples' : 'Our Naples Showroom'}
        </h2>

        <div className="flex items-start justify-center gap-2">
          <address
            className="not-italic responsive-copy"
            style={{ color: 'var(--color-on-surface)' }}
          >
            <span className="block font-bold" style={{ fontFamily: 'var(--font-label)' }}>
              {BUSINESS_NAME}
            </span>
            <span className="block mt-1">{streetLine()}</span>
            <span className="block">{cityLine()}</span>
          </address>
          {/* Outside the <address>, not inside: the element is the address
              itself, and a control is not part of one. */}
          <CopyAddressButton locale={locale} className="mt-0.5" />
        </div>

        <p className="responsive-copy mt-4 max-w-xl mx-auto" style={{ color: 'var(--color-on-surface-variant)' }}>
          {wayfindingSentence(isEs)}
        </p>

        <div
          className="mt-8 inline-flex flex-col gap-3 border-t border-b py-4"
          style={{ borderColor: 'var(--color-outline-variant)' }}
        >
          <span
            className="text-[0.6875rem] font-bold uppercase tracking-[0.3em]"
            style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}
          >
            {isEs ? 'Horario' : 'Hours'}
          </span>
          <ShowroomHours locale={locale} className="responsive-copy" />
        </div>

        {/* Larger square here than on the homepage: this is the page someone
            opens to answer "where are you", so the surrounding streets are the
            point. It sits directly above "Get directions" so the picture and
            the action read as one unit. */}
        <ShowroomMap locale={locale} maxWidth="32rem" className="mt-10" />

        <div className="responsive-actions justify-center mt-8">
          <a href={mapsUrl()} target="_blank" rel="noopener noreferrer" className="gold-button">
            {isEs ? 'Cómo llegar' : 'Get directions'}
          </a>
          <a href="tel:2394048505" className="outline-button">
            {isEs ? 'Llamar (239) 404-8505' : 'Call (239) 404-8505'}
          </a>
        </div>

        <p className="responsive-copy mt-8 max-w-xl mx-auto" style={{ color: 'var(--color-on-surface-variant)' }}>
          {isEs
            ? 'Para patrimonios grandes o si prefiere no transportar objetos de valor, seguimos ofreciendo visitas privadas a domicilio a pedido.'
            : 'For larger estates, or if you would rather not transport valuables, we still make private home visits on request.'}
        </p>
      </div>
    </section>
  );
}
