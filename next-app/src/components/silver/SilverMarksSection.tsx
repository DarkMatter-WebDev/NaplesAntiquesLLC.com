import Link from 'next/link';
import MarkGallery, { type MarkPhoto } from '@/components/silver/MarkGallery';

/**
 * "Reading the Marks on Your Silver" — the illustrated marks guide, rendered
 * by /silver-services/silver-marks (owner request 2026-09-06; mockup v2
 * approved, then built with eBay-sourced photos for the marks the shop has
 * never stocked). It was born on the /silver-services lander and moved to its
 * own page the same day — the lander now shows a four-photo teaser
 * (`SilverMarksTeaser`) that links here.
 *
 * Photo sources (`public/assets/images/pages/silver-marks/`):
 * - `own-*`  — the shop's own product photos (16 marks).
 *   Inventory numbers in `project-docs/CHANGELOG.md` 2026-09-06.
 * - `ebay-*` — eBay listing photos for plated and continental marks the
 *   catalog does not carry. Owner's call after a rights discussion
 *   (DECISIONS → "Silver marks photos"); listing URLs are recorded in
 *   `project-docs/CHANGELOG.md` 2026-09-06 so any image can be swapped.
 *
 * Facts checked against references (Danish three towers, 純銀, Egyptian
 * cartouches, London date letter i = 1824) — see the same CHANGELOG entry.
 * ⛔ Keep captions to what the photo shows; do not add maker attributions
 * that are not on the listing or the piece.
 */

type Bi = { en: string; es: string };
type BiPhoto = Omit<MarkPhoto, 'lead' | 'rest'> & { lead: Bi; rest: Bi };

interface Block {
  id: string;
  title: Bi;
  paras: Bi[];
  rule?: Bi;
  cols: 2 | 3;
  photos: BiPhoto[];
}

