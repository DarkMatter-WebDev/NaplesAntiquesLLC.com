import { NextResponse } from 'next/server';
import { createPublicClient } from '@/lib/supabase/public';
import { createServiceClient } from '@/lib/supabase/service';
import { createAdminNotification } from '@/lib/admin-notify';
import { PRODUCT_IMAGES_BUCKET } from '@/lib/product-image-storage';

export const runtime = 'nodejs';

const OWNER_EMAIL = 'rcman12589@gmail.com';
const FROM = 'Naples Estate Jewelry <noreply@naplesestatejewelry.co>';

type InquiryKind = 'free-evaluation' | 'submit-item' | 'product-inquiry';

/** Human, type-aware notification titles for the unified admin inbox. */
function inquiryNotificationTitle(kind: InquiryKind, name: string, itemTitle: string): string {
  const who = name.trim() || 'a customer';
  switch (kind) {
    case 'free-evaluation':
      return `Free evaluation request from ${who}`;
    case 'submit-item':
      return `Item submission from ${who}`;
    case 'product-inquiry':
      return `Inquiry about ${itemTitle} from ${who}`;
  }
}

/**
 * Also drop every inquiry into the admin message center (unified inbox), so lead
 * submissions show up alongside contact messages and order notifications — with
 * any uploaded photos attached. Best-effort: requires the service-role client and
 * its admin_notifications INSERT grant; a failure here never fails the request,
 * since the inquiry row + owner email already captured the submission.
 */
async function notifyAdminOfInquiry(input: {
  kind: InquiryKind;
  itemTitle: string;
  name: string;
  phone: string;
  email: string | null;
  message: string;
  imageUrls: string[];
}) {
  let service;
  try {
    service = createServiceClient();
  } catch {
    return;
  }
  await createAdminNotification(service, {
    type: 'inquiry',
    title: inquiryNotificationTitle(input.kind, input.name, input.itemTitle),
    body: input.phone ? `${input.message}\n\nPhone: ${input.phone}` : input.message,
    customerName: input.name,
    customerEmail: input.email,
    imageUrls: input.imageUrls,
  });
}

const MAX_FILES = 10;
const MAX_BYTES = 15 * 1024 * 1024; // 15 MB per photo

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

interface EmailPayload {
  itemTitle: string;
  name: string;
  phone: string;
  email: string | null;
  message: string;
  imageUrls: string[];
}

async function sendEmails({ itemTitle, name, phone, email, message, imageUrls }: EmailPayload) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return;

  try {
    const { Resend } = await import('resend');
    const resend = new Resend(resendKey);

    const photoHtml = imageUrls.length
      ? `<p><strong>Photos (${imageUrls.length}):</strong></p>` +
        imageUrls.map((u) => `<p><a href="${esc(u)}">${esc(u)}</a></p>`).join('')
      : '<p><em>No photos attached.</em></p>';

    // Notify owner
    await resend.emails.send({
      from: FROM,
      to: OWNER_EMAIL,
      subject: `New inquiry: ${itemTitle}`,
      html: `<p><strong>Item:</strong> ${esc(itemTitle)}</p>
             <p><strong>Name:</strong> ${esc(name)}</p>
             <p><strong>Phone:</strong> ${esc(phone)}</p>
             <p><strong>Email:</strong> ${email ? esc(email) : 'Not provided'}</p>
             <p><strong>Message:</strong></p>
             <p>${esc(message).replace(/\n/g, '<br>')}</p>
             ${photoHtml}`,
    });

    // Confirm to customer
    if (email) {
      await resend.emails.send({
        from: FROM,
        to: email,
        subject: `We received your inquiry about: ${itemTitle}`,
        html: `<p>Hi ${esc(name)},</p>
               <p>Thank you for your interest in <strong>${esc(itemTitle)}</strong>. We will be in touch with you shortly.</p>
               <p>For urgent questions, call us at <a href="tel:2394048505">(239) 404-8505</a>.</p>
               <p>— Naples Estate Jewelry</p>`,
      });
    }
  } catch (emailErr) {
    console.error('Resend email error:', emailErr);
  }
}

/**
 * JSON path — product inquiry from the shop (no file uploads).
 * Preserves the original contract used by InquiryForm.
 */
