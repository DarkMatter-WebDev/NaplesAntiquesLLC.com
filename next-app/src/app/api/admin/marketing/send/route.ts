import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/service';
import {
  buildMarketingAudience,
  getMarketingSettings,
  normalizeSenderProfile,
  senderForProfile,
  sendDirectMarketingCampaign,
  type AudienceScope,
} from '@/lib/marketing';

function normalizeScope(value: unknown): AudienceScope {
  return value === 'subscribers' || value === 'accounts' || value === 'all' ? value : 'all';
}

export async function POST(req: Request) {
  const { user, supabase: adminSupabase, error } = await requireAdmin();
  if (error) return error;

  const body = await req.json().catch(() => null);
  const subject = typeof body?.subject === 'string' ? body.subject.trim() : '';
  const html = typeof body?.html === 'string' ? body.html.trim() : '';
  const scope = normalizeScope(body?.scope);
  const senderProfile = normalizeSenderProfile(body?.senderProfile);

  if (!subject) return NextResponse.json({ error: 'Subject is required.' }, { status: 400 });
  if (!html) return NextResponse.json({ error: 'Email HTML/body is required.' }, { status: 400 });
  if (html.length > 100000) return NextResponse.json({ error: 'Email body is too long.' }, { status: 400 });

  try {
    const settings = await getMarketingSettings();
    if (!settings.mailingAddress) {
      return NextResponse.json({ error: 'Set a physical mailing address in Admin Settings before sending marketing email.' }, { status: 400 });
    }
    if (settings.transport === 'broadcast') {
      return NextResponse.json({ error: 'Broadcast transport is configured but not implemented for this site yet. Use MARKETING_TRANSPORT=direct.' }, { status: 400 });
    }

    const recipients = await buildMarketingAudience(scope, adminSupabase);
    if (recipients.length === 0) return NextResponse.json({ error: 'No eligible recipients for this audience.' }, { status: 400 });

    const supabase = createServiceClient();
    const sender = senderForProfile(settings, senderProfile);
    const campaignInsert = {
        subject,
        html,
        audience_scope: scope,
        sender_profile: senderProfile,
        from_address: sender.fromAddress,
        reply_to: sender.replyTo,
        transport: settings.transport,
        status: 'sending',
        total_count: recipients.length,
        created_by: user.id,
      };
    let { data: campaign, error: campaignError } = await supabase
      .from('email_campaigns')
      .insert(campaignInsert)
      .select('id')
      .single();

    if (campaignError?.code === '42703') {
      const fallback = await supabase
        .from('email_campaigns')
        .insert({
          subject,
          html,
          audience_scope: scope,
          transport: settings.transport,
          status: 'sending',
          total_count: recipients.length,
          created_by: user.id,
        })
        .select('id')
        .single();
      campaign = fallback.data;
      campaignError = fallback.error;
    }

    if (campaignError || !campaign?.id) throw campaignError ?? new Error('Campaign could not be created.');

    await supabase.from('email_campaign_sends').insert(
      recipients.map((recipient) => ({
        campaign_id: campaign.id,
        email: recipient.email,
        status: 'pending',
      }))
    );

    const result = await sendDirectMarketingCampaign({
      campaignId: campaign.id,
      subject,
      html,
      recipients,
      senderProfile,
      settings,
    });

    await Promise.all(result.perRecipient.map((item) => (
      supabase
        .from('email_campaign_sends')
        .update({
          status: item.ok ? 'sent' : 'failed',
          error: item.error ?? null,
          sent_at: item.ok ? new Date().toISOString() : null,
        })
        .eq('campaign_id', campaign.id)
        .eq('email', item.email)
    )));

    await supabase
      .from('email_campaigns')
      .update({
        status: result.failed > 0 && result.sent === 0 ? 'failed' : 'sent',
        sent_count: result.sent,
        failed_count: result.failed,
        sent_at: new Date().toISOString(),
      })
      .eq('id', campaign.id);

    return NextResponse.json({ success: true, campaignId: campaign.id, sent: result.sent, failed: result.failed, total: recipients.length });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not send marketing campaign.' },
      { status: 500 }
    );
  }
}
