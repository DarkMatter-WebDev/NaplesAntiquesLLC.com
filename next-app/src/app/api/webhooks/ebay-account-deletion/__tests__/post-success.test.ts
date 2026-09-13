import crypto from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The signed happy path, end to end through the real signature check: a
// throwaway EC key signs the body with SHA1 (what eBay's getPublicKey reports),
// the key endpoint is stubbed, and the Supabase client records every write.
// Guards the 2026-09-13 change: ONE insert into webhook_events, already
// 'processed' — no ebay_sync_log row, no follow-up update.

const state = vi.hoisted(() => ({
  writes: [] as Array<{ table: string; op: string; payload: Record<string, unknown> }>,
  insertError: null as { code?: string; message: string } | null,
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue(true),
  getClientIp: vi.fn().mockReturnValue('192.0.2.1'),
}));

vi.mock('@/lib/ebay/client', () => ({
  EBAY_API_BASE: 'https://api.ebay.test',
  getApplicationToken: vi.fn().mockResolvedValue('test-app-token'),
}));

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from: (table: string) => ({
      insert: async (payload: Record<string, unknown>) => {
        state.writes.push({ table, op: 'insert', payload });
        return { error: state.insertError };
      },
      update: (payload: Record<string, unknown>) => {
        state.writes.push({ table, op: 'update', payload });
        const chain = { eq: () => chain, then: (resolve: (v: unknown) => void) => resolve({ error: null }) };
        return chain;
      },
      delete: () => {
        state.writes.push({ table, op: 'delete', payload: {} });
        const chain = { eq: () => chain, lt: () => chain, then: (resolve: (v: unknown) => void) => resolve({ error: null }) };
        return chain;
      },
    }),
  }),
}));

const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const publicPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();

function signedRequest(body: string): Request {
  const signature = crypto.sign('sha1', Buffer.from(body), privateKey).toString('base64');
  const header = Buffer.from(JSON.stringify({ alg: 'ECDSA', kid: 'test-kid', signature })).toString('base64');
  return new Request('https://naplesestatejewelry.com/api/webhooks/ebay-account-deletion', {
    method: 'POST',
    headers: { 'x-ebay-signature': header },
    body,
  });
}

const NOTICE = JSON.stringify({
  metadata: { topic: 'MARKETPLACE_ACCOUNT_DELETION', schemaVersion: '1.0', deprecated: false },
  notification: {
    notificationId: 'n-123',
    eventDate: '2026-09-13T20:00:00.000Z',
    publishDate: '2026-09-13T20:00:01.000Z',
    publishAttemptCount: 1,
    data: { username: 'someone', userId: 'u-1', eiasToken: 'tok' },
  },
});

describe('POST /api/webhooks/ebay-account-deletion — verified notice', () => {
  beforeEach(() => {
    vi.resetModules();
    state.writes = [];
    state.insertError = null;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ key: publicPem, algorithm: 'ECDSA', digest: 'SHA1' }), { status: 200 })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('acks 200 with exactly one webhook_events insert, already processed, and no sync-log write', async () => {
    const { POST } = await import('../route');
    const res = await POST(signedRequest(NOTICE));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(state.writes).toHaveLength(1);

    const [write] = state.writes;
    expect(write.table).toBe('webhook_events');
    expect(write.op).toBe('insert');
    expect(write.payload).toMatchObject({
      provider: 'ebay',
      event_id: 'n-123',
      event_type: 'MARKETPLACE_ACCOUNT_DELETION',
      status: 'processed',
    });
    expect(Number.isNaN(Date.parse(String(write.payload.processed_at)))).toBe(false);
    // Deleted users' identifiers are never stored.
    expect(JSON.stringify(write.payload.payload)).not.toMatch(/someone|u-1|eiasToken|username|userId/);
    expect(state.writes.some((w) => w.table === 'ebay_sync_log')).toBe(false);
  });

  it('answers a redelivered notice as a duplicate without writing anything else', async () => {
    state.insertError = { code: '23505', message: 'duplicate key value violates unique constraint' };
    const { POST } = await import('../route');
    const res = await POST(signedRequest(NOTICE));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, duplicate: true });
    expect(state.writes).toHaveLength(1);
  });

  it('returns 500 (so eBay retries) when the receipt cannot be written', async () => {
    state.insertError = { code: '08006', message: 'connection failure' };
    const { POST } = await import('../route');
    const res = await POST(signedRequest(NOTICE));

    expect(res.status).toBe(500);
    expect(state.writes).toHaveLength(1);
  });
});
