import { describe, expect, it } from 'vitest';
import { getLegalMetadata, type LegalPageKey } from '@/lib/legal-metadata';

const pages: LegalPageKey[] = [
  'privacy',
  'terms',
  'returns-refunds',
  'shipping',
  'accessibility',
  'cookie-preferences',
];

describe('legal page metadata', () => {
  it.each(pages)('uses the root title template exactly once for %s', (page) => {
    const metadata = getLegalMetadata(page, 'en');
    expect(metadata.title).not.toContain('Naples Estate Jewelry');
  });

  it.each(pages)('localizes Spanish metadata and canonical paths for %s', (page) => {
    const en = getLegalMetadata(page, 'en');
    const es = getLegalMetadata(page, 'es');
    expect(es.title).not.toBe(en.title);
    expect(es.alternates?.canonical).toMatch(/^\/es\//);
  });
});
