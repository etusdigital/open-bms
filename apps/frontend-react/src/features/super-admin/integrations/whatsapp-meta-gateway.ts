import { apiClient } from '@/lib/api-client';

export interface WhatsappMetaAdminSettings {
  appId?: string;
  appSecretMasked?: string;
  configId?: string;
  verifyTokenMasked?: string;
  graphVersion?: string;
}

export interface WhatsappMetaSavePayload {
  appId?: string;
  appSecret?: string;
  configId?: string;
  verifyToken?: string;
  graphVersion?: string;
}

export const whatsappMetaGateway = {
  async get(): Promise<WhatsappMetaAdminSettings | null> {
    const res = await apiClient.get<WhatsappMetaAdminSettings | null>('/admin/integrations/whatsapp-meta/settings');
    return res.data;
  },
  async save(payload: WhatsappMetaSavePayload): Promise<WhatsappMetaAdminSettings> {
    const res = await apiClient.put<WhatsappMetaAdminSettings>('/admin/integrations/whatsapp-meta/settings', payload);
    return res.data;
  },
};
