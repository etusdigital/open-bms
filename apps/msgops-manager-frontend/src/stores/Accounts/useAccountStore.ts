import { defineStore } from 'pinia';
import { Storekeys } from '../Stores.types';
import { accountHttpGateway } from '../../gateways/Account';
import type { AccountsState } from './useAccountStore.types';
import { BmsHttpParams } from '../../gateways/_common/Bms';
import { CreateAccount, EditAccount } from '../../entities/Account';

export const useAccountStore = defineStore(Storekeys.ACCOUNTS, {
  state: (): AccountsState => ({
    accounts: {
      itemsPerPage: '',
      page: '',
      results: [],
      totalItems: 0,
    },
    account: undefined,
    loading: false,
    error: undefined,
  }),
  getters: {
    accountsCount(state) {
      return Array.isArray(state.accounts) ? state.accounts.length : state.accounts.results.length;
    },
  },
  actions: {
    async fetchAccounts(params?: BmsHttpParams) {
      this.accounts = {
        itemsPerPage: '',
        page: '',
        results: [],
        totalItems: 0,
      };
      this.loading = true;
      this.error = undefined;

      try {
        this.accounts = await accountHttpGateway.getAll(params ?? {});
      } catch (error) {
        this.error = error;
      } finally {
        this.loading = false;
      }
    },
    async fetchAllAccounts() {
      this.loading = true;
      this.error = undefined;

      try {
        const response = await accountHttpGateway.getAllAccounts();
        this.accounts = response;
      } catch (error) {
        this.error = error;
      } finally {
        this.loading = false;
      }
    },
    async fetchAccount(id: number) {
      this.loading = true;
      this.error = undefined;

      try {
        this.account = await accountHttpGateway.getById(id);
      } catch (error) {
        this.error = error;
      } finally {
        this.loading = false;
      }
    },
    async createAccount(createAccount: CreateAccount) {
      return accountHttpGateway.create(createAccount);
    },
    async updateAccount(account: EditAccount) {
      this.account = await accountHttpGateway.update(account);
    },
    async deleteAccount(id: number) {
      await accountHttpGateway.delete(id);
    },

    async fetchIps() {
      return accountHttpGateway.getIps();
    },

    async fetchSendgridUsers() {
      return accountHttpGateway.getSendgridUsers();
    },

    setAccount(account: any) {
      this.account = account;
    },
  },
});
