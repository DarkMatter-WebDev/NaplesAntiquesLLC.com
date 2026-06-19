import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { getMarketingSettings } from '@/lib/marketing';

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    return NextResponse.json(await getMarketingSettings());
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not load marketing settings.' },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json().catch(() => null);
  const mailingAddress = typeof body?.mailingAddress === 'string' ? body.mailingAddress.trim() : '';
  if (mailingAddress.length > 1200) {
    return NextResponse.json({ error: 'Mailing address is too long.' }, { status: 400 });
  }

  try {
    const supabase = createServiceClient();
    const { error: saveError } = await supabase
      .from('marketing_settings')
      .upsert({ id: true, mailing_address: mailingAddress || null, updated_at: new Date().toISOString() }, { onConflict: 'id' });

    if (saveError) throw saveError;
    return NextResponse.json(await getMarketingSettings());
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not save marketing settings.' },
      { status: 500 }
    );
  }
}
