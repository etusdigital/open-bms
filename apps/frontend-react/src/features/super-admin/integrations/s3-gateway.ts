import { apiClient } from '@/lib/api-client';

export interface S3AdminSettings {
  endpoint?: string;
  region?: string;
  bucket?: string;
  accessKeyId?: string;
  secretAccessKeyMasked?: string;
  useObjectAcls?: boolean;
  assetsUrl?: string;
}

export interface S3SavePayload {
  endpoint?: string;
  region?: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey?: string;
  useObjectAcls?: boolean;
  assetsUrl?: string;
}

export interface S3TestPayload {
  endpoint?: string;
  region?: string;
  bucket?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
}

export interface TestConnectionResult {
  ok: boolean;
  errorMessage?: string;
}

export const s3Gateway = {
  async get(): Promise<S3AdminSettings | null> {
    const res = await apiClient.get<S3AdminSettings | null>('/admin/integrations/s3/settings');
    return res.data;
  },
  async isConfigured(): Promise<boolean> {
    const res = await apiClient.get<{ configured: boolean }>('/admin/integrations/s3/configured');
    return res.data.configured;
  },
  async save(payload: S3SavePayload): Promise<S3AdminSettings> {
    const res = await apiClient.put<S3AdminSettings>('/admin/integrations/s3/settings', payload);
    return res.data;
  },
  async testConnection(payload: S3TestPayload): Promise<TestConnectionResult> {
    const res = await apiClient.post<TestConnectionResult>('/admin/integrations/s3/test-connection', payload);
    return res.data;
  },
};
