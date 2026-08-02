import { createHash } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceClient } from '@/lib/supabase/service';
import { withMarketingFooter } from '@/lib/marketing-email-html';

export type AudienceScope = 'subscribers' | 'accounts' | 'buyers' | 'all';
export type MarketingSenderProfile = 'no_reply' | 'chris';

/** A single source ('subscriber'/'account'/'buyer') or a deterministic,
 *  sorted '+'-joined combination (e.g. 'account+buyer') when a recipient
 *  matched more than one audience in a combined build. Kept as a plain
 *  string rather than an exhaustive union — the only consumer is a display
 *  label, and the combination count grows quickly with more sources. */
export type MarketingRecipient = {
  email: string;
  name: string | null;
  source: string;
  subscriberSource: string | null;
  unsubscribeToken: string | null;
  userId: string | null;
  subscriberEmail: string | null;
};

export type MarketingSettings = {
  mailingAddress: string | null;
  siteUrl: string;
  fromAddress: string;
  senderProfiles: Record<MarketingSenderProfile, {
    fromAddress: string;
    label: string;
    replyTo: string | null;
  }>;
  transport: 'direct' | 'broadcast';
};

export function normalizeSenderProfile(value: unknown): MarketingSenderProfile {
  return value === 'no_reply' ? 'no_reply' : 'chris';
}

export function normalizeEmail(value: unknown) {
  return String(value ?? '').trim().toLowerCase();
}

export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function marketingSiteUrl() {
  return (process.env.SITE_URL || 'https://naplesestatejewelry.com').replace(/\/+$/, '');
}

export function activeMarketingTransport(): 'direct' | 'broadcast' {
  return process.env.MARKETING_TRANSPORT === 'broadcast' ? 'broadcast' : 'direct';
}

/** Merges a new single source into a recipient's existing (possibly already
 *  combined) source, producing a deterministic sorted '+'-joined string so
 *  e.g. subscriber+account+buyer always renders the same way regardless of
 *  which order the three audience queries happened to run in. */
export function combineSource(existing: string, incoming: 'subscriber' | 'account' | 'buyer'): string {
  const parts = new Set(existing.split('+'));
  parts.add(incoming);
  return [...parts].sort().join('+');
}

export async function buildMarketingAudience(scope: AudienceScope = 'all', audienceClient?: SupabaseClient) {
  const supabase = audienceClient ?? createServiceClient();
  const byEmail = new Map<string, MarketingRecipient>();

  if (scope === 'subscribers' || scope === 'all') {
    let { data, error } = await supabase
      .from('homepage_subscribers')
      .select('email, full_name, source, unsubscribe_token, unsubscribed_at')
      .is('unsubscribed_at', null);

    if (error?.code === '42703') {
      const fallback = await supabase
        .from('homepage_subscribers')
        .select('email, full_name, source, unsubscribe_token');
      data = fallback.data?.map((row) => ({ ...row, unsubscribed_at: null })) ?? null;
      error = fallback.error;
    }

    if (error?.code === '42703') {
      const fallback = await supabase
        .from('homepage_subscribers')
        .select('email, full_name');
      data = fallback.data?.map((row) => ({ ...row, source: null, unsubscribe_token: null, unsubscribed_at: null })) ?? null;
      error = fallback.error;
    }

    if (error) throw new Error(`Could not load active subscribers. Confirm homepage_subscribers has email/full_name plus optional unsubscribe fields. ${error.message}`);

    for (const row of data ?? []) {
      const email = normalizeEmail(row.email);
      if (!isValidEmail(email)) continue;
      byEmail.set(email, {
        email,
        name: row.full_name ?? null,
        source: 'subscriber',
        subscriberSource: row.source ?? null,
        unsubscribeToken: row.unsubscribe_token ?? null,
        userId: null,
        subscriberEmail: email,
      });
    }
  }

  if (scope === 'accounts' || scope === 'all') {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, first_name, last_name, full_name, marketing_opt_out')
      .eq('marketing_opt_out', false);

    if (error) throw new Error(`Could not load account audience. Run the email marketing migration first. ${error.message}`);

    for (const row of data ?? []) {
      const email = normalizeEmail(row.email);
      if (!isValidEmail(email)) continue;
      const existing = byEmail.get(email);
      const name = row.full_name || [row.first_name, row.last_name].filter(Boolean).join(' ') || null;
      byEmail.set(email, {
        email,
        name: existing?.name ?? name,
        source: existing ? combineSource(existing.source, 'account') : 'account',
        subscriberSource: existing?.subscriberSource ?? null,
        unsubscribeToken: existing?.unsubscribeToken ?? null,
        userId: row.id ?? null,
        subscriberEmail: existing?.subscriberEmail ?? null,
      });
    }
  }

  if (scope === 'buyers' || scope === 'all') {
    const { data, error } = await supabase
      .from('buyers')
      .select('email, name, user_id, marketing_opt_out')
      .eq('marketing_opt_out', false);

    if (error) throw new Error(`Could not load buyer audience. Run the buyers migration first. ${error.message}`);

    for (const row of data ?? []) {
      const email = normalizeEmail(row.email);
      if (!isValidEmail(email)) continue;
      const existing = byEmail.get(email);
      byEmail.set(email, {
        email,
        name: existing?.name ?? (row.name ?? null),
        source: existing ? combineSource(existing.source, 'buyer') : 'buyer',
        subscriberSource: existing?.subscriberSource ?? null,
        unsubscribeToken: existing?.unsubscribeToken ?? null,
        userId: existing?.userId ?? (row.user_id ?? null),
        subscriberEmail: existing?.subscriberEmail ?? null,
      });
    }
  }

  return [...byEmail.values()].sort((a, b) => a.email.localeCompare(b.email));
}

