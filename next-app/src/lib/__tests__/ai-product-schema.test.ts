import { describe, expect, it } from 'vitest';
import {
  EMPTY_PRODUCT_AUTOFILL_FIELDS,
  PRODUCT_AUTOFILL_SCHEMA,
  coerceProductAutofill,
  reviewProductAutofillDraft,
  sanitizeBuyerFacingText,
  type ProductAutofillDraft,
  type ProductAutofillFields,
} from '@/lib/ai-product-schema';
import {
  BUYER_FACING_COPY_GUARDRAILS,
  CURRENT_PRODUCT_FIELD_CONTRACT,
  ITERATIVE_LISTING_CONTRACT,
  buildProductSystemPrompt,
  buildProductUserPrompt,
} from '@/lib/ai-product-provider';

function makeDraft(
  fields: Partial<ProductAutofillFields>,
  confidence: ProductAutofillDraft['confidence'] = {},
  options: { warnings?: string[]; uncertainties?: string[] } = {},
): ProductAutofillDraft {
  return {
    fields: { ...EMPTY_PRODUCT_AUTOFILL_FIELDS, ...fields },
    warnings: options.warnings ?? [],
    uncertainties: options.uncertainties ?? [],
    confidence,
    assistant_message: 'I reviewed the listing.',
    follow_up_questions: [],
  };
}

