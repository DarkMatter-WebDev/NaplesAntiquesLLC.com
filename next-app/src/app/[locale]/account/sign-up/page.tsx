'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import SiteHeader from '@/components/layout/SiteHeader';
import { createClient } from '@/lib/supabase/client';
import { AppIcon } from '@/components/AppIcon';
import PasswordInput from '@/components/account/PasswordInput';

const MODERN_AUTH_STYLES = `
  .modern-auth-page {
    background: #ffffff;
  }
  .modern-auth-card {
    position: relative;
    border: 1px solid rgba(115, 92, 0, 0.15);
    border-radius: var(--radius-xl);
    background: #ffffff;
    box-shadow: 0 18px 52px rgba(42, 34, 12, 0.09);
    padding: 3.25rem 2rem 2.25rem;
  }
  .modern-auth-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 3rem;
    height: 3rem;
    margin-bottom: 1.4rem;
    border-radius: 999px;
    color: #a98208;
    background: rgba(212, 175, 55, 0.14);
    font-size: 1.5rem;
    line-height: 1;
  }
  .modern-auth-submit {
    width: 100%;
    min-height: 2.95rem;
    border: none;
    border-radius: var(--radius-lg);
    cursor: pointer;
    background: linear-gradient(135deg, #dcb336, #b5890c);
    color: #fffdf7;
    font-family: var(--font-label);
    font-size: 0.72rem;
    font-weight: 800;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    box-shadow: 0 10px 24px rgba(181, 137, 12, 0.18);
    transition: filter 160ms ease, box-shadow 160ms ease, transform 160ms ease;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    text-decoration: none;
  }
  .modern-auth-submit:hover:not(:disabled) {
    filter: brightness(1.04);
    box-shadow: 0 14px 30px rgba(181, 137, 12, 0.24);
    transform: translateY(-1px);
  }
  .modern-auth-submit:disabled {
    cursor: default;
  }
  /* Password fields use the shared .password-field utility in globals.css
     (see components/account/PasswordInput.tsx) — the old .modern-password-*
     block lived here and rendered a differently sized input than the email
     field directly above it. */
  .modern-auth-alert {
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
    padding: 1rem 1.1rem;
    border: 1px solid rgba(181, 137, 12, 0.35);
    border-radius: var(--radius-lg);
    background: linear-gradient(135deg, rgba(255, 250, 238, 0.96), rgba(249, 244, 232, 0.96));
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
  }
  .modern-auth-alert-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: #8a5a00;
    font-family: var(--font-headline);
    font-size: 0.98rem;
    font-weight: 800;
  }
  .modern-auth-alert-title .app-icon {
    font-size: 1.2rem;
  }
  .modern-auth-alert p {
    color: var(--color-on-surface-variant);
    font-size: 0.85rem;
    line-height: 1.5;
  }
  .modern-auth-alert-success {
    color: var(--color-primary) !important;
    font-weight: 700;
  }
  .modern-auth-alert-link {
    align-self: center;
    color: var(--color-primary);
    font-family: var(--font-label);
    font-size: 0.74rem;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-decoration: none;
    text-transform: uppercase;
  }
  .modern-auth-alert-link:hover {
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  @media (max-width: 767px) {
    .modern-auth-card {
      padding: 2rem 1.25rem 1.5rem;
    }
    .modern-auth-icon {
      margin-bottom: 1rem;
    }
  }
`;

