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
import { accountMandrillGateway } from '../mandrill-account-gateway';

const mockedClient = apiClient as unknown as {
  get: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

describe('mandrill-account-gateway', () => {
  beforeEach(() => {
    mockedClient.get.mockReset();
    mockedClient.put.mockReset();
    mockedClient.post.mockReset();
    mockedClient.delete.mockReset();
  });

  it('get() targets account-scoped endpoint', async () => {
    mockedClient.get.mockResolvedValueOnce({ data: { source: 'account', apiKeyMasked: 'mn***bbb' } });
    const out = await accountMandrillGateway.get(42);
    expect(mockedClient.get).toHaveBeenCalledWith('/accounts/42/settings/mandrill');
    expect(out.source).toBe('account');
  });

  it('save() PUTs apiKey', async () => {
    mockedClient.put.mockResolvedValueOnce({ data: { source: 'account', apiKeyMasked: 'mn***xxx' } });
    const out = await accountMandrillGateway.save(42, { apiKey: 'mandrill-key' });
    expect(mockedClient.put).toHaveBeenCalledWith('/accounts/42/settings/mandrill', { apiKey: 'mandrill-key' });
    expect(out.apiKeyMasked).toBe('mn***xxx');
  });

  it('remove() DELETEs', async () => {
    mockedClient.delete.mockResolvedValueOnce({ data: undefined });
    await accountMandrillGateway.remove(42);
    expect(mockedClient.delete).toHaveBeenCalledWith('/accounts/42/settings/mandrill');
  });

  it('test() POSTs to test endpoint', async () => {
    mockedClient.post.mockResolvedValueOnce({ data: { ok: true } });
    const out = await accountMandrillGateway.test(42, 'mandrill-key');
    expect(mockedClient.post).toHaveBeenCalledWith('/accounts/42/settings/mandrill/test', { apiKey: 'mandrill-key' });
    expect(out.ok).toBe(true);
  });
});
