import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/service';
import {
  PRODUCT_IMAGES_BUCKET,
  getProductImageStoragePath,
  uniqueProductImageStoragePaths,
} from '@/lib/product-image-storage';

const ORPHAN_MIN_AGE_MS = 24 * 60 * 60 * 1000;
const SAMPLE_LIMIT = 25;

type StorageObject = {
  name: string;
  id?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
  last_accessed_at?: string | null;
  metadata?: Record<string, unknown> | null;
};

type StorageBucketApi = {
  list: (
    path?: string,
    options?: {
      limit?: number;
      offset?: number;
      sortBy?: { column: string; order: 'asc' | 'desc' };
    },
  ) => Promise<{ data: unknown[] | null; error: { message: string } | null }>;
  remove: (paths: string[]) => Promise<{ error: { message: string } | null }>;
};

function objectTimestamp(object: StorageObject): number | null {
  const raw = object.updated_at ?? object.created_at ?? object.last_accessed_at ?? null;
  if (!raw) return null;
  const timestamp = Date.parse(raw);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

async function maybeSelect<T>(
  label: string,
  query: PromiseLike<{ data: T[] | null; error: { code?: string; message: string } | null }>,
): Promise<T[]> {
  const { data, error } = await query;
  if (!error) return data ?? [];
  throw new Error(`${label}: ${error.message}`);
}

async function listObjectDetails(storage: StorageBucketApi, prefix = ''): Promise<Array<{ path: string; object: StorageObject }>> {
  const rows: Array<{ path: string; object: StorageObject }> = [];
  let offset = 0;

  while (true) {
    const { data, error } = await storage.list(prefix, {
      limit: 100,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    });
    if (error) throw new Error(error.message);

    const entries = (data ?? []) as StorageObject[];
    for (const entry of entries) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      const hasObjectMetadata = Boolean(entry.id || entry.metadata?.size || entry.metadata?.mimetype);
      if (hasObjectMetadata) rows.push({ path, object: entry });
      else rows.push(...await listObjectDetails(storage, path));
    }

    if (entries.length < 100) break;
    offset += entries.length;
  }

  return rows;
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (admin.error) return admin.error;
  const confirm = Boolean((await req.json().catch(() => null))?.confirm);

  const supabase = createServiceClient();
  let products: Array<{ images: unknown; image_urls: unknown }>;
  let orderItems: Array<{ image_snapshot: string | null }>;
  let inquiries: Array<{ uploaded_image_urls: unknown }>;
  let notifications: Array<{ image_urls: unknown }>;

  try {
    [products, orderItems, inquiries, notifications] = await Promise.all([
      maybeSelect<{ images: unknown; image_urls: unknown }>(
        'products.images,image_urls',
        supabase.from('products').select('images, image_urls'),
      ),
      maybeSelect<{ image_snapshot: string | null }>(
        'order_items.image_snapshot',
        supabase.from('order_items').select('image_snapshot'),
      ),
      maybeSelect<{ uploaded_image_urls: unknown }>(
        'inquiries.uploaded_image_urls',
        supabase.from('inquiries').select('uploaded_image_urls'),
      ),
      maybeSelect<{ image_urls: unknown }>(
        'admin_notifications.image_urls',
        supabase.from('admin_notifications').select('image_urls'),
      ),
    ]);
  } catch (error) {
    return NextResponse.json(
      { error: `Storage GC aborted before object scan: ${error instanceof Error ? error.message : 'reference read failed'}` },
      { status: 500 },
    );
  }

  const referencedPaths = new Set(uniqueProductImageStoragePaths([
    ...products.flatMap((row) => [...asStringArray(row.images), ...asStringArray(row.image_urls)]),
    ...orderItems.map((row) => row.image_snapshot),
    ...inquiries.flatMap((row) => asStringArray(row.uploaded_image_urls)),
    ...notifications.flatMap((row) => asStringArray(row.image_urls)),
  ]));

  const storage = supabase.storage.from(PRODUCT_IMAGES_BUCKET);
  const objectRows = await listObjectDetails(storage);
  const now = Date.now();
  const oldUnreferenced = objectRows.filter(({ path, object }) => {
    const timestamp = objectTimestamp(object);
    if (timestamp == null) return false;
    if (now - timestamp < ORPHAN_MIN_AGE_MS) return false;
    return !referencedPaths.has(getProductImageStoragePath(path) ?? path);
  });
  const unknownAgeCount = objectRows.filter(({ object }) => objectTimestamp(object) == null).length;

  let deletedPaths: string[] = [];
  if (confirm && oldUnreferenced.length > 0) {
    deletedPaths = oldUnreferenced.map(({ path }) => path);
    const { error } = await storage.remove(deletedPaths);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    dryRun: !confirm,
    objectCount: objectRows.length,
    referencedPathCount: referencedPaths.size,
    orphanCount: oldUnreferenced.length,
    skippedUnknownAgeCount: unknownAgeCount,
    samplePaths: oldUnreferenced.slice(0, SAMPLE_LIMIT).map(({ path }) => path),
    deletedCount: deletedPaths.length,
    deletedSamplePaths: deletedPaths.slice(0, SAMPLE_LIMIT),
  });
}
