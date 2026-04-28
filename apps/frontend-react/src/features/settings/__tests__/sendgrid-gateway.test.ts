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
import { sendgridGateway } from '../sendgrid-gateway';

const mockedClient = apiClient as unknown as {
  get: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

describe('sendgrid-gateway (global super-admin scope)', () => {
  beforeEach(() => {
    mockedClient.get.mockReset();
    mockedClient.put.mockReset();
    mockedClient.post.mockReset();
    mockedClient.delete.mockReset();
  });

  it('getSendgrid() hits GET /settings/sendgrid and returns masked view', async () => {
    mockedClient.get.mockResolvedValueOnce({ data: { apiKeyMasked: 'SG.****...1234', hasKey: true } });
    const out = await sendgridGateway.getSendgrid();
    expect(mockedClient.get).toHaveBeenCalledWith('/settings/sendgrid');
    expect(out).toEqual({ apiKeyMasked: 'SG.****...1234', hasKey: true });
  });

  it('getSendgrid() returns null when API responds null', async () => {
    mockedClient.get.mockResolvedValueOnce({ data: null });
    expect(await sendgridGateway.getSendgrid()).toBeNull();
  });

  it('saveSendgrid() PUTs only apiKey (no webhookBaseUrl) to /settings/sendgrid', async () => {
    mockedClient.put.mockResolvedValueOnce({ data: { apiKeyMasked: 'SG.****...9999', hasKey: true } });
    const out = await sendgridGateway.saveSendgrid({ apiKey: 'SG.new9999' });
    expect(mockedClient.put).toHaveBeenCalledWith('/settings/sendgrid', { apiKey: 'SG.new9999' });
    expect(out).toEqual({ apiKeyMasked: 'SG.****...9999', hasKey: true });
  });

  it('deleteSendgrid() DELETEs /settings/sendgrid', async () => {
    mockedClient.delete.mockResolvedValueOnce({ data: undefined });
    await sendgridGateway.deleteSendgrid();
    expect(mockedClient.delete).toHaveBeenCalledWith('/settings/sendgrid');
  });

  it('testSendgrid() POSTs apiKey to /settings/sendgrid/test', async () => {
    mockedClient.post.mockResolvedValueOnce({ data: { accountName: 'Acme' } });
    const out = await sendgridGateway.testSendgrid('SG.abc123');
    expect(mockedClient.post).toHaveBeenCalledWith('/settings/sendgrid/test', { apiKey: 'SG.abc123' });
    expect(out.accountName).toBe('Acme');
  });
});
