// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn(),
  },
}));

import { apiClient } from '@/lib/api-client';
import { sendgridGateway } from '../sendgrid-gateway';

const mockedClient = apiClient as unknown as {
  get: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
};

describe('sendgrid-gateway', () => {
  beforeEach(() => {
    mockedClient.get.mockReset();
    mockedClient.put.mockReset();
    mockedClient.post.mockReset();
  });

  it('getSendgrid() hits GET /settings/sendgrid', async () => {
    mockedClient.get.mockResolvedValueOnce({ data: { apiKey: 'SG.x', webhookBaseUrl: 'https://x' } });
    const out = await sendgridGateway.getSendgrid();
    expect(mockedClient.get).toHaveBeenCalledWith('/settings/sendgrid');
    expect(out).toEqual({ apiKey: 'SG.x', webhookBaseUrl: 'https://x' });
  });

  it('getSendgrid() returns null when API responds null', async () => {
    mockedClient.get.mockResolvedValueOnce({ data: null });
    expect(await sendgridGateway.getSendgrid()).toBeNull();
  });

  it('saveSendgrid() PUTs payload to /settings/sendgrid', async () => {
    mockedClient.put.mockResolvedValueOnce({ data: { ok: true } });
    await sendgridGateway.saveSendgrid({ apiKey: 'SG.new', webhookBaseUrl: 'https://app/bms/events' });
    expect(mockedClient.put).toHaveBeenCalledWith('/settings/sendgrid', {
      apiKey: 'SG.new',
      webhookBaseUrl: 'https://app/bms/events',
    });
  });

  it('testSendgrid() POSTs apiKey to /settings/sendgrid/test', async () => {
    mockedClient.post.mockResolvedValueOnce({ data: { accountName: 'Acme' } });
    const out = await sendgridGateway.testSendgrid('SG.abc123');
    expect(mockedClient.post).toHaveBeenCalledWith('/settings/sendgrid/test', { apiKey: 'SG.abc123' });
    expect(out.accountName).toBe('Acme');
  });
});
