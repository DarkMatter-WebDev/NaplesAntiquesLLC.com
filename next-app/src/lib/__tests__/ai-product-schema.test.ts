import { describe, expect, it } from 'vitest';
import { EMPTY_PRODUCT_AUTOFILL_FIELDS, coerceProductAutofill, sanitizeBuyerFacingText } from '@/lib/ai-product-schema';
import { BUYER_FACING_COPY_GUARDRAILS, CURRENT_PRODUCT_FIELD_CONTRACT, buildProductSystemPrompt } from '@/lib/ai-product-provider';

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
    expect(prompt.endsWith(BUYER_FACING_COPY_GUARDRAILS)).toBe(true);
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
