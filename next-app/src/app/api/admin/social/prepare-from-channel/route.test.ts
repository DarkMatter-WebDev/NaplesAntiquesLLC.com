import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  createServiceClient: vi.fn(),
  getInstagramPost: vi.fn(),
  getFacebookPost: vi.fn(),
  prepareInstagram: vi.fn(),
  prepareFacebook: vi.fn(),
  copySocialCuration: vi.fn(),
}));

vi.mock('@/lib/admin-auth', () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: mocks.createServiceClient }));
vi.mock('@/lib/instagram/store', () => ({ getPost: mocks.getInstagramPost }));
vi.mock('@/lib/facebook/store', () => ({ getPost: mocks.getFacebookPost }));
vi.mock('@/lib/instagram/sync', () => ({ runPrepareStep: mocks.prepareInstagram }));
vi.mock('@/lib/facebook/sync', () => ({ runPrepareStep: mocks.prepareFacebook }));
vi.mock('@/lib/social-curation-copy', () => ({
  copySocialCuration: mocks.copySocialCuration,
  SocialCurationCopyError: class SocialCurationCopyError extends Error {
    constructor(message: string, readonly status: number) {
      super(message);
    }
  },
}));

import { POST } from './route';

function request(
  from: 'instagram' | 'facebook',
  mode?: 'wording' | 'photos' | 'both',
) {
  return new Request('http://localhost/api/admin/social/prepare-from-channel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productId: 'product-26', from, ...(mode ? { mode } : {}) }),
  });
}

describe('POST /api/admin/social/prepare-from-channel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ error: null });
    mocks.createServiceClient.mockReturnValue({ service: true });
    mocks.copySocialCuration.mockImplementation(async (_service, _productId, from) => ({
      copied: true,
      from,
      to: from === 'instagram' ? 'facebook' : 'instagram',
      imageCount: 8,
      cropCount: 2,
      copiedCardSource: true,
      copiedCardBackground: true,
      droppedImages: 0,
      message: 'Photo setup copied.',
    }));
    mocks.prepareInstagram.mockResolvedValue({ done: true, state: 'review', message: 'Prepared.' });
    mocks.prepareFacebook.mockResolvedValue({ done: true, state: 'review', message: 'Prepared.' });
  });

  it('copies Instagram photo curation before preparing Facebook with the reviewed caption', async () => {
    mocks.getInstagramPost.mockResolvedValue({
      sync_state: 'review',
      posted_caption: 'Reviewed Instagram caption.',
    });

    const response = await POST(request('instagram'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.copySocialCuration).toHaveBeenCalledWith(
      { service: true },
      'product-26',
      'instagram',
    );
    expect(mocks.prepareFacebook).toHaveBeenCalledWith(
      { service: true },
      'product-26',
      undefined,
      'Reviewed Instagram caption.',
    );
    expect(mocks.copySocialCuration.mock.invocationCallOrder[0])
      .toBeLessThan(mocks.prepareFacebook.mock.invocationCallOrder[0]);
    expect(body.copiedSetup).toMatchObject({ from: 'instagram', to: 'facebook', imageCount: 8 });
  });

  it('copies Facebook photo curation before preparing Instagram with the reviewed caption', async () => {
    mocks.getFacebookPost.mockResolvedValue({
      sync_state: 'review',
      posted_caption: 'Reviewed Facebook caption.',
    });

    const response = await POST(request('facebook'));

    expect(response.status).toBe(200);
    expect(mocks.copySocialCuration).toHaveBeenCalledWith(
      { service: true },
      'product-26',
      'facebook',
    );
    expect(mocks.prepareInstagram).toHaveBeenCalledWith(
      { service: true },
      'product-26',
      undefined,
      'Reviewed Facebook caption.',
    );
    expect(mocks.copySocialCuration.mock.invocationCallOrder[0])
      .toBeLessThan(mocks.prepareInstagram.mock.invocationCallOrder[0]);
  });

  it('syncs wording without changing the destination photo curation', async () => {
    mocks.getInstagramPost.mockResolvedValue({
      sync_state: 'review',
      posted_caption: 'Reviewed Instagram caption.',
    });
    mocks.getFacebookPost.mockResolvedValue({
      sync_state: 'review',
      posted_caption: 'Keep only for photo sync.',
    });

    const response = await POST(request('instagram', 'wording'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.copySocialCuration).not.toHaveBeenCalled();
    expect(mocks.prepareFacebook).toHaveBeenCalledWith(
      { service: true },
      'product-26',
      undefined,
      'Reviewed Instagram caption.',
    );
    expect(body).toMatchObject({ syncMode: 'wording', copiedSetup: null });
  });

  it('syncs photos while preserving the destination reviewed wording', async () => {
    mocks.getInstagramPost.mockResolvedValue({
      sync_state: 'review',
      posted_caption: 'Do not copy this caption.',
    });
    mocks.getFacebookPost.mockResolvedValue({
      sync_state: 'review',
      posted_caption: 'Keep this Facebook caption.',
    });

    const response = await POST(request('instagram', 'photos'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.copySocialCuration).toHaveBeenCalledWith(
      { service: true },
      'product-26',
      'instagram',
    );
    expect(mocks.prepareFacebook).toHaveBeenCalledWith(
      { service: true },
      'product-26',
      undefined,
      'Keep this Facebook caption.',
    );
    expect(body).toMatchObject({ syncMode: 'photos' });
  });

  it('does not copy or prepare when the source channel has no reviewed caption', async () => {
    mocks.getInstagramPost.mockResolvedValue({ sync_state: 'pending', posted_caption: null });

    const response = await POST(request('instagram'));

    expect(response.status).toBe(409);
    expect(mocks.copySocialCuration).not.toHaveBeenCalled();
    expect(mocks.prepareFacebook).not.toHaveBeenCalled();
  });
});
