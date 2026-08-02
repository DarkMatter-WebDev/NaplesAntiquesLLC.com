import type { SupabaseClient } from '@supabase/supabase-js';

export type VerifiedUser = {
  id: string;
  email: string | null;
};

export async function getVerifiedUser(supabase: SupabaseClient): Promise<VerifiedUser | null> {
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) return null;

  const claims = data.claims as Record<string, unknown>;
  const id = typeof claims.sub === 'string' ? claims.sub : '';
  if (!id) return null;

  return {
    id,
    email: typeof claims.email === 'string' ? claims.email : null,
  };
}
