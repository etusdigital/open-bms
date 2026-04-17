import type { Account, CreateAccount, EditAccount, SendgridDns } from '../../entities/Account';
import type { AccountGateway } from './AccountGateway.types';
import { HttpClient, axiosAdapter } from '../../infra/HttpClient';
import {
  BriusHttpParams,
  BriusHttpResponse,
  briusHttpParamsDefault,
  getBriusHttpParamsToString,
} from '../_common/Brius';

export class AccountHttpGateway implements AccountGateway {
  constructor(readonly httpClient: HttpClient, readonly baseUrl: string) {}

  async getAll(params: BriusHttpParams): Promise<BriusHttpResponse<Account[]>> {
    const mergedParams = { ...briusHttpParamsDefault, ...params };
    return this.httpClient.get<BriusHttpResponse<Account[]>>(
      `${this.baseUrl}/accounts?${getBriusHttpParamsToString(mergedParams)}`,
    );
  }

  async getAllAccounts(): Promise<BriusHttpResponse<Account[]>> {
    return this.httpClient.get<BriusHttpResponse<Account[]>>(`${this.baseUrl}/accounts/all`);
  }

  async getById(id: number): Promise<Account> {
    return this.httpClient.get<Account>(`${this.baseUrl}/accounts/${id}`);
  }

  async create(account: CreateAccount) {
    return this.httpClient.post<CreateAccount, { account: Account; dns?: SendgridDns }>(
      `${this.baseUrl}/accounts`,
      account,
    );
  }

  async update(account: EditAccount): Promise<Account> {
    return this.httpClient.put<EditAccount, Account>(`${this.baseUrl}/accounts/${account.id}`, account);
  }

  async getIps(): Promise<any> {
    return this.httpClient.get(`${this.baseUrl}/pools/sendgrid/ips`);
  }

  async getSendgridUsers(): Promise<any> {
    return this.httpClient.get(`${this.baseUrl}/accounts/sendgrid-subusers`);
  }

  async delete(id: number) {
    // return this.httpClient.delete(`${this.baseUrl}/accounts/${id}`);
    console.log(id);
  }
}

export const accountHttpGateway = new AccountHttpGateway(axiosAdapter, import.meta.env.VITE_API_MSGOPS);
