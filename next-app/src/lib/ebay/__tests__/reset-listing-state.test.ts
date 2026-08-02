import { describe, expect, it } from 'vitest';
import { summarizeEbayListingRows } from '../store';

describe('eBay account-change reset dry-run summary', () => {
  it('counts rows by sync state and flags live listing references', () => {
    const summary = summarizeEbayListingRows([
      { sync_state: 'published', ebay_listing_id: '111' },
      { sync_state: 'published', ebay_listing_id: '222' },
      { sync_state: 'review', ebay_listing_id: null },
      { sync_state: 'error', ebay_listing_id: null },
      { sync_state: 'ended', ebay_listing_id: '333' },
    ]);
    expect(summary).toEqual({
      total: 5,
      byState: { published: 2, review: 1, error: 1, ended: 1 },
      withListingIds: 3,
    });
  });

  it('reports an empty catalog as nothing to reset', () => {
    expect(summarizeEbayListingRows([])).toEqual({ total: 0, byState: {}, withListingIds: 0 });
  });
});
