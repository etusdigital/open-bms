import { apiClient } from '@/lib/api-client';

export type ResendKeySource = 'account' | 'none';

export interface AccountResendSettings {
  source: ResendKeySource;
  apiKeyMasked: string | null;
}

export interface SaveAccountResendPayload {
  apiKey: string;
}

export interface ResendTestResult {
  ok: boolean;
  errorMessage?: string;
}

export const accountResendGateway = {
  async get(accountId: number): Promise<AccountResendSettings> {
    const res = await apiClient.get<AccountResendSettings>(`/accounts/${accountId}/settings/resend`);
    return res.data;
  },

  async save(accountId: number, payload: SaveAccountResendPayload): Promise<AccountResendSettings> {
    const res = await apiClient.put<AccountResendSettings>(`/accounts/${accountId}/settings/resend`, payload);
    return res.data;
  },

  async remove(accountId: number): Promise<void> {
    await apiClient.delete(`/accounts/${accountId}/settings/resend`);
  },

  async test(accountId: number, apiKey: string): Promise<ResendTestResult> {
    const res = await apiClient.post<ResendTestResult>(`/accounts/${accountId}/settings/resend/test`, { apiKey });
    return res.data;
  },
};
