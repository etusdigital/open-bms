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
import { accountMailersendGateway } from '../mailersend-account-gateway';

const mockedClient = apiClient as unknown as {
  get: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

describe('mailersend-account-gateway', () => {
  beforeEach(() => {
    mockedClient.get.mockReset();
    mockedClient.put.mockReset();
    mockedClient.post.mockReset();
    mockedClient.delete.mockReset();
  });

  it('get() targets the account-scoped endpoint', async () => {
    mockedClient.get.mockResolvedValueOnce({
      data: { source: 'account', apiKeyMasked: 'mls***bbb' },
    });
    const out = await accountMailersendGateway.get(42);
    expect(mockedClient.get).toHaveBeenCalledWith('/accounts/42/settings/mailersend');
    expect(out.source).toBe('account');
  });

  it('save() PUTs apiKey to the account-scoped endpoint and returns the persisted view', async () => {
    mockedClient.put.mockResolvedValueOnce({
      data: { source: 'account', apiKeyMasked: 'mls***xxx' },
    });
    const out = await accountMailersendGateway.save(42, { apiKey: 'mlsn.xxx' });
    expect(mockedClient.put).toHaveBeenCalledWith('/accounts/42/settings/mailersend', { apiKey: 'mlsn.xxx' });
    expect(out.apiKeyMasked).toBe('mls***xxx');
  });

  it('remove() DELETEs the account-scoped endpoint', async () => {
    mockedClient.delete.mockResolvedValueOnce({ data: undefined });
    await accountMailersendGateway.remove(42);
    expect(mockedClient.delete).toHaveBeenCalledWith('/accounts/42/settings/mailersend');
  });

  it('test() POSTs to the account-scoped test endpoint', async () => {
    mockedClient.post.mockResolvedValueOnce({ data: { ok: true } });
    const out = await accountMailersendGateway.test(42, 'mlsn.xxx');
    expect(mockedClient.post).toHaveBeenCalledWith('/accounts/42/settings/mailersend/test', { apiKey: 'mlsn.xxx' });
    expect(out.ok).toBe(true);
  });
});
