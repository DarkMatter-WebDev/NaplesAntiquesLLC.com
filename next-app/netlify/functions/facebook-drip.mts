function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

/**
 * Facebook drip posting.
 *
 * Runs twice a day; each run publishes at most the owner's configured daily
 * limit minus whatever already went out in the trailing 24 hours, so the
 * cadence is governed by the setting in Admin -> Settings, not by how often
 * this fires. Only admin-approved products are eligible.
 */
export default async function facebookDripSchedule(): Promise<void> {
  const siteUrl = process.env.URL || process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) throw new Error('The production site URL is not configured.');

  const response = await fetch(new URL('/api/admin/facebook/drip', siteUrl), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-cron-secret': requiredEnvironment('FACEBOOK_CRON_SECRET'),
    },
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Facebook drip returned HTTP ${response.status}: ${body.slice(0, 500)}`);
  }
  console.log(`Facebook drip completed: ${body.slice(0, 1_000)}`);
}

// Netlify schedules run in UTC. 14:40 and 22:40 UTC = 10:40am and 6:40pm EDT —
// the same engagement windows as the Instagram drip (14:20/22:20), offset by
// twenty minutes so the two channels never publish simultaneously and the
// Etsy/eBay price pushes (11:15/11:45) stay clear.
export const config = {
  schedule: '40 14,22 * * *',
};
