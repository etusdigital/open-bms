import { apiClient } from '@/lib/api-client';

// Global (super-admin) SendGrid view. The plaintext key is never returned —
// the backend masks it as `SG.****...<last4>`. The webhook is registered
// per-account, so this scope has no `webhookBaseUrl`.
export interface GlobalSendgridSettings {
  apiKeyMasked: string;
  hasKey: boolean;
}

export interface SaveSendgridPayload {
  apiKey: string;
}

export interface SendgridTestResult {
  accountName: string | null;
}

export const sendgridGateway = {
  async getSendgrid(): Promise<GlobalSendgridSettings | null> {
    const res = await apiClient.get<GlobalSendgridSettings | null>('/settings/sendgrid');
    return res.data ?? null;
  },

  async saveSendgrid(payload: SaveSendgridPayload): Promise<GlobalSendgridSettings> {
    const res = await apiClient.put<GlobalSendgridSettings>('/settings/sendgrid', payload);
    return res.data;
  },

  async deleteSendgrid(): Promise<void> {
    await apiClient.delete('/settings/sendgrid');
  },

  async testSendgrid(apiKey: string): Promise<SendgridTestResult> {
    const res = await apiClient.post<SendgridTestResult>('/settings/sendgrid/test', { apiKey });
    return res.data;
  },
};
