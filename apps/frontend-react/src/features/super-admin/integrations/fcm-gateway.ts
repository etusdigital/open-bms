import { apiClient } from '@/lib/api-client';

export interface FcmAdminSettings {
  projectId?: string;
  clientEmail?: string;
  hasPrivateKey: boolean;
}

export interface FcmSavePayload {
  serviceAccountJson?: string;
}

export interface FcmTestPayload {
  serviceAccountJson?: string;
}

export interface TestConnectionResult {
  ok: boolean;
  projectId?: string;
  errorMessage?: string;
}

export const fcmGateway = {
  async get(): Promise<FcmAdminSettings | null> {
    const res = await apiClient.get<FcmAdminSettings | null>('/admin/integrations/fcm/settings');
    return res.data;
  },
  async save(payload: FcmSavePayload): Promise<FcmAdminSettings> {
    const res = await apiClient.put<FcmAdminSettings>('/admin/integrations/fcm/settings', payload);
    return res.data;
  },
  async testConnection(payload: FcmTestPayload): Promise<TestConnectionResult> {
    const res = await apiClient.post<TestConnectionResult>('/admin/integrations/fcm/test-connection', payload);
    return res.data;
  },
};