describe('AI buyer-facing copy guardrails', () => {
  it('removes direct seller-attribution sentences and preserves them for review', () => {
    const result = coerceProductAutofill({
      fields: {
        ...EMPTY_PRODUCT_AUTOFILL_FIELDS,
        title: 'Vintage bracelet. The seller suggests it is antique.',
        description: 'A polished link bracelet. According to the seller, it is solid gold.',
        public_notes: 'The seller says it is a family heirloom.',
      },
    });

    expect(result.fields.title).toBe('Vintage bracelet');
    expect(result.fields.description).toBe('A polished link bracelet');
    expect(result.fields.public_notes).toBeNull();
    expect(result.uncertainties).toEqual(expect.arrayContaining([
      'The seller suggests it is antique.',
      'According to the seller, it is solid gold.',
      'The seller says it is a family heirloom.',
    ]));
  });

  it('leaves ordinary buyer-facing copy unchanged', () => {
    expect(sanitizeBuyerFacingText('Yellow-tone bracelet with a polished finish.')).toEqual({
      value: 'Yellow-tone bracelet with a polished finish.',
      removed: [],
    });
  });

  it('appends the firewall to a saved custom prompt', () => {
    const prompt = buildProductSystemPrompt('Custom admin prompt.');
    expect(prompt.startsWith('Custom admin prompt.')).toBe(true);
    expect(prompt).toContain(CURRENT_PRODUCT_FIELD_CONTRACT);
    expect(prompt).toContain(ITERATIVE_LISTING_CONTRACT);
    expect(prompt.endsWith(BUYER_FACING_COPY_GUARDRAILS)).toBe(true);
  });

  it('keeps assistant feedback and adds questions for required unsupported fields', () => {
    const result = coerceProductAutofill({
      fields: {
        ...EMPTY_PRODUCT_AUTOFILL_FIELDS,
        title: 'Yellow-Tone Link Bracelet',
        product_type: 'Bracelet',
        price_mode: 'spot-multiplier',
        pricing_multiplier: 1.5,
      },
      assistant_message: '**Updated:** I identified the form and `updated` the title.',
      follow_up_questions: ['Can you confirm the bracelet length?'],
    });

    expect(result.assistant_message).toBe('Updated: I identified the form and updated the title.');
    expect(result.follow_up_questions).toEqual([
      'Can you confirm the bracelet length?',
      'What purity or hallmark does the item have?',
      'What is the item’s weight in grams?',
    ]);
  });

  it('builds a refinement turn with the current listing and prior conversation', () => {
    const currentFields = {
      ...EMPTY_PRODUCT_AUTOFILL_FIELDS,
      title: 'Yellow-Tone Link Bracelet',
      product_type: 'Bracelet',
    };
    const prompt = JSON.parse(buildProductUserPrompt({
      transcript: 'The hallmark reads 14K and it weighs 18.2 grams.',
      images: ['/assets/example.webp'],
      schema: PRODUCT_AUTOFILL_SCHEMA,
      iteration: 'refine',
      currentFields,
      conversation: [
        { role: 'user', content: 'Please create the listing.' },
        { role: 'assistant', content: 'What purity and weight does it have?' },
      ],
    }));

    expect(prompt.task).toBe('refine_product_listing_from_feedback');
    expect(prompt.latestUserInput).toContain('18.2 grams');
    expect(prompt.currentListingFields.title).toBe('Yellow-Tone Link Bracelet');
    expect(prompt.conversation).toHaveLength(2);
    expect(prompt.respondWith.follow_up_questions).toContain('important questions');
  });

  it('auto-applies only high-confidence descriptive values going into blank fields', () => {
    const result = reviewProductAutofillDraft(
      makeDraft({ title: 'Sterling Silver Brooch' }, { title: 'high' }),
      EMPTY_PRODUCT_AUTOFILL_FIELDS,
    );

    expect(result.review?.auto_apply_fields).toEqual(['title']);
    expect(result.review?.pending_changes).toEqual([]);
  });

  it('holds every uncertain value for confirmation and asks a deterministic question', () => {
    const result = reviewProductAutofillDraft(
      makeDraft(
        { item_year: 1960, brand: 'Taxco' },
        { item_year: 'low' },
      ),
      EMPTY_PRODUCT_AUTOFILL_FIELDS,
    );

    expect(result.review?.auto_apply_fields).toEqual([]);
    expect(result.review?.pending_changes.map((change) => change.field)).toEqual(['brand', 'item_year']);
    expect(result.review?.pending_changes[0].reasons).toContain('missing-confidence');
    expect(result.review?.pending_changes[1].reasons).toContain('low-confidence');
    expect(result.follow_up_questions).toEqual(expect.arrayContaining([
      'Can you confirm Brand should be "Taxco"?',
      'Can you confirm Date (Year Made) should be "1960"?',
    ]));
  });

  it('never overwrites an existing value without confirmation, even at high confidence', () => {
    const currentFields = {
      ...EMPTY_PRODUCT_AUTOFILL_FIELDS,
      product_type: 'Tray',
    };
    const result = reviewProductAutofillDraft(
      makeDraft({ product_type: 'Salver' }, { product_type: 'high' }),
      currentFields,
    );

    expect(result.review?.auto_apply_fields).toEqual([]);
    expect(result.review?.pending_changes[0]).toMatchObject({
      field: 'product_type',
      current_value: 'Tray',
      proposed_value: 'Salver',
      reasons: ['changes-existing-value'],
    });
  });

  it('holds sensitive facts for confirmation and ignores unchanged values', () => {
    const currentFields = {
      ...EMPTY_PRODUCT_AUTOFILL_FIELDS,
      title: 'Existing Title',
    };
    const result = reviewProductAutofillDraft(
      makeDraft(
        { title: 'Existing Title', purity: 925 },
        { title: 'high', purity: 'high' },
      ),
      currentFields,
    );

    expect(result.review?.auto_apply_fields).toEqual([]);
    expect(result.review?.pending_changes).toHaveLength(1);
    expect(result.review?.pending_changes[0]).toMatchObject({
      field: 'purity',
      reasons: ['sensitive-field'],
    });
  });

  it('asks about an unchanged value whenever confidence is not high', () => {
    const currentFields = {
      ...EMPTY_PRODUCT_AUTOFILL_FIELDS,
      item_year: 1960,
    };
    const result = reviewProductAutofillDraft(
      makeDraft({ item_year: 1960 }, { item_year: 'low' }),
      currentFields,
    );

    expect(result.review?.pending_changes).toEqual([]);
    expect(result.follow_up_questions).toContain(
      'Can you confirm the existing Date (Year Made) value "1960"? The assistant returned low confidence.',
    );
  });

  it('turns warnings and uncertainties into explicit clarification questions', () => {
    const result = reviewProductAutofillDraft(
      makeDraft({}, {}, {
        warnings: ['The hallmark conflicts with the stated purity.'],
        uncertainties: ['The maker mark is difficult to read.'],
      }),
      EMPTY_PRODUCT_AUTOFILL_FIELDS,
    );

    expect(result.follow_up_questions).toEqual(expect.arrayContaining([
      expect.stringContaining('The hallmark conflicts with the stated purity.'),
      expect.stringContaining('The maker mark is difficult to read.'),
    ]));
  });

  it('accepts explicit necklace and bracelet widths in millimeters', () => {
    const bracelet = coerceProductAutofill({
      fields: {
        ...EMPTY_PRODUCT_AUTOFILL_FIELDS,
        product_type: 'Bracelet',
        width_mm: '12.345',
      },
    });
    const necklace = coerceProductAutofill({
      fields: {
        ...EMPTY_PRODUCT_AUTOFILL_FIELDS,
        product_type: 'Necklace',
        width_mm: '8 mm',
      },
    });

    expect(bracelet.fields.width_mm).toBe(12.35);
    expect(necklace.fields.width_mm).toBe(8);
  });

  it('normalizes plain and inch-suffixed AI length values identically', () => {
    for (const length of [24, '24', '24 in', '24 inches', '24"', '24.0 in']) {
      const result = coerceProductAutofill({
        fields: {
          ...EMPTY_PRODUCT_AUTOFILL_FIELDS,
          product_type: 'Necklace',
          length,
        },
      });
      expect(result.fields.length).toBe('24');
    }
  });

  it('keeps canonical length output rules in saved custom prompts', () => {
    const prompt = buildProductSystemPrompt('Custom admin prompt.');
    expect(prompt).toContain('24 in');
    expect(prompt).toContain('bare canonical numeric string');
  });

  it('drops width for non-applicable product types and invalid measurements', () => {
    const ring = coerceProductAutofill({
      fields: {
        ...EMPTY_PRODUCT_AUTOFILL_FIELDS,
        product_type: 'Ring',
        width_mm: 9,
      },
    });
    const invalidBracelet = coerceProductAutofill({
      fields: {
        ...EMPTY_PRODUCT_AUTOFILL_FIELDS,
        product_type: 'Bracelet',
        width_mm: 1001,
      },
    });

    expect(ring.fields.width_mm).toBeNull();
    expect(invalidBracelet.fields.width_mm).toBeNull();
  });
});
