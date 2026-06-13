import type { Metadata } from 'next';
import Link from 'next/link';
import SiteHeader from '@/components/layout/SiteHeader';
import SiteFooter from '@/components/layout/SiteFooter';

export const metadata: Metadata = {
  title: 'Privacy Policy | Naples Estate Jewelry',
  description: 'Privacy Policy for Naples Estate Jewelry. How we collect, use, and protect your personal information.',
  robots: { index: false, follow: true },
};

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function PrivacyPage({ params }: Props) {
  const { locale } = await params;
  const isEs = locale === 'es';

  return (
    <>
      <SiteHeader />
      <main className="pt-16 px-4 md:px-8 py-16 max-w-3xl mx-auto">
        <header className="mb-12">
          <span className="text-[#735c00] text-xs font-bold uppercase tracking-[0.4em]">Legal</span>
          <h1 className="font-[family-name:var(--font-headline)] text-4xl md:text-5xl font-bold text-[#1a1c1c] mt-2 mb-4">
            {isEs ? 'Política de Privacidad' : 'Privacy Policy'}
          </h1>
          <p className="text-sm text-[#4d4635]">
            {isEs ? 'Última actualización: Mayo 2026' : 'Last updated: May 2026'}
          </p>
        </header>

        <article className="space-y-8 text-[#4d4635] leading-relaxed">
          <section>
            <h2 className="font-[family-name:var(--font-headline)] text-2xl font-bold text-[#1a1c1c] mb-3">
              {isEs ? '1. Introducción' : '1. Introduction'}
            </h2>
            <p>
              {isEs
                ? 'Naples Estate Jewelry ("nosotros", "nuestro" o "nos") respeta su privacidad. Esta Política de Privacidad explica qué información recopilamos cuando interactúa con nuestro sitio web (naplesestatejewelry.co), programa una consulta, nos llama o envía mensajes, o de otro modo utiliza nuestros servicios, y cómo usamos y protegemos esa información.'
                : 'Naples Estate Jewelry ("we," "our," or "us") respects your privacy. This Privacy Policy explains what information we collect when you interact with our website (naplesestatejewelry.co), schedule a consultation, text or call us, or otherwise engage our services, and how we use and protect that information.'}
            </p>
          </section>

          <section>
            <h2 className="font-[family-name:var(--font-headline)] text-2xl font-bold text-[#1a1c1c] mb-3">
              {isEs ? '2. Información que Recopilamos' : '2. Information We Collect'}
            </h2>
            <p className="mb-3">
              {isEs
                ? 'Podemos recopilar las siguientes categorías limitadas de información directamente de usted:'
                : 'We may collect the following limited categories of information directly from you:'}
            </p>
            <ul className="list-disc pl-6 space-y-2 text-sm">
              {isEs ? (
                <>
                  <li><strong>Información de contacto</strong> — su nombre, número de teléfono y dirección de correo electrónico cuando llama, envía mensajes o programa una consulta a través de Calendly.</li>
                  <li><strong>Detalles del artículo</strong> — fotos, descripciones, informes, recibos u otros documentos que nos envíe voluntariamente en conexión con una posible venta.</li>
                  <li><strong>Mensajes de chat</strong> — cualquier mensaje que envíe a través del widget de chat en vivo de nuestro sitio web.</li>
                  <li><strong>Datos web estándar</strong> — análisis básicos como dirección IP, tipo de navegador, páginas visitadas y ubicación aproximada, recopilados automáticamente a través de nuestro proveedor de alojamiento y herramientas de análisis.</li>
                </>
              ) : (
                <>
                  <li><strong>Contact information</strong> — your name, phone number, and email address when you call, text, or schedule a consultation through Calendly.</li>
                  <li><strong>Item details</strong> — photos, descriptions, reports, receipts, or other documents you voluntarily send us in connection with a potential sale.</li>
                  <li><strong>Chat messages</strong> — any messages you send through the live chat widget on our website.</li>
                  <li><strong>Standard web data</strong> — basic analytics such as IP address, browser type, pages visited, and approximate location, collected automatically through our hosting provider and analytics tools.</li>
                </>
              )}
            </ul>
          </section>

          <section>
            <h2 className="font-[family-name:var(--font-headline)] text-2xl font-bold text-[#1a1c1c] mb-3">
              {isEs ? '3. Cómo Usamos su Información' : '3. How We Use Your Information'}
            </h2>
            <p className="mb-3">
              {isEs
                ? 'Usamos la información que usted proporciona únicamente para:'
                : 'We use information you provide solely to:'}
            </p>
            <ul className="list-disc pl-6 space-y-2 text-sm">
              {isEs ? (
                <>
                  <li>Responder a sus consultas y proporcionar cotizaciones o evaluaciones;</li>
                  <li>Programar y realizar consultas privadas;</li>
                  <li>Completar compras acordadas y cualquier papeleo relacionado;</li>
                  <li>Mejorar la calidad de nuestro sitio web y servicio.</li>
                </>
              ) : (
                <>
                  <li>Respond to your inquiries and provide quotes or evaluations;</li>
                  <li>Schedule and conduct private consultations;</li>
                  <li>Complete agreed-upon purchases and any related paperwork;</li>
                  <li>Improve our website and service quality.</li>
                </>
              )}
            </ul>
            <p className="mt-3 text-sm">
              {isEs
                ? 'No vendemos, alquilamos ni compartimos su información personal con terceros con fines de marketing.'
                : 'We do not sell, rent, or share your personal information with third parties for marketing purposes.'}
            </p>
          </section>

          <section>
            <h2 className="font-[family-name:var(--font-headline)] text-2xl font-bold text-[#1a1c1c] mb-3">
              {isEs ? '4. Servicios de Terceros' : '4. Third-Party Services'}
            </h2>
            <p className="mb-3 text-sm">
              {isEs
                ? 'Nuestro sitio web utiliza un pequeño número de servicios de terceros de confianza para operar. Estos servicios pueden recopilar su propia información sujeta a sus propias políticas de privacidad:'
                : 'Our website uses a small number of trusted third-party services to operate. These services may collect their own information subject to their own privacy policies:'}
            </p>
            <ul className="list-disc pl-6 space-y-2 text-sm">
              <li><strong>Calendly</strong> — {isEs ? 'programación de citas.' : 'appointment scheduling.'}</li>
              <li><strong>Tawk.to</strong> — {isEs ? 'widget de chat en vivo.' : 'live-chat widget.'}</li>
              <li><strong>Google Fonts</strong> {isEs ? 'y redes de distribución de contenido — alojamiento de fuentes y activos.' : 'and content delivery networks — font and asset hosting.'}</li>
            </ul>
          </section>

          <section>
            <h2 className="font-[family-name:var(--font-headline)] text-2xl font-bold text-[#1a1c1c] mb-3">
              {isEs ? '5. Confidencialidad' : '5. Confidentiality'}
            </h2>
            <p className="text-sm">
              {isEs
                ? 'Dado que gran parte de nuestro negocio involucra colecciones heredadas y artículos de alto valor, tratamos toda la información del cliente — incluyendo fotos de artículos, descripciones y detalles finales de la transacción — como estrictamente confidencial. No revelamos identidades de clientes ni detalles de transacciones a ninguna parte externa, excepto cuando lo exija la ley.'
                : 'Because much of our business involves inherited collections and high-value items, we treat all client information — including item photos, descriptions, and final transaction details — as strictly confidential. We do not disclose client identities or transaction specifics to any outside party except as required by law (for example, in response to a subpoena or as required by precious-metals reporting regulations).'}
            </p>
          </section>

          <section>
            <h2 className="font-[family-name:var(--font-headline)] text-2xl font-bold text-[#1a1c1c] mb-3">
              {isEs ? '6. Retención y Seguridad de Datos' : '6. Data Retention & Security'}
            </h2>
            <p className="text-sm">
              {isEs
                ? 'Conservamos la información de contacto y los registros de transacciones solo el tiempo razonablemente necesario para fines legítimos de negocios y mantenimiento de registros legales. Usamos medidas de seguridad comercialmente razonables para proteger la información que proporciona.'
                : 'We retain contact information and transaction records only as long as reasonably necessary for legitimate business and legal record-keeping purposes. We use commercially reasonable security measures to protect the information you provide.'}
            </p>
          </section>

          <section>
            <h2 className="font-[family-name:var(--font-headline)] text-2xl font-bold text-[#1a1c1c] mb-3">
              {isEs ? '7. Sus Derechos' : '7. Your Rights'}
            </h2>
            <p className="text-sm">
              {isEs
                ? <>Puede solicitar que eliminemos la información de contacto que tenemos en archivo para usted en cualquier momento llamando o enviando mensajes al <a href="tel:2394048505" className="text-[#735c00] underline">(239) 404-8505</a>. Atenderemos solicitudes razonables sujetas a cualquier obligación legal de mantenimiento de registros.</>
                : <>You may request that we delete the contact information we have on file for you at any time by calling or texting <a href="tel:2394048505" className="text-[#735c00] underline">(239) 404-8505</a>. We will honor reasonable requests subject to any legal record-keeping obligations.</>}
            </p>
          </section>

          <section>
            <h2 className="font-[family-name:var(--font-headline)] text-2xl font-bold text-[#1a1c1c] mb-3">
              {isEs ? '8. Privacidad de Menores' : "8. Children's Privacy"}
            </h2>
            <p className="text-sm">
              {isEs
                ? 'Nuestros servicios están destinados a adultos. No recopilamos a sabiendas información de ninguna persona menor de 18 años.'
                : 'Our services are intended for adults. We do not knowingly collect information from anyone under the age of 18.'}
            </p>
          </section>

          <section>
            <h2 className="font-[family-name:var(--font-headline)] text-2xl font-bold text-[#1a1c1c] mb-3">
              {isEs ? '9. Cambios a Esta Política' : '9. Changes to This Policy'}
            </h2>
            <p className="text-sm">
              {isEs
                ? 'Podemos actualizar esta Política de Privacidad de vez en cuando. Las actualizaciones se publicarán en esta página con una fecha de "Última actualización" revisada.'
                : 'We may update this Privacy Policy from time to time. Updates will be posted on this page with a revised "Last updated" date.'}
            </p>
          </section>

          <section>
            <h2 className="font-[family-name:var(--font-headline)] text-2xl font-bold text-[#1a1c1c] mb-3">
              {isEs ? '10. Contacto' : '10. Contact'}
            </h2>
            <p className="text-sm">
              {isEs ? 'Las preguntas sobre esta Política de Privacidad pueden dirigirse a:' : 'Questions about this Privacy Policy can be directed to:'}<br />
              <strong>Naples Estate Jewelry</strong><br />
              {isEs ? 'Teléfono/Texto: ' : 'Phone/Text: '}
              <a href="tel:2394048505" className="text-[#735c00] underline">(239) 404-8505</a>
            </p>
          </section>
        </article>

        <div className="mt-12 pt-8 border-t border-[#d0c5af]">
          <Link href={isEs ? '/es' : '/'} className="text-[#735c00] text-xs font-bold uppercase tracking-widest hover:underline">
            ← {isEs ? 'Volver al Inicio' : 'Back to Home'}
          </Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
