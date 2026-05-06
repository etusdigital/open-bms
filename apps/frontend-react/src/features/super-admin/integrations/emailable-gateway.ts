import { apiClient } from '@/lib/api-client';

export interface EmailableAdminSettings {
  url?: string;
  apiKeyMasked?: string;
}

export interface EmailableSavePayload {
  url?: string;
  apiKey?: string;
}

export interface EmailableTestPayload {
  url?: string;
  apiKey?: string;
}

export interface TestConnectionResult {
  ok: boolean;
  errorMessage?: string;
}

export const emailableGateway = {
  async get(): Promise<EmailableAdminSettings | null> {
    const res = await apiClient.get<EmailableAdminSettings | null>('/admin/integrations/emailable/settings');
    return res.data;
  },
  async save(payload: EmailableSavePayload): Promise<EmailableAdminSettings> {
    const res = await apiClient.put<EmailableAdminSettings>('/admin/integrations/emailable/settings', payload);
    return res.data;
  },
  async testConnection(payload: EmailableTestPayload): Promise<TestConnectionResult> {
    const res = await apiClient.post<TestConnectionResult>('/admin/integrations/emailable/test-connection', payload);
    return res.data;
  },
};