export async function getMarketingSettings(): Promise<MarketingSettings> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('marketing_settings')
    .select('mailing_address')
    .eq('id', true)
    .maybeSingle();

  const noReplyFromAddress = process.env.MARKETING_NOREPLY_FROM
    || process.env.EMAIL_FROM
    || process.env.RESEND_FROM
    || 'Naples Estate Jewelry <noreply@naplesestatejewelry.co>';
  const chrisFromAddress = process.env.MARKETING_CHRIS_FROM
    || 'Chris at Naples Estate Jewelry <chris@naplesestatejewelry.co>';
  const chrisReplyTo = process.env.MARKETING_CHRIS_REPLY_TO || 'chris@naplesestatejewelry.co';

  return {
    mailingAddress: (data?.mailing_address || process.env.MARKETING_MAILING_ADDRESS || '').trim() || null,
    siteUrl: marketingSiteUrl(),
    fromAddress: chrisFromAddress,
    senderProfiles: {
      no_reply: {
        fromAddress: noReplyFromAddress,
        label: 'No-reply address',
        replyTo: null,
      },
      chris: {
        fromAddress: chrisFromAddress,
        label: 'Chris reply-enabled',
        replyTo: chrisReplyTo,
      },
    },
    transport: activeMarketingTransport(),
  };
}

export function senderForProfile(settings: MarketingSettings, profile: MarketingSenderProfile) {
  return settings.senderProfiles[profile] ?? settings.senderProfiles.chris;
}

export function unsubscribeUrlFor(recipient: MarketingRecipient, siteUrl = marketingSiteUrl()) {
  const params = new URLSearchParams();
  if (recipient.unsubscribeToken) params.set('token', recipient.unsubscribeToken);
  params.set('email', recipient.email);
  return `${siteUrl}/unsubscribe?${params.toString()}`;
}

export function stableEventId(campaignId: string, email: string, type: string, url?: string | null) {
  return createHash('sha256').update(`${campaignId}:${normalizeEmail(email)}:${type}:${url ?? ''}`).digest('hex');
}

export async function sendDirectMarketingCampaign({
  campaignId,
  subject,
  html,
  recipients,
  senderProfile = 'chris',
  settings,
}: {
  campaignId: string;
  subject: string;
  html: string;
  recipients: MarketingRecipient[];
  senderProfile?: MarketingSenderProfile;
  settings: MarketingSettings;
}) {
  if (!settings.mailingAddress) throw new Error('A physical mailing address is required before sending marketing email.');
  const apiKey = process.env.EMAIL_PROVIDER_API_KEY || process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('EMAIL_PROVIDER_API_KEY or RESEND_API_KEY is required before sending marketing email.');

  const { Resend } = await import('resend');
  const resend = new Resend(apiKey);
  const perRecipient: { email: string; ok: boolean; error?: string }[] = [];
  const sender = senderForProfile(settings, senderProfile);

  for (const recipient of recipients) {
    const unsubscribeUrl = unsubscribeUrlFor(recipient, settings.siteUrl);
    try {
      await resend.emails.send({
        from: sender.fromAddress,
        to: recipient.email,
        subject,
        html: withMarketingFooter(html, unsubscribeUrl, settings.mailingAddress),
        replyTo: sender.replyTo ?? undefined,
        headers: {
          'List-Unsubscribe': `<${unsubscribeUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
        tags: [
          { name: 'campaign_id', value: campaignId },
          { name: 'marketing', value: 'true' },
        ],
      });
      perRecipient.push({ email: recipient.email, ok: true });
    } catch (err) {
      perRecipient.push({
        email: recipient.email,
        ok: false,
        error: err instanceof Error ? err.message : 'Send failed',
      });
    }
  }

  return {
    sent: perRecipient.filter((item) => item.ok).length,
    failed: perRecipient.filter((item) => !item.ok).length,
    perRecipient,
  };
}

export async function suppressMarketingEmail(email: string) {
  const normalized = normalizeEmail(email);
  if (!isValidEmail(normalized)) return;

  const supabase = createServiceClient();
  await Promise.all([
    supabase
      .from('homepage_subscribers')
      .update({ subscribed: false, unsubscribed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('email', normalized),
    supabase
      .from('profiles')
      .update({ marketing_opt_out: true, marketing_opt_in: false, updated_at: new Date().toISOString() })
      .eq('email', normalized),
    // A buyer-only email (no newsletter signup, no account) has nowhere else
    // to record this — without it, they could be re-emailed the next time a
    // "Buyers" campaign goes out.
    supabase
      .from('buyers')
      .update({ marketing_opt_out: true })
      .eq('email', normalized),
  ]);
}
