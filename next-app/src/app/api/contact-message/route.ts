import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { createAdminNotification } from '@/lib/admin-notify';
import { PRODUCT_IMAGES_BUCKET } from '@/lib/product-image-storage';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export const runtime = 'nodejs';

const OWNER_EMAIL = 'rcman12589@gmail.com';
const FROM = 'Naples Estate Jewelry <noreply@naplesestatejewelry.co>';

const MAX_NAME = 200;
const MAX_EMAIL = 320;
const MAX_PHONE = 60;
const MAX_MESSAGE = 5000;
const MAX_FILES = 6;
const MAX_BYTES = 15 * 1024 * 1024; // 15 MB per photo

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Best-effort owner notification email. Returns true if an email was sent. */
async function sendOwnerEmail(name: string, email: string, phone: string, message: string, imageUrls: string[]): Promise<boolean> {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return false;
  try {
    const { Resend } = await import('resend');
    const resend = new Resend(resendKey);
    const photoHtml = imageUrls.length
      ? `<p><strong>Photos (${imageUrls.length}):</strong></p>` +
        imageUrls.map((u) => `<p><a href="${esc(u)}">${esc(u)}</a></p>`).join('')
      : '';
    const sender = name || phone;
    const emailOpts: Parameters<InstanceType<typeof Resend>['emails']['send']>[0] = {
      from: FROM,
      to: OWNER_EMAIL,
      subject: `New website message from ${sender}`,
      html: `<p><strong>Name:</strong> ${name ? esc(name) : 'Not provided'}</p>
             <p><strong>Email:</strong> ${email ? esc(email) : 'Not provided'}</p>
             <p><strong>Phone:</strong> ${esc(phone)}</p>
             <p><strong>Message:</strong></p>
             <p>${esc(message).replace(/\n/g, '<br>')}</p>
             ${photoHtml}`,
    };
    if (email) emailOpts.replyTo = email;
    await resend.emails.send(emailOpts);
    return true;
  } catch (emailErr) {
    console.error('Contact message email error:', emailErr);
    return false;
  }
}

export async function POST(req: Request) {
  const ip = getClientIp(req);
  if (!(await checkRateLimit(`contact-message:${ip}`, 5, 3600))) {
    return NextResponse.json({ error: 'Too many requests. Please try again in a bit.' }, { status: 429 });
  }

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  // Honeypot — silently accept and drop obvious bots.
  if (String(form.get('bot-field') ?? '').trim()) return NextResponse.json({ success: true });

  const name = String(form.get('name') ?? '').trim().slice(0, MAX_NAME);
  const email = String(form.get('email') ?? '').trim().slice(0, MAX_EMAIL);
  const phone = String(form.get('phone') ?? '').trim().slice(0, MAX_PHONE);
  const message = String(form.get('message') ?? '').trim().slice(0, MAX_MESSAGE);

  if (!phone || !message) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }
  const phoneDigits = phone.replace(/\D/g, '');
  if (phoneDigits.length < 10 || phoneDigits.length > 15) {
    return NextResponse.json({ error: 'Please enter a valid phone number (at least 10 digits).' }, { status: 400 });
  }
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
  }

  // Service-role client: required to upload photos (Storage RLS) and to write the
  // admin_notifications row (admin-only RLS). Runs server-side so the key is never
  // exposed to the browser.
  let service: ReturnType<typeof createServiceClient> | null = null;
  try {
    service = createServiceClient();
  } catch {
    service = null;
  }

  // Collect and upload any attached photos to the messages/ prefix.
  const files: File[] = [];
  for (const [, value] of form.entries()) {
    if (value instanceof File && value.size > 0) files.push(value);
  }
  const accepted = files
    .filter((f) => f.type.startsWith('image/') && f.size <= MAX_BYTES)
    .slice(0, MAX_FILES);

  const imageUrls: string[] = [];
  if (service && accepted.length) {
    const bucket = service.storage.from(PRODUCT_IMAGES_BUCKET);
    for (const file of accepted) {
      try {
        const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
        const path = `messages/${crypto.randomUUID()}.${ext}`;
        const buffer = Buffer.from(await file.arrayBuffer());
        const { error: upErr } = await bucket.upload(path, buffer, {
          contentType: file.type || 'image/jpeg',
          cacheControl: '31536000',
          upsert: false,
        });
        if (!upErr) {
          const { data } = bucket.getPublicUrl(path);
          if (data?.publicUrl) imageUrls.push(data.publicUrl);
        }
      } catch (uploadErr) {
        console.error('Contact message photo upload error:', uploadErr);
      }
    }
  }

  const notificationBody = phone ? `${message}\n\nPhone: ${phone}` : message;

  // Insert into the admin message center.
  const sender = name || phone;
  const savedToMessages = service
    ? await createAdminNotification(service, {
        type: 'message',
        title: `Message from ${sender}`,
        body: notificationBody,
        customerName: name || null,
        customerEmail: email || null,
        imageUrls,
      })
    : false;

  // Best-effort email backup so the message reaches the owner even if the message
  // center write is unavailable (e.g. service role not configured).
  const emailed = await sendOwnerEmail(name, email, phone, message, imageUrls);

  if (!savedToMessages && !emailed) {
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
