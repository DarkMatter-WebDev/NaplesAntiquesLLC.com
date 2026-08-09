import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';
import { fetchSpotData } from '@/lib/spot-price';
import type { Product } from '@/types/product';
import { buildDeepFieldPayload, type DeepFieldProductPayload } from './payload';

/**
 * Batches are budgeted by IMAGE COUNT, not product count.
 *
 * Deep Field's receiver advertises a 25-product cap but copies every image
 * synchronously inside the request, so wall-clock scales with images. NEJ's
 * images-per-product range from 2 to 19 (avg 7.6, 31 products at 10+), so
 * product count says almost nothing about how long a request takes. A single
 * product is never split, so the largest product defines the worst case.
 *
 * Applies to live sync as much as the bulk import: an admin bulk status change
 * can hand this function 25+ ids at once.
 *
 * ── Why 30 (raised from 18 on 2026-08-08) ─────────────────────────────────
 *
 * Measured through the live receiver after Deep Field deployed bounded
 * concurrency: the same 19-image product went 11.6s -> 3.0s warm
 * (0.61 -> 0.158s/image, 3.8x). Their three heaviest products — 53 images in
 * one request — completed in 8.3-11.0s with zero failures.
 *
 * 30 survives the WORST combination of two unknowns, not the likely one:
 *
 *   TIMEOUT CEILING — unresolved. Two things are FACTS: a 21.1s request
 *   survived, and a 38-image batch failed. The failing request's duration was
 *   never measured, so any "it failed at ~Ns" figure is a derivation, not an
 *   observation — an earlier such number was retracted by Deep Field after it
 *   turned out to apply post-change rates to a pre-change event. What does
 *   survive: Netlify documents 60s synchronous, yet even the slowest model puts
 *   that batch near 41s, comfortably inside 60s, and it still failed. So 60s
 *   fits none of the observations and ~26s fits all of them. Hypothesis, not
 *   measurement. `maxDuration` cannot raise it — Netlify's limits are fixed
 *   (60s sync / 30s scheduled / 15min background).
 *
 *   COLD COST — cold start is a ~9.1s FIXED cost (12.1s cold vs 3.0s warm at
 *   19 images), NOT a per-image multiplier. But no LARGE batch has been
 *   measured cold, so the pessimistic per-image-scaling reading cannot be
 *   ruled out.
 *
 * At 30 images: 19.1s under pessimistic scaling, 13.8s under fixed-overhead —
 * both inside even a 26s ceiling. At 40 the scaling model reaches 25.5s and the
 * margin is gone; at 60 it is fatal under 26s. **Do not raise past 30 until the
 * real "Task timed out after N seconds" value is known.**
 *
 * Effect: bulk import drops from 67 requests to 46. Live sync is unaffected —
 * it sends one product per request.
 */
export const IMAGE_BUDGET_PER_REQUEST = 30;
export const MAX_PRODUCTS_PER_REQUEST = 3;

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
// Read at CALL time, not module load. As a module-level const this captured
// whatever the env held at import, which is before a test's beforeEach can set
// it — so the override silently did nothing and three retrying tests each slept
// through the real 1.5s/3s backoff. Reading lazily also means a deployed
// environment can change it without a rebuild.
const retryBaseDelayMs = () => Number(process.env.DEEPFIELD_SYNC_RETRY_DELAY_MS ?? 1500);

// There is deliberately NO status exclusion list here any more. Archived rows
// are pushed WITH `status: 'archived'` so the partner can hide them; filtering
// them out silently left a deleted product live on their side. The bulk-import
// script still excludes archived rows, because a first-time import should not
// seed a partner with soft-deleted history — that is a different question from
// notifying them of a change.

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
      const delay = retryBaseDelayMs() * attempt; // linear; the caller is not waiting on us
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

    // Archived products ARE sent, carrying `status: 'archived'`, so Deep Field
    // can hide them (owner, 2026-08-08). They used to be filtered out on the
    // reasoning that a soft-deleted row should not be pushed to a partner —
    // but the effect was that archiving something told Deep Field NOTHING, so
    // it kept showing a product the storefront had already removed, with no
    // error anywhere. Proven live with `test-item-111-131`.
    //
    // This does NOT remove the need for the reconciliation endpoint. Two things
    // it still cannot cover:
    //   - a HARD delete (AdminShell's "delete permanently"): the row is gone
    //     before this function re-reads it, so there is nothing to send at all;
    //   - a dropped delivery: this path is fire-and-forget with no durable
    //     queue, so a partner outage past the retries loses the notice for good.
    // Both are latency-free to detect via /api/integrations/deepfield/product-ids.
    const products = (data ?? []) as Product[];
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
        // Log the PRODUCT IDS, not just a count. Without them this line says
        // "something failed" and leaves no way to recover the specific rows —
        // and Netlify retains function logs for only ~24h, so a count alone is
        // unrecoverable the next day.
        const ids = batch.map((p) => p.id).join(', ');
        console.error(
          `[deepfield] ${label}UNDELIVERED after ${MAX_ATTEMPTS} attempt(s): `
          + `${batch.length} product(s)/${images} image(s), `
          + `HTTP ${result.status ?? 'network'} ${result.error ?? ''} — ids: ${ids}`,
        );
        // Later batches are independent products; keep going rather than
        // abandoning them because one batch failed.
        //
        // ⚠️ THERE IS NO DURABLE RECORD OF THIS. Deliberately: a durable queue
        // means a table plus a worker, and this path runs inside order captures
        // where a partner outage must never fail a customer's payment. The
        // consequence is that these products are simply not delivered and
        // nothing in the app will ever notice.
        //
        // The intended backstop is the partner polling
        // /api/integrations/deepfield/product-ids and comparing `updated_at`,
        // not just presence — a dropped UPDATE leaves the id present on both
        // sides with a stale copy on theirs. Until they do that, this log line
        // is the only trace.
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