async function handleJsonInquiry(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const { item, name, phone, email, message } = body as Record<string, string>;
  if (!item || !name || !phone || !message) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Insert as the anon role, which holds the public-insert grant on inquiries.
  // (The service role is intentionally not used here — it lacks INSERT on the table.)
  const supabase = createPublicClient();
  const { error } = await supabase.from('inquiries').insert({
    item_title: item,
    name,
    phone,
    email: email || null,
    message,
  });

  if (error) {
    console.error('Inquiry insert error:', error);
    return NextResponse.json({ error: 'Failed to save inquiry' }, { status: 500 });
  }

  await notifyAdminOfInquiry({ kind: 'product-inquiry', itemTitle: item, name, phone, email: email || null, message, imageUrls: [] });
  await sendEmails({ itemTitle: item, name, phone, email: email || null, message, imageUrls: [] });

  return NextResponse.json({ success: true });
}

/**
 * Multipart path — lead forms (/contact "submit-item" and /free-evaluation),
 * which include required photo uploads. Photos are uploaded server-side with
 * the service-role client to the product-images bucket (so no anonymous Storage
 * policy is needed) and recorded in inquiries.uploaded_image_urls, which the
 * Storage GC reference scan already tracks.
 */
async function handleLeadForm(req: Request) {
  const form = await req.formData();

  // Honeypot — silently accept and drop obvious bots.
  const honeypot = String(form.get('bot-field') ?? '').trim();
  if (honeypot) return NextResponse.json({ success: true });

  const source = String(form.get('source') ?? '').toLowerCase();
  const name = String(form.get('name') ?? '').trim();
  const phone = String(form.get('phone') ?? '').trim();
  const email = String(form.get('email') ?? '').trim();
  const location = String(form.get('location') ?? '').trim();
  const rawMessage = String(
    form.get('item_description') ?? form.get('description') ?? form.get('message') ?? '',
  ).trim();

  if (!name || !phone) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const itemTitle = source === 'free-evaluation' ? 'Free Evaluation Request' : 'Submit Your Item';

  let message = rawMessage || '(No description provided.)';
  if (location) message += `\n\nLocation: ${location}`;

  // Collect uploaded image files from any field name (photo_1..photo_5, photos[]).
  const files: File[] = [];
  for (const [, value] of form.entries()) {
    if (value instanceof File && value.size > 0) files.push(value);
  }
  const accepted = files
    .filter((f) => f.type.startsWith('image/') && f.size <= MAX_BYTES)
    .slice(0, MAX_FILES);

  // Upload photos with the service-role client (bypasses Storage RLS).
  const imageUrls: string[] = [];
  let service: ReturnType<typeof createServiceClient> | null = null;
  try {
    service = createServiceClient();
  } catch {
    service = null;
  }

  if (service && accepted.length) {
    const bucket = service.storage.from(PRODUCT_IMAGES_BUCKET);
    for (const file of accepted) {
      try {
        const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
        const path = `inquiries/${crypto.randomUUID()}.${ext}`;
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
        console.error('Inquiry photo upload error:', uploadErr);
      }
    }
  }

  // Insert the inquiry as the anon role (it holds the public-insert grant on
  // inquiries). The service role is used ONLY for the Storage upload above — it
  // is NOT used for the row insert, because it lacks INSERT on this table, which
  // is what caused 42501 "permission denied for table inquiries" once a service
  // key was configured.
  const db = createPublicClient();

  const baseRow = {
    item_title: itemTitle,
    name,
    phone,
    email: email || null,
    message,
  };

  let insertError: { message: string } | null = null;
  if (imageUrls.length) {
    const { error } = await db.from('inquiries').insert({ ...baseRow, uploaded_image_urls: imageUrls });
    if (error && /uploaded_image_urls|column|schema cache/i.test(error.message)) {
      // uploaded_image_urls column not present yet (sales-workflow.sql not applied) —
      // keep the URLs in the message so they are never lost.
      const retry = await db
        .from('inquiries')
        .insert({ ...baseRow, message: `${message}\n\nPhotos:\n${imageUrls.join('\n')}` });
      insertError = retry.error;
    } else {
      insertError = error;
    }
  } else {
    const { error } = await db.from('inquiries').insert(baseRow);
    insertError = error;
  }

  if (insertError) {
    console.error('Inquiry insert error:', insertError);
    return NextResponse.json({ error: 'Failed to save inquiry' }, { status: 500 });
  }

  await notifyAdminOfInquiry({
    kind: source === 'free-evaluation' ? 'free-evaluation' : 'submit-item',
    itemTitle, name, phone, email: email || null, message, imageUrls,
  });
  await sendEmails({ itemTitle, name, phone, email: email || null, message, imageUrls });

  return NextResponse.json({ success: true });
}

export async function POST(req: Request) {
  const contentType = req.headers.get('content-type') ?? '';
  if (contentType.includes('multipart/form-data')) {
    return handleLeadForm(req);
  }
  return handleJsonInquiry(req);
}
