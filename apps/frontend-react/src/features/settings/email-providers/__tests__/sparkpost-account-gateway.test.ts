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
import { accountSparkpostGateway } from '../sparkpost-account-gateway';

const mockedClient = apiClient as unknown as {
  get: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

describe('sparkpost-account-gateway', () => {
  beforeEach(() => {
    mockedClient.get.mockReset();
    mockedClient.put.mockReset();
    mockedClient.post.mockReset();
    mockedClient.delete.mockReset();
  });

  it('get() targets account-scoped endpoint', async () => {
    mockedClient.get.mockResolvedValueOnce({ data: { source: 'account', apiKeyMasked: 'sp***bbb' } });
    const out = await accountSparkpostGateway.get(42);
    expect(mockedClient.get).toHaveBeenCalledWith('/accounts/42/settings/sparkpost');
    expect(out.source).toBe('account');
  });

  it('save() PUTs apiKey and returns persisted view', async () => {
    mockedClient.put.mockResolvedValueOnce({ data: { source: 'account', apiKeyMasked: 'sp***xxx' } });
    const out = await accountSparkpostGateway.save(42, { apiKey: 'sparkpost-xxx' });
    expect(mockedClient.put).toHaveBeenCalledWith('/accounts/42/settings/sparkpost', { apiKey: 'sparkpost-xxx' });
    expect(out.apiKeyMasked).toBe('sp***xxx');
  });

  it('remove() DELETEs account-scoped endpoint', async () => {
    mockedClient.delete.mockResolvedValueOnce({ data: undefined });
    await accountSparkpostGateway.remove(42);
    expect(mockedClient.delete).toHaveBeenCalledWith('/accounts/42/settings/sparkpost');
  });

  it('test() POSTs to test endpoint with apiKey body', async () => {
    mockedClient.post.mockResolvedValueOnce({ data: { ok: true } });
    const out = await accountSparkpostGateway.test(42, 'sparkpost-xxx');
    expect(mockedClient.post).toHaveBeenCalledWith('/accounts/42/settings/sparkpost/test', { apiKey: 'sparkpost-xxx' });
    expect(out.ok).toBe(true);
  });
});
