'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import SiteHeader from '@/components/layout/SiteHeader';
import { createClient } from '@/lib/supabase/client';

const RESET_AUTH_STYLES = `
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
  .modern-password-field {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: stretch;
    border: 1px solid var(--color-outline-variant);
    border-radius: var(--radius-lg);
    background: #ffffff;
    overflow: hidden;
    transition: border-color 160ms ease, box-shadow 160ms ease;
  }
  .modern-password-field:focus-within {
    border-color: #a98208;
    box-shadow: 0 0 0 3px rgba(212, 175, 55, 0.16);
  }
  .modern-password-input {
    min-width: 0;
    border: 0;
    background: transparent;
    color: var(--color-on-surface);
    outline: none;
    padding: 0.78rem 0.9rem;
    font-size: 0.95rem;
  }
  .modern-password-toggle {
    min-width: 4.4rem;
    border: 0;
    border-left: 1px solid var(--color-outline-variant);
    background: #fbfaf6;
    color: #735c00;
    cursor: pointer;
    font-family: var(--font-label);
    font-size: 0.68rem;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    transition: background 160ms ease, color 160ms ease;
    border-radius: var(--radius-lg);
  }
  .modern-password-toggle:hover,
  .modern-password-toggle:focus-visible {
    background: rgba(212, 175, 55, 0.14);
    color: #5f4b00;
    outline: none;
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

function hasRecoveryParamsInUrl(): boolean {
  if (typeof window === 'undefined') return false;
  const hash = window.location.hash ?? '';
  const search = new URLSearchParams(window.location.search);
  return (
    hash.includes('access_token') ||
    hash.includes('type=recovery') ||
    search.has('code')
  );
}

export default function ResetPasswordPage() {
  const params = useParams<{ locale?: string }>();
  const isEs = params?.locale === 'es';
  const prefix = isEs ? '/es' : '';

  const [ready, setReady] = useState(false);
  // 'request' = ask for the reset email; 'update' = a recovery session is active,
  // so let the user set a new password.
  const [mode, setMode] = useState<'request' | 'update'>('request');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestSent, setRequestSent] = useState(false);
  const [updated, setUpdated] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    const awaitingRecovery = hasRecoveryParamsInUrl();

    const reveal = (nextMode?: 'request' | 'update') => {
      if (!active) return;
      if (nextMode) setMode(nextMode);
      setReady(true);
    };

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (data.session) reveal('update');
      // If the recovery token is still being exchanged from the URL, wait for the
      // auth event below instead of flashing the request form.
      else if (!awaitingRecovery) reveal('request');
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) reveal('update');
    });

    // Fallback so the page never hangs on the loading state if the recovery
    // exchange fails or never arrives.
    const timer = window.setTimeout(() => reveal(), 5000);

    return () => {
      active = false;
      window.clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, []);

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const redirectTo = `${window.location.origin}${prefix}/account/reset-password`;
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

    setLoading(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setRequestSent(true);
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError(isEs ? 'Las contraseñas no coinciden.' : 'Passwords do not match.');
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setUpdated(true);
  }

  function renderCard() {
    if (!ready) {
      return (
        <div className="modern-auth-card w-full max-w-sm text-center">
          <span className="material-symbols-outlined modern-auth-icon" style={{ marginInline: 'auto' }} aria-hidden="true">
            lock_reset
          </span>
          <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>{isEs ? 'Cargando…' : 'Loading…'}</p>
        </div>
      );
    }

    if (updated) {
      return (
        <div className="modern-auth-card w-full max-w-sm text-center">
          <span className="material-symbols-outlined modern-auth-icon" style={{ marginInline: 'auto' }} aria-hidden="true">
            check_circle
          </span>
          <h1 className="text-2xl font-bold mb-3 tracking-tight" style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}>
            {isEs ? 'Contraseña actualizada' : 'Password updated'}
          </h1>
          <p className="text-sm mb-7" style={{ color: 'var(--color-on-surface-variant)' }}>
            {isEs
              ? 'Su contraseña ha sido cambiada. Ahora puede iniciar sesión con su nueva contraseña.'
              : 'Your password has been changed. You can now sign in with your new password.'}
          </p>
          <Link href={`${prefix}/account/sign-in`} className="modern-auth-submit">
            {isEs ? 'Ir a Iniciar Sesión' : 'Go to Sign In'}
          </Link>
        </div>
      );
    }

    if (mode === 'update') {
      return (
        <div className="modern-auth-card w-full max-w-sm">
          <span className="material-symbols-outlined modern-auth-icon" aria-hidden="true">lock_reset</span>
          <div className="mb-7">
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.35em] mb-3" style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}>
              {isEs ? 'Mi Cuenta' : 'My Account'}
            </p>
            <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}>
              {isEs ? 'Establecer Nueva Contraseña' : 'Set a New Password'}
            </h1>
          </div>

          <form onSubmit={handleUpdate} className="flex flex-col gap-4">
            <div>
              <label className="form-label" htmlFor="password">{isEs ? 'Nueva contraseña' : 'New Password'}</label>
              <div className="modern-password-field">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="modern-password-input"
                  placeholder={isEs ? 'Mín. 6 caracteres' : 'Min. 6 characters'}
                />
                <button
                  type="button"
                  className="modern-password-toggle"
                  aria-label={showPassword ? (isEs ? 'Ocultar contraseña' : 'Hide password') : (isEs ? 'Mostrar contraseña' : 'Show password')}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((current) => !current)}
                >
                  {showPassword ? (isEs ? 'Ocultar' : 'Hide') : (isEs ? 'Mostrar' : 'Show')}
                </button>
              </div>
            </div>

            <div>
              <label className="form-label" htmlFor="confirmPassword">{isEs ? 'Confirmar contraseña' : 'Confirm Password'}</label>
              <div className="modern-password-field">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="modern-password-input"
                  placeholder={isEs ? 'Reingrese la contraseña' : 'Re-enter password'}
                />
                <button
                  type="button"
                  className="modern-password-toggle"
                  aria-label={showConfirmPassword ? (isEs ? 'Ocultar confirmación' : 'Hide confirm password') : (isEs ? 'Mostrar confirmación' : 'Show confirm password')}
                  aria-pressed={showConfirmPassword}
                  onClick={() => setShowConfirmPassword((current) => !current)}
                >
                  {showConfirmPassword ? (isEs ? 'Ocultar' : 'Hide') : (isEs ? 'Mostrar' : 'Show')}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-sm" style={{ color: 'var(--color-error)' }}>{error}</p>
            )}

            <button type="submit" disabled={loading} className="modern-auth-submit mt-2 disabled:opacity-60">
              {loading ? (isEs ? 'Actualizando…' : 'Updating...') : (isEs ? 'Actualizar Contraseña' : 'Update Password')}
            </button>
          </form>
        </div>
      );
    }

    if (requestSent) {
      return (
        <div className="modern-auth-card w-full max-w-sm text-center">
          <span className="material-symbols-outlined modern-auth-icon" style={{ marginInline: 'auto' }} aria-hidden="true">
            mark_email_unread
          </span>
          <h1 className="text-2xl font-bold mb-3 tracking-tight" style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}>
            {isEs ? 'Revise su correo' : 'Check your email'}
          </h1>
          <p className="text-sm mb-7" style={{ color: 'var(--color-on-surface-variant)' }}>
            {isEs
              ? <>Si existe una cuenta para <strong>{email}</strong>, le hemos enviado un enlace para restablecer la contraseña. Haga clic para elegir una nueva.</>
              : <>If an account exists for <strong>{email}</strong>, we&apos;ve sent a password reset link. Click it to choose a new password.</>}
          </p>
          <Link href={`${prefix}/account/sign-in`} className="modern-auth-submit">
            {isEs ? 'Volver a Iniciar Sesión' : 'Back to Sign In'}
          </Link>
        </div>
      );
    }

    return (
      <div className="modern-auth-card w-full max-w-sm">
        <span className="material-symbols-outlined modern-auth-icon" aria-hidden="true">lock_reset</span>
        <div className="mb-7">
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.35em] mb-3" style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}>
            {isEs ? 'Mi Cuenta' : 'My Account'}
          </p>
          <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}>
            {isEs ? 'Restablecer Contraseña' : 'Reset Password'}
          </h1>
          <p className="mt-3 text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
            {isEs
              ? 'Ingrese el correo de su cuenta y le enviaremos un enlace para establecer una nueva contraseña.'
              : "Enter your account email and we'll send you a link to set a new password."}
          </p>
        </div>

        <form onSubmit={handleRequest} className="flex flex-col gap-4">
          <div>
            <label className="form-label" htmlFor="email">{isEs ? 'Correo electrónico' : 'Email'}</label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="form-field w-full"
              placeholder="you@example.com"
            />
          </div>

          {error && (
            <p className="text-sm" style={{ color: 'var(--color-error)' }}>{error}</p>
          )}

          <button type="submit" disabled={loading} className="modern-auth-submit mt-2 disabled:opacity-60">
            {loading ? (isEs ? 'Enviando enlace…' : 'Sending reset link...') : (isEs ? 'Enviar Enlace' : 'Send Reset Link')}
          </button>
        </form>

        <p className="mt-7 text-sm text-center" style={{ color: 'var(--color-on-surface-variant)' }}>
          {isEs ? '¿La recordó? ' : 'Remembered it? '}
          <Link href={`${prefix}/account/sign-in`} className="font-bold hover:underline underline-offset-2" style={{ color: 'var(--color-primary)' }}>
            {isEs ? 'Inicie sesión' : 'Sign in'}
          </Link>
        </p>
      </div>
    );
  }

  return (
    <>
      <SiteHeader />
      <main className="modern-auth-page min-h-screen flex items-start justify-center px-4 pt-20 pb-10 md:items-center md:pt-24 md:pb-20">
        {renderCard()}
        <style>{RESET_AUTH_STYLES}</style>
      </main>
    </>
  );
}
