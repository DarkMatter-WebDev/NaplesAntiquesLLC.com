import 'server-only';

/**
 * Thin fetch wrapper for the Facebook Graph API (graph.facebook.com, Page
 * access tokens).
 *
 * Deliberately does NOT import from lib/instagram (or etsy/ebay): each channel
 * owns its own client so a change to one can never destabilise another. The
 * shape is copied from lib/instagram/client.ts, the code is not shared.
 *
 * How a Facebook photo post differs from an Instagram carousel:
 *   * There is no container/publish two-step and no processing poll. Each image
 *     is uploaded as an UNPUBLISHED photo (published=false) — Meta fetches the
 *     URL synchronously during that call — and one feed post then attaches all
 *     of them via `attached_media`. Unpublished photos are only attachable for
 *     ~24h, so ids are checkpointed with an expiry like Instagram's containers.
 *   * Posts CAN be deleted (DELETE /{post-id}) and their text edited. Instagram
 *     allows neither.
 *   * There is no queryable publishing quota; the owner's own daily limit is
 *     the only cap.
 */

const FACEBOOK_GRAPH_BASE = 'https://graph.facebook.com';
export const FACEBOOK_GRAPH_VERSION = 'v23.0';

/**
 * Product photos per post. Facebook technically allows far more attachments,
 * but the posting pipeline is shared with Instagram's shape — a generated card
 * plus up to nine photos — so both channels present the same carousel and the
 * operator curates one lineup size.
 */
export const FACEBOOK_MAX_PHOTO_ITEMS = 9;
/** Facebook's post-body limit. Practically unreachable for our captions. */
export const FACEBOOK_MAX_CAPTION_CHARS = 63206;
/** Hashtag ceiling kept identical to Instagram's so shared tags behave the same. */
export const FACEBOOK_MAX_HASHTAGS = 30;
/** Unpublished photos are only attachable for about a day. */
export const FACEBOOK_PHOTO_TTL_MS = 24 * 60 * 60 * 1000;

export class FacebookApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly operatorMessage: string;
  readonly retryable: boolean;
  readonly detail: Record<string, unknown> | null;

  constructor(params: {
    status: number;
    code: string;
    operatorMessage: string;
    retryable: boolean;
    detail?: Record<string, unknown> | null;
  }) {
    super(params.operatorMessage);
    this.name = 'FacebookApiError';
    this.status = params.status;
    this.code = params.code;
    this.operatorMessage = params.operatorMessage;
    this.retryable = params.retryable;
    this.detail = params.detail ?? null;
  }
}

/**
 * Access tokens must never reach a log line or an operator-facing message.
 * Facebook tokens are the classic "EAA…" form.
 */
export function redactFacebookSecrets(value: string): string {
  return value
    .replace(/access_token=[^&\s]+/gi, 'access_token=[redacted]')
    .replace(/EAA[A-Za-z0-9]{20,}/g, '[redacted-token]');
}

type MetaErrorBody = {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    error_user_msg?: string;
    fbtrace_id?: string;
  };
};

/** Meta transient/rate-limit codes worth retrying rather than failing closed. */
const RETRYABLE_META_CODES = new Set([1, 2, 4, 17, 32, 341, 613]);