const BLOCKS: Block[] = [
  {
    id: 'plated',
    title: { en: '"EP" almost always means plated', es: '"EP" casi siempre significa chapado' },
    paras: [
      {
        en: 'EPNS is Electro-Plated Nickel Silver: a thin skin of real silver plated onto "nickel silver", an alloy of copper, nickel and zinc that contains no silver at all. EPBM is Electro-Plated Britannia Metal, the same idea over a softer tin alloy — common on Victorian and Edwardian teapots. EPGS (German silver), EP on its own, A1, "Silver Plate", "Quadruple Plate" and "Silver on Copper" all mean the same thing: base metal underneath.',
        es: 'EPNS es Electro-Plated Nickel Silver: una capa fina de plata real sobre "alpaca", una aleación de cobre, níquel y zinc que no contiene plata. EPBM es Electro-Plated Britannia Metal, la misma idea sobre una aleación de estaño más blanda — común en teteras victorianas y eduardianas. EPGS (plata alemana), EP a secas, A1, "Silver Plate", "Quadruple Plate" y "Silver on Copper" significan lo mismo: metal base debajo.',
      },
      {
        en: 'These pieces can be beautiful and useful, but the silver on them is measured in microns, so they have little melt value. We buy plated pieces for their pattern, maker and condition, not their weight.',
        es: 'Estas piezas pueden ser bellas y útiles, pero su plata se mide en micras, así que tienen poco valor de fundición. Compramos piezas chapadas por su patrón, fabricante y estado, no por su peso.',
      },
    ],
    rule: {
      en: 'Usually, not always. Victorian platers loved to stamp rows of little shields that look just like a real hallmark. Look for the words — EPNS, EPBM, EP — and for what is missing: plated ware never carries the British lion. And the letters E.P. can occasionally be a maker’s initials on a solid piece, which is exactly why we test.',
      es: 'Casi siempre, no siempre. Los chapadores victorianos estampaban filas de escuditos que imitan un sello real. Busque las letras — EPNS, EPBM, EP — y lo que falta: la vajilla chapada nunca lleva el león británico. Y las letras E.P. pueden ser, de vez en cuando, las iniciales de un fabricante en una pieza maciza — justo por eso hacemos pruebas.',
    },
    cols: 2,
    photos: [
      { key: 'ebay-epns-crafton', lead: { en: 'E.P.N.S. · Made in Sheffield', es: 'E.P.N.S. · Made in Sheffield' }, rest: { en: '— the standard British plate mark under a teapot.', es: '— el sello británico estándar de chapado bajo una tetera.' } },
      { key: 'ebay-epbm-dixon-v2', lead: { en: 'EPBM', es: 'EPBM' }, rest: { en: '— James Dixon & Sons, Sheffield, with the pattern number: plated Britannia metal.', es: '— James Dixon & Sons, Sheffield, con el número de patrón: metal Britannia chapado.' } },
      { key: 'ebay-pseudo-dixon-row', lead: { en: 'Pseudo-hallmarks:', es: 'Pseudo-sellos:' }, rest: { en: 'a plater’s row — J.D.&S, the trumpet, then shields shaped like sterling marks. No lion, no sterling.', es: 'la fila de un chapador — J.D.&S, la trompeta y luego escudos con forma de sellos de esterlina. Sin león, no es esterlina.' } },
      { key: 'ebay-pseudo-wbco', lead: { en: 'W.B. & Co', es: 'W.B. & Co' }, rest: { en: 'and four fake "hallmarks" on a plated teapot base — the words are what count.', es: 'y cuatro "sellos" falsos en la base de una tetera chapada — lo que cuenta son las letras.' } },
      { key: 'ebay-ep-a1-fletcher', lead: { en: 'EP · A1', es: 'EP · A1' }, rest: { en: '— "A1" is a plating-quality grade, not a purity.', es: '— "A1" es un grado de calidad del chapado, no una pureza.' } },
      { key: 'ebay-quadruple-meriden', lead: { en: 'Quadruple Plate', es: 'Quadruple Plate' }, rest: { en: '— the American plate mark (Meriden B. Company).', es: '— el sello americano de chapado (Meriden B. Company).' } },
    ],
  },
  {
    id: 'lion',
    title: { en: 'The British lion', es: 'El león británico' },
    paras: [
      {
        en: 'A small walking lion — the lion passant — has been the English mark for sterling since the 1500s. It is struck by an assay office only after the metal is tested, which makes it one of the most trustworthy marks in the world. It sits in a row with the others: the maker’s initials, the assay office (a leopard’s head for London, an anchor for Birmingham, a crown or rose for Sheffield), and a date letter that changes every year, which lets us date a piece to a twelve-month window.',
        es: 'Un pequeño león andante — el lion passant — es el sello inglés de la esterlina desde el siglo XVI. Lo estampa una oficina de ensaye solo después de probar el metal, lo que lo convierte en uno de los sellos más confiables del mundo. Va en fila con los demás: las iniciales del fabricante, la oficina de ensaye (una cabeza de leopardo para Londres, un ancla para Birmingham, una corona o rosa para Sheffield) y una letra de fecha que cambia cada año, lo que nos permite fechar una pieza dentro de doce meses.',
      },
      {
        en: 'Scottish silver uses its own standard marks — Edinburgh a thistle, Glasgow a lion rampant (rearing up) — so a lion on its hind legs is still sterling, just not English. A figure of Britannia in place of the lion means the higher 95.8% "Britannia" standard.',
        es: 'La plata escocesa usa sus propios sellos — Edimburgo un cardo, Glasgow un león rampante (erguido) — así que un león sobre las patas traseras sigue siendo esterlina, solo que no inglesa. Una figura de Britannia en lugar del león indica el estándar superior "Britannia" de 95.8%.',
      },
    ],
    cols: 3,
    photos: [
      { key: 'own-london-1824-v2', shop: true, lead: { en: 'London, 1824.', es: 'Londres, 1824.' }, rest: { en: 'Lion passant · leopard’s head (London) · date letter i · maker Edward Farrell.', es: 'Lion passant · cabeza de leopardo (Londres) · letra de fecha i · fabricante Edward Farrell.' } },
      { key: 'own-london-1824-base', shop: true, lead: { en: 'The same Georgian mug,', es: 'La misma jarra georgiana,' }, rest: { en: 'base up — where to look.', es: 'boca abajo — dónde mirar.' } },
      { key: 'own-birmingham-salts-v2', shop: true, lead: { en: 'Birmingham.', es: 'Birmingham.' }, rest: { en: 'Maker · anchor · lion passant · date letter, on a pair of salt cellars.', es: 'Fabricante · ancla · lion passant · letra de fecha, en un par de saleros.' } },
    ],
  },
  {
    id: 'sterling',
    title: { en: '"Sterling" — the American way', es: '"Sterling" — a la americana' },
    paras: [
      {
        en: 'American silver was never hallmarked by an assay office. The maker stamps the word STERLING (92.5% silver) beside its own trademark, and since 1906 that word has been legally binding. So on American pieces the trademark is the thing to read: Gorham’s lion-anchor-G, Reed & Barton, Kirk, Tiffany, Wallace, and the retailers — a Philadelphia jeweler like J.E. Caldwell stamped its own name next to the maker’s.',
        es: 'La plata americana nunca fue contrastada por una oficina de ensaye. El fabricante estampa la palabra STERLING (92.5% de plata) junto a su propia marca, y desde 1906 esa palabra es legalmente vinculante. Así que en las piezas americanas lo que hay que leer es la marca: el león-ancla-G de Gorham, Reed & Barton, Kirk, Tiffany, Wallace y los minoristas — una joyería de Filadelfia como J.E. Caldwell estampaba su propio nombre junto al del fabricante.',
      },
      {
        en: 'Before "sterling" became the standard, American silversmiths worked to the coin standard (about 90% silver, the purity of melted coins) and marked pieces only with their name. Pattern numbers and dates ("PAT’D 1900") often sit under the word.',
        es: 'Antes de que "sterling" fuera el estándar, los plateros americanos trabajaban al estándar "coin" (alrededor de 90% de plata, la pureza de las monedas fundidas) y marcaban las piezas solo con su nombre. Los números de patrón y las fechas ("PAT’D 1900") suelen ir debajo de la palabra.',
      },
    ],
    cols: 2,
    photos: [
      { key: 'own-gorham', shop: true, lead: { en: 'Gorham:', es: 'Gorham:' }, rest: { en: 'lion · anchor · G, STERLING, PAT’D 1900 — on a fish server.', es: 'león · ancla · G, STERLING, PAT’D 1900 — en una pala de pescado.' } },
      { key: 'own-reed-barton-v2', shop: true, lead: { en: 'Reed & Barton:', es: 'Reed & Barton:' }, rest: { en: 'trademark · STERLING · X957 · Windsor — the pattern name.', es: 'marca · STERLING · X957 · Windsor — el nombre del patrón.' } },
      { key: 'own-caldwell', shop: true, lead: { en: 'J.E. Caldwell & Co', es: 'J.E. Caldwell & Co' }, rest: { en: '— a Philadelphia retailer’s mark on a mote spoon.', es: '— la marca de un minorista de Filadelfia en una cuchara colador.' } },
      { key: 'own-coin-silver', shop: true, lead: { en: 'Ball, Tompkins & Black · New York', es: 'Ball, Tompkins & Black · New York' }, rest: { en: '— 1840s coin silver; no "sterling" yet.', es: '— plata "coin" de la década de 1840; todavía sin "sterling".' } },
      { key: 'own-gorham-word', shop: true, lead: { en: 'GORHAM STERLING', es: 'GORHAM STERLING' }, rest: { en: 'in plain letters on a cold-meat fork.', es: 'en letras sencillas en un tenedor de servir.' } },
    ],
  },
  {
    id: 'numbers',
    title: { en: '925 and the other numbers', es: '925 y los otros números' },
    paras: [
      {
        en: 'Most of the world marks purity as parts per thousand. 925 is sterling; 800, 830, 835 and 900 are the lower continental standards; 950 is the French first standard and 958 is Britannia. The number is what matters for melt value — an 800 piece contains about 13% less silver than sterling of the same weight.',
        es: 'La mayor parte del mundo marca la pureza en milésimas. 925 es esterlina; 800, 830, 835 y 900 son los estándares continentales inferiores; 950 es el primer título francés y 958 es Britannia. El número es lo que importa para el valor de fundición — una pieza 800 contiene alrededor de 13% menos plata que una esterlina del mismo peso.',
      },
      {
        en: 'Mexican silver adds a registration mark: an eagle with a number on older pieces, and since 1980 a letter-and-number code such as TU-62 for a Taxco workshop. Norwegian and Danish silver adds an S after the number (925S, 830S). A piece that mixes metals is marked for each — a sterling bracelet with 14K gold accents carries both 925 and 585.',
        es: 'La plata mexicana añade un registro: un águila con número en piezas antiguas y, desde 1980, un código de letras y números como TU-62 para un taller de Taxco. La plata noruega y danesa añade una S tras el número (925S, 830S). Una pieza que mezcla metales se marca por cada uno — una pulsera de esterlina con detalles en oro de 14K lleva 925 y 585.',
      },
    ],
    cols: 2,
    photos: [
      { key: 'own-mexico-925', shop: true, lead: { en: 'MEXICO · TU-62 · 925', es: 'MEXICO · TU-62 · 925' }, rest: { en: '— a Taxco workshop code on a conch-shell brooch.', es: '— código de taller de Taxco en un broche de caracola.' } },
      { key: 'own-925-ring', shop: true, lead: { en: '925', es: '925' }, rest: { en: 'with maker’s initials inside an Art Deco-style ring.', es: 'con iniciales del fabricante dentro de un anillo estilo Art Déco.' } },
      { key: 'own-yurman-925-v2', shop: true, lead: { en: 'D.Y. 925', es: 'D.Y. 925' }, rest: { en: '— the sterling body of a David Yurman bracelet…', es: '— el cuerpo de esterlina de una pulsera David Yurman…' } },
      { key: 'own-yurman-585-v2', shop: true, lead: { en: '…and D.Y. 585', es: '…y D.Y. 585' }, rest: { en: 'on the same piece: its 14K gold accents.', es: 'en la misma pieza: sus detalles en oro de 14K.' } },
    ],
  },
  {
    id: 'world',
    title: { en: 'Less common and world marks', es: 'Sellos menos comunes y del mundo' },
    paras: [
      {
        en: 'Some countries use a symbol instead of, or as well as, a number. Denmark’s three towers (the arms of Copenhagen) guaranteed at least 826 silver until 1961, when 830S and 925S took over; a Georg Jensen stamp is both a designer’s mark and a value mark. Japan’s 純銀 (jungin, "pure silver") promises fine silver near 999. Egyptian silver carries three small cartouches: the standard in Arabic numerals, an Arabic date letter, and a national mark — a cat on earlier pieces, a lotus flower later.',
        es: 'Algunos países usan un símbolo en lugar de un número, o además de él. Las tres torres de Dinamarca (el escudo de Copenhague) garantizaban al menos 826 de plata hasta 1961, cuando pasaron a 830S y 925S; un sello Georg Jensen es a la vez marca de diseñador y de valor. El 純銀 japonés (jungin, "plata pura") promete plata fina cercana a 999. La plata egipcia lleva tres cartuchos pequeños: el título en números árabes, una letra de fecha árabe y una marca nacional — un gato en piezas antiguas, una flor de loto después.',
      },
      {
        en: 'The French Minerva head guarantees 950 (a small "2" beside her means 800). Germany has used a crescent moon and crown with the fineness since 1888. Italian silver since 1968 carries a star with a maker number and province code. Scandinavian pieces read 830S.',
        es: 'La cabeza de Minerva francesa garantiza 950 (un "2" pequeño a su lado significa 800). Alemania usa una luna creciente y una corona con el título desde 1888. La plata italiana desde 1968 lleva una estrella con número de fabricante y código de provincia. Las piezas escandinavas dicen 830S.',
      },
      {
        en: 'These are a small fraction of the marks that exist — thousands of makers, cities and standards across four centuries, many of them look-alikes. Identifying one properly takes a trained eye and the reference books, and more often than not a first attempt at home lands on the wrong maker, the wrong country, or plate mistaken for sterling. That is exactly what we are here for: when a stamp is worn or unfamiliar, we find it in the references, and the metal itself settles the rest.',
        es: 'Estos son una pequeña fracción de los sellos que existen — miles de fabricantes, ciudades y estándares a lo largo de cuatro siglos, muchos muy parecidos entre sí. Identificar uno correctamente requiere un ojo entrenado y los libros de referencia, y la mayoría de las veces un primer intento en casa termina en el fabricante equivocado, el país equivocado o chapado confundido con esterlina. Para eso estamos: cuando un sello está gastado o es desconocido, lo buscamos en las referencias y el metal mismo decide el resto.',
      },
    ],
    cols: 2,
    photos: [
      { key: 'own-danish-towers', tall: true, shop: true, lead: { en: 'Three towers', es: 'Tres torres' }, rest: { en: '(Copenhagen) beside the maker — Gran & Laglye, Denmark.', es: '(Copenhague) junto al fabricante — Gran & Laglye, Dinamarca.' } },
      { key: 'own-jensen', tall: true, shop: true, lead: { en: 'GEORG JENSEN · DENMARK', es: 'GEORG JENSEN · DENMARK' }, rest: { en: 'on an Acorn-pattern knife.', es: 'en un cuchillo del patrón Acorn.' } },
      { key: 'own-japan-jungin', tall: true, shop: true, lead: { en: '純銀', es: '純銀' }, rest: { en: '— jungin, Japanese fine silver, on a tazza.', es: '— jungin, plata fina japonesa, en una tazza.' } },
      { key: 'own-egypt', tall: true, shop: true, lead: { en: 'Egyptian cartouches:', es: 'Cartuchos egipcios:' }, rest: { en: 'standard · date letter · national mark, on an engraved tray.', es: 'título · letra de fecha · marca nacional, en una bandeja grabada.' } },
      { key: 'ebay-minerva', tall: true, lead: { en: 'Minerva head', es: 'Cabeza de Minerva' }, rest: { en: '— French 950, beside the maker’s lozenge.', es: '— 950 francés, junto al rombo del fabricante.' } },
      { key: 'ebay-german-835', tall: true, lead: { en: '835 · crescent & crown', es: '835 · luna y corona' }, rest: { en: '— German, with the maker’s mark.', es: '— alemán, con la marca del fabricante.' } },
      { key: 'ebay-italy-800', tall: true, lead: { en: '800', es: '800' }, rest: { en: 'with the Italian star and maker number (Milan).', es: 'con la estrella italiana y el número de fabricante (Milán).' } },
      { key: 'ebay-830s', tall: true, lead: { en: '830 S', es: '830 S' }, rest: { en: '— Scandinavian standard silver, with the maker’s marks.', es: '— plata escandinava estándar, con las marcas del fabricante.' } },
    ],
  },
];

