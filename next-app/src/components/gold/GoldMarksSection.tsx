import Link from 'next/link';
import MarkGallery, { type MarkPhoto } from '@/components/silver/MarkGallery';

/**
 * "Reading the Marks on Your Gold" — the gold twin of `SilverMarksSection`,
 * rendered by /gold-services/gold-marks (owner request 2026-09-06; mockup
 * approved). Same shape: intro + rule box, five blocks with click-to-expand
 * photo grids (`MarkGallery` with `dir` pointed at the gold folder), closing
 * paragraphs and two buttons.
 *
 * Photo sources (`public/assets/images/pages/gold-marks/`):
 * - `own-*`  — the shop's own product photos (5 marks; inventory numbers in
 *   `project-docs/CHANGELOG.md` 2026-09-06 night).
 * - `ebay-*` — eBay sold-listing photos, found the way the owner asked:
 *   search the item ("14k gold", "9ct gold", "gold filled"…), then dig through
 *   each listing's gallery for the stamp close-up. Listing + image URLs are
 *   recorded in the same CHANGELOG entry so any photo can be swapped.
 *
 * ⚠️ Framing rules (same as the hallmarks page and the gold-worth guide):
 * 14KP = plumb, never "plated"; 9ct is real gold below the US 10K minimum;
 * GF / RGP / HGE / vermeil / "24K plated" are layers and are not bought as
 * gold; dental gold is sent out for testing before purchase; no buyer margin
 * is ever stated. ⛔ Keep captions to what the photo shows.
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
    id: 'karat',
    title: { en: 'K is a fraction of 24', es: 'K es una fracción de 24' },
    paras: [
      {
        en: 'American gold is marked in karats: pure gold is 24K, so 14K is 14 parts gold in 24 — 58.3%. 10K (41.7%) is the lowest that can legally be sold as gold in the United States; 14K is the everyday standard, 18K (75%) the fine-jewelry standard, and 24K is bullion. The stamp is usually inside a ring, on the clasp tongue of a bracelet, or on the back of a pendant beside the maker’s name.',
        es: 'El oro americano se marca en quilates: el oro puro es 24K, así que 14K son 14 partes de oro en 24 — 58.3%. 10K (41.7%) es el mínimo que puede venderse legalmente como oro en Estados Unidos; 14K es el estándar de todos los días, 18K (75%) el de la joyería fina, y 24K es lingote. El sello suele estar dentro del anillo, en la lengüeta del cierre de una pulsera, o en el reverso de un colgante junto al nombre del fabricante.',
      },
      {
        en: 'A "P" after the karat — 14KP, 18KP — means plumb: the gold content is exactly what the stamp says, not a rounded-up minimum. It is the mark sellers misread most often. The P is not "plated".',
        es: 'Una "P" después del quilate — 14KP, 18KP — significa plumb: el contenido de oro es exactamente el que dice el sello, no un mínimo redondeado. Es el sello que más se malinterpreta. La P no significa "plated" (chapado).',
      },
    ],
    cols: 3,
    photos: [
      { key: 'own-disney-14k', lead: { en: '© WALT DISNEY PRODS. 14K', es: '© WALT DISNEY PRODS. 14K' }, rest: { en: '— karat and maker together on the back of a charm.', es: '— quilate y fabricante juntos en el reverso de un dije.' }, shop: true },
      { key: 'own-tennis-14k', lead: { en: '14K', es: '14K' }, rest: { en: 'on the clasp tongue of a tennis bracelet — the usual place on a bracelet.', es: 'en la lengüeta del cierre de una pulsera tennis — el lugar habitual en una pulsera.' }, shop: true },
      { key: 'own-cuban-10k', lead: { en: '10K', es: '10K' }, rest: { en: 'on the box clasp of a heavy Cuban link — the lowest American gold standard.', es: 'en el cierre de caja de una cadena cubana pesada — el estándar americano más bajo.' }, shop: true },
      { key: 'ebay-10k-band', lead: { en: '10K', es: '10K' }, rest: { en: 'inside a plain rose-gold band.', es: 'dentro de un aro liso de oro rosa.' } },
      { key: 'ebay-kp-truglo', lead: { en: 'TRUGLO △ 14KP', es: 'TRUGLO △ 14KP' }, rest: { en: '— maker, trademark and a plumb karat inside a cluster ring.', es: '— fabricante, marca registrada y un quilate plumb dentro de un anillo de racimo.' } },
      { key: 'ebay-kp-nugget', lead: { en: '14KP', es: '14KP' }, rest: { en: 'with a maker number inside a nugget ring — plumb, not plated.', es: 'con número de fabricante dentro de un anillo nugget — plumb, no chapado.' } },
    ],
  },
  {
    id: 'numbers',
    title: { en: 'Numbers: parts per thousand', es: 'Números: partes por mil' },
    paras: [
      {
        en: 'Most of the world marks gold by fineness in parts per thousand. 585 is 14K, 750 is 18K, 375 is 9K, 916 is 22K and 999 or 999.9 is pure. European makers, Italian chains and nearly every designer house use the number — often with "Au", the chemical symbol for gold, in front of it.',
        es: 'La mayor parte del mundo marca el oro por su ley en partes por mil. 585 es 14K, 750 es 18K, 375 es 9K, 916 es 22K y 999 o 999.9 es puro. Los fabricantes europeos, las cadenas italianas y casi todas las casas de diseño usan el número — muchas veces con "Au", el símbolo químico del oro, delante.',
      },
      {
        en: 'Italian gold adds a maker’s mark in a lozenge or a star beside the 750, and chains carry the number on the small tag at the clasp. Bullion bars stamp the fineness, the weight and a serial number on the bar itself; the sealed card is the certificate, not the mark.',
        es: 'El oro italiano añade la marca del fabricante en un rombo o una estrella junto al 750, y las cadenas llevan el número en la pequeña placa del cierre. Los lingotes llevan la ley, el peso y un número de serie estampados en el propio lingote; la tarjeta sellada es el certificado, no el sello.',
      },
    ],
    cols: 3,
    photos: [
      { key: 'own-yurman-585', lead: { en: '585', es: '585' }, rest: { en: '— 14K written as a fineness, on a David Yurman two-tone piece.', es: '— 14K escrito como ley, en una pieza bicolor de David Yurman.' }, shop: true },
      { key: 'ebay-dy-750', lead: { en: '© D.Y. 750', es: '© D.Y. 750' }, rest: { en: '— David Yurman 18K, stamped on the inside of a ring.', es: '— David Yurman 18K, estampado en el interior de un anillo.' } },
      { key: 'ebay-italy-750-medal', lead: { en: '750', es: '750' }, rest: { en: 'in a lozenge with an Italian maker’s mark on the back of a medal.', es: 'en un rombo con la marca de un fabricante italiano en el reverso de una medalla.' } },
      { key: 'ebay-italy-750-tag', lead: { en: 'ITALY · 750', es: 'ITALY · 750' }, rest: { en: 'on the tag beside the clasp — where a chain’s mark almost always lives.', es: 'en la placa junto al cierre — donde casi siempre está el sello de una cadena.' } },
      { key: 'ebay-375-tag', lead: { en: '375', es: '375' }, rest: { en: '— 9K, with a row of British hallmarks on the link below it.', es: '— 9K, con una fila de sellos británicos en el eslabón de abajo.' } },
      { key: 'ebay-tag-au750', lead: { en: 'Au750', es: 'Au750' }, rest: { en: '— the chemical symbol plus the fineness, on a chain tag.', es: '— el símbolo químico más la ley, en la placa de una cadena.' } },
      { key: 'ebay-9999-bar', lead: { en: '999.9 Fine Gold', es: '999.9 Fine Gold' }, rest: { en: '— a 100 g Argor-Heraeus bar: weight, fineness and serial number struck into the bar.', es: '— un lingote Argor-Heraeus de 100 g: peso, ley y número de serie estampados en el lingote.' } },
    ],
  },
  {
    id: 'layer',
    title: { en: 'A gold layer is not gold', es: 'Una capa de oro no es oro' },
    paras: [
      {
        en: 'The marks that cause the most disappointment are the ones with a karat on them that describe a coating. Gold-filled (GF) is a sheet of karat gold bonded over brass — legally at least 1/20th of the weight, and the fraction is usually stamped: 1/20 12K GF, 1/10 10K GF. Rolled gold plate (RGP) is the same idea, thinner. HGE is heavy gold electroplate, a few microns thick. GP, GEP and "24K gold plated" are thinner still.',
        es: 'Los sellos que más decepcionan son los que llevan un quilate que describe un recubrimiento. Gold-filled (GF) es una lámina de oro de ley unida sobre latón — legalmente al menos 1/20 del peso, y la fracción suele estar estampada: 1/20 12K GF, 1/10 10K GF. Rolled gold plate (RGP) es la misma idea, más fina. HGE es electrochapado grueso, de unas pocas micras. GP, GEP y "24K gold plated" son aún más finos.',
      },
      {
        en: 'Vermeil is gold over sterling silver, so it carries a 925 mark — the silver is real, the gold is a layer. Old watch cases say it their own way: "Guaranteed 20 Years" on a case back means gold-filled, the years being how long the maker expected the layer to last.',
        es: 'El vermeil es oro sobre plata esterlina, así que lleva un sello 925 — la plata es real, el oro es una capa. Las cajas de reloj antiguas lo dicen a su manera: "Guaranteed 20 Years" en la tapa trasera significa gold-filled; los años son lo que el fabricante esperaba que durara la capa.',
      },
    ],
    rule: {
      en: 'We price by gold content. A gold-filled or plated piece has a few percent gold at most, so it is bought for what it is — the pattern, the maker, the watch inside — not as gold. Where the stamp is missing or ambiguous, the test tells us in seconds.',
      es: 'Valoramos por contenido de oro. Una pieza gold-filled o chapada tiene como mucho un pequeño porcentaje de oro, así que se compra por lo que es — el diseño, el fabricante, el reloj que lleva dentro — no como oro. Cuando el sello falta o es ambiguo, la prueba nos lo dice en segundos.',
    },
    cols: 3,
    photos: [
      { key: 'ebay-gf-goldfeather', lead: { en: '14K GOLD FILLED', es: '14K GOLD FILLED' }, rest: { en: 'on a Seiko Goldfeather case back — the karat describes the layer.', es: 'en la tapa de un Seiko Goldfeather — el quilate describe la capa.' } },
      { key: 'ebay-gf-avon', lead: { en: '1/10 10K GF', es: '1/10 10K GF' }, rest: { en: '— one tenth of the weight is 10K gold; the rest is base metal.', es: '— una décima parte del peso es oro de 10K; el resto es metal base.' } },
      { key: 'ebay-gf-waltham', lead: { en: 'GUARANTEED TWENTY YEARS', es: 'GUARANTEED TWENTY YEARS' }, rest: { en: '— a Waltham gold-filled case; the warranty is the mark.', es: '— una caja Waltham gold-filled; la garantía es el sello.' } },
      { key: 'ebay-hge-lindenwold', lead: { en: 'LINDENWOLD 14K HGE', es: 'LINDENWOLD 14K HGE' }, rest: { en: '— heavy gold electroplate on a costume ring.', es: '— electrochapado grueso en un anillo de bisutería.' } },
      { key: 'ebay-hge-lind', lead: { en: '14K HGE LIND', es: '14K HGE LIND' }, rest: { en: '— the Lind rings that arrive at the counter most often.', es: '— los anillos Lind que más llegan al mostrador.' } },
      { key: 'ebay-rolled-gold', lead: { en: '9CT ROLLED GOLD', es: '9CT ROLLED GOLD' }, rest: { en: 'inside a British bangle — rolled, not solid.', es: 'dentro de un brazalete británico — laminado, no macizo.' } },
      { key: 'ebay-vermeil-925', lead: { en: '925', es: '925' }, rest: { en: 'inside a gold-coloured ring: vermeil — sterling silver under a gold layer.', es: 'dentro de un anillo de color oro: vermeil — plata esterlina bajo una capa de oro.' } },
      { key: 'ebay-vermeil-tag', lead: { en: '.925', es: '.925' }, rest: { en: 'on the tag of a gold-coloured Cuban chain — the number tells the truth.', es: 'en la placa de una cadena cubana de color oro — el número dice la verdad.' } },
      { key: 'ebay-24k-plated', lead: { en: '24K GOLD PLATING', es: '24K GOLD PLATING' }, rest: { en: '— the highest karat on the label, and no gold value at all.', es: '— el quilate más alto en la etiqueta, y ningún valor en oro.' } },
    ],
  },
  {
    id: 'british',
    title: { en: 'British hallmarks', es: 'Sellos británicos' },
    paras: [
      {
        en: 'British gold has been hallmarked by an assay office for centuries, so a row of small marks is normal: the fineness (375 for 9ct, 585, 750, 916), an assay office — an anchor for Birmingham, a leopard’s head for London, a rose for Sheffield, a castle for Edinburgh — a maker’s initials, and often a date letter. Until 1999 gold also carried a crown.',
        es: 'El oro británico lleva siglos contrastado por una oficina de ensayo, así que una fila de sellos pequeños es normal: la ley (375 para 9ct, 585, 750, 916), una oficina de ensayo — un ancla para Birmingham, una cabeza de leopardo para Londres, una rosa para Sheffield, un castillo para Edimburgo — las iniciales del fabricante, y muchas veces una letra de fecha. Hasta 1999 el oro llevaba además una corona.',
      },
      {
        en: '9ct is real gold at 37.5% — the most common British standard and everyday jewelry across the Commonwealth — but it sits below the 10K American minimum, so it is priced on its actual gold content, not the karat.',
        es: '9ct es oro real al 37.5% — el estándar británico más común y la joyería de diario en toda la Commonwealth — pero está por debajo del mínimo americano de 10K, así que se valora por su contenido real de oro, no por el quilate.',
      },
    ],
    cols: 3,
    photos: [
      { key: 'ebay-9ct-clasp', lead: { en: '9ct', es: '9ct' }, rest: { en: 'with a full hallmark row struck on a chain clasp.', es: 'con la fila completa de sellos en el cierre de una cadena.' } },
      { key: 'ebay-375-ring', lead: { en: '375', es: '375' }, rest: { en: 'with maker and assay marks inside a 9ct ring.', es: 'con marcas de fabricante y de ensayo dentro de un anillo de 9ct.' } },
      { key: 'ebay-hallmark-bangle', lead: { en: 'Full hallmark row', es: 'Fila completa de sellos' }, rest: { en: 'on a torque bangle — maker, 375, assay office and date letter.', es: 'en un brazalete torque — fabricante, 375, oficina de ensayo y letra de fecha.' } },
    ],
  },
  {
    id: 'designer',
    title: { en: 'Designer marks and platinum', es: 'Sellos de diseñador y platino' },
    paras: [
      {
        en: 'The great houses sign their work, and the signature sits beside the fineness. Cartier stamps its name, the ring size, Au 750 and a serial number; Tiffany & Co. its name and 750 — sometimes with the country it was made in, or a designer’s signature like Elsa Peretti’s; two-tone pieces carry both metals, 925 and 750. A signed piece can be worth far more than its gold, which is why we check every signature against the collector market before we weigh it.',
        es: 'Las grandes casas firman su trabajo, y la firma va junto a la ley. Cartier estampa su nombre, la talla del anillo, Au 750 y un número de serie; Tiffany & Co. su nombre y 750 — a veces con el país donde se hizo, o la firma de un diseñador como Elsa Peretti; las piezas bicolor llevan ambos metales, 925 y 750. Una pieza firmada puede valer mucho más que su oro, y por eso cotejamos cada firma con el mercado de coleccionistas antes de pesarla.',
      },
      {
        en: 'PT950, PLAT or 950 is platinum, not white gold — heavier, purer and priced on a different market. It is the mark sellers overlook most often on a white ring.',
        es: 'PT950, PLAT o 950 es platino, no oro blanco — más pesado, más puro y con un mercado distinto. Es el sello que más se pasa por alto en un anillo blanco.',
      },
    ],
    cols: 3,
    photos: [
      { key: 'own-tiffany-clasp-750', lead: { en: 'Tiffany & Co. 750', es: 'Tiffany & Co. 750' }, rest: { en: 'on the clasp tongue of an 18K tricolor bracelet.', es: 'en la lengüeta del cierre de una pulsera tricolor de 18K.' }, shop: true },
      { key: 'ebay-cartier-au750', lead: { en: '© Cartier 65 · Au 750', es: '© Cartier 65 · Au 750' }, rest: { en: '— name, size, fineness and a serial number (hidden here by the seller).', es: '— nombre, talla, ley y un número de serie (ocultado aquí por el vendedor).' } },
      { key: 'ebay-tiffany-peretti-750', lead: { en: 'Elsa Peretti · TIFFANY & CO. · 750 SPAIN', es: 'Elsa Peretti · TIFFANY & CO. · 750 SPAIN' }, rest: { en: '— designer signature, house and fineness.', es: '— firma del diseñador, casa y ley.' } },
      { key: 'ebay-tiffany-band-750', lead: { en: 'TIFFANY & CO. 750', es: 'TIFFANY & CO. 750' }, rest: { en: 'inside a plain band.', es: 'dentro de un aro liso.' } },
      { key: 'ebay-tiffany-925-750', lead: { en: '© 2003 TIFFANY & CO. 925 750', es: '© 2003 TIFFANY & CO. 925 750' }, rest: { en: '— both metals marked on a two-tone piece.', es: '— ambos metales marcados en una pieza bicolor.' } },
      { key: 'ebay-peretti-pt950', lead: { en: '© PERETTI PT950', es: '© PERETTI PT950' }, rest: { en: '— platinum, not white gold.', es: '— platino, no oro blanco.' } },
    ],
  },
];

export const GOLD_MARKS_DIR = '/assets/images/pages/gold-marks';

export default function GoldMarksSection({ locale }: { locale: string }) {
  const isEs = locale === 'es';
  const t = (b: Bi) => (isEs ? b.es : b.en);
  const labels = isEs
    ? { expand: 'Ampliar foto', close: 'Cerrar', fromShop: 'de nuestra tienda', hint: 'Toque o haga clic en cualquier foto para ampliarla' }
    : { expand: 'Expand photo', close: 'Close', fromShop: 'from our shop', hint: 'Tap or click any photo to expand it' };

  return (
    <section
      id="gold-marks"
      className="ultrawide-page mx-auto max-w-[1440px] px-4 py-20 md:px-8"
      aria-labelledby="gold-marks-heading"
    >
      <p
        className="flex items-center gap-3 text-[0.65rem] font-bold uppercase tracking-[0.32em]"
        style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}
      >
        <span aria-hidden="true" className="inline-block h-px w-8 flex-shrink-0" style={{ background: 'var(--color-primary)' }} />
        {isEs ? 'Sellos de oro, explicados' : 'Gold marks, explained'}
      </p>
      <h2
        id="gold-marks-heading"
        className="mt-4 text-3xl font-bold md:text-4xl"
        style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}
      >
        {isEs ? 'Cómo Leer los Sellos de su Oro' : 'Reading the Marks on Your Gold'}
      </h2>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>
        {isEs
          ? 'Casi toda joya de oro lleva un sello — dentro del anillo, en el cierre o en la placa de una cadena, en el reverso de un colgante. Esos pocos milímetros dicen cuánto oro tiene la pieza, y a veces quién la hizo y dónde. La mayoría de los sellos de abajo pasaron por nuestro propio mostrador o son de piezas como las que compramos cada semana. Toque cualquier foto para verla completa.'
          : 'Almost every piece of gold jewelry carries a stamp — inside the ring, on the clasp or the tag of a chain, on the back of a pendant. Those few millimetres say how much gold is in the piece, and sometimes who made it and where. Most of the marks below came across our own counter or from pieces like the ones we buy every week. Tap any photo to see the whole thing.'}
      </p>
      <div
        className="mt-4 max-w-2xl rounded-r-lg border-l-[3px] bg-white px-4 py-3 text-sm leading-relaxed"
        style={{ borderColor: 'var(--color-primary)', color: 'var(--color-on-surface)' }}
      >
        <b style={{ color: 'var(--color-primary)' }}>{isEs ? 'Una regla antes que las demás:' : 'One rule before the rest:'}</b>{' '}
        {isEs
          ? 'un sello es una afirmación, no una prueba. Piezas chapadas se estampan "14K" todos los días, y un anillo gastado o ajustado de talla puede haber perdido el sello por completo. Primero leemos el sello y luego lo confirmamos con prueba ácida o XRF — así ninguna pieza se valora solo por un sello, ni se rechaza por no tenerlo.'
          : 'a mark is a claim, not proof. Plated pieces get stamped "14K" every day, and a worn or resized ring may have lost its mark entirely. We read the stamp first, then confirm it with an acid test or XRF — so a piece is never priced on a stamp alone, and never turned away for lacking one.'}
      </div>
      <p className="mt-4 max-w-2xl text-[15px] leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>
        {isEs
          ? 'Los sellos son pequeños y fáciles de pasar por alto — un milímetro dentro de un aro, escondidos bajo la lengüeta de un cierre, estampados en la placa diminuta junto a un reasa, o gastados hasta ser una sombra tras cincuenta años en una mano. Encontrarlos y leerlos es parte de lo que hacemos — traiga la pieza y buscamos el sello con usted.'
          : 'Marks are small and easy to miss — a millimetre tall inside a band, hidden under a clasp tongue, struck on the tiny tag beside a spring ring, or worn to a shadow after fifty years on a hand. Finding and reading them is part of what we do — bring the piece and we will find the mark with you.'}
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
            dir={GOLD_MARKS_DIR}
            cols={block.cols}
            labels={labels}
            photos={block.photos.map((p) => ({ key: p.key, tall: p.tall, shop: p.shop, lead: t(p.lead), rest: t(p.rest) }))}
          />
        </div>
      ))}

      <div className="mt-2 max-w-2xl">
        <p className="text-[15px] leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>
          {isEs
            ? 'Sin sello no significa sin oro. Anillos antiguos, aros ajustados de talla, cadenas gastadas y piezas hechas a mano muchas veces no llevan nada — y el oro dental nunca lo lleva. Probamos las piezas sin sello igual que las marcadas. El oro dental se envía a analizar antes de la compra, porque su aleación no puede leerse en la tienda.'
            : 'No mark does not mean no gold. Older rings, resized bands, worn chains and handmade pieces often carry nothing at all — and dental gold never does. We test unmarked pieces the same way as marked ones. Dental gold is sent out for testing before purchase, because its alloy cannot be read in the shop.'}
        </p>
        <p className="mt-3 text-[15px] leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>
          {isEs
            ? 'Estos son una pequeña fracción de los sellos que existen — miles de fabricantes, estándares e imitaciones a lo largo de dos siglos. Identificar uno correctamente requiere un ojo entrenado y los libros de referencia, y la mayoría de las veces un primer intento en casa termina en chapado confundido con macizo, o una pieza firmada valorada como chatarra. Para eso estamos.'
            : 'These are a small fraction of the marks that exist — thousands of makers, standards and imitations across two centuries. Identifying one properly takes a trained eye and the reference books, and more often than not a first attempt at home lands on plated mistaken for solid, or a signed piece priced as scrap. That is exactly what we are here for.'}
        </p>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link href={isEs ? '/es/free-evaluation' : '/free-evaluation'} className="gold-button">
          {isEs ? 'Evaluación gratuita de oro' : 'Free gold evaluation'}
        </Link>
        <Link href={isEs ? '/es/gold-services/what-is-my-gold-worth' : '/gold-services/what-is-my-gold-worth'} className="outline-button">
          {isEs ? '¿Cuánto vale su oro? →' : 'What your gold is worth →'}
        </Link>
      </div>
    </section>
  );
}
