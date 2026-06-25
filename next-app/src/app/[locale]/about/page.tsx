import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import SiteHeader from '@/components/layout/SiteHeader';
import SiteFooter from '@/components/layout/SiteFooter';
import { PageContainer, Section } from '@/components/layout/ResponsiveLayout';

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
          <PageContainer max="narrow" className="text-center relative z-10">
            <span
              className="text-xs font-bold uppercase tracking-[0.4em]"
              style={{ color: '#f2ca50', fontFamily: 'var(--font-label)' }}
            >
              {isEs ? 'Nosotros' : 'About'}
            </span>
            <h1
              className="responsive-title-lg text-white font-bold mt-4 mb-6 tracking-tight"
              style={{ fontFamily: 'var(--font-headline)' }}
            >
              {isEs
                ? 'Una Herencia de Confianza en el Suroeste de Florida'
                : 'A Heritage of Trust in Southwest Florida'}
            </h1>
            <p className="responsive-copy italic max-w-2xl mx-auto" style={{ color: '#d8d1c2' }}>
              {isEs
                ? 'Nacido y criado en Naples, Chris ha pasado más de 15 años trabajando en privado con familias locales para adquirir joyería fina, plata esterlina, antigüedades, oro y colecciones heredadas.'
                : 'Born and raised in Naples, Chris has spent 15+ years working privately with local families to acquire fine jewelry, sterling silver, antiques, gold, and inherited collections.'}
            </p>
          </PageContainer>
        </section>

        {/* Meet Chris */}
        <Section
          style={{ background: 'var(--color-surface-container-low)' }}
        >
          <PageContainer max="content">
            <div className="grid gap-[clamp(2rem,5vw,4rem)] md:grid-cols-2 md:items-center">
              <div className="w-full">
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

              <div className="w-full">
                <h2
                  className="responsive-title-md font-bold mb-8 tracking-tight"
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
                      <>Nacido y criado en Naples, Chris ha pasado <strong style={{ color: 'var(--color-primary)' }}>más de 15 años</strong> trabajando directamente con clientes privados en todo el suroeste de Florida para adquirir joyería fina, plata esterlina, antigüedades, oro y colecciones heredadas.</>
                    ) : (
                      <>Born and raised in Naples, Chris has spent <strong style={{ color: 'var(--color-primary)' }}>15+ years</strong> working directly with private clients throughout Southwest Florida to acquire fine jewelry, sterling silver, antiques, gold, and inherited collections.</>
                    )}
                  </p>
                  <p>
                    {isEs
                      ? 'Al operar como un servicio móvil privado, solo por cita, mantenemos los gastos generales bajos y trasladamos esos ahorros como algunos de los pagos más competitivos de la región. Cada consulta se maneja de forma personal y confidencial - sin presión de tienda física, sin intermediarios y sin obligación.'
                      : 'By operating as a private, appointment-only mobile service, we keep overhead low and pass those savings on as some of the most competitive payouts in the region. Every consultation is handled personally and confidentially - no storefront pressure, no middlemen, and no obligation.'}
                  </p>
                  <p>
                    {isEs
                      ? 'Ya sea que esté pensando en vender una sola reliquia familiar o liquidar un patrimonio multigeneracional, Chris aporta un enfoque discreto e informado a cada conversación.'
                      : 'Whether you\'re considering selling a single heirloom or liquidating a multi-generational estate, Chris brings a discreet, informed approach to every conversation.'}
                  </p>
                </div>

                <div className="mt-10 grid grid-cols-1 gap-5 min-[390px]:grid-cols-2 md:gap-6">
                  {[
                    { stat: '15+', label: isEs ? 'Años de Experiencia' : 'Years Experience' },
                    { stat: '100%', label: isEs ? 'Privado y Confidencial' : 'Private & Confidential' },
                    { stat: isEs ? 'Mismo Día' : 'Same-Day', label: isEs ? 'Pago Disponible' : 'Payment Available' },
                    { stat: isEs ? 'Móvil' : 'Mobile', label: isEs ? 'Vamos a Usted' : 'We Come to You' },
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
          </PageContainer>
        </Section>


        {/* CTA */}
        <Section
          style={{ background: 'var(--color-surface-container-low)' }}
        >
          <PageContainer max="narrow" className="text-center">
            <h2
              className="responsive-title-lg font-bold mb-6 tracking-tight"
              style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}
            >
              {isEs ? '¿Listo para Comenzar una Conversación?' : 'Ready to Start a Conversation?'}
            </h2>
            <p className="text-lg mb-10 max-w-2xl mx-auto" style={{ color: 'var(--color-on-surface-variant)' }}>
              {isEs
                ? 'Llame o envíe un mensaje de texto a Chris directamente, o programe una consulta privada en un momento que le convenga.'
                : 'Call or text Chris directly, or schedule a private consultation at a time that works for you.'}
            </p>
            <div className="responsive-actions justify-center">
              <a href="tel:2394048505" className="gold-button">
                (239) 404-8505
              </a>
              <Link
                href={isEs ? '/es/contact' : '/contact'}
                className="outline-button"
              >
                {isEs ? 'Contáctenos' : 'Contact Us'}
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
          </PageContainer>
        </Section>

      </main>
      <SiteFooter locale={locale} />
    </>
  );
}
