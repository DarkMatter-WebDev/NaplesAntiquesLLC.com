// Curated customer testimonials — the single source for every surface that
// shows reviews (homepage section, product-page band). These are REAL Google
// reviews, quoted verbatim with the reviewer's public first/last name exactly
// as shown on Google; the Spanish strings are our translations of the same
// reviews. Never invent, embellish, or paraphrase a quote: add new entries
// only by pasting a real review's text.
//
// ⚠️ ONE ENTRY INVERTS THAT PAIRING. Mayelin Pérez wrote in Spanish, so her
// `quoteEs` is the verbatim original and her `quote` is the translation. The
// rule is "the reviewer's own language is the verbatim side", not "English is".
// Google's card shows a machine translation by default with a "See original"
// control beneath it; always publish what that control reveals.
//
// ⛔ EVERY ENTRY MUST STILL EXIST ON THE LIVE PROFILE. Each card renders a
// "Read on Google" link to GOOGLE_REVIEWS_URL, so a quote that is no longer
// there sends the reader to look for something they will not find. Two entries
// (Nolan Olivier, Onur) were removed on 2026-08-19 for exactly this: they were
// real reviews on the owner's ORIGINAL Business Profile, which he accidentally
// deleted and rebuilt, and they did not survive it. Genuine, and unverifiable —
// which on a page that invites verification is the same problem as invented.
//
// This list is therefore reconciled AGAINST the profile, not just appended to.
// When re-reading it, drop entries that have vanished and refresh ones whose
// text has changed (Yisel Perez re-reviewed on the new profile; her entry
// carries the new words).
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
    // ⚠️ Her review was RE-READ from the live profile on 2026-08-19 and replaced.
    // The previous quote here ("Working with this company was an excellent
    // experience…") came from the owner's ORIGINAL Google Business Profile,
    // which he accidentally deleted and rebuilt from scratch. That text no
    // longer exists anywhere; Yisel reviewed the business again on the new
    // profile, and this is what she wrote. Keeping the old words under her name
    // would have sent anyone who clicked "Read on Google" to a review that says
    // something else — indistinguishable, from the outside, from a fabricated
    // quote.
    //
    // "facebook" is lower-cased as she posted it.
    name: 'Yisel Perez',
    quote:
      'I had a couple of jewelry pieces I wanted to sell, I reached out to many different people and companies but their offer was too low. I found Chris with Naples Estate Jewelry one day casually on facebook and his offer was the highest one! Thank you so much for walking me through the whole process, great experience for sure. Highly recommend this business.',
    quoteEs:
      'Tenía un par de piezas de joyería que quería vender, contacté a muchas personas y empresas diferentes pero su oferta era demasiado baja. ¡Encontré a Chris de Naples Estate Jewelry un día casualmente en facebook y su oferta fue la más alta! Muchas gracias por guiarme durante todo el proceso, sin duda una gran experiencia. Recomiendo mucho este negocio.',
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
  {
    name: 'Linda Cusumano',
    // ⚠️ THE ONE ENTRY ON THIS PAGE THAT IS NOT VERBATIM, and the exception is
    // deliberate. Her review on Google ends with a stray line — "Hi baby" — on
    // its own, after "Local. Honest. Professional." It is genuinely inside the
    // review body, not a UI artifact: verified 2026-08-18 in the owner's own
    // Reviews panel with the full text expanded.
    //
    // The standing rule is verbatim-or-not-at-all (DECISIONS, "A review is
    // published verbatim or not at all"), and the plan of record was to ask her
    // to remove the line herself. The OWNER decided on 2026-08-19 to publish it
    // without that line instead, after being shown the exact text and told
    // plainly that this attributes edited words to a named real person.
    //
    // Nothing else is altered — wording, punctuation and the clipped
    // "cannot say enough Chris Surette" are all exactly as posted.
    //
    // ⛔ Do NOT treat this comment as licence to trim other reviews. It is one
    // owner-authorised exception, not a new policy. If Linda edits her review
    // on Google, replace this quote with the real text and delete this note.
    quote:
      'My husband and I cannot say enough Chris Surette with Naples Estate Jewelry. Chris went through two boxes of silver flatware. We were offered a check, or told to take it if we wanted to shop around more. The cash paid for our good sterling was more than fair. We would highly recommend Chris and Naples Estate Jewelry. Local. Honest. Professional.',
    quoteEs:
      'Mi esposo y yo no podemos decir suficiente sobre Chris Surette de Naples Estate Jewelry. Chris revisó dos cajas de cubertería de plata. Nos ofrecieron un cheque, o nos dijeron que podíamos llevárnosla si queríamos seguir buscando. El efectivo que pagó por nuestra buena plata esterlina fue más que justo. Recomendamos mucho a Chris y a Naples Estate Jewelry. Local. Honesto. Profesional.',
    meta: 'Google review',
    metaEs: 'Reseña de Google',
  },

  // --- Added 2026-08-19, read from the live Google Business Profile ----------
  // The profile's full list was loaded (16 reviews, 5.0) by scrolling the
  // Reviews pane until the count stopped growing, and every "More" expander was
  // opened, so these are full text rather than Google's collapsed preview.
  //
  // ⚠️ Verbatim INCLUDING what looks like a mistake: Ryan's "weary" (for
  // "wary") and Edna's missing space in "pressured.I really". Those are not
  // typos to fix — a corrected quote is an invented one. The Spanish
  // translations render the intended meaning, which is what a translation is.
  {
    name: 'Ruthe Lloyd',
    quote: 'Chris is honest and completely trustworthy, he is a pleasure to do business with!',
    quoteEs: '¡Chris es honesto y completamente confiable, es un placer hacer negocios con él!',
    meta: 'Google review',
    metaEs: 'Reseña de Google',
  },
  {
    name: 'Ariel Babastro',
    quote:
      'What a pleasure it was working with Chris! I was looking for a trustworthy company to sell some of my jewelry because I needed the money for a down payment. I had received a few offers from other places, but they were much lower than I expected.\n\nI found Naples Estate Jewelry, and I’m so glad I did! Chris was incredibly patient, kind, and easy to work with, especially since English is not my first language. He took the time to explain everything and made me feel very comfortable throughout the whole process.\n\nHis offer was the best one I received, and he actually paid me more than I was expecting! I couldn’t be happier with my experience. Thank you so much, Chris! I will definitely be coming back to do more business with you guys. Highly recommend Naples Estate Jewelry!',
    quoteEs:
      '¡Qué placer fue trabajar con Chris! Buscaba una empresa de confianza para vender algunas de mis joyas porque necesitaba el dinero para un pago inicial. Había recibido algunas ofertas de otros lugares, pero eran mucho más bajas de lo que esperaba.\n\n¡Encontré Naples Estate Jewelry y me alegro muchísimo de haberlo hecho! Chris fue increíblemente paciente, amable y fácil de tratar, sobre todo porque el inglés no es mi primer idioma. Se tomó el tiempo de explicarme todo y me hizo sentir muy cómoda durante todo el proceso.\n\n¡Su oferta fue la mejor que recibí, y de hecho me pagó más de lo que esperaba! No podría estar más feliz con mi experiencia. ¡Muchísimas gracias, Chris! Sin duda volveré para hacer más negocios con ustedes. ¡Recomiendo mucho Naples Estate Jewelry!',
    meta: 'Google review',
    metaEs: 'Reseña de Google',
  },
  {
    name: 'Ryan Smith',
    quote:
      'I worked with Chris and had an amazing experience. I was kinda weary buying gold but I wanted something special for my son. He’s now the proud owner of a beautiful gold chain with the perfect Italian horn charm. I’m psyched for him but also happy that I know it’s real gold and will carry its value in the future.',
    quoteEs:
      'Trabajé con Chris y tuve una experiencia increíble. Estaba un poco receloso de comprar oro, pero quería algo especial para mi hijo. Ahora él es el orgulloso dueño de una hermosa cadena de oro con el dije de cuerno italiano perfecto. Estoy entusiasmado por él y también contento de saber que es oro de verdad y que mantendrá su valor en el futuro.',
    meta: 'Google review',
    metaEs: 'Reseña de Google',
  },
  {
    name: 'Edna Cavazos',
    quote:
      'Chris met up with me and I had a great experience. He took the time to carefully examine my silver-plated items and explained what they were, their condition, and what they might be worth. Even though we didn’t end up making a deal, he was honest, professional, and never made me feel pressured.I really appreciated how knowledgeable, patient, and accommodating he was. I left feeling much more informed than when I arrived, and I truly appreciated his generosity with his time and expertise.',
    quoteEs:
      'Chris se reunió conmigo y tuve una gran experiencia. Se tomó el tiempo de examinar cuidadosamente mis artículos plateados y me explicó qué eran, en qué estado estaban y cuánto podrían valer. Aunque al final no cerramos un trato, fue honesto, profesional y nunca me hizo sentir presionada. Realmente aprecié lo bien informado, paciente y atento que fue. Me fui sintiéndome mucho más informada que cuando llegué, y de verdad aprecié su generosidad con su tiempo y su experiencia.',
    meta: 'Google review',
    metaEs: 'Reseña de Google',
  },
  {
    // ⚠️ THE ONE REVIEW WRITTEN IN SPANISH. The direction of the pair is
    // therefore INVERTED here: `quoteEs` is her ORIGINAL text, verbatim, and
    // `quote` is our English translation. Google's own card shows a machine
    // translation with "See original (Spanish)" beneath it; the original was
    // read from that control, not from the translation.
    //
    // ⚠️ "Naples estate jewelry" is lower-cased in her original. Left exactly
    // as posted — the Spanish side is the verbatim one on this entry.
    name: 'Mayelin Pérez',
    quote:
      'I had these gold pieces that I practically didn’t wear anymore, and I had also lost one of the rings, so I started looking for people who might want to buy them. Chris offered me a good price that I couldn’t turn down, because I had contacted two other people before and they were offering me much less than half of what Chris with Naples Estate Jewelry offered me. Thank you so much for everything, and I’ll be in touch soon because my mom also wants to sell some of her things.',
    quoteEs:
      'Tenía estas piezas de oro que prácticamente ya no las usaba, también había perdido una de las argollas y empecé a buscar personas que las quisieran comprar. Chris me ofreció un buen precio que no pude rechazar porque había contactado dos personas antes y me ofrecían mucho menos de la mitad que me ofreció Chris con Naples estate jewelry. Muchas gracias por todo y pronto les contactaré porque mi mamá también quiere vender algunas de sus cosas.',
    meta: 'Google review',
    metaEs: 'Reseña de Google',
  },
];
