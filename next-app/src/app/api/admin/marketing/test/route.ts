import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import {
  getMarketingSettings,
  normalizeSenderProfile,
  sendDirectMarketingCampaign,
  type MarketingRecipient,
} from '@/lib/marketing';

export async function POST(req: Request) {
  const { user, error } = await requireAdmin();
  if (error) return error;

  const body = await req.json().catch(() => null);
  const subject = typeof body?.subject === 'string' ? body.subject.trim() : '';
  const html = typeof body?.html === 'string' ? body.html.trim() : '';
  const senderProfile = normalizeSenderProfile(body?.senderProfile);
  const to = user.email;

  if (!to) return NextResponse.json({ error: 'Admin email is unavailable.' }, { status: 400 });
  if (!subject) return NextResponse.json({ error: 'Subject is required.' }, { status: 400 });
  if (!html) return NextResponse.json({ error: 'Email HTML/body is required.' }, { status: 400 });

  try {
    const settings = await getMarketingSettings();
    if (!settings.mailingAddress) {
      return NextResponse.json({ error: 'Set a physical mailing address in Admin Settings before sending a test.' }, { status: 400 });
    }
    const recipient: MarketingRecipient = {
      email: to,
      name: null,
      source: 'account',
      subscriberSource: null,
      unsubscribeToken: null,
      userId: user.id,
      subscriberEmail: null,
    };
    const result = await sendDirectMarketingCampaign({
      campaignId: 'test',
      subject: `[Test] ${subject}`,
      html,
      recipients: [recipient],
      senderProfile,
      settings,
    });
    return NextResponse.json({ success: result.sent === 1, sent: result.sent, failed: result.failed });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not send test email.' },
      { status: 500 }
    );
  }
}
