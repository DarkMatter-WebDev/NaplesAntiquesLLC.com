import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';
import { fetchSpotData } from '@/lib/spot-price';
import type { Product } from '@/types/product';
import { buildDeepFieldPayload, type DeepFieldProductPayload } from './payload';

/**
 * Deep Field's receiver caps a request at 25 products, but that cap is NOT
 * reachable in production and product count is the wrong unit anyway.
 *
 * The receiver copies every image synchronously inside the request at roughly
 * 1.2s each, so wall-clock scales with IMAGES, not products — and NEJ's
 * images-per-product range from 2 to 19 (avg 7.6, with 31 products at 10 or
 * more). Measured during the 2026-08-08 bulk import: a 3-product batch carrying
 * 17 images succeeded while a 3-product batch carrying 38 images died at a
 * gateway "Inactivity Timeout". 25 products is ~190 images ≈ 4 minutes in one
 * HTTP call, which no gateway allows.
 *
 * So batches are budgeted by image count. A single product is never split, so
 * the largest product defines the worst case.
 *
 * This matters for live sync too, not just the bulk import: a bulk status
 * change in admin can hand this function 25+ ids at once.
 */
const IMAGE_BUDGET_PER_REQUEST = 18;
const MAX_PRODUCTS_PER_REQUEST = 3;

/**
 * Bounds a hung socket. Generous because a legitimate batch still takes tens of
 * seconds, and this is fire-and-forget so waiting costs nothing.
 */
const REQUEST_TIMEOUT_MS = 2 * 60 * 1000;

/**
 * Transient-failure retries per batch.
 *
 * Live sync has no durable queue — by design, since the alternative is a table
 * and a worker, and a partner outage must never fail a customer's payment. A
 * couple of in-process retries covers the common case (a blip, a cold start, a
 * gateway hiccup) without that machinery. It does NOT survive a process
 * restart, and that limit is deliberate and documented for Deep Field.
 */
const MAX_ATTEMPTS = 3;
/**
 * Overridable so tests do not spend real seconds asleep — three retrying cases
 * added ~10s to the suite otherwise. Unset in every real environment, where the
 * 1500ms default applies.
 */
const RETRY_BASE_DELAY_MS = Number(process.env.DEEPFIELD_SYNC_RETRY_DELAY_MS ?? 1500);

/** Archived is NEJ's soft-delete. Never push soft-deleted rows to a partner. */
const EXCLUDED_STATUSES = new Set(['archived']);

export interface DeepFieldBatchResult {
  ok: boolean;
  status: number | null;
  imported?: number;
  failed?: number;
  warnings: string[];
  error?: string;
}

function getConfig(): { url: string; token: string; dryRun: boolean } | null {
  const url = process.env.DEEPFIELD_SYNC_URL;
  const token = process.env.DEEPFIELD_SYNC_TOKEN;
  if (!url || !token) return null;
  // DEEPFIELD_SYNC_DRY_RUN=true exercises the ENTIRE path — service-role read,
  // payload build, field-policy assert, batching, auth, HTTP round trip — while
  // telling the receiver to validate and discard instead of writing.
  //
  // This exists so a non-production environment can behave exactly like
  // production without side effects. Local dev shares production's Supabase
  // database, so an admin save in dev is a real product change; without this
  // flag, testing the hooks against the live receiver would write real rows and
  // copy real images into the live gallery.
  const dryRun = String(process.env.DEEPFIELD_SYNC_DRY_RUN ?? '').toLowerCase() === 'true';
  return { url, token, dryRun };
}

/** Whether the Deep Field sync is wired up at all. */
export function isDeepFieldSyncConfigured(): boolean {
  return getConfig() != null;
}

/**
 * Group payloads so each request stays inside the image budget. Exported for
 * testing — the sizing rule is the whole point and needs to be pinned.
 */
export function chunkByImageBudget(
  items: DeepFieldProductPayload[],
  imageBudget = IMAGE_BUDGET_PER_REQUEST,
  maxProducts = MAX_PRODUCTS_PER_REQUEST,
): DeepFieldProductPayload[][] {
  const out: DeepFieldProductPayload[][] = [];
  let current: DeepFieldProductPayload[] = [];
  let currentImages = 0;

  for (const item of items) {
    const images = item.images?.length ?? 0;
    // A product is never split across requests, so an oversized single product
    // ships alone rather than being dropped or truncated.
    if (current.length > 0
      && (currentImages + images > imageBudget || current.length >= maxProducts)) {
      out.push(current);
      current = [];
      currentImages = 0;
    }
    current.push(item);
    currentImages += images;
  }
  if (current.length > 0) out.push(current);
  return out;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function postBatch(
  url: string,
  token: string,
  products: DeepFieldProductPayload[],
  dryRun: boolean,
): Promise<DeepFieldBatchResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(
        dryRun
          ? { dryRun: true, copyImages: false, products }
          : { copyImages: true, products },
      ),
      signal: controller.signal,
      cache: 'no-store',
    });

    const text = await response.text();
    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = JSON.parse(text) as Record<string, unknown>;
    } catch {
      parsed = null;
    }

    const perProduct = Array.isArray(parsed?.results)
      ? (parsed.results as { sourceProductId?: string; warnings?: string[] }[])
      : [];
    const warnings = perProduct.flatMap((row) =>
      (row.warnings ?? []).map((w) => `${row.sourceProductId ?? 'unknown'}: ${w}`),
    );

    return {
      ok: response.ok,
      status: response.status,
      imported: typeof parsed?.imported === 'number' ? parsed.imported : undefined,
      failed: typeof parsed?.failed === 'number' ? parsed.failed : undefined,
      warnings,
      error: response.ok ? undefined : text.slice(0, 500),
    };
  } finally {
    clearTimeout(timer);
  }
}

