import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import SiteHeader from '@/components/layout/SiteHeader';
import SignOutButton from '@/components/account/SignOutButton';
import SiteFooter from '@/components/layout/SiteFooter';

export const metadata: Metadata = {
  title: 'My Account',
};

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function AccountPage({ params }: Props) {
  const { locale } = await params;
  const isEs = locale === 'es';

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect(isEs ? '/es/account/sign-in' : '/account/sign-in');
  }

  // Check admin status
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin, full_name')
    .eq('id', user.id)
    .single();

  const displayName = profile?.full_name ?? user.email ?? 'Member';
  const isAdmin = profile?.is_admin === true;
  const shopHref = isEs ? '/es/shop' : '/shop';

  return (
    <>
      <SiteHeader />
      <main className="pt-28 md:pt-32 pb-20 px-4 md:px-8 min-h-screen"
        style={{ background: 'var(--color-background)' }}>
        <div className="max-w-2xl mx-auto">

          {/* Header */}
          <div className="mb-10">
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.35em] mb-3"
              style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}>
              {isEs ? 'Mi Cuenta' : 'My Account'}
            </p>
            <h1 className="text-4xl font-bold"
              style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}>
              {isEs ? `Bienvenido, ${displayName}` : `Welcome, ${displayName}`}
            </h1>
          </div>

          {/* Profile card */}
          <div className="border rounded-none p-6 mb-6"
            style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
            <h2 className="text-xs font-bold uppercase tracking-widest mb-4"
              style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}>
              {isEs ? 'Perfil' : 'Profile'}
            </h2>
            <dl className="flex flex-col gap-3">
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs uppercase tracking-wide" style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}>
                  {isEs ? 'Correo' : 'Email'}
                </dt>
                <dd className="text-sm font-medium" style={{ color: 'var(--color-on-surface)' }}>
                  {user.email}
                </dd>
              </div>
              {profile?.full_name && (
                <div className="flex flex-col gap-0.5">
                  <dt className="text-xs uppercase tracking-wide" style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}>
                    {isEs ? 'Nombre' : 'Name'}
                  </dt>
                  <dd className="text-sm font-medium" style={{ color: 'var(--color-on-surface)' }}>
                    {profile.full_name}
                  </dd>
                </div>
              )}
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs uppercase tracking-wide" style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}>
                  {isEs ? 'Tipo de cuenta' : 'Account type'}
                </dt>
                <dd className="text-sm font-medium" style={{ color: 'var(--color-on-surface)' }}>
                  {isAdmin
                    ? (isEs ? 'Administrador' : 'Administrator')
                    : (isEs ? 'Miembro' : 'Member')}
                </dd>
              </div>
            </dl>
          </div>

          {/* Admin shortcut */}
          {isAdmin && (
            <div className="border p-6 mb-6"
              style={{ borderColor: 'var(--color-primary)', background: 'color-mix(in srgb, var(--color-primary) 5%, transparent)' }}>
              <h2 className="text-xs font-bold uppercase tracking-widest mb-2"
                style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}>
                {isEs ? 'Panel de Administración' : 'Admin Panel'}
              </h2>
              <p className="text-sm mb-4" style={{ color: 'var(--color-on-surface-variant)' }}>
                {isEs ? 'Gestionar productos, imágenes y precios.' : 'Manage products, images, and pricing.'}
              </p>
              <Link href="/admin/index.html" className="gold-button text-sm">
                {isEs ? 'Abrir Admin' : 'Open Admin Panel'}
              </Link>
            </div>
          )}

          {/* Quick links */}
          <div className="border p-6 mb-8"
            style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
            <h2 className="text-xs font-bold uppercase tracking-widest mb-4"
              style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}>
              {isEs ? 'Explorar' : 'Explore'}
            </h2>
            <div className="flex flex-wrap gap-3">
              <Link href={shopHref} className="outline-button text-sm">
                {isEs ? 'Ver Tienda' : 'Browse Shop'}
              </Link>
              <Link href={isEs ? '/es/contact' : '/contact'} className="outline-button text-sm">
                {isEs ? 'Contacto' : 'Contact Us'}
              </Link>
            </div>
          </div>

          {/* Sign out */}
          <SignOutButton
            label={isEs ? 'Cerrar Sesión' : 'Sign Out'}
            locale={locale}
          />

        </div>
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}
