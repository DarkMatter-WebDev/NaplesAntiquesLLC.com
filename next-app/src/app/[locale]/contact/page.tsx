import type { Metadata } from 'next';
import SiteHeader from '@/components/layout/SiteHeader';
import SiteFooter from '@/components/layout/SiteFooter';
import ContactForm from '@/components/contact/ContactForm';

export const metadata: Metadata = {
  title: 'Contact Us | Submit Your Item | Naples Estate Jewelry',
  description:
    'Contact Naples Estate Jewelry to submit photos and details about estate jewelry, gold, silver, watches, coins, or antiques. Mobile, private evaluations throughout Southwest Florida. Call or text (239) 404-8505.',
};

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ submitted?: string }>;
}

export default async function ContactPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { submitted } = await searchParams;
  const isEs = locale === 'es';
  const isSubmitted = submitted === '1';

  return (
    <>
      <SiteHeader />
      <main className="pt-16">

        {/* Hero */}
        <section
          className="py-14 md:py-20 border-b"
          style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-low)' }}
        >
          <div className="container mx-auto px-6 md:px-8 max-w-4xl text-center">
            <span
              className="text-xs font-bold uppercase tracking-[0.4em]"
              style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}
            >
              {isEs ? 'Contáctenos' : 'Contact Us'}
            </span>
            <h1
              className="text-4xl md:text-5xl font-bold mt-4 mb-6 tracking-tight"
              style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}
            >
              {isEs ? 'Comuníquese con Nosotros' : 'Get in Touch'}
            </h1>
            <p className="text-lg md:text-xl max-w-2xl mx-auto leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>
              {isEs
                ? 'Envíe una descripción rápida y fotos opcionales para una revisión preliminar, o llámenos directamente. Evaluaciones móviles y privadas en todo el suroeste de Florida.'
                : 'Send a quick description and optional photos for a preliminary read, or call us directly. Mobile, private evaluations throughout Southwest Florida.'}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center mt-10">
              <a href="#submit-item" className="gold-button">
                {isEs ? 'Enviar su artículo' : 'Submit your item'}
              </a>
              <a href="tel:2394048505" className="outline-button">
                {isEs ? 'Llamar (239) 404-8505' : 'Call (239) 404-8505'}
              </a>
            </div>
          </div>
        </section>

        <ContactForm locale={locale} submitted={isSubmitted} />

      </main>
      <SiteFooter locale={locale} />
    </>
  );
}