/** A failure worth retrying: the request never got a verdict, or the server
 *  said it could not answer right now. A 4xx is a verdict — retrying repeats it. */
function isRetryable(result: DeepFieldBatchResult): boolean {
  if (result.status == null) return true; // network error, abort, DNS, socket
  return result.status >= 500 || result.status === 408 || result.status === 429;
}

/** Send one batch, retrying only transient failures. Never throws. */
async function postBatchWithRetry(
  url: string,
  token: string,
  products: DeepFieldProductPayload[],
  dryRun: boolean,
): Promise<DeepFieldBatchResult> {
  let last: DeepFieldBatchResult = {
    ok: false, status: null, warnings: [], error: 'not attempted',
  };

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      last = await postBatch(url, token, products, dryRun);
    } catch (error) {
      last = { ok: false, status: null, warnings: [], error: String(error).slice(0, 500) };
    }
    if (last.ok || !isRetryable(last)) return last;

    if (attempt < MAX_ATTEMPTS) {
      const delay = RETRY_BASE_DELAY_MS * attempt; // linear; the caller is not waiting on us
      console.warn(
        `[deepfield] attempt ${attempt}/${MAX_ATTEMPTS} failed `
        + `(HTTP ${last.status ?? 'network'}); retrying in ${delay}ms`,
      );
      await sleep(delay);
    }
  }
  return last;
}

/**
 * Push the given products to Deep Field.
 *
 * ALWAYS best-effort and non-throwing. Callers are order captures and admin
 * saves; a Deep Field outage must never fail a customer's payment or block an
 * admin from saving a listing. Every failure is logged and swallowed — the same
 * contract handleProductStatusChange already follows for Etsy and eBay.
 *
 * No-ops entirely when DEEPFIELD_SYNC_URL / DEEPFIELD_SYNC_TOKEN are unset, so
 * this is inert until deliberately configured.
 */
export async function syncProductsToDeepField(productIds: string[]): Promise<void> {
  const ids = Array.from(new Set(productIds.filter(Boolean)));
  if (ids.length === 0) return;

  const config = getConfig();
  if (!config) return;

  try {
    const service = createServiceClient();
    const [{ data, error }, spotData] = await Promise.all([
      service.from('products').select('*').in('id', ids),
      // A spot failure must not abort the sync: manual and sold-locked prices
      // do not need it, and resolveDeepFieldPrice reports a null price with a
      // reason for spot items rather than inventing a fallback figure.
      fetchSpotData().catch(() => null),
    ]);

    if (error) {
      console.error('[deepfield] product read failed:', error.message);
      return;
    }

    const products = ((data ?? []) as Product[]).filter(
      (product) => !EXCLUDED_STATUSES.has(String(product.status).toLowerCase()),
    );
    if (products.length === 0) return;

    const payloads: DeepFieldProductPayload[] = [];
    for (const product of products) {
      try {
        payloads.push(buildDeepFieldPayload(product, spotData));
      } catch (buildError) {
        // A payload that would leak an internal field is skipped, never sent.
        console.error(`[deepfield] skipped ${product.id}:`, buildError);
      }
    }
    if (payloads.length === 0) return;

    for (const batch of chunkByImageBudget(payloads)) {
      const result = await postBatchWithRetry(config.url, config.token, batch, config.dryRun);
      const label = config.dryRun ? 'dry-run ' : '';
      if (!result.ok) {
        const images = batch.reduce((n, p) => n + (p.images?.length ?? 0), 0);
        console.error(
          `[deepfield] ${label}batch of ${batch.length} product(s)/${images} image(s) failed after `
          + `${MAX_ATTEMPTS} attempt(s): HTTP ${result.status ?? 'network'} ${result.error ?? ''}`,
        );
        // Later batches are independent products; keep going rather than
        // abandoning them because one batch failed. There is no durable queue,
        // so these products are simply not delivered — Deep Field reconciles
        // them via the id-list endpoint (api/integrations/deepfield/product-ids).
        continue;
      }
      if (result.failed) {
        console.error(`[deepfield] ${result.failed} product(s) rejected in a ${label}batch of ${batch.length}`);
      } else {
        console.log(`[deepfield] ${label}synced ${result.imported ?? batch.length} product(s)`);
      }
      for (const warning of result.warnings) {
        console.warn(`[deepfield] ${warning}`);
      }
    }
  } catch (unexpected) {
    console.error('[deepfield] sync failed:', unexpected);
  }
}

/**
 * Fire-and-forget entry point for the product-write chokepoints.
 *
 * Returns immediately. Never rejects, so a bare call needs no `.catch()` at the
 * call site to be safe — though call sites still use `void … .catch(() => {})`
 * to match the surrounding Etsy/eBay convention.
 */
export function queueDeepFieldSync(productIds: string[]): void {
  void syncProductsToDeepField(productIds).catch((error) => {
    console.error('[deepfield] queued sync failed:', error);
  });
}
