import { BillingProduct } from '../../entities/Billing/Billing.types';

export interface BillingGateway {
  getAll(month: string): Promise<BillingProduct[]>;
}