export default function SignUpPage() {
  const params = useParams<{ locale?: string }>();
  const isEs = params?.locale === 'es';
  const prefix = isEs ? '/es' : '';
  const policyVersion = '2026-06-19';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [acceptedPolicies, setAcceptedPolicies] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  // When the entered email already belongs to an account, we surface a dedicated
  // notice with a password-reset offer instead of the generic error line.
  const [existingEmail, setExistingEmail] = useState<string | null>(null);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  function clearExistingAccountNotice() {
    if (existingEmail) setExistingEmail(null);
    if (resetSent) setResetSent(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setExistingEmail(null);
    setResetSent(false);

    if (password !== confirmPassword) {
      setError(isEs ? 'Las contraseñas no coinciden.' : 'Passwords do not match.');
      setLoading(false);
      return;
    }

    if (!acceptedPolicies) {
      setError(isEs
        ? 'Debe aceptar los Términos de Servicio y la Política de Privacidad.'
        : 'Please agree to the Terms of Service and Privacy Policy.');
      setLoading(false);
      return;
    }

    const acceptedAt = new Date().toISOString();

    const supabase = createClient();
    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          terms_accepted_at: acceptedAt,
          privacy_accepted_at: acceptedAt,
          policies_accepted_version: policyVersion,
        },
      },
    });

    if (authError) {
      // Some Supabase configurations return an explicit "already registered" error.
      if (/already\s*(registered|exists)|already\s*in\s*use/i.test(authError.message)) {
        setExistingEmail(email);
        setLoading(false);
        return;
      }
      setError(authError.message);
      setLoading(false);
      return;
    }

    // With email confirmation enabled, Supabase obfuscates an existing, confirmed
    // account: it returns a user with an EMPTY `identities` array and sends no
    // email. That empty array is the signal the email is already taken.
    const identities = data?.user?.identities;
    if (data?.user && Array.isArray(identities) && identities.length === 0) {
      setExistingEmail(email);
      setLoading(false);
      return;
    }

    setDone(true);
  }

  async function handleSendReset() {
    if (!existingEmail) return;
    setResetLoading(true);
    setError(null);

    const supabase = createClient();
    const redirectTo = `${window.location.origin}${prefix}/account/reset-password`;
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(existingEmail, { redirectTo });

    setResetLoading(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setResetSent(true);
  }

  if (done) {
    return (
      <>
        <SiteHeader />
        <main className="modern-auth-page min-h-screen flex items-start justify-center px-4 pt-20 pb-10 md:items-center md:pt-24 md:pb-20">
          <div className="modern-auth-card w-full max-w-sm text-center">
            <AppIcon name="mark_email_unread"
              className="modern-auth-icon"
              style={{ marginInline: 'auto' }}
              aria-hidden="true"
             />
            <h1 className="text-2xl font-bold mb-3 tracking-tight"
              style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}>
              {isEs ? 'Revise su correo' : 'Check your email'}
            </h1>
            <p className="text-sm mb-7" style={{ color: 'var(--color-on-surface-variant)' }}>
              {isEs ? <>Enviamos un enlace de confirmación a <strong>{email}</strong>. Haga clic para activar su cuenta.</> : <>We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account.</>}
            </p>
            <Link href={`${prefix}/account/sign-in`} className="modern-auth-submit">
              {isEs ? 'Volver a Iniciar Sesión' : 'Back to Sign In'}
            </Link>
          </div>
          <style>{MODERN_AUTH_STYLES}</style>
        </main>
      </>
    );
  }

  return (
    <>
      <SiteHeader />
      <main className="modern-auth-page min-h-screen flex items-start justify-center px-4 pt-20 pb-10 md:items-center md:pt-24 md:pb-20">
        <div className="modern-auth-card w-full max-w-sm">

          <AppIcon name="person_add" className="modern-auth-icon" aria-hidden="true" />

          <div className="mb-7">
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.35em] mb-3"
              style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}>
              {isEs ? 'Mi Cuenta' : 'My Account'}
            </p>
            <h1 className="text-3xl font-bold tracking-tight"
              style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}>
              {isEs ? 'Crear Cuenta' : 'Create Account'}
            </h1>
            <p className="mt-3 text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
              {isEs
                ? 'Siga sus pedidos, guarde sus piezas favoritas y pague más rápido. Recibirá un correo de confirmación para activar su cuenta. No se requiere cuenta para comprar — siempre puede pagar como invitado.'
                : "Track your orders, save your favorite pieces, and check out faster. You'll get a confirmation email to activate your account. An account isn't required to buy — you can always check out as a guest."}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="form-label" htmlFor="fullName">{isEs ? 'Nombre completo' : 'Full Name'}</label>
              <input
                id="fullName"
                type="text"
                autoComplete="name"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                className="form-field w-full"
                placeholder={isEs ? 'Juan Pérez' : 'Jane Smith'}
              />
            </div>

            <div>
              <label className="form-label" htmlFor="email">{isEs ? 'Correo electrónico' : 'Email'}</label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={e => { setEmail(e.target.value); clearExistingAccountNotice(); }}
                className="form-field w-full"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="form-label" htmlFor="password">{isEs ? 'Contraseña' : 'Password'}</label>
              <PasswordInput
                id="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={isEs ? 'Mín. 6 caracteres' : 'Min. 6 characters'}
                isEs={isEs}
              />
            </div>

            <div>
              <label className="form-label" htmlFor="confirmPassword">{isEs ? 'Confirmar contraseña' : 'Confirm Password'}</label>
              <PasswordInput
                id="confirmPassword"
                confirm
                required
                minLength={6}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder={isEs ? 'Reingrese la contraseña' : 'Re-enter password'}
                isEs={isEs}
              />
            </div>

            <label className="flex items-start gap-3 text-sm leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>
              <input
                type="checkbox"
                required
                checked={acceptedPolicies}
                onChange={(e) => setAcceptedPolicies(e.target.checked)}
                className="mt-1"
                style={{ accentColor: '#a98208' }}
              />
              <span>
                {isEs ? 'Acepto los ' : 'I agree to the '}
                <Link href={`${prefix}/terms`} target="_blank" rel="noopener noreferrer" className="hover-underline-grow font-bold" style={{ color: 'var(--color-primary)' }}>
                  {isEs ? 'Términos de Servicio' : 'Terms of Service'}
                </Link>{' '}
                {isEs ? 'y la ' : 'and '}
                <Link href={`${prefix}/privacy`} target="_blank" rel="noopener noreferrer" className="hover-underline-grow font-bold" style={{ color: 'var(--color-primary)' }}>
                  {isEs ? 'Política de Privacidad' : 'Privacy Policy'}
                </Link>
                .
              </span>
            </label>

            {existingEmail && (
              <div className="modern-auth-alert" role="alert">
                <p className="modern-auth-alert-title">
                  <AppIcon name="info"  aria-hidden="true" />
                  {isEs ? 'Este correo ya tiene una cuenta' : 'This email already has an account'}
                </p>
                <p>
                  {isEs
                    ? <>Ya existe una cuenta con <strong>{existingEmail}</strong>. Si es suya, restablezca su contraseña para volver a entrar — o inicie sesión si la recuerda.</>
                    : <>An account with <strong>{existingEmail}</strong> already exists. If it&apos;s yours, reset your password to get back in — or sign in if you remember it.</>}
                </p>
                {resetSent ? (
                  <p className="modern-auth-alert-success">
                    {isEs
                      ? `Enlace de restablecimiento enviado a ${existingEmail}. Revise su bandeja de entrada.`
                      : `Password reset link sent to ${existingEmail}. Check your inbox.`}
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={handleSendReset}
                    disabled={resetLoading}
                    className="modern-auth-submit disabled:opacity-60"
                  >
                    {resetLoading ? (isEs ? 'Enviando enlace…' : 'Sending reset link...') : (isEs ? 'Restablecer Contraseña' : 'Reset Password')}
                  </button>
                )}
                <Link href={`${prefix}/account/sign-in`} className="modern-auth-alert-link">
                  {isEs ? 'Ir a Iniciar Sesión' : 'Go to Sign In'}
                </Link>
              </div>
            )}

            {error && (
              <p className="text-sm" style={{ color: 'var(--color-error)' }}>{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="modern-auth-submit mt-2 disabled:opacity-60"
            >
              {loading ? (isEs ? 'Creando cuenta…' : 'Creating account...') : (isEs ? 'Crear Cuenta' : 'Create Account')}
            </button>
          </form>

          <p className="mt-7 text-sm text-center" style={{ color: 'var(--color-on-surface-variant)' }}>
            {isEs ? '¿Ya tiene una cuenta? ' : 'Already have an account? '}
            <Link href={`${prefix}/account/sign-in`}
              className="hover-underline-grow font-bold"
              style={{ color: 'var(--color-primary)' }}>
              {isEs ? 'Inicie sesión' : 'Sign in'}
            </Link>
          </p>

        </div>
        <style>{MODERN_AUTH_STYLES}</style>
      </main>
    </>
  );
}
