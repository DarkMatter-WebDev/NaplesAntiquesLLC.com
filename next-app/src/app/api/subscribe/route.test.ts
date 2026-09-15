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
import { SMS_CONSENT_TEXT, SMS_CONSENT_VERSION } from '@/lib/subscriber-phone';

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
    // No channel = the old email-only form: no phone, no consent fields.
    expect(mocks.rpc).toHaveBeenCalledWith('subscribe_homepage_v2', {
      subscriber_email: 'customer@example.com',
      subscriber_name: 'Customer',
      subscriber_locale: 'en',
      subscriber_phone: null,
      subscriber_sms_consent: false,
      subscriber_sms_consent_text: null,
      subscriber_sms_consent_version: null,
      subscriber_source: 'homepage_hero',
    });
    await expect(response.json()).resolves.toEqual({ success: true, channel: 'email', smsStatus: null });
  });

  it('saves a text-only sign-up with the server copy of the consent statement', async () => {
    mocks.rpc.mockResolvedValue({ data: [{ subscriber_id: 'id', phone_saved: true, sms_status: 'pending' }], error: null });

    const response = await POST(new Request('https://example.com/api/subscribe', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ channel: 'text', phone: '(239) 404-8505', smsConsent: true, locale: 'es', fullName: 'Cliente' }),
    }));

    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith('subscribe_homepage_v2', expect.objectContaining({
      subscriber_email: null,
      subscriber_phone: '+12394048505',
      subscriber_sms_consent: true,
      subscriber_sms_consent_text: SMS_CONSENT_TEXT.es,
      subscriber_sms_consent_version: SMS_CONSENT_VERSION,
      subscriber_locale: 'es',
    }));
    await expect(response.json()).resolves.toEqual({ success: true, channel: 'text', smsStatus: 'pending' });
  });

  it('refuses a text sign-up without a dialable number or without the consent box', async () => {
    const noNumber = await POST(new Request('https://example.com/api/subscribe', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ channel: 'text', phone: '239-555-0148', smsConsent: true }),
    }));
    expect(noNumber.status).toBe(400);

    const noConsent = await POST(new Request('https://example.com/api/subscribe', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ channel: 'both', email: 'customer@example.com', phone: '239-404-8505' }),
    }));
    expect(noConsent.status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('still requires an email when the choice includes it', async () => {
    const response = await POST(new Request('https://example.com/api/subscribe', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ channel: 'both', phone: '239-404-8505', smsConsent: true }),
    }));
    expect(response.status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
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
