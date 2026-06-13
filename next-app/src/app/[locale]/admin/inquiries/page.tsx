import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import InquiriesPanel from '@/components/admin/InquiriesPanel';
import type { Inquiry } from '@/components/admin/InquiriesPanel';

export const metadata: Metadata = { title: 'Admin — Inquiries' };

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function AdminInquiriesPage({ params }: Props) {
  const { locale } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect(locale === 'es' ? '/es/account/sign-in' : '/account/sign-in');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if (!profile?.is_admin) {
    redirect(locale === 'es' ? '/es/account' : '/account');
  }

  const { data: inquiries } = await supabase
    .from('inquiries')
    .select('*')
    .order('created_at', { ascending: false });

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-background, #fafaf8)' }}>
      {/* Admin header */}
      <header style={{
        borderBottom: '1px solid rgba(115,92,0,0.2)',
        padding: '0.75rem 2rem',
        display: 'flex',
        alignItems: 'center',
        gap: '1.5rem',
        background: 'white',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        <span style={{
          fontSize: '0.55rem',
          fontWeight: 700,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          background: '#735c00',
          color: 'white',
          padding: '0.2rem 0.5rem',
        }}>
          Admin
        </span>
        <Link
          href={locale === 'es' ? '/es/admin' : '/admin'}
          style={{ fontSize: '0.8125rem', color: '#735c00', textDecoration: 'underline', textUnderlineOffset: '3px' }}
        >
          ← Products
        </Link>
        <span style={{ fontSize: '0.8125rem', color: '#555', fontWeight: 600 }}>Inquiries</span>
        <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#aaa' }}>
          {user.email}
        </span>
      </header>

      <InquiriesPanel inquiries={(inquiries ?? []) as Inquiry[]} />
    </div>
  );
}
