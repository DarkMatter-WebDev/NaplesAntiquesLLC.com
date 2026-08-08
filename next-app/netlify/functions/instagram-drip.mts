function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

/**
 * Instagram drip posting.
 *
 * Runs only at UTC hours that cover the seven allowed Eastern posting slots in
 * both EDT and EST. The due-row query prevents an early post on the extra DST
 * coverage hours. Each invocation processes a bounded due batch; there is no
 * local daily cap.
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

// Noon/2pm/4pm/6pm/8pm/10pm/midnight ET map to 16/18/20/22/00/02/04 UTC
// in EDT and 17/19/21/23/01/03/05 UTC in EST. The due-row query makes this
// broader union safe year-round.
export const config = {
  schedule: '0 0-5,16-23 * * *',
};
