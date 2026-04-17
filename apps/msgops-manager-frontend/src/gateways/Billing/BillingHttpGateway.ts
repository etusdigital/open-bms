import { BillingProduct } from '../../entities/Billing/Billing.types';
import { HttpClient, axiosAdapter } from '../../infra/HttpClient';
import { BillingGateway } from './BillingGateway.types';

export class BillingHttpGateway implements BillingGateway {
  constructor(readonly httpClient: HttpClient, readonly baseUrl: string) {}

  async getAll(month: string, accountId?: Array<number> | number): Promise<BillingProduct[]> {
    const accountIdParams = (accountId as number[])?.map((id) => `accountId[]=${id}`).join('&');
    const url = `${this.baseUrl}/statistics/account-usage?month=${month}${
      accountIdParams ? '&' + accountIdParams : ''
    }`;
    return this.httpClient.get<BillingProduct[]>(url);
  }

  async getMonths(): Promise<any> {
    return this.httpClient.get<any>(`${this.baseUrl}/statistics/account-usage/month`);
  }
}

export const billingHttpGateway = new BillingHttpGateway(axiosAdapter, import.meta.env.VITE_API_MSGOPS);
