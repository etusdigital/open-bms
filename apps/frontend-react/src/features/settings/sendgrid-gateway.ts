import { apiClient } from '@/lib/api-client';

export interface SendgridSettings {
  apiKey: string;
  webhookBaseUrl?: string;
}

export interface SendgridTestResult {
  accountName: string | null;
}

export const sendgridGateway = {
  async getSendgrid(): Promise<SendgridSettings | null> {
    const res = await apiClient.get<SendgridSettings | null>('/settings/sendgrid');
    return res.data ?? null;
  },

  async saveSendgrid(payload: SendgridSettings): Promise<void> {
    await apiClient.put('/settings/sendgrid', payload);
  },

  async testSendgrid(apiKey: string): Promise<SendgridTestResult> {
    const res = await apiClient.post<SendgridTestResult>('/settings/sendgrid/test', { apiKey });
    return res.data;
  },
};
