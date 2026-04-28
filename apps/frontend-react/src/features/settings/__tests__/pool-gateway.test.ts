// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}));

import { apiClient } from '@/lib/api-client';
import { poolGateway } from '../pool-gateway';

const mocked = apiClient as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
};

describe('pool-gateway', () => {
  beforeEach(() => {
    mocked.get.mockReset();
    mocked.post.mockReset();
    mocked.put.mockReset();
  });

  it('list() unwraps array response', async () => {
    mocked.get.mockResolvedValueOnce({ data: [{ id: 1, accountId: 10 }] });
    const out = await poolGateway.list();
    expect(mocked.get).toHaveBeenCalledWith('/pools');
    expect(out).toEqual([{ id: 1, accountId: 10 }]);
  });

  it('list() unwraps paginated {data:[]} response', async () => {
    mocked.get.mockResolvedValueOnce({ data: { data: [{ id: 2, accountId: 20 }] } });
    const out = await poolGateway.list();
    expect(out).toEqual([{ id: 2, accountId: 20 }]);
  });

  it('create() POSTs payload to /pools', async () => {
    mocked.post.mockResolvedValueOnce({ data: { id: 9 } });
    await poolGateway.create({ name: 'P', poolName: 'p', accountId: 10 });
    expect(mocked.post).toHaveBeenCalledWith('/pools', { name: 'P', poolName: 'p', accountId: 10 });
  });

  it('update() PUTs payload to /pools/:id', async () => {
    mocked.put.mockResolvedValueOnce({ data: { id: 9 } });
    await poolGateway.update(9, { name: 'P', poolName: 'p' });
    expect(mocked.put).toHaveBeenCalledWith('/pools/9', { name: 'P', poolName: 'p' });
  });
});
