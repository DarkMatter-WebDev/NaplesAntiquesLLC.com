// Service-area (city) data powering the buy-side local landing pages at
// /sell and /sell/[city]. These pages target "sell gold / jewelry / sterling
// silver <city>" and "<thing> buyers <city>" searches across Southwest Florida.
//
// Each city carries a unique intro + nearby-area list so the pages are locally
// differentiated rather than boilerplate. The shared "what we buy" and FAQ copy
// is templated with the city name in the page component.

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
  /** How we reach this city (English) — reinforces the mobile service model. */
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
      'Naples is our home base — the owner was born and raised here with 15+ years buying gold, estate jewelry, and sterling silver from local families. Whether you are downsizing in Old Naples, settling an estate in Pelican Bay, or clearing a jewelry box in North Naples, you get an honest, private, top-dollar offer.',
    introEs:
      'Naples es nuestra base — el dueño nació y creció aquí con más de 15 años comprando oro, joyería de patrimonio y plata esterlina a familias locales. Ya sea que esté reduciendo su hogar en Old Naples, liquidando un patrimonio en Pelican Bay o vaciando un joyero en North Naples, recibe una oferta honesta, privada y al mejor precio.',
    travelEn: 'We offer same-day, in-home appointments throughout Naples.',
    travelEs: 'Ofrecemos citas el mismo día, a domicilio, en todo Naples.',
  },
  {
    slug: 'marco-island',
    city: 'Marco Island',
    region: 'FL',
    nearby: ['Marco Island', 'Isles of Capri', 'Goodland', 'Hideaway Beach'],
    introEn:
      'Marco Island sellers do not need to drive off-island to get a fair price. We come to you across Marco, the Isles of Capri, and Goodland to buy gold, jewelry, and sterling silver privately and pay on the spot.',
    introEs:
      'Los vendedores de Marco Island no necesitan salir de la isla para obtener un precio justo. Vamos a usted en Marco, Isles of Capri y Goodland para comprar oro, joyería y plata esterlina de forma privada y pagar en el acto.',
    travelEn: 'We travel to Marco Island for private, by-appointment visits.',
    travelEs: 'Viajamos a Marco Island para visitas privadas con cita.',
  },
  {
    slug: 'bonita-springs',
    city: 'Bonita Springs',
    region: 'FL',
    nearby: ['Bonita Springs', 'Bonita Beach', 'Barefoot Beach', 'Spring Creek', 'Pelican Landing'],
    introEn:
      'Bonita Springs residents get the same expert evaluation and top-dollar offers we are known for in Naples — no pawn-shop lowballs. We meet you at home in Bonita Springs, Bonita Beach, and the Barefoot Beach communities to buy gold, jewelry, and silver.',
    introEs:
      'Los residentes de Bonita Springs reciben la misma evaluación experta y ofertas al mejor precio por las que somos conocidos en Naples — sin las ofertas bajas de las casas de empeño. Nos reunimos con usted en casa en Bonita Springs, Bonita Beach y Barefoot Beach para comprar oro, joyería y plata.',
    travelEn: 'We travel to Bonita Springs for private, by-appointment visits.',
    travelEs: 'Viajamos a Bonita Springs para visitas privadas con cita.',
  },
  {
    slug: 'estero',
    city: 'Estero',
    region: 'FL',
    nearby: ['Estero', 'Miromar Lakes', 'Grandezza', 'Coconut Point', 'The Brooks'],
    introEn:
      'Between Naples and Fort Myers, Estero sellers often settle for whatever the nearest gold-buying counter offers. We give you a better option: a private, no-pressure appointment at home in Estero, Miromar Lakes, or Grandezza with a genuine top-dollar offer for your gold, jewelry, and sterling.',
    introEs:
      'Entre Naples y Fort Myers, los vendedores de Estero a menudo aceptan lo que ofrece el mostrador de compra de oro más cercano. Le damos una mejor opción: una cita privada y sin presión en casa en Estero, Miromar Lakes o Grandezza con una oferta genuina al mejor precio por su oro, joyería y plata.',
    travelEn: 'We travel to Estero for private, by-appointment visits.',
    travelEs: 'Viajamos a Estero para visitas privadas con cita.',
  },
  {
    slug: 'fort-myers',
    city: 'Fort Myers',
    region: 'FL',
    nearby: ['Fort Myers', 'Fort Myers Beach', 'McGregor', 'Gateway', 'Iona', 'San Carlos Park'],
    introEn:
      'Fort Myers has plenty of gold-buying storefronts — but a private appraisal from a 15-year specialist almost always beats a walk-up counter offer. We come to you across Fort Myers, McGregor, Gateway, and Fort Myers Beach to buy gold, estate jewelry, and sterling silver at fair, transparent numbers.',
    introEs:
      'Fort Myers tiene muchas tiendas de compra de oro — pero una evaluación privada de un especialista con 15 años de experiencia casi siempre supera una oferta de mostrador. Vamos a usted en Fort Myers, McGregor, Gateway y Fort Myers Beach para comprar oro, joyería de patrimonio y plata esterlina con números justos y transparentes.',
    travelEn: 'We travel to Fort Myers for private, by-appointment visits.',
    travelEs: 'Viajamos a Fort Myers para visitas privadas con cita.',
  },
  {
    slug: 'cape-coral',
    city: 'Cape Coral',
    region: 'FL',
    nearby: ['Cape Coral', 'Pine Island', 'Matlacha', 'North Fort Myers', 'Burnt Store'],
    introEn:
      'Cape Coral sellers get a discreet, top-dollar buyer who travels across the bridge to them — no need to haul valuables to a pawn shop. We buy gold, jewelry, and sterling silver at home throughout Cape Coral, Pine Island, and North Fort Myers.',
    introEs:
      'Los vendedores de Cape Coral obtienen un comprador discreto y al mejor precio que cruza el puente hasta usted — sin necesidad de llevar objetos de valor a una casa de empeño. Compramos oro, joyería y plata esterlina a domicilio en Cape Coral, Pine Island y North Fort Myers.',
    travelEn: 'We travel to Cape Coral for private, by-appointment visits.',
    travelEs: 'Viajamos a Cape Coral para visitas privadas con cita.',
  },
];

export function getServiceArea(slug: string): ServiceArea | undefined {
  return SERVICE_AREAS.find((a) => a.slug === slug);
}
