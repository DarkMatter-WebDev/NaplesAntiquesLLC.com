import type { Metadata } from 'next';
import { alternatesFor } from '@/lib/seo';
import Image from 'next/image';
import Link from 'next/link';
import SiteHeader from '@/components/layout/SiteHeader';
import SiteFooter from '@/components/layout/SiteFooter';
import TradingViewMini from '@/components/trading/TradingViewMini';
import { fetchSpotData } from '@/lib/spot-price';
import { AppIcon } from '@/components/AppIcon';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: 'Sell Gold in Naples, FL — Gold Buyer',
    description:
      'Private gold estate services in Naples FL. Expert evaluation of gold jewelry, bullion, coins, and dental gold with clear testing and immediate payment throughout Southwest Florida.',
    alternates: alternatesFor('/gold-services', locale),
  };
}

interface Props {
  params: Promise<{ locale: string }>;
}

const KARAT_CARDS = [
  { karat: '24k', purity: '99.9% Pure', purityEs: '99.9% Puro', desc: 'The highest purity possible. Characteristically soft and bright orange-yellow. Common in bullion and investment bars.', descEs: 'La pureza más alta posible. Suave y de color amarillo-naranja brillante. Común en lingotes e inversiones.' },
  { karat: '22k', purity: '91.6% Pure', purityEs: '91.6% Puro', desc: 'Standard for sovereign coins and traditional high-end Indian and Middle Eastern jewelry designs.', descEs: 'Estándar para monedas soberanas y joyería tradicional de alta gama del sur de Asia y Oriente Medio.' },
  { karat: '18k', purity: '75.0% Pure', purityEs: '75.0% Puro', desc: "The luxury standard for fine jewelry. Marked as '18k' or '750'. Balanced durability and rich color.", descEs: 'El estándar de lujo para joyería fina. Marcado como "18k" o "750". Durabilidad y color equilibrados.' },
  { karat: '14k', purity: '58.3% Pure', purityEs: '58.3% Puro', desc: "The most common hallmark in North America. Marked '14k' or '585'. Ideal for everyday wear pieces.", descEs: 'La marca más común en América del Norte. Marcado "14k" o "585". Ideal para uso diario.' },
  { karat: '10k', purity: '41.7% Pure', purityEs: '41.7% Puro', desc: "The minimum standard to be legally called 'gold' in many regions. Highly durable due to alloy content.", descEs: 'El mínimo estándar para ser llamado "oro" legalmente en muchas regiones. Muy duradero.' },
];

const ACQUIRE_ITEMS = [
  { key: 'bullion', titleEn: 'Bullion & Coins', titleEs: 'Lingotes y Monedas', descEn: 'Sovereigns, Eagles, Krugerrands, and bars of any weight or mint.', descEs: 'Soberanos, Eagles, Krugerrands y barras de cualquier peso o casa de moneda.', img: '/assets/images/pages/bullion.webp' },
  { key: 'jewelry', titleEn: 'Fine Jewelry', titleEs: 'Joyería Fina', descEn: 'Designer pieces, wedding bands, necklaces, and heirloom estates.', descEs: 'Piezas de diseñador, anillos de boda, collares y patrimonios de familia.', img: '/assets/images/pages/gold.webp' },
  { key: 'scrap', titleEn: 'Scrap & Broken', titleEs: 'Chatarra y Roto', descEn: 'Damaged items, single earrings, and tangled chains are still highly valuable.', descEs: 'Los artículos dañados, aretes sueltos y cadenas enredadas siguen siendo muy valiosos.', img: '/assets/images/pages/scrap.jpg' },
  { key: 'dental', titleEn: 'Dental Gold', titleEs: 'Oro Dental', descEn: 'Crowns, bridges, and dental alloys. We provide competitive payouts for all dental gold.', descEs: 'Coronas, puentes y aleaciones dentales. Ofrecemos pagos competitivos para todo el oro dental.', img: '/assets/images/pages/dental.webp' },
];

