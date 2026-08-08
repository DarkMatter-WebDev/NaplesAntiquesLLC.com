import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The module reads env at call time via getConfig(), so these can be flipped
// per test. Supabase and spot are mocked so nothing touches the network or a
// real database.
const selectIn = vi.fn();
vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from: () => ({ select: () => ({ in: selectIn }) }),
  }),
}));
vi.mock('@/lib/spot-price', () => ({
  fetchSpotData: async () => ({
    goldPerTroyOz: 4343.299805,
    silverPerTroyOz: 63.707001,
    fetchedAt: 1786146956481,
    source: 'api' as const,
  }),
}));

const { syncProductsToDeepField, queueDeepFieldSync, isDeepFieldSyncConfigured } =
  await import('@/lib/deepfield/sync');

function productRow(id: string) {
  return {
    id,
    status: 'available',
    category: 'Gold',
    price_mode: 'manual',
    manual_price_label: '$100',
    purity: 14,
    gram_weight: 10,
    weight_grams: 10,
    pricing_multiplier: 1.25,
    images: [],
    image_urls: [],
    // Internal fields that must never be transmitted.
    cost_basis: 1,
    minimum_price: 2,
    internal_notes: 'private',
    acquisition_source: 'private',
  };
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  delete process.env.DEEPFIELD_SYNC_URL;
  delete process.env.DEEPFIELD_SYNC_TOKEN;
  delete process.env.DEEPFIELD_SYNC_DRY_RUN;
  selectIn.mockReset();
  selectIn.mockResolvedValue({ data: [productRow('a')], error: null });
  fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ imported: 1, failed: 0, success: true, results: [] }),
  });
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('deep field sync is inert unless configured', () => {
  it('sends nothing and reads nothing when both vars are unset', async () => {
    expect(isDeepFieldSyncConfigured()).toBe(false);
    await syncProductsToDeepField(['a']);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(selectIn).not.toHaveBeenCalled();
  });

  it('stays inert when only the URL is set', async () => {
    process.env.DEEPFIELD_SYNC_URL = 'https://example.test/receiver';
    await syncProductsToDeepField(['a']);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('stays inert when only the token is set', async () => {
    process.env.DEEPFIELD_SYNC_TOKEN = 'tok';
    await syncProductsToDeepField(['a']);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does nothing for an empty id list even when configured', async () => {
    process.env.DEEPFIELD_SYNC_URL = 'https://example.test/receiver';
    process.env.DEEPFIELD_SYNC_TOKEN = 'tok';
    await syncProductsToDeepField([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('deep field sync when configured', () => {
  beforeEach(() => {
    process.env.DEEPFIELD_SYNC_URL = 'https://example.test/receiver';
    process.env.DEEPFIELD_SYNC_TOKEN = 'tok';
  });

  it('posts with bearer auth and a live-import body', async () => {
    await syncProductsToDeepField(['a']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://example.test/receiver');
    expect(init.headers.Authorization).toBe('Bearer tok');
    const body = JSON.parse(init.body);
    expect(body.copyImages).toBe(true);
    expect(body.dryRun).toBeUndefined();
    expect(body.products).toHaveLength(1);
  });

  it('sends a dry-run body when the flag is exactly "true"', async () => {
    process.env.DEEPFIELD_SYNC_DRY_RUN = 'true';
    await syncProductsToDeepField(['a']);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.dryRun).toBe(true);
    expect(body.copyImages).toBe(false);
  });

  it('treats any other flag value as live, so a typo cannot silently disable it', async () => {
    for (const value of ['1', 'yes', 'TRUE_ISH', '']) {
      fetchMock.mockClear();
      process.env.DEEPFIELD_SYNC_DRY_RUN = value;
      await syncProductsToDeepField(['a']);
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.dryRun, `value ${JSON.stringify(value)}`).toBeUndefined();
    }
  });

  it('never transmits internal fields', async () => {
    await syncProductsToDeepField(['a']);
    const raw = fetchMock.mock.calls[0][1].body as string;
    for (const forbidden of [
      'cost_basis', 'minimum_price', 'internal_notes', 'acquisition_source',
      'private_price_label', 'live_spot_snapshot', 'acquisition_date',
      'reserved_until', 'reserved_order_id', 'price_label',
    ]) {
      expect(raw, `payload must not contain ${forbidden}`).not.toContain(`"${forbidden}"`);
    }
  });

  it('never pushes archived (soft-deleted) products', async () => {
    selectIn.mockResolvedValue({
      data: [{ ...productRow('a'), status: 'archived' }],
      error: null,
    });
    await syncProductsToDeepField(['a']);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('batches at 25 per request', async () => {
    selectIn.mockResolvedValue({
      data: Array.from({ length: 53 }, (_, i) => productRow(`p${i}`)),
      error: null,
    });
    await syncProductsToDeepField(Array.from({ length: 53 }, (_, i) => `p${i}`));
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const sizes = fetchMock.mock.calls.map((c) => JSON.parse(c[1].body).products.length);
    expect(sizes).toEqual([25, 25, 3]);
  });
});

describe('deep field sync never throws into its caller', () => {
  beforeEach(() => {
    process.env.DEEPFIELD_SYNC_URL = 'https://example.test/receiver';
    process.env.DEEPFIELD_SYNC_TOKEN = 'tok';
  });

  it('swallows a network failure', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(syncProductsToDeepField(['a'])).resolves.toBeUndefined();
  });

  it('swallows a database failure', async () => {
    selectIn.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(syncProductsToDeepField(['a'])).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('swallows a non-2xx receiver response', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, text: async () => 'server error' });
    await expect(syncProductsToDeepField(['a'])).resolves.toBeUndefined();
  });

  it('queueDeepFieldSync returns synchronously and never rejects', async () => {
    fetchMock.mockRejectedValue(new Error('down'));
    expect(queueDeepFieldSync(['a'])).toBeUndefined();
    await new Promise((r) => setTimeout(r, 0));
  });
});
