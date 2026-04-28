import { apiClient } from '@/lib/api-client';

// Per-account scheme only — no platform-wide fallback. Either the account
// has its own SendGrid key (`account`) or it doesn't (`none`).
export type SendgridKeySource = 'account' | 'none';

export interface AccountSendgridSettings {
  source: SendgridKeySource;
  apiKeyMasked: string | null;
  webhookUrl: string | null;
}

export interface SaveAccountSendgridPayload {
  apiKey: string;
}

export interface SendgridTestResult {
  accountName: string | null;
}

export const accountSendgridGateway = {
  async get(accountId: number): Promise<AccountSendgridSettings> {
    const res = await apiClient.get<AccountSendgridSettings>(`/accounts/${accountId}/settings/sendgrid`);
    return res.data;
  },

  async save(accountId: number, payload: SaveAccountSendgridPayload): Promise<AccountSendgridSettings> {
    const res = await apiClient.put<AccountSendgridSettings>(`/accounts/${accountId}/settings/sendgrid`, payload);
    return res.data;
  },

  async remove(accountId: number): Promise<void> {
    await apiClient.delete(`/accounts/${accountId}/settings/sendgrid`);
  },

  async test(accountId: number, apiKey: string): Promise<SendgridTestResult> {
    const res = await apiClient.post<SendgridTestResult>(`/accounts/${accountId}/settings/sendgrid/test`, { apiKey });
    return res.data;
  },
};
