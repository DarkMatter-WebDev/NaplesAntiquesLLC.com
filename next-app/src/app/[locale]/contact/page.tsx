import type { Metadata } from 'next';
import SiteHeader from '@/components/layout/SiteHeader';
import SiteFooter from '@/components/layout/SiteFooter';
import { HeroSection, PageContainer } from '@/components/layout/ResponsiveLayout';
import ContactForm from '@/components/contact/ContactForm';
import InquiryForm from '@/components/contact/InquiryForm';

export const metadata: Metadata = {
  title: 'Contact Us | Submit Your Item | Naples Estate Jewelry',
  description:
    'Contact Naples Estate Jewelry to submit photos and details about estate jewelry, gold, silver, watches, coins, or antiques. Mobile, private evaluations throughout Southwest Florida. Call or text (239) 404-8505.',
};

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ submitted?: string; item?: string }>;
}

export default async function ContactPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { submitted, item } = await searchParams;
  const isEs = locale === 'es';
  const isSubmitted = submitted === '1';
  const inquiryItem = item ? decodeURIComponent(item) : null;

  return (
    <>
      <SiteHeader />
      <main className="pt-16">

        {/* Hero */}
        <HeroSection
          className="border-b text-center"
          style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-low)' }}
        >
          <PageContainer max="narrow">
            <span
              className="text-xs font-bold uppercase tracking-[0.4em]"
              style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}
            >
              {inquiryItem
                ? (isEs ? 'Consulta de Artículo' : 'Item Inquiry')
                : (isEs ? 'Contáctenos' : 'Contact Us')}
            </span>
            <h1
              className="responsive-title-lg font-bold mt-4 mb-6 tracking-tight"
              style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}
            >
              {inquiryItem
                ? (isEs ? 'Consultar Sobre Este Artículo' : 'Inquire About This Item')
                : (isEs ? 'Comuníquese con Nosotros' : 'Get in Touch')}
            </h1>
            <p className="responsive-copy max-w-2xl mx-auto" style={{ color: 'var(--color-on-surface-variant)' }}>
              {inquiryItem
                ? (isEs
                    ? 'Déjenos su nombre y número de teléfono y nos comunicaremos pronto.'
                    : 'Leave your name and phone number and we\'ll be in touch shortly.')
                : (isEs
                    ? 'Envíe una descripción rápida y fotos opcionales para una revisión preliminar, o llámenos directamente. Evaluaciones móviles y privadas en todo el suroeste de Florida.'
                    : 'Send a quick description and optional photos for a preliminary read, or call us directly. Mobile, private evaluations throughout Southwest Florida.')}
            </p>
            {!inquiryItem && (
              <div className="responsive-actions justify-center mt-10">
                <a href="#submit-item" className="gold-button">
                  {isEs ? 'Enviar su artículo' : 'Submit your item'}
                </a>
                <a href="tel:2394048505" className="outline-button">
                  {isEs ? 'Llamar (239) 404-8505' : 'Call (239) 404-8505'}
                </a>
              </div>
            )}
            {inquiryItem && !isSubmitted && (
              <div className="responsive-actions justify-center mt-10">
                <a href="#inquiry-form" className="gold-button">
                  {isEs ? 'Enviar mensaje' : 'Send a message'}
                </a>
                <a href="tel:2394048505" className="outline-button">
                  {isEs ? 'Llamar (239) 404-8505' : 'Call (239) 404-8505'}
                </a>
              </div>
            )}
          </PageContainer>
        </HeroSection>

        {inquiryItem
          ? (
            <div id="inquiry-form">
              <InquiryForm locale={locale} itemName={inquiryItem} submitted={isSubmitted} />
            </div>
          )
          : <ContactForm locale={locale} submitted={isSubmitted} />
        }

      </main>
      <SiteFooter locale={locale} />
    </>
  );
}
