import { BillingProduct } from '../../entities/Billing';

export type BillingState = {
    billing: BillingProduct[];
    loading: boolean;
    months: String[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    error: any;
};
