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
  },
});
