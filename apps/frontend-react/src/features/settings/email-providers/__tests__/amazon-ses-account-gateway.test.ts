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
import { accountSesGateway } from '../amazon-ses-account-gateway';

const mockedClient = apiClient as unknown as {
  get: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

describe('amazon-ses-account-gateway', () => {
  beforeEach(() => {
    mockedClient.get.mockReset();
    mockedClient.put.mockReset();
    mockedClient.post.mockReset();
    mockedClient.delete.mockReset();
  });

  it('get() targets account-scoped endpoint', async () => {
    mockedClient.get.mockResolvedValueOnce({
      data: { source: 'account', accessKeyIdMasked: 'AKI***xxx', secretAccessKeyMasked: 'a***z', region: 'us-east-1' },
    });
    const out = await accountSesGateway.get(42);
    expect(mockedClient.get).toHaveBeenCalledWith('/accounts/42/settings/ses');
    expect(out.region).toBe('us-east-1');
  });

  it('save() PUTs 3-field payload', async () => {
    mockedClient.put.mockResolvedValueOnce({
      data: { source: 'account', accessKeyIdMasked: 'AKI***xxx', secretAccessKeyMasked: 'a***z', region: 'us-east-1' },
    });
    const payload = { accessKeyId: 'AKIAEXAMPLEKEYAAAAAA', secretAccessKey: 'sx'.repeat(25), region: 'us-east-1' };
    const out = await accountSesGateway.save(42, payload);
    expect(mockedClient.put).toHaveBeenCalledWith('/accounts/42/settings/ses', payload);
    expect(out.source).toBe('account');
  });

  it('remove() DELETEs', async () => {
    mockedClient.delete.mockResolvedValueOnce({ data: undefined });
    await accountSesGateway.remove(42);
    expect(mockedClient.delete).toHaveBeenCalledWith('/accounts/42/settings/ses');
  });

  it('test() POSTs 3-field payload to test endpoint', async () => {
    mockedClient.post.mockResolvedValueOnce({ data: { ok: true } });
    const payload = { accessKeyId: 'AKIAEXAMPLEKEYAAAAAA', secretAccessKey: 'sx'.repeat(25), region: 'us-east-1' };
    const out = await accountSesGateway.test(42, payload);
    expect(mockedClient.post).toHaveBeenCalledWith('/accounts/42/settings/ses/test', payload);
    expect(out.ok).toBe(true);
  });
});
