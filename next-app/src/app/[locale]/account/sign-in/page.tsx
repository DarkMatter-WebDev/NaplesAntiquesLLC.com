'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import SiteHeader from '@/components/layout/SiteHeader';
import { createClient } from '@/lib/supabase/client';

// Map raw Supabase auth errors to friendly, human copy so shoppers never see
// developer-facing strings like "Invalid login credentials".
function friendlyAuthError(message: string, isEs: boolean): string {
  const m = (message || '').toLowerCase();
  if (m.includes('invalid login credentials')) {
    return isEs
      ? 'El correo o la contraseña son incorrectos.'
      : 'The email or password you entered is incorrect.';
  }
  if (m.includes('email not confirmed')) {
    return isEs
      ? 'Confirme su correo primero — revise su bandeja de entrada para el enlace de confirmación.'
      : 'Please confirm your email first — check your inbox for the confirmation link.';
  }
  if (m.includes('rate limit') || m.includes('too many')) {
    return isEs
      ? 'Demasiados intentos. Espere un momento e intente de nuevo.'
      : 'Too many attempts. Please wait a moment and try again.';
  }
  return isEs
    ? 'No pudimos iniciar sesión. Verifique sus datos e intente de nuevo.'
    : "We couldn't sign you in. Please check your details and try again.";
}

export default function SignInPage() {
  const router = useRouter();
  const params = useParams<{ locale?: string }>();
  const isEs = params?.locale === 'es';
  const prefix = isEs ? '/es' : '';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Held in a ref, not state: it's only read on submit (never rendered), so it
  // shouldn't trigger a re-render — and reading it in an effect keeps it off the
  // server (no window there) without a hydration mismatch.
  const nextUrlRef = useRef<string | null>(null);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('next');
    if (p && p.startsWith('/') && !p.startsWith('//')) nextUrlRef.current = p;
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError(friendlyAuthError(authError.message, isEs));
      setLoading(false);
      return;
    }

    router.push(nextUrlRef.current ?? `${prefix}/account`);
    router.refresh();
  }

  return (
    <>
      <SiteHeader />
      <main className="modern-auth-page min-h-screen flex items-start justify-center px-4 pt-20 pb-10 md:items-center md:pt-24 md:pb-20">
        <div className="modern-auth-card w-full max-w-sm">

          <span className="material-symbols-outlined modern-auth-icon" aria-hidden="true">
            lock
          </span>

          <div className="mb-7">
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.35em] mb-3"
              style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}>
              {isEs ? 'Mi Cuenta' : 'My Account'}
            </p>
            <h1 className="text-3xl font-bold tracking-tight"
              style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}>
              {isEs ? 'Iniciar Sesión' : 'Sign In'}
            </h1>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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

            <div>
              <label className="form-label" htmlFor="password">{isEs ? 'Contraseña' : 'Password'}</label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="form-field w-full"
                placeholder={isEs ? 'Ingrese su contraseña' : 'Enter your password'}
              />
              <div className="mt-2 text-right">
                <Link
                  href={`${prefix}/account/reset-password`}
                  className="hover-underline-grow text-xs font-bold"
                  style={{ color: 'var(--color-primary)' }}
                >
                  {isEs ? '¿Olvidó su contraseña?' : 'Forgot password?'}
                </Link>
              </div>
            </div>

            {error && (
              <p className="text-sm" style={{ color: 'var(--color-error)' }}>{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="modern-auth-submit mt-2 disabled:opacity-60"
            >
              {loading ? (isEs ? 'Iniciando sesión…' : 'Signing in…') : (isEs ? 'Iniciar Sesión' : 'Sign In')}
            </button>
          </form>

          <p className="mt-7 text-sm text-center" style={{ color: 'var(--color-on-surface-variant)' }}>
            {isEs ? '¿No tiene una cuenta? ' : "Don't have an account? "}
            <Link href={`${prefix}/account/sign-up`}
              className="hover-underline-grow font-bold"
              style={{ color: 'var(--color-primary)' }}>
              {isEs ? 'Cree una' : 'Create one'}
            </Link>
          </p>

        </div>

        <style>{`
          .modern-auth-page {
            background:
              linear-gradient(180deg, rgba(255, 255, 255, 0.94) 0%, rgba(255, 255, 255, 0.82) 48%, rgba(255, 255, 255, 0.7) 100%),
              url('/assets/images/pages/login.webp') center bottom / min(1780px, 118vw) auto no-repeat,
              #ffffff;
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
          }
          .modern-auth-submit:hover:not(:disabled) {
            filter: brightness(1.04);
            box-shadow: 0 14px 30px rgba(181, 137, 12, 0.24);
            transform: translateY(-1px);
          }
          .modern-auth-submit:disabled {
            cursor: default;
          }
          @media (max-width: 767px) {
            .modern-auth-page {
              background: #ffffff;
            }
            .modern-auth-card {
              padding: 2rem 1.25rem 1.5rem;
            }
            .modern-auth-icon {
              margin-bottom: 1rem;
            }
          }
        `}</style>
      </main>
    </>
  );
}
