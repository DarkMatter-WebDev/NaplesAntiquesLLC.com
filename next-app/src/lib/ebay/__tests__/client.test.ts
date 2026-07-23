import { describe, expect, it } from 'vitest';
import { parseTradingGetItemResponse } from '../client';

describe('parseTradingGetItemResponse', () => {
  it('reads the seller SKU, status, and replacement listing ID', () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
      <GetItemResponse xmlns="urn:ebay:apis:eBLBaseComponents">
        <Ack>Success</Ack>
        <Item>
          <ItemID>800320565937</ItemID>
          <SKU>sku-82</SKU>
          <SellingStatus><ListingStatus>Completed</ListingStatus></SellingStatus>
          <ListingDetails><RelistedItemID>800354878200</RelistedItemID></ListingDetails>
        </Item>
      </GetItemResponse>`;

    expect(parseTradingGetItemResponse(xml)).toEqual({
      ack: 'Success',
      item: {
        itemId: '800320565937',
        sku: 'sku-82',
        listingStatus: 'Completed',
        relistedItemId: '800354878200',
      },
      errorCode: null,
      errorMessage: null,
    });
  });
});
