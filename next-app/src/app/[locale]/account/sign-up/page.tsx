'use client';

import { useState } from 'react';
import Link from 'next/link';
import SiteHeader from '@/components/layout/SiteHeader';
import { createClient } from '@/lib/supabase/client';

const MODERN_AUTH_STYLES = `
  .modern-auth-page {
    background:
      radial-gradient(circle at 78% 8%, rgba(220, 188, 96, 0.16), transparent 34rem),
      linear-gradient(180deg, #fffdf8 0%, #f8f6f0 44%, #f5f2ea 100%);
  }
  .modern-auth-card {
    position: relative;
    border: 1px solid rgba(115, 92, 0, 0.15);
    border-radius: 8px;
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
    border-radius: 6px;
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
`;

export default function SignUpPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
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
        <main className="modern-auth-page min-h-screen flex items-center justify-center px-4 pt-24 pb-20">
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
            <Link href="/account/sign-in" className="modern-auth-submit">
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
      <main className="modern-auth-page min-h-screen flex items-center justify-center px-4 pt-24 pb-20">
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
              <input
                id="password"
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="form-field w-full"
                placeholder="Min. 6 characters"
              />
            </div>

            {error && (
              <p className="text-sm" style={{ color: 'var(--color-error)' }}>{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="modern-auth-submit mt-2 disabled:opacity-60"
            >
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>

          <p className="mt-7 text-sm text-center" style={{ color: 'var(--color-on-surface-variant)' }}>
            Already have an account?{' '}
            <Link href="/account/sign-in"
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
