import ApiService from '@/services/api.service';

export default class AccountService {
  private api = new ApiService();

  async getAccounts(filters?: any) {
    const api = await this.api.getApi();

    return await api.get(`accounts`, { ...filters });
  }

  async getAccount(id: number) {
    const api = await this.api.getApi();
    return await api.get(`accounts/${id}`);
  }

  async getAccountConfigs() {
    const api = await this.api.getApi();
    return await api.get(`accounts/configs`);
  }
}
