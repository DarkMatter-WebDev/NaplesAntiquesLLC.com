'use client';

import { useState } from 'react';
import Link from 'next/link';
import SiteHeader from '@/components/layout/SiteHeader';
import { createClient } from '@/lib/supabase/client';

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
        <main className="min-h-screen flex items-center justify-center px-4 pt-20 pb-16"
          style={{ background: 'var(--color-background)' }}>
          <div className="w-full max-w-sm text-center">
            <div className="text-4xl mb-4">✉️</div>
            <h1 className="text-2xl font-bold mb-3"
              style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}>
              Check your email
            </h1>
            <p className="text-sm mb-6" style={{ color: 'var(--color-on-surface-variant)' }}>
              We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account.
            </p>
            <Link href="/account/sign-in" className="gold-button">
              Back to Sign In
            </Link>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <SiteHeader />
      <main className="min-h-screen flex items-center justify-center px-4 pt-20 pb-16"
        style={{ background: 'var(--color-background)' }}>
        <div className="w-full max-w-sm">

          <div className="mb-8">
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.35em] mb-3"
              style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}>
              My Account
            </p>
            <h1 className="text-3xl font-bold"
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
              className="gold-button mt-2 disabled:opacity-50"
            >
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>

          <p className="mt-6 text-sm text-center" style={{ color: 'var(--color-on-surface-variant)' }}>
            Already have an account?{' '}
            <Link href="/account/sign-in"
              className="font-bold hover:underline underline-offset-2"
              style={{ color: 'var(--color-primary)' }}>
              Sign in
            </Link>
          </p>

        </div>
      </main>
    </>
  );
}
