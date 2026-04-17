import ApiService from '@/services/api.service';

interface KeyStatus {
  isExpired: boolean;
  expiresAt: string | null;
}

interface KeyStatusResponse {
  api_key: KeyStatus;
  api_key_tracker: KeyStatus;
}

interface ConfirmRegenResponse {
  newKey: string;
  expiresAt: string | null;
}

export default class ApiKeyService {
  private api = new ApiService();

  async requestRegeneration(accountId: number, keyType: 'api_key' | 'api_key_tracker', expiresAt?: string | null): Promise<void> {
    const api = await this.api.getApi();
    await api.post(`accounts/${accountId}/api-keys/request-regen`, { keyType, expiresAt: expiresAt || null });
  }

  async confirmRegeneration(
    accountId: number,
    token: string,
    keyType: 'api_key' | 'api_key_tracker',
  ): Promise<ConfirmRegenResponse> {
    const api = await this.api.getApi();
    const response = await api.post(`accounts/${accountId}/api-keys/confirm-regen`, { token, keyType });
    return response.data;
  }

  async getKeyStatus(accountId: number): Promise<KeyStatusResponse> {
    const api = await this.api.getApi();
    const response = await api.get(`accounts/${accountId}/api-keys/status`);
    return response.data;
  }
}
