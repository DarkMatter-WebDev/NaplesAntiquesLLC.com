import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import Image from 'next/image';
import Link from 'next/link';
import SiteHeader from '@/components/layout/SiteHeader';
import SiteFooter from '@/components/layout/SiteFooter';
import TradingViewMini from '@/components/trading/TradingViewMini';
import { fetchSpotData } from '@/lib/spot-price';
import { AppIcon } from '@/components/AppIcon';
import ClayMark, { type ClayMarkName } from '@/components/ClayMark';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const isEs = locale === 'es';
  return pageMetadata({
    // "Silver Buyer" restated "Sell Silver"; those characters now carry the
    // exact phrase instead. This is the page that should own "sell sterling
    // silver naples", and it previously had the term everywhere EXCEPT its
    // title. With the template applied this renders at 58 characters, inside
    // Google's display limit.
    title: isEs
      ? 'Vender Plata Esterlina en Naples, FL'
      : 'Sell Sterling Silver in Naples, FL',
    description: isEs
      ? 'Servicios privados de plata en Naples, FL. Evaluación experta de cubertería de plata esterlina, holloware, monedas y lingotes con pruebas claras y pago inmediato.'
      : 'Private silver estate services in Naples FL. Expert evaluation of sterling silver flatware, hollowware, coins, and bullion with clear testing and immediate payment.',
    path: '/silver-services',
    locale,
  });
}

interface Props {
  params: Promise<{ locale: string }>;
}

// `icon` is the placeholder shown while an item has no photograph. It is
// per-item rather than one shared fallback, which previously drew the same
// flatware icon beside both "Estate Flatware" and "Tea Services".
const GALLERY_ITEMS = [
  { key: 'flatware', titleEn: 'Estate Flatware', titleEs: 'Cubertería de Patrimonio', subEn: 'Full Sets & Individual Pieces', subEs: 'Juegos Completos y Piezas Individuales', img: null, icon: 'dining' },
  { key: 'tea', titleEn: 'Tea Services', titleEs: 'Servicios de Té', subEn: 'Holloware & Serving Trays', subEs: 'Vajilla y Bandejas', img: null, icon: 'emoji_food_beverage' },
  { key: 'coins', titleEn: 'Bullion & Coins', titleEs: 'Lingotes y Monedas', subEn: '99.9% Pure Investment Silver', subEs: 'Plata de Inversión 99.9% Pura', img: '/assets/images/pages/bullion.webp', icon: 'toll' },
  { key: 'jewelry', titleEn: 'Fine Jewelry', titleEs: 'Joyería Fina', subEn: 'Designer & Vintage Collections', subEs: 'Colecciones de Diseñador y Vintage', img: '/assets/images/pages/ring.jpg', icon: 'diamond' },
];

