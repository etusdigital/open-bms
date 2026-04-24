import { defineStore } from 'pinia';
import { Storekeys } from '../Stores.types';
import { UsersState } from './useUserStore.types';
import { userHttpGateway } from '../../gateways/User';
import { CreateUser, EditUser, User } from '../../entities/User';
import { BmsHttpParams } from '../../gateways/_common/Bms';

export const useUserStore = defineStore(Storekeys.USERS, {
  state: (): UsersState => ({
    users: {
      itemsPerPage: '',
      page: '',
      results: [],
      totalItems: 0,
    },
    user: undefined,
    userEdit: undefined,
    loading: false,
    error: undefined,
    roles: [],
    effectiveRole: '',
    globalRole: '',
    permissions: [],
    isSuperAdmin: false,
    canSeeAllAccounts: false,
  }),

  getters: {
    userCount(state) {
      return state.users.results.length;
    },
    userAccountsId(state) {
      return state.user?.userAccount.map((account) => account.accountId);
    },
  },
  actions: {
    async fetchUsers(params: BmsHttpParams) {
      this.users.results = [];
      this.loading = true;
      this.error = undefined;

      try {
        this.users = await userHttpGateway.getAll(params);
      } catch (error) {
        this.error = error;
      } finally {
        this.loading = false;
      }
    },
    async fetchUser(id: number) {
      this.loading = true;

      try {
        this.userEdit = await userHttpGateway.getById(id);
      } catch (error) {
        this.error = error;
      } finally {
        this.loading = false;
      }
    },
    async fetchUsersByTerm(term: string) {
      this.loading = true;
      this.error = undefined;

      try {
        this.users = await userHttpGateway.getAll({ search: term });
      } catch (error) {
        this.error = error;
      } finally {
        this.loading = false;
      }
    },
    async createUser(createUser: CreateUser) {
      await userHttpGateway.create(createUser);
    },
    async updateUser(user: EditUser) {
      await userHttpGateway.update(user);
    },
    async deleteUser(id: number) {
      await userHttpGateway.delete(id);
    },
    setUser(user: User) {
      this.user = user;
    },
    setRoles(roles: string[]) {
      this.roles = roles;
    },
    setAuthContext(me: any) {
      this.user = me as User;
      this.roles = Array.isArray(me?.roles) ? me.roles : [];
      this.permissions = Array.isArray(me?.permissions) ? me.permissions : [];
      this.effectiveRole = me?.effectiveRole || '';
      this.globalRole = me?.globalRole || '';
      this.isSuperAdmin = !!me?.isSuperAdmin;
      this.canSeeAllAccounts = !!me?.canSeeAllAccounts;
    },
    clearAuthContext() {
      this.user = undefined;
      this.roles = [];
      this.permissions = [];
      this.effectiveRole = '';
      this.globalRole = '';
      this.isSuperAdmin = false;
      this.canSeeAllAccounts = false;
    },
  },
});
