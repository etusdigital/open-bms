import { api } from '@/services/api.service';

export default class LoginService {
  // Kept for backward compat; no-op under local auth (legacy Auth0 lazy-create).
  async loginAPI(_user: any) {
    return undefined;
  }

  async getMe(accountId?: number) {
    const params = accountId ? `?accountId=${accountId}` : '';
    return await api.get(`/users/me${params}`);
  }
}
