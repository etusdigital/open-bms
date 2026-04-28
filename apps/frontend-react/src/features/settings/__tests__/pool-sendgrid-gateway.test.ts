// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

import { apiClient } from '@/lib/api-client';
import { poolSendgridGateway } from '../pool-sendgrid-gateway';

const mockedClient = apiClient as unknown as {
  get: ReturnType<typeof vi.fn>;
};

describe('pool-sendgrid-gateway', () => {
  beforeEach(() => {
    mockedClient.get.mockReset();
  });

  describe('listPools', () => {
    it('hits GET /pools/sendgrid and returns the list', async () => {
      mockedClient.get.mockResolvedValueOnce({ data: [{ name: 'pool-A' }, { name: 'pool-B' }] });
      const out = await poolSendgridGateway.listPools();
      expect(mockedClient.get).toHaveBeenCalledWith('/pools/sendgrid');
      expect(out).toEqual([{ name: 'pool-A' }, { name: 'pool-B' }]);
    });

    it('returns [] when API responds null', async () => {
      mockedClient.get.mockResolvedValueOnce({ data: null });
      expect(await poolSendgridGateway.listPools()).toEqual([]);
    });

    it('returns [] when API responds with non-array', async () => {
      mockedClient.get.mockResolvedValueOnce({ data: { error: 'bad' } });
      expect(await poolSendgridGateway.listPools()).toEqual([]);
    });
  });

  describe('listIpsForPool', () => {
    it('encodes pool name and hits the per-pool endpoint', async () => {
      mockedClient.get.mockResolvedValueOnce({
        data: [{ ip: '1.2.3.4', pools: ['weird name'] }],
      });
      const out = await poolSendgridGateway.listIpsForPool('weird name');
      expect(mockedClient.get).toHaveBeenCalledWith('/pools/ips/sendgrid/weird%20name');
      expect(out).toEqual([{ ip: '1.2.3.4', pools: ['weird name'] }]);
    });

    it('returns [] when API responds null', async () => {
      mockedClient.get.mockResolvedValueOnce({ data: null });
      expect(await poolSendgridGateway.listIpsForPool('p')).toEqual([]);
    });
  });
});
