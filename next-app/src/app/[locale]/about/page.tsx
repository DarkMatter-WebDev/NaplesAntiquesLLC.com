import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import SiteHeader from '@/components/layout/SiteHeader';
import SiteFooter from '@/components/layout/SiteFooter';

export const metadata: Metadata = {
  title: 'About Chris | Naples Estate Jewelry',
  description:
    'Meet Chris, Naples estate jewelry and antiques specialist with 15+ years experience serving Southwest Florida. Private, mobile, appointment-only service.',
};

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function AboutPage({ params }: Props) {
  const { locale } = await params;
  const isEs = locale === 'es';

  return (
    <>
      <SiteHeader />
      <main className="pt-16">

        {/* Hero */}
        <section className="relative overflow-hidden pt-12 pb-16 md:pt-16 md:pb-24 border-b border-white/5">
          <div className="absolute inset-0 z-0">
            <Image
              src="/assets/images/pages/trust.webp"
              alt=""
              fill
              sizes="100vw"
              priority
              className="object-cover"
              style={{ objectPosition: 'center 76%' }}
            />
            <div className="absolute inset-0 bg-black/50" />
          </div>
          <div className="container mx-auto px-6 md:px-8 max-w-4xl text-center relative z-10">
            <span
              className="text-xs font-bold uppercase tracking-[0.4em]"
              style={{ color: '#f2ca50', fontFamily: 'var(--font-label)' }}
            >
              {isEs ? 'Nosotros' : 'About'}
            </span>
            <h1
              className="text-4xl md:text-5xl text-white font-bold mt-4 mb-6 tracking-tight"
              style={{ fontFamily: 'var(--font-headline)' }}
            >
              {isEs
                ? 'Una Herencia de Confianza en el Suroeste de Florida'
                : 'A Heritage of Trust in Southwest Florida'}
            </h1>
            <p className="text-xl italic max-w-2xl mx-auto leading-relaxed" style={{ color: '#d8d1c2' }}>
              {isEs
                ? 'Nacido y criado en Naples, Chris ha pasado mas de 15 anos trabajando en privado con familias locales para adquirir joyeria fina, plata esterlina, antiguedades, oro y colecciones heredadas.'
                : 'Born and raised in Naples, Chris has spent 15+ years working privately with local families to acquire fine jewelry, sterling silver, antiques, gold, and inherited collections.'}
            </p>
          </div>
        </section>

        {/* Meet Chris */}
        <section
          className="py-20 md:py-28"
          style={{ background: 'var(--color-surface-container-low)' }}
        >
          <div className="container mx-auto px-6 md:px-8 max-w-6xl">
            <div className="flex flex-col md:flex-row gap-16 items-center">
              <div className="w-full md:w-1/2">
                <div className="relative">
                  <div
                    className="absolute -top-10 -left-10 w-32 h-32 rounded-full blur-3xl"
                    style={{ background: 'var(--color-primary)', opacity: 0.1 }}
                  />
                  <Image
                    src="/assets/images/pages/chris.webp"
                    alt={isEs ? 'Chris de Naples Estate Jewelry' : 'Chris of Naples Estate Jewelry'}
                    width={520}
                    height={600}
                    className="relative z-10 mx-auto w-full max-w-[520px] rounded-2xl object-cover shadow-2xl md:scale-105 md:-rotate-2"
                  />
                </div>
              </div>

              <div className="w-full md:w-1/2">
                <h2
                  className="text-3xl md:text-4xl font-bold mb-8 tracking-tight"
                  style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}
                >
                  {isEs ? 'Conozca a Chris' : 'Meet Chris'}
                </h2>
                <div
                  className="space-y-5 leading-relaxed text-lg"
                  style={{ color: 'var(--color-on-surface-variant)' }}
                >
                  <p>
                    {isEs ? (
                      <>Nacido y criado en Naples, Chris ha pasado <strong style={{ color: 'var(--color-primary)' }}>mas de 15 anos</strong> trabajando directamente con clientes privados en todo el suroeste de Florida para adquirir joyeria fina, plata esterlina, antiguedades, oro y colecciones heredadas.</>
                    ) : (
                      <>Born and raised in Naples, Chris has spent <strong style={{ color: 'var(--color-primary)' }}>15+ years</strong> working directly with private clients throughout Southwest Florida to acquire fine jewelry, sterling silver, antiques, gold, and inherited collections.</>
                    )}
                  </p>
                  <p>
                    {isEs
                      ? 'Al operar como un servicio movil privado, solo por cita, mantenemos los gastos generales bajos y trasladamos esos ahorros como algunos de los pagos mas competitivos de la region. Cada consulta se maneja de forma personal y confidencial - sin presion de tienda fisica, sin intermediarios y sin obligacion.'
                      : 'By operating as a private, appointment-only mobile service, we keep overhead low and pass those savings on as some of the most competitive payouts in the region. Every consultation is handled personally and confidentially - no storefront pressure, no middlemen, and no obligation.'}
                  </p>
                  <p>
                    {isEs
                      ? 'Ya sea que este pensando en vender una sola reliquia familiar o liquidar un patrimonio multigeneracional, Chris aporta un enfoque discreto e informado a cada conversacion.'
                      : 'Whether you\'re considering selling a single heirloom or liquidating a multi-generational estate, Chris brings a discreet, informed approach to every conversation.'}
                  </p>
                </div>

                <div className="mt-10 grid grid-cols-2 gap-6">
                  {[
                    { stat: '15+', label: isEs ? 'Anos de Experiencia' : 'Years Experience' },
                    { stat: '100%', label: isEs ? 'Privado y Confidencial' : 'Private & Confidential' },
                    { stat: isEs ? 'Mismo Dia' : 'Same-Day', label: isEs ? 'Pago Disponible' : 'Payment Available' },
                    { stat: isEs ? 'Movil' : 'Mobile', label: isEs ? 'Vamos a Usted' : 'We Come to You' },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="border-l-2 pl-4"
                      style={{ borderColor: 'color-mix(in srgb, var(--color-primary) 40%, transparent)' }}
                    >
                      <div
                        className="text-3xl font-bold"
                        style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-primary)' }}
                      >
                        {item.stat}
                      </div>
                      <div
                        className="text-sm uppercase tracking-wider mt-1"
                        style={{ color: 'var(--color-on-surface-variant)' }}
                      >
                        {item.label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>


        {/* CTA */}
        <section
          className="py-20 md:py-28"
          style={{ background: 'var(--color-surface-container-low)' }}
        >
          <div className="container mx-auto px-6 md:px-8 max-w-4xl text-center">
            <h2
              className="text-4xl md:text-5xl font-bold mb-6 tracking-tight"
              style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}
            >
              {isEs ? 'Listo para Comenzar una Conversacion?' : 'Ready to Start a Conversation?'}
            </h2>
            <p className="text-lg mb-10 max-w-2xl mx-auto" style={{ color: 'var(--color-on-surface-variant)' }}>
              {isEs
                ? 'Llame o envie un mensaje de texto a Chris directamente, o programe una consulta privada en un momento que le convenga.'
                : 'Call or text Chris directly, or schedule a private consultation at a time that works for you.'}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center flex-wrap">
              <a href="tel:2394048505" className="gold-button">
                (239) 404-8505
              </a>
              <Link
                href={isEs ? '/es/contact' : '/contact'}
                className="outline-button"
              >
                {isEs ? 'Contactenos' : 'Contact Us'}
              </Link>
            </div>
            <div className="mt-8">
              <a
                href="https://share.google/yQQMAvFDiOLppBZ30"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 border-b pb-1 text-sm font-bold uppercase tracking-widest transition-colors"
                style={{ color: 'var(--color-primary)', borderColor: 'color-mix(in srgb, var(--color-primary) 30%, transparent)', fontFamily: 'var(--font-label)' }}
              >
                <span>{isEs ? 'Lea lo que dicen los clientes en Google' : 'Read what clients say on Google'}</span>
                <span aria-hidden="true">-&gt;</span>
              </a>
            </div>
          </div>
        </section>

      </main>
      <SiteFooter locale={locale} />
    </>
  );
}
