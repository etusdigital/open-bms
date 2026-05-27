import { apiClient } from '@/lib/api-client';

export interface SendgridPlatformAdminSettings {
  apiKeyMasked?: string;
  apiBaseUrl?: string;
  webhookUrlBase?: string;
  ipPool?: string;
}

export interface SendgridPlatformSavePayload {
  apiKey?: string;
  apiBaseUrl?: string;
  webhookUrlBase?: string;
  ipPool?: string;
}

export interface SendgridPlatformTestPayload {
  apiKey?: string;
  apiBaseUrl?: string;
}

export interface TestConnectionResult {
  ok: boolean;
  accountName?: string | null;
  errorMessage?: string;
}

export const sendgridPlatformGateway = {
  async get(): Promise<SendgridPlatformAdminSettings | null> {
    const res = await apiClient.get<SendgridPlatformAdminSettings | null>('/admin/integrations/sendgrid/settings');
    return res.data;
  },
  async save(payload: SendgridPlatformSavePayload): Promise<SendgridPlatformAdminSettings> {
    const res = await apiClient.put<SendgridPlatformAdminSettings>('/admin/integrations/sendgrid/settings', payload);
    return res.data;
  },
  async testConnection(payload: SendgridPlatformTestPayload): Promise<TestConnectionResult> {
    const res = await apiClient.post<TestConnectionResult>('/admin/integrations/sendgrid/test-connection', payload);
    return res.data;
  },
};
