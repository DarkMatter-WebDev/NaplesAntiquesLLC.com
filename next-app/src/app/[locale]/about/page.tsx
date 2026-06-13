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
                ? 'Nacido y criado en Naples, Chris ha pasado más de 15 años trabajando en privado con familias locales para adquirir joyería fina, plata esterlina, antigüedades, oro y colecciones heredadas.'
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
                    className="relative z-10 w-full max-w-[520px] mx-auto rounded-sm shadow-2xl object-cover md:scale-105 md:-rotate-2"
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
                      <>Nacido y criado en Naples, Chris ha pasado <strong style={{ color: 'var(--color-primary)' }}>más de 15 años</strong> trabajando directamente con clientes privados en todo el suroeste de Florida para adquirir joyería fina, plata esterlina, antigüedades, oro y colecciones heredadas.</>
                    ) : (
                      <>Born and raised in Naples, Chris has spent <strong style={{ color: 'var(--color-primary)' }}>15+ years</strong> working directly with private clients throughout Southwest Florida to acquire fine jewelry, sterling silver, antiques, gold, and inherited collections.</>
                    )}
                  </p>
                  <p>
                    {isEs
                      ? 'Al operar como un servicio móvil privado, solo por cita, mantenemos los gastos generales bajos y trasladamos esos ahorros como algunos de los pagos más competitivos de la región. Cada consulta se maneja de forma personal y confidencial — sin presión de tienda física, sin intermediarios y sin obligación.'
                      : 'By operating as a private, appointment-only mobile service, we keep overhead low and pass those savings on as some of the most competitive payouts in the region. Every consultation is handled personally and confidentially — no storefront pressure, no middlemen, and no obligation.'}
                  </p>
                  <p>
                    {isEs
                      ? 'Ya sea que esté pensando en vender una sola reliquia familiar o liquidar un patrimonio multigeneracional, Chris aporta un enfoque discreto e informado a cada conversación.'
                      : 'Whether you\'re considering selling a single heirloom or liquidating a multi-generational estate, Chris brings a discreet, informed approach to every conversation.'}
                  </p>
                </div>

                <div className="mt-10 grid grid-cols-2 gap-6">
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
          </div>
        </section>

        {/* How It Works */}
        <section id="process" className="py-20 md:py-28">
          <div className="container mx-auto px-6 md:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <span
                className="text-xs font-bold uppercase tracking-[0.4em]"
                style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}
              >
                {isEs ? 'Cómo Funciona' : 'How It Works'}
              </span>
              <h2
                className="text-4xl md:text-5xl font-bold mt-4 mb-6 tracking-tight"
                style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}
              >
                {isEs ? 'Ofertas Competitivas. Pago Inmediato.' : 'Competitive Offers. Immediate Payment.'}
              </h2>
              <p className="text-lg" style={{ color: 'var(--color-on-surface-variant)' }}>
                {isEs
                  ? 'Al mantener los gastos generales bajos y operar por cita, ofrecemos pagos altamente competitivos con opciones de pago inmediato.'
                  : 'By keeping overhead low and operating by appointment, we offer highly competitive payouts with immediate payment options.'}
              </p>
            </div>

            <div className="max-w-4xl mx-auto space-y-4">
              {[
                {
                  num: '01',
                  title: isEs ? 'Consulta Inicial' : 'Initial Consultation',
                  body: isEs
                    ? 'En muchos casos, proporcionamos ofertas preliminares directamente de fotos enviadas por mensaje de texto o correo electrónico. También podemos discutir colecciones por teléfono o videollamada antes de organizar una evaluación en persona.'
                    : 'In many cases, we provide preliminary offers directly from photos sent by text or email. We\'re also happy to discuss collections by phone or video call before arranging an in-person evaluation.',
                },
                {
                  num: '02',
                  title: isEs ? 'Evaluación en el Lugar' : 'On-Site Evaluation',
                  body: isEs
                    ? 'Viajamos directamente a su ubicación preferida para una revisión en persona conveniente de su joyería de patrimonio, antigüedades o metales preciosos.'
                    : 'We travel directly to your preferred location for a convenient in-person review of your estate jewelry, antiques, or precious metals.',
                },
                {
                  num: '03',
                  title: isEs ? 'Ofertas y Pago Inmediato' : 'Immediate Offers & Payment',
                  body: isEs
                    ? 'Las compras calificadas reciben ofertas transparentes con opciones de pago inmediato al llegar a un acuerdo — efectivo, cheque certificado o transferencia bancaria.'
                    : 'Qualified purchases receive transparent offers with immediate payment available upon agreement — cash, certified check, or wire transfer.',
                },
              ].map((step) => (
                <div
                  key={step.num}
                  className="flex flex-col md:flex-row md:items-center py-10 px-6 md:px-8 rounded-sm"
                  style={{ background: 'var(--color-surface-container-high)' }}
                >
                  <span
                    className="font-bold italic text-4xl md:mr-12 mb-4 md:mb-0 opacity-50"
                    style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-primary)' }}
                  >
                    {step.num}
                  </span>
                  <div className="flex-1">
                    <h4
                      className="text-xl font-bold mb-1"
                      style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}
                    >
                      {step.title}
                    </h4>
                    <p style={{ color: 'var(--color-on-surface-variant)' }}>{step.body}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Imagined storefront */}
            <div
              className="mt-14 max-w-5xl mx-auto overflow-hidden rounded-sm shadow-2xl"
              style={{ background: 'var(--color-surface-container-high)', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              <Image
                src="/assets/images/pages/about-if-we-had-a-store.webp"
                alt={isEs ? 'Sala de exposición de joyería de estilo antiguo imaginada' : 'Imagined old-world jewelry showroom with antique display cases'}
                width={1000}
                height={560}
                className="w-full h-auto object-cover"
              />
              <div className="p-6 md:p-8 text-center">
                <span
                  className="text-xs font-bold uppercase tracking-[0.35em]"
                  style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}
                >
                  {isEs ? 'Sin Tienda, Solo Imaginación' : 'No Storefront, Just Imagination'}
                </span>
                <p
                  className="mt-4 text-lg md:text-xl leading-relaxed max-w-3xl mx-auto"
                  style={{ color: 'var(--color-on-surface-variant)' }}
                >
                  {isEs
                    ? 'No tenemos una tienda, pero si la tuviéramos, podría verse algo así: iluminación dramática, demasiadas alfombras y al menos una vitrina que hace que cada reloj parezca necesitar su propia seguridad. Por ahora, lo mantenemos móvil y vamos a usted.'
                    : "We do not have a store, but if we did, it might look something like this: dramatic lighting, too many rugs, and at least one display case that makes every watch feel like it needs its own security detail. For now, we keep it mobile and come to you."}
                </p>
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
              {isEs ? '¿Listo para Comenzar una Conversación?' : 'Ready to Start a Conversation?'}
            </h2>
            <p className="text-lg mb-10 max-w-2xl mx-auto" style={{ color: 'var(--color-on-surface-variant)' }}>
              {isEs
                ? 'Llame o envíe un mensaje de texto a Chris directamente, o programe una consulta privada en un momento que le convenga.'
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
                {isEs ? 'Contáctenos' : 'Contact Us'}
              </Link>
            </div>
            <div className="mt-8">
              <a
                href="https://share.google/yQQMAvFDiOLppBZ30"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-widest transition-colors border-b pb-1"
                style={{ color: 'var(--color-primary)', borderColor: 'color-mix(in srgb, var(--color-primary) 30%, transparent)', fontFamily: 'var(--font-label)' }}
              >
                ★ {isEs ? 'Lea lo que dicen los clientes en Google' : 'Read what clients say on Google'} ↗
              </a>
            </div>
          </div>
        </section>

      </main>
      <SiteFooter locale={locale} />
    </>
  );
}
