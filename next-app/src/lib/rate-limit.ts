import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * Best-effort per-key rate limiting for unauthenticated endpoints (lead forms,
 * subscribe/unsubscribe, checkout). Backed by the `check_rate_limit` SECURITY
 * DEFINER RPC + `rate_limits` table (see supabase/rate-limiting.sql).
 *
 * Design notes:
 * - An in-memory Map is NOT used on purpose: Netlify runs many short-lived lambda
 *   instances, so a per-instance counter resets on every cold start and never sees
 *   a distributed burst. The DB counter is shared across all instances.
 * - FAILS OPEN: any infrastructure error (service role unset, RPC missing because
 *   the migration hasn't run yet, DB hiccup) allows the request. A limiter outage
 *   must never take a public form offline. The trade-off is that until the SQL
 *   migration is applied, these calls are a silent no-op (everything is allowed).
 */
export async function checkRateLimit(
  key: string,
  max: number,
  windowSeconds: number,
): Promise<boolean> {
  let service;
  try {
    service = createServiceClient();
  } catch {
    return true; // service role not configured — cannot rate limit, allow.
  }
  try {
    const { data, error } = await service.rpc('check_rate_limit', {
      p_key: key,
      p_max: max,
      p_window_seconds: windowSeconds,
    });
    if (error) return true; // e.g. function not yet created — fail open.
    return data !== false;
  } catch {
    return true;
  }
}

/**
 * Best-effort client IP for rate-limit keying. Netlify sets
 * `x-nf-client-connection-ip`; fall back to the first `x-forwarded-for` hop.
 * Returns 'unknown' when neither is present (all such callers then share one
 * bucket, which is acceptable for a coarse abuse control).
 */
export function getClientIp(req: Request): string {
  const ip =
    req.headers.get('x-nf-client-connection-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0] ??
    '';
  return ip.trim() || 'unknown';
}
