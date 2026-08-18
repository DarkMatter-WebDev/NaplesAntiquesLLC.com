'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { startRouteProgress } from '@/components/layout/RouteProgressBar';
import { createClient } from '@/lib/supabase/client';

interface Props {
  label: string;
  locale: string;
  className?: string;
}

export default function SignOutButton({ label, locale, className }: Props) {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      const home = locale === 'es' ? '/es' : '/';
      startRouteProgress(home);
      router.push(home);
      router.refresh();
    } catch {
      setIsSigningOut(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={isSigningOut}
      aria-busy={isSigningOut}
      className={['outline-button text-sm', className].filter(Boolean).join(' ')}
    >
      {isSigningOut ? (locale === 'es' ? 'Cerrando sesion...' : 'Signing out...') : label}
    </button>
  );
}
