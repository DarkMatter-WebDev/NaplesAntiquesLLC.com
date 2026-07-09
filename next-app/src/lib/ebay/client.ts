import 'server-only';

// Fetch wrapper for eBay's REST APIs. Modeled on next-app/src/lib/etsy/client.ts's
// shape (throttle + backoff + typed error + redacted logging) — never imports
// from it. See ebay-sync-plan/rest-endpoints-used.md and
// ebay-sync-plan/10-rate-limits-and-quotas.md.
//
// NOTE ON VERIFICATION (BUILD-PROMPT.md hard rule 8): this build environment
// has no network access to developer.ebay.com (WebFetch timed out repeatedly)
// and no eBay keyset credentials, so the endpoint hosts/paths/header formats
// below are pinned from well-established, stable eBay Sell API conventions
// (unchanged for years) plus the plan's own prior research — not a fresh live
// fetch of the OpenAPI contract. Flagged TODO(ebay-verify) at every point the
// plan itself already flagged uncertainty; everything else should be spot
// checked against developer.ebay.com by whoever has real credentials before
// the first production sync.

function isSandbox(): boolean {
  return process.env.EBAY_ENV === 'sandbox';
}

export const EBAY_API_BASE = isSandbox() ? 'https://api.sandbox.ebay.com' : 'https://api.ebay.com';
export const EBAY_AUTH_BASE = isSandbox() ? 'https://auth.sandbox.ebay.com' : 'https://auth.ebay.com';
// TODO(ebay-verify): sandbox auth host assumed to follow eBay's standard
// env-prefix convention (auth.sandbox.ebay.com); the plan's
// rest-endpoints-used.md only confirms the production host (auth.ebay.com).
export const EBAY_TOKEN_URL = `${EBAY_API_BASE}/identity/v1/oauth2/token`;

export function ebayConfigured(): boolean {
  return Boolean(process.env.EBAY_CLIENT_ID && process.env.EBAY_CLIENT_SECRET);
}

export function requireEbayClientId(): string {
  const value = process.env.EBAY_CLIENT_ID;
  if (!value) throw new Error('EBAY_CLIENT_ID is not configured.');
  return value;
}

export function requireEbayClientSecret(): string {
  const value = process.env.EBAY_CLIENT_SECRET;
  if (!value) throw new Error('EBAY_CLIENT_SECRET is not configured.');
  return value;
}

/** Basic base64(client_id:client_secret) — used on every token-endpoint call (confidential client, no PKCE). */
export function basicAuthHeader(): string {
  const raw = `${requireEbayClientId()}:${requireEbayClientSecret()}`;
  return `Basic ${Buffer.from(raw, 'utf8').toString('base64')}`;
}

interface EbayErrorDetailEntry {
  errorId?: number;
  domain?: string;
  category?: string;
  message?: string;
}

export class EbayApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly operatorMessage: string;
  readonly retryable: boolean;
  readonly errorId?: number;
  readonly category?: string;
  readonly detail: unknown; // redacted response detail — safe to store in a sync-log row

  constructor(opts: {
    status: number;
    code: string;
    operatorMessage: string;
    retryable: boolean;
    errorId?: number;
    category?: string;
    detail?: unknown;
  }) {
    super(opts.operatorMessage);
    this.name = 'EbayApiError';
    this.status = opts.status;
    this.code = opts.code;
    this.operatorMessage = opts.operatorMessage;
    this.retryable = opts.retryable;
    this.errorId = opts.errorId;
    this.category = opts.category;
    this.detail = opts.detail;
  }
}

interface EbayErrorEnvelope {
  errors?: Array<{
    errorId?: number;
    domain?: string;
    category?: string;
    message?: string;
    longMessage?: string;
    parameters?: Array<{ name?: string; value?: string }>;
  }>;
}

// Allowlist only — never a raw dump of the response body (11-error-handling.md:
// "never log Authorization material; detail is built from an allowlist of
// response fields, not a raw dump").
function redactDetail(body: EbayErrorEnvelope | null): EbayErrorDetailEntry[] | null {
  if (!body?.errors?.length) return null;
  return body.errors.map((entry) => ({
    errorId: entry.errorId,
    domain: entry.domain,
    category: entry.category,
    message: typeof (entry.longMessage ?? entry.message) === 'string' ? (entry.longMessage ?? entry.message)!.slice(0, 500) : undefined,
  }));
}

