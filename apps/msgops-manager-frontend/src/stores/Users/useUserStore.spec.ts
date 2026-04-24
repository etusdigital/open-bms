import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

vi.mock('../../gateways/User', () => ({
  userHttpGateway: {
    getAll: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

import { userHttpGateway } from '../../gateways/User';
import { useUserStore } from './useUserStore';

const gateway = vi.mocked(userHttpGateway, true);

describe('useUserStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('initialises with empty state', () => {
    const store = useUserStore();
    expect(store.users.results).toEqual([]);
    expect(store.roles).toEqual([]);
    expect(store.loading).toBe(false);
  });

  describe('fetchUsers', () => {
    it('sets loading and stores users', async () => {
      const user = { id: 1, name: 'Alice' };
      const response = { itemsPerPage: '10', page: '1', results: [user], totalItems: 1 };
      gateway.getAll.mockResolvedValue(response);
      const store = useUserStore();
      await store.fetchUsers({ page: 1 });
      expect(store.users.results).toEqual([user]);
      expect(store.loading).toBe(false);
    });

    it('stores error on failure', async () => {
      const err = new Error('timeout');
      gateway.getAll.mockRejectedValue(err);
      const store = useUserStore();
      await store.fetchUsers({ page: 1 });
      expect(store.error).toBe(err);
    });
  });

  describe('setRoles', () => {
    it('updates roles array', () => {
      const store = useUserStore();
      store.setRoles(['admin', 'billing']);
      expect(store.roles).toEqual(['admin', 'billing']);
    });
  });

  describe('userCount getter', () => {
    it('returns number of users', async () => {
      const response = { itemsPerPage: '10', page: '1', results: [{ id: 1 }, { id: 2 }, { id: 3 }], totalItems: 3 };
      gateway.getAll.mockResolvedValue(response);
      const store = useUserStore();
      await store.fetchUsers({ page: 1 });
      expect(store.userCount).toBe(3);
    });
  });
});
