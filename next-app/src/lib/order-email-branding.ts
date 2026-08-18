import { escapeHtml } from '@/lib/marketing-email-html';
import { addressWithLandmark } from '@/lib/business-location';

const DEFAULT_SITE_URL = 'https://naplesestatejewelry.com';

export const SITE_DOMAIN_LABEL = 'naplesestatejewelry.com';

export function getSiteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL).replace(/\/$/, '');
}

export function getAccountUrl(): string {
  return `${getSiteUrl()}/account`;
}

/**
 * Shared footer for customer-facing order emails (invoice/receipt + fulfillment
 * updates): a link back to the buyer's account and to the storefront domain,
 * so recipients always have a clickable way back to naplesestatejewelry.com.
 */
export function buildOrderEmailFooterHtml() {
  const siteUrl = getSiteUrl();
  const accountUrl = getAccountUrl();
  return `
    <div style="margin:22px 0 0;padding-top:16px;border-top:1px solid #eadfbd;">
      <p style="margin:0 0 8px;font-size:13px;line-height:1.55;color:#746b5b;">
        View this order or manage your account anytime at
        <a href="${escapeHtml(accountUrl)}" style="color:#735c00;font-weight:700;text-decoration:underline;">${escapeHtml(SITE_DOMAIN_LABEL)}/account</a>.
      </p>
      <p style="margin:0;font-size:12px;line-height:1.5;color:#9a8f7a;">
        <a href="${escapeHtml(siteUrl)}" style="color:#735c00;font-weight:600;text-decoration:underline;">${escapeHtml(SITE_DOMAIN_LABEL)}</a> &middot; ${escapeHtml(addressWithLandmark(false))} &middot; (239) 404-8505
      </p>
    </div>
  `;
}

export function buildOrderEmailFooterTextLines(): string[] {
  return [
    `View this order or manage your account anytime at ${getAccountUrl()}`,
    SITE_DOMAIN_LABEL,
    addressWithLandmark(false),
    '(239) 404-8505',
  ];
}
