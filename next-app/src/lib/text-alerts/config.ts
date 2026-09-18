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

/**
 * The picture attached to every customer-facing text that is not a deal
 * (the sign-up confirmation, the YES reply, the sold auto-reply).
 *
 * Why (owner, 2026-09-17): a plain text and a picture message from the same
 * toll-free number land in TWO threads on the iPhone ("+1 (888) 423-7522" vs
 * "8884237522"). Making every customer text an MMS keeps the whole
 * conversation in one thread. The forwards to the owner's own cell stay
 * plain texts. The image is the owner's navy/gold octopus logo, 800 px JPEG
 * (~110 KB; JPEG because the illustration has gradients — a palette PNG was
 * 3× the size), served from the site so Twilio can fetch it.
 */
export function brandMediaUrl(): string {
  return `${siteUrl()}/assets/images/branding/text-brand.jpg`;
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
