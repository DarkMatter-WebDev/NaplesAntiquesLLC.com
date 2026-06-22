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
  '/payment',
  '/en/account',
  '/en/admin',
  '/en/checkout',
  '/en/payment',
  '/es/account',
  '/es/admin',
  '/es/checkout',
  '/es/payment',
];

function shouldRefreshSupabaseSession(pathname: string) {
  return SESSION_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
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

  await supabase.auth.getUser();
  return response;
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
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
    '/((?!_next/static|_next/image|favicon.ico|api/|robots.txt|sitemap.*\\.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?|mp4|webm|mov|ogg|pdf)).*)',
  ],
};
