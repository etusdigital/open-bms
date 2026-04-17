import { defineStore } from 'pinia';
import { Storekeys } from '../Stores.types';
import { BillingState } from './useBillingStore.types';
import { billingHttpGateway } from '../../gateways/Billing/';
import { BillingProduct } from '../../entities/Billing';

export const useBillingStore = defineStore(Storekeys.BILLING, {
  state: (): BillingState => ({
    billing: [],
    months: [],
    loading: false,
    error: undefined,
  }),

  getters: {},
  actions: {
    async fetchBilling(month: string, accountId?: Array<number> | number) {
      this.billing = [];
      this.loading = true;
      this.error = undefined;

      try {
        this.billing = await billingHttpGateway.getAll(month, accountId);
        const totalBilling = { cost: 0, quantity: 0, unitCost: '-', service: 'Total' };
        this.billing.forEach((item: BillingProduct) => {
          totalBilling.cost += parseFloat(item.cost);
          totalBilling.quantity += parseInt(item.quantity);
        });
        this.billing.push(totalBilling);
      } catch (error) {
        this.error = error;
      } finally {
        this.loading = false;
      }
    },
    async fetchGetMonths() {
      this.months = [];
      this.error = undefined;

      try {
        const months = await billingHttpGateway.getMonths();
        this.months = months
          .map((item: any) => item.month)
          .sort((a: any, b: any) => {
            const [yearA, monthA] = a.split('-').map(Number);
            const [yearB, monthB] = b.split('-').map(Number);

            if (yearA !== yearB) {
              return yearB - yearA;
            }

            return monthB - monthA;
          });
      } catch (error) {
        this.error = error;
      }
    },
  },
});
