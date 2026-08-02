import { describe, expect, it } from 'vitest';

describe('sanitizeAccountDeletionEvent', () => {
  it('keeps notification metadata but strips eBay user identifiers before persistence', async () => {
    const { sanitizeAccountDeletionEvent } = await import('../route');
    const sanitized = sanitizeAccountDeletionEvent({
      metadata: {
        topic: 'MARKETPLACE_ACCOUNT_DELETION',
        schemaVersion: '1.0',
        deprecated: false,
      },
      notification: {
        notificationId: 'n1',
        eventDate: '2026-07-16T22:00:00.000Z',
        publishDate: '2026-07-16T22:00:01.000Z',
        publishAttemptCount: 1,
        data: {
          username: 'buyer-user',
          userId: 'buyer-id',
          eiasToken: 'buyer-eias-token',
        },
      },
    });

    expect(sanitized).toEqual({
      metadata: {
        topic: 'MARKETPLACE_ACCOUNT_DELETION',
        schemaVersion: '1.0',
        deprecated: false,
      },
      notification: {
        notificationId: 'n1',
        eventDate: '2026-07-16T22:00:00.000Z',
        publishDate: '2026-07-16T22:00:01.000Z',
        publishAttemptCount: 1,
      },
    });
    expect(JSON.stringify(sanitized)).not.toContain('buyer-user');
    expect(JSON.stringify(sanitized)).not.toContain('buyer-id');
    expect(JSON.stringify(sanitized)).not.toContain('buyer-eias-token');
  });
});
