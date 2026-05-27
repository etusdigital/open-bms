import { describe, it, expect } from 'vitest';
import { queryKeys } from '../query-keys';

describe('queryKeys', () => {
  describe('users', () => {
    it('all returns base key', () => {
      expect(queryKeys.users.all).toEqual(['users']);
    });

    it('me includes accountId', () => {
      expect(queryKeys.users.me(42)).toEqual(['users', 'me', { accountId: 42 }]);
    });

    it('me with different accountIds produces different keys', () => {
      expect(queryKeys.users.me(1)).not.toEqual(queryKeys.users.me(2));
    });
  });

  describe('accounts', () => {
    it('configs includes accountId', () => {
      expect(queryKeys.accounts.configs(10)).toEqual(['accounts', 'configs', { accountId: 10 }]);
    });
  });
});
