'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import SiteHeader from '@/components/layout/SiteHeader';
import { createClient } from '@/lib/supabase/client';

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

export default function SignUpPage() {
  const params = useParams<{ locale?: string }>();
  const prefix = params?.locale === 'es' ? '/es' : '';
  const policyVersion = '2026-06-19';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [acceptedPolicies, setAcceptedPolicies] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      setLoading(false);
      return;
    }

    if (!acceptedPolicies) {
      setError('Please agree to the Terms of Service and Privacy Policy.');
      setLoading(false);
      return;
    }

    const acceptedAt = new Date().toISOString();

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signUp({
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
      setError(authError.message);
      setLoading(false);
      return;
    }

    setDone(true);
  }

  if (done) {
    return (
      <>
        <SiteHeader />
        <main className="modern-auth-page min-h-screen flex items-start justify-center px-4 pt-20 pb-10 md:items-center md:pt-24 md:pb-20">
          <div className="modern-auth-card w-full max-w-sm text-center">
            <span
              className="material-symbols-outlined modern-auth-icon"
              style={{ marginInline: 'auto' }}
              aria-hidden="true"
            >
              mark_email_unread
            </span>
            <h1 className="text-2xl font-bold mb-3 tracking-tight"
              style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}>
              Check your email
            </h1>
            <p className="text-sm mb-7" style={{ color: 'var(--color-on-surface-variant)' }}>
              We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account.
            </p>
            <Link href={`${prefix}/account/sign-in`} className="modern-auth-submit">
              Back to Sign In
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

          <span className="material-symbols-outlined modern-auth-icon" aria-hidden="true">
            person_add
          </span>

          <div className="mb-7">
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.35em] mb-3"
              style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}>
              My Account
            </p>
            <h1 className="text-3xl font-bold tracking-tight"
              style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}>
              Create Account
            </h1>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="form-label" htmlFor="fullName">Full Name</label>
              <input
                id="fullName"
                type="text"
                autoComplete="name"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                className="form-field w-full"
                placeholder="Jane Smith"
              />
            </div>

            <div>
              <label className="form-label" htmlFor="email">Email</label>
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
              <label className="form-label" htmlFor="password">Password</label>
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
                  placeholder="Min. 6 characters"
                />
                <button
                  type="button"
                  className="modern-password-toggle"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((current) => !current)}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <div>
              <label className="form-label" htmlFor="confirmPassword">Confirm Password</label>
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
                  placeholder="Re-enter password"
                />
                <button
                  type="button"
                  className="modern-password-toggle"
                  aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                  aria-pressed={showConfirmPassword}
                  onClick={() => setShowConfirmPassword((current) => !current)}
                >
                  {showConfirmPassword ? 'Hide' : 'Show'}
                </button>
              </div>
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
                I agree to the{' '}
                <Link href={`${prefix}/terms`} target="_blank" rel="noopener noreferrer" className="font-bold hover:underline" style={{ color: 'var(--color-primary)' }}>
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link href={`${prefix}/privacy`} target="_blank" rel="noopener noreferrer" className="font-bold hover:underline" style={{ color: 'var(--color-primary)' }}>
                  Privacy Policy
                </Link>
                .
              </span>
            </label>

            {error && (
              <p className="text-sm" style={{ color: 'var(--color-error)' }}>{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="modern-auth-submit mt-2 disabled:opacity-60"
            >
              {loading ? 'Creating accountâ€¦' : 'Create Account'}
            </button>
          </form>

          <p className="mt-7 text-sm text-center" style={{ color: 'var(--color-on-surface-variant)' }}>
            Already have an account?{' '}
            <Link href={`${prefix}/account/sign-in`}
              className="font-bold hover:underline underline-offset-2"
              style={{ color: 'var(--color-primary)' }}>
              Sign in
            </Link>
          </p>

        </div>
        <style>{MODERN_AUTH_STYLES}</style>
      </main>
    </>
  );
}

