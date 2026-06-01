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

  it('get() targets the account-scoped endpoint and returns webhookUrl + fromDomain alongside source', async () => {
    mockedClient.get.mockResolvedValueOnce({
      data: { source: 'account', apiKeyMasked: 'SG.****...zzzz', webhookUrl: 'https://hook?account=42', fromDomain: 'mail.acme.com' },
    });
    const out = await accountSendgridGateway.get(42);
    expect(mockedClient.get).toHaveBeenCalledWith('/accounts/42/settings/sendgrid');
    expect(out.source).toBe('account');
    expect(out.webhookUrl).toBe('https://hook?account=42');
    expect(out.fromDomain).toBe('mail.acme.com');
  });

  it('save() PUTs apiKey + fromDomain to the account-scoped endpoint and returns the persisted view', async () => {
    mockedClient.put.mockResolvedValueOnce({
      data: { source: 'account', apiKeyMasked: 'SG.****...9999', webhookUrl: 'https://hook?account=42', fromDomain: 'mail.acme.com' },
    });
    const out = await accountSendgridGateway.save(42, { apiKey: 'SG.client9999', fromDomain: 'mail.acme.com' });
    expect(mockedClient.put).toHaveBeenCalledWith('/accounts/42/settings/sendgrid', { apiKey: 'SG.client9999', fromDomain: 'mail.acme.com' });
    expect(out.apiKeyMasked).toBe('SG.****...9999');
    expect(out.fromDomain).toBe('mail.acme.com');
  });

  it('save() supports metadata-only edits (fromDomain without apiKey)', async () => {
    mockedClient.put.mockResolvedValueOnce({
      data: { source: 'account', apiKeyMasked: 'SG.****...9999', webhookUrl: 'https://hook?account=42', fromDomain: 'news.acme.com' },
    });
    const out = await accountSendgridGateway.save(42, { fromDomain: 'news.acme.com' });
    expect(mockedClient.put).toHaveBeenCalledWith('/accounts/42/settings/sendgrid', { fromDomain: 'news.acme.com' });
    expect(out.fromDomain).toBe('news.acme.com');
  });

  it('remove() DELETEs the account-scoped endpoint', async () => {
    mockedClient.delete.mockResolvedValueOnce({ data: undefined });
    await accountSendgridGateway.remove(42);
    expect(mockedClient.delete).toHaveBeenCalledWith('/accounts/42/settings/sendgrid');
  });

  it('test() POSTs and reshapes the backend response into { ok, errorMessage } for ProviderCard', async () => {
    mockedClient.post.mockResolvedValueOnce({ data: { accountName: 'Tenant' } });
    const out = await accountSendgridGateway.test(42, 'SG.candidate');
    expect(mockedClient.post).toHaveBeenCalledWith('/accounts/42/settings/sendgrid/test', { apiKey: 'SG.candidate' });
    expect(out).toEqual({ ok: true, errorMessage: 'Tenant' });
  });

  it('test() returns { ok: false } with the backend error message when the request rejects', async () => {
    const httpError = Object.assign(new Error('boom'), {
      response: { data: { message: 'Credenciais inválidas.' } },
    });
    mockedClient.post.mockRejectedValueOnce(httpError);
    const out = await accountSendgridGateway.test(42, 'SG.bad');
    expect(out).toEqual({ ok: false, errorMessage: 'Credenciais inválidas.' });
  });
});
