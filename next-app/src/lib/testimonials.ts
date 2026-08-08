// Curated customer testimonials — the single source for every surface that
// shows reviews (homepage section, product-page band). These are REAL Google
// reviews, quoted verbatim with the reviewer's public first/last name exactly
// as shown on Google; the Spanish strings are our translations of the same
// reviews. Never invent, embellish, or paraphrase a quote: add new entries
// only by pasting a real review's text.
//
// To add a review: append an object below — every surface updates together.

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
];
