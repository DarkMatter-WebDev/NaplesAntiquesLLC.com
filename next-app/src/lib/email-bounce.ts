import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminNotification } from '@/lib/admin-notify';

/**
 * Transactional email bounce handling.
 *
 * `/api/webhooks/resend` already received `email.bounced` events, but it dropped
 * every event without a `campaign_id` — so a bounced ORDER RECEIPT or inquiry
 * confirmation was discarded as "ignored". A buyer could mistype their email at
 * checkout, the receipt would hard-bounce, Resend would report it, and nobody
 * would ever find out.
 *
 * This is ground truth rather than a guess: unlike a "did you mean gmail.com?"
 * heuristic, a hard bounce means the address genuinely failed. That matters here
 * because a plausible-looking address can be perfectly real — `ymail.com` is a
 * genuine Yahoo domain one character from `gmail.com`, so edit-distance
 * suggestions would flag a valid customer.
 */

export type BounceSeverity = 'hard' | 'soft' | 'unknown';

export type BounceClassification = {
  severity: BounceSeverity;
  /** A complaint is someone hitting "spam"; the address itself still works. */
  isComplaint: boolean;
  detail: string | null;
};

/**
 * Classify a Resend bounce payload.
 *
 * Resend forwards SES-style categories in `data.bounce`: `type` is
 * `Permanent` / `Transient` / `Undetermined`, with a `subType` such as
 * `MailboxFull` or `NoEmail`.
 *
 * ⚠️ **Only a CONFIRMED `soft` result is safe to ignore.** The caller suppresses
 * on `hard` AND `unknown`, because this route previously suppressed on any
 * bounce at all, and letting an unrecognised payload through would leave dead
 * addresses on the list — costing sending reputation on the one verified domain
 * that also carries order receipts. So the job here is to identify transient
 * failures confidently; everything else is treated as real.
 */
export function classifyBounceEvent(
  data: Record<string, unknown>,
  isComplaint: boolean,
): BounceClassification {
  if (isComplaint) return { severity: 'hard', isComplaint: true, detail: 'spam complaint' };

  const bounce = (data.bounce ?? {}) as Record<string, unknown>;
  const type = String(bounce.type ?? '').toLowerCase();
  const subType = String(bounce.subType ?? bounce.sub_type ?? '').toLowerCase();
  const detail = [bounce.type, bounce.subType ?? bounce.sub_type]
    .filter(Boolean)
    .map(String)
    .join(' / ') || null;

  if (type.includes('permanent')) return { severity: 'hard', isComplaint: false, detail };
  if (type.includes('transient')) return { severity: 'soft', isComplaint: false, detail };
  // Some providers omit `type` but name the reason.
  if (subType.includes('noemail') || subType.includes('nosuchuser')) {
    return { severity: 'hard', isComplaint: false, detail };
  }
  if (subType.includes('mailboxfull') || subType.includes('messagetoolarge')) {
    return { severity: 'soft', isComplaint: false, detail };
  }
  return { severity: 'unknown', isComplaint: false, detail };
}

export type BounceContext = {
  kind: 'order' | 'inquiry';
  label: string;
  name: string | null;
  phone: string | null;
  createdAt: string | null;
};

/**
 * Find the most recent order and inquiry for a bounced address, so the
 * notification says WHO to chase rather than just quoting an address.
 *
 * Best-effort: a lookup failure must not fail the webhook, or Resend will retry
 * an event we already handled.
 */
export async function findBounceContext(
  service: SupabaseClient,
  email: string,
): Promise<BounceContext[]> {
  const found: BounceContext[] = [];

  const { data: orders } = await service
    .from('orders')
    .select('order_number, customer_name, customer_phone, created_at')
    .eq('customer_email', email)
    .order('created_at', { ascending: false })
    .limit(1);
  if (orders?.[0]) {
    found.push({
      kind: 'order',
      label: `Order ${orders[0].order_number}`,
      name: orders[0].customer_name ?? null,
      phone: orders[0].customer_phone ?? null,
      createdAt: orders[0].created_at ?? null,
    });
  }

  const { data: inquiries } = await service
    .from('inquiries')
    .select('item_title, name, phone, created_at')
    .eq('email', email)
    .order('created_at', { ascending: false })
    .limit(1);
  if (inquiries?.[0]) {
    found.push({
      kind: 'inquiry',
      label: `Inquiry about ${inquiries[0].item_title}`,
      name: inquiries[0].name ?? null,
      phone: inquiries[0].phone ?? null,
      createdAt: inquiries[0].created_at ?? null,
    });
  }

  return found;
}

export function buildBounceNotification(
  email: string,
  classification: BounceClassification,
  contexts: BounceContext[],
) {
  const headline = classification.isComplaint
    ? 'Marked as spam'
    : 'Email could not be delivered';

  const lines = [
    classification.isComplaint
      ? `${email} marked one of our emails as spam. The address still works — do not re-send marketing to it.`
      : `Email to ${email} permanently failed. That address cannot receive mail, so anything we sent it was never read.`,
  ];

  if (classification.detail) lines.push(`Reason reported: ${classification.detail}.`);

  if (contexts.length) {
    lines.push('', 'Related records:');
    for (const context of contexts) {
      const parts = [context.label];
      if (context.name) parts.push(context.name);
      if (context.phone) parts.push(context.phone);
      lines.push(`- ${parts.join(' — ')}`);
    }
    if (!classification.isComplaint) {
      const phone = contexts.find((context) => context.phone)?.phone;
      lines.push(
        '',
        phone
          ? `Reach them by phone instead: ${phone}`
          : 'No phone number on file for this address.',
      );
    }
  } else {
    lines.push('', 'No order or inquiry matches this address.');
  }

  const who = contexts.find((context) => context.name)?.name ?? email;
  return { title: `${headline}: ${who}`, body: lines.join('\n') };
}

/**
 * Record a transactional bounce in the admin message center.
 *
 * Returns whether a notification was written, so the webhook can log it.
 */
export async function recordTransactionalBounce(
  service: SupabaseClient,
  email: string,
  classification: BounceClassification,
): Promise<boolean> {
  const contexts = await findBounceContext(service, email).catch(() => [] as BounceContext[]);
  const { title, body } = buildBounceNotification(email, classification, contexts);

  return createAdminNotification(service, {
    type: 'email_bounce',
    title,
    body,
    customerName: contexts.find((context) => context.name)?.name ?? null,
    customerEmail: email,
  });
}
