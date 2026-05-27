import { apiClient } from '@/lib/api-client';

export type MailersendKeySource = 'account' | 'none';

export interface AccountMailersendSettings {
  source: MailersendKeySource;
  apiKeyMasked: string | null;
}

export interface SaveAccountMailersendPayload {
  apiKey: string;
}

export interface MailersendTestResult {
  ok: boolean;
  errorMessage?: string;
}

export const accountMailersendGateway = {
  async get(accountId: number): Promise<AccountMailersendSettings> {
    const res = await apiClient.get<AccountMailersendSettings>(`/accounts/${accountId}/settings/mailersend`);
    return res.data;
  },

  async save(accountId: number, payload: SaveAccountMailersendPayload): Promise<AccountMailersendSettings> {
    const res = await apiClient.put<AccountMailersendSettings>(`/accounts/${accountId}/settings/mailersend`, payload);
    return res.data;
  },

  async remove(accountId: number): Promise<void> {
    await apiClient.delete(`/accounts/${accountId}/settings/mailersend`);
  },

  async test(accountId: number, apiKey: string): Promise<MailersendTestResult> {
    const res = await apiClient.post<MailersendTestResult>(`/accounts/${accountId}/settings/mailersend/test`, { apiKey });
    return res.data;
  },
};
