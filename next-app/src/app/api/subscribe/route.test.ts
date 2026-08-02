import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  createServiceClient: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: mocks.checkRateLimit,
  getClientIp: vi.fn().mockReturnValue('192.0.2.1'),
}));

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: mocks.createServiceClient,
}));

import { POST } from './route';

describe('POST /api/subscribe', () => {
  beforeEach(() => {
    mocks.checkRateLimit.mockReset().mockResolvedValue(true);
    mocks.rpc.mockReset().mockResolvedValue({ error: null });
    mocks.createServiceClient.mockReset().mockReturnValue({ rpc: mocks.rpc });
  });

  it('writes through the service-only RPC after validation', async () => {
    const response = await POST(new Request('https://example.com/api/subscribe', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: ' Customer@Example.com ', fullName: 'Customer', locale: 'en' }),
    }));

    expect(response.status).toBe(200);
    expect(mocks.createServiceClient).toHaveBeenCalledOnce();
    expect(mocks.rpc).toHaveBeenCalledWith('subscribe_homepage', {
      subscriber_email: 'customer@example.com',
      subscriber_name: 'Customer',
      subscriber_locale: 'en',
    });
  });

  it('returns 429 without touching Supabase when denied', async () => {
    mocks.checkRateLimit.mockResolvedValue(false);

    const response = await POST(new Request('https://example.com/api/subscribe', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'customer@example.com' }),
    }));

    expect(response.status).toBe(429);
    expect(mocks.createServiceClient).not.toHaveBeenCalled();
  });
});
