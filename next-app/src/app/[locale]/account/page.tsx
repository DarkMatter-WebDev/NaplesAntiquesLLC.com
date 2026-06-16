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
  const displayName = profileData.full_name ?? profileData.first_name ?? user.email ?? 'Member';
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
      <main className="account-page pt-24 md:pt-28 pb-0 min-h-screen">
        <section className="account-hero px-4 md:px-8">
          <div className="account-hero-inner max-w-6xl mx-auto">
            <div className="account-hero-copy">
              <p
                className="text-[0.65rem] font-bold uppercase tracking-[0.35em] mb-3"
                style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}
              >
                {isEs ? 'Mi Cuenta' : 'My Account'}
              </p>
              <h1
                className="text-4xl md:text-5xl font-bold leading-tight"
                style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}
              >
                {isEs ? `Bienvenido, ${displayName}` : `Welcome, ${displayName}`}
              </h1>
              <p className="mt-5 max-w-xl text-sm md:text-base leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>
                {isEs
                  ? 'Administra tu perfil, pedidos y preferencias.'
                  : 'Manage your profile, orders, and preferences.'}
              </p>
            </div>
          </div>
        </section>

        <div className="account-content max-w-6xl mx-auto px-4 md:px-8">
          {isAdmin && (
            <div className="account-card account-admin-card mb-7">
              <div className="account-card-icon" aria-hidden="true">
                <span className="material-symbols-outlined">admin_panel_settings</span>
              </div>
              <div>
                <h2
                  className="text-xs font-bold uppercase tracking-[0.22em] mb-2"
                  style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}
                >
                  {isEs ? 'Panel de Administracion' : 'Admin Panel'}
                </h2>
                <p className="text-sm mb-5" style={{ color: 'var(--color-on-surface-variant)' }}>
                  {isEs ? 'Gestionar productos, imagenes y precios.' : 'Manage products, images, and pricing.'}
                </p>
                <Link href={isEs ? '/es/admin' : '/admin'} className="gold-button text-sm account-arrow-button">
                  {isEs ? 'Abrir Admin' : 'Open Admin Panel'}
                  <span className="material-symbols-outlined" aria-hidden="true">chevron_right</span>
                </Link>
              </div>
            </div>
          )}

          <AccountProfileForm profile={editableProfile} fallbackEmail={user.email ?? null} locale={locale} />

          <div className="account-card account-profile-card mb-8">
            <p
              className="text-xs font-bold uppercase tracking-[0.22em] mb-6"
              style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}
            >
              {isEs ? 'Perfil' : 'Profile'}
            </p>
            <div className="flex flex-col gap-6 md:flex-row md:items-center">
              <div className="account-card-icon" aria-hidden="true">
                <span className="material-symbols-outlined">person</span>
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--color-on-surface)' }}>
                  {isEs ? 'Detalles de cuenta' : 'Account Details'}
                </h2>
                <p className="text-sm mb-4" style={{ color: 'var(--color-on-surface-variant)' }}>
                  {isEs
                    ? 'Actualiza tu informacion o administra la configuracion de tu cuenta.'
                    : 'Update your information or manage your account settings.'}
                </p>
                <div className="account-detail-grid">
                  <div>
                    <span>{isEs ? 'Correo' : 'Email'}</span>
                    <strong>{user.email}</strong>
                  </div>
                  <div>
                    <span>{isEs ? 'Tipo de cuenta' : 'Account type'}</span>
                    <strong>{isAdmin ? (isEs ? 'Administrador' : 'Administrator') : (isEs ? 'Miembro' : 'Member')}</strong>
                  </div>
                </div>
                <Link href={shopHref} className="outline-button text-sm mt-5 account-arrow-button">
                  {isEs ? 'Ver tienda' : 'Browse Shop'}
                  <span className="material-symbols-outlined" aria-hidden="true">chevron_right</span>
                </Link>
              </div>
            </div>
          </div>

          <div className="account-actions mb-12">
            <Link href={isEs ? '/es/contact' : '/contact'} className="outline-button text-sm account-arrow-button">
              {isEs ? 'Contacto' : 'Contact Us'}
              <span className="material-symbols-outlined" aria-hidden="true">chevron_right</span>
            </Link>
            <SignOutButton
              label={isEs ? 'Cerrar Sesion' : 'Sign Out'}
              locale={locale}
            />
          </div>
        </div>

        <section className="account-trust-strip px-4 md:px-8">
          <div className="max-w-6xl mx-auto grid gap-6 md:grid-cols-3">
            {[
              ['lock', isEs ? 'Seguro y privado' : 'Secure & Private', isEs ? 'Tu informacion siempre esta segura con nosotros.' : 'Your information is always safe with us.'],
              ['verified', isEs ? 'Expertos confiables' : 'Trusted Experts', isEs ? 'Decadas de experiencia en oro y joyeria.' : 'Decades of experience in gold and jewelry.'],
              ['support_agent', isEs ? 'Ayuda cuando la necesites' : 'Help When You Need It', isEs ? 'Nuestro equipo esta aqui para apoyarte.' : 'Our team is here to support you.'],
            ].map(([icon, title, copy]) => (
              <div key={title} className="account-trust-item">
                <span className="material-symbols-outlined" aria-hidden="true">{icon}</span>
                <div>
                  <strong>{title}</strong>
                  <p>{copy}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter locale={locale} />
      <style>{`
        .account-page {
          background:
            radial-gradient(circle at 76% 5%, rgba(220, 188, 96, 0.13), transparent 34rem),
            linear-gradient(180deg, #fffdf8 0%, #f8f6f0 44%, #f5f2ea 100%);
        }
        .account-hero {
          position: relative;
          min-height: 19rem;
          display: flex;
          align-items: center;
          overflow: hidden;
        }
        .account-hero::before {
          content: '';
          position: absolute;
          inset: 0;
          background:
            linear-gradient(90deg, #fffdf8 0%, rgba(255, 253, 248, 0.94) 38%, rgba(255, 253, 248, 0.26) 62%, rgba(255, 253, 248, 0.02) 100%),
            url('/assets/images/pages/account-hero-jewelry.png') center right / cover no-repeat;
          z-index: 0;
        }
        .account-hero-inner {
          position: relative;
          z-index: 1;
          width: 100%;
          padding-block: 3.5rem 4rem;
        }
        .account-hero-copy {
          max-width: 42rem;
        }
        .account-content {
          position: relative;
          z-index: 2;
          margin-top: -1.25rem;
        }
        .account-card,
        .account-profile-form {
          border: 1px solid rgba(115, 92, 0, 0.12) !important;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.92) !important;
          box-shadow: 0 18px 48px rgba(42, 34, 12, 0.09);
        }
        .account-admin-card {
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 1.5rem;
          align-items: center;
          padding: 1.8rem 2.2rem;
        }
        .account-card-icon {
          width: 5.75rem;
          height: 5.75rem;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: #a98208;
          background: rgba(212, 175, 55, 0.12);
          flex: 0 0 auto;
        }
        .account-card-icon .material-symbols-outlined {
          font-size: 2.4rem;
        }
        .account-profile-card {
          padding: 1.8rem 2.2rem;
        }
        .account-profile-form .form-field {
          min-height: 3.05rem;
          border-color: rgba(115, 92, 0, 0.2);
          border-radius: 6px;
          background: #fffefa;
        }
        .account-profile-form .form-label {
          color: var(--color-primary);
          font-size: 0.62rem;
          font-weight: 800;
          letter-spacing: 0.14em;
        }
        .account-detail-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 1rem;
          margin-top: 0.5rem;
        }
        .account-detail-grid span {
          display: block;
          color: var(--color-on-surface-variant);
          font-family: var(--font-label);
          font-size: 0.62rem;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }
        .account-detail-grid strong {
          display: block;
          margin-top: 0.25rem;
          color: var(--color-on-surface);
          font-size: 0.92rem;
          overflow-wrap: anywhere;
        }
        .account-arrow-button {
          align-items: center;
          gap: 0.35rem;
        }
        .account-arrow-button .material-symbols-outlined {
          font-size: 1rem;
        }
        .account-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
          align-items: center;
        }
        .account-trust-strip {
          margin-top: 4rem;
          padding-block: 2rem;
          border-top: 1px solid rgba(115, 92, 0, 0.12);
          background: rgba(255, 255, 255, 0.58);
        }
        .account-trust-item {
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 1rem;
          align-items: center;
          padding-inline: 1rem;
        }
        .account-trust-item > .material-symbols-outlined {
          width: 3.35rem;
          height: 3.35rem;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: #a98208;
          background: rgba(212, 175, 55, 0.12);
          font-size: 1.45rem;
        }
        .account-trust-item strong {
          color: var(--color-primary);
          font-family: var(--font-label);
          font-size: 0.68rem;
          font-weight: 800;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }
        .account-trust-item p {
          margin-top: 0.25rem;
          color: var(--color-on-surface-variant);
          font-size: 0.84rem;
          line-height: 1.4;
        }
        @media (max-width: 700px) {
          .account-hero {
            min-height: 17rem;
          }
          .account-hero::before {
            opacity: 0.72;
            background-position: 62% center;
          }
          .account-admin-card,
          .account-profile-card,
          .account-profile-form {
            padding: 1.35rem !important;
          }
          .account-admin-card {
            grid-template-columns: 1fr;
          }
          .account-card-icon {
            width: 4.4rem;
            height: 4.4rem;
          }
          .account-detail-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </>
  );
}
