import type { Metadata } from 'next';
import { alternatesFor } from '@/lib/seo';
import SiteHeader from '@/components/layout/SiteHeader';
import SiteFooter from '@/components/layout/SiteFooter';
import { HeroSection, PageContainer } from '@/components/layout/ResponsiveLayout';
import InquiryForm from '@/components/contact/InquiryForm';
import MessageUsForm from '@/components/contact/MessageUsForm';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const isEs = locale === 'es';
  return {
    title: isEs ? 'Contáctenos — Envíe Su Artículo' : 'Contact Us — Submit Your Item',
    description: isEs
      ? 'Contacte a Naples Estate Jewelry para enviar fotos y detalles de joyería, oro, plata, relojes, monedas o antigüedades. Evaluaciones móviles y privadas en el suroeste de Florida.'
      : 'Contact Naples Estate Jewelry to submit photos and details about estate jewelry, gold, silver, watches, coins, or antiques. Mobile, private evaluations throughout Southwest Florida. Call or text (239) 404-8505.',
    alternates: alternatesFor('/contact', locale),
  };
}

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
      <main className="site-header-offset">

        {inquiryItem ? (
          <>
            {/* Hero is kept ONLY for the product-inquiry flow (reached from a product
                page), which needs the heading context. The normal contact page has no
                hero and opens directly with the "Message Us Directly" section. */}
            <HeroSection
              className="border-b text-center"
              style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-low)' }}
            >
              <PageContainer max="narrow">
                <span
                  className="text-xs font-bold uppercase tracking-[0.4em]"
                  style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}
                >
                  {isEs ? 'Consulta de Artículo' : 'Item Inquiry'}
                </span>
                <h1
                  className="responsive-title-lg font-bold mt-4 mb-6 tracking-tight"
                  style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}
                >
                  {isEs ? 'Consultar Sobre Este Artículo' : 'Inquire About This Item'}
                </h1>
                <p className="responsive-copy max-w-2xl mx-auto" style={{ color: 'var(--color-on-surface-variant)' }}>
                  {isEs
                    ? 'Déjenos su nombre y número de teléfono y nos comunicaremos pronto.'
                    : 'Leave your name and phone number and we\'ll be in touch shortly.'}
                </p>
                {!isSubmitted && (
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

            <div id="inquiry-form">
              <InquiryForm locale={locale} itemName={inquiryItem} submitted={isSubmitted} />
            </div>
          </>
        ) : (
          <MessageUsForm locale={locale} />
        )}

      </main>
      <SiteFooter locale={locale} />
    </>
  );
}
