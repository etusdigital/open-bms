import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

vi.mock('../../gateways/Account', () => ({
  accountHttpGateway: {
    getAll: vi.fn(),
    getAllAccounts: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getIps: vi.fn(),
    getSendgridUsers: vi.fn(),
  },
}));

import { accountHttpGateway } from '../../gateways/Account';
import { useAccountStore } from './useAccountStore';

const gateway = vi.mocked(accountHttpGateway, true);

describe('useAccountStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('initialises with empty state', () => {
    const store = useAccountStore();
    expect(store.accounts.results).toEqual([]);
    expect(store.loading).toBe(false);
    expect(store.error).toBeUndefined();
  });

  describe('fetchAccounts', () => {
    it('sets loading true during fetch and false after', async () => {
      const response = { itemsPerPage: '10', page: '1', results: [], totalItems: 0 };
      gateway.getAll.mockResolvedValue(response);
      const store = useAccountStore();
      const promise = store.fetchAccounts();
      expect(store.loading).toBe(true);
      await promise;
      expect(store.loading).toBe(false);
    });

    it('stores fetched accounts', async () => {
      const account = { id: 1, name: 'Acme' };
      const response = { itemsPerPage: '10', page: '1', results: [account], totalItems: 1 };
      gateway.getAll.mockResolvedValue(response);
      const store = useAccountStore();
      await store.fetchAccounts();
      expect(store.accounts.results).toEqual([account]);
    });

    it('stores error on failure', async () => {
      const err = new Error('network');
      gateway.getAll.mockRejectedValue(err);
      const store = useAccountStore();
      await store.fetchAccounts();
      expect(store.error).toBe(err);
      expect(store.loading).toBe(false);
    });
  });

  describe('fetchAccount', () => {
    it('stores fetched account', async () => {
      const account = { id: 5, name: 'Test' };
      gateway.getById.mockResolvedValue(account);
      const store = useAccountStore();
      await store.fetchAccount(5);
      expect(store.account).toEqual(account);
    });
  });

  describe('accountsCount getter', () => {
    it('returns results length from paginated response', async () => {
      const response = { itemsPerPage: '10', page: '1', results: [{ id: 1 }, { id: 2 }], totalItems: 2 };
      gateway.getAll.mockResolvedValue(response);
      const store = useAccountStore();
      await store.fetchAccounts();
      expect(store.accountsCount).toBe(2);
    });
  });
});
