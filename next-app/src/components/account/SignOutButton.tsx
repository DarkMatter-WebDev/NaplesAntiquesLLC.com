'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface Props {
  label: string;
  locale: string;
}

export default function SignOutButton({ label, locale }: Props) {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push(locale === 'es' ? '/es' : '/');
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      className="outline-button text-sm"
    >
      {label}
    </button>
  );
}