export default async function SilverServicesPage({ params }: Props) {
  const { locale } = await params;
  const isEs = locale === 'es';
  const spot = await fetchSpotData();
  const silverSpot = spot.silverPerTroyOz ? spot.silverPerTroyOz.toFixed(2) : null;

  return (
    <>
      <SiteHeader />
      <main className="site-header-offset">

        {/* Hero */}
        <section className="relative h-[640px] flex items-center overflow-hidden">
          <div className="absolute inset-0 z-0">
            <Image
              src="/assets/images/pages/silver.webp"
              alt="Silver estate pieces"
              fill
              sizes="100vw"
              className="object-cover grayscale opacity-80"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#f9f9f7] via-[#f9f9f7]/60 to-transparent" />
          </div>
          <div className="ultrawide-page relative z-10 max-w-[1440px] mx-auto px-4 md:px-8 w-full">
            <div className="max-w-2xl">
              <span className="text-[#735c00] text-xs font-bold uppercase tracking-[0.2em] mb-4 block">
                {isEs ? 'Servicios de Plata Privados' : 'Private Silver Estate Services'}
              </span>
              <h1 className="font-[family-name:var(--font-headline)] text-4xl md:text-5xl font-bold text-[#1a1c1c] mb-6 leading-tight">
                {isEs
                  ? 'Servicios y Evaluaciones de Plata en Naples'
                  : "Naples' Premier Silver Estate Services & Evaluations"}
              </h1>
              <p className="text-lg text-[#4d4635] mb-10 max-w-xl leading-relaxed">
                {isEs
                  ? 'Un legado de confianza en cada transacción. Ofrecemos evaluaciones privadas de alta precisión para colecciones de plata fina, cubertería de patrimonio y lingotes raros.'
                  : 'A legacy of trust in every transaction. We provide private, high-accuracy evaluations for fine silver collections, estate flatware, and rare bullion.'}
              </p>
              <div className="flex flex-wrap gap-4">
                <Link
                  href={isEs ? '/es/free-evaluation' : '/free-evaluation'}
                  className="gold-button"
                >
                  {isEs ? 'PROGRAMAR EVALUACIÓN' : 'Schedule Evaluation'}
                </Link>
                <Link
                  href={isEs ? '/es/bullion' : '/bullion'}
                  className="outline-button"
                >
                  {isEs ? 'PRECIOS DE PLATA' : 'Current Silver Rates'}
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Silver Spot Reference */}
        <section className="py-16 bg-[#f3f3f3] border-y border-[#d0c5af]">
          <div className="ultrawide-page max-w-[1440px] mx-auto px-4 md:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-5">
                <span className="text-xs font-bold text-[#735c00] uppercase tracking-[0.2em] mb-4 block">
                  {isEs ? 'Referencia del Mercado en Vivo' : 'Live Market Reference'}
                </span>
                <h2 className="font-[family-name:var(--font-headline)] text-2xl md:text-3xl font-bold text-[#1a1c1c] mb-4">
                  {isEs ? 'Precio Spot de la Plata' : 'Current Silver Spot Price'}
                </h2>
                <p className="text-sm text-[#4d4635] leading-relaxed">
                  {isEs
                    ? 'El precio spot establece la línea de base del mercado en vivo para la plata. Para plata esterlina, monedas y lingotes, confirmamos el peso y la pureza, luego explicamos una oferta directa.'
                    : 'Spot price gives us the live market baseline for silver. For sterling, coins, and bullion, we confirm weight and purity first, then use the current market to explain a straightforward offer.'}
                </p>
              </div>
              <div className="lg:col-span-7">
                <div className="overflow-hidden rounded-2xl border border-[#d0c5af] bg-white shadow-[0_18px_54px_rgba(38,28,6,0.07)]">
                  <div className="px-5 pt-4 pb-2 flex items-center justify-between">
                    <h3 className="font-[family-name:var(--font-headline)] text-xl font-bold text-[#735c00]">Silver</h3>
                    {silverSpot ? (
                      <span className="text-sm font-bold text-[#1a1c1c]">
                        ${silverSpot}
                        <span className="text-xs font-normal text-[#4d4635] uppercase tracking-wider"> /oz</span>
                      </span>
                    ) : (
                      <span className="text-xs text-[#4d4635] uppercase tracking-wider">Spot</span>
                    )}
                  </div>
                  <div className="px-2 pb-2">
                    <TradingViewMini symbol="OANDA:XAGUSD" height={220} transparent />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Identifying Silver Guide */}
        <section className="ultrawide-page py-20 max-w-[1440px] mx-auto px-4 md:px-8">
          <div className="text-center mb-20">
            <h2 className="font-[family-name:var(--font-headline)] text-3xl md:text-4xl font-bold mb-4">
              {isEs ? 'Identificando la Plata: Una Guía Profesional' : 'Identifying Silver: A Professional Guide'}
            </h2>
            <div className="w-20 h-px bg-[#735c00] mx-auto" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
            {/* Sterling Silver */}
            <div className="flex flex-col rounded-2xl border border-[#d0c5af] bg-white p-8 shadow-[0_18px_54px_rgba(38,28,6,0.06)] md:p-10">
              <div className="mb-8">
                <span className="text-[10px] font-bold text-[#735c00] uppercase tracking-widest">
                  {isEs ? 'Activo Premium' : 'Premium Asset'}
                </span>
                <h3 className="font-[family-name:var(--font-headline)] text-2xl font-bold mt-2">
                  {isEs ? 'Plata Esterlina (.925)' : 'Sterling Silver (.925)'}
                </h3>
              </div>
              <p className="text-sm text-[#4d4635] mb-8 leading-relaxed">
                {isEs
                  ? 'La plata esterlina genuina consiste en 92.5% de plata pura. Es un metal precioso de calidad de inversión que mantiene valor intrínseco de mercado independientemente de su condición.'
                  : 'Genuine sterling silver consists of 92.5% pure silver. It is an investment-grade precious metal that maintains intrinsic market value regardless of condition.'}
              </p>
              <ul className="space-y-4 mb-8 flex-grow">
                {[
                  { en: 'Hallmarks: Look for "925", "Sterling", or the British Lion Passant.', es: 'Marcas: Busque "925", "Sterling" o el León Pasante Británico.' },
                  { en: 'Natural Tarnish: Develops a warm, dark patina over time.', es: 'Pátina Natural: Desarrolla una pátina oscura y cálida con el tiempo.' },
                  { en: 'Resonant Sound: Produces a long, high-pitched ring when tapped.', es: 'Sonido Resonante: Produce un tono largo y agudo al golpearlo.' },
                ].map((item) => (
                  <li key={item.en} className="flex items-start gap-3">
                    <AppIcon name="verified" className="text-[#735c00] text-sm mt-0.5" />
                    <span className="text-sm">{isEs ? item.es : item.en}</span>
                  </li>
                ))}
              </ul>
              <div className="aspect-video overflow-hidden rounded-xl bg-[#f3f3f3]">
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-[#735c00] font-[family-name:var(--font-body)] text-xs uppercase tracking-widest">
                    {isEs ? '925 — Plata Esterlina' : '925 — Sterling Silver'}
                  </span>
                </div>
              </div>
            </div>

            {/* Silver Plate */}
            <div className="flex flex-col rounded-2xl border border-[#d0c5af] bg-white p-8 shadow-[0_18px_54px_rgba(38,28,6,0.06)] md:p-10">
              <div className="mb-8">
                <span className="text-[10px] font-bold text-[#4d4635] uppercase tracking-widest">
                  {isEs ? 'Metal Base' : 'Base Metal'}
                </span>
                <h3 className="font-[family-name:var(--font-headline)] text-2xl font-bold mt-2">
                  {isEs ? 'Plata Chapada' : 'Silver Plate'}
                </h3>
              </div>
              <p className="text-sm text-[#4d4635] mb-8 leading-relaxed">
                {isEs
                  ? 'El chapado en plata implica una fina capa de plata electrodepositada sobre metales base como cobre o latón. Estos artículos tienen valor estético pero valor metálico limitado.'
                  : 'Silver plating involves a thin layer of silver electroplated over base metals like copper or brass. These items hold aesthetic value but limited metal melt value.'}
              </p>
              <ul className="space-y-4 mb-8 flex-grow">
                {[
                  { en: 'Hallmarks: Often marked "EPNS", "Silver on Copper", or "Quadruple Plate".', es: 'Marcas: Frecuentemente marcado "EPNS", "Silver on Copper" o "Quadruple Plate".' },
                  { en: 'Base Metal Reveal: Often shows "bleeding" where brass or copper shows through.', es: 'Metal Base Visible: A menudo muestra latón o cobre a través del revestimiento.' },
                  { en: 'Dull Sound: Produces a short, flat "clunk" when tapped.', es: 'Sonido Apagado: Produce un sonido corto y plano al golpearlo.' },
                ].map((item) => (
                  <li key={item.en} className="flex items-start gap-3">
                    <AppIcon name="info" className="text-[#7f7663] text-sm mt-0.5" />
                    <span className="text-sm text-[#4d4635]">{isEs ? item.es : item.en}</span>
                  </li>
                ))}
              </ul>
              <div className="aspect-video overflow-hidden rounded-xl bg-[#f3f3f3]">
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-[#7f7663] font-[family-name:var(--font-body)] text-xs uppercase tracking-widest">
                    {isEs ? 'EPNS — Metal Base Chapado' : 'EPNS — Silver Plated Base Metal'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Scientific Testing Method */}
        <section className="bg-[#2f3131] text-white py-20">
          <div className="ultrawide-page max-w-[1440px] mx-auto px-4 md:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-1">
                <h2 className="font-[family-name:var(--font-headline)] text-3xl font-bold mb-6">
                  {isEs ? 'Nuestro Método de Prueba Científica' : 'Our Scientific Testing Method'}
                </h2>
                <p className="text-sm text-[#d7d0c3] mb-8 leading-relaxed">
                  {isEs
                    ? 'Empleamos estándares analíticos rigurosos para asegurar que reciba el máximo valor por sus activos. Nuestras pruebas no destructivas protegen la integridad de sus piezas.'
                    : 'We employ rigorous analytical standards to ensure you receive the maximum value for your assets. Our non-destructive testing protects the integrity of your pieces.'}
                </p>
                <div className="flex items-center gap-2 text-[#e9c349]">
                  <AppIcon name="verified_user" className="text-lg" />
                  <span className="text-xs font-bold uppercase tracking-wider">
                    {isEs ? 'REVISIÓN CUIDADOSA DEL MERCADO' : 'CAREFUL MARKET REVIEW'}
                  </span>
                </div>
              </div>
              <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { mark: 'scale', titleEn: 'Precision Weight', titleEs: 'Peso de Precisión', descEn: 'Using calibrated Ohaus scales to measure in Troy ounces and Grams for pinpoint accuracy.', descEs: 'Usando básculas Ohaus calibradas para medir en onzas Troy y gramos con precisión.' },
                  { mark: 'magnet', titleEn: 'Magnetism', titleEs: 'Magnetismo', descEn: 'Silver is non-magnetic. We use rare-earth neodymium testing to identify ferrous cores.', descEs: 'La plata no es magnética. Usamos pruebas de neodimio para identificar núcleos ferrosos.' },
                  { mark: 'flask', titleEn: 'Assay Analysis', titleEs: 'Análisis de Ensayo', descEn: 'Onsite acid testing at your appointment; offsite XRF spectrometry when exact assay documentation is needed.', descEs: 'Prueba ácida en el sitio; espectrometría XRF externa cuando se necesita documentación exacta.' },
                ].map(({ mark, titleEn, titleEs, descEn, descEs }) => (
                  <div key={mark} className="rounded-2xl border border-white/10 bg-white/5 p-8 shadow-[0_16px_44px_rgba(0,0,0,0.12)]">
                    {/* onDark: this section is a dark band, so the float shadow
                        would be invisible. The gold disc went with the icon —
                        gold clay on a #735c00 circle is gold on gold. */}
                    <ClayMark name={mark as ClayMarkName} size={80} onDark className="mb-6 block" />
                    <h4 className="font-[family-name:var(--font-headline)] text-lg font-bold mb-4 text-[#e9c349]">
                      {isEs ? titleEs : titleEn}
                    </h4>
                    <p className="text-sm text-[#d7d0c3] leading-relaxed">{isEs ? descEs : descEn}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Fine Silver Estate Services Gallery */}
        <section className="ultrawide-page py-20 max-w-[1440px] mx-auto px-4 md:px-8">
          <div className="mb-12 flex items-end justify-between">
            <div>
              <h2 className="font-[family-name:var(--font-headline)] text-3xl md:text-4xl font-bold">
                {isEs ? 'Servicios de Plata Fina' : 'Fine Silver Estate Services'}
              </h2>
              <p className="text-sm text-[#4d4635] mt-2">
                {isEs
                  ? 'Especializados en colecciones de patrimonio de alto valor y lingotes profesionales.'
                  : 'Specializing in high-value estate collections and professional bullion.'}
              </p>
            </div>
            <div className="hidden md:block h-px flex-grow mx-8 bg-[#d0c5af]" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {GALLERY_ITEMS.map(({ key, titleEn, titleEs, subEn, subEs, img, icon }) => (
              <div key={key} className="group cursor-pointer">
                <div className="mb-4 aspect-[3/4] overflow-hidden rounded-2xl bg-[#e8e8e8] shadow-[0_14px_38px_rgba(38,28,6,0.08)]">
                  {img ? (
                    <Image
                      src={img}
                      alt={isEs ? titleEs : titleEn}
                      width={300}
                      height={400}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <AppIcon name={icon}
                        className="text-[#7f7663]"
                        style={{ fontSize: '3rem' }}
                       />
                    </div>
                  )}
                </div>
                <h4 className="text-xs font-bold uppercase tracking-widest text-[#1a1c1c]">
                  {isEs ? titleEs : titleEn}
                </h4>
                <p className="text-xs text-[#4d4635] mt-1">{isEs ? subEs : subEn}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="bg-[#f3f3f3] border-y border-[#d0c5af] py-24 text-center">
          <div className="max-w-3xl mx-auto px-4">
            <h2 className="font-[family-name:var(--font-headline)] text-3xl md:text-4xl font-bold mb-6">
              {isEs ? '¿Listo para una Evaluación Profesional?' : 'Ready for a Professional Evaluation?'}
            </h2>
            <p className="text-base text-[#4d4635] mb-10 leading-relaxed max-w-xl mx-auto">
              {isEs
                ? 'Programe una evaluación móvil privada para plata esterlina, cubertería, vajilla, monedas y lingotes. Revisamos las piezas claramente y le presentamos una oferta directa con pago inmediato.'
                : 'Schedule a private mobile evaluation for sterling silver, flatware, holloware, coins, and bullion. We review the pieces clearly and provide a straightforward offer with prompt payment.'}
            </p>
            <div className="flex flex-col md:flex-row gap-4 justify-center">
              <Link
                href={isEs ? '/es/free-evaluation' : '/free-evaluation'}
                className="gold-button"
              >
                {isEs ? 'PROGRAMAR UNA CITA' : 'Schedule a Time'}
              </Link>
              <a
                href="tel:2394048505"
                className="outline-button"
              >
                Call (239) 404-8505
              </a>
            </div>
          </div>
        </section>

      </main>
      <SiteFooter />
    </>
  );
}
