import { BillingProduct } from '../../entities/Billing';

export type BillingState = {
    billing: BillingProduct[];
    loading: boolean;
    months: string[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    error: any;
};
