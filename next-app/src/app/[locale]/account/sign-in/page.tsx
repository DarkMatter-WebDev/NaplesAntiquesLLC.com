'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import SiteHeader from '@/components/layout/SiteHeader';
import { createClient } from '@/lib/supabase/client';

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    router.push('/account');
    router.refresh();
  }

  return (
    <>
      <SiteHeader />
      <main className="modern-auth-page min-h-screen flex items-center justify-center px-4 pt-24 pb-20">
        <div className="modern-auth-card w-full max-w-sm">

          <span className="material-symbols-outlined modern-auth-icon" aria-hidden="true">
            lock
          </span>

          <div className="mb-7">
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.35em] mb-3"
              style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}>
              My Account
            </p>
            <h1 className="text-3xl font-bold tracking-tight"
              style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}>
              Sign In
            </h1>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="form-field w-full"
                placeholder="••••••••"
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
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <p className="mt-7 text-sm text-center" style={{ color: 'var(--color-on-surface-variant)' }}>
            Don&apos;t have an account?{' '}
            <Link href="/account/sign-up"
              className="font-bold hover:underline underline-offset-2"
              style={{ color: 'var(--color-primary)' }}>
              Create one
            </Link>
          </p>

        </div>

        <style>{`
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
          }
          .modern-auth-submit:hover:not(:disabled) {
            filter: brightness(1.04);
            box-shadow: 0 14px 30px rgba(181, 137, 12, 0.24);
            transform: translateY(-1px);
          }
          .modern-auth-submit:disabled {
            cursor: default;
          }
        `}</style>
      </main>
    </>
  );
}
