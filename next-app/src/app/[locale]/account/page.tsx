import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import SiteHeader from '@/components/layout/SiteHeader';
import SignOutButton from '@/components/account/SignOutButton';
import AccountProfileForm, { type CustomerProfile } from '@/components/account/AccountProfileForm';
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

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  const profileData = (profile ?? {}) as Partial<CustomerProfile> & { is_admin?: boolean };
  const displayName = profileData.full_name ?? user.email ?? 'Member';
  const isAdmin = profileData.is_admin === true;
  const shopHref = isEs ? '/es/shop' : '/shop';
  const editableProfile: CustomerProfile = {
    id: user.id,
    first_name: profileData.first_name ?? null,
    last_name: profileData.last_name ?? null,
    full_name: profileData.full_name ?? null,
    email: profileData.email ?? user.email ?? null,
    phone: profileData.phone ?? null,
    alternate_phone: profileData.alternate_phone ?? null,
    address_line1: profileData.address_line1 ?? null,
    address_line2: profileData.address_line2 ?? null,
    city: profileData.city ?? null,
    state: profileData.state ?? null,
    postal_code: profileData.postal_code ?? null,
    country: profileData.country ?? 'United States',
    marketing_opt_in: profileData.marketing_opt_in ?? false,
  };

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
              <Link href={isEs ? '/es/admin' : '/admin'} className="gold-button text-sm">
                {isEs ? 'Abrir Admin' : 'Open Admin Panel'}
              </Link>
            </div>
          )}

          <AccountProfileForm profile={editableProfile} fallbackEmail={user.email ?? null} locale={locale} />

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
              {profileData.full_name && (
                <div className="flex flex-col gap-0.5">
                  <dt className="text-xs uppercase tracking-wide" style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}>
                    {isEs ? 'Nombre' : 'Name'}
                  </dt>
                  <dd className="text-sm font-medium" style={{ color: 'var(--color-on-surface)' }}>
                    {profileData.full_name}
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
