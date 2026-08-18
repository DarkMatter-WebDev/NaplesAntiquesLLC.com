// Service-area (city) data powering the buy-side local landing pages at
// /sell and /sell/[city]. These pages target "sell gold / jewelry / sterling
// silver <city>" and "<thing> buyers <city>" searches across Southwest Florida.
//
// Each city carries a unique intro + nearby-area list so the pages are locally
// differentiated rather than boilerplate. The shared "what we buy" and FAQ copy
// is templated with the city name in the page component.
//
// ⚠️ STORE-FIRST since 2026-08-17 (showroom opened; see DECISIONS, "The
// showroom is store-first"). Every string below used to lead with travel — "we
// come to you", "we meet you at home". They were REFRAMED, not deleted: these
// six pages rank largely on travel-to-you intent, and cutting that framing
// would gut them for no gain. The shape is now "come to the Naples showroom,
// and we still visit on request" — the showroom leads, the visit remains.
// Do not let a future edit swing it back to travel-first or strip travel out.

export interface ServiceArea {
  /** URL slug, e.g. 'fort-myers' → /sell/fort-myers */
  slug: string;
  /** Display city name, e.g. 'Fort Myers' */
  city: string;
  region: string; // 'FL'
  /** Neighborhoods / communities within or adjacent to the city. */
  nearby: string[];
  /** Unique 1–2 sentence intro (English). Weaves in local context. */
  introEn: string;
  /** Unique intro (Spanish). */
  introEs: string;
  /**
   * How this city reaches us (English): the showroom first, then the home
   * visit as the standing alternative. Named `travel*` for historical reasons —
   * it no longer means "we travel by default".
   */
  travelEn: string;
  travelEs: string;
}

