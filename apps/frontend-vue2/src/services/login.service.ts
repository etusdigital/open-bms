import ApiService from '@/services/api.service';

export default class LoginService {
  private api = new ApiService();

  async loginAPI(user: any) {
    if (user) {
      const clientApi = await this.api.getApi();
      return await clientApi.post('/users/login', user);
    }
  }

  async getMe(accountId?: number) {
    const clientApi = await this.api.getApi();
    const params = accountId ? `?accountId=${accountId}` : '';
    return await clientApi.get(`/users/me${params}`);
  }
}
