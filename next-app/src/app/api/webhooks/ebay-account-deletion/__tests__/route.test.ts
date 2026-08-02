import crypto from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue(true),
  getClientIp: vi.fn().mockReturnValue('192.0.2.1'),
}));

const ORIGINAL_ENV = { ...process.env };

describe('computeChallengeResponse — exact hash algorithm', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('hex-SHA256s the concatenation challengeCode + verificationToken + endpoint, in that order', async () => {
    const { computeChallengeResponse } = await import('../route');
    const challengeCode = 'abc123';
    const verificationToken = 'my-verification-token';
    const endpoint = 'https://naplesestatejewelry.com/api/webhooks/ebay-account-deletion';

    const expected = crypto
      .createHash('sha256')
      .update(challengeCode + verificationToken + endpoint)
      .digest('hex');

    expect(computeChallengeResponse(challengeCode, verificationToken, endpoint)).toBe(expected);
  });

  it('is order-sensitive (never concatenates in a different order)', async () => {
    const { computeChallengeResponse } = await import('../route');
    const a = computeChallengeResponse('code', 'token', 'https://example.com/webhook');
    // Swapping code/token would produce a different hash if order mattered — assert it does.
    const b = computeChallengeResponse('token', 'code', 'https://example.com/webhook');
    expect(a).not.toBe(b);
  });

  it('produces a 64-char lowercase hex string', async () => {
    const { computeChallengeResponse } = await import('../route');
    const result = computeChallengeResponse('x', 'y', 'z');
    expect(result).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('GET /api/webhooks/ebay-account-deletion — challenge echo', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...ORIGINAL_ENV, EBAY_VERIFICATION_TOKEN: 'test-verification-token', NEXT_PUBLIC_SITE_URL: 'https://naplesestatejewelry.com' };
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('returns 400 when challenge_code is missing', async () => {
    const { GET } = await import('../route');
    const res = await GET(new Request('https://naplesestatejewelry.com/api/webhooks/ebay-account-deletion'));
    expect(res.status).toBe(400);
  });

  it('returns 503 when EBAY_VERIFICATION_TOKEN is not configured', async () => {
    delete process.env.EBAY_VERIFICATION_TOKEN;
    const { GET } = await import('../route');
    const res = await GET(new Request('https://naplesestatejewelry.com/api/webhooks/ebay-account-deletion?challenge_code=abc'));
    expect(res.status).toBe(503);
  });

  it('returns 200 with the correctly-computed challengeResponse', async () => {
    const { GET, computeChallengeResponse } = await import('../route');
    const res = await GET(new Request('https://naplesestatejewelry.com/api/webhooks/ebay-account-deletion?challenge_code=abc123'));
    expect(res.status).toBe(200);
    const body = await res.json();
    const expected = computeChallengeResponse(
      'abc123',
      'test-verification-token',
      'https://naplesestatejewelry.com/api/webhooks/ebay-account-deletion',
    );
    expect(body.challengeResponse).toBe(expected);
  });
});

describe('POST /api/webhooks/ebay-account-deletion — signature-verify failure path', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('returns 412 when the X-EBAY-SIGNATURE header is missing', async () => {
    const { POST } = await import('../route');
    const res = await POST(
      new Request('https://naplesestatejewelry.com/api/webhooks/ebay-account-deletion', {
        method: 'POST',
        body: JSON.stringify({ notification: { notificationId: 'n1' } }),
      }),
    );
    expect(res.status).toBe(412);
  });

  it('returns 412 when the X-EBAY-SIGNATURE header is malformed (not base64 JSON)', async () => {
    const { POST } = await import('../route');
    const res = await POST(
      new Request('https://naplesestatejewelry.com/api/webhooks/ebay-account-deletion', {
        method: 'POST',
        headers: { 'x-ebay-signature': 'not-valid-base64-json' },
        body: JSON.stringify({ notification: { notificationId: 'n1' } }),
      }),
    );
    expect(res.status).toBe(412);
  });

  it('returns 412 when the signature header decodes but the signature does not verify', async () => {
    const { POST } = await import('../route');
    const fakeHeader = Buffer.from(JSON.stringify({ alg: 'ecdsa', kid: 'unknown-key', signature: Buffer.from('bogus').toString('base64') })).toString(
      'base64',
    );
    const res = await POST(
      new Request('https://naplesestatejewelry.com/api/webhooks/ebay-account-deletion', {
        method: 'POST',
        headers: { 'x-ebay-signature': fakeHeader },
        body: JSON.stringify({ notification: { notificationId: 'n1' } }),
      }),
    );
    // Public-key fetch will fail (no network/credentials in the test
    // environment) or the signature just won't verify — either way this must
    // be a 412, never a silent 200.
    expect(res.status).toBe(412);
  });
});
