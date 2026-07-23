import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import SiteHeader from '@/components/layout/SiteHeader';
import { AccountSideRail, AccountSupportStrip, AccountTabs, PasswordChangeForm } from '@/components/account/AccountDashboard';
import { type CustomerProfile } from '@/components/account/AccountProfileForm';
import SiteFooter from '@/components/layout/SiteFooter';
import { getAccountMetadata } from '@/lib/account-metadata';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return getAccountMetadata('security', locale);
}

const SECURITY_PROFILE_COLUMNS = [
  'first_name',
  'full_name',
  'email',
  'is_admin',
].join(', ');

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function AccountSecurityPage({ params }: Props) {
  const { locale } = await params;
  const isEs = locale === 'es';
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect(isEs ? '/es/account/sign-in' : '/account/sign-in');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select(SECURITY_PROFILE_COLUMNS)
    .eq('id', user.id)
    .single();

  const profileData = (profile ?? {}) as Partial<CustomerProfile> & { is_admin?: boolean };
  const displayName = profileData.full_name ?? profileData.first_name ?? user.email ?? 'Member';
  const isAdmin = profileData.is_admin === true;
  const memberSince = user.created_at
    ? new Intl.DateTimeFormat(isEs ? 'es-US' : 'en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(user.created_at))
    : (isEs ? 'No disponible' : 'Not available');

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
                {isEs ? 'Admin y seguridad' : 'Admin and Security'}
              </p>
              <h1
                className="text-4xl md:text-5xl font-bold leading-tight"
                style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}
              >
                {isEs ? `Seguridad de ${displayName}` : `${displayName}'s Security`}
              </h1>
              <p className="mt-5 max-w-xl text-sm md:text-base leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>
                {isEs
                  ? 'Administra el acceso a tu cuenta y cambia tu contraseña.'
                  : 'Manage account access and change your password.'}
              </p>
            </div>
          </div>
        </section>

        <div className="account-content max-w-6xl mx-auto px-4 md:px-8">
          <AccountTabs activeSection="security" locale={locale} />

          <section className="account-dashboard-grid">
            <div className="account-card account-tab-card">
              <p className="account-tab-eyebrow">{isEs ? 'Seguridad' : 'Security'}</p>
              <h2>{isEs ? 'Cambiar contraseña' : 'Change Password'}</h2>
              <p>
                {isEs
                  ? 'Actualiza la contraseña de tu cuenta. Usa una contraseña privada y difícil de adivinar.'
                  : 'Update your account password. Use a private password that is difficult to guess.'}
              </p>
              <div className="account-security-card">
                <span className="material-symbols-outlined" aria-hidden="true">lock_reset</span>
                <div>
                  <strong>{isEs ? 'Acceso de cuenta' : 'Account access'}</strong>
                  <p>{isEs ? 'Cambia tu contraseña cuando lo necesites.' : 'Change your password whenever you need to.'}</p>
                </div>
              </div>
              <PasswordChangeForm locale={locale} />
            </div>

            <AccountSideRail locale={locale} fallbackEmail={user.email ?? null} isAdmin={isAdmin} memberSince={memberSince} />
          </section>

          <AccountSupportStrip locale={locale} />
        </div>
      </main>
      <SiteFooter locale={locale} />
      <style>{`
        .account-page {
          position: relative;
          isolation: isolate;
          background: #ffffff;
        }
        .account-page::before {
          content: '';
          position: fixed;
          top: 0;
          right: 0;
          left: 0;
          height: min(42rem, 82vh);
          pointer-events: none;
          z-index: 0;
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 0) 64%, rgba(255, 255, 255, 0.86) 91%, #ffffff 100%),
            linear-gradient(90deg, #ffffff 0%, rgba(255, 255, 255, 0.94) 35%, rgba(255, 255, 255, 0.26) 62%, rgba(255, 255, 255, 0.02) 100%),
            url('/assets/images/pages/account-hero-jewelry.webp') top right / cover no-repeat;
        }
        .account-hero {
          position: relative;
          min-height: 19.625rem;
          display: flex;
          align-items: center;
          overflow: visible;
          z-index: 1;
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
          margin-top: -2.35rem;
        }
        .account-card {
          border: 1px solid rgba(115, 92, 0, 0.12) !important;
          border-radius: var(--radius-xl);
          background: #ffffff !important;
          box-shadow: 0 18px 48px rgba(42, 34, 12, 0.09);
        }
        .account-tabs {
          display: flex;
          align-items: stretch;
          overflow-x: auto;
          border: 1px solid rgba(115, 92, 0, 0.1);
          border-radius: var(--radius-xl);
          background: #ffffff;
          box-shadow: 0 18px 50px rgba(42, 34, 12, 0.08);
        }
        .account-tabs button,
        .account-tabs a {
          position: relative;
          min-width: 10.5rem;
          min-height: 4.6rem;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.65rem;
          padding: 1rem 1.25rem;
          color: var(--color-on-surface-variant);
          font-size: 0.82rem;
          font-weight: 700;
          white-space: nowrap;
          border-right: 1px solid rgba(115, 92, 0, 0.1);
          background: transparent;
          cursor: pointer;
        }
        .account-tabs button:last-child,
        .account-tabs a:last-child {
          border-right: 0;
        }
        .account-tabs button.active,
        .account-tabs a.active {
          color: var(--color-primary);
        }
        .account-tabs button.active::after,
        .account-tabs a.active::after {
          content: '';
          position: absolute;
          right: 1rem;
          bottom: 0;
          left: 1rem;
          height: 2px;
          background: linear-gradient(135deg, #dcb336, #b5890c);
        }
        .account-tabs .material-symbols-outlined {
          font-size: 1.25rem;
        }
        .account-dashboard-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.9fr) minmax(18rem, 1fr);
          gap: 1.45rem;
          margin-top: 1.45rem;
          align-items: start;
        }
        .account-tab-card {
          min-height: 31rem;
          padding: 2.1rem;
        }
        .account-side-card {
          padding: 2rem;
        }
        .account-tab-eyebrow,
        .account-detail-grid span {
          color: var(--color-primary);
          font-family: var(--font-label);
          font-size: 0.62rem;
          font-weight: 800;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }
        .account-tab-card h2,
        .account-side-card h2 {
          margin-top: 0.35rem;
          color: var(--color-on-surface);
          font-size: 1.15rem;
          font-weight: 800;
        }
        .account-tab-card > p:not(.account-tab-eyebrow),
        .account-side-card p {
          margin-top: 0.35rem;
          color: var(--color-on-surface-variant);
          font-size: 0.9rem;
          line-height: 1.45;
        }
        .account-side-card h2 {
          font-size: 1.05rem;
          margin-bottom: 0.45rem;
        }
        .account-side-card p {
          margin-top: 0;
          margin-bottom: 1.35rem;
          font-size: 0.86rem;
        }
        .account-security-card {
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 1rem;
          align-items: center;
          margin: 1.5rem 0;
          padding: 1rem;
          border: 1px solid rgba(115, 92, 0, 0.12);
          border-radius: var(--radius-xl);
          background: #ffffff;
        }
        .account-security-card > .material-symbols-outlined,
        .account-card-icon {
          width: 3.65rem;
          height: 3.65rem;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: #a98208;
          background: rgba(212, 175, 55, 0.12);
        }
        .account-security-card strong,
        .account-detail-grid strong {
          display: block;
          color: var(--color-on-surface);
          font-size: 0.92rem;
          overflow-wrap: anywhere;
        }
        .account-side-rail {
          display: grid;
          gap: 1.2rem;
        }
        .account-admin-card {
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 1rem;
          align-items: center;
        }
        .account-detail-grid {
          display: grid;
          gap: 1.1rem;
          margin: 1.4rem 0 1rem;
        }
        .account-shop-card {
          position: relative;
          overflow: hidden;
          min-height: 10.5rem;
          display: flex;
          justify-content: space-between;
          gap: 1rem;
        }
        .account-shop-card > .material-symbols-outlined {
          align-self: flex-end;
          color: rgba(115, 92, 0, 0.08);
          font-size: 5.5rem;
        }
        .account-password-panel {
          display: grid;
          gap: 0.8rem;
          margin-top: 1rem;
        }
        .account-password-panel form {
          display: grid;
          gap: 0.75rem;
          padding: 1rem;
          border: 1px solid rgba(115, 92, 0, 0.12);
          border-radius: var(--radius-xl);
          background: #ffffff;
        }
        .account-password-panel .form-field {
          min-height: 2.7rem;
          border-color: rgba(115, 92, 0, 0.2);
          border-radius: var(--radius-lg);
          background: #ffffff;
        }
        .account-form-error {
          color: var(--color-error);
          font-size: 0.78rem;
          font-weight: 700;
        }
        .account-form-success {
          color: var(--color-primary);
          font-size: 0.78rem;
          font-weight: 700;
        }
        .account-support-strip {
          display: grid;
          grid-template-columns: 1.25fr 1fr 1fr auto;
          gap: 1.5rem;
          align-items: center;
          margin: 1.45rem 0 4rem;
          padding: 1.65rem 2rem;
          border: 1px solid rgba(115, 92, 0, 0.12);
          border-radius: var(--radius-xl);
          background: #ffffff;
          box-shadow: 0 18px 48px rgba(42, 34, 12, 0.07);
        }
        .account-support-strip h2 {
          color: var(--color-on-surface);
          font-size: 1rem;
          font-weight: 800;
          margin-bottom: 0.25rem;
        }
        .account-support-strip p,
        .account-support-strip a {
          color: var(--color-on-surface-variant);
          font-size: 0.86rem;
        }
        .account-support-item {
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 0.8rem;
          align-items: center;
        }
        .account-support-item > .material-symbols-outlined {
          color: var(--color-primary);
          font-size: 1.8rem;
        }
        .account-support-item strong {
          display: block;
          color: var(--color-on-surface);
          font-size: 0.84rem;
          font-weight: 700;
          margin-bottom: 0.18rem;
        }
        .account-arrow-button {
          align-items: center;
          gap: 0.35rem;
        }
        .account-arrow-button .material-symbols-outlined {
          font-size: 1rem;
        }
        @media (max-width: 700px) {
          .account-hero {
            min-height: 17rem;
          }
          .account-page::before {
            opacity: 0.72;
            background-position: 62% center;
            height: 32rem;
          }
          .account-content {
            margin-top: -1.1rem;
          }
          .account-tabs {
            margin-inline: 0;
            overflow-x: hidden;
          }
          .account-tabs button,
          .account-tabs a {
            min-width: 0;
            flex: 1 1 0;
            flex-direction: column;
            gap: 0.28rem;
            padding: 0.55rem 0.3rem;
            min-height: 0;
            font-size: 0.6rem;
            line-height: 1.15;
            white-space: normal;
            text-align: center;
          }
          .account-tabs .material-symbols-outlined {
            font-size: 1.15rem;
          }
          .account-tabs button.active::after,
          .account-tabs a.active::after {
            right: 0.4rem;
            left: 0.4rem;
          }
          .account-dashboard-grid,
          .account-support-strip {
            grid-template-columns: 1fr;
          }
          .account-support-strip {
            padding: 1.35rem;
          }
        }
      `}</style>
    </>
  );
}
