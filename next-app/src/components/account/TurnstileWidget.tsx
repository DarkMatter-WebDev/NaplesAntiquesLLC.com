'use client';

/**
 * Cloudflare Turnstile widget for Supabase Auth CAPTCHA.
 *
 * WHY THIS EXISTS — bot accounts, and why form heuristics can't help
 * ------------------------------------------------------------------
 * On 2026-08-24 five bot accounts arrived (~one every 3 hours): random
 * consonant names, dot-permutation Gmail addresses. Sign-up calls
 * `supabase.auth.signUp()` from the browser with the PUBLIC anon key, so the
 * bots POST JSON straight to Supabase's `/auth/v1/signup` — none of our
 * routes, edge functions, or `spam-heuristics.ts` are in that path. The only
 * gate that works is one Supabase itself enforces: Auth CAPTCHA, verified
 * server-side by GoTrue on every auth request.
 *
 * HOW IT DEPLOYS SAFELY — inert until BOTH switches are on
 * --------------------------------------------------------
 * 1. This code ships first. With no `NEXT_PUBLIC_TURNSTILE_SITE_KEY` set, the
 *    widget renders nothing and callers pass `captchaToken: undefined` —
 *    byte-for-byte the previous behavior.
 * 2. Set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` in Netlify (public by design; the
 *    SECRET key goes only in the Supabase dashboard, never in this repo).
 * 3. Only then enable Attack Protection → CAPTCHA in Supabase Auth.
 * ⛔ Flipping the Supabase toggle BEFORE a deploy with the site key breaks
 * sign-in for everyone — GoTrue would demand a token no form is sending.
 *
 * ⚠️ Tokens are SINGLE-USE. Any failed auth attempt consumes the token, so
 * every error path must call `reset()` to mint a fresh one, or the user's
 * retry fails with a confusing captcha error instead of their real one.
 *
 * CSP: `script-src` and `frame-src` need `https://challenges.cloudflare.com`
 * in BOTH `next-app/next.config.ts` (dev) and root `netlify.toml`
 * (production) — the same two-file rule as the Google Maps embed.
 */

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';

/** True once the public site key is configured; all gating hangs off this. */
export const turnstileEnabled = TURNSTILE_SITE_KEY.length > 0;

type TurnstileApi = {
  render: (container: HTMLElement, options: Record<string, unknown>) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId?: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
    /** Global onload hook name passed to the Turnstile script URL. */
    __nejTurnstileReady?: () => void;
  }
}

let apiPromise: Promise<TurnstileApi> | null = null;

/** Load the Turnstile script once per page, shared by every widget instance. */
function loadTurnstile(): Promise<TurnstileApi> {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise<TurnstileApi>((resolve, reject) => {
    if (window.turnstile) {
      resolve(window.turnstile);
      return;
    }
    window.__nejTurnstileReady = () => {
      if (window.turnstile) resolve(window.turnstile);
      else reject(new Error('Turnstile script loaded without a turnstile API.'));
    };
    const script = document.createElement('script');
    script.src =
      'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=__nejTurnstileReady&render=explicit';
    script.async = true;
    script.onerror = () => {
      // Allow a later mount to retry rather than caching the failure forever.
      apiPromise = null;
      reject(new Error('Turnstile script failed to load.'));
    };
    document.head.appendChild(script);
  });
  return apiPromise;
}

export type TurnstileHandle = {
  /** Mint a fresh token. Call after ANY auth failure — tokens are single-use. */
  reset: () => void;
};

type TurnstileWidgetProps = {
  /** Receives the fresh token, or null when it expires/errors. */
  onToken: (token: string | null) => void;
  isEs: boolean;
};

const TurnstileWidget = forwardRef<TurnstileHandle, TurnstileWidgetProps>(
  function TurnstileWidget({ onToken, isEs }, ref) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const widgetIdRef = useRef<string | null>(null);
    // The latest onToken without re-rendering the widget when the parent re-renders.
    const onTokenRef = useRef(onToken);
    onTokenRef.current = onToken;

    useImperativeHandle(ref, () => ({
      reset() {
        if (widgetIdRef.current !== null) {
          window.turnstile?.reset(widgetIdRef.current);
          onTokenRef.current(null);
        }
      },
    }));

    useEffect(() => {
      if (!turnstileEnabled) return;
      let cancelled = false;

      loadTurnstile()
        .then((turnstile) => {
          if (cancelled || !containerRef.current) return;
          widgetIdRef.current = turnstile.render(containerRef.current, {
            sitekey: TURNSTILE_SITE_KEY,
            language: isEs ? 'es' : 'en',
            theme: 'light',
            size: 'flexible',
            callback: (token: string) => onTokenRef.current(token),
            'expired-callback': () => {
              // Expired tokens (300s) would fail server-side; mint a fresh one.
              onTokenRef.current(null);
              if (widgetIdRef.current !== null) window.turnstile?.reset(widgetIdRef.current);
            },
            'error-callback': () => onTokenRef.current(null),
          });
        })
        .catch(() => {
          // Script blocked or offline. Leave the token null — the submit stays
          // gated and the empty container is the only symptom. GoTrue would
          // reject a tokenless call anyway, so failing closed here is honest.
        });

      return () => {
        cancelled = true;
        if (widgetIdRef.current !== null) {
          window.turnstile?.remove(widgetIdRef.current);
          widgetIdRef.current = null;
        }
      };
    }, [isEs]);

    if (!turnstileEnabled) return null;

    return <div ref={containerRef} aria-label={isEs ? 'Verificación de seguridad' : 'Security verification'} />;
  },
);

export default TurnstileWidget;
