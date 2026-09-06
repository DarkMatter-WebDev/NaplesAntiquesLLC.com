import Image from 'next/image';
import Link from 'next/link';

/**
 * Four-photo teaser for the gold marks guide, shown on /gold-services — the
 * gold twin of `SilverMarksTeaser` (2026-09-06). Photos are the guide's own
 * tiles, so nothing new is sourced here; every tile links into the guide.
 */

const DIR = '/assets/images/pages/gold-marks';

const PHOTOS = [
  { key: 'own-disney-14k', lead: '14K', en: 'the American karat mark', es: 'el sello americano en quilates', shop: true },
  { key: 'ebay-gf-goldfeather', lead: '14K GOLD FILLED', en: 'a layer, not gold', es: 'una capa, no oro' },
  { key: 'ebay-9ct-clasp', lead: '9ct', en: 'British hallmarks', es: 'sellos británicos' },
  { key: 'ebay-cartier-au750', lead: 'Au 750', en: 'a designer signature', es: 'una firma de diseñador' },
] as const;

export default function GoldMarksTeaser({ locale }: { locale: string }) {
  const isEs = locale === 'es';
  const guideHref = isEs ? '/es/gold-services/gold-marks' : '/gold-services/gold-marks';
  const evalHref = isEs ? '/es/free-evaluation' : '/free-evaluation';

  return (
    <section
      className="border-y border-[#d0c5af] bg-[#f3f3f3] py-20"
      aria-labelledby="gold-marks-teaser-heading"
    >
      <div className="ultrawide-page mx-auto grid max-w-[1440px] items-center gap-10 px-4 md:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] lg:gap-14">
        <div>
          <p
            className="flex items-center gap-3 text-[0.65rem] font-bold uppercase tracking-[0.32em]"
            style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}
          >
            <span aria-hidden="true" className="inline-block h-px w-8 flex-shrink-0" style={{ background: 'var(--color-primary)' }} />
            {isEs ? 'Para profundizar' : 'Go deeper'}
          </p>
          <h2
            id="gold-marks-teaser-heading"
            className="mt-4 text-3xl font-bold md:text-4xl"
            style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}
          >
            {isEs ? 'Cómo Leer los Sellos de su Oro' : 'Reading the Marks on Your Gold'}
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>
            {isEs
              ? 'Los sellos son pequeños y fáciles de pasar por alto — dentro de un aro, bajo la lengüeta de un cierre, en la placa diminuta de una cadena. Nuestra guía ilustrada muestra cómo se ven 10K, 14K, 18K y 14KP; 585, 750 y 375; gold-filled, HGE y vermeil; los sellos británicos; las firmas de Cartier y Tiffany; y el PT950 que no es oro blanco.'
              : 'Marks are small and easy to miss — inside a band, under a clasp tongue, on the tiny tag of a chain. Our illustrated guide shows what 10K, 14K, 18K and 14KP look like; 585, 750 and 375; gold-filled, HGE and vermeil; British hallmarks; the Cartier and Tiffany signatures; and the PT950 that is not white gold.'}
          </p>
          <p className="mt-4 text-[15px] leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>
            <Link href={guideHref} className="font-semibold text-[#735c00] underline underline-offset-2">
              {isEs ? 'Lea la guía completa de sellos de oro →' : 'Read the full gold marks guide →'}
            </Link>{' '}
            <span className="text-sm text-[#7f7663]">
              {isEs ? '31 fotos, cada una ampliable' : '31 photos, each one expandable'}
            </span>
          </p>
          <div className="mt-7">
            <Link href={evalHref} className="gold-button">
              {isEs ? 'PROGRAMAR EVALUACIÓN' : 'Schedule Evaluation'}
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {PHOTOS.map((ph) => (
            <Link
              key={ph.key}
              href={guideHref}
              className="group overflow-hidden rounded-xl border border-[#d0c5af] bg-white shadow-[0_10px_28px_rgba(38,28,6,0.05)] transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#735c00]"
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-[#eae7df]">
                <Image
                  src={`${DIR}/${ph.key}.webp`}
                  alt={`${ph.lead} — ${isEs ? ph.es : ph.en}`}
                  fill
                  sizes="(min-width: 1024px) 24vw, 45vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              <p className="px-3 py-2 text-xs leading-snug" style={{ color: 'var(--color-on-surface-variant)' }}>
                <b style={{ color: 'var(--color-on-surface)' }}>{ph.lead}</b> — {isEs ? ph.es : ph.en}
                {'shop' in ph && ph.shop && (
                  <span className="ml-1 inline-block rounded-sm border border-[#735c00] px-1 align-[1px] text-[9px] uppercase tracking-[0.1em] text-[#735c00]">
                    {isEs ? 'de nuestra tienda' : 'from our shop'}
                  </span>
                )}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
