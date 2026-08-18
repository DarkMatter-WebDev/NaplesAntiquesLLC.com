// Curated customer testimonials — the single source for every surface that
// shows reviews (homepage section, product-page band). These are REAL Google
// reviews, quoted verbatim with the reviewer's public first/last name exactly
// as shown on Google; the Spanish strings are our translations of the same
// reviews. Never invent, embellish, or paraphrase a quote: add new entries
// only by pasting a real review's text.
//
// To add a review: append an object below — every surface updates together.

/**
 * Public Google Business Profile — the destination for every review card.
 * One constant because both surfaces that render reviews link to it; a second
 * copy would eventually point somewhere else.
 *
 * This is Google's `share.google` short form, supplied by the owner. It is an
 * opaque redirect, so nothing here can validate it — if the cards ever land
 * somewhere wrong, this line is the only thing to change.
 */
export const GOOGLE_REVIEWS_URL = 'https://share.google/KAE0mjQwhKx9EqEZ1';

export interface Testimonial {
  /** Reviewer's public name as displayed on Google. */
  name: string;
  quote: string;
  quoteEs: string;
  /** Attribution context, e.g. "Google review". */
  meta: string;
  metaEs: string;
}

export const TESTIMONIALS: Testimonial[] = [
  {
    name: 'Nolan Olivier',
    quote:
      'Chris is amazing! Worked with him selling some items. Got a fair and accurate price, and he had great communication while being fast and flexible to meet! Highly recommend and will be selling to him again.',
    quoteEs:
      '¡Chris es increíble! Trabajé con él vendiendo algunos artículos. Obtuve un precio justo y preciso, y tuvo una excelente comunicación, además de ser rápido y flexible para reunirse. ¡Muy recomendable y volveré a venderle!',
    meta: 'Google review',
    metaEs: 'Reseña de Google',
  },
  {
    name: 'Onur',
    quote: 'Chris is the best, he is always so professional when dealing with him!',
    quoteEs: 'Chris es el mejor, ¡siempre es muy profesional al tratar con él!',
    meta: 'Google Local Guide',
    metaEs: 'Guía Local de Google',
  },
  {
    name: 'Yisel Perez',
    quote:
      'Working with this company was an excellent experience. They offered me a significantly better price for my gold jewelry compared to other places where I had it appraised. Chris was incredibly helpful and took the time to explain everything in detail, which made me feel comfortable and confident throughout the process. I never felt rushed, and I truly appreciated the care and attention he provided. I highly recommend this company and will definitely be returning in the future. Thank you!',
    quoteEs:
      'Trabajar con esta empresa fue una experiencia excelente. Me ofrecieron un precio significativamente mejor por mi joyería de oro en comparación con otros lugares donde la había tasado. Chris fue increíblemente servicial y se tomó el tiempo de explicarme todo en detalle, lo que me hizo sentir cómoda y segura durante todo el proceso. Nunca me sentí presionada, y realmente aprecié el cuidado y la atención que brindó. Recomiendo mucho esta empresa y sin duda volveré en el futuro. ¡Gracias!',
    meta: 'Google review',
    metaEs: 'Reseña de Google',
  },
  {
    name: 'Cristian Reatiga',
    // Quoted exactly as posted, trailing emoji included — the rule above is
    // verbatim, and stripping them would be editing a customer's words.
    quote:
      'Beautiful chain for an awesome price! The shipping was also super fast, will be keeping this chain for a long time🔥👍',
    quoteEs:
      '¡Hermosa cadena a un precio increíble! El envío también fue súper rápido, voy a conservar esta cadena por mucho tiempo🔥👍',
    meta: 'Google review',
    metaEs: 'Reseña de Google',
  },

  // --- Added 2026-08-18, read from the live Google Business Profile ----------
  // Taken from the profile's own review list (16 reviews, 5.0 average) with the
  // "More" expander opened on every card, so these are full text and not
  // Google's collapsed preview.
  //
  // ⚠️ Quoted verbatim INCLUDING the spelling and grammar as posted: Max's
  // "Jewelery", Vasanth's "he have lots of collection", and the double space in
  // Scott's "pricing.  After". Those are not typos to fix — the rule at the top
  // of this file is verbatim, and a corrected quote is an invented one.
  {
    name: 'Mine Cervantes',
    quote:
      'Thank you Naples Estate Jewelry for making this such an easy experience for me. I’m 80 and honestly I was scared of getting scammed. Chris was so patient, explained everything to me, and made me feel comfortable from the start. I’m very grateful for his honesty and kindness. It’s nice to know there are still good people you can trust. Thank you, Chris!',
    quoteEs:
      'Gracias a Naples Estate Jewelry por hacer de esto una experiencia tan sencilla para mí. Tengo 80 años y, sinceramente, tenía miedo de que me estafaran. Chris fue muy paciente, me explicó todo y me hizo sentir cómoda desde el principio. Estoy muy agradecida por su honestidad y su amabilidad. Es bueno saber que todavía hay buenas personas en quienes se puede confiar. ¡Gracias, Chris!',
    meta: 'Google review',
    metaEs: 'Reseña de Google',
  },
  {
    name: 'Max Kolegue',
    quote:
      'Naples Estate Jewelery is a high touch establishment! I was interested in a new piece they had just brought in I saw on their Instagram. The entire buying process from initial outreach to purchase was seamless. I left wondering why more businesses don’t treat you like NEJ does. Would highly recommend!',
    quoteEs:
      '¡Naples Estate Jewelry es un establecimiento de primer nivel! Me interesó una pieza nueva que acababan de recibir y que vi en su Instagram. Todo el proceso de compra, desde el primer contacto hasta la adquisición, fue impecable. Me fui preguntándome por qué más negocios no tratan a uno como lo hace NEJ. ¡Muy recomendable!',
    meta: 'Google review',
    metaEs: 'Reseña de Google',
  },
  {
    name: 'Scott Tallent',
    quote:
      'Chris was very professional and upfront with his pricing.  After trying 3 other buyers, Chris gave us the best deal by far!',
    quoteEs:
      'Chris fue muy profesional y transparente con sus precios. Después de probar con otros tres compradores, ¡Chris nos dio la mejor oferta con diferencia!',
    meta: 'Google review',
    metaEs: 'Reseña de Google',
  },
  {
    name: 'Gerald Nestico',
    quote:
      'Highly recommend! I appreciate the time Chris took with me when selling my jewelry and felt very comfortable when dealing with him. Thank you so much! Will look to you again in the future if I am looking to purchase!',
    quoteEs:
      '¡Muy recomendable! Agradezco el tiempo que Chris me dedicó cuando vendí mi joyería y me sentí muy cómodo tratando con él. ¡Muchas gracias! Volveré a buscarlos en el futuro si quiero comprar algo.',
    meta: 'Google review',
    metaEs: 'Reseña de Google',
  },
  {
    name: 'Nathan Pablik',
    quote:
      'Chris is exceptionally knowledgeable in all areas of jewelry! He helped me get situated with pricing, delivery, and knowledge in gold. Highly recommend!',
    quoteEs:
      '¡Chris tiene un conocimiento excepcional en todas las áreas de la joyería! Me ayudó con los precios, la entrega y a entender mejor el oro. ¡Muy recomendable!',
    meta: 'Google review',
    metaEs: 'Reseña de Google',
  },
  {
    name: 'Judith Lam',
    quote:
      'Chris is amazing! He is very knowledgeable and understanding. I feel he is honest and trustworthy.',
    quoteEs:
      '¡Chris es increíble! Sabe muchísimo y es muy comprensivo. Siento que es honesto y de confianza.',
    meta: 'Google review',
    metaEs: 'Reseña de Google',
  },
  {
    name: 'Vasanth Gunasekaran',
    quote: 'The owner Chris was very nice and friendly, he have lots of collection',
    quoteEs: 'El dueño, Chris, fue muy amable y agradable, y tiene una gran colección',
    meta: 'Google review',
    metaEs: 'Reseña de Google',
  },
  {
    name: 'Douglas Mitchell',
    // Google's UI shows a trailing "…" after the emoji on this card. That is
    // its own collapse marker, not Douglas's text — confirmed by the card
    // having no "More" expander to open. Do not paste the ellipsis in.
    quote: 'Dude knows his stuff knowledgeable and professional 👍',
    quoteEs: 'Este hombre sabe lo que hace, con mucho conocimiento y profesionalismo 👍',
    meta: 'Google review',
    metaEs: 'Reseña de Google',
  },
];
