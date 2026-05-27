import { apiClient } from '@/lib/api-client';

export interface WhatsappHubAdminSettings {
  enabled: boolean;
  url?: string;
  apiKeyMasked?: string;
  webhookSecretMasked?: string;
}

export interface WhatsappHubSavePayload {
  enabled?: boolean;
  url?: string;
  apiKey?: string;
  webhookSecret?: string;
}

export const whatsappHubGateway = {
  async get(): Promise<WhatsappHubAdminSettings | null> {
    const res = await apiClient.get<WhatsappHubAdminSettings | null>('/admin/integrations/whatsapp-hub/settings');
    return res.data;
  },
  async save(payload: WhatsappHubSavePayload): Promise<WhatsappHubAdminSettings> {
    const res = await apiClient.put<WhatsappHubAdminSettings>('/admin/integrations/whatsapp-hub/settings', payload);
    return res.data;
  },
};
