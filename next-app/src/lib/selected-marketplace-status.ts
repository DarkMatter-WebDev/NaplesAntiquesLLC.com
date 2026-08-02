export type Marketplace = 'etsy' | 'ebay';

export interface CheckedMarketplaceItem {
  productId: string;
  syncState: string;
  linked: boolean;
  checkError: boolean;
}

export type MarketplaceStatusGroup = 'listed' | 'not-listed' | 'issues';

export const MARKETPLACE_STATUS_GROUP_LABELS: Record<MarketplaceStatusGroup, string> = {
  listed: 'Listed',
  'not-listed': 'Not listed',
  issues: 'Needs attention',
};

const STATUS_LABELS: Record<Marketplace, Record<string, string>> = {
  etsy: {
    pending: 'Not listed',
    draft_created: 'Draft',
    images_synced: 'Draft',
    inventory_synced: 'Draft',
    draft_review: 'Draft, needs review',
    active: 'Live',
    out_of_date: 'Out of date',
    delisted: 'Inactive',
    error: 'Needs attention',
  },
  ebay: {
    pending: 'Not listed',
    item_synced: 'Draft',
    offer_created: 'Draft',
    review: 'Draft, ready to publish',
    published: 'Live',
    out_of_date: 'Live, updates needed',
    hidden_oos: 'Hidden (sold)',
    ended: 'Ended',
    error: 'Needs attention',
  },
};

export function marketplaceStatusGroup(item: CheckedMarketplaceItem | undefined): MarketplaceStatusGroup {
  if (!item || item.checkError || item.syncState === 'error') return 'issues';
  return item.linked ? 'listed' : 'not-listed';
}

export function marketplaceItemStatusLabel(marketplace: Marketplace, item: CheckedMarketplaceItem | undefined): string {
  if (!item) return 'Status unavailable';
  if (item.checkError) return 'Check failed';
  if (!item.linked) return 'Not listed';
  return STATUS_LABELS[marketplace][item.syncState] ?? item.syncState;
}