export default function SilverMarksSection({ locale }: { locale: string }) {
  const isEs = locale === 'es';
  const t = (b: Bi) => (isEs ? b.es : b.en);
  const labels = isEs
    ? { expand: 'Ampliar foto', close: 'Cerrar', fromShop: 'de nuestra tienda', hint: 'Toque o haga clic en cualquier foto para ampliarla' }
    : { expand: 'Expand photo', close: 'Close', fromShop: 'from our shop', hint: 'Tap or click any photo to expand it' };

  return (
    <section
      id="silver-marks"
      className="ultrawide-page mx-auto max-w-[1440px] px-4 py-20 md:px-8"
      aria-labelledby="silver-marks-heading"
    >
      <p
        className="flex items-center gap-3 text-[0.65rem] font-bold uppercase tracking-[0.32em]"
        style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}
      >
        <span aria-hidden="true" className="inline-block h-px w-8 flex-shrink-0" style={{ background: 'var(--color-primary)' }} />
        {isEs ? 'Sellos de plata, explicados' : 'Silver marks, explained'}
      </p>
      <h2
        id="silver-marks-heading"
        className="mt-4 text-3xl font-bold md:text-4xl"
        style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}
      >
        {isEs ? 'Cómo Leer los Sellos de su Plata' : 'Reading the Marks on Your Silver'}
      </h2>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>
        {isEs
          ? 'Casi toda pieza de plata lleva un sello en alguna parte — bajo la base, detrás de un asa, dentro de un borde. Esos pocos milímetros nos dicen de qué está hecha la pieza, muchas veces dónde y cuándo se hizo, y a veces quién la hizo. La mayoría de los sellos de abajo están en piezas que pasaron por nuestro propio mostrador. Toque cualquier foto para verla completa.'
          : 'Almost every piece of silver carries a stamp somewhere — under the base, on the back of a handle, inside a rim. Those few millimetres tell us what the piece is made of, often where and when it was made, and sometimes who made it. Most of the marks below are on pieces that came across our own counter. Tap any photo to see the whole thing.'}
      </p>
      <div
        className="mt-4 max-w-2xl rounded-r-lg border-l-[3px] bg-white px-4 py-3 text-sm leading-relaxed"
        style={{ borderColor: 'var(--color-primary)', color: 'var(--color-on-surface)' }}
      >
        <b style={{ color: 'var(--color-primary)' }}>{isEs ? 'Una regla antes que las demás:' : 'One rule before the rest:'}</b>{' '}
        {isEs
          ? 'un sello es una afirmación, no una prueba. Los sellos se desgastan, se falsifican y se copian de los reales. Primero leemos el sello y luego lo confirmamos con prueba ácida o XRF — así ninguna pieza se valora solo por un sello.'
          : 'a mark is a claim, not proof. Marks wear, get faked, and get copied from real ones. We read the mark first, then confirm it with an acid test or XRF — so a piece is never priced on a stamp alone.'}
      </div>
      <p className="mt-4 max-w-2xl text-[15px] leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>
        {isEs
          ? 'Los sellos vienen en todos los tamaños y variantes. El de una cucharita puede medir un milímetro, estar gastado casi hasta desaparecer, escondido bajo una pata o dentro de una tapa, o estampado dos veces y medio legible. Encontrarlos y leerlos es parte de lo que hacemos — traiga la pieza y buscamos el sello con usted.'
          : 'Marks come in every size and variation. The one on a teaspoon can be a millimetre tall, worn nearly smooth, hidden under a foot or inside a lid, or struck twice and half-legible. Finding and reading them is part of what we do — bring the piece and we will find the mark with you.'}
      </p>

      {BLOCKS.map((block, index) => (
        <div
          key={block.id}
          className={`grid gap-8 py-9 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1.4fr)] lg:gap-10 ${index > 0 ? 'border-t' : ''}`}
          style={{ borderColor: 'var(--color-outline-variant)' }}
        >
          <div>
            <h3 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}>
              {t(block.title)}
            </h3>
            {block.paras.map((p, i) => (
              <p key={i} className="mt-3 text-[15px] leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>
                {t(p)}
              </p>
            ))}
            {block.rule && (
              <div
                className="mt-4 rounded-r-lg border-l-[3px] bg-white px-4 py-3 text-sm leading-relaxed"
                style={{ borderColor: 'var(--color-primary)', color: 'var(--color-on-surface)' }}
              >
                {t(block.rule)}
              </div>
            )}
          </div>
          <MarkGallery
            cols={block.cols}
            labels={labels}
            photos={block.photos.map((p) => ({ key: p.key, tall: p.tall, shop: p.shop, lead: t(p.lead), rest: t(p.rest) }))}
          />
        </div>
      ))}

      <div className="mt-2 flex flex-wrap gap-3">
        <Link href={isEs ? '/es/free-evaluation' : '/free-evaluation'} className="gold-button">
          {isEs ? 'Evaluación gratuita de plata' : 'Free silver evaluation'}
        </Link>
        <Link href={isEs ? '/es/jewelry-appraisal/hallmarks' : '/jewelry-appraisal/hallmarks'} className="outline-button">
          {isEs ? 'Guía completa de sellos →' : 'Full hallmarks guide →'}
        </Link>
      </div>
    </section>
  );
}
