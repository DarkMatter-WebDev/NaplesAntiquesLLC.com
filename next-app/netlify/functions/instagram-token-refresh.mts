function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

/**
 * Weekly Instagram token keep-warm.
 *
 * A long-lived Instagram token lasts 60 days and can only be refreshed while it
 * is still valid, so without this a quiet couple of months would silently break
 * posting. Weekly (rather than daily) is deliberate: Meta rejects refreshes for
 * tokens under 24h old, and weekly still leaves ~8 chances inside the renewal
 * window before anything could expire.
 */
export default async function instagramTokenRefreshSchedule(): Promise<void> {
  const siteUrl = process.env.URL || process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) throw new Error('The production site URL is not configured.');

  const response = await fetch(new URL('/api/admin/instagram/refresh-token', siteUrl), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-cron-secret': requiredEnvironment('INSTAGRAM_CRON_SECRET'),
    },
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Instagram token refresh returned HTTP ${response.status}: ${body.slice(0, 500)}`);
  }
  console.log(`Instagram token refresh completed: ${body.slice(0, 1_000)}`);
}

// Netlify schedules run in UTC. Mondays at 12:15 UTC — offset from the Etsy
// (11:15) and eBay (11:45) daily pushes so the three never contend.
export const config = {
  schedule: '15 12 * * 1',
};
