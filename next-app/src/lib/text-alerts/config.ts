/**
 * Text alerts (Twilio) — configuration (2026-09-15, Step 2).
 *
 * Netlify is the operating configuration (memory: env-netlify-authoritative).
 *   TWILIO_ACCOUNT_SID      ACxxxxxxxx…   Console home → Account Info
 *   TWILIO_AUTH_TOKEN       write-only in Netlify; rotate, never copy
 *   TWILIO_FROM_NUMBER      +18884237522  the toll-free number bought 2026-09-15
 *   TWILIO_FORWARD_TO       +12394048505  the owner's cell (default below)
 *   TEXT_ALERTS_CRON_SECRET x-cron-secret for /api/admin/text-alerts/sweep
 *   SITE_URL                already set; the webhook URLs are built from it
 *
 * Nothing sends while the three TWILIO_* values are missing: every sender
 * checks `twilioConfigured()` first and returns a "not configured" result,
 * so the site is safe to deploy before Twilio's toll-free verification lands.
 */

/** The owner's cell in E.164 — every reply is forwarded here. */
export const DEFAULT_FORWARD_TO = '+12394048505';

export type TwilioConfig = {
  accountSid: string;
  authToken: string;
  fromNumber: string;
  forwardTo: string;
  siteUrl: string;
};

function siteUrl(): string {
  return (process.env.SITE_URL || 'https://naplesestatejewelry.com').replace(/\/+$/, '');
}

export function twilioConfig(): TwilioConfig | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const fromNumber = process.env.TWILIO_FROM_NUMBER?.trim();
  if (!accountSid || !authToken || !fromNumber) return null;
  return {
    accountSid,
    authToken,
    fromNumber,
    forwardTo: process.env.TWILIO_FORWARD_TO?.trim() || DEFAULT_FORWARD_TO,
    siteUrl: siteUrl(),
  };
}

export function twilioConfigured(): boolean {
  return twilioConfig() !== null;
}

/** Where Twilio reports delivery for every message we send (passed per message, no console setup). */
export function statusCallbackUrl(): string {
  return `${siteUrl()}/api/webhooks/twilio/status`;
}

/** The URL the number's "A message comes in" webhook must be set to in the Twilio console. */
export function inboundWebhookUrl(): string {
  return `${siteUrl()}/api/webhooks/twilio/inbound`;
}