export default async function GoldServicesPage({ params }: Props) {
  const { locale } = await params;
  const isEs = locale === 'es';
  const spot = await fetchSpotData();
  const goldSpot = spot.goldPerTroyOz ? Math.round(spot.goldPerTroyOz).toLocaleString('en-US') : null;

  return (
    <>
      <SiteHeader />
      <main className="site-header-offset">

        {/* Hero */}
        <section className="relative h-[640px] flex items-center bg-[#1a1c1c] overflow-hidden">
          <div className="absolute inset-0 opacity-40">
            <Image
              src="/assets/images/pages/bullion.webp"
              alt="Gold bars"
              fill
              sizes="100vw"
              className="object-cover"
              priority
            />
          </div>
          <div className="ultrawide-page relative z-10 max-w-[1440px] mx-auto px-4 md:px-8 w-full">
            <div className="max-w-2xl">
              <span className="text-[#e9c349] font-[family-name:var(--font-body)] text-xs font-bold tracking-[0.2em] uppercase block mb-4">
                {isEs ? 'Adquisiciones de Oro Privadas' : 'Private Gold Acquisitions'}
              </span>
              <h1 className="text-white font-[family-name:var(--font-headline)] text-4xl md:text-5xl font-bold mb-6 leading-tight">
                {isEs
                  ? 'Servicios de Oro con Evaluación Clara y Pago Inmediato.'
                  : 'Private Gold Estate Services with Clear Evaluation & Immediate Payment.'}
              </h1>
              <p className="text-[#d7d0c3] text-lg mb-10 max-w-lg leading-relaxed">
                {isEs
                  ? 'Destino principal en Naples para transacciones de oro de alto valor. Evaluaciones privadas con pago inmediato para joyería fina, lingotes y monedas raras.'
                  : "Naples' premier destination for high-value gold and estate transactions. We provide expert private evaluations with immediate payment for fine jewelry, bullion, and rare coins."}
              </p>
              <div className="flex flex-wrap gap-4">
                <Link
                  href={isEs ? '/es/free-evaluation' : '/free-evaluation'}
                  className="gold-button"
                >
                  {isEs ? 'OBTENER ESTIMADO' : 'GET AN ESTIMATE'}
                </Link>
                <Link
                  href={isEs ? '/es/free-evaluation' : '/free-evaluation'}
                  className="outline-button"
                  style={{ borderColor: 'rgba(255,255,255,0.48)', color: 'white', background: 'rgba(255,255,255,0.08)' }}
                >
                  {isEs ? 'EVALUACIÓN GRATIS' : 'FREE EVALUATION'}
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Gold Spot Reference */}
        <section className="py-16 bg-[#f3f3f3] border-y border-[#d0c5af]">
          <div className="ultrawide-page max-w-[1440px] mx-auto px-4 md:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-5">
                <span className="text-xs font-bold text-[#735c00] uppercase tracking-[0.2em] mb-4 block">
                  {isEs ? 'Referencia del Mercado en Vivo' : 'Live Market Reference'}
                </span>
                <h2 className="font-[family-name:var(--font-headline)] text-2xl md:text-3xl font-bold text-[#1a1c1c] mb-4">
                  {isEs ? 'Precio Spot del Oro' : 'Current Gold Spot Price'}
                </h2>
                <p className="text-sm text-[#4d4635] leading-relaxed">
                  {isEs
                    ? 'El precio spot es el punto de partida del mercado en vivo para el oro. Verificamos el quilataje, peso y forma de sus artículos, y le explicamos cómo el mercado actual se traduce en una oferta clara.'
                    : 'Spot price is the live market starting point for gold. We verify the karat, weight, and form of your items, then explain how the current market translates into a clear offer.'}
                </p>
              </div>
              <div className="lg:col-span-7">
                <div className="overflow-hidden rounded-2xl border border-[#d0c5af] bg-white shadow-[0_18px_54px_rgba(38,28,6,0.07)]">
                  <div className="px-5 pt-4 pb-2 flex items-center justify-between">
                    <h3 className="font-[family-name:var(--font-headline)] text-xl font-bold text-[#735c00]">Gold</h3>
                    {goldSpot ? (
                      <span className="text-sm font-bold text-[#1a1c1c]">
                        ${goldSpot}
                        <span className="text-xs font-normal text-[#4d4635] uppercase tracking-wider"> /oz</span>
                      </span>
                    ) : (
                      <span className="text-xs text-[#4d4635] uppercase tracking-wider">Spot</span>
                    )}
                  </div>
                  <div className="px-2 pb-2">
                    <TradingViewMini symbol="OANDA:XAUUSD" height={220} transparent />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Items We Acquire */}
        <section className="ultrawide-page py-20 max-w-[1440px] mx-auto px-4 md:px-8">
          <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-8">
            <div className="max-w-xl">
              <h2 className="font-[family-name:var(--font-headline)] text-3xl md:text-4xl font-bold text-[#1a1c1c] mb-4">
                {isEs ? 'Artículos que Adquirimos' : 'Items We Acquire'}
              </h2>
              <p className="text-[#4d4635] text-sm leading-relaxed">
                {isEs
                  ? 'Compramos una amplia variedad de activos de oro, independientemente de su condición. Desde monedas de inversión impecables hasta joyería rota y chatarra industrial.'
                  : 'We purchase a wide variety of gold assets, regardless of their condition. From pristine investment coins to broken jewelry and industrial scrap.'}
              </p>
            </div>
            <Link
              href={isEs ? '/es/free-evaluation' : '/free-evaluation'}
              className="outline-button inline-flex items-center gap-4 shrink-0"
              style={{ color: '#735c00' }}
            >
              {isEs ? 'INICIAR EVALUACIÓN' : 'START EVALUATION'}
              <AppIcon name="trending_flat"  />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {ACQUIRE_ITEMS.map(({ key, titleEn, titleEs, descEn, descEs, img }) => (
              <div key={key} className="group cursor-pointer">
                <div className="mb-6 aspect-square overflow-hidden rounded-2xl bg-[#e8e8e8] shadow-[0_14px_38px_rgba(38,28,6,0.08)]">
                  {img ? (
                    <Image
                      src={img}
                      alt={isEs ? titleEs : titleEn}
                      width={400}
                      height={400}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <AppIcon name="diamond"
                        className="text-[#735c00]"
                        style={{ fontSize: '3.5rem', fontVariationSettings: "'FILL' 0, 'wght' 200" }}
                       />
                    </div>
                  )}
                </div>
                <h3 className="font-[family-name:var(--font-headline)] text-lg font-bold mb-2">
                  {isEs ? titleEs : titleEn}
                </h3>
                <p className="text-[#4d4635] text-sm leading-relaxed">{isEs ? descEs : descEn}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Decoding Gold Markings */}
        <section className="ultrawide-page py-20 max-w-[1440px] mx-auto px-4 md:px-8">
          <div className="text-center mb-16">
            <h2 className="font-[family-name:var(--font-headline)] text-3xl md:text-4xl font-bold text-[#1a1c1c] mb-4">
              {isEs ? 'Marcas del Oro' : 'Decoding Gold Markings'}
            </h2>
            <div className="w-24 h-px bg-[#d0c5af] mx-auto" />
            <p className="mt-6 text-[#4d4635] text-sm max-w-xl mx-auto leading-relaxed">
              {isEs
                ? 'Entender la pureza de sus activos es el primer paso en una evaluación profesional.'
                : 'Understanding the purity of your assets is the first step in a professional estate evaluation. Use our guide to identify standard markings.'}
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {KARAT_CARDS.map(({ karat, purity, purityEs, desc, descEs }) => (
              <div
                key={karat}
                className="flex flex-col items-center rounded-2xl border border-[#d0c5af] bg-white p-6 text-center shadow-[0_14px_38px_rgba(38,28,6,0.05)] transition-all hover:-translate-y-0.5 hover:shadow-xl md:p-8"
              >
                <span className="font-[family-name:var(--font-headline)] text-4xl md:text-5xl font-bold text-[#735c00] mb-2">
                  {karat}
                </span>
                <span className="text-[10px] font-bold text-[#4d4635] uppercase tracking-wider mb-4">
                  {isEs ? purityEs : purity}
                </span>
                <div className="w-full h-px bg-[#d0c5af] mb-4 opacity-40" />
                <p className="text-xs text-[#4d4635] leading-relaxed">{isEs ? descEs : desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Unmarked / Vintage Gold */}
        <section className="bg-[#f3f3f3] py-20">
          <div className="ultrawide-page max-w-[1440px] mx-auto px-4 md:px-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
              <div>
                <h2 className="font-[family-name:var(--font-headline)] text-3xl md:text-4xl font-bold mb-6">
                  {isEs ? 'Oro Sin Marcar o Vintage' : 'Unmarked or Vintage Gold'}
                </h2>
                <p className="text-base text-[#4d4635] mb-8 leading-relaxed">
                  {isEs
                    ? 'No todo el oro tiene una marca legible, especialmente las piezas antiguas o hechas a medida. Verificamos la composición con pruebas ácidas y electrónicas en el sitio, y organizamos análisis XRF no destructivo a través de socios de laboratorio cuando es necesario.'
                    : 'Not all gold bears a legible hallmark, especially antique or custom-made pieces. We verify composition with onsite acid and electronic testing at your appointment, and arrange offsite, non-destructive XRF analysis through trusted lab partners when needed.'}
                </p>
                <div className="space-y-8">
                  <div className="flex gap-6">
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-[#d4af37]">
                      <AppIcon name="biotech" className="text-white text-xl" style={{ fontVariationSettings: "'FILL' 1" }} />
                    </div>
                    <div>
                      <h4 className="font-[family-name:var(--font-headline)] text-lg font-bold mb-2">
                        {isEs ? 'Espectrometría XRF' : 'XRF Spectrometry'}
                      </h4>
                      <p className="text-sm text-[#4d4635] leading-relaxed">
                        {isEs
                          ? 'La fluorescencia de rayos X (XRF) ofrece un desglose químico preciso de las aleaciones sin eliminar metal de su artículo.'
                          : 'Offsite X-Ray Fluorescence (XRF) provides a precise chemical breakdown of alloys without removing any metal from your item.'}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-6">
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-[#d4af37]">
                      <AppIcon name="science" className="text-white text-xl" style={{ fontVariationSettings: "'FILL' 1" }} />
                    </div>
                    <div>
                      <h4 className="font-[family-name:var(--font-headline)] text-lg font-bold mb-2">
                        {isEs ? 'Prueba Ácida y Electrónica' : 'Acid & Electronic Testing'}
                      </h4>
                      <p className="text-sm text-[#4d4635] leading-relaxed">
                        {isEs
                          ? 'En el sitio de su cita usamos pruebas ácidas y verificación electrónica para confirmar los niveles de pureza.'
                          : 'Onsite at your appointment, we use professional touchstone acid testing and electronic verification to confirm purity levels.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="relative">
                <div className="flex aspect-[4/5] w-full items-center justify-center rounded-2xl bg-[#e8e8e8] shadow-[0_18px_54px_rgba(38,28,6,0.08)]">
                  <div className="text-center px-8">
                    <AppIcon name="biotech"
                      className="text-[#735c00] block mb-4"
                      style={{ fontSize: '5rem', fontVariationSettings: "'FILL' 0, 'wght' 200" }}
                     />
                    <p className="text-sm text-[#4d4635]">
                      {isEs ? 'Pruebas de laboratorio en el sitio' : 'On-site & lab testing'}
                    </p>
                  </div>
                </div>
                <div className="absolute -bottom-8 -left-8 hidden rounded-2xl bg-[#2f3131] p-10 shadow-[0_18px_54px_rgba(0,0,0,0.22)] md:block">
                  <p className="text-[#e9c349] font-[family-name:var(--font-headline)] text-xl font-bold">
                    {isEs ? 'Precios del Mercado' : 'Live-Market Pricing'}
                  </p>
                  <p className="text-white text-[10px] tracking-widest mt-2 uppercase">
                    {isEs ? 'PROBADO ANTE USTED' : 'TESTED IN FRONT OF YOU'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Trust CTA */}
        <section className="bg-[#2f3131] py-24 text-center">
          <div className="max-w-2xl mx-auto px-4">
            <AppIcon name="verified_user"
              className="text-[#e9c349] block mb-6"
              style={{ fontSize: '3.5rem', fontVariationSettings: "'FILL' 1" }}
             />
            <h2 className="text-white font-[family-name:var(--font-headline)] text-3xl md:text-4xl font-bold mb-6">
              {isEs ? 'Confidencialidad y Servicio Experto' : 'Confidentiality & Expert Service'}
            </h2>
            <p className="text-[#d7d0c3] text-base mb-10 leading-relaxed max-w-lg mx-auto">
              {isEs
                ? 'Naples Estate Jewelry ofrece servicios privados de oro por cita en todo el suroeste de Florida, con pruebas claras, números honestos y pago inmediato.'
                : 'Naples Estate Jewelry provides private, appointment-based gold estate services throughout Southwest Florida, with clear testing, honest numbers, and prompt payment.'}
            </p>
            <div className="flex flex-col md:flex-row justify-center gap-6">
              <Link
                href={isEs ? '/es/free-evaluation' : '/free-evaluation'}
                className="gold-button"
              >
                {isEs ? 'PROGRAMAR CITA' : 'SCHEDULE APPOINTMENT'}
              </Link>
              <a
                href="tel:2394048505"
                className="outline-button"
                style={{ borderColor: 'rgba(255,255,255,0.32)', color: 'white', background: 'rgba(255,255,255,0.08)' }}
              >
                CALL (239) 404-8505
              </a>
            </div>
          </div>
        </section>

      </main>
      <SiteFooter />
    </>
  );
}
