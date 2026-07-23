import type { Metadata } from 'next';
import LegalPolicyPage from '@/components/legal/LegalPolicyPage';
import { getLegalMetadata } from '@/lib/legal-metadata';
import { getSpanishLegalCopy } from '@/lib/spanish-legal-copy';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return getLegalMetadata('accessibility', locale);
}

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function AccessibilityPage({ params }: Props) {
  const { locale } = await params;
  const isEs = locale === 'es';
  const spanishCopy = getSpanishLegalCopy('accessibility', locale);

  return (
    <LegalPolicyPage
      locale={locale}
      title={spanishCopy?.title ?? 'Accessibility Statement'}
      updated={spanishCopy?.updated}
      intro={spanishCopy?.intro ?? [
        'Naples Estate Jewelry wants its website to be usable by customers, sellers, and visitors with disabilities. Accessibility is an ongoing effort, especially as inventory, images, admin tools, and ecommerce features change.',
      ]}
      sections={spanishCopy?.sections ?? [
        {
          title: isEs ? 'Nuestro Compromiso' : 'Our Commitment',
          body: [
            'We aim to make the public website reasonably accessible by using semantic page structure, readable text, labeled forms, keyboard-accessible controls, descriptive link text, and alternative text where appropriate.',
          ],
        },
        {
          title: isEs ? 'Mejoras Continuas Conocidas' : 'Known Ongoing Improvements',
          bullets: [
            'Continue reviewing product and decorative image alt text as new inventory is added.',
            'Continue checking color contrast when new promotional, carousel, or admin UI styles are introduced.',
            'Continue testing keyboard navigation on forms, menus, cart, checkout, account, and modal interactions.',
            'Continue replacing icon-only or symbolic controls with clear accessible names where needed.',
          ],
        },
        {
          title: isEs ? 'Comentarios' : 'Feedback',
          body: [
            'If you have trouble using any part of the website, please call or text (239) 404-8505. Tell us the page, what you were trying to do, and the assistive technology or browser you were using if you are comfortable sharing it.',
          ],
        },
        {
          title: isEs ? 'Servicios de Terceros' : 'Third-Party Services',
          body: [
            'Some features may rely on third-party services such as authentication, email, hosting, forms, payment processing, maps, or shipping tools. We cannot control every third-party interface, but we will try to provide a reasonable alternative when possible.',
          ],
        },
      ]}
    />
  );
}