function isRetryable(status: number, body: MetaErrorBody | null): boolean {
  if (status === 429 || status >= 500) return true;
  const code = body?.error?.code;
  return typeof code === 'number' && RETRYABLE_META_CODES.has(code);
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

interface FacebookFetchParams {
  path: string;
  accessToken: string;
  method?: 'GET' | 'POST' | 'DELETE';
  /** Query string params (GET/DELETE) or form body params (POST). */
  params?: Record<string, string | number | boolean | undefined>;
  /** Total attempts including the first. */
  maxAttempts?: number;
}

/** One Facebook Graph API call with bounded backoff. */
export async function facebookFetch<T>(params: FacebookFetchParams): Promise<T> {
  const { path, accessToken, method = 'GET', params: extra = {}, maxAttempts = 3 } = params;

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(`${FACEBOOK_GRAPH_BASE}/${FACEBOOK_GRAPH_VERSION}${normalizedPath}`);

  const payload: Record<string, string> = {};
  for (const [key, value] of Object.entries(extra)) {
    if (value === undefined) continue;
    payload[key] = String(value);
  }

  let lastError: FacebookApiError | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let res: Response;
    const init: RequestInit = { method, cache: 'no-store' };

    if (method === 'POST') {
      const body = new URLSearchParams({ ...payload, access_token: accessToken });
      init.body = body;
      init.headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    } else {
      for (const [key, value] of Object.entries(payload)) url.searchParams.set(key, value);
      url.searchParams.set('access_token', accessToken);
    }

    try {
      res = await fetch(url.toString(), init);
    } catch (err) {
      lastError = new FacebookApiError({
        status: 0,
        code: 'network_error',
        operatorMessage: redactFacebookSecrets(
          err instanceof Error ? err.message : 'Network error calling Facebook.',
        ),
        retryable: true,
      });
      if (attempt < maxAttempts) {
        await sleep(500 * attempt);
        continue;
      }
      throw lastError;
    }

    const text = await res.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = null;
    }

    if (res.ok) return (body ?? {}) as T;

    const errorBody = body as MetaErrorBody | null;
    const retryable = isRetryable(res.status, errorBody);
    // error_user_msg, when present, is Meta's operator-readable phrasing.
    const metaMessage =
      errorBody?.error?.error_user_msg ??
      errorBody?.error?.message ??
      `Facebook returned HTTP ${res.status}.`;

    lastError = new FacebookApiError({
      status: res.status,
      code:
        res.status === 401 || res.status === 403 || errorBody?.error?.code === 190
          ? 'invalid_token'
          : errorBody?.error?.type ?? 'facebook_request_failed',
      operatorMessage: redactFacebookSecrets(metaMessage),
      retryable,
      detail: {
        code: errorBody?.error?.code ?? null,
        subcode: errorBody?.error?.error_subcode ?? null,
        // fbtrace_id is what Meta support asks for when escalating a failure.
        fbtrace_id: errorBody?.error?.fbtrace_id ?? null,
      },
    });

    if (!retryable || attempt >= maxAttempts) throw lastError;
    await sleep(500 * attempt);
  }

  throw lastError ?? new FacebookApiError({
    status: 0,
    code: 'unknown',
    operatorMessage: 'Facebook request failed.',
    retryable: false,
  });
}

// ---------------------------------------------------------------------------
// Typed endpoint helpers
// ---------------------------------------------------------------------------

export interface FacebookPageProfile {
  id: string;
  name?: string;
  /** Present on Page nodes only — its absence means a USER token was pasted. */
  category?: string;
}

/**
 * Identify the node a token belongs to (also our token liveness probe). With a
 * Page access token, /me IS the Page. `category` doubles as the page-vs-user
 * discriminator: user nodes have no category field.
 */
export async function fetchPageProfile(accessToken: string): Promise<FacebookPageProfile> {
  return facebookFetch<FacebookPageProfile>({
    path: '/me',
    accessToken,
    params: { fields: 'id,name,category' },
  });
}

/**
 * Upload one image as an UNPUBLISHED photo — Meta fetches `url` synchronously,
 * so a success here means the bytes are already on Facebook's side. The photo
 * appears nowhere until a feed post attaches it.
 */
export async function createUnpublishedPhoto(params: {
  pageId: string;
  accessToken: string;
  imageUrl: string;
}): Promise<string> {
  const res = await facebookFetch<{ id: string }>({
    path: `/${params.pageId}/photos`,
    accessToken: params.accessToken,
    method: 'POST',
    params: {
      url: params.imageUrl,
      published: false,
      // Keeps the photo out of the Page's photo albums surface even after the
      // feed post attaches it — the post is the only place it appears.
      temporary: true,
    },
  });
  return res.id;
}

/** Create the feed post that ties the unpublished photos together. */
export async function createFeedPost(params: {
  pageId: string;
  accessToken: string;
  message: string;
  photoIds: string[];
}): Promise<string> {
  const res = await facebookFetch<{ id: string }>({
    path: `/${params.pageId}/feed`,
    accessToken: params.accessToken,
    method: 'POST',
    params: {
      message: params.message,
      attached_media: JSON.stringify(params.photoIds.map((id) => ({ media_fbid: id }))),
    },
  });
  return res.id;
}

export interface FacebookPost {
  id: string;
  permalink_url?: string;
  created_time?: string;
  message?: string;
}

/** Read back a published post — our proof that publishing actually worked. */
export async function fetchPost(postId: string, accessToken: string): Promise<FacebookPost> {
  return facebookFetch<FacebookPost>({
    path: `/${postId}`,
    accessToken,
    params: { fields: 'id,permalink_url,created_time,message' },
  });
}

/** Comment on our own post — used for the "SOLD" marker. */
export async function createComment(params: {
  postId: string;
  accessToken: string;
  message: string;
}): Promise<string> {
  const res = await facebookFetch<{ id: string }>({
    path: `/${params.postId}/comments`,
    accessToken: params.accessToken,
    method: 'POST',
    params: { message: params.message },
  });
  return res.id;
}

/** Delete a post. Unlike Instagram, this genuinely works on Facebook. */
export async function deleteFacebookPost(postId: string, accessToken: string): Promise<boolean> {
  const res = await facebookFetch<{ success?: boolean }>({
    path: `/${postId}`,
    accessToken,
    method: 'DELETE',
  });
  return res.success !== false;
}
