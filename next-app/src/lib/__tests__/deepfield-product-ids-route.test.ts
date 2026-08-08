import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The route reads products through the service client; stub it so these tests
// exercise auth + filtering deterministically and never touch the network.
const selectMock = vi.fn();
vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from: () => ({
      select: () => ({ order: () => selectMock() }),
    }),
  }),
}));

const { GET } = await import('@/app/api/integrations/deepfield/product-ids/route');

const TOKEN = 'test-token-abcdefghijklmnop';

function req(auth?: string) {
  return new Request('https://naplesestatejewelry.com/api/integrations/deepfield/product-ids', {
    headers: auth ? { authorization: auth } : {},
  }) as unknown as Parameters<typeof GET>[0];
}

beforeEach(() => {
  process.env.DEEPFIELD_SYNC_TOKEN = TOKEN;
  selectMock.mockResolvedValue({
    data: [
      { id: 'available-1', status: 'available', updated_at: '2026-08-01T00:00:00Z' },
      { id: 'sold-1', status: 'sold', updated_at: '2026-08-02T00:00:00Z' },
      { id: 'archived-1', status: 'archived', updated_at: '2026-08-03T00:00:00Z' },
      { id: 'legacy-case', status: 'Available', updated_at: '2026-08-04T00:00:00Z' },
    ],
    error: null,
  });
});

afterEach(() => {
  delete process.env.DEEPFIELD_SYNC_TOKEN;
  vi.clearAllMocks();
});

describe('GET /api/integrations/deepfield/product-ids', () => {
  it('503s when unconfigured, so it is never mistaken for an empty catalog', async () => {
    delete process.env.DEEPFIELD_SYNC_TOKEN;
    const res = await GET(req(`Bearer ${TOKEN}`));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error.code).toBe('not_configured');
    // Critically: no `products` key at all. An empty list here would read as
    // "delete everything" to a reconciler.
    expect(body).not.toHaveProperty('products');
  });

  it('401s with no header', async () => {
    expect((await GET(req())).status).toBe(401);
  });

  it('401s on a wrong token', async () => {
    expect((await GET(req('Bearer wrong-token-value'))).status).toBe(401);
  });

  it('401s on a token that is a prefix of the real one', async () => {
    expect((await GET(req(`Bearer ${TOKEN.slice(0, -1)}`))).status).toBe(401);
  });

  it('401s when the scheme is missing', async () => {
    expect((await GET(req(TOKEN))).status).toBe(401);
  });

  it('accepts a correct token and excludes archived rows', async () => {
    const res = await GET(req(`Bearer ${TOKEN}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.count).toBe(3);
    expect(body.products.map((p: { id: string }) => p.id))
      .toEqual(['available-1', 'sold-1', 'legacy-case']);
    expect(body.products.some((p: { id: string }) => p.id === 'archived-1')).toBe(false);
  });

  it('normalizes legacy title-case status', async () => {
    const body = await (await GET(req(`Bearer ${TOKEN}`))).json();
    const legacy = body.products.find((p: { id: string }) => p.id === 'legacy-case');
    expect(legacy.status).toBe('available');
  });

  it('returns id, status and updated_at — and nothing else', async () => {
    const body = await (await GET(req(`Bearer ${TOKEN}`))).json();
    expect(Object.keys(body.products[0]).sort()).toEqual(['id', 'status', 'updated_at']);
  });

  it('is never cached', async () => {
    const res = await GET(req(`Bearer ${TOKEN}`));
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('502s on a read failure rather than reporting an empty catalog', async () => {
    selectMock.mockResolvedValue({ data: null, error: { message: 'boom' } });
    const res = await GET(req(`Bearer ${TOKEN}`));
    expect(res.status).toBe(502);
    expect(await res.json()).not.toHaveProperty('products');
  });
});
