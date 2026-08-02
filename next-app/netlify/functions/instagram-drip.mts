function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

/**
 * Instagram drip posting.
 *
 * Runs twice a day; each run publishes at most the owner's configured daily
 * limit minus whatever already went out in the trailing 24 hours, so the
 * cadence is governed by the setting in Admin -> Settings, not by how often
 * this fires. Only admin-approved products are eligible.
 */
export default async function instagramDripSchedule(): Promise<void> {
  const siteUrl = process.env.URL || process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) throw new Error('The production site URL is not configured.');

  const response = await fetch(new URL('/api/admin/instagram/drip', siteUrl), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-cron-secret': requiredEnvironment('INSTAGRAM_CRON_SECRET'),
    },
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Instagram drip returned HTTP ${response.status}: ${body.slice(0, 500)}`);
  }
  console.log(`Instagram drip completed: ${body.slice(0, 1_000)}`);
}

// Netlify schedules run in UTC. 14:20 and 22:20 UTC = 10:20am and 6:20pm EDT —
// late-morning and early-evening engagement windows, offset from the Etsy
// (11:15) and eBay (11:45) price pushes.
export const config = {
  schedule: '20 14,22 * * *',
};
