import Image from 'next/image';
import Link from 'next/link';

/**
 * Four-photo teaser for the silver marks guide, shown on /silver-services.
 *
 * 2026-09-06: the 26-photo "Reading the Marks on Your Silver" section was
 * 1,337 of the lander's 2,320 words and sat above the buying content, so the
 * owner split it out to /silver-services/silver-marks. This block keeps the
 * hook on the lander — the four marks a seller is most likely to find — and
 * sends readers who want depth to the guide. Photos are the guide's own
 * tiles, so nothing new is sourced here.
 */

const DIR = '/assets/images/pages/silver-marks';

const PHOTOS = [
  { key: 'ebay-epns-crafton', lead: 'E.P.N.S.', en: 'plated, not sterling', es: 'chapado, no esterlina' },
  { key: 'own-london-1824-v2', lead: 'Lion passant', en: 'English sterling', es: 'esterlina inglesa', shop: true },
  { key: 'own-gorham-word', lead: 'STERLING', en: 'American, 92.5%', es: 'americana, 92.5%', shop: true },
  { key: 'own-mexico-925', lead: '925', en: 'sterling by the thousand', es: 'esterlina en milésimas', shop: true },
] as const;

export default function SilverMarksTeaser({ locale }: { locale: string }) {
  const isEs = locale === 'es';
  const guideHref = isEs ? '/es/silver-services/silver-marks' : '/silver-services/silver-marks';
  const evalHref = isEs ? '/es/free-evaluation' : '/free-evaluation';

  return (
    <section
      className="border-y border-[#d0c5af] bg-[#f3f3f3] py-20"
      aria-labelledby="silver-marks-teaser-heading"
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
            id="silver-marks-teaser-heading"
            className="mt-4 text-3xl font-bold md:text-4xl"
            style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}
          >
            {isEs ? 'Cómo Leer los Sellos de su Plata' : 'Reading the Marks on Your Silver'}
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>
            {isEs
              ? 'Los sellos vienen en todos los tamaños y variantes — de un milímetro en una cucharita, gastados casi hasta desaparecer, escondidos bajo una pata o dentro de una tapa. Nuestra guía ilustrada muestra cómo se ven E.P.N.S. y EPBM, el león británico, STERLING y la plata de moneda americanas, los números 925 / 800 / 830, y los sellos franceses, alemanes, daneses y mexicanos que más vemos.'
              : 'Marks come in every size and variation — a millimetre tall on a teaspoon, worn nearly smooth, hidden under a foot or inside a lid. Our illustrated guide shows what E.P.N.S. and EPBM look like, the British lion, American STERLING and coin silver, the 925 / 800 / 830 numbers, and the French, German, Danish and Mexican marks we see most.'}
          </p>
          <p className="mt-4 text-[15px] leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>
            <Link href={guideHref} className="font-semibold text-[#735c00] underline underline-offset-2">
              {isEs ? 'Lea la guía completa de sellos de plata →' : 'Read the full silver marks guide →'}
            </Link>{' '}
            <span className="text-sm text-[#7f7663]">
              {isEs ? '26 fotos, la mayoría de piezas compradas en nuestro mostrador' : '26 photos, most from pieces bought over our counter'}
            </span>
          </p>
          <div className="mt-7">
            <Link href={evalHref} className="gold-button">
              {isEs ? 'PROGRAMAR EVALUACIÓN' : 'Schedule Evaluation'}
            </Link>
          </div>
        </div>

        {/* The four tiles are one link each into the guide — a photo is the most
            natural "show me more" affordance here, and the guide's own lightbox
            takes over from there. */}
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
