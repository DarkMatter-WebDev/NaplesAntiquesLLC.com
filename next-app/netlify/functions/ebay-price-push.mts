function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

export default async function ebayPricePushSchedule(): Promise<void> {
  const siteUrl = process.env.URL || process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) throw new Error('The production site URL is not configured.');

  const response = await fetch(new URL('/api/admin/ebay/price-push', siteUrl), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-cron-secret': requiredEnvironment('EBAY_CRON_SECRET'),
    },
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`eBay scheduled price push returned HTTP ${response.status}: ${body.slice(0, 500)}`);
  }
  console.log(`eBay scheduled price push completed: ${body.slice(0, 1_000)}`);
}

// Staggered 30 minutes after Etsy to keep provider work isolated.
export const config = {
  schedule: '45 11 * * *',
};