export const SERVICE_AREAS: ServiceArea[] = [
  {
    slug: 'naples',
    city: 'Naples',
    region: 'FL',
    nearby: ['Old Naples', 'Park Shore', 'Pelican Bay', 'Aqualane Shores', 'North Naples', 'Golden Gate'],
    introEn:
      'Naples is our home base — the owner was born and raised here with 15+ years buying gold, estate jewelry, and sterling silver from local families. Bring your pieces to our North Naples showroom, or if you are downsizing in Old Naples, settling an estate in Pelican Bay, or clearing a jewelry box in Golden Gate, ask us to come to you. Either way you get an honest, private, top-dollar offer.',
    introEs:
      'Naples es nuestra base — el dueño nació y creció aquí con más de 15 años comprando oro, joyería de patrimonio y plata esterlina a familias locales. Traiga sus piezas a nuestro salón en North Naples o, si está reduciendo su hogar en Old Naples, liquidando un patrimonio en Pelican Bay o vaciando un joyero en Golden Gate, pídanos que vayamos a usted. En ambos casos recibe una oferta honesta, privada y al mejor precio.',
    travelEn: 'Our showroom is right here in Naples, and we still offer same-day in-home appointments across the city on request.',
    travelEs: 'Nuestro salón está aquí mismo en Naples, y seguimos ofreciendo citas a domicilio el mismo día en toda la ciudad a pedido.',
  },
  {
    slug: 'marco-island',
    city: 'Marco Island',
    region: 'FL',
    nearby: ['Marco Island', 'Isles of Capri', 'Goodland', 'Hideaway Beach'],
    introEn:
      'Marco Island sellers get a fair price without settling for the nearest counter. It is a short drive up to our Naples showroom, and for larger collections we still come to you across Marco, the Isles of Capri, and Goodland to buy gold, jewelry, and sterling silver privately and pay on the spot.',
    introEs:
      'Los vendedores de Marco Island obtienen un precio justo sin conformarse con el mostrador más cercano. Es un trayecto corto hasta nuestro salón en Naples y, para colecciones más grandes, seguimos yendo a usted en Marco, Isles of Capri y Goodland para comprar oro, joyería y plata esterlina de forma privada y pagar en el acto.',
    travelEn: 'Visit our Naples showroom, or ask for a private, by-appointment visit on Marco Island.',
    travelEs: 'Visite nuestro salón en Naples o solicite una visita privada con cita en Marco Island.',
  },
  {
    slug: 'bonita-springs',
    city: 'Bonita Springs',
    region: 'FL',
    nearby: ['Bonita Springs', 'Bonita Beach', 'Barefoot Beach', 'Spring Creek', 'Pelican Landing'],
    introEn:
      'Bonita Springs residents get the same expert evaluation and top-dollar offers we are known for in Naples — no pawn-shop lowballs. Bring your gold, jewelry, and silver down to our Naples showroom, or ask us to meet you at home in Bonita Springs, Bonita Beach, or the Barefoot Beach communities.',
    introEs:
      'Los residentes de Bonita Springs reciben la misma evaluación experta y ofertas al mejor precio por las que somos conocidos en Naples — sin las ofertas bajas de las casas de empeño. Traiga su oro, joyería y plata a nuestro salón en Naples o pídanos reunirnos con usted en casa en Bonita Springs, Bonita Beach o Barefoot Beach.',
    travelEn: 'Visit our Naples showroom, or ask for a private, by-appointment visit in Bonita Springs.',
    travelEs: 'Visite nuestro salón en Naples o solicite una visita privada con cita en Bonita Springs.',
  },
  {
    slug: 'estero',
    city: 'Estero',
    region: 'FL',
    nearby: ['Estero', 'Miromar Lakes', 'Grandezza', 'Coconut Point', 'The Brooks'],
    introEn:
      'Between Naples and Fort Myers, Estero sellers often settle for whatever the nearest gold-buying counter offers. We give you a better option: an unhurried appraisal at our Naples showroom, or a private, no-pressure appointment at home in Estero, Miromar Lakes, or Grandezza — with a genuine top-dollar offer for your gold, jewelry, and sterling.',
    introEs:
      'Entre Naples y Fort Myers, los vendedores de Estero a menudo aceptan lo que ofrece el mostrador de compra de oro más cercano. Le damos una mejor opción: una evaluación sin prisas en nuestro salón de Naples o una cita privada y sin presión en casa en Estero, Miromar Lakes o Grandezza — con una oferta genuina al mejor precio por su oro, joyería y plata.',
    travelEn: 'Visit our Naples showroom, or ask for a private, by-appointment visit in Estero.',
    travelEs: 'Visite nuestro salón en Naples o solicite una visita privada con cita en Estero.',
  },
  {
    slug: 'fort-myers',
    city: 'Fort Myers',
    region: 'FL',
    nearby: ['Fort Myers', 'Fort Myers Beach', 'McGregor', 'Gateway', 'Iona', 'San Carlos Park'],
    introEn:
      'Fort Myers has plenty of gold-buying storefronts — but a private appraisal from a 15-year specialist almost always beats a walk-up counter offer. Bring your pieces to our Naples showroom for an unhurried look, or ask us to come to you across Fort Myers, McGregor, Gateway, and Fort Myers Beach for fair, transparent numbers on gold, estate jewelry, and sterling silver.',
    introEs:
      'Fort Myers tiene muchas tiendas de compra de oro — pero una evaluación privada de un especialista con 15 años de experiencia casi siempre supera una oferta de mostrador. Traiga sus piezas a nuestro salón en Naples para verlas con calma o pídanos ir a usted en Fort Myers, McGregor, Gateway y Fort Myers Beach, con números justos y transparentes por oro, joyería de patrimonio y plata esterlina.',
    travelEn: 'Visit our Naples showroom, or ask for a private, by-appointment visit in Fort Myers.',
    travelEs: 'Visite nuestro salón en Naples o solicite una visita privada con cita en Fort Myers.',
  },
  {
    slug: 'cape-coral',
    city: 'Cape Coral',
    region: 'FL',
    nearby: ['Cape Coral', 'Pine Island', 'Matlacha', 'North Fort Myers', 'Burnt Store'],
    introEn:
      'Cape Coral sellers get a discreet, top-dollar buyer rather than a pawn-shop counter. Bring your gold, jewelry, and sterling silver to our Naples showroom, or — especially for a full estate — ask us to cross the bridge and meet you at home in Cape Coral, Pine Island, or North Fort Myers.',
    introEs:
      'Los vendedores de Cape Coral obtienen un comprador discreto y al mejor precio en lugar del mostrador de una casa de empeño. Traiga su oro, joyería y plata esterlina a nuestro salón en Naples o — sobre todo para un patrimonio completo — pídanos cruzar el puente y reunirnos con usted en casa en Cape Coral, Pine Island o North Fort Myers.',
    travelEn: 'Visit our Naples showroom, or ask for a private, by-appointment visit in Cape Coral.',
    travelEs: 'Visite nuestro salón en Naples o solicite una visita privada con cita en Cape Coral.',
  },
];

export function getServiceArea(slug: string): ServiceArea | undefined {
  return SERVICE_AREAS.find((a) => a.slug === slug);
}
