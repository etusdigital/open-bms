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
import { accountSendgridGateway } from '../sendgrid-account-gateway';

const mockedClient = apiClient as unknown as {
  get: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

describe('sendgrid-account-gateway', () => {
  beforeEach(() => {
    mockedClient.get.mockReset();
    mockedClient.put.mockReset();
    mockedClient.post.mockReset();
    mockedClient.delete.mockReset();
  });

  it('get() targets the account-scoped endpoint', async () => {
    mockedClient.get.mockResolvedValueOnce({
      data: { source: 'account', apiKeyMasked: 'SG.****...zzzz', webhookUrl: 'https://hook?account=42' },
    });
    const out = await accountSendgridGateway.get(42);
    expect(mockedClient.get).toHaveBeenCalledWith('/accounts/42/settings/sendgrid');
    expect(out.source).toBe('account');
  });

  it('save() PUTs apiKey to the account-scoped endpoint and returns the persisted view', async () => {
    mockedClient.put.mockResolvedValueOnce({
      data: { source: 'account', apiKeyMasked: 'SG.****...9999', webhookUrl: 'https://hook?account=42' },
    });
    const out = await accountSendgridGateway.save(42, { apiKey: 'SG.client9999' });
    expect(mockedClient.put).toHaveBeenCalledWith('/accounts/42/settings/sendgrid', { apiKey: 'SG.client9999' });
    expect(out.apiKeyMasked).toBe('SG.****...9999');
  });

  it('remove() DELETEs the account-scoped endpoint', async () => {
    mockedClient.delete.mockResolvedValueOnce({ data: undefined });
    await accountSendgridGateway.remove(42);
    expect(mockedClient.delete).toHaveBeenCalledWith('/accounts/42/settings/sendgrid');
  });

  it('test() POSTs to the account-scoped test endpoint', async () => {
    mockedClient.post.mockResolvedValueOnce({ data: { accountName: 'Tenant' } });
    const out = await accountSendgridGateway.test(42, 'SG.candidate');
    expect(mockedClient.post).toHaveBeenCalledWith('/accounts/42/settings/sendgrid/test', { apiKey: 'SG.candidate' });
    expect(out.accountName).toBe('Tenant');
  });
});
