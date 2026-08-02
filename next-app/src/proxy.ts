import createIntlMiddleware from 'next-intl/middleware';
import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';
import { routing } from './i18n/routing';

const intl = createIntlMiddleware(routing);
const INTERNAL_LOCALE_HEADER = 'x-naples-internal-locale';
const NEXT_INTL_LOCALE_HEADER = 'X-NEXT-INTL-LOCALE';

const SESSION_PATH_PREFIXES = [
  '/account',
  '/admin',
  '/checkout',
  '/en/account',
  '/en/admin',
  '/en/checkout',
  '/es/account',
  '/es/admin',
  '/es/checkout',
];

function shouldRefreshSupabaseSession(pathname: string) {
  return SESSION_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

// Pages retired 2026-08-01 (auctions + the two aspirational legal pages).
// These MUST be answered here, before the locale rewrite below, and cannot
// live in netlify.toml or next.config.ts `redirects()`: on Netlify this proxy
// runs as an edge function ahead of BOTH the Netlify redirect engine and the
// Next.js server, so a bare `/auctions` is rewritten to a dead `/en/auctions`
// and 404s before any redirect rule is consulted. (`next dev` honours the
// config redirects, so this gap only shows in production — verify retired
// URLs against the deployed site, never just locally.)
const RETIRED_PATHS: Record<string, string> = {
  '/auctions': '/shop',
  '/auction-terms': '/terms',
  '/vendor-terms': '/terms',
};

function retiredPageRedirect(request: NextRequest): NextResponse | null {
  const pathname = request.nextUrl.pathname;
  const isEs = pathname === '/es' || pathname.startsWith('/es/');
  // Compare on the locale-less path so /auctions, /en/auctions and
  // /es/auctions all resolve to the same rule.
  const bare = isEs ? pathname.slice(3) : pathname.replace(/^\/en(?=\/|$)/, '');
  const destination = RETIRED_PATHS[bare];
  if (!destination) return null;
  const url = request.nextUrl.clone();
  url.pathname = isEs ? `/es${destination}` : destination;
  return NextResponse.redirect(url, 308);
}

async function refreshSupabaseSession(request: NextRequest, response: NextResponse) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  await supabase.auth.getClaims();
  return response;
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Retired pages first — see RETIRED_PATHS. Nothing below may run for these.
  const retired = retiredPageRedirect(request);
  if (retired) return retired;

  const needsSessionRefresh = shouldRefreshSupabaseSession(pathname);

  // Next 16 currently re-runs proxy for next-intl's internal default-locale
  // rewrite (/ -> /en), which can make /en canonicalize back to / forever.
  // Mark our own English rewrite and let the internal /en request render.
  if (
    request.headers.get(INTERNAL_LOCALE_HEADER) === 'en' ||
    (pathname.startsWith('/en') && request.headers.get(NEXT_INTL_LOCALE_HEADER) === 'en')
  ) {
    const headers = new Headers(request.headers);
    headers.set(NEXT_INTL_LOCALE_HEADER, 'en');
    const response = NextResponse.next({ request: { headers } });
    if (!needsSessionRefresh) return response;
    response.cookies.set('NEXT_LOCALE', 'en', { path: '/', sameSite: 'lax' });
    return refreshSupabaseSession(request, response);
  }

  if (!pathname.startsWith('/en') && !pathname.startsWith('/es')) {
    const url = request.nextUrl.clone();
    url.pathname = `/en${pathname === '/' ? '' : pathname}`;

    const headers = new Headers(request.headers);
    headers.set(INTERNAL_LOCALE_HEADER, 'en');
    headers.set(NEXT_INTL_LOCALE_HEADER, 'en');

    const response = NextResponse.rewrite(url, { request: { headers } });
    if (!needsSessionRefresh) return response;
    response.cookies.set('NEXT_LOCALE', 'en', { path: '/', sameSite: 'lax' });
    return refreshSupabaseSession(request, response);
  }

  // i18n routing for Spanish and direct prefixed default-locale URLs.
  const response = intl(request);
  if (!needsSessionRefresh) return response;
  return refreshSupabaseSession(request, response);
}

export const config = {
  matcher: [
    // `p/` is the short product-link namespace (/p/<inventory#> -> /shop/...)
    // used in social posts; it must bypass the locale rewrite or next-intl
    // would send it to a /[locale]/p page that does not exist.
    '/((?!_next/static|_next/image|favicon.ico|icon|api/|p/|robots.txt|sitemap.*\\.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?|mp4|webm|mov|ogg|pdf)).*)',
  ],
};
