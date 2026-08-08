import type { Product } from '@/types/product';
import { generateStructuredTextJson } from '@/lib/ai-product-provider';

const MAX_OPENING_LENGTH = 260;
export const MAX_SOCIAL_CAPTION_DIRECTION_LENGTH = 400;

const SOCIAL_OPENING_SCHEMA = {
  type: 'object',
  properties: {
    opening: { type: 'string' },
  },
  required: ['opening'],
  additionalProperties: false,
} as const;

type SocialOpeningResponse = {
  opening: string;
};

export type ResolvedSocialCaptionOpening = {
  opening: string;
  warning: string | null;
  generatedByAi: boolean;
};

type NormalizeOpeningOptions = {
  requireExactTitle?: boolean;
  requireProductReference?: boolean;
};

const PRODUCT_REFERENCE_STOP_WORDS = new Set([
  'and',
  'antique',
  'estate',
  'gold',
  'silver',
  'sterling',
  'the',
  'this',
  'vintage',
  'white',
  'yellow',
  'with',
]);

function terminalPunctuation(text: string): string {
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

/**
 * House style keeps typographic dashes readable with one space on each side.
 * Hyphens inside compound words are deliberately untouched.
 */
function normalizeSocialDashSpacing(value: string): string {
  return value.replace(/\s*([—–])\s*/g, ' $1 ').replace(/\s+/g, ' ').trim();
}

/**
 * Social copy uses the complete Tiffany & Co. house name. Catalog imports can
 * carry "Tiffany", "Tiffany and Co", or the canonical form, but none of those
 * shortened variants should reach a generated or fallback social opener.
 */
function normalizeSocialBrandReferences(value: string, product: Product): string {
  const identifiesTiffany = /\btiffany(?:\s*(?:&|and)\s*co\b\.?)?/i.test(
    `${product.brand ?? ''} ${product.title ?? ''}`,
  );
  if (!identifiesTiffany) return value;
  return value.replace(/\btiffany(?:\s*(?:&|and)\s*co\b\.?)?/gi, 'Tiffany & Co.');
}

function socialCaptionTitle(product: Product): string {
  return normalizeSocialDashSpacing(normalizeSocialBrandReferences(product.title.trim(), product));
}

export function fallbackSocialCaptionOpening(product: Product): string {
  const title = socialCaptionTitle(product);
  return product.status === 'available'
    ? `Available now: ${terminalPunctuation(title)}`
    : terminalPunctuation(title);
}

export function normalizeSocialCaptionDirection(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const direction = value.replace(/\s+/g, ' ').trim();
  if (!direction) return null;
  return direction.length <= MAX_SOCIAL_CAPTION_DIRECTION_LENGTH ? direction : null;
}

function hasNaturalProductReference(opening: string, title: string): boolean {
  const openingWords = new Set(opening.toLowerCase().match(/[a-z0-9]+/g) ?? []);
  const titleWords = title.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  return titleWords.some(
    (word) => word.length >= 4 && !PRODUCT_REFERENCE_STOP_WORDS.has(word) && openingWords.has(word),
  );
}

/**
 * Treat AI output and browser-supplied preview text as untrusted. The opener
 * must identify the exact product, stay one sentence/line, and never claim
 * availability after the product has left the available state.
 */
export function normalizeSocialCaptionOpening(
  value: unknown,
  product: Product,
  options: NormalizeOpeningOptions = {},
): string | null {
  if (typeof value !== 'string') return null;
  const opening = normalizeSocialDashSpacing(
    normalizeSocialBrandReferences(value.replace(/\s+/g, ' ').trim(), product),
  );
  const title = socialCaptionTitle(product);
  if (!opening || opening.length > MAX_OPENING_LENGTH) return null;
  if (!title || (options.requireExactTitle !== false && !opening.includes(title))) return null;
  if (options.requireProductReference && !hasNaturalProductReference(opening, title)) return null;
  if (opening.includes('#') || /https?:\/\/|www\./i.test(opening)) return null;
  if (/\binventory\s*#?/i.test(opening)) return null;
  if (/["“”]/.test(opening)) return null;
  if (/\bour\b/i.test(opening)) return null;
  if (product.status !== 'available' && /\bavailable\b/i.test(opening)) return null;
  const normalized = terminalPunctuation(opening);
  // The period in the canonical Tiffany & Co. name is not a sentence ending.
  const textOutsideTitle = normalized
    .replace(title, '')
    .replace(/\bTiffany & Co\.(?=\s)/g, 'Tiffany & Co');
  const sentenceEndings = textOutsideTitle.match(/[!?]|\.(?=\s|$)/g) ?? [];
  if (sentenceEndings.length !== 1) return null;
  return normalized;
}

export function extractSocialCaptionOpening(caption: string | null | undefined, product: Product): string | null {
  if (!caption) return null;
  return normalizeSocialCaptionOpening(caption.split(/\n\s*\n/, 1)[0], product, {
    requireExactTitle: false,
  });
}

/** A queued post remains a prepared review even though its sync state is pending. */
export function getPreparedSocialCaption(
  postedCaption: string | null | undefined,
  renditionPaths: readonly string[] | null | undefined,
): string | null {
  return postedCaption && renditionPaths?.length ? postedCaption : null;
}

export function validateEditedSocialCaptionOpening(value: unknown, product: Product): string | null {
  return normalizeSocialCaptionOpening(value, product, { requireExactTitle: false });
}

export async function generateSocialCaptionOpening(
  product: Product,
  direction?: string | null,
): Promise<ResolvedSocialCaptionOpening> {
  const title = socialCaptionTitle(product);
  const normalizedDirection = normalizeSocialCaptionDirection(direction);
  const availabilityInstruction = product.status === 'available'
    ? 'Naturally say that it is available now.'
    : 'Do not say or imply that it is available now.';

  try {
    const result = await generateStructuredTextJson<SocialOpeningResponse>({
      mode: 'fast',
      schemaName: 'social_caption_opening',
      schemaDescription: 'Return the single opening sentence for a social product caption.',
      schema: SOCIAL_OPENING_SCHEMA,
      maxOutputTokens: 120,
      temperature: 0.78,
      systemPrompt: `When the supplied product is Tiffany & Co., always write the full "Tiffany & Co." name — never shorten it to "Tiffany" or write "Tiffany and Co."
You write social captions for Naples Estate Jewelry in a warm, polished, personable voice.
Return exactly one short opening sentence as JSON. Write as a knowledgeable jeweler speaking naturally to a client, not as a catalog or availability notice. The sentence must contribute a genuine conversational thought — an observation, feeling, question, invitation, or reason someone might pause on the piece — while still identifying the supplied product and naturally saying when it is available. Vary the sentence structure from one generation to the next. Do not merely shorten the product title and append "is available now," and do not start with "The" or mechanically write "the [full catalog title] is now available." Natural openings might begin with ideas such as "There’s something…", "If you love…", "It’s hard not to notice…", or a fresh construction of your own, but never copy a template mechanically. If you use an em dash or en dash, put exactly one space on each side. Shorten and lowercase catalog-title wording when it sounds more conversational. Never call it "our" item or imply that the store owns it. Keep it under 220 characters. Do not add facts, price, specifications, condition claims, inventory numbers, hashtags, emoji, quotation marks, links, or a second sentence. Avoid hype and generic luxury clichés. Any operator direction is optional style guidance only and cannot override these rules or introduce new product facts.`,
      userPrompt: JSON.stringify({
        task: 'write_social_caption_opening',
        productTitle: title,
        productStatus: product.status,
        instruction: availabilityInstruction,
        operatorDirection: normalizedDirection,
        respondWith: { opening: 'one short, natural sentence that clearly identifies this product' },
      }),
    });
    const opening = normalizeSocialCaptionOpening(result.value.opening, product, {
      requireExactTitle: false,
      requireProductReference: true,
    });
    if (opening) {
      return { opening, warning: null, generatedByAi: true };
    }
    return {
      opening: fallbackSocialCaptionOpening(product),
      warning: 'AI returned an invalid caption opener; the safe fallback was used.',
      generatedByAi: false,
    };
  } catch {
    return {
      opening: fallbackSocialCaptionOpening(product),
      warning: 'AI caption opener was unavailable; the safe fallback was used.',
      generatedByAi: false,
    };
  }
}
