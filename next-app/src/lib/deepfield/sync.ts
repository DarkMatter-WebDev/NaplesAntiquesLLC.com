import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';
import { fetchSpotData } from '@/lib/spot-price';
import type { Product } from '@/types/product';
import { buildDeepFieldPayload, type DeepFieldProductPayload } from './payload';

/** Deep Field's receiver caps a request at 25 products. */
const BATCH_SIZE = 25;

/**
 * Deep Field copies every image synchronously before responding, so a full
 * batch legitimately takes minutes. This is fire-and-forget, so a generous
 * ceiling costs nothing — it only bounds a hung socket.
 */
const REQUEST_TIMEOUT_MS = 5 * 60 * 1000;

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

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

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

    for (const batch of chunk(payloads, BATCH_SIZE)) {
      const result = await postBatch(config.url, config.token, batch, config.dryRun);
      const label = config.dryRun ? 'dry-run ' : '';
      if (!result.ok) {
        console.error(
          `[deepfield] ${label}batch of ${batch.length} failed: HTTP ${result.status} ${result.error ?? ''}`,
        );
        // Later batches are independent products; keep going rather than
        // abandoning them because one batch failed.
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
