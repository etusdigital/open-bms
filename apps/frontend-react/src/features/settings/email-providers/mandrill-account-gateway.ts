import { apiClient } from '@/lib/api-client';

export type MandrillKeySource = 'account' | 'none';

export interface AccountMandrillSettings {
  source: MandrillKeySource;
  apiKeyMasked: string | null;
}

export interface SaveAccountMandrillPayload {
  apiKey: string;
}

export interface MandrillTestResult {
  ok: boolean;
  errorMessage?: string;
}

export const accountMandrillGateway = {
  async get(accountId: number): Promise<AccountMandrillSettings> {
    const res = await apiClient.get<AccountMandrillSettings>(`/accounts/${accountId}/settings/mandrill`);
    return res.data;
  },

  async save(accountId: number, payload: SaveAccountMandrillPayload): Promise<AccountMandrillSettings> {
    const res = await apiClient.put<AccountMandrillSettings>(`/accounts/${accountId}/settings/mandrill`, payload);
    return res.data;
  },

  async remove(accountId: number): Promise<void> {
    await apiClient.delete(`/accounts/${accountId}/settings/mandrill`);
  },

  async test(accountId: number, apiKey: string): Promise<MandrillTestResult> {
    const res = await apiClient.post<MandrillTestResult>(`/accounts/${accountId}/settings/mandrill/test`, { apiKey });
    return res.data;
  },
};