function mapErrorResponse(status: number, body: EbayErrorEnvelope | null): EbayApiError {
  const first = body?.errors?.[0];
  const errorId = first?.errorId;
  const category = first?.category;
  const message = first?.longMessage || first?.message || `eBay API error (HTTP ${status}).`;
  const detail = redactDetail(body);

  if (status === 429 || errorId === 2001) {
    return new EbayApiError({
      status,
      code: 'rate_limited',
      operatorMessage: 'eBay is rate-limiting requests right now. Retrying automatically.',
      retryable: true,
      errorId,
      category,
      detail,
    });
  }
  if (status === 401 || errorId === 1001 || errorId === 1003) {
    return new EbayApiError({
      status,
      code: 'auth_expired',
      operatorMessage: 'eBay connection expired — click Reconnect eBay.',
      retryable: false,
      errorId,
      category,
      detail,
    });
  }
  if (errorId === 1100) {
    return new EbayApiError({
      status,
      code: 'missing_scope',
      operatorMessage: 'eBay connection is missing a required permission — reconnect eBay to grant it.',
      retryable: false,
      errorId,
      category,
      detail,
    });
  }
  if (category === 'APPLICATION' || status >= 500) {
    return new EbayApiError({
      status,
      code: 'ebay_server_error',
      operatorMessage: message,
      retryable: true,
      errorId,
      category,
      detail,
    });
  }
  return new EbayApiError({
    status,
    code: 'ebay_error',
    operatorMessage: message,
    retryable: false,
    errorId,
    category,
    detail,
  });
}

// Modest throttle (min-interval gate, not a true token bucket) — mirrors
// etsy/client.ts. eBay's REST APIs don't document a hard per-second QPS cap
// at this catalog's daily-quota scale (10-rate-limits-and-quotas.md), so this
// is a courtesy pace, not a compliance requirement.
const MIN_INTERVAL_MS = 280; // ~3.5 req/s
let lastRequestAt = 0;

async function throttle(): Promise<void> {
  const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastRequestAt = Date.now();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface EbayRequestOptions {
  method: 'GET' | 'PUT' | 'POST' | 'DELETE';
  path: string; // absolute (https://...) or relative to EBAY_API_BASE
  accessToken?: string; // omit for application-token / unauthenticated calls
  json?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  contentLanguage?: boolean; // required by Sell Inventory write calls (Content-Language: en-US)
  maxRetries?: number;
}

export interface EbayResponse<T> {
  data: T;
  headers: Headers;
}

function buildUrl(path: string, query?: EbayRequestOptions['query']): URL {
  const url = new URL(path.startsWith('http') ? path : `${EBAY_API_BASE}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url;
}

export async function ebayFetch<T>(opts: EbayRequestOptions): Promise<EbayResponse<T>> {
  const url = buildUrl(opts.path, opts.query);
  const maxRetries = opts.maxRetries ?? 3;

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (opts.accessToken) headers.Authorization = `Bearer ${opts.accessToken}`;
  if (opts.contentLanguage) headers['Content-Language'] = 'en-US';
  let body: string | undefined;
  if (opts.json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.json);
  }

  let attempt = 0;
  for (;;) {
    await throttle();
    const res = await fetch(url, { method: opts.method, headers, body, cache: 'no-store' });

    if (res.ok) {
      const data = res.status === 204 ? (null as T) : ((await res.json().catch(() => null)) as T);
      return { data, headers: res.headers };
    }

    const parsedBody = (await res.json().catch(() => null)) as EbayErrorEnvelope | null;
    const error = mapErrorResponse(res.status, parsedBody);
    if (error.retryable && attempt < maxRetries) {
      const backoffMs = 2 ** attempt * 1000; // 1s -> 2s -> 4s
      const jitter = Math.random() * 250;
      await sleep(backoffMs + jitter);
      attempt += 1;
      continue;
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Application token (client-credentials grant) — used for Taxonomy/Metadata/
// Notification-public-key reads, which don't need a seller's user token.
// Cached in-module for the lifetime of the invocation (Netlify functions are
// short-lived, so this is deliberately simple, not distributed/persisted —
// same reasoning as the request throttle above).
// ---------------------------------------------------------------------------
const APP_TOKEN_SCOPE = 'https://api.ebay.com/oauth/api_scope';
let cachedAppToken: { token: string; expiresAt: number } | null = null;

export async function getApplicationToken(): Promise<string> {
  if (cachedAppToken && cachedAppToken.expiresAt - 60_000 > Date.now()) {
    return cachedAppToken.token;
  }

  const res = await fetch(EBAY_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'client_credentials', scope: APP_TOKEN_SCOPE }).toString(),
    cache: 'no-store',
  });

  const parsed = (await res.json().catch(() => null)) as
    | { access_token?: string; expires_in?: number; error?: string; error_description?: string }
    | null;

  if (!res.ok || !parsed?.access_token) {
    throw new EbayApiError({
      status: res.status,
      code: 'app_token_failed',
      operatorMessage: parsed?.error_description || 'Could not obtain an eBay application token.',
      retryable: res.status >= 500,
    });
  }

  cachedAppToken = {
    token: parsed.access_token,
    expiresAt: Date.now() + (parsed.expires_in ?? 7200) * 1000,
  };
  return cachedAppToken.token;
}
