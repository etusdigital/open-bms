// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

import { apiClient } from '@/lib/api-client';
import { accountResendGateway } from '../resend-account-gateway';

const mockedClient = apiClient as unknown as {
  get: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

describe('resend-account-gateway', () => {
  beforeEach(() => {
    mockedClient.get.mockReset();
    mockedClient.put.mockReset();
    mockedClient.post.mockReset();
    mockedClient.delete.mockReset();
  });

  it('get() targets account-scoped endpoint', async () => {
    mockedClient.get.mockResolvedValueOnce({ data: { source: 'account', apiKeyMasked: 're_***bbb' } });
    const out = await accountResendGateway.get(42);
    expect(mockedClient.get).toHaveBeenCalledWith('/accounts/42/settings/resend');
    expect(out.source).toBe('account');
  });

  it('save() PUTs apiKey', async () => {
    mockedClient.put.mockResolvedValueOnce({ data: { source: 'account', apiKeyMasked: 're_***xxx' } });
    const out = await accountResendGateway.save(42, { apiKey: 're_validkey' });
    expect(mockedClient.put).toHaveBeenCalledWith('/accounts/42/settings/resend', { apiKey: 're_validkey' });
    expect(out.apiKeyMasked).toBe('re_***xxx');
  });

  it('remove() DELETEs', async () => {
    mockedClient.delete.mockResolvedValueOnce({ data: undefined });
    await accountResendGateway.remove(42);
    expect(mockedClient.delete).toHaveBeenCalledWith('/accounts/42/settings/resend');
  });

  it('test() POSTs to test endpoint', async () => {
    mockedClient.post.mockResolvedValueOnce({ data: { ok: true } });
    const out = await accountResendGateway.test(42, 're_validkey');
    expect(mockedClient.post).toHaveBeenCalledWith('/accounts/42/settings/resend/test', { apiKey: 're_validkey' });
    expect(out.ok).toBe(true);
  });
});
