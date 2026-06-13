import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const { item, name, phone, email, message } = body as Record<string, string>;
  if (!item || !name || !phone || !message) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const supabase = await createClient();
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

  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    try {
      const { Resend } = await import('resend');
      const resend = new Resend(resendKey);

      // Notify owner
      await resend.emails.send({
        from: 'Naples Estate Jewelry <noreply@naplesestatejewelry.co>',
        to: 'rcman12589@gmail.com',
        subject: `New inquiry: ${item}`,
        html: `<p><strong>Item:</strong> ${item}</p>
               <p><strong>Name:</strong> ${name}</p>
               <p><strong>Phone:</strong> ${phone}</p>
               <p><strong>Email:</strong> ${email || 'Not provided'}</p>
               <p><strong>Message:</strong></p>
               <p>${message.replace(/\n/g, '<br>')}</p>`,
      });

      // Confirm to customer
      if (email) {
        await resend.emails.send({
          from: 'Naples Estate Jewelry <noreply@naplesestatejewelry.co>',
          to: email,
          subject: `We received your inquiry about: ${item}`,
          html: `<p>Hi ${name},</p>
                 <p>Thank you for your interest in <strong>${item}</strong>. We will be in touch with you shortly.</p>
                 <p>For urgent questions, call us at <a href="tel:2394048505">(239) 404-8505</a>.</p>
                 <p>— Naples Estate Jewelry Co</p>`,
        });
      }
    } catch (emailErr) {
      console.error('Resend email error:', emailErr);
    }
  }

  return NextResponse.json({ success: true });
}
